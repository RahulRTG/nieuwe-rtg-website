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

let BASE, child, token, demo;
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
  /* TWEE SESSIES, WANT ER ZIJN TWEE GEVALLEN.

     Deze toetsen draaiden allemaal op een VERS AANGEMELD account en verwachtten
     daar een volle reis naar Ibiza. Dat werkte alleen doordat elk nieuw account
     de demo-reis uit de seed erfde (memberTemplate kopieerde db.data.trip), en
     dat is precies wat er is rechtgezet: wie zich echt aanmeldt heeft geen reis
     van iemand anders. Het dossier zelf is niet veranderd.

     Dus: de demo-SESSIE (inloggen op een pas zonder account, alleen onder DEMO)
     heeft de demo-reis en toetst wat het dossier DOET; het verse account toetst
     wat het dossier zegt als er nog niets is. */
  const dl = await json(await api('/api/login', { tier: 'rtg' }));
  demo = dl.token;
  assert.ok(demo, 'de demo-sessie staat open');
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('het dossier brengt de hele reis bij elkaar', async () => {
  const d = await json(await api('/api/member/huis/dossier', {}, demo));
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
  const d = await json(await api('/api/member/huis/dossier', {}, demo));
  const betaald = d.tijdlijn.filter(t => t.bevestigd);
  const rest = d.tijdlijn.filter(t => !t.bevestigd);
  assert.ok(betaald.length && rest.length, 'de demo-reis heeft van allebei');
  // niets dat niet bevestigd is, draagt een bevestigd-label
  for (const t of rest) assert.equal(/bevestigd/i.test(t.label) && !/niet/i.test(t.label), false, t.label);
  assert.equal(d.bevestigd, betaald.length);
});

test('wat aan jou ligt is gescheiden van wat je alleen kunt afwachten', async () => {
  const d = await json(await api('/api/member/huis/dossier', {}, demo));
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
  const d = await json(await api('/api/member/huis/dossier', {}, demo));
  assert.ok(d.tekst.length > 10);
  assert.equal(/!|nog maar|snel|mis het niet|laatste kans/i.test(d.tekst), false, d.tekst);
  // de bron zegt eerlijk wat er NIET in staat
  assert.match(d.bron, /inreisvereisten/i);
});

test('het dossier is mee te nemen als platte tekst', async () => {
  const m = await json(await api('/api/member/huis/map', {}, demo));
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

/* EN HET GEVAL DAT ER EERST NIET WAS: EEN LID DAT NOG NERGENS HEEN GAAT.

   Tot voor kort bestond dit geval niet, omdat elk nieuw account de demo-reis
   erfde. Nu is het het GEWONE geval -- iedereen begint zo -- en dan hoort het
   dossier te zeggen dat er nog niets is, en zeker niet de reis van een ander te
   tonen. */
test('een vers aangemeld lid krijgt een leeg dossier, niet dat van de demo', async () => {
  const d = await json(await api('/api/member/huis/dossier', {}, token));
  assert.equal(d.ok, true, 'het dossier opent gewoon: ' + JSON.stringify(d).slice(0, 160));
  assert.equal(d.reis, null, 'er staat geen reis in, kreeg: ' + JSON.stringify(d.reis));
  assert.deepEqual(d.tijdlijn, [], 'en dus ook geen tijdlijn van iemand anders');
  assert.equal(d.gereed, true, 'er ligt niets bij dit lid');
  assert.match(d.tekst, /nog geen reis/i, 'en het zegt dat gewoon: ' + d.tekst);
  assert.equal(/Ibiza|Formentera|Cala Jondal|Aguamarina/.test(JSON.stringify(d)), false,
    'geen spoor van de demo-reis: ' + JSON.stringify(d).slice(0, 200));

  const m = await json(await api('/api/member/huis/map', {}, token));
  assert.equal(m.ok, true, 'de map komt er ook');
  assert.equal(/Ibiza|REISDOSSIER/.test(m.tekst), false, 'en is leeg in plaats van andermans reis: ' + m.tekst);
  assert.equal(/Huis Lid|h\.test/.test(m.tekst), false, 'nog steeds geen echte naam erin');
});

test('Rahul verwoordt, maar telt niet zelf', async () => {
  const r = await json(await api('/api/member/huis/rahul', {}, demo));
  const d = await json(await api('/api/member/huis/dossier', {}, demo));
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
