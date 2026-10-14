/* DE ALARMSTORM (WEERBAARHEID.md par. 9c en 9e, "alarmstorm-bestendig").

   Vóór de stille-sensordetectie actief mag (RTG_SENSORSTILTE_ACTIEF=1), moet
   bewezen zijn dat hij geen storm kan veroorzaken. Een storm is erger dan
   stilte: een piket die honderd keer per nacht hetzelfde krijgt, klikt de
   honderdeerste weg -- en dat is dan de echte. Deze toets zet het ECHTE alarm
   (kern/command/alarm.js) op de ECHTE stille sensor en telt wat er naar buiten
   gaat: de journaalregels, de seinen naar het kantoorbord en de meldingen via
   de externe uitgang.

   Wat hier niet mag sneuvelen:
   1. een stilte die honderd rondes aanhoudt, geeft EEN melding en geen honderd;
   2. alles tegelijk stil (vier tikkers, het schild, de noodrem, verloren
      meldingen) is EEN alarm met alle namen erin, geen zeven;
   3. tienduizend verloren meldingen zijn nog steeds een alarm en een teller, en
      het geheugen groeit niet mee;
   4. herstel is pas herstel na een nieuwe GESLAAGDE ronde: een ronde die
      omvalt, of de klok die doorloopt, is geen herstel. Dan EEN afmelding;
   5. een sensor die heen en weer springt, geeft per weging hooguit een
      overgang: het tempo van de storm is begrensd door de weging en niet door
      de sensor;
   6. een omvallende externe uitgang dempt het alarm niet en laat de weging
      niet vallen;
   7. in de schaduw gaat er niets de deur uit, hoe groot de stilte ook is.

   MUTATIES die zijn gedraaid en welke toets erop zakte (LAT.md regel 2):
   - in alarm.weeg `if (oud && oud.actief)` vervangen door `if (false)`
     -> "1. een aanhoudende stilte" t/m "4. herstel" ZAKKEN alle vier (RAAK)
   - in sensorstilte-koppelingen het volgnummer terugzetten naar Date.now()
     (met `>=`, de oude vergelijking)
     -> "4b. een verlies in dezelfde tik" ZAKT (RAAK). Alleen `>` naar `>=`
     is met het volgnummer een gelijkwaardige mutant: twee tellerstanden
     vallen nooit gelijk, en dat is precies de bedoeling.

   Draai: node --test test/alarmstorm.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

const { maakAlarm } = require('../server/kern/command/alarm');
const maakCmdOpslag = require('../server/kern/command/opslag');
const stilte = require('../server/kern/command/sensorstilte');

function metKlok(t0) {
  const echt = Date.now;
  let nu = t0;
  Date.now = () => nu;
  return { zet: (ms) => { nu = t0 + ms; }, verder: (ms) => { nu += ms; }, terug: () => { Date.now = echt; } };
}

/* Het echte alarm, met elke andere controle rustig. Wat er naar buiten gaat,
   wordt per kanaal geteld. */
function maak(opties) {
  const o = opties || {};
  const db = { data: {} };
  const regels = [], seinen = [], buiten = [];
  const melder = { actief: true, stand: () => ({ onafhankelijk: true, beperking: null }),
    melden: (e, ctx) => { if (o.melderKapot) throw new Error('de meldingsdienst ligt plat'); buiten.push({ bericht: e.message, ctx }); } };
  const alarm = maakAlarm({
    foutmelder: () => melder, db, opslag: maakCmdOpslag({ db }), save: () => {},
    journaal: { noteer: r => regels.push(r), controleer: () => ({ heel: true }) },
    slo: { stand: () => ({ doelen: [] }) },
    sonde: { buitenkort: () => ({ gemeten: true, mislukt: 0 }), stand: () => ({ buiten: { pogingen: 10, mislukt: 0 } }) },
    canary: { lopende: () => [] },
    kwaliteit: { meet: () => ({ tel: { defecten: 0, soorten: 0 } }) },
    norm: () => ({ alarmen: {} }),
    sein: (ev, d) => seinen.push(d)
  });
  const vanSensor = (lijst, sleutel) => lijst.filter(x => (sleutel(x) || '') === 'sensor-stil');
  return {
    alarm,
    aan: () => vanSensor(regels, r => r.objectId).filter(r => r.actie === 'alarm aan').length,
    af: () => vanSensor(regels, r => r.objectId).filter(r => r.actie === 'alarm af').length,
    seinen: () => vanSensor(seinen, s => s.id).length,
    buiten: () => vanSensor(buiten, b => b.ctx.id),
    regels
  };
}

/* De auditwacht is een eigen controle met een eigen journaal; hier zou hij een
   bevinding geven over een journaal dat deze toets niet heeft. Hij wordt
   rustig gezet, zodat alleen de stille sensor telt. */
function rustigeAuditwacht() {
  const aw = require('../server/lib/auditwacht');
  const echt = aw.bevinding;
  aw.bevinding = () => null;
  return () => { aw.bevinding = echt; };
}

function actief() {
  const vorig = process.env.RTG_SENSORSTILTE_ACTIEF;
  process.env.RTG_SENSORSTILTE_ACTIEF = '1';
  return () => { if (vorig === undefined) delete process.env.RTG_SENSORSTILTE_ACTIEF; else process.env.RTG_SENSORSTILTE_ACTIEF = vorig; };
}

function allesLevend() {
  for (const [naam, v] of Object.entries(stilte.VERWACHT)) { stilte.gestart(naam, v.periodeMs); stilte.ronde(naam); }
}
const rondeVoorAllenBehalve = (behalve) => {
  for (const naam of Object.keys(stilte.VERWACHT)) if (!behalve.includes(naam)) stilte.ronde(naam);
};
const ALARM_VENSTER = stilte.VERWACHT.alarm.periodeMs * stilte.VENSTERS;
const GROOTSTE_VENSTER = Math.max(...Object.values(stilte.VERWACHT).map(v => v.periodeMs)) * stilte.VENSTERS;

function opzet() {
  stilte._wis();
  const klok = metKlok(1e12);
  const terug = [actief(), rustigeAuditwacht(), () => klok.terug(), () => stilte._wis()];
  return { klok, opruimen: () => { for (const f of terug.reverse()) f(); } };
}

test('1. een aanhoudende stilte van honderd rondes geeft een melding en geen honderd', () => {
  const { klok, opruimen } = opzet();
  try {
    const m = maak();
    allesLevend();
    m.alarm.weeg();
    assert.equal(m.aan(), 0, 'alles levend: niets');
    klok.verder(ALARM_VENSTER + 1000);
    for (let i = 0; i < 100; i++) {
      rondeVoorAllenBehalve(['canary']);
      m.alarm.weeg();
      klok.verder(60000);
    }
    assert.equal(m.aan(), 1, 'een journaalregel bij het ontstaan');
    assert.equal(m.seinen(), 1, 'een sein naar het kantoorbord');
    assert.equal(m.buiten().length, 1, 'een melding naar buiten');
    assert.match(m.buiten()[0].bericht, /^ALARM HOOG: Een beveiligingssensor is stil -- canary:/);
    assert.equal(m.af(), 0, 'en geen afmelding: hij is niet hersteld');
  } finally { opruimen(); }
});

test('2. alles tegelijk stil is een alarm met alle namen, geen zeven', () => {
  const { klok, opruimen } = opzet();
  try {
    const m = maak();
    let schild = 0, meting = 0;
    stilte.koppelSchild({ schildVerzoeken: () => schild, metingVerzoeken: () => meting });
    let noodremKapot = false;
    stilte.koppelNoodrem(() => { if (noodremKapot) throw new Error('de noodrem is niet te lezen'); return true; });
    allesLevend();
    assert.equal(m.alarm.weeg().nieuw.length, 0, 'eerst is alles levend');   // en het vergelijkpunt van het schild staat
    klok.verder(GROOTSTE_VENSTER + 1000);   // ook de traagste tikker (de auditwacht) is nu over zijn venster
    noodremKapot = true;
    meting += 500;            // verkeer dat het schild niet ziet
    for (let i = 0; i < 50; i++) stilte.verloren('schild');
    stilte.verloren('beveiligingsjournaal');
    const r = m.alarm.weeg();
    assert.equal(r.nieuw.filter(a => a.id === 'sensor-stil').length, 1);
    assert.equal(m.aan(), 1);
    assert.equal(m.buiten().length, 1, 'een melding naar buiten, niet een per sensor');
    const wat = m.buiten()[0].bericht;
    for (const naam of Object.keys(stilte.VERWACHT).concat(['schild', 'noodrem', 'melding:schild', 'melding:beveiligingsjournaal'])) {
      assert.ok(wat.includes(naam + ':'), naam + ' staat in de ene melding');
    }
    for (let i = 0; i < 20; i++) { meting += 500; klok.verder(60000); m.alarm.weeg(); }
    assert.equal(m.buiten().length, 1, 'en blijft er een');
  } finally { opruimen(); }
});

test('3. tienduizend verloren meldingen: een alarm, een teller, geen groeiend geheugen', () => {
  const { opruimen } = opzet();
  try {
    const m = maak();
    allesLevend();
    for (let i = 0; i < 10000; i++) { stilte.verloren('schild'); if (i % 100 === 0) m.alarm.weeg(); }
    m.alarm.weeg();
    assert.equal(m.aan(), 1);
    assert.equal(m.buiten().length, 1);
    const rijen = stilte.oordeel().filter(r => r.naam.startsWith('melding:'));
    assert.equal(rijen.length, 1, 'een rij per bron, niet per melding');
    assert.match(rijen[0].reden, /^10000 meldingen gingen verloren/);
  } finally { opruimen(); }
});

test('4. herstel is pas herstel na een nieuwe geslaagde ronde, en geeft dan een afmelding', () => {
  const { klok, opruimen } = opzet();
  try {
    const m = maak();
    allesLevend();
    klok.verder(ALARM_VENSTER + 1000);
    rondeVoorAllenBehalve(['wacht']);
    m.alarm.weeg();
    assert.equal(m.aan(), 1);

    /* Een ronde die omvalt is geen herstel. */
    stilte.fout('wacht', new Error('de meting viel om'));
    rondeVoorAllenBehalve(['wacht']);
    m.alarm.weeg();
    assert.equal(m.af(), 0, 'een mislukte ronde is geen herstel');

    /* De tijd die verstrijkt is ook geen herstel. */
    klok.verder(10 * 60000);
    rondeVoorAllenBehalve(['wacht']);
    m.alarm.weeg();
    assert.equal(m.af(), 0, 'wachten is geen herstel');

    /* Een nieuwe geslaagde ronde wel -- en dan precies een afmelding. */
    stilte.ronde('wacht');
    m.alarm.weeg();
    assert.equal(m.af(), 1, 'een afmelding na de geslaagde ronde');
    assert.equal(m.buiten().length, 2, 'aan en af, meer niet');
    assert.match(m.buiten()[1].bericht, /^Alarm opgelost: Een beveiligingssensor is stil/);
    m.alarm.weeg(); m.alarm.weeg();
    assert.equal(m.af(), 1, 'opgelost blijft opgelost zonder nieuwe melding');
    assert.equal(stilte.oordeel().find(r => r.naam === 'wacht').fouten, 1, 'de mislukte ronde blijft als spoor staan');
  } finally { opruimen(); }
});

test('4b. een verlies in dezelfde tik als een aankomst blijft een verlies', () => {
  /* Met de klok stil (alles in dezelfde milliseconde) las de oude vergelijking
     op tijdstempels `aankomst >= verlies` als herstel, en verdween precies het
     verlies. Het volgnummer kent geen gelijkspel. */
  const { opruimen } = opzet();
  try {
    stilte.verloren('beveiligingsjournaal');
    stilte.aangekomen('beveiligingsjournaal');
    const rij = () => stilte.oordeel().find(r => r.naam === 'melding:beveiligingsjournaal');
    assert.equal(rij().stand, 'levend', 'aankomst na verlies: hersteld');
    stilte.verloren('beveiligingsjournaal');
    assert.equal(rij().stand, 'stil', 'verlies na aankomst in dezelfde milliseconde: stil');
    assert.match(rij().reden, /^2 meldingen gingen verloren$/);
  } finally { opruimen(); }
});

test('5. een sensor die heen en weer springt, geeft per weging hooguit een overgang', () => {
  const { klok, opruimen } = opzet();
  try {
    const m = maak();
    allesLevend();
    /* Twintig wegingen lang wisselt het journaal elke halve ronde tussen
       verloren en aangekomen -- tien keer per weging. */
    for (let i = 0; i < 20; i++) {
      for (let j = 0; j < 10; j++) { stilte.verloren('beveiligingsjournaal'); stilte.aangekomen('beveiligingsjournaal'); }
      if (i % 2 === 0) stilte.verloren('beveiligingsjournaal');
      rondeVoorAllenBehalve([]);
      m.alarm.weeg();
      klok.verder(60000);
    }
    const overgangen = m.aan() + m.af();
    assert.ok(overgangen <= 20, 'hooguit een overgang per weging, niet per verandering (' + overgangen + ')');
    assert.equal(m.buiten().length, overgangen, 'naar buiten precies de overgangen');
    /* De 200 aankomsten en 210 verliezen zelf zijn nergens als melding beland. */
    assert.ok(m.regels.length <= 20);
  } finally { opruimen(); }
});

test('6. een omvallende meldingsdienst dempt het alarm niet en laat de weging staan', () => {
  const { klok, opruimen } = opzet();
  try {
    const m = maak({ melderKapot: true });
    allesLevend();
    klok.verder(ALARM_VENSTER + 1000);
    rondeVoorAllenBehalve(['alarm']);
    const r = m.alarm.weeg();
    assert.equal(r.nieuw.filter(a => a.id === 'sensor-stil').length, 1, 'de weging gaat door');
    assert.equal(m.aan(), 1, 'het spoor staat in het journaal, ook als de dienst omvalt');
    assert.equal(m.seinen(), 1, 'en het kantoorbord krijgt hem');
  } finally { opruimen(); }
});

test('7. in de schaduw gaat er niets de deur uit, hoe groot de stilte ook is', () => {
  const { klok, opruimen } = opzet();
  delete process.env.RTG_SENSORSTILTE_ACTIEF;   // opruimen() zet de oude waarde terug
  try {
    const m = maak();
    klok.verder(ALARM_VENSTER + 1000);
    for (let i = 0; i < 1000; i++) stilte.verloren('schild');
    for (let i = 0; i < 30; i++) { m.alarm.weeg(); klok.verder(60000); }
    assert.equal(m.aan() + m.seinen() + m.buiten().length, 0, 'schaduw: niets gemeld');
    assert.ok(stilte.stand().stil.length >= Object.keys(stilte.VERWACHT).length, 'maar wel zichtbaar');
  } finally { opruimen(); }
});
