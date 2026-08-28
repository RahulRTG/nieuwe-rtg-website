/* De vertaaldekking: wat "114 talen" waard is.

   De beloftes die hier hard worden gemaakt:

   - elke taal in het register draagt een eigen naam en een Engelse, en geen
     code staat er twee keer in;
   - elke DOELtaal draagt de volledige kernrij, zodat een gezin ook zonder
     AI-sleutel iets in de eigen taal ziet -- het Nederlands is de bron en
     heeft er per definitie geen nodig;
   - een cel die gelijk is aan het Nederlandse bronwoord is toegestaan (Duits
     "ja", Afrikaans "les") maar wordt GETELD en opgesomd: verzwijgen is erger
     dan verbieden;
   - de meting zegt zelf wat ze NIET meet -- of het Tigrinya klopt, weet deze
     machine niet;
   - en het getal in SCHOOL.md loopt niet uit de pas met de meting.
   Draai los: node --experimental-sqlite --test test/taaldekking.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const path = require('path');
const { meet, regel, BRON } = require('../server/kern/taaldekking');

test('het register is heel: elke taal heeft twee namen en staat er een keer in', () => {
  const m = meet();
  assert.equal(m.talen, 114, 'het aantal talen in het register is veranderd');
  assert.deepEqual(m.zonderNaam, [], 'deze talen missen hun eigen naam of de Engelse');
  assert.deepEqual(m.dubbel, [], 'deze taalcodes staan er twee keer in');
  assert.ok(m.basistalen.includes('nl') && m.basistalen.includes('en'));
});

test('elke doeltaal draagt de volledige kernrij, en het Nederlands is de bron', () => {
  const m = meet();
  assert.deepEqual(m.zonderRij, [], 'deze doeltalen hebben helemaal geen kernrij');
  assert.deepEqual(m.onvolledig, [], 'deze doeltalen hebben een halve kernrij');
  assert.deepEqual(m.leeg, [], 'deze cellen zijn leeg');
  assert.equal(m.metKernrij, m.doeltalen, 'niet elke doeltaal komt aan de kernrij');
  assert.equal(m.doeltalen, m.talen - 1, 'de brontaal hoort niet als doeltaal mee te tellen');
  assert.equal(BRON, 'nl');
});

test('de melders werken: een kapotte tabel wordt ook echt gemeld', () => {
  /* WAAROM DEZE TOETS BESTAAT. De echte tabel heeft geen gaten, dus
     "geen lege cellen" kan op de echte tabel nooit zakken -- en een toets die
     je niet hebt zien zakken is geen toets. Hier krijgt de meting een tabel
     die WEL kapot is, zodat de melder zelf bewijst dat hij kijkt. */
  const kapot = meet({
    talen: [{ code: 'nl', naam: 'Nederlands', en: 'Dutch' },
      { code: 'xx', naam: 'Xx', en: 'Xx' },
      { code: 'yy', naam: 'Yy', en: 'Yy' },
      { code: 'xx', naam: 'Xx', en: 'Xx' },
      { code: 'zz', naam: '', en: 'Zz' }],
    kern: ['school', 'les'],
    talenMetKern: ['xx', 'zz'],
    dictVan: (c) => c === 'xx' ? { school: '  ', les: 'les' } : (c === 'zz' ? { school: 'skool', les: 'lesson' } : null)
  });
  /* xx staat er twee keer in en wordt dus ook twee keer nagelopen -- dat is
     precies de schade die een dubbele taalcode aanricht, en daarom staat hij
     ook in `dubbel`. De dubbele meldingen zijn hier geen fout maar het bewijs. */
  assert.deepEqual(kapot.leeg, ['xx:school', 'xx:school'], 'een lege cel wordt niet gemeld');
  assert.deepEqual(kapot.onvolledig, ['xx (1 van 2)', 'xx (1 van 2)'], 'een halve rij wordt niet gemeld');
  assert.deepEqual(kapot.gelijkAanBron, ['xx:les', 'xx:les'], 'een cel gelijk aan het bronwoord wordt niet gemeld');
  assert.deepEqual(kapot.zonderRij, ['yy'], 'een doeltaal zonder rij wordt niet gemeld');
  assert.deepEqual(kapot.dubbel, ['xx'], 'een dubbele taalcode wordt niet gemeld');
  assert.deepEqual(kapot.zonderNaam, ['zz'], 'een taal zonder eigen naam wordt niet gemeld');
});

test('een cel gelijk aan het bronwoord mag, maar wordt geteld en opgesomd', () => {
  const m = meet();
  /* Dit is met opzet GEEN nul. Afrikaans "les", Duits "ja", Haitiaans "klas":
     soms is het woord echt hetzelfde. Verbieden zou de tabel laten liegen.
     Maar het aantal hoort bekend te zijn, met de cellen erbij, zodat niemand
     hoeft te raden of er een vergeten cel tussen zit. */
  assert.ok(Array.isArray(m.gelijkAanBron));
  assert.ok(m.gelijkAanBron.length > 0, 'geen enkele gelijke cel is verdacht: is de vergelijking stuk?');
  assert.ok(m.gelijkAanBron.every(x => /^[a-z-]{2,8}:[a-z]+$/.test(x)),
    'de opsomming zegt niet welke taal en welk woord');
  /* En ze blijven een kleine minderheid: loopt dit op, dan is er iets anders
     aan de hand dan toevallige gelijkenis tussen verwante talen. */
  const cellen = m.doeltalen * m.kernwoorden;
  assert.ok(m.gelijkAanBron.length < cellen * 0.05,
    'meer dan een twintigste van de tabel is gelijk aan het Nederlands: ' + m.gelijkAanBron.length + ' van ' + cellen);
});

test('de meting zegt zelf wat ze niet meet', () => {
  const m = meet();
  /* HET PUNT VAN DEZE TOETS. Een dekkingsgetal leest als een kwaliteitsgetal
     als er niets bij staat. 113 van 113 gevulde rijen zegt niets over of het
     Tigrinya klopt -- dat heeft niemand nagekeken. */
  assert.match(m.kwaliteit, /ongemeten/i, 'de meting doet alsof ze de kwaliteit kent');
  assert.match(m.kwaliteit, /beoordeelt geen taal|spreker/i);
  /* En de derde laag telt niet mee als dekking. */
  assert.match(m.buitenDeTerugval, /model/i);
  assert.match(m.buitenDeTerugval, /brontaal/i,
    'er staat niet wat er gebeurt als het model er niet is');
});

test('het getal in SCHOOL.md loopt niet uit de pas met de meting', () => {
  /* Zelfde reden als bij "201 van 201": een getal dat een mens moet bijwerken,
     loopt achter. Dit haalt het uit de meting. */
  const m = meet();
  const school = fs.readFileSync(path.join(__dirname, '..', 'SCHOOL.md'), 'utf8');
  const rij = school.split('\n').find(r => r.startsWith('| 114 talen'));
  assert.ok(rij, 'de belofte "114 talen" staat niet meer in SCHOOL.md');
  assert.ok(rij.includes(regel()),
    'SCHOOL.md loopt uit de pas met de meting.\nverwacht: ' + regel() + '\ngevonden: ' + rij.trim());
  /* En de rij hoort te zeggen dat de kwaliteit ongemeten is; anders leest een
     dekkingsgetal als een kwaliteitsgetal. */
  assert.match(rij, /kwaliteit ongemeten|ongemeten/i,
    'de rij noemt een dekkingsgetal zonder erbij te zeggen dat niemand de taal heeft nagekeken');
});
