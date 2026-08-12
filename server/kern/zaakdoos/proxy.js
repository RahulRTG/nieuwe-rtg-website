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

  /* De kloon en het naspelen staan in ./synchronisatie.js. Dit bestand gaat
     over het MOMENT (dit verzoek, nu); die twee gaan over de bewegingen
     ertussen -- ze lopen over de lijn en duren lang. */
  const { haalKloon, speelNa } = require('./synchronisatie')(ctx);

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
