/* ONNOZEL: de chaos-storm van menselijk gedrag. Geen 10 miljoen nette
   gebruikers (daar is orkaan.js voor), maar honderden mensen die tegelijk
   rare dingen doen: emoji in elk vak, lappen tekst, datums die niet
   bestaan, bedragen van niks, "ja" en "nee" door elkaar, HTML-plakwerk en
   codenamen met sluiptekens. Over de Butler-motor, het zorgprofiel, de
   reserveringen, de focus-tellers en de zoekfunctie tegelijk.

   De lat: NUL 5xx-antwoorden. Een 4xx is prima (dat is de motor die nee
   zegt); een 5xx betekent dat onnozel gedrag iets kapot kreeg.

   Draai: node scripts/onnozel.js   (~30 s, eigen server op poort 4073) */
const { spawn } = require('child_process');
const fs = require('fs'), os = require('os'), path = require('path');

const ROOT = path.join(__dirname, '..');
const PORT = 4073, BASE = 'http://127.0.0.1:' + PORT;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-onnozel-'));
const kind = spawn(process.execPath, ['--experimental-sqlite', path.join(ROOT, 'server', 'server.js')], {
  env: { ...process.env, NODE_ENV: 'test', PORT: String(PORT), RTG_DATA_DIR: TMP, SMTP_URL: '' },
  stdio: ['ignore', 'ignore', 'inherit']
});

const api = (pad, body, t) => fetch(BASE + '/api/' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
  body: JSON.stringify(body || {})
}).then(r => r.status).catch(() => 599);

// het repertoire van de onnozele mens
const EMOJI = ['🍕', '🦞', '🎉🎂', '😀😀😀', '🥜', '💶💶', '🤷', '🫠'];
const rommelZin = i => [
  'onthoud dat ik ' + EMOJI[i % EMOJI.length] + ' wil',
  'zoek ' + EMOJI[(i + 1) % EMOJI.length],
  'zet mijn 24 uur op ' + (90 + (i % 10)) + ' augustus',
  'stuur ' + (i % 3 === 0 ? '0' : '-' + i) + ' euro naar Noordelijke Ster',
  'ja', 'nee', 'JAAAA', 'help ' + '?'.repeat(i % 50),
  'bestel ' + (i % 100) + ' sangria bij Sunset Ibiza',
  'reserveer bij ' + EMOJI[i % EMOJI.length] + ' morgen om 25:99',
  'plan mijn dag ' + 'nu '.repeat(i % 30),
  'onthoud dat scriptalert' + i + ' mijn wachtwoord is',
  'a'.repeat(500 + (i % 5000))
][i % 13];

(async () => {
  for (let i = 0; i < 150; i++) {
    try { const r = await fetch(BASE + '/api/health'); if (r.ok) break; } catch (e) {}
    await new Promise(r => setTimeout(r, 200));
  }
  // 40 losse gast-sessies (elk een eigen rem-bak) + het demo-lid
  const login = tier => fetch(BASE + '/api/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tier })
  }).then(r => r.json()).then(d => d.token);
  const gasten = await Promise.all(Array.from({ length: 40 }, () => login('guest')));
  const lid = await login('rtg');

  const klussen = [];
  const tellers = new Map();
  const tel = s => tellers.set(s, (tellers.get(s) || 0) + 1);
  for (let i = 0; i < 400; i++) {
    const t = i % 10 === 0 ? lid : gasten[i % gasten.length];
    klussen.push(api('fluister', { q: rommelZin(i) }, t).then(tel));
    if (i % 7 === 0) klussen.push(api('fluister/focus', { scores: { ['🍕' + i]: -i, x: 'NaN' } }, t).then(tel));
    if (i % 11 === 0) klussen.push(api('zorgprofiel/zet', { allergenen: EMOJI[i % EMOJI.length].repeat(80), delen: i % 2 === 0 }, t).then(tel));
    if (i % 13 === 0) klussen.push(api('reserveer', { supplierCode: 'KIKUNOI', datum: '9999-99-99', tijd: '25:00', notitie: EMOJI[i % EMOJI.length] }, t).then(tel));
    if (i % 17 === 0) klussen.push(api('fluister/vergeet', { wat: 'alles' }, t).then(tel));
  }
  await Promise.all(klussen);

  const regels = [...tellers.entries()].sort((a, b) => a[0] - b[0]).map(([s, n]) => '  ' + s + ': ' + n).join('\n');
  const vijfxx = [...tellers.entries()].filter(([s]) => s >= 500).reduce((a, [, n]) => a + n, 0);
  console.log('ONNOZEL: ' + klussen.length + ' rommelverzoeken, statuscodes:\n' + regels);
  // en de server leeft nog gewoon
  const gezond = (await fetch(BASE + '/api/health')).ok;
  kind.kill('SIGKILL');
  fs.rmSync(TMP, { recursive: true, force: true });
  if (vijfxx > 0 || !gezond) {
    console.error('GEZAKT: ' + vijfxx + ' x 5xx' + (gezond ? '' : ' en de health-check faalt'));
    process.exit(1);
  }
  console.log('GESLAAGD: nul 5xx en de server draait nog fris.');
})().catch(e => { console.error(e); kind.kill('SIGKILL'); process.exit(1); });
