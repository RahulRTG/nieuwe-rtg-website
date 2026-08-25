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

/* INTREKKEN IS DE ENIGE NOODREM OP EEN UITGEDEELDE SLEUTEL.

   Een uitnodiging is 48 uur geldig en geeft een vreemde een volwassen plek in
   een gezin. Gaat hij naar het verkeerde adres, dan is intrekken het enige wat
   er tussen die vreemde en de kinderprofielen staat -- wachten tot hij vanzelf
   verloopt is geen antwoord. Deze toets houdt drie dingen vast: alleen de
   beheerder mag het, de sleutel opent daarna geen deur meer (niet alleen een
   ander label in het overzicht), en intrekken kan maar een keer.

   DE MUTATIES (LAT.md regel 2), alle vier gedaan in server/foundation/
   gezinsuitnodiging.js en alle vier zag ik deze toets zakken:
     - de regel `if (!beheerderVan(...)) return;` eruit  -> de 403 valt weg
     - de 409-tak op `u.status !== 'open'` eruit         -> tweemaal intrekken lukt
     - `u.status = 'ingetrokken'` niet meer zetten       -> lijst en beide deuren
     - `router.post('/gezin/uitnodiging/intrek')` eruit  -> 404 op alles

   Wat deze toets NIET bewijst, en dat is met opzet zo opgeschreven: dat
   `delete u.sleutelHash` de hash echt uit de opslag haalt. Die regel is
   diepteverdediging -- `verlopen()` weigert al op de status alleen, dus hem
   weghalen verandert niets aan wat de buitenkant antwoordt (die mutatie zag ik
   dan ook NIET zakken). Om hem te dekken zou deze toets in de sqlite-opslag
   moeten graven, en dat knoopt een gezinstoets vast aan de opslaglaag. */
test('de beheerder trekt een openstaande uitnodiging in en de sleutel is daarna dood', async () => {
  const gemaakt = await json(await f('/gezin/uitnodiging/maak', { code:gezin.code, token:gezin.token,
    naam:'Buurvrouw Els', rol:'gezinslid', relatie:'huisgenoot' }));
  assert.ok(gemaakt.id, 'een verse uitnodiging draagt een id om mee in te trekken');

  assert.equal((await f('/gezin/uitnodiging/intrek', { code:gezin.code, id:gemaakt.id })).status, 403,
    'zonder beheerderstoken trekt niemand een uitnodiging in');
  assert.equal((await f('/gezin/uitnodiging/intrek', { code:gezin.code, token:gezin.token, id:'bestaatniet' })).status, 404);

  const voor = await json(await f('/gezin/uitnodigingen', { code:gezin.code, token:gezin.token }));
  assert.equal(voor.uitnodigingen.find(u => u.id === gemaakt.id).status, 'open');

  const ingetrokken = await f('/gezin/uitnodiging/intrek', { code:gezin.code, token:gezin.token, id:gemaakt.id });
  const antwoord = await ingetrokken.text();
  assert.equal(ingetrokken.status, 200, antwoord);
  assert.deepEqual(JSON.parse(antwoord), { ok:true });

  const na = await json(await f('/gezin/uitnodigingen', { code:gezin.code, token:gezin.token }));
  assert.equal(na.uitnodigingen.find(u => u.id === gemaakt.id).status, 'ingetrokken');

  assert.equal((await f('/gezin/uitnodiging/bekijk', { uitnodiging:gemaakt.uitnodiging })).status, 404,
    'de ingetrokken sleutel opent geen deur meer');
  assert.equal((await f('/gezin/uitnodiging/accepteer', { uitnodiging:gemaakt.uitnodiging,
    pin:'7531', akkoord:true, privacyAkkoord:true })).status, 404,
    'en er is met die sleutel ook geen profiel meer mee te maken');

  assert.equal((await f('/gezin/uitnodiging/intrek', { code:gezin.code, token:gezin.token, id:gemaakt.id })).status, 409,
    'wat niet meer open staat, is niet nog eens in te trekken');
});
