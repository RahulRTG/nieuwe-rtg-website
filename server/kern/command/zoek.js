/* CROSS-DOMAIN SEARCH -- één zoekbalk over het hele platform.

   Zoek op naam, code, kenteken, plaats, status, ordernummer of foutcode en
   krijg terug wat er in ELK domein op past, met de verwante systemen erbij.

   DRIE DINGEN DIE HIER MET OPZET ZO ZIJN.

   1. Hij leest het register (./register.js) en niet een eigen lijst. Een
      collectie erbij is een regel in het register en niet een tak hier.

   2. Hij zoekt alleen in velden die een mens ook echt intypt. Vrije tekst
      (berichten, notities, omschrijvingen) staat er bewust niet in: dan wordt
      elke korte zoekterm een treffer en is de uitslag ruis. Wie in tekst wil
      zoeken doet dat in de app van dat domein.

   3. Hij is BEGRENSD PER SOORT en zegt erbij dat hij begrensd is. Een zoekbalk
      die 40.000 treffers stil afkapt tot 20 laat je geloven dat je alles zag.
      Daarom draagt elke groep zijn echte aantal (`totaal`) naast de getoonde
      rijen -- dezelfde eerlijkheid die de backoffice met `totals` al doet. */
'use strict';

const { SOORTEN, rijen, kort, s } = require('./register');

const PER_SOORT = 12;      // wat je van één soort ziet
const MAX_SCAN = 20000;    // hoe ver we per collectie kijken; daarboven meldt hij het

/* Een treffer weegt: een exacte sleutel bovenaan, dan een begin-met, dan een
   bevat. Zonder weging staat "Amsterdam" onder "Amsterdamsestraatweg 14" en
   voelt de balk dom aan bij precies de zoekopdracht die het vaakst wordt
   getypt: een code die iemand uit een ander scherm heeft gekopieerd. */
function weeg(waarde, term) {
  const v = waarde.toLowerCase();
  if (!v) return 0;
  if (v === term) return 100;
  if (v.startsWith(term)) return 60;
  if (v.includes(term)) return 30;
  return 0;
}

function zoekSoort(db, soort, term) {
  const alle = rijen(db, soort);
  const gekeken = Math.min(alle.length, MAX_SCAN);
  const treffers = [];
  for (let i = 0; i < gekeken; i++) {
    const r = alle[i];
    if (!r) continue;
    let score = 0, waarom = '';
    for (const veld of soort.zoek) {
      const w = weeg(s(r[veld]), term);
      if (w > score) { score = w; waarom = veld; }
    }
    if (score) treffers.push({ score, waarom, r });
  }
  treffers.sort((a, b) => b.score - a.score);
  return {
    type: soort.type, label: soort.label, meervoud: soort.meervoud, domein: soort.domein,
    totaal: treffers.length,
    afgekapt: alle.length > gekeken ? alle.length : 0,
    rijen: treffers.slice(0, PER_SOORT).map(t => Object.assign(kort(soort, t.r), { veld: t.waarom }))
  };
}

/* De zoekopdracht zelf. Leeg antwoord is geen fout: een lege balk hoort niets
   te vinden en niet alles te tonen. */
function zoek(db, vraag, opties) {
  const term = String(vraag == null ? '' : vraag).trim().toLowerCase();
  if (term.length < 2) return { term, groepen: [], totaal: 0, kort: true };
  const alleen = opties && opties.type ? String(opties.type) : '';
  const groepen = [];
  let totaal = 0, geraakteDomeinen = new Set();
  for (const soort of SOORTEN) {
    if (alleen && soort.type !== alleen) continue;
    const g = zoekSoort(db, soort, term);
    if (!g.totaal) continue;
    groepen.push(g);
    totaal += g.totaal;
    geraakteDomeinen.add(soort.domein);
  }
  /* De sterkste groep bovenaan: waar de meeste harde treffers zitten, wil je
     als eerste kijken. Bij gelijk aantal wint de kleinste groep, want die is
     specifieker (één zaak zegt meer dan tweehonderd bestellingen). */
  groepen.sort((a, b) => (b.rijen[0] || {}).score === (a.rijen[0] || {}).score
    ? a.totaal - b.totaal : b.totaal - a.totaal);
  return { term, groepen, totaal, domeinen: [...geraakteDomeinen] };
}

/* Waar zou deze term nog meer iets kunnen betekenen? De balk zegt niet alleen
   WAT hij vond maar ook waar hij keek, zodat "niets gevonden" een uitslag is
   en geen stilte. */
function bereik() {
  return SOORTEN.map(k => ({ type: k.type, label: k.label, meervoud: k.meervoud, domein: k.domein, velden: k.zoek }));
}

module.exports = { zoek, bereik, PER_SOORT };
