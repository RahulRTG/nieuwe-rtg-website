/* DE TIEN MUTATIES DRIJVEN NIET AF VAN DE BRON (scripts/mensmutatie.js).

   WAAROM DIT BESTAAT. De motor zelf is een METER: hij verbouwt de bron twaalf
   keer en draait er zeven wachten tegenaan, en dat duurt minuten. Hij hangt
   daarom aan de NORM-ratel en niet aan `npm test` -- net als MENSTAALPROEF.json
   en EERSTEMINUUT.json.

   Dat laat een gat open dat deze toets dicht. Elke mutatie grijpt een LETTERLIJK
   stuk bron aan. Wordt `lusstap.js` morgen geherschikt, dan past het anker niet
   meer en meldt de motor keurig `NIET_TOEGEPAST` -- maar die melding leest
   niemand tot de volgende ronde, en tot die tijd staat er een register dat
   beweert dat een garantie bewaakt wordt terwijl hij niet eens is geprobeerd.

   DEZE TOETS MUTEERT NIETS EN START NIETS. Hij leest de bron en telt of elk
   anker er precies EEN keer in staat. Milliseconden, dus hij kan gewoon in de
   suite. Het zware werk blijft bij de motor.

   MUTATIE: verander een van de `van`-teksten in scripts/mensmutatie.js in iets
   dat niet meer in de bron staat; toets 1 hoort dan te zakken met het bestand
   en het ankerpunt erbij. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { MUTATIES, WACHTEN } = require('../scripts/mensmutatie');

const WORTEL = path.join(__dirname, '..');
const lees = (p) => fs.readFileSync(path.join(WORTEL, p), 'utf8');

test('1. elk ankerpunt staat precies EEN keer in de bron die het aangrijpt', () => {
  assert.ok(MUTATIES.length >= 12, 'er horen minstens twaalf mutaties te zijn, zijn er ' + MUTATIES.length);
  for (const m of MUTATIES) {
    for (const t of (m.tekst || [])) {
      const n = lees(t.bestand).split(t.van).length - 1;
      assert.equal(n, 1, 'mutatie ' + m.nr + ': het ankerpunt staat ' + n + ' keer in ' +
        t.bestand + ' -- een mutatie die niet precies past, wordt overgeslagen en dan ' +
        'beweert MENSMUTATIE.json iets over een garantie die nooit is aangeraakt.\n  ' +
        t.van.split('\n')[0]);
    }
  }
});

test('2. elke contractmutatie wijst een geval aan dat bestaat, en verandert er iets aan', () => {
  for (const m of MUTATIES) {
    for (const c of (m.contract || [])) {
      const d = JSON.parse(lees(c.bestand));
      const g = (d.gevallen || []).find((x) => x.id === c.geval);
      assert.ok(g, 'mutatie ' + m.nr + ': het geval ' + c.geval + ' staat niet in ' + c.bestand);
      assert.ok(Object.prototype.hasOwnProperty.call(g, c.veld),
        'mutatie ' + m.nr + ': ' + c.geval + ' draagt het veld ' + c.veld + ' niet');
      assert.notEqual(g[c.veld], c.naar, 'mutatie ' + m.nr + ': ' + c.geval + '.' + c.veld +
        ' staat al op ' + c.naar + '; dan verandert deze mutatie niets en bewijst hij niets');
    }
  }
});

test('3. een mutatie verandert echt iets, en de nummers zijn uniek', () => {
  const gezien = new Set();
  for (const m of MUTATIES) {
    assert.ok(!gezien.has(m.nr), 'twee mutaties dragen het nummer ' + m.nr);
    gezien.add(m.nr);
    assert.ok((m.tekst || []).length + (m.contract || []).length > 0,
      'mutatie ' + m.nr + ' verandert niets');
    for (const t of (m.tekst || []))
      assert.notEqual(t.van, t.naar, 'mutatie ' + m.nr + ': van en naar zijn gelijk');
    /* Zonder deze twee velden is de uitslag een vinkje zonder betekenis: wat is
       er weggehaald, en wat hoorde daarvan af te gaan. */
    assert.ok(m.weg && m.weg.length > 15, 'mutatie ' + m.nr + ' zegt niet wat er weggaat');
    assert.ok(m.hoortTeZakken, 'mutatie ' + m.nr + ' zegt niet wat er hoort te zakken');
  }
});

test('3b. elke mutatie zegt in EEN woord wat zij bewaakt, en een fasenaam bestaat echt', () => {
  /* `bewaakt` is de join-sleutel voor scripts/menselijkeuitvoering.js. Staat er
     een fasenaam die kern/stuur/spoor.js niet kent, dan levert die join niets op
     en ziet die fase eruit alsof niemand hem bewaakt -- een valse nul, en precies
     het soort stilte waar dit huis op let.
     MUTATIE: schrijf `INTENT_RESOLVD` bij mutatie 2. */
  const { FASEN } = require('../server/kern/stuur/spoor');
  const EIGEN = ['trede', 'referent', 'onbekendeZin', 'blokkerendeVragen', 'architectuurkeuze'];
  for (const m of MUTATIES) {
    assert.ok(m.bewaakt, 'mutatie ' + m.nr + ' zegt niet wat zij bewaakt');
    const isFase = m.bewaakt === m.bewaakt.toUpperCase();
    assert.ok(isFase ? FASEN.includes(m.bewaakt) : EIGEN.includes(m.bewaakt),
      'mutatie ' + m.nr + ' bewaakt `' + m.bewaakt + '`, en dat is geen fase uit spoor.js ' +
      'en ook geen van de eigen woorden (' + EIGEN.join(', ') + ')');
  }
  /* En elke fase die er is, hoort ook echt door een mutatie geraakt te worden --
     op INPUT_RECEIVED na, die bij het MAKEN van het spoor valt en dus niet weg
     te halen is zonder het spoor zelf weg te halen. */
  const gedekt = new Set(MUTATIES.map((m) => m.bewaakt));
  for (const f of FASEN) {
    if (['INPUT_RECEIVED', 'PROJECTED', 'CAPABILITY_SELECTED', 'EXECUTED'].includes(f)) continue;
    assert.ok(gedekt.has(f), 'geen enkele mutatie haalt fase ' + f + ' weg');
  }
});

test('4. elke wacht bestaat, en er zit er een bij die de hele keten draait', () => {
  for (const w of WACHTEN) {
    const doel = w.cmd[w.cmd.length - 1].startsWith('--') ? w.cmd[2] : w.cmd[w.cmd.length - 1];
    const bestand = w.cmd.find((c) => c.endsWith('.js'));
    assert.ok(fs.existsSync(path.join(WORTEL, bestand)),
      'de wacht ' + w.naam + ' wijst naar ' + bestand + ', en dat bestaat niet');
    assert.ok(doel);
  }
  /* ZONDER DE PROEF ZIJN HET ALLEEN UNITTOETSEN. Vijf van de zeven wachten
     laden een module rechtstreeks; alleen menstaalproef draait de ECHTE route
     van begin tot eind. Valt die uit de lijst, dan kan een mutatie die pas over
     HTTP zichtbaar wordt (zoals 9b) ongemerkt langskomen. */
  assert.ok(WACHTEN.some((w) => w.cmd.join(' ').includes('menstaalproef')),
    'de menstaalproef staat niet meer in de wachten; dan wordt er niets meer over de ' +
    'echte route gemeten');
});

test('5. de motor komt nooit aan een register dat hij zelf meet', () => {
  const bron = lees('scripts/mensmutatie.js');
  /* De proef MOET met --niet-schrijven draaien. Doet hij dat niet, dan komt een
     uitslag uit gemuteerde code in MENSTAALPROEF.json terecht -- precies wat er
     met APPWERKT.json een keer echt is gebeurd, en het viel pas op in de commit.
     MUTATIE: haal --niet-schrijven uit de wachtenlijst. */
  const proef = WACHTEN.find((w) => w.cmd.join(' ').includes('menstaalproef'));
  assert.ok(proef.cmd.includes('--niet-schrijven'),
    'de menstaalproef draait zonder --niet-schrijven; dan schrijft een gemuteerde ronde ' +
    'zijn uitslag in MENSTAALPROEF.json');
  assert.match(bron, /--niet-schrijven/);
  /* En hij zet terug met git, dus hij weigert te draaien op ongecommit werk. */
  assert.match(bron, /status', '--porcelain'/,
    'de motor toetst niet meer op ongecommit werk; `git checkout --` gooit dat dan weg');
});
