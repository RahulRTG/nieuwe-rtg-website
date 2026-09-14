/* HOUDT BEVINDING B1 VAN DE OMZETPROEF VAST -- en houdt het register eerlijk.

   `scripts/omzetproef.js` vond dat de btw-categorie uit de WERKPLEK wordt
   afgeleid. De vraag die daaruit volgde is nagezocht (server/kern/fiscaal/
   tariefindeling.js) en het antwoord was niet "werkplek" of "product" maar: de
   vraag die het tarief bepaalt verschilt per land. Deze toets bewaakt drie
   dingen -- dat het register zijn eigen herkomst draagt, dat de meter kan
   uitslaan, en dat de gemeten stand niet stil verschuift.

   Draai los: node --test test/tariefindeling.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { INDELING, BESLIST, meet, meetLand } = require('../scripts/tariefindeling');
const { LANDEN } = require('../server/kern/fiscaal/landen');
const fs = require('fs');
const path = require('path');
const WORTEL = path.join(__dirname, '..');

/* Het vocabulaire uit kern/fiscaal/bronnen/index.js. Hier overgeschreven en NIET
   geimporteerd: die module bouwt een register op met een db eronder, en deze
   toets hoort puur te blijven. Wijkt het af, dan zakt toets 2. */
const GEZAG = ['officieel', 'afgeleid', 'indicatief'];

test('1. elk nagezocht land draagt zijn rechtsgrond, gezag en peildatum', () => {
  for (const [cc, r] of Object.entries(INDELING)) {
    assert.ok(Array.isArray(r.beslist) && r.beslist.length, cc + ' zegt niet waar het tarief op scharniert');
    for (const b of r.beslist) assert.ok(BESLIST[b], cc + ' scharniert op een onbekende eigenschap: ' + b);
    /* Op LENGTE en niet op een reeks niet-spaties: de eerste versie eiste tien
       aaneengesloten leestekens, en "Artikel 279 m van de Code general des impots"
       haalt dat niet. De toets zakte op een rechtsgrond die er gewoon stond. */
    assert.ok(String(r.rechtsgrond || '').trim().length >= 10, cc + ' draagt geen rechtsgrond');
    assert.ok(String(r.gelezenVia || '').trim().length >= 5, cc + ' zegt niet waar het gelezen is');
    assert.match(String(r.gepeild), /^\d{4}-\d{2}-\d{2}$/, cc + ' draagt geen peildatum');
    assert.ok(r.verwacht && typeof r.verwacht.eten === 'number' &&
      typeof r.verwacht.alcoholvrij === 'number' && typeof r.verwacht.alcohol === 'number',
      cc + ' draagt geen volledige verwachting (eten, alcoholvrij, alcohol)');
  }
});

/* MUTATIE GEZIEN ZAKKEN: gezag van NL op 'officieel' gezet; zakte met de reden
   erbij. De graad mag alleen omhoog nadat een MENS de primaire tekst heeft
   gelezen -- vanaf deze machine weigert de proxy de overheidsdomeinen. */
test('2. geen enkel land claimt meer gezag dan er is gelezen', () => {
  for (const [cc, r] of Object.entries(INDELING)) {
    assert.ok(GEZAG.includes(r.gezag), cc + ' draagt een gezagsgraad buiten het vocabulaire: ' + r.gezag);
    assert.equal(r.gezag, 'indicatief',
      cc + ' claimt gezag "' + r.gezag + '". Dat mag pas als iemand de primaire tekst heeft gelezen; ' +
      'noteer dan in de commit WAAR, en werk `gelezenVia` bij.');
  }
});

test('3. onbekend is geen klopt', () => {
  const u = meet(LANDEN);
  assert.equal(u.telling.landen, u.telling.nagezocht + u.telling.onbekend, 'de telling dekt niet elk land');
  assert.equal(u.telling.nagezocht, Object.keys(INDELING).length, 'er zijn landen nagezocht die niet in de telling staan');
  assert.ok(u.telling.onbekend > 100,
    'er staan opeens bijna geen onbekende landen meer; is de wereldtabel nagezocht, of telt hij stil mee?');
  const onb = u.rijen.filter(r => r.stand === 'onbekend');
  assert.ok(onb.every(r => r.reden), 'een onbekend land zonder reden is een leeg vakje');
});

/* DE BESTURINGSPROEF. Een meter die niet kan uitslaan is geen meter -- en deze
   kan op twee manieren stilstaan: hij kan een ontbrekende bak missen, en hij kan
   een verouderd getal missen. Allebei beproefd met een verzonnen tabel. */
test('4. de meter slaat uit op een ontbrekende bak en op een verouderd getal', () => {
  const echt = meetLand('NL', { eten: 9, drank: 21 });
  assert.equal(echt.stand, 'wijktAf');
  assert.equal(echt.punten[0].soort, 'bakOntbreekt', 'NL heeft twee tarieven in een bak; dat hoort bakOntbreekt te heten');

  /* Zelfde land, maar nu doen alsof alcohol en alcoholvrij hetzelfde tarief
     dragen: dan is een bak wel genoeg en hoort de meter stil te vallen. */
  const nep = { ...INDELING.NL, verwacht: { eten: 9, alcoholvrij: 21, alcohol: 21 } };
  const bewaar = INDELING.NL;
  INDELING.NL = nep;
  try {
    assert.equal(meetLand('NL', { eten: 9, drank: 21 }).stand, 'klopt',
      'met een gelijk tarief voor alcohol en alcoholvrij is een bak genoeg; de meter slaat dan ten onrechte uit');
    assert.equal(meetLand('NL', { eten: 99, drank: 21 }).punten[0].soort, 'verouderd',
      'een eten-tarief dat afwijkt van de regel hoort verouderd te heten');
  } finally { INDELING.NL = bewaar; }
});

/* DE STAND VAN 14 SEPTEMBER 2026. Deze toets is er niet om te zeggen dat vier
   landen fout staan -- hij is er zodat een VERANDERING een besluit afdwingt in
   plaats van stil te gebeuren. Verschuift een getal hieronder, dan hoort in de
   commit te staan welk besluit dat was: is de bak gesplitst, is een tarief
   bijgewerkt via een jaargang, of is er iets weggepoetst? */
test('5. de gemeten stand verschuift niet stil', () => {
  const t = meet(LANDEN).telling;
  assert.deepEqual(
    { nagezocht: t.nagezocht, klopt: t.klopt, verouderd: t.verouderd, bakOntbreekt: t.bakOntbreekt },
    { nagezocht: 6, klopt: 2, verouderd: 2, bakOntbreekt: 2 },
    'de stand van de tariefindeling is veranderd. Dat mag -- maar noteer in de commit WELK besluit erachter ' +
    'zit. `bakOntbreekt` omlaag betekent dat de tabel een categorie heeft gekregen; `verouderd` omlaag ' +
    'betekent dat een tarief is bijgewerkt (en dan hoort daar een jaargang met rechtsgrond bij).');
});

/* De twee soorten afwijking mogen nooit worden opgeteld: een verouderd getal
   werkt iemand bij, een ontbrekende bak niet. */
test('6. verouderd en bakOntbreekt blijven gescheiden', () => {
  const u = meet(LANDEN);
  const de = u.rijen.find(r => r.land === 'DE');
  const nl = u.rijen.find(r => r.land === 'NL');
  assert.equal(de.punten.every(p => p.soort === 'verouderd'), true,
    'DE draagt een verouderd eten-tarief (19% terwijl de regel sinds 1-1-2026 7% zegt), geen vormtekort');
  assert.equal(nl.punten.every(p => p.soort === 'bakOntbreekt'), true,
    'NL draagt een vormtekort (een bak voor twee tarieven), geen verouderd getal');
  assert.equal(de.eenBakGenoeg, true, 'in DE beslist drank-of-eten, dus een bak volstaat');
  assert.equal(nl.eenBakGenoeg, false, 'in NL beslist alcohol, dus een bak volstaat niet');
});

/* HET MODEL IS test/gezagsnoemer.test.js toets 7. Zonder deze toets zou het
   register langzaam een tweede waarheid worden naast kern/fiscaal/tarief.js over
   welke categorie welk tarief krijgt -- en dan staat er over EEN verkoop twee
   keer een antwoord, wat tarief.js zelf net heeft opgeruimd (LAT.md regel 4).

   MUTATIE GEZIEN ZAKKEN: een require naar scripts/tariefindeling in
   server/kern/fiscaal/tarief.js gezet; zakte met het bestand erbij. */
test('7. HET REGISTER BESLIST NIETS: niets in server/ importeert het', () => {
  const raak = [];
  (function loop(map) {
    for (const naam of fs.readdirSync(map, { withFileTypes: true })) {
      const vol = path.join(map, naam.name);
      if (naam.isDirectory()) { if (naam.name !== 'data' && naam.name !== 'node_modules') loop(vol); continue; }
      if (!naam.name.endsWith('.js')) continue;
      if (/require\([^)]*tariefindeling/.test(fs.readFileSync(vol, 'utf8'))) raak.push(path.relative(WORTEL, vol));
    }
  })(path.join(WORTEL, 'server'));
  assert.deepEqual(raak, [],
    'server/ leest de tariefindeling: ' + raak.join(', ') + ' -- dan is het een tweede waarheid naast ' +
    'kern/fiscaal/tarief.js over welke categorie welk tarief krijgt. Besluit de eigenaar dat de indeling ' +
    'hierop gaat rusten, dan verhuist het register mee naar server/ en vervalt deze toets; tot dan beslist het niets.');
});
