/* De Zaakdoos: een klein kastje in de zaak (strandclub, boot, afgelegen
   locatie) waarop de eigen schermen (keuken, bar, bediening, kassa) via het
   lokale wifi-netwerk werken, ook als de satelliet- of internetlijn wegvalt.

   Hetzelfde server.js draait erop, in doosmodus (RTG_DOOS_CLOUD gezet):
   - ONLINE is de doos een doorgeefluik: alles onder /api/ en /media/ gaat
     een-op-een door naar de cloud (de cloud blijft de waarheid), en op de
     achtergrond haalt de doos regelmatig een verse kloon van de data op.
   - VALT DE LIJN WEG dan schakelt hij naar lokaal: dezelfde routes draaien
     op de laatste kloon, de zaak werkt gewoon door, en elke schrijfactie
     van de zaak komt in een journaal.
   - KOMT DE LIJN TERUG dan wordt het journaal in volgorde nagespeeld naar
     de cloud (met vertaling van lokaal aangemaakte bonnummers naar de
     nieuwe cloudnummers), daarna een verse kloon, en de doos is weer
     doorgeefluik. Bij een conflict wint de cloud (4xx wordt geregistreerd
     en overgeslagen); een cloudstoring (5xx of geen lijn) pauzeert het
     naspelen tot de volgende poging.

   Bewust klein gehouden: alleen /api/supplier/-schrijfacties komen in het
   journaal (de zaakkant). Gasten bestellen tijdens een storing via de
   bediening; hun eigen app praat met de cloud. */

module.exports = ({ db, save, log }) => {
  const CLOUD = String(process.env.RTG_DOOS_CLOUD || '').replace(/\/$/, '');
  const SLEUTEL = process.env.RTG_DOOS_SLEUTEL || '';
  const GEBRUIKER = process.env.RTG_DOOS_USER || '';
  const WACHTWOORD = process.env.RTG_DOOS_WACHTWOORD || '';
  const actief = !!CLOUD;

  let modus = actief ? 'cloud' : 'uit'; // 'cloud' (doorgeefluik) | 'lokaal' | 'uit'
  let laatsteKloon = 0;
  let bezig = false;
  let cloudTokenCache = null;

  function journaal() {
    if (!Array.isArray(db.data.doosJournaal)) db.data.doosJournaal = [];
    return db.data.doosJournaal;
  }
  function status() {
    return { doos: actief, modus, journaal: actief ? journaal().length : 0, laatsteKloon };
  }
  function naarLokaal(reden) {
    if (modus !== 'lokaal') {
      modus = 'lokaal';
      log && log.warn ? log.warn('[doos] lijn weg (' + reden + '); lokale zaakmodus aan') : console.warn('[doos] lokale zaakmodus aan:', reden);
    }
  }

  /* ---------- doorgeefluik (alleen in cloudmodus) ---------- */
  const HOP = ['connection', 'keep-alive', 'transfer-encoding', 'upgrade', 'proxy-authorization', 'te', 'trailer', 'host', 'content-length'];
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
      r = await fetch(CLOUD + req.originalUrl, {
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
    if (r.body) {
      try { for await (const stuk of r.body) res.write(stuk); } catch (e) { /* stream brak; klant probeert opnieuw */ }
    }
    res.end();
    return true;
  }

  /* ---------- de kloon: een verse kopie van de clouddata ---------- */
  async function haalKloon() {
    if (!actief || modus !== 'cloud' || journaal().length) return;
    try {
      const r = await fetch(CLOUD + '/api/doos/kloon', { headers: { 'x-doos-sleutel': SLEUTEL }, signal: AbortSignal.timeout(60000) });
      if (!r.ok) return;
      const d = await r.json();
      if (!d || typeof d.data !== 'object' || !d.data) return;
      delete d.data.doosJournaal; // het journaal is van de doos zelf
      delete d.data.doosRefKaart;
      // in-place, zodat alles wat naar db.data verwijst gewoon blijft werken
      for (const k of Object.keys(db.data)) { if (k !== 'doosJournaal' && k !== 'doosRefKaart') delete db.data[k]; }
      Object.assign(db.data, d.data);
      save();
      laatsteKloon = Date.now();
    } catch (e) { /* geen lijn: de pinger regelt de modus */ }
  }

  /* ---------- naspelen na herstel ---------- */
  async function cloudToken() {
    if (cloudTokenCache) return cloudTokenCache;
    const r = await fetch(CLOUD + '/api/supplier/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: GEBRUIKER, password: WACHTWOORD }), signal: AbortSignal.timeout(20000)
    });
    if (!r.ok) throw new Error('doos-login bij de cloud geweigerd (' + r.status + ')');
    cloudTokenCache = (await r.json()).token;
    return cloudTokenCache;
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
      let r;
      try {
        r = await fetch(CLOUD + e.pad, {
          method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
          body: JSON.stringify(herschrijf(e.body, kaart)), signal: AbortSignal.timeout(30000)
        });
      } catch (err) { return false; } // lijn alweer weg: later verder
      if (r.status === 401) { cloudTokenCache = null; try { token = await cloudToken(); continue; } catch (err) { return false; } }
      if (r.status >= 500) return false; // cloud hapert: niets weggooien
      if (r.ok) leerRefs(e.res || {}, await r.json().catch(() => ({})), kaart);
      else console.warn('[doos] journaalregel geweigerd door de cloud (' + r.status + '): ' + e.pad); // conflict: cloud wint
      rij.shift();
      db.data.doosRefKaart = kaart;
      save();
    }
    return true;
  }

  /* ---------- de pinger: bewaakt de lijn en herstelt vanzelf ---------- */
  async function tik() {
    if (!actief || bezig) return;
    bezig = true;
    try {
      const r = await fetch(CLOUD + '/api/sat/ping', { signal: AbortSignal.timeout(8000) });
      if (!r.ok) throw new Error('ping ' + r.status);
      if (modus === 'lokaal') {
        // de lijn is terug: eerst het journaal netjes naspelen, dan verse kloon
        if (await speelNa()) {
          modus = 'cloud';
          console.log('[doos] lijn terug; journaal nagespeeld, doorgeefluik weer aan');
          await haalKloon();
        }
      } else if (Date.now() - laatsteKloon > 60000) {
        await haalKloon();
      }
    } catch (e) { naarLokaal('ping: ' + (e && e.message)); }
    bezig = false;
  }
  if (actief) {
    setInterval(tik, 10000).unref();
    setTimeout(tik, 1500).unref();
  }

  // een 2xx-schrijfactie in lokale modus komt in het journaal (aangeroepen
  // vanuit de journaal-middleware in server.js)
  function schrijfJournaal(pad, body, resBody) {
    const rij = journaal();
    rij.push({ pad, body: body || {}, res: resBody || null, at: Date.now() });
    if (rij.length > 5000) rij.shift(); // vangnet; een dienst komt hier nooit
    save();
  }

  return { doos: { actief, magProxy, proxy, status, schrijfJournaal, modusVan: () => modus, tik, speelNa, haalKloon } };
};
