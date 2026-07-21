/* Zaakdoos-journaal, beveiliging: het journaal wordt na herstel nagespeeld naar
   de cloud met de inlog van de doos. Daarom is het gezegeld (HMAC), genummerd
   (seq) en padgebonden. Getoetst: een geschreven regel krijgt een volgnummer en
   een geldig zegel; manipuleren maakt het zegel ongeldig; alleen zaak-paden gaan
   erin (nooit inloggen, accounts, de doos zelf of een pad met ..); en een te
   grote body wordt geweigerd.
   Draai los: node --experimental-sqlite --test test/doos-journaal.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');

function verseDoos() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-doosj-'));
  const db = { data: {} };
  const { doos } = require('../server/kern/zaakdoos')({ db, save: () => {}, log: null, dataDir: dir });
  return { doos, db, dir };
}

test('1. een geschreven journaalregel is genummerd en gezegeld; manipuleren betrapt', () => {
  const { doos, db, dir } = verseDoos();
  try {
    doos.schrijfJournaal('/api/supplier/overschot', { item: 'soep', n: 2 }, { ok: true });
    const rij = db.data.doosJournaal;
    assert.equal(rij.length, 1, 'de zaak-schrijfactie staat in het journaal');
    const e = rij[0];
    assert.equal(e.seq, 1, 'volgnummer');
    assert.ok(typeof e.zegel === 'string' && e.zegel.length > 20, 'er is een zegel');
    assert.equal(doos.journaalGeldig(e), true, 'het verse zegel klopt');

    // manipuleer het totaal in de body: het zegel klopt niet meer
    e.body.n = 999;
    assert.equal(doos.journaalGeldig(e), false, 'een gemanipuleerde regel wordt betrapt');
    e.body.n = 2;
    assert.equal(doos.journaalGeldig(e), true, 'terug naar de echte inhoud: weer geldig');
    // manipuleer het pad: eveneens betrapt (zegel + padbeleid)
    const gekaapt = Object.assign({}, e, { pad: '/api/supplier/pos/redeem' });
    assert.equal(doos.journaalGeldig(gekaapt), false, 'een omgezet pad wordt betrapt');
  } finally { try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {} }
});

test('2. alleen zaak-schrijfacties gaan het journaal in; gevaarlijke paden niet', () => {
  const { doos, db, dir } = verseDoos();
  try {
    // deze horen er NIET in
    doos.schrijfJournaal('/api/auth/login', { u: 'x' }, { ok: true });
    doos.schrijfJournaal('/api/supplier/login', { code: 'X' }, { token: 'geheim' });
    doos.schrijfJournaal('/api/doos/status', {}, { ok: true });
    doos.schrijfJournaal('/api/supplier/../techniek/fix', {}, { ok: true });
    assert.equal((db.data.doosJournaal || []).length, 0, 'niets van dit alles is gejournaald');

    assert.equal(doos.journaalPadOk('/api/supplier/order/ready'), true);
    assert.equal(doos.journaalPadOk('/api/supplier/login'), false);
    assert.equal(doos.journaalPadOk('/api/auth/register'), false);
    assert.equal(doos.journaalPadOk('/api/doos/kloon'), false);
    assert.equal(doos.journaalPadOk('/api/supplier/stream/x'), false);
    assert.equal(doos.journaalPadOk('/api/supplier/x?y=1'), false);

    // een echte zaakactie gaat er wel in, met seq 1
    doos.schrijfJournaal('/api/supplier/overschot', { item: 'brood' }, { ok: true });
    assert.equal(db.data.doosJournaal.length, 1);
    assert.equal(db.data.doosJournaal[0].seq, 1);
  } finally { try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {} }
});

test('3. een te grote body wordt geweigerd (geen onzin in het journaal)', () => {
  const { doos, db, dir } = verseDoos();
  try {
    doos.schrijfJournaal('/api/supplier/overschot', { blob: 'x'.repeat(70 * 1024) }, { ok: true });
    assert.equal((db.data.doosJournaal || []).length, 0, 'de te grote regel is geweigerd');
  } finally { try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {} }
});
