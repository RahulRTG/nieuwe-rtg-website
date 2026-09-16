'use strict';
/* ============================================================================
   DE HERBOUWPROEF: IS EEN AFGELEID ARTEFACT EEN HERBOUWPLICHT?

   AFGELEID.json zegt WIE mag afleiden; HERBOUWPROEF.json zegt of het draaien
   van die eigenaar hetzelfde oplevert. Dit bestand handhaaft de eigenschappen
   die de uitslag eerlijk houden -- niet het getal, want dat mag bewegen.

   De marker `loopt achter` zet dit bestand in npm run registerklopt.
   ============================================================================ */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const { aanroepVan, vergelijk, meetmomentVelden, beproef, samenvatting, LEESLOOS } =
  require('../scripts/herbouwproef.js');
const REGISTER = JSON.parse(fs.readFileSync(path.join(WORTEL, 'HERBOUWPROEF.json'), 'utf8'));
const AFGELEID = JSON.parse(fs.readFileSync(path.join(WORTEL, 'AFGELEID.json'), 'utf8'));

const UITSLAGEN = ['gelijk', 'alleenStempel', 'verschilt', 'nietGeschreven', 'nietGedraaid'];

test('1. elke uitslag komt uit de gesloten lijst', () => {
  for (const r of REGISTER.artefacten) {
    assert.ok(UITSLAGEN.includes(r.uitslag), r.naam + ' draagt uitslag ' + r.uitslag);
  }
});

test('2. de uitslag hangt aan de eigenaar die AFGELEID.json vandaag aanwijst', () => {
  /* Dit is de "loopt achter"-toets, en hij gaat over iets scherpers dan
     ouderdom: verschuift de eigenaar van een artefact, dan zegt een oude
     herbouwuitslag niets meer -- er is een ANDER script beproefd. */
  const perNaam = new Map(AFGELEID.artefacten.map(r => [r.naam, r]));
  for (const r of REGISTER.artefacten) {
    const a = perNaam.get(r.naam);
    assert.ok(a, r.naam + ' staat in HERBOUWPROEF.json en niet meer in AFGELEID.json');
    assert.equal(r.eigenaar || null, a.eigenaar || null,
      r.naam + ': beproefd op ' + r.eigenaar + ', AFGELEID.json wijst nu ' + a.eigenaar +
      ' aan -- draai npm run herbouwproef -- ' + r.naam + ' --opnieuw');
  }
});

test('3. er wordt nooit een leesloze stand beproefd', () => {
  /* Een --controle- of --toon-variant schrijft met opzet niet. Wie die kiest,
     meet gegarandeerd "nietGeschreven" en noemt dat dan een eigenschap van het
     artefact. */
  for (const r of REGISTER.artefacten) {
    if (!r.opdracht) continue;
    assert.ok(!LEESLOOS.test(r.opdracht), r.naam + ' is beproefd met een leesloze opdracht: ' + r.opdracht);
  }
});

test('4. een bevinding zegt WAT er anders was, een niet-uitslag zegt waarom', () => {
  for (const r of REGISTER.artefacten) {
    if (r.uitslag === 'verschilt') {
      assert.ok(Array.isArray(r.verschilIn) && r.verschilIn.length,
        r.naam + ' verschilt zonder te zeggen waarin');
    }
    if (r.uitslag === 'nietGedraaid' || r.uitslag === 'nietGeschreven') {
      assert.ok(r.reden && r.reden.length > 10, r.naam + ' is ' + r.uitslag + ' zonder uitgeschreven reden');
    }
  }
});

test('5. gelijk en alleenStempel worden nergens tot een cijfer opgeteld', () => {
  /* Een percentage "determinisme" zou van een bewegend stempel een defect maken
     en van een register zonder meetmoment de beste leerling. De samenvatting
     telt ze daarom apart, en `herbouwbaar` draagt die naam en geen percentage.
     LAT-regel 11 en scripts/check.js regel 48 staan hierboven. */
  const tekst = JSON.stringify(REGISTER.gemeten);
  assert.ok(!/[Pp]ct|percentage|score/.test(tekst),
    'de samenvatting draagt een samengesteld cijfer: ' + tekst);
  assert.equal(REGISTER.gemeten.herbouwbaar, REGISTER.gemeten.gelijk + REGISTER.gemeten.alleenStempel);
  assert.deepEqual(samenvatting(REGISTER.artefacten), REGISTER.gemeten);
});

test('6. een meetmoment wordt op VORM herkend en niet op naam', () => {
  /* Twee stempelconventies naast elkaar (`stempel` en een kale `vastgelegd`)
     verleiden tot een lijst met toegestane veldnamen. Die zou morgen de derde
     vorm missen en vandaag al een echt verschil wegpoetsen dat toevallig zo
     heet. */
  assert.deepEqual(meetmomentVelden({ vastgelegd: '2026-09-15' }, { vastgelegd: '2026-09-16' }), ['vastgelegd']);
  assert.deepEqual(meetmomentVelden({ gemetenOp: '2026-09-15T10:00:00Z' }, { gemetenOp: '2026-09-16T10:00:00Z' }), ['gemetenOp']);
  /* Zelfde naam, geen datum: inhoud. */
  assert.deepEqual(meetmomentVelden({ vastgelegd: 'door Adam' }, { vastgelegd: 'door Eva' }), []);
  /* En een datum die NIET beweegt is geen meetmoment-bevinding. */
  assert.deepEqual(meetmomentVelden({ vastgelegd: '2026-09-15' }, { vastgelegd: '2026-09-15' }), []);
});

test('7. vergelijk noemt een inhoudelijk verschil ook als er een stempel naast beweegt', () => {
  const voor = JSON.stringify({ stempel: { op: '2026-09-15T00:00:00Z' }, gemeten: { n: 1 } });
  const na = JSON.stringify({ stempel: { op: '2026-09-16T00:00:00Z' }, gemeten: { n: 2 } });
  const u = vergelijk('X.json', voor, na);
  assert.equal(u.uitslag, 'verschilt');
  assert.deepEqual(u.verschilIn, ['gemeten']);
  assert.deepEqual(u.meetmoment, ['stempel']);
});

test('8. de besturingsproef: een opdracht die niets schrijft heet nietGeschreven', () => {
  /* Zonder deze stand leest elke leesloze opdracht als een perfecte
     reproductie. Een instrument dat niet kan uitslaan, is geen instrument --
     dus wordt hier een opdracht gedraaid die aantoonbaar niets doet. */
  const r = beproef('AFGELEID.json', { opdracht: 'node -e ""', herkomst: 'toets' }, 30000);
  assert.equal(r.uitslag, 'nietGeschreven', JSON.stringify(r));
  /* EN DE TEGENPROEF, want anders is "nietGeschreven" de goedkoopste uitkomst
     voor alles: een opdracht die het bestand WEL aanraakt met dezelfde inhoud
     hoort `gelijk` te geven en niet `nietGeschreven`. */
  const kopie = path.join(os.tmpdir(), 'rtg-herbouwproef-' + process.pid + '.json');
  fs.copyFileSync(path.join(WORTEL, 'AFGELEID.json'), kopie);
  try {
    const raak = beproef('AFGELEID.json', {
      opdracht: 'node -e "const f=require(\'fs\');f.writeFileSync(\'AFGELEID.json\',f.readFileSync(\'AFGELEID.json\'))"',
      herkomst: 'toets'
    }, 30000);
    assert.equal(raak.uitslag, 'gelijk', JSON.stringify(raak));
  } finally {
    fs.copyFileSync(kopie, path.join(WORTEL, 'AFGELEID.json'));
    fs.unlinkSync(kopie);
  }
});

test('een time-out ruimt de eigen procesgroep op', () => {
  const r = beproef('AFGELEID.json', {
    opdracht: 'exec node -e "setInterval(() => {}, 1000)"', herkomst: 'toets'
  }, 100);
  assert.equal(r.uitslag, 'nietGedraaid');
  assert.equal(r.kringWeg, true, 'de procesgroep mag na de time-out niet blijven draaien');
});

test('9. de aanroep wordt afgeleid en nergens als vierde lijst verklaard', () => {
  const npmScripts = JSON.parse(fs.readFileSync(path.join(WORTEL, 'package.json'), 'utf8')).scripts;
  /* versheid wint van package.json ... */
  assert.deepEqual(aanroepVan('X.json', 'scripts/norm.js', 'npm run iets:vast', npmScripts),
    { opdracht: 'npm run iets:vast', herkomst: 'versheid' });
  /* ... maar nooit als die verklaring zelf leesloos is. */
  assert.equal(aanroepVan('X.json', 'scripts/norm.js', 'npm run norm:controle --controle', npmScripts).herkomst,
    'package.json');
  /* en zonder npm-opdracht is de eigenaar zelf de aanroep. */
  assert.deepEqual(aanroepVan('X.json', 'scripts/bestaat-niet-xyz.js', null, npmScripts),
    { opdracht: 'node scripts/bestaat-niet-xyz.js', herkomst: 'eigenaar' });
  assert.equal(aanroepVan('X.json', null, null, npmScripts), null);
});
