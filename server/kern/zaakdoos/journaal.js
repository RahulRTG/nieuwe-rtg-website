/* Zaakdoos, deelbestand "journaal": WAT er in het naspeeljournaal mag.

   Het journaal wordt na herstel nagespeeld naar de cloud met de inlog van de
   doos. Dat maakt het de gevoeligste plek: een gemanipuleerd journaal op
   schijf zou anders vervalste acties met de doos-rechten kunnen doorzetten, en
   alles wat erin staat ligt onversleuteld op het kastje tot de lijn terugkomt.
   Vier sloten:
     1. Padbeleid: alleen zaak-schrijfacties (/api/supplier/...), nooit een
        inlogroute, nooit de stream, nooit een pad met .. of een query.
     2. Integriteit: over de canonieke inhoud (seq, pad, body, res, tijd) staat
        een HMAC-zegel met een serversleutel die alleen op de doos leeft
        (dooszegel.key, 0600, in .gitignore). Volgnummers (seq) maken herordenen
        of knippen zichtbaar.
     3. Verse controle bij het naspelen: elke regel wordt timingvast geverifieerd;
        een ongeldige of gemanipuleerde regel wordt overgeslagen, nooit gespeeld.
     4. Geen geheim in een regel: van het antwoord blijft alleen wat het
        naspelen leest, en een lijf met een wachtwoord gaat er niet in.

   WAAROM SLOT 1 DE ROUTER VOLGT (N27 van de V1-audit). Hier stond een
   letterlijke vergelijking met '/api/supplier/login', en in de journaalpoort
   van opzet/lijfpoort.js een tweede, even letterlijke. De router laat een pad
   met een slash erachter bij dezelfde handler komen, en /api/supplier/mijn/login
   stond in geen van beide. In lokale modus kwamen e-mail plus wachtwoord (of
   bewijs plus code) en het werktoken uit het antwoord daardoor in het journaal.
   Welke paden een inlog zijn, staat nu op EEN plek: INLOG_PADEN, gelezen met
   vastePaden() via isInlogPad uit ../../middleware/remmen.js. Dezelfde lijst
   en dezelfde lezing als de inlogpauze, dus geen tweede opvatting ernaast. */
'use strict';
const crypto = require('crypto');
const { isInlogPad } = require('../../middleware/remmen');

function journaalPadOk(pad) {
  if (typeof pad !== 'string' || !pad.startsWith('/api/supplier/')) return false;
  if (isInlogPad(pad) || pad.startsWith('/api/supplier/stream')) return false;
  if (pad.includes('..') || /[\s?#]/.test(pad)) return false;
  return true;
}

/* SLOT 4A: HET ANTWOORD IS EEN POSITIEVE LIJST (de vorm van AI-CONTEXT-01, en
   die van ./kloon.js). Het naspelen leest uit het lokale antwoord alleen deze
   sleutels, om lokaal gemaakte nummers naar hun cloudversie te vertalen
   (leerRefs in ./synchronisatie.js, dat deze lijst hier ophaalt). Al het andere
   bewaren is bewaren wat niemand leest, en daar zat het geheim: een werktoken
   na een wissel, een nieuwe pincode, een kassacode, de code van een cadeaukaart.
   Nooit "alles behalve het gevoelige": een veld dat er morgen bij komt, blijft
   buiten het journaal. De vorm blijft staan, zodat leerRefs hetzelfde pad loopt. */
const REF_SLEUTELS = Object.freeze(['ref', 'id', 'pickup', 'orderRef']);
function alleenRefs(x) {
  if (!x || typeof x !== 'object') return null;
  const uit = Array.isArray(x) ? [] : {};
  let iets = false;
  for (const k of Object.keys(x)) {
    const v = x[k];
    if (REF_SLEUTELS.includes(k) && typeof v === 'string') { uit[k] = v; iets = true; continue; }
    const onder = alleenRefs(v);
    if (onder) { uit[k] = onder; iets = true; }
  }
  if (Array.isArray(uit)) for (let i = 0; i < uit.length; i++) if (!(i in uit)) uit[i] = null;
  return iets ? uit : null;
}

/* SLOT 4B: EEN LIJF MET EEN WACHTWOORD GAAT ER NIET IN. Het lijf wordt letterlijk
   nagespeeld, dus schoonmaken kan niet zonder de handeling te veranderen; weigeren
   is de vorm die het journaal al kent (een te groot lijf). Dit vangt de deur die
   geen inlog is en toch een RTG-wachtwoord draagt (/api/supplier/staff/join), en
   elke volgende. Alleen deze twee namen: `code`, `bewijs` en `token` zijn in de
   zaakkant gewone velden (de bedrijfscode bij een wissel, het bewijs bij een
   belofte); die staan op een inlogroute, en daar houdt slot 1 ze tegen. */
const WACHTWOORD = Object.freeze(['password', 'wachtwoord']);
function draagtWachtwoord(lijf) {
  const stapel = [lijf];
  while (stapel.length) {
    const v = stapel.pop();
    if (!v || typeof v !== 'object') continue;
    for (const k of Object.keys(v)) {
      if (WACHTWOORD.includes(k.toLowerCase())) return true;
      stapel.push(v[k]);
    }
  }
  return false;
}

/* Het zegel hangt aan de sleutel van deze doos; de aanroeper levert hem. */
function metZegel(zegelKey) {
  function journaalZegel(e) {
    const payload = JSON.stringify({ seq: e.seq, pad: e.pad, body: e.body || {}, res: e.res || null, at: e.at });
    return crypto.createHmac('sha256', zegelKey).update(payload).digest('base64url');
  }
  /* Ook een regel van VOOR deze sloten (al op schijf, met een geldig zegel)
     wordt zo bij het naspelen overgeslagen in plaats van naar de cloud gestuurd. */
  function journaalGeldig(e) {
    if (!e || !journaalPadOk(e.pad) || typeof e.seq !== 'number' || typeof e.zegel !== 'string') return false;
    if (draagtWachtwoord(e.body)) return false;
    const eigen = journaalZegel(e);
    const a = Buffer.from(String(e.zegel)); const b = Buffer.from(eigen);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }
  return { journaalZegel, journaalGeldig };
}

module.exports = { journaalPadOk, alleenRefs, draagtWachtwoord, metZegel, REF_SLEUTELS };
