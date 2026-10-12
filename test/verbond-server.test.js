/* Het verbond tegen een ECHTE server (routes/member/verbond.js): elke nieuwe
   route minstens een keer, in een gewone CI-toets (LAT.md regel 17 -- een
   nagemaakt genootschap bewijst het handlergedrag, niet de montage of de deur).

   Wat dit toevoegt boven test/verbond.test.js: de kant komt ook OVER HTTP uit
   de sessie (een meegestuurde `kant` doet niets), de statuscodes bereiken de
   client (400/403/404/409), de melding komt aan op de SLEUTEL van de beheerder
   via /api/notifications, en de ledenlijst van het genootschap is na de hele
   keten onveranderd.

   Bij elke toets staat de MUTATIE die hem moet laten zakken; elk daarvan is een
   keer gedraaid en zakte.
   Draai los: node --test test/verbond-server.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer } = require('./helper');

let BASE, child;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-verbond-'));
const raw = (pad, body, token) => fetch(BASE + '/api' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
});
async function post(pad, body, token) {
  const r = await raw(pad, body, token);
  return { status: r.status, body: await r.json() };
}

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } }));
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

let teller = 0;
async function lid() {
  const t = Date.now() + '' + (teller++);
  const r = await (await raw('/auth/register', { name: 'Lid ' + t, email: 'vb' + t + '@v.test',
    phone: '06' + String(t).slice(-8), password: 'geheim123', geboortedatum: '1990-06-06', tier: 'rtg' })).json();
  const p = await (await raw('/metier/ik', {}, r.token)).json();
  return { token: r.token, codenaam: p.profiel.codenaam };
}

const AF = { geld: 'a', vrijwilligers: 'samen', persoonsgegevens: 'b', aansprakelijk: 'samen', rapportage: 'a' };

/* Twee genootschappen: A (openbaar, beheerder aBeh, lid aLid) en B (besloten,
   beheerder bBeh, lid bLid). Allemaal met een echte sessie. */
async function tweeGroepen() {
  const [aBeh, aLid, bBeh, bLid] = [await lid(), await lid(), await lid(), await lid()];
  const A = (await post('/genootschap/richt-op', { naam: 'De Zeilclub', soort: 'openbaar' }, aBeh.token)).body.groep;
  const B = (await post('/genootschap/richt-op', { naam: 'De Roeiclub', soort: 'besloten' }, bBeh.token)).body.groep;
  assert.ok((await post('/genootschap/binnen', { groep: A.id }, aLid.token)).body.ok);
  await post('/genootschap/nodig-uit', { groep: B.id, wie: bLid.codenaam }, bBeh.token);
  assert.ok((await post('/genootschap/binnen', { groep: B.id }, bLid.token)).body.ok);
  return { aBeh, aLid, bBeh, bLid, A, B };
}

const ledenlijst = async (w, groepId) =>
  JSON.stringify(((await post('/genootschap/mijn', {}, w.token)).body.groepen.find(g => g.id === groepId) || {}).ledenlijst);

// Zakt bij de mutatie: in routes/member/verbond.js de regel voor /api/verbond/teken weghalen -> 404 van de server, zakt.
// Zakt bij de mutatie: in kern/verbond teken `kk.beheer.filter` -> `R.KANTEN.filter` -> bBeh tekent voor A, zakt.
test('1. de hele keten over HTTP: voorstel, melding, tekenen per kant, actief, mijn en lees', async () => {
  const g = await tweeGroepen();
  const ledenA = await ledenlijst(g.aBeh, g.A.id), ledenB = await ledenlijst(g.bBeh, g.B.id);
  const meldVoor = (await post('/notifications', {}, g.bBeh.token)).body.notifications.length;

  const vs = await post('/verbond/voorstel', { groep: g.A.id, naar: g.B.id,
    doel: 'Samen een zomerregatta organiseren.', afspraken: AF }, g.aBeh.token);
  assert.equal(vs.status, 200, JSON.stringify(vs.body));
  assert.equal(vs.body.verbond.stand, 'concept');
  const id = vs.body.verbond.id;

  // de melding komt aan op de SLEUTEL van de beheerder van B, en blijft na herladen staan
  const meld = (await post('/notifications', {}, g.bBeh.token)).body.notifications;
  assert.equal(meld.length, meldVoor + 1);
  assert.match(meld[0].body, /De Zeilclub/);

  // bBeh stuurt `kant: 'a'` mee: dat doet niets, hij tekent voor B
  const b = await post('/verbond/teken', { verbond: id, kant: 'a' }, g.bBeh.token);
  assert.equal(b.status, 200, JSON.stringify(b.body));
  assert.equal(b.body.verbond.stand, 'getekend-b');
  assert.equal(b.body.verbond.tekens.a, null);
  const nog = await post('/verbond/teken', { verbond: id, kant: 'a' }, g.bBeh.token);
  assert.equal(nog.status, 200);
  assert.equal(nog.body.al, true);
  assert.equal(nog.body.verbond.tekens.a, null, 'nog steeds niet getekend voor A');

  const a = await post('/verbond/teken', { verbond: id }, g.aBeh.token);
  assert.equal(a.body.verbond.stand, 'actief');

  // beide kanten zien hetzelfde verbond (op wie-ben-ik na)
  const la = (await post('/verbond/lees', { verbond: id }, g.aBeh.token)).body.verbond;
  const lb = (await post('/verbond/lees', { verbond: id }, g.bBeh.token)).body.verbond;
  for (const veld of ['id', 'doel', 'afspraken', 'stand', 'actiefSinds', 'tijdlijn', 'keten'])
    assert.deepEqual(la[veld], lb[veld], veld + ' verschilt tussen de kanten');

  const mijnLid = await post('/verbond/mijn', {}, g.aLid.token);
  assert.equal(mijnLid.status, 200);
  assert.equal(mijnLid.body.verbonden.length, 1);

  // en de genootschappen zijn er niet door veranderd
  assert.equal(await ledenlijst(g.aBeh, g.A.id), ledenA);
  assert.equal(await ledenlijst(g.bBeh, g.B.id), ledenB);
});

// Zakt bij de mutatie: in regels.weergave voor de andere kant `leden: gr.leden` toevoegen -> de sleutels lekken, zakt.
test('2. een lid van A ziet van B de groepsnaam en geen enkele codenaam', async () => {
  const g = await tweeGroepen();
  const id = (await post('/verbond/voorstel', { groep: g.A.id, naar: g.B.id, doel: 'Een gezamenlijke clubdag.', afspraken: AF }, g.aBeh.token)).body.verbond.id;
  await post('/verbond/teken', { verbond: id }, g.aBeh.token);
  await post('/verbond/teken', { verbond: id }, g.bBeh.token);
  for (const [pad, body] of [['/verbond/lees', { verbond: id }], ['/verbond/mijn', {}]]) {
    const r = await post(pad, body, g.aLid.token);
    assert.equal(r.status, 200);
    const tekst = JSON.stringify(r.body);
    assert.ok(tekst.includes('De Roeiclub'), 'de groepsnaam van B staat erin');
    for (const w of [g.bBeh, g.bLid, g.aBeh]) assert.ok(!tekst.includes(w.codenaam), pad + ' toont een codenaam');
    assert.ok(!/leden/.test(tekst), pad + ' toont een ledenlijst');
  }
});

// Zakt bij de mutatie: in routes/member/verbond.js `uit` vervangen door `res.json(r)` (altijd 200) -> zakt.
test('3. de weigeringen bereiken de client met hun eigen code en een reden', async () => {
  const g = await tweeGroepen();
  const fout = await post('/verbond/voorstel', { groep: g.A.id, naar: g.B.id, doel: 'Iets samen.', afspraken: { geld: 'rtf' } }, g.aBeh.token);
  assert.equal(fout.status, 400);
  assert.match(fout.body.error, /hoort a, b of samen/);

  assert.equal((await post('/verbond/voorstel', { groep: g.A.id, naar: g.B.id, doel: 'Iets samen.', afspraken: AF }, g.aLid.token)).status, 403);
  assert.equal((await post('/verbond/voorstel', { groep: g.A.id, naar: 987654321, doel: 'Iets samen.', afspraken: AF }, g.aBeh.token)).status, 404);
  const verzonnen = await post('/verbond/lees', { verbond: 'vb00000000deadbeef' }, g.aBeh.token);
  assert.equal(verzonnen.status, 404);
  assert.ok(verzonnen.body.error);
  assert.equal((await post('/verbond/teken', { verbond: 'vb00000000deadbeef' }, g.aBeh.token)).status, 404);

  const id = (await post('/verbond/voorstel', { groep: g.A.id, naar: g.B.id, doel: 'Iets samen.', afspraken: AF }, g.aBeh.token)).body.verbond.id;
  // een buitenstaander krijgt hetzelfde als bij een verzonnen id
  const vreemde = await lid();
  assert.equal((await post('/verbond/lees', { verbond: id }, vreemde.token)).status, 404);
  // zonder sessie: geen deur
  assert.equal((await raw('/verbond/mijn', {})).status, 401);
});

// Zakt bij de mutatie: in kern/verbond wijzig `v.tekens = { a: null, b: null }` weghalen -> stand blijft actief, zakt.
// Zakt bij de mutatie: in kern/verbond dicht() de opgezegd-tak weghalen -> teken na opzeggen geeft 200, zakt.
test('4. wijzigen zet de tekens terug; opzeggen sluit het verbond met 409 en het blijft leesbaar', async () => {
  const g = await tweeGroepen();
  const id = (await post('/verbond/voorstel', { groep: g.A.id, naar: g.B.id, doel: 'Een gezamenlijke clubdag.', afspraken: AF }, g.aBeh.token)).body.verbond.id;
  await post('/verbond/teken', { verbond: id }, g.aBeh.token);
  await post('/verbond/teken', { verbond: id }, g.bBeh.token);

  const w = await post('/verbond/wijzig', { verbond: id, doel: 'Twee gezamenlijke clubdagen.' }, g.bBeh.token);
  assert.equal(w.status, 200, JSON.stringify(w.body));
  assert.equal(w.body.verbond.stand, 'concept');
  assert.deepEqual(w.body.verbond.tekens, { a: null, b: null });

  const z = await post('/verbond/zeg-op', { verbond: id, reden: 'Ons bestuur stopt ermee.' }, g.aBeh.token);
  assert.equal(z.status, 200, JSON.stringify(z.body));
  assert.equal(z.body.verbond.stand, 'opgezegd');
  const nog = await post('/verbond/zeg-op', { verbond: id, reden: 'Nog een keer.' }, g.aBeh.token);
  assert.equal(nog.status, 200);
  assert.deepEqual(nog.body.verbond, z.body.verbond, 'een herhaalde opzegging verandert niets');

  for (const [pad, body] of [['/verbond/teken', { verbond: id }], ['/verbond/wijzig', { verbond: id, doel: 'Toch weer.' }],
    ['/verbond/zeg-op', { verbond: id, reden: 'Wij ook.' }]]) {
    const r = await post(pad, body, g.bBeh.token);
    assert.equal(r.status, 409, pad);
    assert.match(r.body.error, /opgezegd/);
  }
  const lees = await post('/verbond/lees', { verbond: id }, g.bBeh.token);
  assert.equal(lees.status, 200);
  assert.equal(lees.body.verbond.opzegging.reden, 'Ons bestuur stopt ermee.');
});

/* De meting achter de mutatiecontracten (server/lib/mutatiecontracten-verbond.js):
   elke route twee keer met HETZELFDE lijf tegen een echte server, en geteld wat
   er na de tweede keer anders is. Er mag niets bijkomen: geen tweede verbond,
   geen tweede tijdlijnregel, geen tweede melding.
   MUTATIE: in kern/verbond zegOp de regel `if (kk.beheer.includes(v.opzegging.kant)) return { ok: true, al: true ...}`
   weghalen -> de tweede opzegging geeft 409, zakt. */
test('5. elke route twee keer met hetzelfde lijf: hetzelfde antwoord en geen tweede effect', async () => {
  const g = await tweeGroepen();
  const tel = async () => {
    const m = (await post('/verbond/mijn', {}, g.aBeh.token)).body.verbonden;
    return { verbonden: m.length, regels: m.reduce((n, v) => n + v.tijdlijn.length, 0),
      meldingen: (await post('/notifications', {}, g.bBeh.token)).body.notifications.length };
  };
  const tweeKeer = async (pad, lijf, wie) => {
    const een = await post(pad, lijf, wie.token);
    const voor = await tel();
    const twee = await post(pad, lijf, wie.token);
    assert.deepEqual(await tel(), voor, pad + ': de tweede oproep had een effect');
    assert.equal(twee.status, een.status, pad);
    assert.deepEqual(twee.body.verbond, een.body.verbond, pad + ': een ander verbond terug');
    return { een, twee };
  };
  const vs = await tweeKeer('/verbond/voorstel', { groep: g.A.id, naar: g.B.id, doel: 'Een herhaalde clubdag.', afspraken: AF }, g.aBeh);
  assert.equal(vs.twee.body.al, true);
  const id = vs.een.body.verbond.id;
  assert.equal((await tweeKeer('/verbond/teken', { verbond: id }, g.aBeh)).twee.body.al, true);
  await tweeKeer('/verbond/teken', { verbond: id }, g.bBeh);
  await tweeKeer('/verbond/mijn', {}, g.aBeh);
  await tweeKeer('/verbond/lees', { verbond: id }, g.aBeh);
  const w = await tweeKeer('/verbond/wijzig', { verbond: id, doel: 'Twee herhaalde clubdagen.' }, g.aBeh);
  assert.equal(w.twee.body.al, true, 'dezelfde wijziging nog eens is geen wijziging');
  const z = await tweeKeer('/verbond/zeg-op', { verbond: id, reden: 'Het seizoen is voorbij.' }, g.aBeh);
  assert.equal(z.twee.body.al, true);
});
