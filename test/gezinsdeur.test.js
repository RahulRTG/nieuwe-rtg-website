/* De gezinsdeur op een ECHTE server (B18 en B19, CODECREDENTIALS.json
   foundation.family_profile_access): de 128-bit gezinscode die alleen in het
   antwoord op maken en roteren staat, het zes-tekenadres dat niets meer opent,
   de rem per adres EN per gezin, roteren en intrekken door de beheerder,
   wisselen met een lopende sessie (die niets verlengt), het eenmalige
   stroomticket voor beide live-kanalen, geen sessie meer in de URL, en het
   verlengen van een gezinssessie met een echte passkeyceremonie.

   De eenheden staan in test/gezinscode.test.js; de race over twee
   PostgreSQL-instances in test/gezinsuitnodiging.pg.test.js.

   Draai los: node --test test/gezinsdeur.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { startServer, stop } = require('./helper');
const { kantoorPasskey } = require('./kantoorpasskey');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-gezinsdeur-'));
let child, base;
test.before(async () => { ({ child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } })); });
test.after(() => { stop(child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

async function post(pad, body, extra) {
  const r = await fetch(base + pad, { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, extra || {}),
    body: JSON.stringify(body || {}) });
  const tekst = await r.text();
  let lijf = {}; try { lijf = JSON.parse(tekst); } catch (e) {}
  return { status: r.status, body: lijf, tekst, koppen: r.headers };
}
// Een volledig pad gaat ongewijzigd door, zodat de routedekking het ziet.
const F = (pad, body, extra) => post(pad.startsWith('/api/') ? pad : '/api/foundation' + pad, body, extra);
const kop = token => ({ Authorization: 'Bearer ' + token });
const mij = (code, token) => fetch(base + '/api/foundation/gezin/' + code + '/mij', { headers: kop(token) }).then(r => r.status);
const GC = /^GC\.[0-9A-F]{32}$/, GZ = /^GZ\.[0-9A-F]{32}$/, GS = /^GS\.[0-9A-F]{32}$/;
let teller = 0;

async function gezin(naam, pin = '2468') {
  const g = await F('/gezin/maak', { gezinsnaam: naam, naam: 'Beheerder', pin, bevoegdGezin: true, privacyAkkoord: true });
  assert.equal(g.status, 200, g.tekst);
  assert.match(g.body.gezinscode, GC, 'maken geeft de 128-bit gezinscode, een keer');
  assert.match(g.body.code, /^[A-Z0-9]{6}$/, 'code is het adres');
  assert.equal(g.koppen.get('cache-control'), 'no-store');
  return g.body;
}
async function kind(g, pin) {
  const k = await F('/gezin/profiel/maak', { code: g.code, token: g.token, naam: 'Kind ' + (++teller), rol: 'kind',
    geboortedatum: '2016-04-12', pin });
  assert.equal(k.status, 200, k.tekst);
  return k.body.profiel;
}
/* De eerste brok van een SSE-stroom lezen en hem dan sluiten. */
async function stroom(url) {
  const ac = new AbortController();
  const r = await fetch(base + url, { signal: ac.signal });
  let eerste = '';
  if (r.status === 200) { const { value } = await r.body.getReader().read(); eerste = Buffer.from(value || []).toString(); }
  ac.abort();
  return { status: r.status, eerste };
}

test('1. de gezinscode: 128 bits, alleen als hash, en het adres opent niets', async () => {
  const g = await gezin('Gezin Code');
  const opslag = fs.readdirSync(TMP).filter(f => /\.(json|db)$/.test(f))
    .map(f => fs.readFileSync(path.join(TMP, f)).toString('latin1')).join('\n');
  assert.equal(opslag.includes(g.gezinscode.slice(3)), false, 'de gezinscode staat nergens kaal op schijf');
  const goed = await F('/gezin/inloggen', { gezinscode: g.gezinscode, pin: '2468' });
  assert.equal(goed.status, 200, goed.tekst);
  assert.match(goed.body.token, GZ);
  assert.equal((await F('/gezin/inloggen', { gezinscode: g.gezinscode.slice(3).toLowerCase(), pin: '2468' })).status, 200,
    'zonder voorvoegsel en in kleine letters overgetypt werkt hij ook');
  for (const fout of [g.code, 'GC.' + '0'.repeat(32), g.gezinscode.slice(0, -1)]) {
    const r = await F('/gezin/inloggen', { gezinscode: fout, pin: '2468' });
    assert.equal(r.status, 403, fout + ' opent niets');
    assert.equal(r.tekst.includes('GZ.'), false);
  }
  assert.equal((await F('/gezin/inloggen', { code: g.code, pin: '2468' })).status, 403, 'het zes-tekenadres met de pincode opent niets');
  const k = await kind(g, '1357');
  assert.equal((await F('/gezin/profiel/kies', { code: g.code, profielId: k.id, pin: '1357' })).status, 403,
    'profiel kiezen op alleen het adres opent niets');
  assert.equal((await F('/gezin/profiel/kies', { gezinscode: g.gezinscode, profielId: k.id, pin: '1357' })).status, 200);
});

test('2. de rem per adres en per gezin', async () => {
  const a = await gezin('Gezin Rem A', '1111'), b = await gezin('Gezin Rem B', '2222');
  assert.equal((await F('/gezin/inloggen', { gezinscode: b.gezinscode, pin: '2222' })).status, 200, 'begin met een schone rem per adres');
  const fout = n => Promise.all(Array.from({ length: n }, () => F('/gezin/inloggen', { gezinscode: a.gezinscode, pin: '9999' })));
  await fout(5);
  assert.equal((await F('/gezin/inloggen', { gezinscode: a.gezinscode, pin: '1111' })).status, 200, 'goed na vijf missers');
  await fout(5);
  const dicht = await F('/gezin/inloggen', { gezinscode: a.gezinscode, pin: '1111' });
  assert.equal(dicht.status, 429, 'tien missers op dit gezin: ook de goede pincode wacht, al werd de rem per adres net gewist');
  assert.equal((await F('/gezin/inloggen', { gezinscode: b.gezinscode, pin: '2222' })).status, 200,
    'een ander gezin vanaf hetzelfde adres gaat gewoon door');
});

test('3. de beheerder roteert en trekt in; een kind kan dat niet', async () => {
  const g = await gezin('Gezin Roteer');
  const k = await kind(g, '1357');
  const kt = (await F('/gezin/profiel/kies', { gezinscode: g.gezinscode, profielId: k.id, pin: '1357' })).body.token;
  assert.equal((await F('/gezin/code/roteer', { code: g.code }, kop(kt))).status, 403, 'een kind roteert niet');
  const STAND = '/api/foundation/gezin/:code/gezinscode';
  assert.equal((await fetch(base + STAND.replace(':code', g.code), { headers: kop(kt) })).status, 403,
    'een kind ziet de stand niet');
  const st = await fetch(base + STAND.replace(':code', g.code), { headers: kop(g.token) }).then(r => r.json());
  assert.equal(st.status.stand, 'actief');
  assert.equal(JSON.stringify(st).includes('code_hash'), false, 'de stand toont nooit de hash');
  const rot = await F('/gezin/code/roteer', { code: g.code }, kop(g.token));
  assert.equal(rot.status, 200, rot.tekst);
  assert.match(rot.body.gezinscode, GC);
  assert.equal(rot.koppen.get('cache-control'), 'no-store');
  assert.equal((await F('/gezin/inloggen', { gezinscode: g.gezinscode, pin: '2468' })).status, 403, 'de vorige opent niets meer');
  assert.equal((await F('/gezin/inloggen', { gezinscode: rot.body.gezinscode, pin: '2468' })).status, 200);
  assert.equal(await mij(g.code, kt), 200, 'roteren laat lopende sessies staan');
  const af = await post('/api/foundation/gezin/code/intrek', { code: g.code }, kop(g.token));
  assert.deepEqual([af.status, af.body.ingetrokken, af.body.status.stand], [200, 1, 'ongeldig'], af.tekst);
  assert.equal((await F('/gezin/inloggen', { gezinscode: rot.body.gezinscode, pin: '2468' })).status, 403, 'ingetrokken');
  assert.equal((await post('/api/foundation/gezin/code/intrek', { code: g.code }, kop(g.token))).status, 200, 'nog eens intrekken is geen fout');
});

test('4. wisselen met een lopende sessie verlengt niets, en een gast wisselt niet', async () => {
  const g = await gezin('Gezin Wissel');
  const k = await kind(g, '1357');
  const kt = (await F('/gezin/profiel/kies', { gezinscode: g.gezinscode, profielId: k.id, pin: '1357' })).body.token;
  const w = await F('/gezin/inloggen', { code: g.code, pin: '2468' }, kop(kt));
  assert.equal(w.status, 200, w.tekst);
  assert.match(w.body.token, GZ);
  assert.equal(w.body.profiel.beheerder, true, 'met de pincode van de beheerder komt de beheerder');
  assert.equal((await F('/gezin/inloggen', { code: g.code, pin: '2468' }, kop('GZ.' + '0'.repeat(32)))).status, 403);
  assert.equal((await F('/gezin/inloggen', { code: g.code, pin: '2468', token: 'a'.repeat(48) })).status, 403);
  const reg = await post('/api/auth/register', { name: 'Opa', email: 'opa' + Date.now() + '@v.test', phone: '0612345678',
    password: 'geheim123', geboortedatum: '1950-01-01', tier: 'rtg' });
  const u = await F('/gezin/uitnodiging/maak', { code: g.code, token: g.token, naam: 'Opa', rol: 'gast', relatie: 'opa' });
  assert.equal((await post('/api/rtf/uitnodiging/accepteer', { uitnodiging: u.body.uitnodiging }, kop(reg.body.token))).status, 200);
  const kanaal = await post('/api/rtf/kanaal', { code: g.code }, kop(reg.body.token));
  assert.match(kanaal.body.token, GZ);
  assert.equal((await F('/gezin/inloggen', { code: g.code, pin: '2468' }, kop(kanaal.body.token))).status, 403,
    'het kanaal van een gast is geen inlog voor een gezinslid');
});

test('5. het stroomticket: eenmalig, per kanaal, en nooit de sessie in de URL', async () => {
  const g = await gezin('Gezin Stroom');
  const t1 = await F('/gezin/stroom/ticket', { code: g.code, kanaal: 'gezin' }, kop(g.token));
  assert.equal(t1.status, 200, t1.tekst);
  assert.match(t1.body.ticket, GS);
  assert.equal(t1.koppen.get('cache-control'), 'no-store');
  const open = await stroom('/api/foundation/gezin/' + g.code + '/kanaal?ticket=' + t1.body.ticket);
  assert.equal(open.status, 200);
  assert.match(open.eerste, /retry: 3000/);
  assert.equal((await stroom('/api/foundation/gezin/' + g.code + '/kanaal?ticket=' + t1.body.ticket)).status, 401, 'eenmalig');
  assert.equal((await stroom('/api/foundation/gezin/' + g.code + '/kanaal?token=' + g.token)).status, 401,
    'de sessie in de URL opent het gezinskanaal niet meer');
  assert.equal((await stroom('/api/rtf/social/stream?code=' + g.code + '&token=' + g.token)).status, 401,
    'en de sociale stroom ook niet');
  const t2 = await F('/gezin/stroom/ticket', { code: g.code, kanaal: 'gezin' }, kop(g.token));
  assert.equal((await stroom('/api/rtf/social/stream?code=' + g.code + '&ticket=' + t2.body.ticket)).status, 401,
    'een ticket voor het gezinskanaal opent de sociale stroom niet (en is daarna op)');
  const t3 = await F('/gezin/stroom/ticket', { code: g.code, kanaal: 'sociaal' }, kop(g.token));
  const sociaal = await stroom('/api/rtf/social/stream?code=' + g.code + '&ticket=' + t3.body.ticket);
  assert.equal(sociaal.status, 200);
  assert.match(sociaal.eerste, /retry: 3000/);
  const t4 = await F('/gezin/stroom/ticket', { code: g.code, kanaal: 'sociaal' }, kop(g.token));
  assert.equal((await F('/gezin/sessie/intrek', { code: g.code }, kop(g.token))).status, 200);
  assert.equal((await stroom('/api/rtf/social/stream?code=' + g.code + '&ticket=' + t4.body.ticket)).status, 401,
    'een ticket van een afgemelde sessie opent niets');
  assert.equal((await F('/gezin/stroom/ticket', { code: g.code, kanaal: 'gezin' }, kop(g.token))).status, 403);
  const vers = (await F('/gezin/inloggen', { gezinscode: g.gezinscode, pin: '2468' })).body.token;
  assert.equal(await mij(g.code, vers), 200, 'in de header werkt de verse sessie');
  assert.equal(await fetch(base + '/api/foundation/gezin/' + g.code + '/mij?token=' + vers).then(r => r.status), 403,
    'ook een gewone route leest geen sessie meer uit de query');
});

test('6. verlengen met een passkey: zeven dagen erbij, gebonden aan deze sessie; zonder passkey 409', async () => {
  const g = await gezin('Gezin Verleng');
  const zonderKop = await F('/gezin/sessie/verleng', { code: g.code, token: g.token });
  assert.equal(zonderKop.status, 400, 'zonder Authorization-header geen ceremonie');
  const geen = await F('/gezin/sessie/verleng', { code: g.code }, kop(g.token));
  assert.deepEqual([geen.status, geen.body.watNu], [409, 'opnieuw-inloggen'], geen.tekst);
  // een RTG-account met een passkey koppelt die aan het eigen gezinsprofiel
  const reg = await post('/api/auth/register', { name: 'Mama', email: 'mama' + Date.now() + '@v.test', phone: '0612345678',
    password: 'geheim123', geboortedatum: '1988-01-01', tier: 'rtg' });
  const lid = reg.body.token;
  const zonderPk = await post('/api/rtf/gezin/passkey', { code: g.code, token: g.token }, kop(lid));
  assert.equal(zonderPk.status, 403, 'een account zonder passkey koppelt niets (geen terugval): ' + zonderPk.tekst);
  const pk = kantoorPasskey(base);
  const sleutel = await pk.zet(lid);
  const origin = new URL(base).origin;
  assert.equal((await post('/api/rtf/gezin/passkey', { code: g.code, token: 'GZ.' + '0'.repeat(32) }, kop(lid))).status, 403);
  const vraag = await post('/api/rtf/gezin/passkey', { code: g.code, token: g.token }, kop(lid));
  assert.equal(vraag.status, 401, vraag.tekst);
  assert.equal(vraag.body.bevestigingNodig, true);
  sleutel.teller += 1;
  const koppel = await post('/api/rtf/gezin/passkey', { code: g.code, token: g.token, ceremonie: vraag.body.bevestiging.ceremonie,
    antwoord: sleutel.sleutel.loginAntwoord(vraag.body.bevestiging.opties.challenge, origin, sleutel.teller) }, kop(lid));
  assert.equal(koppel.status, 200, koppel.tekst);
  // verlengen: eerst de vraag, dan het antwoord met DEZELFDE sessie
  const v1 = await F('/gezin/sessie/verleng', { code: g.code }, kop(g.token));
  assert.equal(v1.status, 401, v1.tekst);
  const andere = (await F('/gezin/inloggen', { gezinscode: g.gezinscode, pin: '2468' })).body.token;
  sleutel.teller += 1;
  const antwoord = sleutel.sleutel.loginAntwoord(v1.body.bevestiging.opties.challenge, origin, sleutel.teller);
  const fout = await F('/gezin/sessie/verleng', { code: g.code, ceremonie: v1.body.bevestiging.ceremonie, antwoord }, kop(andere));
  assert.notEqual(fout.status, 200, 'een ceremonie van de ene sessie verlengt de andere niet');
  const v2 = await F('/gezin/sessie/verleng', { code: g.code }, kop(g.token));
  sleutel.teller += 1;
  const ok = await F('/gezin/sessie/verleng', { code: g.code, ceremonie: v2.body.bevestiging.ceremonie,
    antwoord: sleutel.sleutel.loginAntwoord(v2.body.bevestiging.opties.challenge, origin, sleutel.teller) }, kop(g.token));
  assert.equal(ok.status, 200, ok.tekst);
  assert.match(ok.body.token, GZ);
  assert.equal(ok.body.geldigDagen, 7);
  assert.equal(ok.koppen.get('cache-control'), 'no-store');
  assert.equal(await mij(g.code, g.token), 403, 'de verlengde sessie vervangt de oude');
  assert.equal(await mij(g.code, ok.body.token), 200);
  // ontkoppelen: daarna weer 409
  const weg = await post('/api/foundation/gezin/passkey/weg', { code: g.code }, kop(ok.body.token));
  assert.deepEqual([weg.status, weg.body.ontkoppeld], [200, 1]);
  assert.equal((await F('/gezin/sessie/verleng', { code: g.code }, kop(ok.body.token))).status, 409);
});
