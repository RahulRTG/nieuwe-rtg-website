/* DEMOCRATIEOS FASE C4 -- de omwegen om de grondwet heen (POLITIEK.md par. 18.2).

   C1 tot en met C3 (test/democratie-aanval.test.js) vallen de lus aan langs de
   voordeur. Deze toetsen zoeken de ZIJDEUREN: plekken buiten kern/democratie die
   de regels ongemerkt kunnen omzeilen, zonder dat een route van DemocratieOS
   zelf iets fout doet.

     1  het bord kan democratie niet gericht dichtzetten, ook niet met een oude
        stand die er al lag
     2  geen route geeft de hele opslag naar buiten
     3  een tegengehouden melding is niet bezorgd, en de wek zegt dat eerlijk
     4  de bezem van C3 kan vinden (zelfijking)

   Elke toets heeft een zelfijking of een tegenproef: een meter die niets KAN
   vinden, staat groen om dezelfde reden als een meter die niets vindt.

   Draai los: node --test test/democratie-grondwet.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { zonderCommentaar } = require('../scripts/lib/bron');
const toegang = require('../server/functies/toegang');
const { OP_ID } = require('../server/functies/register');
const { maakDemocratie } = require('../server/kern/democratie');

const WORTEL = path.join(__dirname, '..');

test('1. democratie gaat alleen voor iedereen dicht: geen persoon, plaats, land, pas, genre of canary', () => {
  assert.equal(OP_ID.democratie && OP_ID.democratie.alleenGlobaal, true, 'de functie bestaat en is alleen globaal');
  /* Elk burgerpad valt onder deze functie en niet onder de brede `member`. */
  const bron = fs.readFileSync(path.join(WORTEL, 'server/routes/democratie/index.js'), 'utf8');
  const paden = [...bron.matchAll(/app\.post\('(\/api\/member\/democratie\/[^']+)'/g)].map(m => m[1]);
  assert.ok(paden.length >= 4, 'de burgerroutes zijn gevonden');
  for (const p of paden) assert.equal(toegang.functieVoorPad(p).id, 'democratie', p + ' valt niet onder democratie');

  /* Een oude stand die er al lag -- via een voorstel, een schrijver buiten de
     kast om, of van voor deze regel -- mag niemand gericht buitensluiten. */
  const oud = { democratie: { perPersoon: { 'user-7': false }, perPlaats: { amsterdam: false }, perLand: { NL: false },
    perDoelgroep: { rtg: false }, perGenre: { horeca: false }, canary: { deel: 0, stand: 'loopt' } } };
  const ctx = { persoon: 'user-7', plaats: 'amsterdam', land: 'NL', doelgroep: 'rtg', genre: 'horeca' };
  assert.equal(toegang.blokkadeReden('democratie', oud, ctx), null, 'een fijne as sluit een burger buiten');
  assert.equal(toegang.blokkadeReden('democratie', { democratie: { aan: false } }, ctx), 'globaal', 'de noodstop werkt');
  /* Tegenproef: bij een gewone functie werken dezelfde assen wel. */
  assert.equal(toegang.blokkadeReden('member', { member: oud.democratie }, ctx), 'pas', 'de proef test de assen echt');
});

test('2. geen route geeft de hele opslag naar buiten', () => {
  /* Een antwoord dat `db.data` in zijn geheel draagt, is een kopie van alles --
     ook van de koppeling tussen kwestie en mens. De kloon naar een zaakdoos
     deed dat tot fase C; die filtert nu. */
  const HEEL = /res\.(json|send)\(\s*(db\.data\s*\)|\{[^{}]*:\s*db\.data\s*[},])/;
  assert.ok(HEEL.test('res.json({ data: db.data });') && HEEL.test('res.send(db.data)'), 'zelfijking: het patroon vindt een dump');
  assert.ok(!HEEL.test('res.json({ data });'), 'zelfijking: een gefilterd object is geen dump');
  const treffers = [];
  (function loop(map) {
    for (const naam of fs.readdirSync(map)) {
      const p = path.join(map, naam);
      if (fs.statSync(p).isDirectory()) { if (naam !== 'data' && naam !== 'node_modules') loop(p); continue; }
      if (!naam.endsWith('.js')) continue;
      if (HEEL.test(zonderCommentaar(fs.readFileSync(p, 'utf8')))) treffers.push(path.relative(WORTEL, p));
    }
  })(path.join(WORTEL, 'server'));
  assert.deepEqual(treffers, [], 'een route geeft db.data in zijn geheel terug');
});

test('3. een tegengehouden melding is niet bezorgd, en de wek boekt hem niet als gewekt', async () => {
  const maak = require('../server/opzet/meldaan');
  const db = { data: { notifications: {}, meldingVoorkeur: { 'user-2': { democratie: false } } } };
  const kern = { rustMagDoor: (h) => h !== 'user-1' };
  const { meldLid } = maak({ kern, db, save: () => {}, crypto, sseToCustomer: () => {}, sendPush: () => {}, sendPushToUser: () => {} });
  assert.equal(meldLid('user-1', { title: 'x', scope: 'democratie' }), null, 'de rust hield hem tegen');
  assert.equal(meldLid('user-2', { title: 'x', scope: 'democratie' }), null, 'de voorkeur hield hem tegen');
  const n = meldLid('user-3', { title: 'x', scope: 'democratie' });
  assert.ok(n && db.data.notifications['user-3'][0].id === n.id, 'tegenproef: een bezorgde melding geeft hem terug en staat er');

  /* En DemocratieOS leunt daarop: een wek die niet uitging, blijft klaargezet. */
  const dd = { data: {} };
  const d = maakDemocratie({ db: dd, save: () => {}, bijeen: async f => f(), inBundel: () => true, crypto,
    codenaamVan: k => 'Cn-' + k.replace('user-', 'n'), meldLid: (k, note) => meldLid(k, note) });
  const id = (await d.inbreng('user-1', { onderwerp: 'Een burger met de rust aan krijgt geen wek' })).kwestie.id;
  await d.sluit('user-9', { id, stand: 'uitgevoerd', toelichting: 'Er is gedaan wat besloten was.' });
  assert.equal((await d.mijn('user-1')).kwesties[0].rondes[0].terugkoppeling.stand, 'klaargezet',
    'een tegengehouden wek werd als gewekt geboekt');
  assert.equal(d.meter().staan.besluitWekNogNietUit, 1, 'de meter ziet de wek die nog moet');
});

test('4. de bezem van C3 kan vinden: een sleutel naast een kwestie buiten de koppeling valt op', () => {
  /* Dezelfde zoeker als in test/democratie-aanval.test.js C3, op een geplante
     overtreding. Vindt hij die niet, dan zegt zijn groen daar niets. */
  const bron = fs.readFileSync(path.join(__dirname, 'democratie-aanval.test.js'), 'utf8');
  assert.match(bron, /String\(v\) === b\.key/, 'de zoeker in C3 vergelijkt op de hele sleutel');
  const zoek = (data, key, id) => {
    const t = [];
    (function loop(x, pad) {
      if (Array.isArray(x)) return x.forEach((v, i) => loop(v, pad + '[' + i + ']'));
      if (!x || typeof x !== 'object') return;
      const s = JSON.stringify(x);
      if (Object.values(x).some(v => typeof v !== 'object' && String(v) === key) && s.includes(id)) t.push(pad);
      for (const k of Object.keys(x)) loop(x[k], pad + '.' + k);
    })(data, 'db');
    return t;
  };
  const geplant = { ergens: [{ wie: 'user-42', wat: 'POST', lijf: { id: 'KW-ABC123' } }], anders: { wie: 'user-421' } };
  assert.deepEqual(zoek(geplant, 'user-42', 'KW-ABC123'), ['db.ergens[0]']);
  assert.deepEqual(zoek({ los: { wie: 'user-42' }, ook: { id: 'KW-ABC123' } }, 'user-42', 'KW-ABC123'), [],
    'los van elkaar is geen koppeling');
});
