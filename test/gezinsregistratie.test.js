/* De snelle gezinsdeur: code + eigen PIN zonder namenlek, kinderen onder de
   beheerder en volwassenen alleen via een persoonlijke eenmalige sleutel. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { startServer } = require('./helper');

let child, base, gezin;
const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-gezin-reg-'));
const post = (pad, body, token) => fetch(base + pad, { method:'POST',
  headers:{ 'Content-Type':'application/json', ...(token ? { Authorization:'Bearer ' + token } : {}) },
  body:JSON.stringify(body || {}) });
const json = r => r.json();
const f = (pad, body) => post('/api/foundation' + pad, body);

test.before(async () => {
  ({ child, base } = await startServer({ env:{ RTG_DATA_DIR:map, SMTP_URL:'' } }));
  gezin = await json(await f('/gezin/maak', { gezinsnaam:'Gezin Veilig', naam:'Beheerder', pin:'2468',
    bevoegdGezin:true, privacyAkkoord:true }));
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (_) {}
  try { fs.rmSync(map, { recursive:true, force:true }); } catch (_) {}
});

test('code plus eigen PIN opent direct één profiel en een foute PIN toont geen namen', async () => {
  const fout = await f('/gezin/inloggen', { code:gezin.code, pin:'0000' });
  assert.equal(fout.status, 403);
  assert.equal((await fout.text()).includes('Beheerder'), false);
  const goed = await json(await f('/gezin/inloggen', { code:gezin.code, pin:'2468' }));
  assert.equal(goed.profiel.naam, 'Beheerder');
  assert.ok(goed.token);
  assert.equal(goed.profielen, undefined);
});

test('een kind krijgt een eigen leeftijdspas en een unieke PIN', async () => {
  const kind = await f('/gezin/profiel/maak', { code:gezin.code, token:gezin.token,
    naam:'Noor', rol:'kind', geboortedatum:'2016-04-12', pin:'1357' });
  assert.equal(kind.status, 200, await kind.text());
  const dubbel = await f('/gezin/profiel/maak', { code:gezin.code, token:gezin.token,
    naam:'Sam', rol:'kind', geboortedatum:'2018-06-18', pin:'1357' });
  assert.equal(dubbel.status, 409);
});

test('een tweede ouder koppelt tweezijdig met een eenmalige uitnodiging', async () => {
  const zonder = await f('/gezin/uitnodiging/maak', { code:gezin.code, token:gezin.token,
    naam:'Tweede ouder', rol:'ouder' });
  assert.equal(zonder.status, 400);
  const gemaakt = await json(await f('/gezin/uitnodiging/maak', { code:gezin.code, token:gezin.token,
    naam:'Tweede ouder', rol:'ouder', relatie:'co-ouder', gezagVerklaard:true }));
  assert.match(gemaakt.uitnodiging, /^[A-Z0-9]{6}\.[A-Za-z0-9_-]{30,60}$/);
  const bekeken = await json(await f('/gezin/uitnodiging/bekijk', { uitnodiging:gemaakt.uitnodiging }));
  assert.equal(bekeken.uitnodiging.rol, 'ouder');
  assert.equal((await f('/gezin/uitnodiging/accepteer', { uitnodiging:gemaakt.uitnodiging,
    pin:'2468', akkoord:true, privacyAkkoord:true })).status, 409, 'PIN van beheerder mag niet worden hergebruikt');
  const geaccepteerd = await json(await f('/gezin/uitnodiging/accepteer', { uitnodiging:gemaakt.uitnodiging,
    pin:'8642', akkoord:true, privacyAkkoord:true }));
  assert.equal(geaccepteerd.profiel.rol, 'ouder');
  assert.ok(geaccepteerd.token);
  assert.equal((await f('/gezin/uitnodiging/accepteer', { uitnodiging:gemaakt.uitnodiging,
    pin:'9753', akkoord:true, privacyAkkoord:true })).status, 404, 'de sleutel werkt maar één keer');
});

test('een gast accepteert dezelfde persoonlijke sleutel veilig in de RTG-app', async () => {
  const gemaakt = await json(await f('/gezin/uitnodiging/maak', { code:gezin.code, token:gezin.token,
    naam:'Oma', rol:'gast', relatie:'oma' }));
  const login = await json(await post('/api/auth/login', { login:'roellie.i@gmail.com', password:'Imran' }));
  const link = base + '/apps/foundation/registreren.html#familie=' + encodeURIComponent(gemaakt.uitnodiging);
  const gekoppeld = await post('/api/rtf/uitnodiging/accepteer', { uitnodiging:link }, login.token);
  assert.equal(gekoppeld.status, 200, await gekoppeld.text());
  const overzicht = await json(await post('/api/rtf/overzicht', {}, login.token));
  assert.ok(overzicht.gezinnen.some(g => g.gezinNaam === 'Gezin Veilig' && g.profielNaam === 'Oma'));
});
