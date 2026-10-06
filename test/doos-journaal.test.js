/* Zaakdoos-journaal, beveiliging: het journaal wordt na herstel nagespeeld naar
   de cloud met de inlog van de doos. Daarom is het gezegeld (HMAC), genummerd
   (seq) en padgebonden. Getoetst: een geschreven regel krijgt een volgnummer en
   een geldig zegel; manipuleren maakt het zegel ongeldig; alleen zaak-paden gaan
   erin (nooit inloggen, accounts, de doos zelf of een pad met ..); en een te
   grote body wordt geweigerd. Sinds N27 ook: geen inlogroute in welke spelling
   ook, van het antwoord alleen de refs, geen lijf met een wachtwoord, en een
   oude regel die dat wel heeft gaat bij het naspelen niet naar de cloud.
   Draai los: node --test test/doos-journaal.test.js */
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

/* N27: de inlogroutes in elke spelling die de router aanneemt, en wat er van een
   regel overblijft. De echte doos in lokale modus staat in
   test/doos-inlogjournaal.test.js; dit zijn de losse sloten, elk apart. */
test('4. geen inlogroute in het journaal, ook niet met een slash of via de werkplekinlog', () => {
  const { doos, db, dir } = verseDoos();
  try {
    for (const pad of ['/api/supplier/login', '/api/supplier/login/', '/api/supplier/mijn/login', '/api/supplier/mijn/login/']) {
      assert.equal(doos.journaalPadOk(pad), false, pad + ' is een inlog');
      doos.schrijfJournaal(pad, { bewijs: 'b-' + pad, code: '123456' }, { token: 'tok-' + pad });
    }
    assert.equal((db.data.doosJournaal || []).length, 0, 'geen enkele inlog is gejournald');
    // de slash maakt van een gewone zaakroute geen inlog
    assert.equal(doos.journaalPadOk('/api/supplier/overschot/'), true);
  } finally { try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {} }
});

test('5. van het antwoord blijft alleen wat het naspelen leest; een wachtwoordlijf gaat er niet in', () => {
  const { doos, db, dir } = verseDoos();
  try {
    doos.schrijfJournaal('/api/supplier/mijn/wissel', { code: 'VORA' }, { token: 'a'.repeat(48), supplier: { code: 'VORA' } });
    doos.schrijfJournaal('/api/supplier/staff/invite', { name: 'X' }, { ok: true, invite: { id: 'sinv-1', kassacode: 'KC.GEHEIM' }, link: '#werving=KC.GEHEIM' });
    doos.schrijfJournaal('/api/supplier/order/maak', { items: [1] }, { order: { ref: 'R-1', pickup: 'P7', regels: [{ naam: 'soep' }, { id: 'r2' }] } });
    doos.schrijfJournaal('/api/supplier/staff/join', { bedrijf: 'Sal de Mar', kassacode: 'KC', login: 'a@b.c', password: 'geheim' }, { ok: true });
    const rij = db.data.doosJournaal;
    assert.deepEqual(rij.map(e => e.pad), ['/api/supplier/mijn/wissel', '/api/supplier/staff/invite', '/api/supplier/order/maak'],
      'de aanmelding met een RTG-wachtwoord staat er niet in');
    assert.equal(rij[0].res, null, 'geen werktoken uit een wissel');
    assert.deepEqual(rij[1].res, { invite: { id: 'sinv-1' } }, 'geen kassacode, wel de ref');
    assert.deepEqual(rij[2].res, { order: { ref: 'R-1', pickup: 'P7', regels: [null, { id: 'r2' }] } }, 'de vorm blijft, voor leerRefs');
    assert.ok(rij.every(e => doos.journaalGeldig(e)), 'de ingekorte regels dragen een geldig zegel');

    /* DE TWEEDE VERDEDIGING IN ELKE SPELLING EN OP ELKE DIEPTE. Een plat
       'password' in kleine letters bewijst alleen die ene vorm: zonder
       hoofdletterlezing, zonder de Nederlandse naam of zonder af te dalen bleef
       deze toets groen (herkeuring N27, mutanten M10, M14 en M11). Elk lijf
       hieronder vangt er precies een, zodat de melding zegt welke tak brak. */
    const geweigerd = [
      ['hoofdletters', { bedrijf: 'Sal de Mar', PASSWORD: 'geheim' }],
      ['de Nederlandse naam', { bedrijf: 'Sal de Mar', wachtwoord: 'geheim' }],
      ['genest object', { account: { login: 'a@b.c', password: 'geheim' } }],
      ['in een lijst', { leden: [{ naam: 'A' }, { naam: 'B', password: 'geheim' }] }]
    ];
    for (const [vorm, lijf] of geweigerd) {
      doos.schrijfJournaal('/api/supplier/staff/join', lijf, { ok: true });
      assert.equal(db.data.doosJournaal.length, 3, 'een wachtwoord als ' + vorm + ' gaat het journaal niet in');
    }
    // Tegenproef: het gaat om de SLEUTEL. Het woord als waarde, of een sleutel
    // die er alleen op lijkt, houdt een gewone handeling niet tegen.
    doos.schrijfJournaal('/api/supplier/order/notitie', { regels: [{ opmerking: 'wachtwoord van de wifi op de bon' }], passwordHint: 'nee' }, { ok: true });
    assert.equal(db.data.doosJournaal.length, 4, 'een gewoon lijf, ook genest, gaat er wel in');
  } finally { try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {} }
});

test('6. een regel van voor de reparatie, met een geldig zegel, wordt bij het naspelen overgeslagen', () => {
  const { doos, dir } = verseDoos();
  try {
    const key = fs.readFileSync(path.join(dir, 'dooszegel.key'));
    const zegel = (e) => require('crypto').createHmac('sha256', key)
      .update(JSON.stringify({ seq: e.seq, pad: e.pad, body: e.body || {}, res: e.res || null, at: e.at })).digest('base64url');
    const goed = { seq: 1, pad: '/api/supplier/overschot', body: { item: 'soep' }, res: null, at: 1 };
    goed.zegel = zegel(goed);
    assert.equal(doos.journaalGeldig(goed), true, 'de zegelberekening van de toets klopt met die van de doos');
    for (const oud of [
      { seq: 2, pad: '/api/supplier/login/', body: { username: 'rahul', password: 'Imran' }, res: null, at: 2 },
      { seq: 3, pad: '/api/supplier/mijn/login', body: { bewijs: 'b', code: '123456' }, res: null, at: 3 },
      { seq: 4, pad: '/api/supplier/staff/join', body: { login: 'a@b.c', password: 'geheim' }, res: null, at: 4 },
      { seq: 5, pad: '/api/supplier/staff/join', body: { account: { Wachtwoord: 'geheim' } }, res: null, at: 5 }
    ]) {
      oud.zegel = zegel(oud);
      assert.equal(doos.journaalGeldig(oud), false, oud.pad + ' gaat niet meer naar de cloud');
    }
  } finally { try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {} }
});
