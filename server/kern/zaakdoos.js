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

const fs = require('fs');
const path = require('path');

module.exports = ({ db, save, log, dataDir }) => {
  const CLOUD = String(process.env.RTG_DOOS_CLOUD || '').replace(/\/$/, '');
  const SLEUTEL = process.env.RTG_DOOS_SLEUTEL || '';
  const GEBRUIKER = process.env.RTG_DOOS_USER || '';
  const WACHTWOORD = process.env.RTG_DOOS_WACHTWOORD || '';
  const actief = !!CLOUD;

  let modus = actief ? 'cloud' : 'uit'; // 'cloud' (doorgeefluik) | 'lokaal' | 'uit'
  let laatsteKloon = 0;
  let bezig = false;
  let cloudTokenCache = null;
  const nu = () => Date.now();

  /* Het nachtwerk houdt per dag de lijnkwaliteit bij: pings, rondreistijden,
     hoe vaak en hoe lang de lijn wegviel, en hoeveel journaalregels er zijn
     nagespeeld. Om vier uur in de nacht gaat het dagrapport naar de cloud. */
  const teller = { pings: 0, rttSom: 0, uitval: 0, lokaalMs: 0, nagespeeld: 0, sinds: Date.now() };
  let lokaalSinds = 0;

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
      teller.uitval++;
      lokaalSinds = nu();
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

  /* ---------- de randcache: media blijft op het kastje ----------
     Elke Salon-foto die eenmaal via het doorgeefluik langskwam, bewaart de
     doos lokaal. Valt de lijn weg, dan laden de foto's op de zaak-schermen
     gewoon door vanaf de doos zelf. Met een plafond per bestand en op het
     totaal; de oudste vliegen er als eerste uit. */
  const KAS_DIR = path.join(dataDir || '.', 'dooskas');
  const KAS_MAX_BESTAND = 4 * 1024 * 1024;
  const KAS_MAX_STUKS = 400;
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
      teller.nagespeeld++;
      db.data.doosRefKaart = kaart;
      save();
    }
    return true;
  }

  /* ---------- de pinger: bewaakt de lijn en herstelt vanzelf ---------- */
  /* Het meetstation: elke doos die mee mag doen aan het RTG-netwerk
     (RTG_DOOS_NETWERK=1, met instemming van de partner) rapporteert compacte,
     anonieme lijnmetingen: rondreistijd en modus. Zo krijgt de boardroom een
     levende kaart van verbindingskwaliteit per zaak. */
  const NETWERK = process.env.RTG_DOOS_NETWERK === '1';
  const DOOS_NAAM = process.env.RTG_DOOS_NAAM || 'doos';
  let laatsteMelding = 0;
  async function meldMeting(rtt) {
    if (!NETWERK || nu() - laatsteMelding < 60000) return;
    laatsteMelding = nu();
    try {
      await fetch(CLOUD + '/api/doos/meting', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-doos-sleutel': SLEUTEL },
        body: JSON.stringify({ doos: DOOS_NAAM, rtt, modus, journaal: journaal().length }),
        signal: AbortSignal.timeout(10000)
      });
    } catch (e) { /* geen lijn; de volgende tik probeert weer */ }
  }
  /* De buurtfailover: valt bij deze doos de lijn weg, dan geeft hij zijn
     lijnmelding af bij een buurdoos (RTG_DOOS_BUREN), die hem met een
     via-stempel doorstuurt naar de cloud. Zo ziet de vloot het verschil
     tussen "de lijn is kapot" en "het kastje staat uit". Er reist alleen
     de compacte melding mee, nooit zaakdata van wie dan ook. */
  const BUREN = String(process.env.RTG_DOOS_BUREN || '').split(',').map(s => s.trim().replace(/\/$/, '')).filter(Boolean);
  let laatsteBuurMelding = 0;
  async function meldViaBuur() {
    if (!NETWERK || !BUREN.length || nu() - laatsteBuurMelding < 60000) return;
    laatsteBuurMelding = nu();
    const melding = { doos: DOOS_NAAM, rtt: 0, modus, journaal: journaal().length };
    for (const buur of BUREN) {
      try {
        const r = await fetch(buur + '/api/doos/buurmelding', {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'x-doos-sleutel': SLEUTEL },
          body: JSON.stringify(melding), signal: AbortSignal.timeout(8000)
        });
        if (r.ok) return;
      } catch (e) { /* deze buur ook niet; de volgende proberen */ }
    }
  }
  // de ontvangende kant: de melding van een buurdoos doorsturen naar de cloud
  async function buurDoorgeven(b) {
    if (modus !== 'cloud') return false; // onze eigen lijn ligt er ook uit
    b = b || {};
    try {
      const r = await fetch(CLOUD + '/api/doos/meting', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-doos-sleutel': SLEUTEL },
        body: JSON.stringify({ doos: b.doos, rtt: b.rtt, modus: b.modus, journaal: b.journaal, via: DOOS_NAAM }),
        signal: AbortSignal.timeout(10000)
      });
      return r.ok;
    } catch (e) { return false; }
  }

  /* Het nachtwerk zelf: eigen huishouding plus het dagrapport naar de cloud. */
  let laatsteNachtDag = '';
  function dagrapport() {
    const inLokaal = modus === 'lokaal' && lokaalSinds ? nu() - lokaalSinds : 0;
    return {
      doos: DOOS_NAAM, datum: new Date(teller.sinds).toISOString().slice(0, 10),
      pings: teller.pings, rttGem: teller.pings ? Math.round(teller.rttSom / teller.pings) : 0,
      uitval: teller.uitval, lokaalMin: Math.round((teller.lokaalMs + inLokaal) / 60000),
      nagespeeld: teller.nagespeeld
    };
  }
  async function nachtwerk() {
    // een uitgediende ref-kaart mag weg zodra het journaal leeg is
    if (!journaal().length && Object.keys(db.data.doosRefKaart || {}).length > 500) { db.data.doosRefKaart = {}; save(); }
    if (!NETWERK) return;
    try {
      const r = await fetch(CLOUD + '/api/doos/rapport', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-doos-sleutel': SLEUTEL },
        body: JSON.stringify(dagrapport()), signal: AbortSignal.timeout(10000)
      });
      if (r.ok) {
        teller.pings = 0; teller.rttSom = 0; teller.uitval = 0; teller.lokaalMs = 0; teller.nagespeeld = 0;
        teller.sinds = Date.now();
      }
    } catch (e) { /* geen lijn; de volgende nacht opnieuw */ }
  }

  async function tik() {
    if (!actief || bezig) return;
    bezig = true;
    try {
      const start = nu();
      const r = await fetch(CLOUD + '/api/sat/ping', { signal: AbortSignal.timeout(8000) });
      if (!r.ok) throw new Error('ping ' + r.status);
      const rtt = nu() - start;
      teller.pings++;
      teller.rttSom += rtt;
      meldMeting(rtt);
      if (modus === 'lokaal') {
        // de lijn is terug: eerst het journaal netjes naspelen, dan verse kloon
        if (await speelNa()) {
          modus = 'cloud';
          if (lokaalSinds) { teller.lokaalMs += nu() - lokaalSinds; lokaalSinds = 0; }
          console.log('[doos] lijn terug; journaal nagespeeld, doorgeefluik weer aan');
          await haalKloon();
        }
      } else if (Date.now() - laatsteKloon > 60000) {
        await haalKloon();
      }
      // om vier uur in de nacht: huishouding en het dagrapport
      const dag = new Date().toISOString().slice(0, 10);
      if (new Date().getHours() === 4 && dag !== laatsteNachtDag) { laatsteNachtDag = dag; nachtwerk(); }
    } catch (e) { naarLokaal('ping: ' + (e && e.message)); meldViaBuur(); }
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

  return { doos: { actief, magProxy, proxy, status, schrijfJournaal, modusVan: () => modus, tik, speelNa, haalKloon, kasLees, buurDoorgeven, dagrapport } };
};
