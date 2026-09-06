/* MEET NIEMAND TERWIJL EEN MOTOR DE BRON VERBOUWT?

   Twee motoren in dit huis muteren met opzet echte bestanden en zetten ze in
   een finally terug: scripts/mutatie.js (de mutatiemotor) en
   test/meterijk.test.js (de ijking, die een tijdelijk scherm onder public/apps/, een
   dependency in package.json en honderd /api/zzijkproef-routes neerzet). Ze
   nemen daarvoor het exclusieve slot uit scripts/afbouw-slot.js.

   WIE ER MIDDENIN MEET, MEET DIE AANBOUW MEE. Dat is hier gebeurd:
   scripts/kaart.js telde het extra scherm en schreef het in ARCHITECTUUR.md, en
   CI zag daarna een document dat achterliep op de code. Erger nog dan de fout is
   dat hij onzichtbaar was -- die generatoren schrijven een DOCUMENT en geen
   register, dus er is geen stempel waarin `boomVuil` het had kunnen verraden.

   `eisSchoneBoom` vangt dit maar bij toeval: git ziet de aanbouw wel, maar een
   meting die START in een schoon venster en er middenin belandt, komt er langs.

   Draai los: node --test test/afbouwpoort.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const slot = require('../scripts/afbouw-slot');

test('actief() leest het slot zonder het te pakken', () => {
  /* De hele reden dat deze functie naast pak() staat: twee LEZERS mogen naast
     elkaar draaien. Zou dit pak() gebruiken, dan sloten metingen elkaar uit. */
  const voor = slot.actief();
  const tweede = slot.actief();
  assert.deepEqual(tweede, voor, 'kijken verandert niets, ook niet twee keer');
});

/* HET ECHTE SLOT WORDT HIER NIET GEPAKT, en dat is geen omweg.
   scripts/test-runner.js HOUDT dat slot terwijl de suite draait, dus een toets
   die het zelf wil nemen zakt in CI op precies de plek waar hij hoort te
   slagen. eisSchoneBoom neemt daarom een lezer aan; wat er wordt meegegeven is
   de LEZER en niet de uitkomst, zodat de hele weg nog door de poort loopt. */
const alsAfbouw = (wat) => () => wat;

/* EN DE TWEEDE INVOER VAN DE POORT: de vlag die zegt dat het slot van je EIGEN
   proceslijn is. scripts/test-runner.js zet RTG_AFBOUW_SLOT_ACTIEF=1 voor de
   hele suite, dus binnen een toets staat hij AAN -- en dan laat de poort alles
   door. Elke bewering hieronder die over de WEIGERING gaat, moet hem dus zelf
   uitzetten, anders slaagt hij op de omgeving in plaats van op de logica.

   Dit is geen theorie: deze twee toetsen stonden groen toen ik ze los draaide
   (buiten de runner is de vlag niet gezet) en zakten in CI. Een toets die
   afhangt van hoe hij wordt gestart, meet zijn starter. */
function zonderEigenSlot(werk) {
  const oud = process.env.RTG_AFBOUW_SLOT_ACTIEF;
  delete process.env.RTG_AFBOUW_SLOT_ACTIEF;
  try { return werk(); }
  finally { if (oud !== undefined) process.env.RTG_AFBOUW_SLOT_ACTIEF = oud; }
}

test('eisGeenAfbouw weigert zolang er een motor draait, en zegt WELKE', () => {
  const r = zonderEigenSlot(() => slot.eisGeenAfbouw('een proefmeting',
    () => ({ taak: 'toets-afbouwpoort', pid: 4242, gestart: '2026-09-06T13:00:00Z' })));
  assert.equal(r.ok, false, 'een meting naast een motor is geen geldige meting');
  assert.match(r.reden, /toets-afbouwpoort/, 'de reden noemt WELKE motor draait');
  assert.match(r.reden, /4242/, 'en zijn pid, zodat je kunt kijken of hij vastzit');
  assert.ok(r.afbouw && r.afbouw.pid);
});

test('en laat hem door zodra het slot vrij is', () => {
  /* Zonder deze bewering zou een poort die ALTIJD weigert ook groen staan --
     en dat is de gevaarlijkste vorm: elke meting stil geblokkeerd. */
  const r = zonderEigenSlot(() => slot.eisGeenAfbouw('een proefmeting', () => null));
  assert.equal(r.ok, true, 'met een vrij slot mag de meting gewoon draaien');
});

test('RTG_METEN_TIJDENS_AFBOUW=1 opent hem met opzet', () => {
  /* Een ontsnapping die er ALTIJD hoort te zijn bij een harde poort, en die
     hier alleen mag omdat zo'n ronde daarmee zelf zegt dat hij niet als bewijs
     telt -- dezelfde afspraak als RTG_METEN_OP_VUILE_BOOM. */
  const oud = process.env.RTG_METEN_TIJDENS_AFBOUW;
  process.env.RTG_METEN_TIJDENS_AFBOUW = '1';
  try {
    const r = zonderEigenSlot(() => slot.eisGeenAfbouw('x', () => ({ taak: 'toets', pid: 1, gestart: 'x' })));
    assert.equal(r.ok, true);
    assert.match(r.reden, /telt niet als bewijs/, 'en zegt erbij wat die opening kost');
  } finally {
    if (oud === undefined) delete process.env.RTG_METEN_TIJDENS_AFBOUW;
    else process.env.RTG_METEN_TIJDENS_AFBOUW = oud;
  }
});

test('het slot van je EIGEN proceslijn is geen vreemde motor', () => {
  /* HIER IS DEZE POORT DE EERSTE KEER OMGEVALLEN, en niet op een meting maar op
     de toetsen zelf. scripts/test-runner.js pakt het slot voor de HELE suite
     (`pak('volledige Node-tests')`) en geeft RTG_AFBOUW_SLOT_ACTIEF=1 door aan
     elk kindproces. Zonder deze regel weigert de poort dus binnen elke toets,
     en dan valt alles om wat een gepoort script aanroept:
     test/functielijst.test.js eindigde op exitCode 2 (het script doet
     process.exit(2) bij een weigering) en test/schoneboom.test.js zakte twee
     keer, omdat eisSchoneBoom een weigering teruggaf zonder `bestanden` en met
     een reden die zijn eigen ontsnapping RTG_METEN_OP_VUILE_BOOM niet noemt.

     De vlag bestond al -- pak() gebruikt hem sinds de meterijking -- en betekent
     "het slot is van mijn eigen ouder". Die vraag is iets anders dan "er loopt
     een motor", en dit is de plek waar dat onderscheid hoort.

     WAT DEZE OPENING NIET WEGGEEFT: binnen een suite muteert alleen een IJKING
     de bron, en scripts/lib/ijkingen.js draait die een voor een en in CI zelfs
     in een eigen job. Die isolatie is de bescherming daar; deze poort beschermt
     tegen een motor in een ANDERE proceslijn (mijn eigen shell naast een
     draaiende meterijking -- precies het geval waarvoor hij gebouwd is). Haalt
     iemand een ijking uit die lijst zonder eigen job, dan is dat gat er wel;
     test/delen.test.js is de toets die daarover gaat. */
  const oud = process.env.RTG_AFBOUW_SLOT_ACTIEF;
  process.env.RTG_AFBOUW_SLOT_ACTIEF = '1';
  try {
    const r = slot.eisGeenAfbouw('een proefmeting',
      alsAfbouw({ taak: 'volledige Node-tests', pid: 4242, gestart: 'toen' }));
    assert.equal(r.ok, true, 'het slot van je eigen ouder mag je niet buitensluiten');
    assert.match(r.reden, /eigen proceslijn/, 'en de reden zegt waarom hij toch doorloopt');
  } finally {
    if (oud === undefined) delete process.env.RTG_AFBOUW_SLOT_ACTIEF;
    else process.env.RTG_AFBOUW_SLOT_ACTIEF = oud;
  }
});

test('eisSchoneBoom draagt dezelfde poort, dus de elf proeven krijgen hem gratis', () => {
  const { eisSchoneBoom } = require('../scripts/lib/stempel');
  const r = zonderEigenSlot(() => eisSchoneBoom('een proefmeting',
    { afbouw: () => ({ taak: 'motor-x', pid: 7, gestart: 'toen' }) }));
  assert.equal(r.ok, false);
  assert.match(r.reden, /motor-x/);
  const vrij = zonderEigenSlot(() => eisSchoneBoom('een proefmeting', { afbouw: () => null }));
  assert.equal(/afbouw loopt/.test(String(vrij.reden || '')), false,
    'met een vrij slot is de afbouw geen reden meer (de boom mag nog wel vuil zijn)');
});

test('de twee documentgeneratoren roepen de gedeelde poort ook echt aan', () => {
  /* Zij kunnen eisSchoneBoom niet gebruiken -- je draait ze juist OMDAT je net
     een bestand hebt toegevoegd, en dan is de boom per definitie vuil. Dit is
     met opzet de enige bewering die naar de BRON kijkt, en alleen naar het feit
     dat ze de helper aanroepen; wat die helper dan doet, staat hierboven. */
  const fs = require('fs');
  const path = require('path');
  for (const naam of ['kaart.js', 'functielijst.js']) {
    const bron = fs.readFileSync(path.join(__dirname, '..', 'scripts', naam), 'utf8');
    const regels = bron.split('\n').filter(r => !r.trim().startsWith('//') && !r.trim().startsWith('*'));
    assert.ok(regels.some(r => r.includes("require('./afbouw-slot').eisGeenAfbouw(")),
      'scripts/' + naam + ' hoort de gedeelde poort aan te roepen (en niet in commentaar)');
  }
});
