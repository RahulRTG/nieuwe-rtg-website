/* Zaakdoos, deelbestand "synchronisatie": de kloon en het naspelen.

   ./proxy.js gaat over het MOMENT: een verzoek dat binnenkomt gaat door naar de
   cloud of wordt lokaal afgehandeld, en media blijft op het kastje. Dit bestand
   gaat over de twee bewegingen ERTUSSEN, en die lopen allebei over de lijn en
   duren lang:

     haalKloon   een verse kopie van de clouddata naar de doos. Alleen als het
                 journaal LEEG is -- anders zou een kopie werk overschrijven dat
                 nog niet is teruggespeeld, en dan is een bon van vanochtend weg
                 zonder dat iemand het merkt. De vervanging gebeurt in-place,
                 zodat alles wat naar db.data verwijst gewoon blijft werken.
     speelNa     na herstel het journaal in volgorde naar de cloud, met de
                 vertaling van lokaal aangemaakte bonnummers.

   Twee dingen die daarbij vastliggen: het doosjournaal en de refkaart zijn van
   de DOOS zelf en gaan nooit mee in een kloon, en zonder lijn gebeurt er niets
   -- de pinger regelt de modus, dit bestand probeert niets af te dwingen.

   Krijgt dezelfde ctx als ./proxy.js. */
'use strict';

module.exports = (ctx) => {
  const { db, save, st, journaal, teller, journaalGeldig,
    CLOUD, SLEUTEL, GEBRUIKER, WACHTWOORD, actief } = ctx;

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
  return { haalKloon, speelNa };
};
