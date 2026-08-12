/* Magnaat: HET BESTUUR -- meerdere mensen in EEN concern.

   Fase D, het eerste stuk (GAMEHALL.md 12.9). Loondienst (./dienst.js) zette
   een mens in EEN ZAAK; dit zet er een in het HELE CONCERN. Een bedrijfsleider
   runt jouw restaurant, een algemeen directeur runt jouw bedrijf.

   HIJ IS GEEN TWEEDE DIENSTVERBANDSYSTEEM, en dat is het belangrijkste besluit.
   Een bestuurder is een gewoon dienstverband met `vestiging: null` -- dezelfde
   vacature, dezelfde sollicitatie, dezelfde opzegging, hetzelfde salaris, en
   dezelfde loopbaan achteraf. Een parallelle regeling zou betekenen dat
   "opzeggen kan altijd" op twee plekken staat, dat een uitstappende werkgever
   twee lijsten moet opruimen, en dat de 18+-grens twee keer bewaakt wordt. Wat
   hier bij komt is EEN vraag: wat mag deze rol.

   ============================ DE WAND ============================

   EEN BESTUURDER BESTUURT, HIJ BESCHIKT NIET. Dat is de hele grens en hij is
   niet cosmetisch. Alles wat het BEZIT raakt blijft bij de eigenaar:

     sluiten, uitstappen, veiling-start, belang-voorstel, beurs-aanbieden,
     overname-antwoord, en het aannemen van andere bestuurders.

   Zonder die wand is "geef mij je CEO-stoel" hetzelfde als "geef mij je
   bedrijf", en dan is bestuur een overdracht met een omweg -- precies wat
   ./uitstap.js met een prijsband dichttimmerde. Een directeur kan je concern
   slecht besturen; hij kan het je niet afnemen. Dat verschil is te lezen in de
   lijsten hieronder en test/spelbestuur.test.js telt het na.

   ================== WAT HET KOST, EN WAAROM DAT BEDRAG ==================

   Op DEZELFDE schaal als de AI-manager (./beheer.js: 2,5% van de omzet van de
   vorige maand, met een bodem per zaak). Dat is geen willekeur maar de keuze
   die deze laag WIL laten maken, en die dienst.js al opschreef: dezelfde klus,
   dezelfde prijs, een andere bestemming. Het tarief van de AI verlaat de
   wereld; het salaris van een mens gaat naar een speler aan tafel.

   Dus schaalt het loon met de omzet van het CONCERN, en niet met een sectorloon
   -- een directeur van twaalf zaken heeft een grotere baan dan een directeur
   van een, en dat hoort in het bedrag te staan. De loonband van ./dienst.js
   geldt gewoon: onderhandelen is een keuze en geen cadeau. */
'use strict';
const D = require('./dienst');
const B = require('./beheer');

/* WAT EEN ROL MAG IS EEN LIJST ACTIENAMEN, en dat is met opzet dezelfde vorm
   als de veldnamen bij ./dienst.js: een getal dat "meer mag" betekent is niet te
   lezen op een scherm en niet te toetsen, een lijst wel. */
const DRAAIEN = ['beleid', 'open', 'uitbreiden'];
const GELD = ['krediet-opnemen', 'krediet-aflossen', 'krediet-herzien',
  'polis-sluiten', 'polis-opzeggen', 'onderzoek-budget', 'onderzoek-starten',
  'onderzoek-uitrollen', 'onderzoek-subsidie'];

/* WAT NOOIT MAG, van geen enkele rol. Hij staat als LIJST en niet als "wat er
   niet in `mag` staat", want dan is de wand een gevolg van een weglating en
   niet van een besluit -- en een weglating repareert niemand. */
const NOOIT = ['sluiten', 'uitstappen', 'veiling-start', 'belang-voorstel',
  'beurs-aanbieden', 'overname-antwoord', 'functie-openen', 'aannemen',
  'functie-intrekken', 'dienst-opzeggen', 'bestuur-zet'];

const MAG = {
  coo: DRAAIEN.slice(),
  cfo: GELD.slice(),
  ceo: DRAAIEN.concat(GELD, ['contract-voorstel', 'contract-antwoord', 'contract-opzeggen'])
};
/* DE ROLLEN ZELF STAAN IN ./dienst.js, in DEZELFDE tabel als de zaakrollen --
   een bestuurder is geen tweede soort dienstverband. Hier komt alleen `mag`
   erbij: dat zijn actienamen, en die horen bij de wand hieronder en niet bij een
   naam en een uitleg. */
const BESTUURSROLLEN = {};
for (const [sleutel, mag] of Object.entries(MAG)) {
  const r = D.ROLLEN[sleutel];
  if (!r || !r.concern)
    throw new Error('magnaat/bestuur: ' + sleutel + ' staat niet als bestuursrol in ./dienst.js.');
  /* DE WAND IS EEN CONTROLE EN NIET EEN WEGLATING, en dat is het verschil
     tussen een besluit en een toevalligheid. Zou hij alleen bestaan doordat
     `sluiten` nergens in een `mag` staat, dan is hij weg zodra iemand hem er
     ooit bij zet -- en dat merkt niemand, want het werkt dan gewoon. Nu start
     de server niet op. */
  const fout = mag.find(a => NOOIT.includes(a));
  if (fout) throw new Error('magnaat/bestuur: ' + sleutel + ' mag ' + fout
    + ', en dat raakt het bezit. Een bestuurder bestuurt, hij beschikt niet.');
  BESTUURSROLLEN[sleutel] = Object.assign({}, r, { mag });
}
/* HIJ SCHRIJFT NIETS TERUG in ./dienst.js, en dat is met opzet. Daar zou
   `magRol('ceo', 'prijs')` dan `true` gaan zeggen terwijl een bestuurder nooit
   langs `werk-beleid` komt -- twee antwoorden op "wat mag deze rol", precies
   wat deze map overal vermijdt. De twee wegen zijn disjunct: een zaakrol gaat
   over VELDEN via `werk-beleid`, een bestuursrol over ACTIES via `bestuur-zet`,
   en allebei weigeren de ander luid. */

const isBestuur = (rol) => !!(D.ROLLEN[rol] || {}).concern;

/* WAT EEN CONCERN OMZET, als grondslag voor het loon. Uit het maandoverzicht
   van de vorige maand -- precies waar ./beheer.js zijn tarief ook uit haalt, en
   om dezelfde reden: een tarief over de omzet van NU zou van de volgorde binnen
   een maand afhangen. */
function concernomzet(st, werkgever) {
  const rij = (st.vestigingen || {})[werkgever] || [];
  const laatste = ((st.laatste || {})[werkgever] || {}).regels || [];
  let omzet = 0;
  for (const v of rij) {
    const r = laatste.find(x => x.id === v.id);
    omzet += r ? (r.omzet || 0) : 0;
  }
  /* EEN VERS CONCERN HEEFT NOG GEEN VORIGE MAAND, en dan zou het loon nul zijn
     en de band leeg. De bodem van de manager doet hier hetzelfde werk: ook een
     stille zaak kost aandacht. */
  return Math.max(omzet, rij.length * B.MINTARIEF / B.TARIEF);
}

/* DE BAND WAARBINNEN ONDERHANDELD WORDT. Zelfde vorm als `D.loonband`, zodat de
   acties in ./dienst-acties.js er geen tweede vraag over hoeven te stellen. */
function bestuursband(st, werkgever, rol) {
  const r = BESTUURSROLLEN[rol];
  if (!r) return null;
  const basis = Math.round(concernomzet(st, werkgever) * B.TARIEF * r.deel);
  return { basis, min: Math.round(basis * 0.5), max: Math.round(basis * 2.5) };
}

/* MAG DEZE SPELER DEZE ACTIE VOOR DEZE WERKGEVER DOEN? Een vraag, een antwoord,
   een plek. De wand gaat VOOR de rol: staat een actie in NOOIT, dan geeft geen
   enkele rol hem, ook niet als iemand hem er ooit bij zet. */
function magBesturen(st, h, actie) {
  if (NOOIT.includes(actie)) return null;
  const d = D.dienstVan(st, h);
  if (!d || d.vestiging || !isBestuur(d.rol)) return null;
  return BESTUURSROLLEN[d.rol].mag.includes(actie) ? d : null;
}

module.exports = { BESTUURSROLLEN, BESTUURSLIJST: Object.keys(BESTUURSROLLEN),
  NOOIT, isBestuur, concernomzet, bestuursband, magBesturen };
