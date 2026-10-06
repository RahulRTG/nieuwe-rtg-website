'use strict';
/* EEN MELDING IS EEN OBJECT -- nooit een losse tekst, en nooit een bak zonder lezer.

   Acht plekken gaven `notify()` een tekst. `{ ...note }` spreidde die in losse
   letters ({0:'K',1:'l',...}), zodat de melding zonder titel en tekst
   aankwam; twee ervan schreven bovendien in `notifications.kantoor`, een bak
   die geen enkele route, sessie of live-verbinding leest. Besluit van 4 oktober
   2026: notify() WEIGERT een tekst, en elke plek kiest zelf zijn weg.

   Twee helften, omdat de aanroepers de fout in een lege `catch` vangen: de
   weigering alleen zou een melding stil laten verdwijnen. De bronscan zorgt
   dat er geen aanroep met een tekst meer bestaat. */

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function meldingen() {
  const db = { data: { notifications: {}, meldingVoorkeur: {}, pushSubs: {} } };
  const live = [];
  const m = require('../server/opzet/meldingen.js')({ db, save() {}, crypto,
    bus: { publish: (kanaal, b) => live.push(b) }, accounts: {}, eigenaar: {}, webpush: null, sessions: {}, tokenHash: x => x });
  return { m, db, live };
}

test('1. notify() weigert een tekst, een lijst en niets', () => {
  const { m, db } = meldingen();
  for (const fout of ['Klankwerk: een aanvraag', ['a'], null, undefined, 42])
    assert.throws(() => m.notify('lid-1', fout), /verwacht een melding als object/);
  assert.deepEqual(db.data.notifications, {}, 'er is niets opgeslagen');
});

test('2. een object komt aan met titel en tekst', () => {
  const { m, db, live } = meldingen();
  m.notify('lid-1', { title: 'Klankwerk', body: 'Uw stuk komt uit onder de RTG-naam.' });
  const n = db.data.notifications['lid-1'][0];
  assert.equal(n.title, 'Klankwerk');
  assert.equal(n.body, 'Uw stuk komt uit onder de RTG-naam.');
  assert.ok(!('0' in n), 'geen gespreide letters');
  assert.equal(live[0].event, 'notify');
});

/* DE BRON. Een aanroep `notify(x, 'tekst')` of `notify(x, "tekst")` of met een
   template literal bestaat niet meer, en niemand schrijft nog in de bak
   'kantoor'. Gelezen over heel server/, zonder commentaarregels. */
function bronnen(map, uit = []) {
  for (const e of fs.readdirSync(map, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === 'data') continue;
    const p = path.join(map, e.name);
    if (e.isDirectory()) bronnen(p, uit);
    else if (p.endsWith('.js')) uit.push(p);
  }
  return uit;
}

test('3. geen enkele aanroep geeft notify() nog een tekst, of schrijft in de bak "kantoor"', () => {
  const tekst = /\bnotify\(\s*[^,()]+,\s*['"`]/;
  const kantoor = /\bnotify\(\s*['"]kantoor['"]/;
  const fouten = [];
  for (const p of bronnen(path.join(__dirname, '..', 'server'))) {
    const regels = fs.readFileSync(p, 'utf8').split('\n');
    regels.forEach((r, i) => {
      const code = r.replace(/\/\/.*$/, '');
      if (/^\s*(\*|\/\*)/.test(r)) return;
      if (tekst.test(code) || kantoor.test(code)) fouten.push(path.relative(path.join(__dirname, '..'), p) + ':' + (i + 1) + '  ' + r.trim());
    });
  }
  assert.deepEqual(fouten, [], 'notify() met een tekst of in de bak "kantoor":\n' + fouten.join('\n'));
});

/* EN DE METER KAN UITSLAAN: zonder deze controle zou toets 3 groen staan op
   een patroon dat niets vindt. */
test('4. de bronscan vindt de oude vorm wel als hij er staat', () => {
  const tekst = /\bnotify\(\s*[^,()]+,\s*['"`]/;
  assert.ok(tekst.test("notify(doel, 'Iemand schreef een aanbeveling.')"));
  assert.ok(tekst.test('notify(k, `Afgelast: ${wat}`)'));
  assert.ok(!tekst.test("notify(doel, { title: 'Métier', body: 'x' })"));
});
