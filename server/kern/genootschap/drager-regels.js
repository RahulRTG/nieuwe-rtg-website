/* Genootschap (deelmodule): de REGELS van de drager, puur en zonder opslag.

   Apart van ./drager.js om twee redenen: kern/genootschap/index.js heeft de
   toelatingshaak nodig zonder de hele dragermodule te laden, en de regels zijn
   zo zonder database te toetsen (test/genootschap-drager.test.js). Zie de kop
   van ./drager.js voor het waarom. */
'use strict';

const SOORTEN = Object.freeze(['rtfpartner']);
const NOG_NIET = Object.freeze({
  werkruimte: 'Een werkruimte als drager is nog niet gebouwd; alleen een RTF-partnerstichting kan nu een genootschap dragen.',
  zaak: 'Een zaak als drager is nog niet gebouwd; alleen een RTF-partnerstichting kan nu een genootschap dragen.',
  rtfclub: 'Een RTF-club als drager is nog niet gebouwd; alleen een RTF-partnerstichting kan nu een genootschap dragen.'
});
const STANDEN = Object.freeze(['gevraagd', 'erkend', 'ingetrokken']);

/* GEVOELIGE CATEGORIEEN (art. 9 AVG). `geloof` en `zorg` zijn de twee uit
   besluit 6. De woordenlijst is een tweede vangnet op naam en omschrijving en
   heeft de graad `vermoed`: hij weigert liever een keer te veel dan dat een
   moskeegroep stil een drager krijgt (ook "Zorgeloos zeilen" wordt dus
   geweigerd). Een weigering kost hier niets -- het
   genootschap blijft gewoon bestaan, alleen zonder drager. */
const GEVOELIG = Object.freeze(['geloof', 'zorg']);
const GEVOELIGE_WOORDEN = Object.freeze(['geloof', 'religie', 'religieus', 'kerk', 'moskee', 'synagoge',
  'tempel', 'gebed', 'bidden', 'bijbel', 'koran', 'parochie', 'gemeente van christus', 'islam', 'joods',
  'christelijk', 'hindoe', 'boeddhist', 'zorg', 'mantelzorg', 'patient', 'patiënt', 'ziekte',
  'verslaving', 'rouw', 'dementie', 'kanker', 'ggz', 'therapie', 'lotgenoten']);

const REDEN_GEVOELIG = 'Een genootschap over geloof of zorg krijgt nog geen organisatie als drager. ' +
  'Dat wacht op het besluit over de juridische en privacyvragen (besluit 6 van de eigenaar, ' +
  'GEMEENSCHAP-FASE0.md par. 9). Het genootschap zelf blijft gewoon bestaan, zonder drager.';
const REDEN_BESCHERMD = 'In een genootschap met een organisatie als drager komt alleen een lid van wie RTG ' +
  'heeft gezien dat hij 18 jaar of ouder is. Minderjarigen en gezinsprofielen worden er niet door een ander ' +
  'in gezet: dat wacht op de bescherming van kinderen in gemeenschappen (GEMEENSCHAP-FASE0.md par. 5.3).';

const gedragen = (gr) => !!(gr && gr.draagOrg && gr.draagOrg.stand !== 'ingetrokken');

function gevoeligeReden(gr, onderwerp) {
  if (onderwerp !== undefined && onderwerp !== null && onderwerp !== '') {
    if (GEVOELIG.includes(String(onderwerp).toLowerCase())) return REDEN_GEVOELIG;
  }
  const tekst = ' ' + [gr.naam, gr.over, gr.regels].map(x => String(x || '')).join(' ').toLowerCase() + ' ';
  // op het BEGIN van een woord, omdat het Nederlands samenstelt (gebedskring, mantelzorgcafe)
  return GEVOELIGE_WOORDEN.some(w => new RegExp('(^|[^a-zà-ÿ])' + w).test(tekst)) ? REDEN_GEVOELIG : null;
}

/* Mag deze sleutel in een GEDRAGEN genootschap? Een gezinsprofiel (rtf:) nooit;
   een lid alleen als volwassen() ja zegt. Zonder poort is het antwoord nee --
   een ontbrekende controle mag geen open deur worden. */
function beschermdeReden(key, volwassen) {
  const k = String(key || '');
  if (!k || k.startsWith('rtf:')) return REDEN_BESCHERMD;
  if (typeof volwassen !== 'function') return REDEN_BESCHERMD;
  try { return volwassen(k) === true ? null : REDEN_BESCHERMD; } catch (e) { return REDEN_BESCHERMD; }
}

/* NEUTRAAL NAAR EEN ANDER. De echte reden zegt iets over de persoon (te jong,
   of RTG heeft zijn identiteitsbewijs niet gezien), en dat gaat de beheerder
   die hem uitnodigt niet aan: hij hoort alleen DAT het niet kan. De persoon zelf
   krijgt de echte reden als hij binnen wil lopen. Hetzelfde geldt voor de vraag
   om een drager: de beheerder hoort dat het met deze leden niet kan, niet wie. */
const REDEN_TOEVOEGEN_NEUTRAAL = 'Deze persoon kan niet worden toegevoegd aan dit genootschap.';
const REDEN_LEDEN_NEUTRAAL = 'Dit genootschap kan met de huidige leden (nog) geen organisatie als drager krijgen.';

/* De toelatingshaak voor kern/genootschap/index.js (nodigUit en tredBinnen):
   alleen in een gedragen genootschap telt hij. `ander` = iemand anders zet deze
   persoon erin, en dan is het antwoord neutraal. */
const maakToelating = (volwassen) => (gr, key, ander) => {
  if (!gedragen(gr)) return null;
  const r = beschermdeReden(key, volwassen);
  return r && ander ? REDEN_TOEVOEGEN_NEUTRAAL : r;
};

function beeld(gr) {
  const d = gr && gr.draagOrg;
  if (!d) return null;
  return { soort: d.soort, stand: d.stand, at: d.at, erkendAt: d.erkendAt || null };
}

module.exports = { SOORTEN, NOG_NIET, STANDEN, GEVOELIG, GEVOELIGE_WOORDEN, REDEN_GEVOELIG, REDEN_BESCHERMD,
  REDEN_TOEVOEGEN_NEUTRAAL, REDEN_LEDEN_NEUTRAAL,
  gedragen, gevoeligeReden, beschermdeReden, maakToelating, beeld };
