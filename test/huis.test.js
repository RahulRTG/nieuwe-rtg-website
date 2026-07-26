/* Het Huis: het reisdossier achter de hoofdingang. Toetst de belofte van
   kern/huis.js -- wat niet bevestigd is staat er ook zo bij, wat aan jou ligt
   is streng gescheiden van wat je alleen kunt afwachten, en het dossier is mee
   te nemen als platte tekst.
   Draai: node --experimental-sqlite --test test/huis.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer } = require('./helper');

let BASE, child, token;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-huis-'));

async function api(pad, body, tok) {
  const headers = { 'Content-Type': 'application/json' };
  if (tok) headers['Authorization'] = 'Bearer ' + tok;
  return fetch(BASE + pad, { method: 'POST', headers, body: JSON.stringify(body || {}) });
}
const json = r => r.json();

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } }));
  const t = Date.now();
  const reg = await json(await api('/api/auth/register', { name: 'Huis Lid', email: 'huis' + t + '@h.test',
    phone: '06' + String(t).slice(-8), password: 'geheim123', geboortedatum: '1985-04-04', tier: 'rtg' }));
  token = reg.token;
  assert.ok(token, 'het lid is aangemeld');
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('het dossier brengt de hele reis bij elkaar', async () => {
  const d = await json(await api('/api/member/huis/dossier', {}, token));
  assert.ok(d.ok && d.reis, 'er is een reis: ' + JSON.stringify(d).slice(0, 200));
  assert.equal(d.reis.bestemming, 'Ibiza');
  assert.ok(d.tijdlijn.length >= 6, 'de hele reis staat erin: ' + d.tijdlijn.length);
  // de volgorde van de reis blijft de volgorde van de reis
  assert.deepEqual(d.tijdlijn.map(t => t.nr), d.tijdlijn.map((_, i) => i + 1));
  // de datum is uit de tekstregel gehaald, niet verzonnen
  assert.equal(d.reis.datumBekend, true);
  assert.match(d.reis.vertrek, /^\d{4}-\d{2}-\d{2}$/);
});

test('wat niet bevestigd is, staat er ook zo bij', async () => {
  const d = await json(await api('/api/member/huis/dossier', {}, token));
  const betaald = d.tijdlijn.filter(t => t.bevestigd);
  const rest = d.tijdlijn.filter(t => !t.bevestigd);
  assert.ok(betaald.length && rest.length, 'de demo-reis heeft van allebei');
  // niets dat niet bevestigd is, draagt een bevestigd-label
  for (const t of rest) assert.equal(/bevestigd/i.test(t.label) && !/niet/i.test(t.label), false, t.label);
  assert.equal(d.bevestigd, betaald.length);
});

test('wat aan jou ligt is gescheiden van wat je alleen kunt afwachten', async () => {
  const d = await json(await api('/api/member/huis/dossier', {}, token));
  // "in aanvraag bij de partner" is geen taak van het lid
  assert.ok(d.afwachten.length >= 1, 'er wacht iets op een partner');
  assert.ok(d.afwachten.every(a => a.waar === null), 'afwachten heeft geen knop -- er valt niets te doen');
  // openstaande betalingen zijn dat wel, en wijzen naar waar je het oplost
  assert.ok(d.open.length >= 1, 'er staat iets open');
  const metFactuur = d.open.filter(o => /factuur/.test(o.waarom));
  assert.ok(metFactuur.length >= 1, 'een openstaande post noemt zijn factuur');
  assert.ok(metFactuur.every(o => o.waar), 'en wijst naar waar je hem betaalt');
  // de lijst heeft een bodem: hij is een afgeleide van de reis, niet oneindig
  assert.ok(d.open.length + d.afwachten.length <= d.tijdlijn.length + 20);
  assert.equal(d.gereed, false, 'er is nog werk, dus niet gereed');
});

test('de zin telt, en jaagt niet op', async () => {
  const d = await json(await api('/api/member/huis/dossier', {}, token));
  assert.ok(d.tekst.length > 10);
  assert.equal(/!|nog maar|snel|mis het niet|laatste kans/i.test(d.tekst), false, d.tekst);
  // de bron zegt eerlijk wat er NIET in staat
  assert.match(d.bron, /inreisvereisten/i);
});

test('het dossier is mee te nemen als platte tekst', async () => {
  const m = await json(await api('/api/member/huis/map', {}, token));
  assert.ok(m.ok && m.naam.endsWith('.txt'));
  assert.match(m.tekst, /REISDOSSIER/);
  assert.match(m.tekst, /Ibiza/);
  assert.match(m.tekst, /DE REIS/);
  // ook in de map blijft elke regel zijn eigen stand dragen
  assert.match(m.tekst, /\[Bevestigd\]/);
  assert.match(m.tekst, /\[Wacht op betaling\]|\[In aanvraag/);
  // geen echte naam of e-mailadres in een stuk dat je doorgeeft
  assert.equal(/Huis Lid|h\.test/.test(m.tekst), false, m.tekst.slice(0, 300));
});

test('Rahul verwoordt, maar telt niet zelf', async () => {
  const r = await json(await api('/api/member/huis/rahul', {}, token));
  const d = await json(await api('/api/member/huis/dossier', {}, token));
  assert.ok(r.ok && r.tekst);
  // zonder AI-sleutel is het antwoord exact de telling van de module
  if (!r.ai) assert.equal(r.tekst, d.tekst);
});

test('zonder inlog blijft het dossier dicht', async () => {
  for (const pad of ['/api/member/huis/dossier', '/api/member/huis/map', '/api/member/huis/rahul']) {
    const r = await fetch(BASE + pad, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    assert.equal(r.status, 401, pad);
  }
});
