/* De Zaakdoos, deelbestand "proxy": het doorgeefluik, de kloon en het naspelen.
   ONLINE gaat alles onder /api/ en /media/ een-op-een door naar de cloud en haalt de
   doos op de achtergrond een verse kloon op; VALT DE LIJN WEG dan draaien dezelfde
   routes lokaal en komt elke zaak-schrijfactie in het journaal; KOMT DE LIJN TERUG
   dan speelt het journaal in volgorde naar de cloud (met vertaling van lokaal
   aangemaakte bonnummers). Krijgt de gedeelde ctx van kern/zaakdoos/index.js. */
module.exports = (ctx) => {
  const { db, save, fs, path, nu, st, teller, journaal, naarLokaal,
    CLOUD, SLEUTEL, GEBRUIKER, WACHTWOORD, actief, HOP, KAS_DIR, KAS_MAX_BESTAND, KAS_MAX_STUKS,
    journaalPadOk, journaalZegel, journaalGeldig, JOURNAAL_MAX_BODY } = ctx;

  /* ---------- de randcache: media blijft op het kastje ----------
     Elke Salon-foto die eenmaal via het doorgeefluik langskwam, bewaart de doos
     lokaal. Valt de lijn weg, dan laden de foto's op de zaak-schermen gewoon door
     vanaf de doos zelf. Met een plafond per bestand en op het aantal; de oudste
     vliegen er als eerste uit. */
  function kasNaam(url) { return String(url).replace(/[^A-Za-z0-9._-]/g, '_').slice(-80); }
  function kasBewaar(url, type, buf) {
    try {
      fs.mkdirSync(KAS_DIR, { recursive: true });
      fs.writeFileSync(path.join(KAS_DIR, kasNaam(url) + '.bin'), buf);
      fs.writeFileSync(path.join(KAS_DIR, kasNaam(url) + '.typ'), String(type || 'application/octet-stream'));
      const alle = fs.readdirSync(KAS_DIR).filter(n => n.endsWith('.bin'));
      if (alle.length > KAS_MAX_STUKS) {
        const opLeeftijd = alle.map(n => ({ n, t: fs.statSync(path.join(KAS_DIR, n)).mtimeMs })).sort((a, b) => a.t - b.t);
        for (const oud of opLeeftijd.slice(0, alle.length - KAS_MAX_STUKS)) {
          try { fs.unlinkSync(path.join(KAS_DIR, oud.n)); fs.unlinkSync(path.join(KAS_DIR, oud.n.replace(/\.bin$/, '.typ'))); } catch (e) {}
        }
      }
    } catch (e) { /* de kas is best-effort; de foto komt anders gewoon niet */ }
  }
  function kasLees(url) {
    try {
      const buf = fs.readFileSync(path.join(KAS_DIR, kasNaam(url) + '.bin'));
      let type = 'application/octet-stream';
      try { type = fs.readFileSync(path.join(KAS_DIR, kasNaam(url) + '.typ'), 'utf8'); } catch (e) {}
      return { buf, type };
    } catch (e) { return null; }
  }
  // hoeveel foto's staan er in de randcache en hoe groot is die (voor het
  // statuspaneel en het dagrapport)
  function kasStats() {
    try {
      const bins = fs.readdirSync(KAS_DIR).filter(n => n.endsWith('.bin'));
      let bytes = 0;
      for (const n of bins) { try { bytes += fs.statSync(path.join(KAS_DIR, n)).size; } catch (e) {} }
      return { stuks: bins.length, bytes };
    } catch (e) { return { stuks: 0, bytes: 0 }; }
  }

  /* ---------- doorgeefluik (alleen in cloudmodus) ---------- */
  function magProxy(pad) {
    if (!pad.startsWith('/api/') && !pad.startsWith('/media/')) return false;
    // de doos zelf blijft altijd lokaal aanspreekbaar voor status en monitoring
    return !pad.startsWith('/api/doos/') && pad !== '/api/health' && pad !== '/api/ready' && pad !== '/api/sat/ping';
  }
  async function proxy(req, res) {
    const headers = {};
    for (const [k, v] of Object.entries(req.headers)) { if (!HOP.includes(k.toLowerCase())) headers[k] = v; }
    let r;
    try {
      r = await fetch(CLOUD() + req.originalUrl, {
        method: req.method, headers,
        body: (req.method === 'GET' || req.method === 'HEAD') ? undefined : req,
        duplex: 'half', signal: AbortSignal.timeout(45000)
      });
    } catch (e) {
      naarLokaal('proxy: ' + (e && e.message));
      return false; // de aanroeper laat dit verzoek lokaal afhandelen
    }
    res.status(r.status);
    r.headers.forEach((v, k) => { if (!HOP.includes(k.toLowerCase()) && k.toLowerCase() !== 'content-encoding') res.setHeader(k, v); });
    // media die over de lijn komt, gaat en passant de randcache in
    const wilKas = req.method === 'GET' && r.status === 200 && req.originalUrl.startsWith('/media/');
    const stukken = wilKas ? [] : null;
    let totaal = 0, heel = true;
    if (r.body) {
      try {
        for await (const stuk of r.body) {
          res.write(stuk);
          if (stukken && (totaal += stuk.length) <= KAS_MAX_BESTAND) stukken.push(stuk);
        }
      } catch (e) { heel = false; /* stream brak; klant probeert opnieuw */ }
    }
    res.end();
    if (stukken && heel && totaal > 0 && totaal <= KAS_MAX_BESTAND) {
      kasBewaar(req.originalUrl, r.headers.get('content-type'), Buffer.concat(stukken));
    }
    return true;
  }

  /* ---------- de kloon: een verse kopie van de clouddata ---------- */
  async function haalKloon() {
    if (!actief || st.modus !== 'cloud' || journaal().length) return;
    try {
      const r = await fetch(CLOUD() + '/api/doos/kloon', { headers: { 'x-doos-sleutel': SLEUTEL }, signal: AbortSignal.timeout(60000) });
      if (!r.ok) return;
      const d = await r.json();
      if (!d || typeof d.data !== 'object' || !d.data) return;
      delete d.data.doosJournaal; // het journaal is van de doos zelf
      delete d.data.doosRefKaart;
      // in-place, zodat alles wat naar db.data verwijst gewoon blijft werken
      for (const k of Object.keys(db.data)) { if (k !== 'doosJournaal' && k !== 'doosRefKaart') delete db.data[k]; }
      Object.assign(db.data, d.data);
      save();
      st.laatsteKloon = Date.now();
    } catch (e) { /* geen lijn: de pinger regelt de modus */ }
  }

  /* ---------- naspelen na herstel ---------- */
  async function cloudToken() {
    if (st.cloudTokenCache) return st.cloudTokenCache;
    const r = await fetch(CLOUD() + '/api/supplier/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: GEBRUIKER, password: WACHTWOORD }), signal: AbortSignal.timeout(20000)
    });
    if (!r.ok) throw new Error('doos-login bij de cloud geweigerd (' + r.status + ')');
    st.cloudTokenCache = (await r.json()).token;
    return st.cloudTokenCache;
  }
  // lokaal aangemaakte nummers (ref/id/pickup) vertalen naar hun cloud-versie
  function leerRefs(lokaalRes, cloudRes, kaart) {
    const SLEUTELS = ['ref', 'id', 'pickup', 'orderRef'];
    (function loop(a, b) {
      if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return;
      for (const k of Object.keys(a)) {
        if (SLEUTELS.includes(k) && typeof a[k] === 'string' && typeof b[k] === 'string' && a[k] !== b[k]) kaart[a[k]] = b[k];
        else if (a[k] && b[k] && typeof a[k] === 'object') loop(a[k], b[k]);
      }
    })(lokaalRes, cloudRes);
  }
  function herschrijf(x, kaart) {
    if (typeof x === 'string') return kaart[x] || x;
    if (Array.isArray(x)) return x.map(v => herschrijf(v, kaart));
    if (x && typeof x === 'object') { const uit = {}; for (const k of Object.keys(x)) uit[k] = herschrijf(x[k], kaart); return uit; }
    return x;
  }
  async function speelNa() {
    const rij = journaal();
    if (!rij.length) return true;
    const kaart = db.data.doosRefKaart || {};
    let token;
    try { token = await cloudToken(); } catch (e) { return false; }
    while (rij.length) {
      const e = rij[0];
      // beveiliging: nooit een gemanipuleerde of buiten-beleid regel naspelen.
      // Een ongeldige regel wordt overgeslagen (niet naar de cloud gestuurd).
      if (!journaalGeldig(e)) {
        console.warn('[doos] journaalregel geweigerd (zegel/pad ongeldig), overgeslagen: ' + (e && e.pad));
        rij.shift(); teller.geweigerd = (teller.geweigerd || 0) + 1; save();
        continue;
      }
      let r;
      try {
        r = await fetch(CLOUD() + e.pad, {
          method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
          body: JSON.stringify(herschrijf(e.body, kaart)), signal: AbortSignal.timeout(30000)
        });
      } catch (err) { return false; } // lijn alweer weg: later verder
      if (r.status === 401) { st.cloudTokenCache = null; try { token = await cloudToken(); continue; } catch (err) { return false; } }
      if (r.status >= 500) return false; // cloud hapert: niets weggooien
      if (r.ok) leerRefs(e.res || {}, await r.json().catch(() => ({})), kaart);
      else console.warn('[doos] journaalregel geweigerd door de cloud (' + r.status + '): ' + e.pad); // conflict: cloud wint
      rij.shift();
      teller.nagespeeld++;
      db.data.doosRefKaart = kaart;
      save();
    }
    return true;
  }

  // een 2xx-schrijfactie in lokale modus komt in het journaal (aangeroepen
  // vanuit de journaal-middleware in server.js). Beveiligd: alleen zaak-paden,
  // een plafond op de body, een oplopend volgnummer en een HMAC-zegel, zodat
  // een gemanipuleerd journaal op schijf bij het naspelen wordt geweigerd.
  function schrijfJournaal(pad, body, resBody) {
    if (!journaalPadOk(pad)) return; // alleen zaak-schrijfacties in het journaal
    const b = body || {};
    try { if (JSON.stringify(b).length > JOURNAAL_MAX_BODY) return; } catch (e) { return; } // geen onzin-body
    const rij = journaal();
    if (!Number.isInteger(db.data.doosSeq)) db.data.doosSeq = 0;
    const e = { seq: ++db.data.doosSeq, pad, body: b, res: resBody || null, at: Date.now() };
    e.zegel = journaalZegel(e);
    rij.push(e);
    if (rij.length > 5000) rij.shift(); // vangnet; een dienst komt hier nooit
    save();
  }

  return { magProxy, proxy, haalKloon, speelNa, schrijfJournaal, kasBewaar, kasLees, kasStats };
};
