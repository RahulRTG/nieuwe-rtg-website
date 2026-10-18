/* DE WACHT: HET ALARM VAN COMMAND (kern/command/alarm.js, alarm-uitgang.js en
   alarm-aanvullend.js) als zijn eigen onderdelen omvallen.

   Een alarm is pas iets waard op het moment dat er iets kapot is, en juist dan
   is de kans het grootst dat ook de laag eronder, het journaal of de uitgang
   naar buiten hapert. Deze toets zet elk van die onderdelen om de beurt plat en
   kijkt of het alarm toch afgaat en of het stilzetten begrensd blijft.

   Wat hier niet mag sneuvelen:
   1. een controle die zelf een fout gooit (een kapot journaal) wordt een
      bevinding "kon niet draaien" en geen stilte;
   2. een journaalstoring of een omvallend kantoorbord dempt de melding naar
      buiten niet; een omvallende melder dempt het journaal niet;
   3. stilzetten heeft een einde: minimaal één uur, maximaal de norm, en een
      reden in het journaal; een stilgezet alarm gaat niet naar buiten;
   4. een uitgang die zijn onafhankelijkheid niet bewijst, draagt altijd een
      reden (onbekend is geen groen); geen melder of een melder die bij het
      ophalen omvalt is "niets naar buiten";
   5. de drempels uit de norm tellen: een foutbudget onder de grens, een
      sonde die buiten mislukt, een automatische terugrol en verouderd
      capabilitybewijs worden alarmen; een opgebruikt budget, een handmatige
      terugrol of een verouderde capability zonder metingen niet.

   MUTATIES die zijn gedraaid en welke toets erop zakte (LAT.md regel 2):
   - in alarm-uitgang meld() de try/catch om journaal.noteer weggehaald
     -> "2. een journaalstoring dempt de melding niet" ZAKT (RAAK)
   - in stilzetten() `Math.min(..., d.stilteMaxUren)` weggehaald
     -> "3. stilzetten heeft een einde" ZAKT (RAAK)
   - in alarm-uitgang buitenStand() de reden-terugval vervangen door `null`
     -> "4. onbekend is geen groen" ZAKT (RAAK)

   Draai: node --test test/alarm-weerbaar.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { maakAlarm } = require('../server/kern/command/alarm');
const maakCmdOpslag = require('../server/kern/command/opslag');

const aw = require('../server/lib/auditwacht');
const echteBevinding = aw.bevinding;
test.before(() => { aw.bevinding = () => null; });
test.after(() => { aw.bevinding = echteBevinding; });

function maak(o) {
  o = o || {};
  const regels = [], seinen = [], buiten = [];
  const melder = o.melder !== undefined ? o.melder : { actief: true, stand: () => ({ onafhankelijk: true }),
    melden: (e, ctx) => buiten.push({ bericht: e.message, ctx }) };
  const alarm = maakAlarm({
    opslag: maakCmdOpslag({ db: { data: {} } }), save: () => {},
    journaal: { noteer: r => { if (o.journaalKapot) throw new Error('schijf vol'); regels.push(r); },
      controleer: o.controleer || (() => ({ heel: true })) },
    slo: { stand: () => ({ doelen: o.doelen || [], capabilities: o.capabilities || [] }) },
    sonde: { buitenkort: () => ({ gemeten: true }), stand: () => ({ buiten: o.buiten || { pogingen: 10, mislukt: 0 } }) },
    canary: o.canary === undefined ? { lopende: () => [] } : o.canary,
    kwaliteit: { meet: () => ({ tel: { defecten: 0, soorten: 0 } }) },
    norm: o.norm !== undefined ? o.norm : () => ({ alarmen: {} }),
    sein: (ev, d) => { if (o.seinKapot) throw new Error('bord weg'); seinen.push(d); },
    foutmelder: typeof o.melder === 'function' ? o.melder : () => melder
  });
  return { alarm, regels, seinen, buiten };
}
const ids = (r) => r.nieuw.map(a => a.id).sort();

test('1. een controle die zelf omvalt wordt een bevinding en geen stilte', () => {
  const m = maak({ controleer: () => { throw new Error('keten onleesbaar'); } });
  const c = m.alarm.controles().find(x => x.id === 'journaal-gebroken');
  assert.equal(c.ernst, 'midden');
  assert.match(c.wat, /kon niet draaien: keten onleesbaar/);
});

test('2. een journaalstoring of omvallend bord dempt de melding naar buiten niet', () => {
  const m = maak({ journaalKapot: true, seinKapot: true, controleer: () => ({ heel: false, bij: 7 }) });
  const r = m.alarm.weeg();
  assert.deepEqual(ids(r), ['journaal-gebroken']);
  assert.equal(m.buiten.length, 1, 'de melding gaat toch naar buiten');
  assert.equal(m.buiten[0].bericht, 'ALARM HOOG: De hashketen van het journaal klopt niet -- de keten is gebroken (bij 7)');
  assert.equal(m.buiten[0].ctx.richting, 'aan');

  const k = maak({ controleer: () => ({ heel: false, bij: 1 }),
    melder: { actief: true, stand: () => ({ onafhankelijk: true }), melden: () => { throw new Error('webhook weg'); } } });
  k.alarm.weeg();
  assert.equal(k.regels.filter(x => x.actie === 'alarm aan').length, 1, 'een kapotte melder dempt het journaal niet');
  assert.equal(k.seinen.length, 1);
});

test('3. stilzetten heeft een einde, een reden, en houdt de melding binnen', () => {
  let heel = false;
  const m = maak({ controleer: () => ({ heel, bij: 2 }) });
  m.alarm.weeg();
  assert.equal(m.alarm.stilzetten('bestaat-niet', 4, 'ops').status, 404);
  const t0 = Date.now();
  const lang = m.alarm.stilzetten('journaal-gebroken', 1000, 'ops');
  assert.equal(lang.max, 72);
  assert.ok(Math.abs(Date.parse(lang.tot) - t0 - 72 * 3600000) < 5000, 'nooit langer dan de norm');
  assert.equal(m.regels[m.regels.length - 1].reden, '72 uur: geen reden opgegeven');
  const kort = m.alarm.stilzetten('journaal-gebroken', -5, 'ops', 'onderhoud');
  assert.ok(Math.abs(Date.parse(kort.tot) - t0 - 3600000) < 5000, 'minimaal een uur');
  const std = m.alarm.stilzetten('journaal-gebroken', 0, 'ops', 'nacht');
  assert.ok(Math.abs(Date.parse(std.tot) - t0 - 8 * 3600000) < 5000, 'zonder uren: acht');
  assert.equal(m.regels[m.regels.length - 1].niveau, 'hand');
  const voor = m.buiten.length;
  heel = true;
  const s = m.alarm.stand();
  assert.deepEqual(s.zojuist.opgelost, ['journaal-gebroken']);
  assert.equal(m.buiten.length, voor, 'stilgezet: het herstel gaat niet de deur uit');
  assert.match(m.regels[m.regels.length - 1].reden, /\(stilgezet\)$/);
});

test('4. onbekend is geen groen: de uitgang zegt waarom er niets naar buiten gaat', () => {
  const geen = maak({ melder: () => { throw new Error('kern nog niet klaar'); } });
  assert.match(geen.alarm.buitenStand().reden, /geen foutmelder aangesloten/);
  const s = geen.alarm.stand();
  assert.equal(s.uitgangen.length, 2, 'geen beloofd kanaal dat er niet is');
  assert.match(s.geenUitgang, /geen foutmelder/);
  const uit = maak({ melder: { actief: false } });
  assert.match(uit.alarm.buitenStand().reden, /ERR_WEBHOOK_URL is niet gezet/);
  const stom = maak({ melder: { actief: true, melden: () => {} } });
  const b = stom.alarm.buitenStand();
  assert.equal(b.onafhankelijk, null);
  assert.match(b.reden, /onbewezen bewaking telt niet/);
  assert.match(stom.alarm.stand().uitgangen[2], /^een webhook zonder bewijs/);
  const zelf = maak({ melder: { actief: true, stand: () => ({ onafhankelijk: false }), melden: () => {} } });
  assert.match(zelf.alarm.stand().uitgangen[2], /^storingenontvangst op dezelfde app/);
  const echt = maak();
  const e = echt.alarm.stand();
  assert.equal(e.geenUitgang, null);
  assert.match(e.uitgangen[2], /externe webhook/);
});

test('5. de drempels tellen: budget, sonde, terugrol en verouderd bewijs', () => {
  const doelen = [
    { naam: 'betalen', genoeg: true, oordeel: 'gehaald', budget: { op: false, restDeel: 0.1 } },
    { naam: 'zoeken', genoeg: true, oordeel: 'gehaald', budget: { op: true, restDeel: 0 } },
    { naam: 'inlog', genoeg: true, oordeel: 'gehaald', budget: { op: false, restDeel: 0.9 } }];
  const m = maak({ doelen, norm: { alarmen: { budgetRestDeel: 0.2 } }, buiten: { pogingen: 12, mislukt: 3 },
    canary: { lopende: () => [{ naam: 'v2', stand: 'teruggerold', automatisch: true },
      { naam: 'v3', stand: 'teruggerold', automatisch: false }] },
    capabilities: [{ capability: 'boeken', reasons: ['STALE_MEASUREMENTS'], availability: { eligible: 4 } },
      { capability: 'leeg', reasons: ['STALE_MEASUREMENTS'], availability: { eligible: 0 } }, { capability: 'kaal' }] });
  const s = m.alarm.stand();
  const wat = Object.fromEntries(s.alarmen.map(a => [a.id, a.wat]));
  assert.equal(wat['budget-bijna-op'], 'betalen (10% over)');
  assert.equal(wat['sonde-storing'], '3 van 12 externe metingen mislukten in 24 uur');
  assert.equal(wat['canary-teruggerold'], 'v2 ging over de terugroldrempel');
  assert.equal(wat['capability-verouderd'], 'boeken heeft geen verse meting');
  assert.equal(s.alarmen[0].ernst, 'hoog', 'het zwaarste staat bovenaan');
  assert.equal(s.drempels.budgetRestDeel, 0.2);
  assert.equal(s.tel.hoog, 1);

  const rustig = maak({ norm: null, canary: null, buiten: { pogingen: 0, mislukt: 0 } });
  assert.deepEqual(rustig.alarm.controles(), [], 'zonder canary, zonder pogingen en zonder norm: niets');
  assert.equal(rustig.alarm.stand().drempels.budgetRestDeel, 0.25);
});
