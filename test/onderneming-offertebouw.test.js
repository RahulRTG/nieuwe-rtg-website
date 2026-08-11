/* Ronde: de offertebouwer -- een prijs die is opgebouwd in plaats van bedacht.

   Vijf beweringen:

   1. EEN REGEL UIT HET EIGEN AANBOD HAALT ZIJN PRIJS DAARVANDAAN. Wie zijn
      tarief verhoogt, hoeft dat niet in elke offerte na te lopen.
   2. EEN DIENST DIE NIET BESTAAT WORDT NOOIT STIL OVERGESLAGEN. Dan denkt de
      ondernemer dat zijn tarief in de offerte staat terwijl er iets anders
      staat -- of niets.
   3. DE SOM IS DEZELFDE ALS DIE VAN DE FACTUUR. Eén functie (kern/regelsom.js),
      want een offerte van 1.000 euro die een factuur van 999,99 oplevert, is
      een cent waar niemand antwoord op heeft.
   4. DE OFFERTESTROOM BLIJFT DE ENIGE SCHRIJVER. De bouwer is puur: hij leest
      de zaak en rekent; het wegschrijven blijft waar het stond.
   5. ALLEEN EEN PRIJS MAG NOG STEEDS. Een klus van een uur is soms gewoon een
      bedrag; dat is geen tijdelijke tolerantie maar een echt geval.

   Draai los: node --experimental-sqlite --test test/onderneming-offertebouw.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');

const OB = require('../server/kern/onderneming/offertebouw');
const REGELSOM = require('../server/kern/regelsom');

const zaak = (over) => Object.assign({
  code: 'GLAS', name: 'Glasheldere Ramen', type: 'zzp',
  services: [
    { id: 'uur', name: 'Uurtarief glazenwassen', price: 60 },
    { id: 'hoog', name: 'Hoogwerker per dag', price: 250 },
    { id: 'gratis', name: 'Kennismaking', price: 0 }
  ]
}, over || {});

/* ---------------- uit het eigen aanbod ---------------- */

test('een regel uit het eigen aanbod haalt zijn prijs uit het aanbod', () => {
  const uit = OB.offerteBouw(zaak(), [{ dienstId: 'uur', aantal: 4 }]);
  assert.equal(uit.ok, true);
  assert.equal(uit.regels[0].stuk, 60, 'niet wat de aanvrager meestuurt, maar wat de zaak vraagt');
  assert.equal(uit.regels[0].aantal, 4);
  assert.equal(uit.totaal, 240);
  assert.equal(uit.regels[0].omschrijving, 'Uurtarief glazenwassen');
  assert.equal(uit.regels[0].bron, 'dienst');
});

test('een meegestuurde prijs kan het eigen tarief niet overschrijven', () => {
  const uit = OB.offerteBouw(zaak(), [{ dienstId: 'uur', aantal: 1, stuk: 5 }]);
  assert.equal(uit.totaal, 60,
    'anders bepaalt de aanvrager van het verzoek wat de zaak voor haar werk vraagt');
});

test('een tariefverhoging werkt door zonder dat er een offerte wordt nagelopen', () => {
  const s = zaak();
  const voor = OB.offerteBouw(s, [{ dienstId: 'uur', aantal: 2 }]).totaal;
  s.services[0].price = 75;
  const na = OB.offerteBouw(s, [{ dienstId: 'uur', aantal: 2 }]).totaal;
  assert.equal(voor, 120);
  assert.equal(na, 150, 'de prijs komt uit het aanbod en staat niet in de regel overgetypt');
});

/* ---------------- weigeren in plaats van stil overslaan ---------------- */

test('een dienst die niet bestaat wordt geweigerd, niet overgeslagen', () => {
  const uit = OB.offerteBouw(zaak(), [{ dienstId: 'uur', aantal: 1 }, { dienstId: 'bestaat-niet' }]);
  assert.equal(uit.status, 404);
  assert.ok(uit.error.includes('staat niet in uw aanbod'));
  assert.equal(uit.ok, undefined, 'en er komt geen half resultaat uit: dat zou een te lage offerte zijn');
});

test('een dienst zonder prijs wordt geweigerd met de reden', () => {
  const uit = OB.offerteBouw(zaak(), [{ dienstId: 'gratis', aantal: 1 }]);
  assert.equal(uit.status, 409);
  assert.ok(uit.error.includes('geen prijs'));
});

test('een losse regel heeft een prijs en een omschrijving nodig', () => {
  assert.equal(OB.offerteBouw(zaak(), [{ omschrijving: 'Materiaal' }]).status, 400);
  assert.equal(OB.offerteBouw(zaak(), [{ stuk: 40 }]).status, 400,
    'een bedrag zonder reden leest de klant als willekeur');
  assert.equal(OB.offerteBouw(zaak(), [{ omschrijving: 'Materiaal', stuk: 40 }]).ok, true);
});

test('een offerte zonder regels is geen offerte', () => {
  assert.equal(OB.offerteBouw(zaak(), []).status, 400);
  assert.equal(OB.offerteBouw(zaak(), null).status, 400);
  const teveel = Array.from({ length: OB.MAX_REGELS + 1 }, () => ({ omschrijving: 'X', stuk: 1 }));
  assert.equal(OB.offerteBouw(zaak(), teveel).status, 400);
});

/* ---------------- de som ---------------- */

test('de btw wordt teruggerekend uit een stukprijs inclusief btw', () => {
  const uit = OB.offerteBouw(zaak(), [{ dienstId: 'hoog', aantal: 1 }]);
  assert.equal(uit.totaal, 250);
  assert.equal(uit.btwStandaard, 21);
  assert.equal(uit.subtotaal, 206.61, '250 / 1,21');
  assert.equal(Math.round((uit.subtotaal + uit.btwBedrag) * 100) / 100, 250,
    'subtotaal plus btw is precies het totaal');
});

test('een horecazaak rekent met het lage tarief', () => {
  const uit = OB.offerteBouw(zaak({ type: 'restaurant' }), [{ omschrijving: 'Buffet', stuk: 109 }]);
  assert.equal(uit.btwStandaard, 9);
  assert.equal(uit.subtotaal, 100);
  assert.equal(uit.btwBedrag, 9);
});

test('twee tarieven in een offerte blijven twee tarieven', () => {
  const uit = OB.offerteBouw(zaak({ type: 'restaurant' }), [
    { omschrijving: 'Buffet', stuk: 109 },
    { omschrijving: 'Zaalhuur', stuk: 121, btw: 21 }
  ]);
  assert.equal(uit.regels[0].btw, 9);
  assert.equal(uit.regels[1].btw, 21);
  assert.equal(uit.subtotaal, 200, '100 plus 100');
  assert.equal(uit.totaal, 230);
});

/* DRIE RANDGEVALLEN DIE HIER ECHT ZIJN MISGEGAAN. Een adversariële keuring van
   deze tak vond ze; de toetsen hierboven liepen er allemaal langs. */
test('een onmogelijk btw-tarief kan de som niet slopen', () => {
  /* -100 liet `regelIncl / (1 + btw/100)` door nul delen. Het subtotaal werd
     Infinity, ging als `null` de opslag in en de btw-aangifte van die zaak
     telde vanaf dat moment een gat mee -- terwijl het TOTAAL gewoon bleef
     kloppen, dus er viel niets op. */
  const stuk = OB.offerteBouw(zaak(), [{ omschrijving: 'Post', stuk: 100, btw: -100 }]);
  assert.equal(stuk.ok, true);
  assert.ok(Number.isFinite(stuk.subtotaal) && Number.isFinite(stuk.btwBedrag),
    'geen Infinity in de opbouw: ' + JSON.stringify(stuk).slice(0, 160));
  assert.equal(stuk.regels[0].btw, 21, 'een onmogelijk tarief valt terug op het standaardtarief');
  assert.equal(Math.round((stuk.subtotaal + stuk.btwBedrag) * 100) / 100, stuk.totaal);

  const hoog = OB.offerteBouw(zaak(), [{ omschrijving: 'Post', stuk: 100, btw: 500 }]);
  assert.equal(hoog.regels[0].btw, 21, 'en een tarief boven de honderd procent ook');
});

test('een leeg btw-veld is niet hetzelfde als nul procent', () => {
  /* Dit is precies wat een leeg formulierveld over JSON stuurt. `Number(null)`
     is 0 en eindig, dus de oude controle liet het door als 0% -- een offerte en
     straks een factuur zonder btw, terwijl het totaal er normaal uitzag. */
  const leeg = OB.offerteBouw(zaak(), [{ omschrijving: 'Post', stuk: 121, btw: null }]);
  const leger = OB.offerteBouw(zaak(), [{ omschrijving: 'Post', stuk: 121, btw: '' }]);
  const zonder = OB.offerteBouw(zaak(), [{ omschrijving: 'Post', stuk: 121 }]);
  for (const [naam, u] of [['null', leeg], ["''", leger], ['ontbrekend', zonder]]) {
    assert.equal(u.regels[0].btw, 21, 'btw ' + naam + ' hoort het standaardtarief te krijgen');
    assert.equal(u.btwBedrag, 21, 'btw ' + naam);
  }
  /* En nul procent MAG nog steeds, als iemand het echt opgeeft. */
  const echt = OB.offerteBouw(zaak(), [{ omschrijving: 'Post', stuk: 121, btw: 0 }]);
  assert.equal(echt.regels[0].btw, 0);
  assert.equal(echt.btwBedrag, 0);
});

test('de bouwer rekent met dezelfde som als de factuurmotor', () => {
  const regels = [{ omschrijving: 'A', aantal: 3, stuk: 33.33, btw: 21 },
    { omschrijving: 'B', aantal: 1, stuk: 19.99, btw: 9 }];
  const viaBouwer = OB.offerteBouw(zaak(), regels);
  const viaSom = REGELSOM.verwerkRegels(regels, 21);
  assert.equal(viaBouwer.totaal, viaSom.totaal);
  assert.equal(viaBouwer.subtotaal, viaSom.subtotaal);
  assert.equal(viaBouwer.btwBedrag, viaSom.btwBedrag);

  const motor = require('fs').readFileSync('server/kern/facturatie/motor.js', 'utf8');
  assert.ok(motor.includes("require('../regelsom')"),
    'en de factuurmotor rekent hem ook daar: een offerte die anders afrondt dan de factuur is onuitlegbaar');
});

/* Deze toets vergeleek twee KOPIEEN van het lage-btw-lijstje (hier en in
   kern/facturatie.js) -- en op de dag dat de belastingronde dat lijstje in de
   facturatie door de fiscale laag verving, zakte hij precies zoals beloofd.
   De reparatie is niet de lijstjes weer gelijktrekken maar de kopie opheffen:
   beide lezen nu kern/fiscaal/tarief.js. Dus bewaakt de toets voortaan DAT,
   in gedrag en in bron. */
test('het btw-tarief komt uit dezelfde fiscale laag als dat van de facturatie', () => {
  const TARIEF = require('../server/kern/fiscaal/tarief');
  // gedrag: een restaurant-zaak krijgt voor eten hetzelfde tarief als de fiscale laag zegt
  const resto = zaak({ type: 'restaurant', menu: [{ name: 'Soep' }] });
  assert.equal(OB.btwVanZaak(resto, []), TARIEF.tariefVan(resto, 'eten'),
    'de bouwer en de fiscale laag horen hetzelfde tarief te geven');
  assert.equal(OB.btwVanZaak(zaak(), []), TARIEF.tariefVan(zaak(), 'standaard'),
    'en een zzp-zaak het standaardtarief van haar land');
  // bron: geen eigen kopie meer, in geen van beide bestanden
  const fs = require('fs');
  for (const p of ['server/kern/onderneming/offertebouw.js', 'server/kern/facturatie/motor.js']) {
    const bron = fs.readFileSync(p, 'utf8');
    assert.ok(bron.includes("require('../fiscaal/tarief')") || bron.includes("require('../../fiscaal/tarief')") || bron.includes("../fiscaal/tarief"),
      p + ' hoort de fiscale laag te lezen');
    assert.ok(!/LAAG_BTW_TYPES\s*=\s*\[/.test(bron),
      p + ' hoort geen eigen kopie van het lijstje meer te dragen');
  }
});

/* ---------------- de offertestroom blijft de schrijver ---------------- */

test('de bouwer schrijft niets: hij leest de zaak en rekent', () => {
  const s = zaak();
  const voor = JSON.stringify(s);
  OB.offerteBouw(s, [{ dienstId: 'uur', aantal: 2 }, { omschrijving: 'Materiaal', stuk: 30 }]);
  assert.equal(JSON.stringify(s), voor, 'de zaak is onaangeroerd');

  const bron = require('fs').readFileSync('server/kern/onderneming/offertebouw.js', 'utf8');
  assert.ok(!/\bsave\s*\(/.test(bron), 'en er wordt nergens bewaard');
  assert.ok(!/vakOffertes/.test(bron), 'de offertestroom blijft de enige die offertes bijwerkt');
});

test('de offertestroom bouwt de prijs op en laat de opbouw meereizen', () => {
  const bron = require('fs').readFileSync('server/kern/vakwerk/pro.js', 'utf8');
  assert.ok(bron.includes('OFFERTEBOUW.offerteBouw'), 'antwoorden loopt langs de bouwer');
  assert.ok(bron.includes('regels: o.regels'), 'en de klant ziet de regels, niet alleen het bedrag');
  assert.ok(bron.includes("if (!opbouw.ok) return opbouw;"),
    'een fout uit de bouwer stopt het antwoord in plaats van een half bedrag neer te zetten');
});

test('alleen een prijs opgeven mag nog steeds', () => {
  const bron = require('fs').readFileSync('server/kern/vakwerk/pro.js', 'utf8');
  assert.ok(bron.includes('bouw hem op uit regels'),
    'en de melding noemt allebei de wegen');
  assert.ok(/o\.regels = opbouw \? opbouw\.regels : null;/.test(bron),
    'zonder regels blijft het veld leeg in plaats van een verzonnen enkele regel te dragen');
});
