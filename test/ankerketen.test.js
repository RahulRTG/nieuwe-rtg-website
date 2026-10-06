'use strict';
/* Audit P1-3: de ankerketen VAN BEGIN TOT EIND, met de referentieontvanger
   (scripts/ankerontvanger.js) als tweede machine.

   ankerdienst (getekend blok) -> ankerpost (HTTP) -> ontvanger (append-only)
   -> ankertimer (eerst terughalen en afrekenen, dan pas wegbrengen).

   De dragende toets: een VOLLEDIGE herberekening van een journaal -- elke hash
   weer geldig, lokaal niets te zien -- laat de volgende ronde het alarm afgaan,
   en er gaat dan GEEN nieuw blok weg dat de vervalsing zou overschrijven. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const keten = require('../server/lib/keten');
const { maakAnkerdienst } = require('../server/lib/ankerdienst');
const { maakAnkerpost } = require('../server/lib/ankerpost');
const timer = require('../server/lib/ankertimer');
const wacht = require('../server/lib/auditwacht');
const { maakOntvanger } = require('../scripts/ankerontvanger');

const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-ankerketen-'));
const SLEUTEL = 'proef-ankerpost-sleutel';
let ontvanger, url;
test.before(async () => {
  process.env.RTG_ANKERPOST_ONVEILIG = '1';   // http binnen de toets; productie eist https
  ontvanger = maakOntvanger({ map, sleutel: SLEUTEL });
  /* 127.0.0.2: de ankerpost weigert 127.0.0.1 en localhost als "deze machine zelf". */
  await new Promise((ja, nee) => ontvanger.server.listen(0, '127.0.0.2', ja).on('error', nee));
  url = 'http://127.0.0.2:' + ontvanger.server.address().port + '/';
});
test.after(() => { ontvanger.server.close(); fs.rmSync(map, { recursive: true, force: true }); });

function huis() {
  const db = { data: { handelingLog: [], inzageLog: [], securityLog: [] } };
  for (let i = 0; i < 6; i++) keten.noteerIn(db.data.handelingLog, { at: '2026-10-0' + (i % 9 + 1), wat: 'h' + i }, 50000);
  const dienst = maakAnkerdienst({ db, sleutel: () => Buffer.alloc(32, 5), omgeving: {} });
  const post = maakAnkerpost({ ankerdienst: dienst, omgeving: { RTG_ANKERPOST_URL: url, RTG_ANKERPOST_SLEUTEL: SLEUTEL } });
  return { db, dienst, post };
}
const stil = { warn() {}, error() {} };

test('de keten loopt rond, en een volledige herberekening wordt bij de volgende ronde betrapt', async () => {
  wacht._wis();
  const h = huis();
  const r1 = await timer.eenRonde(h.post, stil);
  assert.equal(r1.ok, true, 'eerste ronde: er lag niets, het blok gaat weg: ' + JSON.stringify(r1));
  assert.equal(r1.vergeleken, false);
  keten.noteerIn(h.db.data.handelingLog, { at: '2026-10-07', wat: 'gewoon verder' }, 50000);
  const r2 = await timer.eenRonde(h.post, stil);
  assert.equal(r2.ok, true); assert.equal(r2.vergeleken, true, 'tweede ronde vergeleek eerst');
  const opDeTweede = fs.readFileSync(ontvanger.bestand, 'utf8').trim().split('\n').length;
  assert.equal(opDeTweede, 2);

  /* De vervalsing: een regel aangepast, de HELE keten opnieuw berekend. */
  const oud = h.db.data.handelingLog.slice().reverse(), nieuw = [];
  for (const r of oud) { const { hash, vorige, nr, ...kern } = r; if (kern.wat === 'h2') kern.wat = 'nooit gebeurd'; keten.noteerIn(nieuw, kern, 50000); }
  h.db.data.handelingLog = nieuw;
  assert.equal(keten.verifieer(nieuw).ok, true, 'lokaal is er niets te zien');
  const r3 = await timer.eenRonde(h.post, stil);
  assert.equal(r3.ok, false); assert.equal(r3.afwijking, true);
  assert.match(wacht.bevinding() || '', /anker/);
  assert.equal(fs.readFileSync(ontvanger.bestand, 'utf8').trim().split('\n').length, opDeTweede,
    'er ging GEEN nieuw blok weg over het vervalste journaal');
});

test('de ontvanger neemt geen teruggang, geen ongetekend blok en geen vreemde sleutel aan', () => {
  const o = maakOntvanger({ map: fs.mkdtempSync(path.join(map, 'los-')) });
  const h = huis();
  assert.equal(o.neemAan({ blok: h.dienst.blok() }).status, 200);
  h.db.data.handelingLog.splice(0, 2);                       // de kop eraf
  assert.equal(o.neemAan({ blok: h.dienst.blok() }).status, 409, 'een lager volgnummer is een teruggang');
  const { handtekening, ...kaal } = h.dienst.blok();
  assert.equal(o.neemAan({ blok: kaal }).status, 400, 'ongetekend');
  const vreemd = maakAnkerdienst({ db: { data: { handelingLog: [] } }, sleutel: () => Buffer.alloc(32, 8), omgeving: {} });
  assert.equal(o.neemAan({ blok: vreemd.blok() }).status, 400, 'de eerste sleutel is vastgepind');
});
