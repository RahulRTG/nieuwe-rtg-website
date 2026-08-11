/* DE WETTEN HEBBEN GROND ONDER HUN VOETEN -- of ze zakken.

   INVARIANTS.json zegt wat dit huis altijd belooft. Zo'n register is precies zo
   veel waard als de controle erop: een wet die naar een verdwenen handhaver
   wijst, is gevaarlijker dan geen wet, want hij leest als bescherming. Deze
   toets is dat hek.

   Wat hier bewaakt wordt:
     1. het register is leesbaar en elke wet is volledig ingevuld
     2. geen enkele wet is GEBROKEN (wijst naar een bestand of toets die weg is)
     3. id's zijn uniek en worden nooit hergebruikt
     4. WETTEN.md loopt niet achter op het register
     5. de motor zelf slaat uit op bekend-foute invoer (LAT.md regel 10)

   Punt 5 is de belangrijkste, en de mutatieproef liet precies zien waarom.

   PUNT 2 IS EEN TANDELOZE BEWERING IN ZIJN EENTJE (LAT.md regel 9). Hij eist een
   LEGE lijst gebroken wetten. Zet je de GEBROKEN-detectie in keurWet uit, dan
   wordt die lijst leeg en wordt punt 2 dus GROENER in plaats van rood -- gemeten,
   niet vermoed: die mutatie liet 5 van de 6 toetsen slagen. Een register-hek dat
   alleen uit punt 2 bestaat, bewaakt dus niets zodra de motor stuk is. Punt 5 is
   wat dat gat dicht: die voert de motor vijf verzonnen werelden waarvan we de
   uitkomst kennen en valt wel om. De twee horen bij elkaar; punt 2 alleen zou
   schijnzekerheid zijn.

   Gemuteerd en zien zakken (drie keer, elk teruggedraaid):
     keurWet() nooit GEBROKEN laten teruggeven  -> punt 5 rood (punt 2 blijft groen)
     bouw() een lege string laten teruggeven    -> punt 4 rood
     een dubbel id in het register              -> punt 3 en punt 4 rood
   Draai los: node --test test/wetten.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const { keur, keurWet, bouw, leesRegister, DOEL } = require('../scripts/wetten.js');

const register = leesRegister();

test('het register is leesbaar en elke wet is volledig ingevuld', () => {
  assert.ok(register.wetten.length >= 30, 'een register met minder dan dertig wetten dekt dit huis niet');
  for (const w of register.wetten) {
    assert.match(w.id || '', /^RTG-\d{3}$/, 'elke wet heeft een id in de vorm RTG-nnn');
    assert.ok((w.wet || '').length > 15, w.id + ' heeft geen leesbare wet-zin');
    assert.ok((w.waarom || '').length > 30, w.id + ' zegt niet waar hij vandaan komt');
    assert.ok(Array.isArray(w.handhaver), w.id + ' heeft geen handhaver-lijst');
    assert.ok(Array.isArray(w.toetsen), w.id + ' heeft geen toetsen-lijst');
  }
});

test('geen enkele wet wijst naar iets dat niet bestaat', () => {
  const uitslag = keur(register);
  const stuk = uitslag.wetten.filter(w => w.stand === 'GEBROKEN');
  assert.deepEqual(stuk.map(w => w.id + ' -> ' + w.gebroken.join(', ')), [],
    'een wet die naar een verdwenen bestand wijst leest als bescherming en is er geen');
});

test('id\'s zijn uniek: een hergebruikt nummer maakt de geschiedenis onleesbaar', () => {
  const gezien = new Set();
  for (const w of register.wetten) {
    assert.equal(gezien.has(w.id), false, w.id + ' komt twee keer voor');
    gezien.add(w.id);
  }
});

test('WETTEN.md loopt niet achter op het register', () => {
  const opSchijf = fs.existsSync(DOEL) ? fs.readFileSync(DOEL, 'utf8') : null;
  assert.notEqual(opSchijf, null, 'WETTEN.md bestaat niet; draai node scripts/wetten.js');
  assert.equal(opSchijf, bouw(keur(register)),
    'WETTEN.md loopt achter op INVARIANTS.json; draai node scripts/wetten.js');
});

/* DE IJKING VAN DE MOTOR ZELF -- LAT.md regel 10.

   Vijf verzonnen werelden waarvan we de juiste uitkomst kennen. Ziet de motor er
   een verkeerd, dan is het instrument stuk en niet de code, en dan hoort dat
   hier rood te worden en niet in een rapport te verdwijnen. */
test('de wettenmotor slaat uit op bekend-foute invoer', () => {
  const bestaat = p => ['server/echt.js', 'test/echt.test.js', 'test/slap.test.js'].includes(p);
  const gemeten = { 'echt.test.js': { staat: 'gezakt' }, 'slap.test.js': { staat: 'overleefd' } };
  const proef = (wet) => keurWet(wet, bestaat, gemeten).stand;

  assert.equal(proef({ handhaver: ['server/weg.js'], toetsen: ['echt.test.js'] }), 'GEBROKEN',
    'een verdwenen handhaver moet GEBROKEN geven');
  assert.equal(proef({ handhaver: ['server/echt.js'], toetsen: ['weg.test.js'] }), 'GEBROKEN',
    'een verdwenen toets moet GEBROKEN geven');
  assert.equal(proef({ handhaver: ['server/echt.js'], toetsen: ['slap.test.js'] }), 'ONBEPROEFD',
    'een toets die nooit op een mutatie zakte, bewijst de wet niet');
  assert.equal(proef({ handhaver: [], toetsen: ['echt.test.js'] }), 'OPEN',
    'een wet zonder handhaver is een voornemen, geen bescherming');
  assert.equal(proef({ handhaver: ['server/echt.js'], toetsen: ['echt.test.js'] }), 'BEWEZEN',
    'een volledige wet met een bewezen gevoelige toets heet BEWEZEN');
});

test('zonder mutatiemeting deelt de motor geen enkele BEWEZEN uit', () => {
  const uitslag = keur(register, { gemeten: null });
  assert.equal(uitslag.telling.BEWEZEN, 0,
    'ontbreekt MUTATIES.json, dan is er niets gemeten en hoort niets BEWEZEN te heten');
  assert.equal(uitslag.gemetenBeschikbaar, false, 'en dat staat er ook bij, in plaats van stil te doen alsof');
});
