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
const { startServer, stop, stopHard } = require('./helper');

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
    /* SIGKILL EN WACHTEN TOT HIJ WEG IS. Het blijft een stroomstoring -- niets
       wordt afgemaakt, en dat is precies wat hier getoetst wordt -- maar de
       wacht erna is nu een teken en geen gok.

       Hier stond `setTimeout(300) // laat de OS-poort echt vrijkomen`. Die
       reden klopte niet: startServer pakt elke keer een verse vrije poort. Wat
       er wel onder zat: zolang het oude proces leeft heeft het de datamap nog
       vast, en dan start ronde 2 op een half afgesloten sqlite. `exit` is
       daarvoor het teken. */
    await stopHard(srv.child);

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

/* ==========================================================================
   HET OVERZICHT OVERLEEFT DE CRASH OOK (TAKEN.md 4.39).

   De twee rondes hierboven en hieronder bewaken de SALDI. Die zijn de waarheid,
   en ze staan in een eigen sleutel (`paySaldi`) die in Postgres-stand bovendien
   op de snelle rijstrook rijdt. De zichtbare boekingsHISTORIE deed dat niet: die
   reed als groeiende blob in de trage flush-laan, en bij een harde crash binnen
   dat venster klopte het saldo wel en ontbrak de regel in het overzicht van het
   lid. Geen geldfout -- wel een zichtbare inconsistentie die niemand kan
   uitleggen: "je saldo is 10 euro lager en er staat niets".

   DEZE RONDE MEET TWEE DINGEN, en de tweede is de eigenlijke.

   (1) Na een gewone SIGKILL staat de bevestigde overdracht in het overzicht. Dat
       is de eis zoals hij in TAKEN.md staat -- maar in de SQLite-stand haalt hij
       dat ook zonder deze reparatie, want daar commit save() synchroon. Een
       toets die je niet hebt zien zakken is geen toets (LAT.md regel 4), dus
       hier hoort er meer te staan.

   (2) Daarom gaat de kv-regel van `payBoekingen` NA de kill ook nog leeg. Dat is
       geen kunstje: het IS de trage flush-laan, nagebootst in de opslag die we
       hier wel kunnen draaien. Postgres schrijft de blob uitgesteld weg, dus na
       een crash binnen dat venster is precies dit wat de herstart aantreft --
       de saldi bij, de historie achter. Overleeft de regel dat, dan komt hij uit
       het transactiegrootboek en niet uit de blob, en dat is exact wat 4.39
       vraagt.

   Waarom niet gewoon tegen een echte Postgres: die draait hier niet in de suite,
   en een toets die alleen in een omgeving met een database loopt, loopt in de
   praktijk nooit. De rijen liggen in beide standen in dezelfde tx_ledger, langs
   dezelfde ledger.js; alleen de achterkant verschilt.
   ========================================================================== */
test('na een crash EN een verloren historie-blob staat de bevestigde overdracht nog in het overzicht', async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-kill3-'));
  const geschiedenis = (base, tok) => api(base, 'pay/overzicht', {}, tok).then(r => r.body.geschiedenis || []);
  let srv = null;
  try {
    srv = await startServer({ env: { ...KILL_ENV, RTG_DATA_DIR: TMP } });
    const A = await login(srv.base, 'rtg');
    const B = await login(srv.base, 'lifestyle');
    await api(srv.base, 'pay/oplaad', { centen: 50000, idem: 'op-g1' }, A.token);

    const OMS = 'grootboekproef';
    const r = await api(srv.base, 'pay/stuur', { aan: B.codenaam, centen: 2500, oms: OMS, idem: 'g-1' }, A.token);
    assert.equal(r.status, 200, 'de overdracht wordt bevestigd');
    const voor = await geschiedenis(srv.base, A.token);
    const regel = voor.find(x => x.oms === OMS);
    assert.ok(regel, 'de bevestigde overdracht staat voor de crash in het overzicht');
    const saldoVoor = await saldo(srv.base, A.token);

    // ---- de HARDE crash ----
    await stopHard(srv.child);

    /* ---- en dan de trage flush-laan: de historie-blob is er niet doorheen ----
       We zetten de kv-regel op een lege lijst in plaats van hem te verwijderen:
       een verdwenen sleutel zou de collectie ONBEKEND maken, en dat is een andere
       situatie dan een achtergebleven schrijf. De saldi en de idem-boeken blijven
       staan -- die reden in Postgres al op de snelle rijstrook. */
    const { DatabaseSync } = require('node:sqlite');
    const kv = new DatabaseSync(path.join(TMP, 'store.db'));
    const had = kv.prepare('SELECT val FROM kv WHERE key = ?').get('payBoekingen');
    assert.ok(had && had.val && had.val !== '[]', 'de historie stond echt in de kv-blob (anders meet deze ronde niets)');
    kv.prepare('UPDATE kv SET val = ? WHERE key = ?').run('[]', 'payBoekingen');
    kv.close();

    // ---- herstart: het venster wordt uit het grootboek bijgevuld ----
    srv = await startServer({ env: { ...KILL_ENV, RTG_DATA_DIR: TMP } });
    /* vensterTopUp draait bij het opstarten naast het luisteren, dus even
       geduld -- begrensd, want een onbegrensde wachtlus is geen toets. */
    let na = [];
    for (let i = 0; i < 60 && !na.some(x => x.oms === OMS); i++) {
      na = await geschiedenis(srv.base, A.token);
      if (!na.some(x => x.oms === OMS)) await new Promise(r2 => setTimeout(r2, 200));
    }
    const terug = na.find(x => x.oms === OMS);
    assert.ok(terug, 'de bevestigde overdracht is uit het transactiegrootboek teruggekomen in het overzicht');
    assert.equal(terug.id, regel.id, 'en het is dezelfde regel, niet een nieuwe');
    assert.equal(terug.centen, regel.centen, 'met hetzelfde bedrag');
    assert.equal(await saldo(srv.base, A.token), saldoVoor, 'het saldo is onaangeroerd gebleven');

    // de tegenkant ziet hem ook: het overzicht filtert op allebei de rekeningen
    const bNa = await geschiedenis(srv.base, B.token);
    assert.ok(bNa.some(x => x.id === regel.id), 'de ontvanger vindt dezelfde regel terug');
  } finally {
    try { stop(srv && srv.child); } catch (e) {}
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
    await stopHard(srv.child);   // SIGKILL, ergens midden in de burst; zie hierboven

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
