/* Bijlagen van buiten: door de scanner, en pas dan te openen.

   Vier beweringen, en de eerste is de enige die er echt toe doet:

   1. WAT NIET SCHOON IS, WORDT NIET BEWAARD. Een besmette bijlage komt niet in
      een quarantaine-map waar iemand later "toch even" bij kan -- hij is er
      gewoon niet, en wat blijft staan is de MELDING met de reden.
   2. Wat wel schoon is, is echt te openen: dezelfde bytes komen eruit als er
      binnenkwamen.
   3. Een bijlage hoort bij het BERICHT. Wie het bericht niet mag lezen, opent
      de bijlage niet -- ook niet met het id.
   4. De ontvanger ziet in de tekst van zijn bericht dat er iets bij zat, en of
      het geweigerd is. Een geweigerde bijlage die nergens genoemd wordt, is
      niet te onderscheiden van een bericht zonder bijlage.

   De EICAR-testreeks is de industriestandaard om een scanner te beproeven: hij
   is niet schadelijk maar wordt door elke scanner herkend. Zo hoeft deze toets
   geen echte malware te dragen.
   Draai: node --experimental-sqlite --test test/mailbijlage.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { startServer } = require('./helper');

let BASE, child, aTok, bTok, aAdres, bAdres;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-bijlage-'));

const rauw = (pad, body, tok) => {
  const h = { 'Content-Type': 'application/json' };
  if (tok) h.Authorization = 'Bearer ' + tok;
  return fetch(BASE + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
};
const post = async (pad, body, tok) => (await rauw(pad, body, tok)).body;

// de EICAR-testreeks, in stukken zodat dit bestand zelf geen scanner laat afgaan
const EICAR = ['X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR', '-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*'].join('');

function bericht(naar, bijlagen) {
  const grens = 'gr' + Math.random().toString(16).slice(2, 8);
  const stukken = [
    'From: Klant <klant@buiten.test>', 'To: ' + naar, 'Subject: Met bijlage',
    'MIME-Version: 1.0', 'Content-Type: multipart/mixed; boundary="' + grens + '"', '',
    '--' + grens, 'Content-Type: text/plain; charset=utf-8', '', 'Zie de bijlage.'
  ];
  for (const b of bijlagen) {
    stukken.push('--' + grens,
      'Content-Type: ' + b.soort,
      'Content-Disposition: attachment; filename="' + b.naam + '"',
      'Content-Transfer-Encoding: base64', '',
      Buffer.from(b.inhoud).toString('base64'));
  }
  stukken.push('--' + grens + '--', '');
  return stukken.join('\r\n');
}

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } }));
  const maak = async (naam, mail, tel) => (await post('/api/auth/register', { name: naam, email: mail,
    phone: tel, password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' })).token;
  aTok = await maak('Bijlage Een', 'bijl1@x.nl', '0612345681');
  bTok = await maak('Bijlage Twee', 'bijl2@x.nl', '0612345682');
  aAdres = (await post('/api/member/rtmail/adres', {}, aTok)).adres;
  bAdres = (await post('/api/member/rtmail/adres', {}, bTok)).adres;
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('een schone bijlage wordt bewaard en komt er byte voor byte weer uit', async () => {
  const inhoud = '%PDF-1.4\nnetjes een factuur\n';
  const r = await post('/api/mail/binnen', {
    bericht: bericht(aAdres, [{ naam: 'factuur.pdf', soort: 'application/pdf', inhoud }]), ip: '203.0.113.7' });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.bijlagen.length, 1);
  assert.equal(r.bijlagen[0].bewaard, true, JSON.stringify(r.bijlagen[0]));
  assert.equal(r.bijlagen[0].verdict, 'schoon');
  assert.equal(r.geweigerd, 0);

  const lijst = await post('/api/member/rtmail/bijlagen', { id: r.id }, aTok);
  assert.equal(lijst.bijlagen.length, 1);
  assert.equal(lijst.bijlagen[0].naam, 'factuur.pdf');
  assert.equal(lijst.bijlagen[0].bytes, Buffer.byteLength(inhoud));

  const open = await post('/api/member/rtmail/bijlage', { id: lijst.bijlagen[0].id }, aTok);
  assert.equal(open.ok, true, JSON.stringify(open));
  const terug = Buffer.from(open.inhoud.split(',')[1], 'base64').toString('latin1');
  assert.equal(terug, inhoud, 'dezelfde bytes als er binnenkwamen');
});

test('een BESMETTE bijlage wordt niet bewaard, en de reden staat in het bericht', async () => {
  const r = await post('/api/mail/binnen', {
    bericht: bericht(aAdres, [{ naam: 'rekening.exe', soort: 'application/octet-stream', inhoud: EICAR }]),
    ip: '203.0.113.7' });
  assert.equal(r.ok, true, 'het BERICHT komt gewoon aan; alleen de bijlage niet');
  assert.equal(r.bijlagen.length, 1);
  assert.equal(r.bijlagen[0].bewaard, false);
  assert.notEqual(r.bijlagen[0].verdict, 'schoon');
  assert.match(r.bijlagen[0].waarom, /scanner noemde deze bijlage/);
  assert.equal(r.geweigerd, 1);

  // hij is er ook echt niet
  const lijst = await post('/api/member/rtmail/bijlagen', { id: r.id }, aTok);
  assert.deepEqual(lijst.bijlagen, [], 'geen quarantaine-map waar iemand later bij kan');

  // maar de ontvanger ziet WEL dat er iets was
  const vak = await post('/api/member/rtmail/vak', {}, aTok);
  const m = vak.berichten.find(x => x.id === r.id);
  assert.match(m.tekst, /rekening\.exe -- GEWEIGERD/);
});

test('een bericht met een schone EN een besmette bijlage levert er precies een op', async () => {
  const r = await post('/api/mail/binnen', {
    bericht: bericht(aAdres, [
      { naam: 'goed.txt', soort: 'text/plain', inhoud: 'gewoon tekst' },
      { naam: 'slecht.com', soort: 'application/octet-stream', inhoud: EICAR }
    ]), ip: '203.0.113.7' });
  assert.equal(r.bijlagen.length, 2);
  assert.equal(r.bijlagen.filter(b => b.bewaard).length, 1);
  assert.equal(r.geweigerd, 1);
  const lijst = await post('/api/member/rtmail/bijlagen', { id: r.id }, aTok);
  assert.equal(lijst.bijlagen.length, 1);
  assert.equal(lijst.bijlagen[0].naam, 'goed.txt');
});

test('wie het bericht niet mag lezen, opent de bijlage niet -- ook niet met het id', async () => {
  const r = await post('/api/mail/binnen', {
    bericht: bericht(aAdres, [{ naam: 'prive.pdf', soort: 'application/pdf', inhoud: '%PDF-1.4\nprive' }]),
    ip: '203.0.113.7' });
  const lijst = await post('/api/member/rtmail/bijlagen', { id: r.id }, aTok);
  const id = lijst.bijlagen[0].id;

  const vreemd = await rauw('/api/member/rtmail/bijlage', { id }, bTok);
  assert.equal(vreemd.status, 403);
  assert.match(vreemd.body.error, /geen recht "lezen"/);
  const vreemdeLijst = await rauw('/api/member/rtmail/bijlagen', { id: r.id }, bTok);
  assert.equal(vreemdeLijst.status, 403, 'ook de LIJST is niet van hem');
});

test('na een delegatie mag de waarnemer de bijlage wel openen', async () => {
  const r = await post('/api/mail/binnen', {
    bericht: bericht(aAdres, [{ naam: 'waarneming.txt', soort: 'text/plain', inhoud: 'voor de waarnemer' }]),
    ip: '203.0.113.7' });
  const id = (await post('/api/member/rtmail/bijlagen', { id: r.id }, aTok)).bijlagen[0].id;
  await post('/api/member/rtmail/delegeer',
    { aan: bAdres, rechten: ['metadata', 'lezen'], reden: 'vakantiewaarneming' }, aTok);
  const open = await post('/api/member/rtmail/bijlage', { id }, bTok);
  assert.equal(open.ok, true, JSON.stringify(open));
  assert.equal(Buffer.from(open.inhoud.split(',')[1], 'base64').toString('latin1'), 'voor de waarnemer');
  /* En dat staat in het journaal: kijken in andermans postvak laat altijd een
     spoor na, ook als het mag. */
  const j = await post('/api/member/rtmail/journaal', {}, aTok);
  assert.ok(j.regels.some(x => /lezen/.test(x.wat)), 'de leeshandeling is vastgelegd');
});

test('zonder scanner wordt er niets bewaard -- de laag zet de deur niet stilzwijgend open', () => {
  const laag = require('../server/kern/mailbijlage')({
    db: { data: {} }, save: () => {}, crypto: require('crypto'), antivirus: null, dir: TMP });
  const uit = laag.verwerk('x1', [{ naam: 'a.txt', soort: 'text/plain', inhoud: Buffer.from('hoi'), bytes: 3 }]);
  assert.equal(uit[0].bewaard, false);
  assert.match(uit[0].waarom, /geen scanner/);
});

test('meer dan twintig bijlagen worden geweigerd met de reden, niet stil afgekapt', () => {
  const laag = require('../server/kern/mailbijlage')({
    db: { data: {} }, save: () => {}, crypto: require('crypto'),
    antivirus: { verwerk: () => ({ verdict: 'schoon', sha256: 'x', redenen: [] }) }, dir: TMP });
  const veel = Array.from({ length: 25 }, (_, i) => ({ naam: 'b' + i + '.txt', soort: 'text/plain',
    inhoud: Buffer.from('x'), bytes: 1 }));
  const uit = laag.verwerk('x2', veel);
  assert.equal(uit.length, 25, 'alle 25 krijgen een antwoord');
  assert.equal(uit.filter(x => x.bewaard).length, 20);
  assert.match(uit[20].waarom, /hooguit 20 bijlagen/);
});
