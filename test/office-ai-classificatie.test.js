/* DE AI-SCHRIJFHULP LEEST DE CLASSIFICATIE (OFFICE.md par. 4, grens 4).

   Een strikt document mag niet gedeeld worden (kern/office/delen.js,
   rechten.js), maar de drie opdrachten die nieuwe taal maken (herschrijven,
   engels, doorschrijven) stuurden de eerste 6000 tekens toch naar een model.
   Een model is ook een ontvanger.

   DE WAARNEMING IS WAT HET MODEL KRIJGT, niet wat de route teruggeeft. Een
   nep-modelserver op 127.0.0.1 (LOCAL_AI_URL, met RTG_EXTERNE_AI_UIT=1 zodat
   dit de enige uitgang is) vangt elk verzoek op. Twee beweringen, en de tweede
   is de tegenproef zonder welke de eerste niets zegt:

     1. strikt: 403 CLASSIFICATIE_STRIKT, en het model ziet NIETS van de tekst;
     2. intern: 200, en het model ziet de tekst WEL. Zonder deze proef staat
        toets 1 ook groen als de modelweg om een heel andere reden dicht zit.

   En 3: de lokale regeltaken blijven werken op een strikt document, want die
   verlaten het huis niet.

   Draai los: node --test test/office-ai-classificatie.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { startServer, stop } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-office-ai-'));
const MERK = 'Overnamebod-Zilverreiger-7731';

function nepModel() {
  return new Promise((resolve) => {
    const gezien = [];
    const srv = http.createServer((req, res) => {
      const brok = [];
      req.on('data', c => brok.push(c));
      req.on('end', () => {
        gezien.push(Buffer.concat(brok).toString());
        res.statusCode = 200;
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({ choices: [{ message: { content: 'Herschreven voorstel.' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 5, completion_tokens: 2 } }));
      });
    });
    srv.listen(0, '127.0.0.1', () => resolve({ srv, gezien, base: 'http://127.0.0.1:' + srv.address().port }));
  });
}

let model, srv, base, token;
const api = (pad, body) => fetch(base + pad, { method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
  body: JSON.stringify(body || {}) }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

async function doc(classificatie) {
  const t = await api('/api/kantoorpakket/maak', { soort: 'tekst', titel: 'Memo ' + classificatie });
  assert.equal(t.status, 200);
  await api('/api/kantoorpakket/bewaar', { id: t.body.id,
    inhoud: { tekst: '<p>' + MERK + ': de raad besluit vrijdag. Jan levert de cijfers.</p>' } });
  const b = await api('/api/kantoorpakket/beheer', { id: t.body.id, classificatie });
  assert.equal(b.status, 200, 'classificatie ' + classificatie + ' gezet');
  return t.body.id;
}
const zagMerk = () => model.gezien.some(s => s.includes(MERK));

test.before(async () => {
  model = await nepModel();
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP,
    LOCAL_AI_URL: model.base, LOCAL_AI_MODEL: 'proefmodel', RTG_EXTERNE_AI_UIT: '1' } });
  base = srv.base;
  const u = Date.now().toString().slice(-8);
  const reg = await fetch(base + '/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Lid AI', email: 'ai' + u + '@x.nl', phone: '06' + u, password: 'geheim123',
      geboortedatum: '1990-05-05', geslacht: 'v', tier: 'rtg', pasApp: 'rtg' }) }).then(r => r.json());
  token = reg.token;
  assert.ok(token, 'lid ingelogd');
});
test.after(() => {
  stop(srv && srv.child);
  try { model.srv.close(); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. een strikt document gaat niet naar een taalmodel', async () => {
  const id = await doc('strikt');
  for (const opdracht of ['herschrijven', 'engels', 'doorschrijven']) {
    const r = await api('/api/kantoorpakket/ai', { id, opdracht });
    assert.equal(r.status, 403, opdracht + ': geweigerd');
    assert.equal(r.body.code, 'CLASSIFICATIE_STRIKT');
    assert.equal(r.body.handmatig, true, 'het document blijft bruikbaar');
  }
  assert.equal(zagMerk(), false, 'het model heeft geen letter van het strikte document gezien');
});

test('2. tegenproef: een intern document komt wel bij het model aan', async () => {
  const id = await doc('intern');
  const r = await api('/api/kantoorpakket/ai', { id, opdracht: 'herschrijven' });
  assert.equal(r.status, 200, 'de modelweg is open');
  assert.equal(zagMerk(), true, 'het model zag de tekst: de waarneming in toets 1 kan dus uitslaan');
});

test('3. de lokale regeltaken blijven werken op een strikt document', async () => {
  const id = await doc('strikt');
  const voor = model.gezien.length;
  for (const opdracht of ['samenvatten', 'inkorten', 'actiepunten', 'kritisch']) {
    const r = await api('/api/kantoorpakket/ai', { id, opdracht });
    assert.equal(r.status, 200, opdracht);
    assert.equal(r.body.stand, 'lokaal');
  }
  assert.equal(model.gezien.length, voor, 'geen van de vier raakte het model');
});
