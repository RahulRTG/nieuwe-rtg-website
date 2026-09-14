/* DE NAMENSPROJECTIE -- één taal, geen tweede motor.

   Twee soorten toetsen staan hier naast elkaar en ze bewijzen verschillende
   dingen:

     1-6  GEDRAG: weigert de projectie wat zij belooft te weigeren?
     7-9  ARCHITECTUUR: blijft zij een projectie in plaats van een tweede laag?

   Die tweede groep is er omdat een projectie die stilletjes een eigen opslag,
   een eigen require naar de economic runtime of een eigen veldnaam krijgt, er
   van buiten precies hetzelfde uitziet -- en dan is de grens uit
   REPRESENTATIE.md par. 3.1 weg zonder dat een gedragstoets iets merkt. Dezelfde
   reden waarom STAGE.md par. 6 naast de zwart-doosproef een bewering over de
   BRON zette. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const P = require('../server/kern/namens/projectie');
const { VERKLARING } = require('../server/kern/namens/verklaring');

const WORTEL = path.join(__dirname, '..');
const MAP = path.join(WORTEL, 'server/kern/namens');
const goed = {
  mechanism: 'vertegenwoordiging', principalRef: 'Reiziger Zeven', actingRef: 'Havik Drie',
  authorityRef: 'vg_a1b2c3', purpose: 'CONTRACT.ONDERHANDELING'
};

test('1. een volledige projectie komt er doorheen, met precies de zes velden', () => {
  const r = P.projecteerNamens(Object.assign({}, goed, { capability: 'aanbod.bespreken' }));
  assert.ok(r.projectie, r.error);
  assert.deepEqual(Object.keys(r.projectie).sort(),
    ['actingRef', 'authorityRef', 'capability', 'mechanism', 'principalRef', 'purpose']);
  /* De namen zijn niet vrij gekozen: vijf ervan komen uit
     kern/economie/runtime/intent.js en worden daar al gebruikt. */
  const runtime = fs.readFileSync(path.join(WORTEL, 'server/kern/economie/runtime/intent.js'), 'utf8');
  for (const veld of ['principalRef', 'actingRef', 'purpose', 'authorityRef']) {
    assert.ok(runtime.includes(veld),
      '`' + veld + '` staat ook in de economic runtime; deze laag neemt de naam OVER in plaats van ' +
      'er een tweede naast te zetten');
  }
});

test('2. `mechanism` komt uit de gesloten lijst en nergens anders vandaan', () => {
  for (const naam of Object.keys(VERKLARING)) {
    const r = P.projecteerNamens(Object.assign({}, goed, { mechanism: naam }));
    assert.ok(r.projectie, naam + ' hoort erdoor te komen: ' + r.error);
  }
  const weg = P.projecteerNamens(Object.assign({}, goed, { mechanism: 'representation-engine' }));
  assert.ok(weg.error, 'een verzonnen mechanisme wordt geweigerd');
  assert.match(weg.error, /gesloten/, 'en de weigering zegt waar de lijst staat');
});

test('3. een contactgegeven op een referentie wordt geweigerd, niet opgeschoond', () => {
  /* Deze projectie reist naar een journaal, een conflictcontrole en straks een
     cockpit. Dat is precies waar een echte naam ongemerkt uit lekt. */
  for (const vies of ['jan@example.com', '+31 6 12345678', '0612345678']) {
    const r = P.projecteerNamens(Object.assign({}, goed, { principalRef: vies }));
    assert.ok(r.error, vies + ' hoort geweigerd te worden');
    assert.match(r.error, /codenaam/);
  }
  /* En de tegenproef, want een zeef die ALLES weigert haalt de regel hierboven:
     een codenaam met een cijfer erin moet gewoon werken. */
  assert.ok(P.projecteerNamens(Object.assign({}, goed, { principalRef: 'Reiziger 7' })).projectie,
    'een codenaam met een cijfer is geen contactgegeven');
});

test('4. `purpose` wordt geëist en nooit geraden', () => {
  const zonder = Object.assign({}, goed);
  delete zonder.purpose;
  const r = P.projecteerNamens(zonder);
  assert.ok(r.error);
  assert.match(r.error, /doelbinding/, 'de weigering legt uit waarom dit veld verplicht is');
  /* Het gevaar is niet dat hij weigert maar dat hij zou INVULLEN: een stil
     gevuld veld leest later als een antwoord dat iemand heeft gegeven. */
  assert.equal(P.projecteerNamens(zonder).projectie, undefined, 'er komt geen projectie met een verzonnen doel');
});

test('5. elk verplicht veld wordt afzonderlijk geëist', () => {
  for (const veld of P.VERPLICHT) {
    const zonder = Object.assign({}, goed);
    delete zonder[veld];
    assert.ok(P.projecteerNamens(zonder).error, veld + ' ontbreekt en wordt gemist');
  }
});

test('6. een zelfprojectie wordt herkend', () => {
  /* Iemand die namens zichzelf handelt heeft geen machtiging nodig; verschijnt
     hij toch in deze vorm, dan is er een gever met een ontvanger verward. */
  const r = P.projecteerNamens(Object.assign({}, goed, { actingRef: goed.principalRef }));
  assert.ok(r.projectie, 'de vorm zelf is geldig');
  assert.equal(P.zelfprojectie(r.projectie), true, 'maar hij wordt als zelfprojectie herkend');
  assert.equal(P.zelfprojectie(P.projecteerNamens(goed).projectie), false);
});

test('7. ARCHITECTUUR: deze laag raakt de economic runtime met geen enkele require', () => {
  /* De grens uit REPRESENTATIE.md par. 3.1: wat gedeeld wordt is de TAAL en
     niet de machine. Die runtime bestaat om een bevestigde betaling te
     verdelen; hem uitbreiden tot algemene representatielaag maakt van een
     geldmotor een bevoegdheidsmotor. */
  for (const naam of fs.readdirSync(MAP)) {
    const bron = fs.readFileSync(path.join(MAP, naam), 'utf8');
    const requires = [...bron.matchAll(/require\(\s*'([^']+)'/g)].map(m => m[1]);
    for (const r of requires) {
      assert.ok(!/economie|fonds|pay|betaal/.test(r),
        naam + ' requiret `' + r + '`. Twee lagen die dezelfde woorden gebruiken kunnen naast elkaar ' +
        'leven; twee lagen die elkaars code aanroepen niet.');
    }
  }
});

test('8. ARCHITECTUUR: deze laag heeft geen opslag, geen routes en geen sessie', () => {
  const verboden = [
    [/\bdb\b|db\.data|eigencollectie/, 'een eigen opslag -- een projectie is een AFGELEIDE en geen tweede waarheid'],
    [/\bapp\.(get|post|put|delete)\b/, 'een route'],
    [/req\.session|sess\./, 'de sessie']
  ];
  for (const naam of fs.readdirSync(MAP)) {
    const bron = fs.readFileSync(path.join(MAP, naam), 'utf8')
      /* Commentaar eruit: deze koppen NOEMEN db en routes juist om te zeggen
         dat ze er niet zijn, en een toets die zijn eigen uitleg leest is de
         fout uit BEWIJSMACHINE.md par. 6a. */
      .replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\/])\/\/[^\n]*/g, '$1');
    for (const [re, wat] of verboden) {
      assert.ok(!re.test(bron), naam + ' bevat ' + wat);
    }
  }
});

test('9. ARCHITECTUUR: de zeef is HERGEBRUIKT en niet nagebouwd', () => {
  const bron = fs.readFileSync(path.join(MAP, 'projectie.js'), 'utf8');
  assert.match(bron, /require\('\.\.\/envelop'\)/,
    'de codenaamzeef komt uit kern/envelop.js; een tweede zeef loopt binnen een maand achter op de eerste');
  assert.ok(!/CONTACTGEGEVEN\s*=/.test(bron),
    'en er staat geen eigen kopie van het patroon in dit bestand');
});
