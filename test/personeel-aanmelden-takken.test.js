/* POST /api/supplier/staff/join (server/routes/supplier/werving/
   personeel-aanmelden.js), rechtstreeks aangeroepen met een nagemaakte app,
   kern en uitnodiging: elke stap van de volgorde (bedrijf en kassacode, dan
   account en wachtwoord, dan de code voor dit lid, dan "al aangemeld") en elke
   weigering ervan. De toets tegen een echte server staat in
   test/staffjoin-orakel.test.js; hier gaat het om de takken zelf, en om dat een
   weigering in stap 1 tot en met 3 altijd hetzelfde antwoord is. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const maakRoute = require('../server/routes/supplier/werving/personeel-aanmelden');

const ZAAK = { code: 'ZAAK01', name: 'Kikunoi' };
const LID = { id: 41, password_hash: 'hash:goed' };

function wereld(o = {}) {
  const handlers = {};
  const pogingen = [];
  const loginFails = new Map();
  const verbonden = [];
  const kern = {
    app: { post: (pad, h) => { handlers[pad] = h; } },
    loginFails,
    noteFailedTry: (sleutel, ip, gewicht) => { pogingen.push({ sleutel, ip, gewicht }); },
    tooManyTries: (res, sleutel) => { if (o.dicht) { res.status(429).json({ error: 'te veel' }); return true; } void sleutel; return false; },
    accounts: Object.assign({
      findByLogin: (login) => { if (o.findGooit) throw new Error('kluis dicht'); return login === 'vera' ? LID : null; },
      verifyPassword: async (ww, hash) => hash === 'hash:goed' && ww === 'juist',
      staffByMember: (code, id) => !!o.alAangemeld && code === ZAAK.code && id === LID.id,
      makePin: () => '9876',
    }, o.accounts || {}),
  };
  const uitnodiging = {
    findSupplierByName: naam => (naam === 'Kikunoi' ? ZAAK : null),
    kassacodeHoortBij: async (code, zaak, lid) => {
      if (code !== 'KAS-1' || zaak !== ZAAK.code) return false;
      return lid ? !o.codeNietVoorLid : true;
    },
    verbindCode: async (lid, code, extra, zaak) => {
      verbonden.push({ lid, code, extra, zaak });
      if (o.verbindGooit) throw new Error('transactie mislukt');
      if (o.verbind !== undefined) return o.verbind;
      return { staff: { id: 'st-7' }, naam: 'Vera', invite: { role: 'bediening' } };
    },
  };
  if (o.viaKern) { kern.personeelsUitnodiging = uitnodiging; maakRoute({ kern }); }
  else maakRoute({ kern }, uitnodiging);
  const roep = async (body) => {
    const res = { code: 200, body: null, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; } };
    await handlers['/api/supplier/staff/join']({ ip: '203.0.113.9', body }, res);
    return res;
  };
  return { roep, pogingen, loginFails, verbonden, handlers };
}
const GOED = { bedrijf: ' Kikunoi ', kassacode: 'kas-1', login: 'vera', password: 'juist' };
const ONJUIST = /Bedrijfsnaam, kassacode of RTG-inlog klopt niet/;
const stil = async (fn) => { const oud = console.error; console.error = () => {}; try { return await fn(); } finally { console.error = oud; } };

test('een dichte adresrem stuurt alleen haar eigen 429', async () => {
  const w = wereld({ dicht: true });
  const r = await w.roep(GOED);
  assert.equal(r.code, 429);
  assert.equal(w.verbonden.length, 0);
});

test('zonder bedrijfsnaam of kassacode: 400 en een poging op het adres', async () => {
  const w = wereld();
  for (const body of [{}, { bedrijf: 'Kikunoi' }, { kassacode: 'KAS-1' }]) {
    const r = await w.roep(body);
    assert.equal(r.code, 400);
    assert.match(r.body.error, /bedrijfsnaam en de kassacode/);
  }
  assert.deepEqual(w.pogingen.map(p => p.sleutel), ['join:203.0.113.9', 'join:203.0.113.9', 'join:203.0.113.9']);
});

test('stap 1: een onbekend bedrijf of een vreemde kassacode geeft hetzelfde antwoord, zonder gok op het account', async () => {
  const w = wereld();
  const a = await w.roep({ ...GOED, bedrijf: 'Verzonnen' });
  const b = await w.roep({ ...GOED, kassacode: 'KAS-2' });
  for (const r of [a, b]) { assert.equal(r.code, 401); assert.match(r.body.error, ONJUIST); }
  assert.deepEqual(a.body, b.body);
  assert.ok(w.pogingen.every(p => p.sleutel.startsWith('join:')), 'alleen de adresemmer telt, geen accountgok');
});

test('stap 2: geen account of een fout wachtwoord telt in de accountemmer', async () => {
  const w = wereld();
  const a = await w.roep({ ...GOED, login: 'niemand' });
  const b = await w.roep({ ...GOED, password: 'fout' });
  const c = await w.roep({ ...GOED, password: undefined });
  for (const r of [a, b, c]) { assert.equal(r.code, 401); assert.match(r.body.error, ONJUIST); }
  const gokken = w.pogingen.filter(p => p.gewicht === 25);
  assert.equal(gokken.length, 3, 'elke gok weegt in de emmer van /api/auth/login');
  assert.notEqual(gokken[0].sleutel, gokken[1].sleutel, 'een bestaand account heeft een andere sleutel dan een getikte naam');
});

test('stap 3: een uitgezet account of een code die bij een ander lid hoort: zelfde antwoord', async () => {
  const uit = wereld({ accounts: { isActief: () => false } });
  const r1 = await uit.roep(GOED);
  assert.equal(r1.code, 401);
  assert.match(r1.body.error, ONJUIST);
  const ander = wereld({ codeNietVoorLid: true });
  const r2 = await ander.roep(GOED);
  assert.equal(r2.code, 401);
  assert.deepEqual(r1.body, r2.body);
  assert.equal(ander.pogingen.filter(p => p.gewicht === 25).length, 0, 'geen wachtwoordgok: het wachtwoord klopte');
});

test('een storing tijdens de toetsing geeft 503 en geen koppeling', async () => {
  const w = wereld({ findGooit: true });
  const r = await stil(() => w.roep(GOED));
  assert.equal(r.code, 503);
  assert.match(r.body.error, /niet veilig worden voltooid/);
});

test('stap 4: al aangemeld geeft 409, en de accountemmer is geleegd', async () => {
  const w = wereld({ alAangemeld: true });
  w.loginFails.set('vooraf', { n: 1 });
  const r = await w.roep(GOED);
  assert.equal(r.code, 409);
  assert.match(r.body.error, /al aangemeld/);
  assert.equal(w.verbonden.length, 0);
});

test('verbindCode: gooit (503), weigert met eigen status, of geeft niets terug (403)', async () => {
  const a = wereld({ verbindGooit: true });
  assert.equal((await stil(() => a.roep(GOED))).code, 503);
  const b = wereld({ verbind: { error: 'Deze uitnodiging is verlopen.', status: 410, geheim: 'x' } });
  const rb = await b.roep(GOED);
  assert.equal(rb.code, 410);
  assert.deepEqual(rb.body, { error: 'Deze uitnodiging is verlopen.' }, 'alleen de weigering, nooit het hele antwoord');
  const c = wereld({ verbind: { error: 'Nee.' } });
  assert.equal((await c.roep(GOED)).code, 403);
  const d = wereld({ verbind: null });
  const rd = await d.roep(GOED);
  assert.equal(rd.code, 403);
  assert.equal(rd.body.error, 'Ongeldige uitnodiging.');
  assert.ok(d.pogingen.some(p => p.sleutel === 'join:203.0.113.9'));
});

test('geslaagd: de koppeling krijgt de kassacode in hoofdletters en zonder pin', async () => {
  const w = wereld();
  const r = await w.roep(GOED);
  assert.equal(r.code, 200);
  assert.deepEqual(r.body, { ok: true, code: 'ZAAK01', staffId: 'st-7', name: 'Vera', role: 'bediening' });
  assert.deepEqual(w.verbonden[0], { lid: LID, code: 'KAS-1', extra: {}, zaak: 'ZAAK01' });
});

test('met een toegestane oude pincode: zelf gekozen, gemaakt, of geweigerd als hij geen vier cijfers is', async () => {
  const opties = { accounts: { legacyStaffPinToegestaan: () => true } };
  const fout = wereld(opties);
  const rf = await fout.roep({ ...GOED, pin: '12a4' });
  assert.equal(rf.code, 400);
  assert.match(rf.body.error, /vier cijfers/);
  const eigen = wereld(opties);
  await eigen.roep({ ...GOED, pin: ' 4321 ' });
  assert.deepEqual(eigen.verbonden[0].extra, { pin: '4321' });
  const gemaakt = wereld(opties);
  await gemaakt.roep(GOED);
  assert.deepEqual(gemaakt.verbonden[0].extra, { pin: '9876' });
  const nietToegestaan = wereld({ accounts: { legacyStaffPinToegestaan: () => false } });
  await nietToegestaan.roep({ ...GOED, pin: 'xx' });
  assert.deepEqual(nietToegestaan.verbonden[0].extra, {}, 'zonder toestemming wordt een pin genegeerd');
});

test('de uitnodiging mag ook uit de kern komen', async () => {
  const w = wereld({ viaKern: true });
  const r = await w.roep(GOED);
  assert.equal(r.code, 200);
  assert.equal(r.body.staffId, 'st-7');
});
