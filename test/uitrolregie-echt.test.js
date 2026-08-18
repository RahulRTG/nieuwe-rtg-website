/* DE UITROLREGIE OP EEN ECHTE SERVER.

   test/uitrolregie.test.js toetst de regels; dit toetst dat hij ook werkelijk
   aan de schakelkast hangt. Dat verschil is niet academisch: de motor krijgt
   schakelFase LAAT binnen (kern.afdelingen bestaat nog niet als de laag wordt
   gebouwd), en een verkeerde binding valt in een pure toets nooit op -- daar is
   schakelFase immers nagebootst.

   De rusttijd en het foutpercentage zijn hier niet af te dwingen zonder te
   wachten of moedwillig te slopen; die staan in de pure toets. Wat hier telt:
   zet een trede en de kast gaat echt om, en de trap sluit de voordeur nooit.

   Draai los: node --experimental-sqlite --test test/uitrolregie-echt.test.js */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop } = require('./helper');
const fs = require('fs'), os = require('os'), path = require('path');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-uitrol-'));
let srv, base, office;

const api = (pad, body, tok) => fetch(base + pad, { method: 'POST',
  headers: Object.assign({ 'Content-Type': 'application/json' }, tok ? { Authorization: 'Bearer ' + tok } : {}),
  body: JSON.stringify(body || {}) }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  office = (await api('/api/auth/login', { login: 'roellie.i@gmail.com', password: 'Imran', pasApp: 'business' })).body.token;
  assert.ok(office, 'kantoor ingelogd');
});
test.after(() => { stop(srv && srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

test('de trap staat in de stand, met precies twee mensremmen', async () => {
  const s = await api('/api/command/uitrol', {}, office);
  assert.equal(s.status, 200, JSON.stringify(s.body));
  assert.deepEqual(s.body.trap.map(t => t.id),
    ['start', 'ontmoeten', 'partners', 'bestellen', 'fundament', 'stad', 'alles']);
  assert.deepEqual(s.body.trap.filter(t => t.mens).map(t => t.id), ['ontmoeten', 'fundament'],
    'geld en het kanaal tussen twee leden, en verder niets');
});

test('een trede zetten schakelt de kast ECHT om', async () => {
  const r = await api('/api/command/uitrol/zet', { trede: 'start' }, office);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.trede, 'start');
  assert.ok(r.body.uit > r.body.aan, 'het merendeel gaat dicht');

  // en dat is aan de deuren te merken
  assert.equal((await api('/api/pay/overzicht', {}, office)).status, 503, 'betalen dicht');
  assert.equal((await api('/api/salon/promo', {}, office)).status, 200, 'De Salon open');
});

test('DE VOORDEUR BLIJFT OPEN OP ELKE TREDE -- de fout die dit ontwerp veroorzaakte', async () => {
  /* Hiervoor sloten `fundament` en `stad` de voordeur: /api/auth gaf 503 en
     niemand kon meer inloggen, inclusief de AVG-gegevenspoort. De toets die er
     stond zag het niet, omdat hij na het omzetten een token gebruikte dat hij
     ERVOOR had opgehaald. Daarom logt deze toets op ELKE trede OPNIEUW in. */
  for (const trede of ['start', 'ontmoeten', 'partners', 'bestellen', 'fundament', 'stad', 'alles']) {
    const z = await api('/api/command/uitrol/zet', { trede }, office);
    assert.equal(z.status, 200, trede + ': ' + JSON.stringify(z.body));

    const vers = await api('/api/auth/login', { login: 'roellie.i@gmail.com', password: 'Imran', pasApp: 'business' });
    assert.equal(vers.status, 200, 'op trede ' + trede + ' moet iemand nog kunnen INLOGGEN');
    assert.ok(vers.body.token, 'en een bruikbaar token krijgen');
    assert.equal((await api('/api/ik', {}, vers.body.token)).status, 200, 'trede ' + trede + ': de app-staat');
    assert.equal((await api('/api/gegevens/nodig', {}, vers.body.token)).status, 200,
      'trede ' + trede + ': de AVG-gegevenspoort mag nooit dicht');
  }
});

test('de trap loopt monotoon: wat open ging blijft open', async () => {
  const open = { pay: null, dm: null };
  const meet = async () => ({
    pay: (await api('/api/pay/overzicht', {}, office)).status !== 503,
    salon: (await api('/api/salon/promo', {}, office)).status !== 503
  });
  await api('/api/command/uitrol/zet', { trede: 'start' }, office);
  let vorige = await meet();
  for (const trede of ['ontmoeten', 'partners', 'bestellen', 'fundament', 'stad', 'alles']) {
    await api('/api/command/uitrol/zet', { trede }, office);
    const nu = await meet();
    for (const k of Object.keys(nu)) {
      if (vorige[k]) assert.ok(nu[k], 'trede ' + trede + ' sloot ' + k + ' weer, en dat mag een trap niet');
    }
    vorige = nu;
  }
});

test('klimmen en pauzeren laten zich bedienen, en bevestigen kan niet zomaar', async () => {
  await api('/api/command/uitrol/zet', { trede: 'start' }, office);
  const k = await api('/api/command/uitrol/klim', {}, office);
  assert.equal(k.body.stand, 'klimt');

  // er is nog niets gemeten, dus hij staat gewoon stil op start
  assert.equal(k.body.trede, 'start');
  assert.equal((await api('/api/command/uitrol/bevestig', {}, office)).status, 409,
    'er staat niets klaar om te bevestigen');

  const p = await api('/api/command/uitrol/pauze', { reden: 'proef' }, office);
  assert.equal(p.body.stand, 'stil');
  assert.equal(p.body.reden, 'proef');
});

test('een onbekende trede weigert netjes', async () => {
  assert.equal((await api('/api/command/uitrol/zet', { trede: 'bestaatniet' }, office)).status, 404);
});
