/* Het verbond: de PURE regels (geen opslag, geen meldingen, geen sessie).

   Hier staat wat een verbond IS -- welke stand het heeft, wie aan welke kant
   staat, wat iemand ervan mag zien -- los van wat er gebeurt. Zo is elke regel
   met een gewoon object te toetsen, en kan de weergave nergens anders
   vandaan komen dan uit deze ene functie.

   DE STAND WORDT BEREKEND EN NIET BEWAARD. Hij volgt uit drie dingen die wel
   bewaard worden: de tekens, de opzegging en de einddatum. Een opgeslagen
   `stand` naast die drie zou een tweede waarheid zijn (LAT.md regel 4) -- en
   `verlopen` KAN niet eens bewaard worden, want die wordt waar zonder dat er
   iemand iets doet. */
'use strict';

const KANTEN = ['a', 'b'];
const STANDEN = ['concept', 'getekend-a', 'getekend-b', 'actief', 'opgezegd', 'verlopen'];
const WIE = ['a', 'b', 'samen'];

const vandaag = (nu) => new Date(nu).toISOString().slice(0, 10);

/* Opgezegd gaat voor verlopen: wie opzei, heeft iets gedaan; verlopen is wat
   de kalender doet. Bij een geschil moet je kunnen zien welke van de twee het
   was (TRAVELCOMMERCE.md: afzeggen is een andere stand dan intrekken). */
function standVan(v, nu) {
  if (v.opzegging) return 'opgezegd';
  if (v.tot && vandaag(nu) > v.tot) return 'verlopen';
  const a = !!(v.tekens && v.tekens.a), b = !!(v.tekens && v.tekens.b);
  if (a && b) return 'actief';
  if (a) return 'getekend-a';
  if (b) return 'getekend-b';
  return 'concept';
}

/* Is er iets wat nog niet is afgesproken? Een verbond wordt pas getekend als
   bij alle vijf vragen staat wie het doet. */
function openAfspraak(v, velden) {
  for (const k of velden) if (!v.afspraken || !WIE.includes(v.afspraken[k])) return k;
  return null;
}

/* Aan welke kant(en) staat deze sleutel, als lid en als beheerder. Leest de
   groep alleen via de functies van het genootschap; het verbond kent de
   ledenlijst niet zelf. */
function kantenVan(v, key, genootschap) {
  const lid = [], beheer = [];
  KANTEN.forEach((k, i) => {
    const kant = v.kanten[i];
    const gr = kant ? genootschap.groepMet(kant.ref) : null;
    if (!gr) return;
    if (genootschap.isLid(gr, key)) lid.push(k);
    if (genootschap.isBeheer(gr, key)) beheer.push(k);
  });
  return { lid, beheer };
}

/* Mag de naam van kant k gezien worden door iemand die er NIET in zit?
   Een geheim genootschap bestaat niet voor wie er niet in zit. Pas als het zelf
   tekent (of ooit getekend heeft), heeft het ingestemd met zichtbaarheid
   tegenover de andere kant. */
function naamNaarBuiten(v, k, gr) {
  if (!gr) return null;
  if (gr.soort !== 'geheim') return gr.naam;
  if ((v.tekens && v.tekens[k]) || v.actiefSinds) return gr.naam;
  return null;
}

/* Wat een lid van het verbond ziet. Van de ANDERE kant: alleen de groepsnaam.
   Geen codenaam, geen ledenlijst, geen sleutel, geen aantal -- ook niet van wie
   er tekende (dat is een sleutel en blijft binnen). */
function weergave(v, key, { genootschap, nu, verifieer }) {
  const { lid, beheer } = kantenVan(v, key, genootschap);
  const kanten = {};
  KANTEN.forEach((k, i) => {
    const gr = genootschap.groepMet(v.kanten[i].ref);
    const eigen = lid.includes(k);
    if (!gr) { kanten[k] = { naam: null, eigen, opgeheven: true }; return; }
    const naam = eigen ? gr.naam : naamNaarBuiten(v, k, gr);
    kanten[k] = eigen ? { naam, eigen, groep: gr.id } : { naam, eigen };
    if (naam === null) kanten[k].verborgen = 'Dit genootschap is geheim; zijn naam verschijnt pas als het zelf tekent.';
  });
  const teken = (k) => v.tekens[k] ? { at: v.tekens[k].at, doorMij: v.tekens[k].door === key } : null;
  const keten = verifieer(v.tijdlijn);
  return {
    id: v.id, doel: v.doel, afspraken: Object.assign({}, v.afspraken), van: v.van || null, tot: v.tot || null,
    stand: standVan(v, nu), at: v.at, actiefSinds: v.actiefSinds || null,
    mijnKant: lid[0] || null, ikBeheer: beheer.length > 0,
    kanten,
    tekens: { a: teken('a'), b: teken('b') },
    opzegging: v.opzegging ? { kant: v.opzegging.kant, at: v.opzegging.at, reden: v.opzegging.reden,
      doorMij: v.opzegging.door === key } : null,
    tijdlijn: v.tijdlijn.map(r => ({ nr: r.nr, at: r.at, wat: r.wat, kant: r.kant || null,
      velden: r.velden || undefined })),
    keten: { ok: keten.ok, regels: keten.geteld }
  };
}

module.exports = { KANTEN, STANDEN, WIE, standVan, openAfspraak, kantenVan, naamNaarBuiten, weergave, vandaag };
