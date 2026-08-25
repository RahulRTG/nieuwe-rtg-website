/* DE WAARDEGRAAF EN HET BEWIJSBORD -- waar ging de euro heen, en wat is
   daarvan aangetoond?

   WAAROM DEZE TOETS ER IS

   Twee lagen die allebei kunnen liegen zonder dat er ooit een foutmelding komt.

   De GRAAF liegt als hij zijn eigen sommen bijhoudt: dan toont hij vroeg of laat
   een ander bedrag dan de wallet, en een geldscherm dat een ander getal toont
   dan de wallet is erger dan geen geldscherm (LAT.md regel 4). Alles hier moet
   dus afgeleid zijn uit het grootboek en nergens apart geteld.

   Het BEWIJSBORD liegt als het groen zegt over iets dat niemand heeft gemeten.
   Daarom bestaat er geen groen: alleen bewezen, niet-bewezen en gezakt. De
   gevaarlijkste regel van het hele bord zou een vinkje zijn bij de afstemming
   met de betaaldienst -- dat is precies de controle die dit huis níet doet, en
   een vinkje daar zou dekken wat niemand anders dekt.

   WAT HIER WORDT NAGETROKKEN

   1. DE GRAAF TELT OP TOT WAT ER WERKELIJK STAAT.
   2. VERPLAATSINGEN TUSSEN EIGEN POTJES ZIJN GEEN UITGAVE.
   3. DE ZAAK ZIET WELK DEEL AFGELEID IS EN WELK DEEL UIT HET GROOTBOEK KOMT.
   4. HET BEWIJSBORD ZEGT NOOIT GROEN OVER IETS ONGEMETENS.
   5. EEN ECHTE FOUT LAAT HET BORD ZAKKEN.

   Draai los: node --experimental-sqlite --test test/waardegraaf.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { startServer, stop } = require('./helper');
const { maakWaarde } = require('../server/kern/waarde');

let srv, base, lid, sup, office;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-graaf-'));
const api = (pad, body, token) => fetch(base + '/api/' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  const d = await (await fetch(base + '/api/login', { method: 'POST',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tier: 'rtg' }) })).json();
  lid = { token: d.token, codenaam: (await api('pay/overzicht', {}, d.token)).body.codenaam };
  const s = await (await fetch(base + '/api/supplier/login', { method: 'POST',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'rahul', password: 'Imran' }) })).json();
  sup = { token: s.token, code: s.state.supplier.code };
  office = (await api('auth/login', { login: 'roellie.i@gmail.com', password: 'Imran', pasApp: 'business' }, null)).body.token;

  await api('pay/oplaad', { centen: 50000, idem: 'gf-1' }, lid.token);
  for (const [c, i] of [[3000, 'a'], [1500, 'b'], [800, 'c']]) {
    const code = (await api('pay/kascode', { maxCenten: 100000 }, lid.token)).body.code;
    await api('supplier/pay/in', { code, centen: c, idem: 'gf-' + i }, sup.token);
  }
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('de graaf van het lid telt op tot wat er werkelijk staat', async () => {
  const g = (await api('pay/graaf', { dagen: 30 }, lid.token)).body;
  assert.equal(g.binnengekomen, 50000, 'er kwam vijfhonderd euro binnen');
  assert.equal(g.uitgegeven, 3000 + 1500 + 800, 'en er ging drieënvijftig euro uit');

  const w = (await api('pay/overzicht', {}, lid.token)).body;
  assert.equal(g.staatNu, w.saldo, 'wat de graaf zegt dat er staat, is wat de wallet zegt');
  assert.equal(g.binnengekomen - g.uitgegeven, g.staatNu,
    'in min uit is precies het saldo -- de graaf telt niets apart bij');

  assert.equal(g.bestemmingen.length, 1, 'alles ging naar dezelfde zaak');
  assert.equal(g.bestemmingen[0].aantal, 3, 'in drie betalingen');
  assert.equal(g.bestemmingen[0].centen, 5300);
});

test('geld naar je eigen potje schuiven is geen uitgave', async () => {
  /* Zonder deze regel blaast een verplaatsing tussen eigen posities allebei de
     kanten op: je hebt dan "meer uitgegeven" zonder iets uit te geven. */
  const voor = (await api('pay/graaf', {}, lid.token)).body;
  const b = await api('supplier/pay/budget', { aan: lid.codenaam, klasse: 'EMPLOYER_BUDGET',
    centen: 1000, oms: 'Budget', idem: 'gf-bud' }, sup.token);
  assert.equal(b.status, 200);

  const na = (await api('pay/graaf', {}, lid.token)).body;
  assert.equal(na.posities.length, 2, 'het lid heeft er een positie bij');
  assert.equal(na.binnengekomen, voor.binnengekomen + 1000, 'het budget kwam van de zaak, dus dat is inkomst');
  assert.equal(na.uitgegeven, voor.uitgegeven, 'en er is niets extra uitgegeven');
  assert.equal(na.binnengekomen - na.uitgegeven, na.staatNu, 'de graaf sluit nog steeds');
});

test('de zaak ziet welk deel afgeleid is en welk deel uit het grootboek komt', async () => {
  await api('supplier/pay/treasury/zet', { btwPct: 21, payrollPct: 10 }, sup.token);
  const g = (await api('supplier/pay/graaf', { dagen: 30 }, sup.token)).body;

  const kosten = g.opsplitsing.find(o => o.wat === 'Kosten betaaldienst');
  const btw = g.opsplitsing.find(o => o.wat === 'Btw-reservering');
  assert.equal(kosten.afgeleid, false, 'de kosten staan echt in het grootboek');
  assert.equal(btw.afgeleid, true, 'het btw-deel is een percentage, geen afdracht');
  assert.match(btw.uitleg, /aangifte rekent de boekhouding/, 'en dat staat er ook bij');

  const som = g.opsplitsing.reduce((s, o) => s + o.centen, 0);
  assert.equal(som, g.ontvangen, 'de opsplitsing telt op tot precies wat er ontvangen is');
});

test('het bewijsbord zegt nooit groen over iets ongemetens', async () => {
  const b = (await api('office/pay/bewijs', {}, office)).body;
  assert.ok(Array.isArray(b.controles) && b.controles.length >= 5);
  for (const c of b.controles) {
    assert.ok(['bewezen', 'niet-bewezen', 'gezakt'].includes(c.staat), c.id + ' heeft een geldige stand');
    assert.notEqual(c.staat, 'groen', 'groen bestaat hier niet');
  }
  const af = b.controles.find(c => c.id === 'afstemming');
  assert.equal(af.staat, 'niet-bewezen', 'de afstemming met de betaaldienst is nooit gedaan');
  assert.match(af.uitleg, /nooit/, 'en het bord zegt dat met zoveel woorden');
  assert.equal(b.oordeel, 'deels bewezen',
    'zolang er iets ongemeten is, is de stand niet "bewezen" -- en ook niet "mis"');

  assert.equal(b.controles.find(c => c.id === 'sluitend').staat, 'bewezen');
  assert.equal(b.controles.find(c => c.id === 'plafonds').staat, 'bewezen');
});

test('het bewijsbord is alleen voor het kantoor', async () => {
  const r = await api('office/pay/bewijs', {}, lid.token);
  assert.ok(r.status === 401 || r.status === 403, 'een lid komt er niet bij (kreeg ' + r.status + ')');
});

test('een echte fout laat het bord zakken -- het meet, het herhaalt niet', () => {
  /* Rechtstreeks op de kern, want een kapot grootboek is via de voordeur niet te
     maken: de poort houdt dat tegen. Dat is precies goed, maar het betekent dat
     de ZAKKENDE kant hier getoetst moet worden. Een controle waarvan alleen de
     slagende kant ooit is gezien, is geen controle. */
  const db = { data: { paySaldi: { 'lid:A': 1000, 'extern:oplaad': -1000 }, payBoekingen: [] } };
  const w = maakWaarde({ db, save() {}, crypto }).waarde;
  const ctx = { d: () => db.data, saldi: () => db.data.paySaldi,
    grootboek: () => db.data.payBoekingen, saldoVan: r => db.data.paySaldi[r] || 0, waarde: w };
  const bord = () => require('../server/kern/pay/bewijs')(ctx).bewijsbord();

  assert.equal(bord().oordeel, 'deels bewezen', 'schoon, maar de afstemming ontbreekt');

  db.data.paySaldi['lid:A'] = 1500;                       // som niet meer nul
  assert.equal(bord().controles.find(c => c.id === 'sluitend').staat, 'gezakt');
  db.data.paySaldi['lid:A'] = 1000;

  w.reserveer({ rek: 'lid:A', centen: 5000, doel: 'meer dan er staat' });
  assert.equal(bord().controles.find(c => c.id === 'vastgezet').staat, 'gezakt');
  assert.equal(bord().oordeel, 'gezakt');
});
