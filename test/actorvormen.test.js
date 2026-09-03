/* DE ACTOR OP HET VERZOEK (scripts/actorvormen.js + ENVELOP.json).

   WAAROM DEZE TOETS ER IS, en het is dezelfde fout als die hij bewaakt.
   `ENVELOP.json` droeg een getal `actorVormen: 7` en TAKEN.md 4.72 zei erbij
   "Geratelde stand in ENVELOP.json, mag alleen omlaag". Geen script berekende
   het en geen toets controleerde het: het was met de hand getypt en kon niet
   zakken -- een belofte in tekst zonder handhaver, LAT.md regel 6, in het
   register dat over de canonieke vorm gaat.

   DRIE DINGEN DIE HIER VASTLIGGEN:

     1. HET GETAL WORDT AFGELEID EN NIET GETYPT. Zet iemand een achtste naam op
        het verzoek, dan stijgt het en zakt de meter.
     2. DUPLICAAT EN SESSIE ZIJN NIET HETZELFDE, en dat onderscheid is de hele
        opbrengst van het narekenen. `req.boardroomKey` droeg niets anders dan
        de identiteit die req.envelop al draagt -- dat is een duplicaat en die
        hoort weg. `req.session` draagt ook `.tier` en `.account`; die
        "overzetten op req.envelop" zou de envelop een sessieobject maken, en
        precies dat verbiedt de kop van server/opzet/envelop.js.
     3. DE ZELFIJKING. Verdwijnt `req.envelop` zelf, dan meet dit alles niets
        meer en hoort de meter te zakken in plaats van netjes 6 te melden.

   Draai los: node --test test/actorvormen.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const meter = require('../scripts/actorvormen.js');

const WORTEL = path.join(__dirname, '..');

function draai(args) {
  const r = spawnSync(process.execPath, [path.join(WORTEL, 'scripts', 'actorvormen.js'), ...(args || [])],
    { cwd: WORTEL, encoding: 'utf8' });
  return { uit: (r.stdout || '') + (r.stderr || ''), code: r.status };
}

/* Een echte mutatie in de bron, en in de finally terug. Dezelfde vorm als
   test/gezag.test.js, met dezelfde waarschuwing: een kill tussen die twee laat
   de mutatie staan. */
function metVervangen(rel, van, naar, doe) {
  const vol = path.join(WORTEL, rel);
  const origineel = fs.readFileSync(vol, 'utf8');
  assert.ok(origineel.includes(van), 'de aanname onder deze mutatie klopt niet meer: ' + van);
  try { fs.writeFileSync(vol, origineel.replace(van, naar)); doe(); }
  finally { fs.writeFileSync(vol, origineel); }
}

test('de grondstand is groen, en het getal komt uit de bron', () => {
  const r = draai();
  assert.equal(r.code, 0, r.uit);
  const nu = meter.meet();
  assert.deepEqual(nu.stuk, []);
  assert.ok(nu.vormen.length > 0, 'geen enkele vorm gevonden; dan meet dit niets');
});

test('req.boardroomKey is weg: het enige echte duplicaat', () => {
  /* Hij droeg een kale sleutel en verder niets -- precies wat req.envelop al
     draagt. De vier lezers halen hem nu via envelop.wie(req). */
  const nu = meter.meet();
  assert.ok(nu.weg.includes('req.boardroomKey'), 'req.boardroomKey staat er weer');
  assert.equal(nu.duplicaten.length, 0,
    'er staat een naam die niets anders draagt dan de identiteit uit de envelop: ' +
    nu.duplicaten.map(v => v.naam).join(', '));
});

test('de zes die overblijven dragen ALLEMAAL domeindata', () => {
  /* Dat is de bevinding die het narekenen opleverde: ze zijn geen tweede naam
     voor de actor maar sessieobjecten. De eis "actorVormen op 0" was daarmee
     niet haalbaar zoals hij in TAKEN.md 4.72 stond. */
  const nu = meter.meet();
  for (const v of nu.sessies) {
    assert.ok(v.velden.length > 0, v.naam + ' draagt geen velden en heet toch een sessie');
  }
  assert.equal(nu.sessies.length + nu.duplicaten.length, nu.vormen.length);
});

test('MUTATIE: een achtste naam laat de meter zakken', () => {
  /* De hele reden dat dit script bestaat. Het oude getal stond in JSON en kon
     niet stijgen; dit kan het wel, en dan hoort het rood te worden. */
  const nu = meter.meet();
  metVervangen('scripts/actorvormen.js',
    "const NAMEN = ['session', 'actor', 'boardroomKey',",
    "const NAMEN = ['session', 'actor', 'boardroomKey', 'body',", () => {
      const r = draai();
      assert.match(r.uit, /ZAKT: actorVormen/, r.uit);
      assert.equal(r.code, 1, 'een vorm erbij hoort de meter te laten zakken');
    });
  assert.equal(meter.meet().vormen.length, nu.vormen.length, 'de mutatie is niet teruggezet');
});

test('MUTATIE: komt req.boardroomKey terug, dan staat er weer een duplicaat', () => {
  metVervangen('server/kern/kantoor/boardroom.js',
    '    req.boardroomBaas = boardroomBaas(key);',
    '    req.boardroomKey = key;\n    req.boardroomBaas = boardroomBaas(key);', () => {
      const nu = meter.meet();
      assert.equal(nu.duplicaten.length, 1);
      assert.equal(nu.duplicaten[0].naam, 'req.boardroomKey');
      const r = draai();
      assert.match(r.uit, /duplicaten 0 -> 1/);
      assert.equal(r.code, 1);
    });
});

test('DE ZELFIJKING: zonder req.envelop meet dit niets, en dan zakt hij', () => {
  metVervangen('server/opzet/envelop.js', 'req.envelop = env', 'req.enveloppe = env', () => {
    const nu = meter.meet();
    assert.ok(nu.stuk.length, 'de meter meldt niet dat de canonieke vorm weg is');
    assert.equal(draai().code, 2, 'een stukke meter hoort niet netjes een getal te melden');
  });
});

test('ENVELOP.json loopt niet achter op de meting', () => {
  const reg = JSON.parse(fs.readFileSync(path.join(WORTEL, 'ENVELOP.json'), 'utf8'));
  const nu = meter.meet();
  assert.equal(reg.gemeten.actorVormen, nu.vormen.length);
  assert.equal(reg.gemeten.actorDuplicaten, nu.duplicaten.length);
  assert.deepEqual(reg.actorVormen, nu.vormen.map(v => v.naam));
  /* Het register hoort te zeggen HOE het aan zijn getal komt; zonder die zin is
     het over een half jaar weer een met de hand getypt cijfer. */
  assert.match(reg.actorVormenUitleg, /scripts\/actorvormen\.js/);
});

test('envelop.wie() geeft null en geen lege tekenreeks als er niemand is', () => {
  /* "niemand" en "iemand zonder naam" zijn niet hetzelfde; wie die twee
     gelijktrekt, bouwt er een dag later beleid op. */
  const envelop = require('../server/opzet/envelop.js');
  assert.equal(envelop.wie(null), null);
  assert.equal(envelop.wie({}), null);
  assert.equal(envelop.wie({ envelop: { actor: { id: null } } }), null);
  assert.equal(envelop.wie({ envelop: { actor: { id: 'lid-7' } } }), 'lid-7');
});
