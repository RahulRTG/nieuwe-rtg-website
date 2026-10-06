/* Zaakdoos-journaal, beveiliging: het journaal wordt na herstel nagespeeld naar
   de cloud met de inlog van de doos. Daarom is het gezegeld (HMAC), genummerd
   (seq) en padgebonden. Getoetst: een geschreven regel krijgt een volgnummer en
   een geldig zegel; manipuleren maakt het zegel ongeldig; alleen zaak-paden gaan
   erin (nooit inloggen, accounts, de doos zelf of een pad met ..); en een te
   grote body wordt geweigerd. Sinds N27 ook: geen inlogroute in welke spelling
   ook, van het antwoord alleen de refs, geen lijf met een wachtwoord, en een
   oude regel die dat wel heeft gaat bij het naspelen niet naar de cloud.

   SLOT 4B OP EEN EIGEN PAD (ronde 6b). Toets 5 en 6 beproefden het wachtwoordlijf
   op /api/supplier/staff/join. Sinds N29 staat dat pad op INLOG_PADEN, dus viel
   zo'n regel al bij slot 1 af en hield niets slot 4B nog vast: zonder
   draagtWachtwoord, zonder een van de twee namen of zonder af te dalen bleef
   alles groen. Het lijf gaat daarom nu over PAD_4B, een zaakpad dat langs slot 1
   KOMT, en elke toets die dat pad gebruikt eist dat eerst. Toets 7 neemt elke
   spelling op elke diepte die de dieptewacht doorlaat, toets 8 de refvertaling
   bij het naspelen. De bedrading door een echte doos staat in toets 2 van
   test/doos-inlogjournaal.test.js.
   Draai los: node --test test/doos-journaal.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const http = require('http'); const crypto = require('crypto');
const { draagtWachtwoord } = require('../server/kern/zaakdoos/journaal');
const { isInlogPad } = require('../server/middleware/remmen');
const { teDiep, MAX_DIEPTE } = require('../server/opzet/lijfpoort');

/* Een zaakpad dat geen inlog is en dus langs slot 1 komt. Met opzet geen
   bestaande route: slot 4B is er voor de deur die er morgen bij komt, of een
   client die te veel meestuurt. */
const PAD_4B = '/api/supplier/proef/lijf';
function eisLangsSlot1(doos) {
  assert.equal(isInlogPad(PAD_4B), false, PAD_4B + ' staat op INLOG_PADEN; dan beproeft deze toets slot 1 en niet slot 4B');
  assert.equal(doos.journaalPadOk(PAD_4B), true, PAD_4B + ' moet slot 1 passeren, anders zegt een weigering niets over slot 4B');
}
/* Het zegel zoals de doos het zet, voor een regel die schrijfJournaal zelf nooit
   zou maken (een oude, of een met het volle antwoord). */
function zegelVan(dir) {
  const key = fs.readFileSync(path.join(dir, 'dooszegel.key'));
  return (e) => crypto.createHmac('sha256', key)
    .update(JSON.stringify({ seq: e.seq, pad: e.pad, body: e.body || {}, res: e.res || null, at: e.at })).digest('base64url');
}

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
test('4. geen inlogroute in het journaal, ook niet met een slash, via de werkplekinlog of de aanmelding', () => {
  const { doos, db, dir } = verseDoos();
  try {
    // de aanmelding van personeel staat sinds N29 op INLOG_PADEN, dus hier en niet in slot 4B
    for (const pad of ['/api/supplier/login', '/api/supplier/login/', '/api/supplier/mijn/login', '/api/supplier/mijn/login/',
      '/api/supplier/staff/join', '/api/supplier/staff/join/']) {
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
    eisLangsSlot1(doos);
    doos.schrijfJournaal(PAD_4B, { bedrijf: 'Sal de Mar', kassacode: 'KC', login: 'a@b.c', password: 'geheim' }, { ok: true });
    const rij = db.data.doosJournaal;
    assert.deepEqual(rij.map(e => e.pad), ['/api/supplier/mijn/wissel', '/api/supplier/staff/invite', '/api/supplier/order/maak'],
      'een lijf met een RTG-wachtwoord staat er niet in');
    assert.equal(rij[0].res, null, 'geen werktoken uit een wissel');
    assert.deepEqual(rij[1].res, { invite: { id: 'sinv-1' } }, 'geen kassacode, wel de ref');
    assert.deepEqual(rij[2].res, { order: { ref: 'R-1', pickup: 'P7', regels: [null, { id: 'r2' }] } }, 'de vorm blijft, voor leerRefs');
    assert.ok(rij.every(e => doos.journaalGeldig(e)), 'de ingekorte regels dragen een geldig zegel');

    /* DE TWEEDE VERDEDIGING IN DE VIER TAKKEN. Een plat 'password' in kleine
       letters bewijst alleen die ene vorm: zonder hoofdletterlezing, zonder de
       Nederlandse naam of zonder af te dalen bleef deze toets groen (herkeuring
       N27). Elk lijf hieronder vangt er precies een, zodat de melding zegt welke
       tak brak; toets 7 neemt daarna elke spelling op elke diepte. */
    const geweigerd = [
      ['hoofdletters', { bedrijf: 'Sal de Mar', PASSWORD: 'geheim' }],
      ['de Nederlandse naam', { bedrijf: 'Sal de Mar', wachtwoord: 'geheim' }],
      ['genest object', { account: { login: 'a@b.c', password: 'geheim' } }],
      ['in een lijst', { leden: [{ naam: 'A' }, { naam: 'B', password: 'geheim' }] }]
    ];
    for (const [vorm, lijf] of geweigerd) {
      doos.schrijfJournaal(PAD_4B, lijf, { ok: true });
      assert.equal(db.data.doosJournaal.length, 3, 'een wachtwoord als ' + vorm + ' gaat het journaal niet in');
    }
    // Tegenproef: het gaat om de SLEUTEL. Het woord als waarde, of een sleutel
    // die er alleen op lijkt, houdt een gewone handeling niet tegen.
    doos.schrijfJournaal(PAD_4B, { regels: [{ opmerking: 'wachtwoord van de wifi op de bon' }], passwordHint: 'nee' }, { ok: true });
    assert.equal(db.data.doosJournaal.length, 4, 'een gewoon lijf, ook genest en op hetzelfde pad, gaat er wel in');
  } finally { try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {} }
});

test('6. een regel van voor de reparatie, met een geldig zegel, wordt bij het naspelen overgeslagen', () => {
  const { doos, dir } = verseDoos();
  try {
    const zegel = zegelVan(dir);
    const goed = { seq: 1, pad: '/api/supplier/overschot', body: { item: 'soep' }, res: null, at: 1 };
    goed.zegel = zegel(goed);
    assert.equal(doos.journaalGeldig(goed), true, 'de zegelberekening van de toets klopt met die van de doos');
    // slot 1: een inlogpad, ook de aanmelding van personeel sinds N29
    for (const oud of [
      { seq: 2, pad: '/api/supplier/login/', body: { username: 'rahul', password: 'Imran' }, res: null, at: 2 },
      { seq: 3, pad: '/api/supplier/mijn/login', body: { bewijs: 'b', code: '123456' }, res: null, at: 3 },
      { seq: 4, pad: '/api/supplier/staff/join', body: { login: 'a@b.c', password: 'geheim' }, res: null, at: 4 }
    ]) {
      oud.zegel = zegel(oud);
      assert.equal(doos.journaalGeldig(oud), false, oud.pad + ' gaat niet meer naar de cloud');
    }
    // slot 4B: een pad dat langs slot 1 komt, met een wachtwoord in het lijf
    eisLangsSlot1(doos);
    for (const body of [{ login: 'a@b.c', password: 'geheim' }, { account: { Wachtwoord: 'geheim' } }]) {
      const oud = { seq: 5, pad: PAD_4B, body, res: null, at: 5 };
      oud.zegel = zegel(oud);
      assert.equal(doos.journaalGeldig(oud), false, 'een oude regel met ' + JSON.stringify(body) + ' gaat niet naar de cloud');
    }
    // tegenproef: hetzelfde pad en zegel zonder wachtwoordsleutel is wel geldig
    const gewoon = { seq: 6, pad: PAD_4B, body: { account: { wachtwoordHint: 'geheim' } }, res: null, at: 6 };
    gewoon.zegel = zegel(gewoon);
    assert.equal(doos.journaalGeldig(gewoon), true, 'het lijf, en niet het pad of het zegel, gaf de doorslag');
  } finally { try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {} }
});

/* SLOT 4B IN ELKE SPELLING EN OP ELKE DIEPTE. Elke hoofdlettervorm van beide
   namen, op elk niveau van 1 tot de grens van de dieptewacht (MAX_DIEPTE in
   server/opzet/lijfpoort.js: een dieper lijf komt nooit bij het journaal), en
   onder een object of in een lijst. Een vaste dieptegrens, een vergeten naam of
   een lijst die niet wordt doorzocht laat hier een rij achter. De tegenproef
   draagt dezelfde vorm met een sleutel die er alleen op lijkt, en het woord als
   waarde: een te ruime lezing houdt die tegen en zakt dan ook. */
const SPELLINGEN = ['password', 'PASSWORD', 'Password', 'pAsSwOrD', 'wachtwoord', 'WACHTWOORD', 'Wachtwoord'];
function genest(sleutel, niveau, lijst) {
  let v = { [sleutel]: 'password', naam: 'wachtwoord' };
  for (let d = niveau - 1; d >= 1; d--) v = (lijst && d % 2) ? [{ ander: 1 }, v] : { laag: v };
  return v;
}
test('7. slot 4B: een wachtwoordsleutel in elke spelling en op elke diepte houdt de regel buiten het journaal', () => {
  const { doos, db, dir } = verseDoos();
  try {
    eisLangsSlot1(doos);
    const zegel = zegelVan(dir);
    assert.equal(teDiep(genest('x', MAX_DIEPTE, true)), false, 'het diepste lijf hieronder komt langs de dieptewacht');
    assert.equal(teDiep(genest('x', MAX_DIEPTE + 1, true)), true, 'een niveau dieper niet meer, dus dit is elke diepte die telt');
    const gemist = { herkend: [], geschreven: [], geldig: [], tegen: [] };
    const lengte = () => (db.data.doosJournaal || []).length;
    let seq = 0;
    for (const spelling of SPELLINGEN) {
      for (let niveau = 1; niveau <= MAX_DIEPTE; niveau++) {
        for (const lijst of [false, true]) {
          const waar = spelling + ' op niveau ' + niveau + (lijst ? ' via een lijst' : '');
          const lijf = genest(spelling, niveau, lijst);
          if (!draagtWachtwoord(lijf)) gemist.herkend.push(waar);
          const voor = lengte();
          doos.schrijfJournaal(PAD_4B, lijf, { ok: true });
          if (lengte() !== voor) gemist.geschreven.push(waar);
          const oud = { seq: ++seq, pad: PAD_4B, body: lijf, res: null, at: seq };
          oud.zegel = zegel(oud);
          if (doos.journaalGeldig(oud)) gemist.geldig.push(waar);
          // de tegenproef: zelfde vorm, maar de sleutel lijkt er alleen op
          const gewoon = genest(spelling + 'Hint', niveau, lijst);
          const nu = lengte();
          doos.schrijfJournaal(PAD_4B, gewoon, { ok: true });
          const tegen = { seq: ++seq, pad: PAD_4B, body: gewoon, res: null, at: seq };
          tegen.zegel = zegel(tegen);
          if (draagtWachtwoord(gewoon) || lengte() !== nu + 1 || !doos.journaalGeldig(tegen)) gemist.tegen.push(waar);
        }
      }
    }
    const kop = (l) => l.length + ' gemist, o.a. ' + l.slice(0, 4).join('; ');
    assert.deepEqual(gemist.herkend, [], 'draagtWachtwoord herkent: ' + kop(gemist.herkend));
    assert.deepEqual(gemist.geschreven, [], 'schrijfJournaal weigert: ' + kop(gemist.geschreven));
    assert.deepEqual(gemist.geldig, [], 'journaalGeldig weigert bij het naspelen: ' + kop(gemist.geldig));
    assert.deepEqual(gemist.tegen, [], 'een gewone sleutel in dezelfde vorm gaat er wel in: ' + kop(gemist.tegen));
    assert.equal(lengte(), SPELLINGEN.length * MAX_DIEPTE * 2, 'precies de tegenproeven staan erin');
  } finally { try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {} }
});
