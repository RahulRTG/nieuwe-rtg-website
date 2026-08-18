/* RTF-golf 6 (deel 2): de nieuwe coach-soorten voor de welzijnsapps.
   Zonder AI-sleutel geeft elke soort zijn EIGEN warme demotekst (de knop
   werkt dus altijd), een onbekende soort valt veilig terug, en de
   veiligheidslijnen staan in de teksten zelf (Kindertelefoon, huisarts).
   Draai los: node --test test/rtfwelzijn2.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer } = require('./helper');

let BASE;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtf-welzijn2-'));
let child, sess;

const api = (pad, body) => fetch(BASE + '/api/foundation' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) })
  .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '', ANTHROPIC_API_KEY: '' }, wachtPad: '/api/foundation/health' }));
  const g = await api('/gezin/maak', { gezinsnaam: 'Fam Coach', naam: 'Mam', pin: '1234' });
  sess = { code: g.body.code, token: g.body.token };
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

const vraag = (kind) => api('/hulp/ai', Object.assign({}, sess, { kind, messages: [{ role: 'user', content: 'Hoi' }] }));

test('1. elke nieuwe soort heeft een eigen demotekst: de knop werkt ook zonder sleutel', async () => {
  const kenmerk = {
    gevoel: /voelt|gevoel|Kindertelefoon/i,
    mediawijs: /scherm|blokkeer|appgroep/i,
    gezondheid: /huisarts|kleine stappen/i,
    dromen: /droom|stapje|Bibliotheek/i
  };
  const teksten = {};
  for (const kind of Object.keys(kenmerk)) {
    const r = await vraag(kind);
    assert.equal(r.status, 200);
    assert.ok(r.body.demo, kind + ': zonder sleutel is het eerlijk een demo-antwoord');
    assert.ok(kenmerk[kind].test(r.body.text), kind + ': het antwoord gaat over het eigen thema');
    teksten[kind] = r.body.text;
  }
  assert.equal(new Set(Object.values(teksten)).size, 4, 'vier soorten, vier eigen teksten');
});

test('2. de veiligheidslijnen staan in de teksten zelf', async () => {
  assert.ok(/0800-0432/.test((await vraag('gevoel')).body.text), 'gevoel noemt de Kindertelefoon');
  assert.ok(/huisarts/i.test((await vraag('gezondheid')).body.text), 'gezondheid wijst naar de huisarts');
});

test('3. een onbekende soort valt veilig terug en de oude soorten doen het nog', async () => {
  const onbekend = await vraag('tovenarij');
  assert.equal(onbekend.status, 200, 'geen fout, gewoon een veilige terugval');
  const pesten = await vraag('pesten');
  assert.ok(/Kindertelefoon/.test(pesten.body.text), 'de bestaande soorten zijn onaangeroerd');
});
