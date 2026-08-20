/* ============================================================================
   HET VOORSTEL -- welke trede past bij deze zaak, en wie verplaatst haar?

   HET GAT DAT DIT DICHT. kern/commercie/zaakabonnement.js laat elke zaak van
   voor de ladder terugvallen op `business`, met `herkomst: 'voor-de-ladder'`. Dat
   was de juiste keuze -- een migratie die rechten intrekt is een storing met een
   nette naam -- maar het is een TERUGVAL en geen besluit, en zonder iets dat ze
   voorstelt staan die zaken er over een jaar nog.

   DE BEWERINGEN DIE ERTOE DOEN:

     toets 1   er wordt NIETS automatisch verplaatst
     toets 3   geen bewijs is geen voorstel -- "niets gebruikt" is niet hetzelfde
               als "de goedkoopste trede volstaat"
     toets 4   NIET-GEMETEN is al helemaal niet niet-nodig: een nul waar niemand
               naar heeft gekeken, mag geen onderdeel intrekken
     toets 6   een voorstel zegt wat het afpakt

   Draai los: node --experimental-sqlite --test test/voorstel.test.js
   ========================================================================== */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

const { maakVoorstellen, DREMPEL } = require('../server/kern/commercie/voorstel');
const caps = require('../server/kern/commercie/capaciteiten');
const { TERUGVAL } = require('../server/kern/commercie/zaakabonnement');

const ALLES = Object.keys(caps.CAPS);
const KLEIN = caps.tredenMet('can_be_partner').find(t => t !== TERUGVAL);

function opstelling({ herkomst = 'voor-de-ladder', pas = TERUGVAL } = {}) {
  const gezet = [];
  const zaakAbonnement = {
    van: (c) => ({ code: String(c).toUpperCase(), pas, herkomst, sinds: null, contractId: null }),
    zet: (c, p, door) => { gezet.push({ c, p, door }); return { status: 200, ok: true, code: c, pas: p }; }
  };
  return { V: maakVoorstellen({ zaakAbonnement }), gezet };
}

/* DE BEWERING. Een zaak die op maandagochtend haar kassa kwijt is omdat een
   algoritme vond dat ze hem niet gebruikte, is precies de storing die de
   terugval moest voorkomen. */
test('1. er wordt niets automatisch verplaatst', () => {
  const { V, gezet } = opstelling();
  V.stel('A', { can_use_pos: 40, can_manage_staff: 9 }, ALLES);
  V.lijst([{ code: 'A', gebruik: { can_use_pos: 40 }, gemeten: ALLES }]);
  assert.equal(gezet.length, 0, 'voorstellen en lijsten raken de trede niet aan');

  // en de bron bevat geen enkel pad naar zet() buiten bevestig()
  const bron = require('fs').readFileSync(
    require('path').join(__dirname, '..', 'server', 'kern', 'commercie', 'voorstel.js'), 'utf8');
  const code = bron.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  assert.equal((code.match(/zaakAbonnement\.zet\s*\(/g) || []).length, 1,
    'precies een plek waar een trede verandert, en dat is bevestig()');
});

test('2. bevestigen vraagt een naam en tekent alleen voor wat er op tafel lag', () => {
  const { V, gezet } = opstelling();
  const gebruik = { can_use_pos: 40, can_manage_staff: 9 };

  assert.match(V.bevestig('A', KLEIN, '', gebruik, ALLES).error, /Wie bevestigt/);
  assert.match(V.bevestig('A', TERUGVAL, 'ik', gebruik, ALLES).error, /is geen bevestiging/,
    'tekenen voor iets anders dan wat er op tafel lag, is geen bevestiging');
  assert.equal(gezet.length, 0);

  const ok = V.bevestig('A', KLEIN, 'kantoor', gebruik, ALLES);
  assert.equal(ok.ok, true);
  assert.deepEqual(gezet, [{ c: 'A', p: KLEIN, door: 'kantoor' }]);
});

/* DE TWEEDE BEWERING. */
test('3. geen bewijs is geen voorstel', () => {
  const { V } = opstelling();
  const leeg = V.stel('A', {}, ALLES);
  assert.equal(leeg.voorstel, null);
  assert.equal(leeg.zeker, 'geen');
  assert.match(leeg.waarom, /Te weinig te zien/);
  assert.match(leeg.waarom, /niet hetzelfde als/);

  assert.match(V.bevestig('A', KLEIN, 'ik', {}, ALLES).error, /geen voorstel/,
    'en dan valt er ook niets te bevestigen');
});

/* DE DERDE BEWERING, en dit is de valkuil waar deze module bijna in liep. Een
   nul uit "niet gemeten" ziet er precies zo uit als een nul uit "niet gebruikt". */
test('4. wat niet gemeten is, telt als nodig en wordt niet ingetrokken', () => {
  const { V } = opstelling();
  const gebruik = { can_use_pos: 40, can_manage_staff: 9 };

  // alles gemeten: de kleinere trede mag worden voorgesteld
  assert.equal(V.stel('A', gebruik, ALLES).voorstel, KLEIN);

  // maar als er naar governance nooit is gekeken, blijft de zaak waar ze staat
  const deels = ['can_use_pos', 'can_manage_staff', 'can_use_workos'];
  const r = V.stel('A', gebruik, deels);
  assert.equal(r.voorstel, TERUGVAL, 'conservatief: liever geen verlaging dan een op blinde nullen');
  assert.ok(r.ongemeten.includes('can_use_enterprise_governance'));
  assert.match(r.waarom, /niet gekeken/);

  // een ontbrekende lijst betekent NIETS gemeten, niet alles
  const zonder = V.stel('A', gebruik);
  assert.equal(zonder.voorstel, TERUGVAL);
  assert.ok(zonder.ongemeten.length > 0);
});

test('5. de drempel scheidt bedrijfsvoering van een proefrij, en een proefrij verdwijnt niet', () => {
  const { V } = opstelling();
  const stevig = V.stel('A', { can_use_pos: DREMPEL, can_manage_staff: DREMPEL }, ALLES);
  assert.equal(stevig.zeker, 'stevig');
  assert.deepEqual(stevig.aanwijzingen, []);

  const twijfel = V.stel('B', { can_use_pos: 40, can_manage_staff: 9, can_use_enterprise_governance: 1 }, ALLES);
  assert.equal(twijfel.zeker, 'twijfel', 'een enkele governance-rij maakt dit geen stevige zaak');
  assert.deepEqual(twijfel.aanwijzingen, ['can_use_enterprise_governance']);
  assert.match(twijfel.waarom, /weinig voor maar is niet nul/,
    'een aanwijzing verdwijnt niet stil onder de drempel');
  assert.equal(twijfel.voorstel, KLEIN, 'het voorstel komt er wel; de mens beslist met dit erbij');

  assert.equal(V.stel('C', { can_use_pos: 40 }, ALLES).zeker, 'mager', 'een enkel signaal is mager');
});

/* DE VIERDE BEWERING. Wie tekent, hoort te weten wat hij intrekt. */
test('6. een voorstel zegt met naam wat het afpakt', () => {
  const { V } = opstelling();
  const r = V.stel('A', { can_use_pos: 40, can_manage_staff: 9 }, ALLES);
  assert.ok(r.verliest.length, 'een lagere trede haalt onderdelen weg');
  for (const c of r.verliest) {
    assert.equal(caps.mag(TERUGVAL, c), true, c + ' hoort bij de huidige trede');
    assert.equal(caps.mag(r.voorstel, c), false, c + ' hoort niet bij de voorgestelde');
  }
  assert.match(r.waarom, /Dit haalt/);
});

test('7. een zaak met een vastgelegd abonnement krijgt geen voorstel', () => {
  const { V } = opstelling({ herkomst: 'vastgelegd' });
  const r = V.stel('A', { can_use_pos: 40 }, ALLES);
  assert.equal(r.voorstel, null);
  assert.match(r.waarom, /draagt al een vastgelegd abonnement/);
});

test('8. past de zaak op de trede waar ze al staat, dan is het voorstel: leg het vast', () => {
  const { V } = opstelling();
  const zwaar = {};
  for (const c of caps.capsVan(TERUGVAL)) zwaar[c] = 20;
  const r = V.stel('A', zwaar, ALLES);
  assert.equal(r.voorstel, TERUGVAL);
  assert.deepEqual(r.verliest, []);
  assert.match(r.waarom, /vast te leggen in plaats van te blijven terugvallen/);
});

test('9. de lijst telt wat er ligt EN wat er niet ligt', () => {
  const { V } = opstelling();
  const l = V.lijst([
    { code: 'A', gebruik: { can_use_pos: 40, can_manage_staff: 9 }, gemeten: ALLES },
    { code: 'B', gebruik: {}, gemeten: ALLES },
    { code: 'C', gebruik: {}, gemeten: ALLES }
  ]);
  assert.equal(l.aantal, 3);
  assert.equal(l.metVoorstel, 1);
  assert.equal(l.zonderGegevens, 2,
    'dat tweede getal hoort net zo zichtbaar te zijn: het is de werkvoorraad die niemand vanzelf oppakt');
  assert.equal(l.voorstellen.length, 1);
  assert.equal(l.zonder.length, 2);
});
