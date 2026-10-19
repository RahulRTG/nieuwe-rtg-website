/* Eenmalige WebAuthn-ceremonies zijn expres vluchtig, maar ook vluchtig
   geheugen moet begrensd zijn. De oude Map ruimde pas boven 5000 op en
   verwijderde dan alleen verlopen regels. Vijfduizend verse aanvragen bleven
   dus onbeperkt doorgroeien en iedere volgende aanvraag liep de hele Map
   langs: een goedkope geheugen- en CPU-aanval.

   Deze kleine opslag houdt afloopvolgorde, ruimt O(1) aan de voorkant en werpt
   bij drukte de oudste ongebruikte ceremonie af. Hij staat los van de
   accountlogica, zodat de beveiligingsrand zelfstandig leesbaar en toetsbaar
   blijft. */

const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const CHALLENGE_MAX = 5000;

/* GEDEELD (X4, 19 oktober 2026). Stond hij alleen in een Map, dan vond een
   tweede instance (of hetzelfde proces na een herstart) de uitdaging niet, en
   gaf de login 400 "verlopen". Met `kast` (een kaart in een eigen collectie,
   zoals de toesteluitdaging in kern/identiteit/toestellen.js) en `save` staat
   hij in de gedeelde opslag; de regels erboven blijven: TTL, plafond, eenmalig.
   Zonder kast blijft het de Map van een proces (de toetsen van deze module). */
function maakCeremonieOpslag({ max = CHALLENGE_MAX, ttlMs = CHALLENGE_TTL_MS, nu = () => Date.now(), kast, save } = {}) {
  if (typeof kast === 'function') return gedeeld({ max, ttlMs, nu, kast, save: save || (() => {}) });
  const waarden = new Map();
  const grens = Math.min(CHALLENGE_MAX, Math.max(1, Math.floor(Number(max) || CHALLENGE_MAX)));
  const eersteWeg = () => {
    const eerste = waarden.keys().next();
    if (!eerste.done) waarden.delete(eerste.value);
  };
  function ruimVerlopen(tijd) {
    for (const [sleutel, waarde] of waarden) {
      if (waarde.tot > tijd) break;
      waarden.delete(sleutel);
    }
  }
  function zet(sleutel, challenge, extra) {
    const tijd = nu();
    ruimVerlopen(tijd);
    // opnieuw uitgeven voor dezelfde sleutel hoort achteraan in de aflooprij
    waarden.delete(sleutel);
    while (waarden.size >= grens) eersteWeg();
    waarden.set(sleutel, { ...(extra || {}), challenge, tot: tijd + ttlMs });
  }
  function pak(sleutel) {
    const tijd = nu();
    ruimVerlopen(tijd);
    const waarde = waarden.get(sleutel);
    waarden.delete(sleutel);             // ook een foute/late poging is eenmalig
    return waarde && waarde.tot > tijd ? waarde : null;
  }
  return { zet, pak, aantal: () => waarden.size };
}

function gedeeld({ max, ttlMs, nu, kast, save }) {
  const grens = Math.min(CHALLENGE_MAX, Math.max(1, Math.floor(Number(max) || CHALLENGE_MAX)));
  function ruim(k, tijd) {
    const rijen = Object.entries(k).filter(([, w]) => w && w.tot > tijd).sort((x, y) => x[1].tot - y[1].tot);
    for (const s of Object.keys(k)) if (!rijen.some(([r]) => r === s)) delete k[s];
    while (rijen.length >= grens) delete k[rijen.shift()[0]];
  }
  function zet(sleutel, challenge, extra) {
    const k = kast(), tijd = nu();
    delete k[sleutel];
    ruim(k, tijd);
    k[sleutel] = { ...(extra || {}), challenge, tot: tijd + ttlMs };
    save();
  }
  function pak(sleutel) {
    const k = kast(), tijd = nu();
    const waarde = k[sleutel];
    if (waarde) { delete k[sleutel]; save(); }  // ook een foute/late poging is eenmalig
    return waarde && waarde.tot > tijd ? waarde : null;
  }
  return { zet, pak, aantal: () => Object.keys(kast()).length };
}

module.exports = { maakCeremonieOpslag };
