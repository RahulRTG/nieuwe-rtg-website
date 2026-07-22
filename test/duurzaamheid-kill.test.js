/* Duurzaamheid onder een HARDE crash (SIGKILL), niet een nette afsluiting.
   De beproeving toetst een DUURZAAMHEID-fase met SIGTERM (de server flusht zijn
   write-behind netjes); dit is strenger: we schieten het proces dood MIDDEN in de
   betaalstroom, zonder kans om te flushen, en eisen dat elke bevestigde (200) tik
   de crash overleeft en dat er nooit geld ontstaat of verdampt.

   Dat kan alleen als de betaalschrijf synchroon in de opslag landt VOOR het
   antwoord teruggaat. In de standaard sqlite-modus commit save() synchroon
   (WAL + synchronous=NORMAL); een proces-SIGKILL verliest een gecommitte WAL niet
   (de bytes staan bij de kernel, de herstart speelt de WAL terug). Deze test
   bewaakt dat contract. Draai los:
   node --experimental-sqlite --test test/duurzaamheid-kill.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

// Forceer de sqlite-opslag (de standaard voor een verse installatie) ongeacht de
// omgeving waarin de suite draait -- zonder DATABASE_URL, zonder db.json.
const KILL_ENV = { RTG_STORE: 'sqlite', DATABASE_URL: '', PG_URL: '', SMTP_URL: '' };

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
const saldo = (base, tok) => api(base, 'pay/overzicht', {}, tok).then(r => r.body.saldo);

test('een harde SIGKILL midden in de betaalstroom verliest geen bevestigde tik en schept geen geld', async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-kill-'));
  try {
    // ---- ronde 1: laden + tikken, elke tik bevestigd (200) ----
    let srv = await startServer({ env: { ...KILL_ENV, RTG_DATA_DIR: TMP } });
    const A = await login(srv.base, 'rtg');
    const B = await login(srv.base, 'lifestyle');
    assert.ok(A.codenaam && B.codenaam && A.codenaam !== B.codenaam, 'twee leden met een eigen codenaam');

    const op = await api(srv.base, 'pay/oplaad', { centen: 100000, idem: 'op-1' }, A.token);
    assert.equal(op.status, 200, 'opladen lukt');
    const geladen = await saldo(srv.base, A.token);
    assert.equal(geladen, 100000, 'duizend euro geladen');

    const K = 8, BEDRAG = 1000, gebruikteIdem = 'tik-3';
    let bevestigd = 0;
    for (let i = 0; i < K; i++) {
      const r = await api(srv.base, 'pay/stuur', { aan: B.codenaam, centen: BEDRAG, oms: 'test', idem: 'tik-' + i }, A.token);
      assert.equal(r.status, 200, 'tik ' + i + ' wordt bevestigd');
      assert.ok(r.body.ok, 'tik ' + i + ' is geboekt');
      bevestigd++;
    }
    assert.equal(await saldo(srv.base, B.token), K * BEDRAG, 'B ontving alle tikken voor de crash');

    // ---- de HARDE crash: SIGKILL, geen kans om te flushen ----
    stop(srv.child);
    await new Promise(r => setTimeout(r, 300)); // laat de OS-poort echt vrijkomen

    // ---- ronde 2: herstart op DEZELFDE datamap, tokens overleefden ----
    srv = await startServer({ env: { ...KILL_ENV, RTG_DATA_DIR: TMP } });
    const bNa = await saldo(srv.base, B.token);
    const aNa = await saldo(srv.base, A.token);
    assert.equal(bNa, bevestigd * BEDRAG, 'elke bevestigde tik overleefde de harde crash');
    assert.equal(aNa, geladen - bevestigd * BEDRAG, 'A is precies het uitgestuurde bedrag kwijt');
    assert.equal(aNa + bNa, geladen, 'geld-conservatie: er is niets ontstaan of verdampt over de crash heen');

    // idempotentie overleefde ook: dezelfde tik nogmaals boekt niet dubbel
    const her = await api(srv.base, 'pay/stuur', { aan: B.codenaam, centen: BEDRAG, oms: 'test', idem: gebruikteIdem }, A.token);
    assert.equal(her.body.herhaald, true, 'de her-tik met een gebruikte sleutel is herkend als herhaling');
    assert.equal(await saldo(srv.base, B.token), bNa, 'de herhaalde tik boekt niet nog een keer');

    stop(srv.child);
  } finally {
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});

test('conservatie houdt ook als de crash midden in een burst van tikken valt', async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-kill2-'));
  try {
    let srv = await startServer({ env: { ...KILL_ENV, RTG_DATA_DIR: TMP } });
    const A = await login(srv.base, 'rtg');
    const B = await login(srv.base, 'lifestyle');
    await api(srv.base, 'pay/oplaad', { centen: 100000, idem: 'op-1' }, A.token);
    const geladen = await saldo(srv.base, A.token);

    // Een burst tikken de lucht in JAGEN en NIET afwachten; kort daarna hard doden,
    // zodat de kill ergens midden in de schrijf/commit-stroom valt. Welke tikken
    // landen is niet-deterministisch -- de invariant hieronder is dat wel.
    const BEDRAG = 1000;
    for (let i = 0; i < 30; i++) api(srv.base, 'pay/stuur', { aan: B.codenaam, centen: BEDRAG, oms: 'burst', idem: 'burst-' + i }, A.token).catch(() => {});
    await new Promise(r => setTimeout(r, 40));
    stop(srv.child);   // SIGKILL, ergens midden in de burst
    await new Promise(r => setTimeout(r, 300));

    srv = await startServer({ env: { ...KILL_ENV, RTG_DATA_DIR: TMP } });
    const aNa = await saldo(srv.base, A.token);
    const bNa = await saldo(srv.base, B.token);
    assert.equal(aNa + bNa, geladen, 'geld-conservatie over de crash: totaal onveranderd');
    assert.equal(bNa % BEDRAG, 0, 'geen halve tik: B kreeg alleen hele bedragen (transactie-atomiciteit)');
    assert.ok(aNa >= 0 && bNa >= 0, 'geen saldo onder nul');
    stop(srv.child);
  } finally {
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
