/* Het alarm (kern/command/alarm.js): een SLO zonder alarm is een rapportcijfer
   achteraf, dus dit is de piep.

   WAT DEZE TOETS VOORAL BEWAAKT is dat het alarm op VERANDERING piept en niet
   elke ronde. Een melding die elke dertig seconden terugkomt, leert mensen om
   hem weg te klikken -- en dan is de volgende, echte melding ook weg. Dat is
   geen stijlkwestie: het is het verschil tussen een alarm dat werkt en een
   alarm dat er alleen staat.

   En het tweede: een controle die zelf omvalt mag niet STIL zijn. Een alarm dat
   niets meldt omdat de laag eronder een fout gooide, is stil op precies het
   verkeerde moment.

   MUTATIES die zijn gedraaid en welke toets erop zakte (LAT.md regel 2):
   - elke ronde melden in plaats van alleen bij verandering
     -> "een lopend alarm piept niet elke ronde opnieuw" ZAKT (RAAK)
   - de try/catch om een controle heen weglaten
     -> "een controle die omvalt is een melding en geen stilte" ZAKT (RAAK)
   - stilzetten ook het journaal laten overslaan
     -> "stilzetten dempt het sein maar niet het spoor" ZAKT (RAAK)

   Draai: npm test */
const test = require('node:test');
const assert = require('node:assert/strict');

const { maakAlarm } = require('../server/kern/command/alarm');
const maakCmdOpslag = require('../server/kern/command/opslag');

function maak(opties) {
  const o = opties || {};
  const db = { data: {} };
  const regels = [];
  const seinen = [];
  const alarm = maakAlarm({
    db, opslag: maakCmdOpslag({ db }), save: () => {},
    journaal: {
      noteer: r => regels.push(r),
      controleer: () => (o.ketenStuk ? { heel: false, bij: 'r1', waarom: 'de regel is gewijzigd' } : { heel: true })
    },
    slo: { stand: () => o.slo || { doelen: [] } },
    sonde: {
      buitenkort: () => o.buiten || { gemeten: true, mislukt: 0 },
      stand: () => o.sondestand || { buiten: { pogingen: 10, mislukt: 0 } }
    },
    canary: { lopende: () => o.canaries || [] },
    kwaliteit: { meet: () => ({ tel: { defecten: o.defecten || 0, soorten: 1 } }) },
    norm: () => ({ alarmen: { budgetRestDeel: 0.25, defectenDrempel: 25, buitenStilUren: 24, stilteMaxUren: 72 } }),
    sein: (ev, d) => seinen.push(d)
  });
  return { db, alarm, regels, seinen };
}

const RUSTIG = { slo: { doelen: [] }, buiten: { gemeten: true }, sondestand: { buiten: { pogingen: 5, mislukt: 0 } } };

test('zonder bevindingen is er geen alarm', () => {
  const { alarm, regels, seinen } = maak(RUSTIG);
  const st = alarm.stand();
  assert.equal(st.tel.actief, 0);
  assert.deepEqual(regels, [], 'en er wordt niets gemeld');
  assert.deepEqual(seinen, []);
});

test('een gezakt servicedoel gaat af, met de naam erbij', () => {
  const { alarm, regels, seinen } = maak(Object.assign({}, RUSTIG, {
    slo: { doelen: [{ id: 'inloggen', naam: 'Inloggen', genoeg: true, oordeel: 'niet gehaald' },
      { id: 'betalen', naam: 'Betalen', genoeg: false, oordeel: 'onvoldoende gemeten' }] }
  }));
  const st = alarm.stand();
  const a = st.alarmen.find(x => x.id === 'doel-gezakt');
  assert.ok(a && a.actief);
  assert.equal(a.ernst, 'hoog');
  assert.match(a.wat, /Inloggen/);
  assert.ok(!/Betalen/.test(a.wat), 'een onvoldoende gemeten doel is geen alarm');
  assert.ok(regels.some(r => r.actie === 'alarm aan'), 'het staat in het journaal');
  assert.equal(seinen.length, 1, 'en er gaat een sein naar het bord');
});

test('een lopend alarm piept niet elke ronde opnieuw', () => {
  /* DE KERN. Een melding die elke ronde terugkomt, leert mensen om hem weg te
     klikken -- en dan is de volgende, echte melding ook weg. */
  const { alarm, regels, seinen } = maak(Object.assign({}, RUSTIG, { ketenStuk: true }));
  alarm.weeg();
  assert.equal(regels.filter(r => r.actie === 'alarm aan').length, 1);
  alarm.weeg(); alarm.weeg(); alarm.weeg();
  assert.equal(regels.filter(r => r.actie === 'alarm aan').length, 1, 'nog steeds één melding');
  assert.equal(seinen.length, 1);
});

test('een opgelost alarm meldt zich af', () => {
  const db = { data: {} };
  const regels = [], seinen = [];
  let stuk = true;
  const alarm = maakAlarm({
    db, opslag: maakCmdOpslag({ db }), save: () => {},
    journaal: { noteer: r => regels.push(r), controleer: () => (stuk ? { heel: false, bij: 'r1' } : { heel: true }) },
    slo: { stand: () => ({ doelen: [] }) },
    sonde: { buitenkort: () => ({ gemeten: true }), stand: () => ({ buiten: { pogingen: 1, mislukt: 0 } }) },
    canary: { lopende: () => [] }, kwaliteit: { meet: () => ({ tel: { defecten: 0, soorten: 0 } }) },
    norm: () => ({}), sein: (ev, d) => seinen.push(d)
  });
  alarm.weeg();
  stuk = false;
  const r = alarm.weeg();
  assert.deepEqual(r.opgelost.map(a => a.id), ['journaal-gebroken']);
  assert.ok(regels.some(x => x.actie === 'alarm af'));
  assert.equal(seinen.filter(s => s.richting === 'af').length, 1);

  /* En daarna blijft het stil: opgelost is opgelost. */
  alarm.weeg();
  assert.equal(regels.filter(x => x.actie === 'alarm af').length, 1);
});

test('een controle die omvalt is een melding en geen stilte', () => {
  const { alarm } = maak(RUSTIG);
  const kapot = maakAlarm({
    opslag: maakCmdOpslag({ db: { data: {} } }), save: () => {},
    journaal: { noteer: () => {}, controleer: () => { throw new Error('de keten is onleesbaar'); } },
    slo: { stand: () => ({ doelen: [] }) },
    sonde: { buitenkort: () => ({ gemeten: true }), stand: () => ({ buiten: { pogingen: 1, mislukt: 0 } }) },
    canary: { lopende: () => [] }, kwaliteit: { meet: () => ({ tel: { defecten: 0, soorten: 0 } }) },
    norm: () => ({}), sein: () => {}
  });
  const a = kapot.controles().find(x => x.id === 'journaal-gebroken');
  assert.ok(a, 'de omgevallen controle levert een bevinding op in plaats van niets');
  assert.match(a.wat, /kon niet draaien/);
  void alarm;
});

test('stilzetten dempt het sein maar niet het spoor', () => {
  const { alarm, regels, seinen } = maak(Object.assign({}, RUSTIG, { ketenStuk: true }));
  alarm.weeg();
  const voorRegels = regels.length, voorSeinen = seinen.length;

  const s = alarm.stilzetten('journaal-gebroken', 8, 'ik', 'we weten het, herstel loopt');
  assert.ok(s.tot, 'er staat een einde aan');
  assert.ok(regels.some(r => r.actie === 'alarm stilgezet' && /herstel loopt/.test(r.reden)),
    'stilzetten staat zelf ook in het spoor, met de reden');

  /* Het alarm opnieuw laten ontstaan terwijl het stil staat: wel noteren, niet
     seinen. Stilte hoort in het spoor te staan, anders is er achteraf niet te
     zien dat iemand het heeft weggeklikt. */
  const staat = alarm.stand().alarmen.find(a => a.id === 'journaal-gebroken');
  staat.actief = false;                       // doen alsof hij weg was en terugkomt
  alarm.weeg();
  assert.equal(regels.filter(r => r.actie === 'alarm aan').length, 2,
    'de nieuwe aanmelding staat WEL in het journaal, met "(stilgezet)" erbij');
  assert.ok(regels.some(r => r.actie === 'alarm aan' && /stilgezet/.test(r.reden)));
  assert.equal(seinen.length, voorSeinen, 'en er is niet geseind zolang hij stil staat');
  void voorRegels;
});

test('stilzetten kent een maximum en een onbekend alarm bestaat niet', () => {
  const { alarm } = maak(Object.assign({}, RUSTIG, { ketenStuk: true }));
  alarm.weeg();
  const s = alarm.stilzetten('journaal-gebroken', 9999, 'ik', 'lang');
  const uren = (Date.parse(s.tot) - Date.now()) / 3600000;
  assert.ok(uren <= s.max + 0.1, 'een alarm kan niet voor onbepaalde tijd stil: ' + uren);
  assert.equal(alarm.stilzetten('bestaatniet', 4, 'ik').status, 404);
});

test('de uitslag zegt welke uitgangen er zijn en welke niet', () => {
  const { alarm } = maak(RUSTIG);
  const st = alarm.stand();
  assert.ok(st.uitgangen.length >= 2);
  assert.match(st.let, /geen mail en geen telefoonmelding/);
  assert.match(st.let, /piept op verandering/);
});
