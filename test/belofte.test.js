/* Het belofteregister (scripts/belofte.js + BELOFTE.json): elke toezegging
   draagt haar dekking, en die dekking moet er echt zijn. Deze toets bewijst dat
   de meter de drie standen goed uit elkaar houdt -- en vooral dat hij de enige
   alarmerende stand (GEBROKEN) ook werkelijk vindt.

   WAAROM DIT ER IS. De vraag "wat is er nog niet" is hier twee keer verkeerd
   beantwoord: één keer doordat er alleen in de bovenste maplaag werd gezocht
   (Sheets, Slides en Forms staan in public/apps/office/), één keer doordat een
   Nederlandse naam niet werd herkend (CRM is server/bedrijf/klant.js). Een
   register lost dat alleen op als het NAGEKEKEN wordt; een lijst die niemand
   toetst, is precies zo betrouwbaar als de vorige twee antwoorden.

   MUTATIES die zijn gedraaid en welke toets erop zakte (LAT.md regel 2):
   - `bestaat()` altijd true laten geven
     -> "een verdwenen bewijsstuk maakt de belofte gebroken" ZAKT (RAAK)
   - de gebroken-telling uit meet() gehaald (stand altijd gedekt/open)
     -> dezelfde toets ZAKT (RAAK)

   Draai: npm test */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const belofte = require('../scripts/belofte');
const WORTEL = path.join(__dirname, '..');

test('elke belofte in het register is gedekt of eerlijk open, en geen enkele is gebroken', () => {
  const { rijen, tel } = belofte.meet();
  assert.ok(rijen.length >= 50, 'het register beslaat de hele opdracht (' + rijen.length + ' beloften)');
  assert.equal(tel.gebroken, 0,
    'gebroken: ' + rijen.filter(r => r.stand === 'gebroken').map(r => r.id + ' -> ' + r.kwijt.join(',')).join(' | '));
  assert.ok(tel.gedekt > tel.open, 'er is meer gedekt dan open (' + tel.gedekt + ' om ' + tel.open + ')');
});

test('een verdwenen bewijsstuk maakt de belofte gebroken', () => {
  /* De echte proef: we zetten in een KOPIE van het register een pad dat niet
     bestaat, en eisen dat de meter dat als gebroken meldt. Zonder deze proef is
     "0 gebroken" een uitslag die net zo goed uit een kapotte meter kan komen --
     LAT.md regel 2, en dit is precies de meter die dat moet voorkomen. */
  const echt = JSON.parse(fs.readFileSync(path.join(WORTEL, 'BELOFTE.json'), 'utf8'));
  const kopie = path.join(WORTEL, 'BELOFTE.json.proef');
  const doel = path.join(WORTEL, 'BELOFTE.json');
  const bewaard = fs.readFileSync(doel);
  try {
    echt.beloften[0].dekking = ['server/kern/dit-bestaat-niet.js'];
    fs.writeFileSync(doel, JSON.stringify(echt, null, 2) + '\n');
    delete require.cache[require.resolve('../scripts/belofte')];
    const opnieuw = require('../scripts/belofte');
    const { tel, rijen } = opnieuw.meet();
    assert.equal(tel.gebroken, 1, 'de meter ziet het verdwenen bewijsstuk');
    assert.equal(rijen[0].stand, 'gebroken');
    assert.deepEqual(rijen[0].kwijt, ['server/kern/dit-bestaat-niet.js']);
    assert.match(opnieuw.bouw(), /Gebroken beloften/, 'en hij zet het bovenaan het rapport');
  } finally {
    fs.writeFileSync(doel, bewaard);
    try { fs.unlinkSync(kopie); } catch (e) {}
    delete require.cache[require.resolve('../scripts/belofte')];
  }
});

test('een API-pad telt pas als het echt geregistreerd is', () => {
  /* Een bestand kun je zien staan; een route niet. Daarom kijkt de meter of het
     pad letterlijk in de serverbron voorkomt. Deze toets pint beide kanten af:
     een bestaand pad telt, een verzonnen pad niet. */
  const { rijen } = belofte.meet();
  const metRoute = rijen.find(r => r.dekking.some(d => d.startsWith('/api/')));
  assert.ok(metRoute, 'er is minstens één belofte die op een API-pad leunt');

  const echt = JSON.parse(fs.readFileSync(path.join(WORTEL, 'BELOFTE.json'), 'utf8'));
  const doel = path.join(WORTEL, 'BELOFTE.json');
  const bewaard = fs.readFileSync(doel);
  try {
    echt.beloften[0].dekking = ['/api/command/dit-bestaat-niet'];
    fs.writeFileSync(doel, JSON.stringify(echt, null, 2) + '\n');
    delete require.cache[require.resolve('../scripts/belofte')];
    assert.equal(require('../scripts/belofte').meet().tel.gebroken, 1,
      'een verzonnen API-pad maakt de belofte gebroken');
  } finally {
    fs.writeFileSync(doel, bewaard);
    delete require.cache[require.resolve('../scripts/belofte')];
  }
});

/* DEZE TOETS EISTE EERST DAT ER WERKVOORRAAD WAS ("assert.ok(open.length)"),
   en dat was geen eigenschap maar een momentopname: op de dag dat de laatste
   open belofte dichtging, zakte hij. Een toets die rood wordt omdat het werk af
   is, meet de kalender en niet de code.

   Wat hier WEL een eigenschap is: het register mag niet liegen in beide
   richtingen. Staat er iets open, dan staat het bij naam in het rapport en
   draagt het geen dekking. Staat er niets open, dan zegt de telling dat met een
   nul -- en dan hoort er ook geen enkele belofte als "nog niet gebouwd" te
   worden getoond. Dat tweede is de gevaarlijke kant: een rapport dat werk toont
   dat niet meer bestaat, stuurt iemand naar een lade die al leeg is. */
test('het rapport is eerlijk over de werkvoorraad, of die er nu is of niet', () => {
  const md = fs.readFileSync(belofte.DOEL, 'utf8');
  const { rijen, tel } = belofte.meet();
  const open = rijen.filter(r => r.stand === 'open');
  assert.equal(open.length, tel.open, 'de telling en de rijen zijn het eens');

  for (const r of open) {
    assert.ok(md.includes(r.wat), 'de open belofte "' + r.wat + '" staat in het rapport');
    assert.equal(r.dekking.length, 0, 'en draagt geen dekking die er niet is');
  }

  const getoond = (md.match(/_nog niet gebouwd_/g) || []).length;
  assert.equal(getoond, open.length,
    'precies de open beloften worden als "nog niet gebouwd" getoond -- geen enkele meer en geen ' +
    'enkele minder (getoond: ' + getoond + ', open: ' + open.length + ')');
  assert.match(md, new RegExp('\\| open \\| ' + tel.open + ' \\|'),
    'en de telling staat in de tabel bovenaan, ook als hij nul is');
});
