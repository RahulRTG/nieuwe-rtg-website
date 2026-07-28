/* De wereldtabel: alle landen van de wereld in de fiscale tabel, in dezelfde
   structuur als de rijke kernlanden, en de Regelwacht die elk land
   automatisch kan bijwerken. Getest: dekking en veldkwaliteit (alles binnen
   de Regelwacht-grenzen), de rijke kernlanden blijven onaangetast, de
   zzp-rekentool en de AI-boekhouder crashen niet op een wereldland, en een
   Regelwacht-update op een wereldland rekent per direct door.
   Draai los: node --experimental-sqlite --test test/wereldregels.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

const { LANDEN, ZZP } = require('../server/kern/fiscaal/landen');
const { zzpBerekening } = require('../server/kern/fiscaal/zzp');

test('de hele wereld staat in de tabel, en elk land ligt binnen de Regelwacht-grenzen', () => {
  const codes = Object.keys(LANDEN);
  assert.ok(codes.length >= 180, 'minstens 180 landen (nu ' + codes.length + ')');
  for (const cc of ['IT', 'US', 'GB', 'CN', 'IN', 'BR', 'AU', 'ZA', 'AE', 'KR', 'NG', 'AR', 'NZ', 'SA'])
    assert.ok(LANDEN[cc], 'wereldland ' + cc + ' bestaat');
  for (const [cc, l] of Object.entries(LANDEN)) {
    assert.ok(l.naam && l.regio, cc + ' heeft naam en regio');
    assert.ok(Number.isFinite(l.tarieven.standaard) && l.tarieven.standaard >= 0 && l.tarieven.standaard <= 30, cc + ': btw binnen 0-30');
    assert.ok(l.uurloonMin >= 1 && l.uurloonMin <= 100, cc + ': minimumloon binnen 1-100');
    assert.ok(l.alcoholLeeftijd >= 16 && l.alcoholLeeftijd <= 25, cc + ': alcoholleeftijd binnen 16-25');
    assert.ok(l.lasten >= 0 && l.lasten <= 0.6, cc + ': lasten binnen 0-0,6');
    assert.ok(l.aangifte && l.extra, cc + ': aangifte- en extra-tekst aanwezig');
  }
  // de rijke kernlanden blijven exact zoals ze waren (met de zakelijk-teksten)
  assert.equal(LANDEN.NL.uurloonMin, 14.06);
  assert.ok(LANDEN.NL.zakelijk && LANDEN.JP.zakelijk, 'kernlanden houden hun uitgeschreven aftrekregels');
  assert.equal(LANDEN.JP.alcoholLeeftijd, 20);
  assert.equal(LANDEN.IT.tarieven.standaard, 22);
});

test('de zzp-rekentool werkt voor elk wereldland met een eerlijke indicatie', () => {
  const br = zzpBerekening('BR', 50000, {});
  assert.equal(br.landNaam, 'Brazilie');
  assert.match(br.regime, /wereldtabel/i, 'wereldlanden krijgen het indicatie-regime');
  assert.ok(br.belasting > 0 && br.netto > 0 && br.belasting + br.netto === 50000);
  // NL blijft de volledige berekening (schijven + aftrek), geen indicatie-regime
  const nl = zzpBerekening('NL', 50000, { urencriterium: true });
  assert.ok(!/wereldtabel/i.test(nl.regime));
  assert.ok(nl.posten.some(p => /Zelfstandigenaftrek/.test(p.label)));
  assert.ok(!ZZP.BR, 'BR heeft bewust geen eigen regime in de tabel (de fallback vangt dit)');
});

test('regelwacht: een update op een wereldland gaat per direct de gedeelde tabel in', () => {
  const db = { data: {} };
  const { regelwacht } = require('../server/kern/fiscaal/regelwacht')({ db, save: () => {}, LANDEN, peiljaar: 2025 });
  const oud = LANDEN.BR.uurloonMin;
  const uit = regelwacht.pasToe({ landen: { BR: { uurloonMin: 2.4, tarieven: { standaard: 18 } } } }, 'test', 'w1');
  assert.equal(uit.landen, 1);
  assert.equal(LANDEN.BR.uurloonMin, 2.4);
  assert.equal(LANDEN.BR.tarieven.standaard, 18);
  const st = regelwacht.status();
  assert.ok(st.totaal >= 180, 'status telt de hele wereld');
  const br = st.landen.find(l => l.code === 'BR');
  assert.ok(br.bijgewerkt && br.uurloonMin === 2.4);
  // terug naar de oude stand zodat andere tests in dit proces niets merken
  regelwacht.pasToe({ landen: { BR: { uurloonMin: oud, tarieven: { standaard: 17 } } } }, 'test');
});

/* ---- de AI-boekhouder (canned pad) op een wereldland, end-to-end ---- */
let srv, base;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-wereld-'));
test.before(async () => { srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } }); base = srv.base; });
test.after(() => { stop(srv && srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

test('de AI-boekhouder antwoordt over een wereldland zonder te struikelen', async () => {
  const lid = await (await fetch(base + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tier: 'business' }) })).json();
  const r = await fetch(base + '/api/member/accountant', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + lid.token },
    body: JSON.stringify({ land: 'BR', question: 'Is mijn hotel aftrekbaar?' })
  });
  assert.equal(r.status, 200);
  const d = await r.json();
  assert.equal(d.land, 'BR');
  assert.match(d.answer, /Brazilie/, 'het antwoord gaat over het gekozen wereldland');
  assert.ok(d.landen.length >= 180, 'de landenlijst van de tool draagt de hele wereld');
  const namen = d.landen.map(l => l.naam);
  assert.deepEqual(namen.slice(0, 3), namen.slice(0, 3).slice().sort((a, b) => a.localeCompare(b)), 'gesorteerd op naam');
});
