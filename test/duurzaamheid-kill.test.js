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
   node --test test/duurzaamheid-kill.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

/* ELKE FETCH MET EEN DEADLINE -- EEN TWEEDE SLOT, EN NIET DE OORZAAK.

   Eerlijk over de volgorde: ik heb dit als eerste gedaan met de gedachte dat het
   DE reparatie was voor de vastloper waar dit bestand voor in MUTATIES.json
   stond. Dat was fout -- na deze wijziging liep hij nog steeds vast. De echte
   oorzaak stond in het opruimen (zie de finally verderop) en kwam pas boven door
   de proef met de hand te draaien en naar de UITVOER te kijken.

   Dit blok blijft staan omdat het op zichzelf een echt gat dicht: een fetch zonder
   time-out in een toets kan blijven staan, en dan telt een begrensde wachtlus niet
   verder -- begrensde lus, onbegrensde stap. Het is een tweede slot op een deur
   die nu ook echt op slot zit, geen reparatie die ik als de oorzaak mag opvoeren.

   Wat er misging: onder de liegpoort (de motor laat de server op elk /api-pad
   liegen) kwam een van deze verzoeken nooit terug. De wachtlussen hieronder zijn
   WEL begrensd -- honderd of honderdvijftig pogingen van 200 ms -- maar een lus
   telt niet verder zolang een stap niet klaar is. Begrensde lus, onbegrensde stap.
   Gevolg: het proces sluit niet af, de motor noteert `vastgelopen`, en dat telt
   niet als gezakt: het gedrag was echt veranderd en geen assertie heeft het
   gemeld. Een toets die hangt is erger dan een toets die zakt.

   fetch wordt hier op MODULENIVEAU geschaduwd. Dat dekt alle aanroepen in dit
   bestand -- ook de geneste `await (await fetch(...)).json()` -- zonder ze een
   voor een aan te raken, en het verandert niets buiten dit bestand. Een
   meegegeven signal wint, dus wie zelf een AbortController gebruikt houdt zijn
   eigen gedrag. */
const _fetch = globalThis.fetch;
const fetch = (u, o) => _fetch(u, Object.assign({ signal: AbortSignal.timeout(10000) }, o));


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
  /* `srv` staat BUITEN de try zodat de finally hem kan stoppen. Zie de finally
     hieronder voor waarom dat nodig was. */
  let srv = null;
  try {
    // ---- ronde 1: laden + tikken, elke tik bevestigd (200) ----
    srv = await startServer({ env: { ...KILL_ENV, RTG_DATA_DIR: TMP } });
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

  } finally {
    /* DE SERVER HOORT IN DE FINALLY, en dat was het lek waarvoor deze toets als
       `vastgelopen` in MUTATIES.json stond. `stop(srv.child)` stond als laatste
       regel van de try; zakt een assertie ervoor -- en onder de liegpoort zakken er
       twee, gemeten -- dan blijft het serverproces staan en kan node niet
       afsluiten. Het proces liep tot de time-out (exit 124), en dan telt de motor
       het NIET als gezakt, terwijl er wel asserties zakten. Dat is de stilste vorm
       van stuk.

       De finally ruimde wel de tijdelijke map op, en dat is de val: het zag eruit
       als een toets die opruimt. */
    try { stop(srv && srv.child); } catch (e) { /* al weg: prima */ }
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});

test('conservatie houdt ook als de crash midden in een burst van tikken valt', async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-kill2-'));
  /* `srv` staat BUITEN de try zodat de finally hem kan stoppen. Zie de finally
     hieronder voor waarom dat nodig was. */
  let srv = null;
  try {
    srv = await startServer({ env: { ...KILL_ENV, RTG_DATA_DIR: TMP } });
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
  } finally {
    /* DE SERVER HOORT IN DE FINALLY, en dat was het lek waarvoor deze toets als
       `vastgelopen` in MUTATIES.json stond. `stop(srv.child)` stond als laatste
       regel van de try; zakt een assertie ervoor -- en onder de liegpoort zakken er
       twee, gemeten -- dan blijft het serverproces staan en kan node niet
       afsluiten. Het proces liep tot de time-out (exit 124), en dan telt de motor
       het NIET als gezakt, terwijl er wel asserties zakten. Dat is de stilste vorm
       van stuk.

       De finally ruimde wel de tijdelijke map op, en dat is de val: het zag eruit
       als een toets die opruimt. */
    try { stop(srv && srv.child); } catch (e) { /* al weg: prima */ }
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
