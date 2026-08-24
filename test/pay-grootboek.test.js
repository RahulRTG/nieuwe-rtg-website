/* DE BOEKINGSHISTORIE VAN RTG PAY IN HET TRANSACTIEGROOTBOEK (TAKEN.md 4.39).

   De crashproef-ronde staat in test/duurzaamheid-kill.test.js: die schiet de
   server dood, gooit de historie-blob leeg en eist de bevestigde overdracht
   terug in het overzicht. Hier staat wat die ronde NIET kan laten zien, omdat er
   in deze suite geen Postgres draait.

   Draai los: node --experimental-sqlite --test test/pay-grootboek.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

const _fetch = globalThis.fetch;
const fetch = (u, o) => _fetch(u, Object.assign({ signal: AbortSignal.timeout(10000) }, o));
const ENV = { RTG_STORE: 'sqlite', DATABASE_URL: '', PG_URL: '', SMTP_URL: '' };

const api = (base, pad, body, token) => fetch(base + '/api/' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

async function login(base, tier) {
  const r = await fetch(base + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tier }) });
  const d = await r.json();
  const o = await api(base, 'pay/overzicht', {}, d.token);
  return { token: d.token, codenaam: o.body.codenaam };
}

/* ==========================================================================
   HET TIJDSTIP. Dit is de fout die deze ronde bijna stil had gemaakt.

   Elke andere collectie in het grootboek draagt `at` als ISO-TEKST. Een RTG
   Pay-boeking zet `at: Date.now()` -- een getal. De Postgres-kolom is
   `timestamptz`, dus daar laat een getal de insert struikelen, en beide wegen
   naar het grootboek slikken dat: txLedgerZet vangt de fout ("de veegronde lost
   het wel op") en de veegronde meldt alleen "[tx] veegronde mislukt". Netto zou
   payBoekingen er in Postgres-stand NOOIT in komen -- terwijl server/pg/sync.js
   de collectie dan wel als herstelbaar telt en haar achteraan de afsluit-flush
   zet, de plek die als eerste sneuvelt.

   In SQLite is de kolom TEXT en gaat een getal er gewoon in. Deze toets kijkt
   daarom niet of het WERKT (dat doet het daar toch wel) maar naar de VORM in de
   kolom: staat er tekst, dan is het een tijdstip dat Postgres ook aanneemt.
   ========================================================================== */
test('een pay-regel landt in het grootboek met een tijdstip dat een timestamptz aanneemt', async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-payledger-'));
  let srv = null;
  try {
    srv = await startServer({ env: { ...ENV, RTG_DATA_DIR: TMP } });
    const A = await login(srv.base, 'rtg');
    const B = await login(srv.base, 'lifestyle');
    await api(srv.base, 'pay/oplaad', { centen: 20000, idem: 'op-l1' }, A.token);
    const r = await api(srv.base, 'pay/stuur', { aan: B.codenaam, centen: 1500, oms: 'kolomproef', idem: 'l-1' }, A.token);
    assert.equal(r.status, 200, 'de overdracht wordt bevestigd');

    const { DatabaseSync } = require('node:sqlite');
    let rij = null;
    for (let i = 0; i < 50 && !rij; i++) {
      /* Het wegschrijven naar het grootboek is best-effort en dus asynchroon;
         begrensd wachten, want een onbegrensde lus is geen toets. */
      await new Promise(k => setTimeout(k, 200));
      try {
        const g = new DatabaseSync(path.join(TMP, 'grootboek.db'), { readOnly: true });
        rij = g.prepare("SELECT ref, at, typeof(at) AS soortAt, totaal FROM tx_ledger WHERE soort = 'payboeking' ORDER BY rowid DESC LIMIT 1").get() || null;
        g.close();
      } catch (e) { /* het bestand bestaat nog niet, of de WAL is even druk */ }
    }
    assert.ok(rij, 'de pay-regel staat als eigen rij in tx_ledger');
    assert.equal(rij.soortAt, 'text', 'het tijdstip staat als TEKST in de kolom; een getal weigert Postgres als timestamptz');
    assert.match(String(rij.at), /^\d{4}-\d{2}-\d{2}T/, 'en het is een ISO-tijdstip');
    assert.equal(Number(rij.totaal), 1500, 'het bedrag komt uit `centen` en niet uit een veld dat pay niet kent');
    assert.match(String(rij.ref), /^PB/, 'de sleutel komt uit `id` en niet uit `ref` (die is bij pay meestal leeg)');
  } finally {
    try { stop(srv && srv.child); } catch (e) {}
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});

/* DEZELFDE VRAAG AAN EEN ECHTE POSTGRES staat NIET hier, en dat is een keuze.

   De ronde hierboven leest de VORM in de SQLite-kolom en leidt daaruit af dat
   Postgres hem aanneemt. Afleiden is geen meten, dus dezelfde vraag staat ook
   tegen de echte database -- maar in `test/txledger.pg.test.js`, achter de skip
   die dat bestand al heeft, en niet hier achter een nieuwe.

   Waarom dat uitmaakt: `zelfpoortendeToetsen` in NORM.json telt de toetsen die
   zichzelf kunnen overslaan omdat een DIENST ontbreekt, en die meter mag alleen
   omlaag. Hij bestaat omdat acht pg-toetsbestanden maandenlang meetelden als
   dekking zonder ooit te draaien. Een nieuwe skip hier zou die tand een slag
   terugdraaien voor een vraag die net zo goed past bij het bestand dat het
   grootboek in Postgres al toetst. Het meetwerk staat in `test/txledger-rit.js`
   (payLedger, payTijdstip, payTopUp) en de asserties in dat toetsbestand. */

/* ==========================================================================
   DE TWEE WEGEN UIT ELKAAR HOUDEN.

   server/kern/pay/loshistorie.js bestaat voor vier motor-harnassen en een toets
   die de pay-kern op hun EIGEN `db = { data: {} }` bouwen. Die weg schrijft niet
   naar het transactiegrootboek -- dat is daar juist de bedoeling, want de
   tx-index hangt aan de procesbrede opslag.

   Het gevaar is dat de server hem ooit ook krijgt. Dan draait alles, ziet
   niemand iets, en is de reparatie van 4.39 stilletjes weg. Deze toets leest de
   echte opzet en eist de echte weg.
   ========================================================================== */
test('de SERVER krijgt de echte weg naar het grootboek, niet de losse historie', () => {
  const opzet = fs.readFileSync(path.join(__dirname, '..', 'server', 'opzet', 'kernlaag3.js'), 'utf8');
  const i = opzet.indexOf("require('../kern/pay')");
  assert.ok(i > 0, 'kernlaag3 bouwt de pay-kern');
  const blok = opzet.slice(i, i + 800);
  assert.match(blok, /payBoekingenVoegToe:\s*require\('\.\.\/db'\)\.payBoekingenVoegToe/,
    'de server hoort payBoekingenVoegToe uit server/db te krijgen');
  assert.doesNotMatch(blok, /loshistorie/, 'de losse historie hoort NIET in de server te staan');
});

test('de pay-kern weigert te bouwen zonder een weg naar het grootboek', () => {
  /* Zelfde vorm als kern/directpay: wie een afhankelijkheid vergeet, hoort dat
     te horen bij het opstarten en niet bij de eerste klant -- daar zou pasToe()
     omvallen NA het verschuiven van de saldi en VOOR het vastleggen van de
     regel, de slechtste plek van allemaal. */
  const crypto = require('crypto');
  const basis = {
    db: { data: {} }, save() {}, bijeen: async werk => werk(), crypto, betaal: {},
    keyVanCodenaam: () => null, sseToCustomer() {}, schoon: x => String(x || ''),
    betaaldienstKosten: () => 0,
    betaalOpdrachten: { registreerTeruggang() {}, maak: () => ({ id: 'nooit' }), dienIn: async () => ({ status: 'nooit' }) }
  };
  assert.throws(() => require('../server/kern/pay')(basis), /payBoekingenVoegToe ontbreekt/);
  // en met een weg erbij bouwt hij gewoon
  const los = require('../server/kern/pay/loshistorie')(basis.db);
  const { pay } = require('../server/kern/pay')({ ...basis, payBoekingenVoegToe: los });
  assert.equal(typeof pay.boekAsync, 'function');
});

test('de losse historie doet precies wat de echte weg doet, min het grootboek', () => {
  const db = { data: {} };
  const los = require('../server/kern/pay/loshistorie')(db);
  los({ id: 'PB1', centen: 100 });
  los({ id: 'PB2', centen: 200 });
  assert.deepEqual(db.data.payBoekingen.map(b => b.id), ['PB2', 'PB1'], 'nieuwste eerst, net als unshift');
});

/* ==========================================================================
   DE SLEUTEL EN HET TIJDSTIP LOS, ZONDER SERVER.
   ========================================================================== */
test('de sleutel van een pay-rij komt uit `id`, want `ref` is er meestal niet', () => {
  const { sleutelVan } = require('../server/db/tx/collecties');
  assert.equal(sleutelVan('payBoekingen', { id: 'PB9', ref: null }), 'PB9');
  assert.equal(sleutelVan('orders', { ref: 'O1' }), 'O1', 'en een order houdt zijn eigen ref');
  /* Zou payBoekingen op `ref` blijven staan, dan gaat elke rij door de
     `sleutel == null`-poort de prullenbak in: geen fout, geen melding. */
  assert.equal(sleutelVan('payBoekingen', { id: 'PB9', ref: null }) == null, false);
});

test('een tijdstip in milliseconden wordt ISO; een ISO-tijdstip blijft zichzelf', () => {
  const { tijdstipVan } = require('../server/db/tx/ledger');
  assert.equal(tijdstipVan({ at: 1756000000000 }), new Date(1756000000000).toISOString());
  assert.equal(tijdstipVan({ at: '2026-08-24T10:00:00.000Z' }), '2026-08-24T10:00:00.000Z');
  assert.match(tijdstipVan({}), /^\d{4}-\d{2}-\d{2}T/, 'zonder tijdstip: nu, en ook als tekst');
  assert.equal(typeof tijdstipVan({ at: Date.now() }), 'string');
});
