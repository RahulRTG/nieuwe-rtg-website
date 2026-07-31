/* ============================================================================
   DE OPSLAGLAAG, HARD GEMAAKT -- wat een HERSTART moet overleven.

   Deze toets legt twee reparaties vast die op 100 miljoen leden zijn gevonden
   en tot nu toe alleen met de hand waren nagelopen. Een reparatie zonder toets
   is een reparatie met een houdbaarheidsdatum.

   1. IDEMPOTENTIE OVERLEEFT EEN HERSTART

   Dezelfde knop twee keer indrukken mag nooit twee keer boeken. Dat werkte
   binnen een draaiend proces, maar niet er overheen: de idem-sleutels staan in
   db.data.payIdem, en die ging in de write-behind achter de grote blobs staan
   (directBetalingen 25 MB, betaalVerzoeken 13 MB). Gemeten duurde het ~35
   seconden voor een sleutel in Postgres stond. Herstart de server binnen dat
   venster -- in het echt heet dat "deploy" -- dan is de sleutel weg en boekt
   een client die het opnieuw probeert VOOR DE TWEEDE KEER. Gemeten: A ging van
   493.000 naar 486.000 centen, B van 7.000 naar 14.000.

   De uitstelregel verantwoordde zichzelf met "elk nieuw item staat al DIRECT
   als eigen rij in het transactie-grootboek". Dat klopt voor orders en
   boekingen. Voor payIdem klopt het niet: die heeft geen grootboek achter zich.
   Sindsdien rijden de idempotentie-boeken een eigen strook (VOORRANG in
   server/pg/sync.js) en schrijft de afsluit-flush ze als EERSTE weg.

   Waarom "als eerste" ertoe doet: een afsluit-flush van tientallen megabytes
   duurt op deze schaal tientallen seconden, en wie de server stopt wacht niet
   zo lang. De Beproeving kapt na acht seconden hard af. Wat als eerste weg is,
   is veilig.

   2. DE SPIEGEL VOLGT ZIJN EIGEN MELDING NIET

   De accounts-spiegel luisterde op hetzelfde kanaal waarop hij zelf publiceert.
   Zijn eigen NOTIFY liet hem de rij terughalen zoals die op DAT moment in
   Postgres stond en er met INSERT OR REPLACE overheen zetten -- inclusief een
   lokale schrijfactie die er net na was gekomen. Zichtbaar gevolg: een lid
   uploadt zijn paspoort, en een tel later vraagt RTG Pay er alsnog om.

   Die race is met een toets niet betrouwbaar na te bootsen -- hij is precies
   een Postgres-heen-en-weer breed. Wat wel te toetsen is, is het MECHANISME:
   draagt elke melding het kenmerk van zijn afzender, en herkent een proces zijn
   eigen melding? Zonder dat kenmerk kan de reparatie niet werken, en met een
   verkeerd kenmerk werkt hij te goed (dan negeert hij ook een ander).

   Draai:  DATABASE_URL=postgresql://rtg@127.0.0.1:5433/rtgtest \
           node --experimental-sqlite --test test/duurzaamheid-pg.test.js
   ========================================================================== */
/* LET OP -- deze toets vraagt de database VOOR ZICHZELF (zie leden-gids-pg). */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, stopNet } = require('./helper');

const HEEFT_PG = !!(process.env.DATABASE_URL || process.env.PG_URL);
const OVERSLAAN = HEEFT_PG ? false : 'geen DATABASE_URL: de duurzaamheid van de opslaglaag is alleen in Postgres-modus te toetsen';
const KYC_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

function api(base, pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

/* Een lid met een getoond paspoort: zonder die stap loopt elke betaling op de
   KYC-poort stuk en toetst dit bestand de poort in plaats van de opslag. */
async function lid(base, merk) {
  const u = Date.now().toString(36) + merk;
  const r = await api(base, '/api/auth/register', { name: 'Duurzaam ' + u, email: 'd' + u + '@voorbeeld.test',
    phone: '06' + String(10000000 + Math.floor(Math.random() * 8e7)), password: 'Geheim' + u + '!',
    geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' });
  assert.ok(r.body.token, 'registratie geeft een token (' + r.status + ')');
  await api(base, '/api/verify/upload', { image: KYC_PNG }, r.body.token);
  return { token: r.body.token, email: 'd' + u + '@voorbeeld.test', ww: 'Geheim' + u + '!' };
}
const saldo = (base, t) => api(base, '/api/pay/overzicht', {}, t).then(r => r.body);

test('een idem-sleutel overleeft een nette herstart: geen tweede boeking na een deploy',
  { skip: OVERSLAAN }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-duurzaam-'));
  let srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  try {
    const A = await lid(srv.base, 'a'), B = await lid(srv.base, 'b');
    const bCode = (await saldo(srv.base, B.token)).codenaam;
    assert.ok(bCode, 'B heeft een codenaam (de portemonnee is bereikbaar)');

    await api(srv.base, '/api/pay/oplaad', { centen: 500000, idem: 'op-' + Date.now() }, A.token);
    const K = 'stabiel-' + Date.now();
    const eerste = await api(srv.base, '/api/pay/stuur', { aan: bCode, centen: 7000, oms: 'proef', idem: K }, A.token);
    assert.equal(eerste.status, 200, 'de eerste boeking lukt: ' + JSON.stringify(eerste.body).slice(0, 120));

    const aVoor = (await saldo(srv.base, A.token)).saldo, bVoor = (await saldo(srv.base, B.token)).saldo;
    /* De toets mag niet vacuous slagen: is er geen geld bewogen, dan bewijst
       "het saldo bleef gelijk" na de herstart helemaal niets. */
    assert.equal(bVoor, 7000, 'er is echt 7000 centen bewogen');

    // binnen hetzelfde proces werkte dit altijd al; hier alleen als ijking
    await api(srv.base, '/api/pay/stuur', { aan: bCode, centen: 7000, oms: 'proef', idem: K }, A.token);
    assert.equal((await saldo(srv.base, A.token)).saldo, aVoor, 'binnen hetzelfde proces boekt de herhaling niet');

    /* DE NETTE HERSTART. SIGTERM, niet SIGKILL: dit toetst een deploy en geen
       stroomstoring. De server hoort zijn write-behind te spoelen, en de
       idempotentie-boeken horen daarbij vooraan te gaan. */
    await stopNet(srv.child);
    await new Promise(r => setTimeout(r, 500));
    srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });

    const herA = (await api(srv.base, '/api/auth/login', { login: A.email, password: A.ww })).body.token;
    const herB = (await api(srv.base, '/api/auth/login', { login: B.email, password: B.ww })).body.token;
    assert.ok(herA && herB, 'beide leden kunnen na de herstart weer inloggen');
    assert.equal((await saldo(srv.base, herA)).saldo, aVoor, 'het saldo van A overleefde de herstart');
    assert.equal((await saldo(srv.base, herB)).saldo, bVoor, 'het saldo van B ook');

    // DE BEWERING DIE ERTOE DOET
    const opnieuw = await api(srv.base, '/api/pay/stuur', { aan: bCode, centen: 7000, oms: 'proef', idem: K }, herA);
    const aNa = (await saldo(srv.base, herA)).saldo, bNa = (await saldo(srv.base, herB)).saldo;
    assert.equal(aNa, aVoor, 'A werd NIET voor de tweede keer afgeschreven (' + aVoor + ' -> ' + aNa + ')');
    assert.equal(bNa, bVoor, 'en B kreeg het niet twee keer (' + bVoor + ' -> ' + bNa + ')');
    assert.ok(opnieuw.body.herhaald, 'de herhaling wordt als herhaling herkend, niet als nieuwe boeking');
  } finally {
    stop(srv && srv.child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});

test('de spiegel herkent zijn eigen melding, en die van een ander niet', { skip: OVERSLAAN }, async () => {
  const { maakPgAccounts } = require('../server/pgaccounts');
  const url = process.env.DATABASE_URL || process.env.PG_URL;
  const een = maakPgAccounts({ url, log: { warn: () => {} } });
  const twee = maakPgAccounts({ url, log: { warn: () => {} } });
  try {
    assert.ok(een.BRON && twee.BRON, 'elke spiegel heeft een eigen kenmerk');
    assert.notEqual(een.BRON, twee.BRON, 'en twee instances delen dat kenmerk niet');

    assert.equal(een.vanMij('user:42:' + een.BRON), true, 'een herkent zijn eigen melding');
    assert.equal(een.vanMij('user:42:' + twee.BRON), false, 'en die van de ander niet');
    assert.equal(twee.vanMij('user:42:' + een.BRON), false, 'omgekeerd net zo');
    /* Een melding zonder kenmerk komt van een oudere versie die naast deze
       draait. Die moet gevolgd worden -- anders mist een instance tijdens een
       rollende upgrade de wijzigingen van zijn buurman. */
    assert.equal(een.vanMij('user:42'), false, 'een melding zonder kenmerk geldt als die van een ander');
    assert.equal(een.vanMij(''), false, 'en een lege melding ook');
  } finally {
    await een.sluit().catch(() => {});
    await twee.sluit().catch(() => {});
  }
});
