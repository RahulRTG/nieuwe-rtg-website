/* HERSTELPROEF -- werkt de backup echt, of nemen we dat aan?

   Een backup die je nooit hebt teruggezet is geen backup maar een aanname.
   Deze proef doet daarom de hele ronde die je op een slechte dag zou moeten
   doen, en doet het echt: server starten, een lid aanmaken, backup laten
   maken, de datamap WISSEN, terugzetten, opstarten, en controleren of alles
   er nog is -- inclusief of de echte naam achter de codenaam nog leesbaar is.

   Het laatste stuk is waar het om draait. De backup bevat db.json, rtg.db en
   store.db, maar NIET vault.key en secret.key. Dat is met opzet: zou de
   sleutel in dezelfde backup zitten, dan opent een gestolen backup zichzelf
   en is de hele kluis theater. Maar het betekent wel dat de backup in zijn
   eentje niets waard is: zonder de sleutel uit de secrets manager krijg je
   rtg.db terug als onleesbare brij, en zijn alle namen voorgoed weg.

   Test 3 bewijst precies dat. Hij hoort te slagen -- niet omdat het goed
   nieuws is, maar omdat het de eigenschap is die je moet kennen VOOR je hem
   op een slechte dag ontdekt.

   Draai los: node --experimental-sqlite --test test/herstelproef.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const BASIS = 4900 + Math.floor(Math.random() * 60);
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-herstel-'));
const KLUIS = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-kluis-')); // "secrets manager"
const SERVER = path.join(__dirname, '..', 'server', 'server.js');

// de sleutels horen ELDERS te staan; hier doen we alsof dat een kluis is
const VAULT = 'a'.repeat(64), SECRET = 'b'.repeat(64);
const NAAM = 'Herman Herstel', MAIL = 'herman@herstelproef.test';

const wacht = (ms) => new Promise(r => setTimeout(r, ms));

/* Start een server op de gegeven datamap en wacht tot hij antwoordt. */
async function start(poort, extra) {
  const kind = spawn(process.execPath, ['--experimental-sqlite', SERVER], {
    env: {
      ...process.env, NODE_ENV: 'test', PORT: String(poort), RTG_DATA_DIR: TMP,
      SMTP_URL: '', RTG_DEMO: '0', RTG_VAULT_KEY: VAULT, RTG_SECRET_KEY: SECRET, ...extra
    },
    stdio: 'ignore'
  });
  for (let i = 0; i < 150; i++) {
    try { if ((await fetch('http://127.0.0.1:' + poort + '/api/health')).ok) return kind; } catch (e) {}
    await wacht(200);
  }
  kind.kill();
  throw new Error('server op poort ' + poort + ' kwam niet op');
}
async function stop(kind) { if (kind) { kind.kill(); await wacht(600); } }
function post(poort, pad, body, tok) {
  const h = { 'Content-Type': 'application/json' };
  if (tok) h.Authorization = 'Bearer ' + tok;
  return fetch('http://127.0.0.1:' + poort + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) });
}

let codenaam = null;

test('1. een lid aanmaken en de backup laten draaien', async () => {
  let kind = await start(BASIS);
  const reg = await post(BASIS, '/api/auth/register', {
    name: NAAM, email: MAIL, phone: '0622222222', password: 'geheim12345',
    geboortedatum: '1985-03-03', tier: 'rtg', pasApp: 'rtg'
  });
  assert.equal(reg.status, 200, 'registreren lukt');
  const tok = (await reg.json()).token;
  const st = await (await post(BASIS, '/api/state', {}, tok)).json();
  codenaam = (st.state || st).user.codename;
  assert.ok(codenaam, 'het lid heeft een codenaam');
  await stop(kind);

  /* De backup draait bij het opstarten. Door nu opnieuw te starten maken we
     er een MET dit lid erin -- precies zoals de dagelijkse backup dat 's
     nachts zou doen. */
  kind = await start(BASIS);
  await stop(kind);

  const bdir = path.join(TMP, 'backups');
  assert.ok(fs.existsSync(bdir), 'er is een backupmap');
  const dagen = fs.readdirSync(bdir).sort();
  assert.ok(dagen.length >= 1, 'er staat minstens een dagbackup');
  const inhoud = fs.readdirSync(path.join(bdir, dagen[dagen.length - 1]));
  assert.ok(inhoud.includes('rtg.db'), 'de identiteitskluis zit in de backup');
  // en de sleutel juist NIET -- sleutel en slot horen niet in dezelfde doos
  assert.ok(!inhoud.includes('vault.key'), 'de kluissleutel zit NIET in de backup, en dat hoort zo');
  assert.ok(!inhoud.includes('secret.key'), 'de tokensleutel ook niet');
});

test('2. datamap wissen, terugzetten uit de backup, en alles is er nog', async () => {
  const bdir = path.join(TMP, 'backups');
  const laatste = path.join(bdir, fs.readdirSync(bdir).sort().pop());
  const bewaard = fs.readdirSync(laatste).map(f => [f, fs.readFileSync(path.join(laatste, f))]);

  /* De ramp: de hele datamap weg. Zo ziet het eruit als de schijf sneuvelt of
     als iemand de verkeerde map verwijdert. */
  fs.rmSync(TMP, { recursive: true, force: true });
  fs.mkdirSync(TMP, { recursive: true });

  // Het herstel, precies zoals een beheerder het zou doen: de bestanden terug,
  // en de sleutels uit de kluis (hier: de omgevingsvariabelen).
  for (const [naam, inhoud] of bewaard) fs.writeFileSync(path.join(TMP, naam), inhoud);
  fs.writeFileSync(path.join(KLUIS, 'bewijs'), 'sleutels komen hiervandaan, niet uit de backup');

  const kind = await start(BASIS + 1);
  try {
    // het lid kan gewoon weer inloggen: het accountdossier overleefde
    const inlog = await post(BASIS + 1, '/api/auth/login', { login: MAIL, password: 'geheim12345', pasApp: 'rtg' });
    assert.equal(inlog.status, 200, 'het herstelde account kan inloggen (kreeg ' + inlog.status + ')');
    const tok = (await inlog.json()).token;

    const st = (await (await post(BASIS + 1, '/api/state', {}, tok)).json());
    const user = (st.state || st).user;
    assert.equal(user.codename, codenaam, 'dezelfde codenaam als voor de ramp');
    // en de kluis doet het weer: de echte naam is leesbaar
    assert.equal(user.full, NAAM, 'de echte naam achter de codenaam is terug uit de kluis');
    assert.equal(user.email, MAIL, 'en het e-mailadres ook');
  } finally { await stop(kind); }
});

test('3. zonder de sleutel is de backup onleesbaar -- dus bewaar hem apart', async () => {
  /* Dezelfde herstelde bestanden, maar nu start de server met een ANDERE
     kluissleutel: dat is wat er gebeurt als je de backup wel hebt en de
     secrets manager niet. De data staat er, maar de namen komen er niet meer
     uit. Dat is geen bug -- het is waarom versleuteling werkt -- maar het is
     wel de reden dat "we hebben backups" een half antwoord is. */
  const kind = await start(BASIS + 2, { RTG_VAULT_KEY: 'c'.repeat(64) });
  try {
    const inlog = await post(BASIS + 2, '/api/auth/login', { login: MAIL, password: 'geheim12345', pasApp: 'rtg' });
    if (inlog.status === 200) {
      const st = await (await post(BASIS + 2, '/api/state', {}, (await inlog.json()).token)).json();
      const user = (st.state || st).user;
      assert.notEqual(user.full, NAAM, 'met de verkeerde sleutel komt de echte naam er NIET uit');
    } else {
      // ook goed: met een andere sleutel klopt de e-mail-hash niet meer, dus
      // het account is niet eens vindbaar. Ook dan is de naam onbereikbaar.
      assert.ok(inlog.status >= 400, 'zonder de juiste sleutel is het dossier onbereikbaar');
    }
  } finally { await stop(kind); }
});

test.after(() => {
  for (const d of [TMP, KLUIS]) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (e) {} }
});
