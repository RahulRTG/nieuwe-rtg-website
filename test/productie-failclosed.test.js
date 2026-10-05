/* ============================================================================
   PRODUCTIE FAIL-CLOSED -- regressie voor RTG-V1-RELEASE blocker 3.

   DE FOUT (bewezen in de audit): vrijwel alle productie-hardening hing aan
   NODE_ENV==='production'. Een publieke installatie met een openbaar APP_URL
   maar zonder die vlag startte met de productieconfiguratiekeuring als loutere
   WAARSCHUWING (identiteitskluis zonder sleutel, versleuteling-at-rest uit,
   betaalwebhook zonder secret) en met de gedeelde kantoorcode open.

   DE FIX: een AANTOONBAAR OPENBAAR adres (server/config/openbaar.js) telt voor
   de beveiliging net zo hard als NODE_ENV=production:
   - config/openbaar.js promoveert de productiekeuring-fouten tot hardeFouten,
     die de start afbreken ongeacht NODE_ENV (server/config.js);
   - kern/kantoor/productiedeur.js sluit de gedeelde kantoorcode ook op een
     openbaar adres;
   - een 'onbekend' adres (niet als publiek opgegeven) blijft een melding, zodat
     lokale starts en toetsen niet omvallen.

   Draai los: node --test test/productie-failclosed.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const config = require('../server/config');
const openbaar = require('../server/config/openbaar');
const productiedeur = require('../server/kern/kantoor/productiedeur');

/* Een volledige, veilige productieconfiguratie (zelfde opsomming als
   test/productie.test.js: "hoe veilig eruitziet"). */
const VEILIG = {
  NODE_ENV: 'production', RTG_ENC_KEY: 'a'.repeat(64),
  APP_URL: 'https://x', DATABASE_URL: 'postgresql://postgres/rtg',
  RTG_VAULT_KEY: 'v'.repeat(64), RTG_SECRET_KEY: 's'.repeat(64),
  REDIS_URL: 'r', ERR_WEBHOOK_URL: 'https://haak.voorbeeld.test/rtg', SMTP_URL: 'm',
  MAIL_PROVIDER_DKIM: '1', OPENAI_API_KEY: 'test-ai-key',
  STRIPE_SECRET_KEY: 'k', STRIPE_WEBHOOK_SECRET: 'whsec_k',
  RTG_MOTOR_GELD: 'motor', RTG_MOTOR_GELD_URL: 'http://motor:3100',
  RTG_MOTOR_TOKEN: 'test-motor-token-met-voldoende-lengte',
  RTG_MOTOR_STATE_KEY_FILE: '/run/secrets/rtg-motor-state-key',
  RTG_MOTOR_EXPECT_GENESIS: 'g-0123456789abcdef0123456789abcdef',
  RTF_IBAN: 'NL11FOUND0000000001', RTG_MEDIA_BACKEND: 's3',
  RTG_MEDIA_S3_BUCKET: 'rtg-productie-media',
  RTG_MEDIA_S3_KEY: 'AKIA0123456789PRODUCTIE', RTG_MEDIA_S3_SECRET: 'm'.repeat(40),
  RTG_HERSTEL_SMS_UIT_BEWUST: '1', STRIPE_UITGAAND_UIT_BEWUST: '1',
  RTG_ISOLATIE_AFDWINGEN: '1', RTG_OWNER_EMAIL: 'eigenaar@echtdomein.nl',
};
// Een adres dat aantoonbaar openbaar is (een opgegeven publiek domein).
const PUBLIEK = 'https://portaal.rtg-publiek.nl';
const weigert = (r) => r.hardeFouten.length > 0 || (r.productie && r.fouten.length > 0);

test('1. officiële productieconfiguratie start (geen fouten, geen hardeFouten)', () => {
  const r = config.valideer(VEILIG);
  assert.equal(r.hardeFouten.length, 0, 'geen hardeFouten: ' + JSON.stringify(r.hardeFouten));
  assert.equal(r.fouten.length, 0, 'geen fouten: ' + JSON.stringify(r.fouten));
});

test('2. productie + demo weigert de start', () => {
  const r = config.valideer({ ...VEILIG, RTG_DEMO: '1' });
  assert.ok(weigert(r), 'RTG_DEMO=1 in productie hoort de start te blokkeren');
  assert.ok([...r.fouten, ...r.hardeFouten].some(f => /RTG_DEMO/.test(f)));
});

test('3. productie + ontbrekende sleutels weigert de start', () => {
  const zonder = { ...VEILIG }; delete zonder.RTG_ENC_KEY; delete zonder.RTG_VAULT_KEY; delete zonder.RTG_SECRET_KEY;
  const r = config.valideer(zonder);
  assert.ok(weigert(r), 'ontbrekende kluis-/encryptiesleutels horen de start te blokkeren');
  assert.ok([...r.fouten, ...r.hardeFouten].some(f => /RTG_ENC_KEY|RTG_VAULT_KEY|RTG_SECRET_KEY/.test(f)));
});

test('4. productie + onveilige betaalprovider (secret zonder webhook-secret) weigert de start', () => {
  const zonder = { ...VEILIG }; delete zonder.STRIPE_WEBHOOK_SECRET;
  const r = config.valideer(zonder);
  assert.ok(weigert(r), 'een betaalsleutel zonder webhook-secret hoort de start te blokkeren');
});

test('5. productie + versleuteling-at-rest uit weigert de start', () => {
  const zonder = { ...VEILIG }; delete zonder.RTG_ENC_KEY;
  const r = config.valideer(zonder);
  assert.ok(weigert(r), 'zonder RTG_ENC_KEY (versleuteling-at-rest) hoort de start te blokkeren');
  assert.ok([...r.fouten, ...r.hardeFouten].some(f => /RTG_ENC_KEY/.test(f)));
});

/* --- DE KERN VAN BLOCKER 3: een verkeerd/ontbrekend environment-label mag niet
   ongemerkt tot een onveilige publieke server leiden. --- */

test('6. een OPENBAAR adres zonder NODE_ENV=production + demo => hardeFouten (start afgebroken)', () => {
  const r = config.valideer({ RTG_DEMO: '1', DEMO_PASS: 'Imran', APP_URL: PUBLIEK });
  assert.equal(r.productie, false, 'dit is geen productieprofiel (NODE_ENV staat niet op production)');
  assert.ok(r.hardeFouten.length > 0, 'demo op een openbaar adres hoort hard te blokkeren');
});

test('7. een OPENBAAR adres zonder NODE_ENV + ontbrekende productiebeveiliging => hardeFouten (de gerepareerde zwakte)', () => {
  // geen NODE_ENV=production, maar wel een publiek APP_URL en GEEN kluissleutels/enc:
  // vóór de fix gaf dit alleen waarschuwingen en startte de server onveilig.
  const r = config.valideer({ APP_URL: PUBLIEK });
  assert.equal(r.productie, false);
  assert.ok(r.hardeFouten.length > 0,
    'een publiek adres zonder complete productiebeveiliging hoort fail-closed te weigeren; kreeg geen hardeFouten');
  assert.ok(r.hardeFouten.some(f => /openbaar adres/.test(f)));
});

test('8. CONTRAST: een ONBEKEND/lokaal adres met dezelfde onvolledige config blokkeert NIET (lokale start blijft werken)', () => {
  // APP_URL niet gezet => 'onbekend'; buiten productie geen hardeFouten.
  const r = config.valideer({});
  assert.equal(r.hardeFouten.length, 0, 'een niet-opgegeven adres mag geen harde blokkade geven: ' + JSON.stringify(r.hardeFouten));
  // en een expliciet lokaal adres evenmin
  const lok = config.valideer({ APP_URL: 'http://localhost:3000' });
  assert.equal(lok.hardeFouten.length, 0, 'localhost mag niet fail-closed blokkeren');
});

test('9. de kantoordeur: de gedeelde code is dicht op een openbaar adres, ook zonder NODE_ENV=production', () => {
  assert.ok(productiedeur.isProductie({ APP_URL: PUBLIEK }), 'een openbaar adres telt als productie voor de kantoordeur');
  assert.ok(productiedeur.codeDicht({ APP_URL: PUBLIEK }), 'de gedeelde kantoorcode hoort dicht op een openbaar adres');
  const sm = productiedeur.sessieMag({ role: 'office' /* geen lidKey, geen passkey */ }, { APP_URL: PUBLIEK });
  assert.equal(sm.ok, false, 'een kantoorsessie zonder passkey mag op een openbaar adres niet openen');
});

test('10. de kantoordeur verandert NIET voor lokaal/onbekend (demo en toetsen blijven werken)', () => {
  assert.equal(productiedeur.isProductie({ APP_URL: 'http://localhost:3000' }), false);
  assert.equal(productiedeur.codeDicht({ APP_URL: 'http://localhost:3000' }), null, 'lokaal: de gedeelde code blijft werken');
  assert.equal(productiedeur.codeDicht({}), null, 'onbekend adres: geen productie-afdwinging');
});

/* C4 (RTG_DEV_LINKS): de vlag zet herstel-/verificatielinks en sms-codes in het
   HTTP-antwoord. Hij hoort door dezelfde poort als RTG_DEMO te worden geweigerd:
   in productie, en op een openbaar adres ook zonder NODE_ENV. */
test('11. productie + RTG_DEV_LINKS=1 weigert de start (C4)', () => {
  const r = config.valideer({ ...VEILIG, RTG_DEV_LINKS: '1' });
  assert.ok(weigert(r), 'RTG_DEV_LINKS=1 in productie hoort de start te blokkeren');
  assert.ok([...r.fouten, ...r.hardeFouten].some(f => /RTG_DEV_LINKS/.test(f)));
});

test('12. een OPENBAAR adres zonder NODE_ENV + RTG_DEV_LINKS=1 => hardeFouten (C4)', () => {
  const { NODE_ENV, ...zonderProd } = VEILIG;
  const r = config.valideer({ ...zonderProd, APP_URL: PUBLIEK, RTG_DEV_LINKS: '1' });
  assert.ok(r.hardeFouten.some(f => /RTG_DEV_LINKS/.test(f)),
    'op een openbaar adres hoort RTG_DEV_LINKS een harde fout te zijn: ' + JSON.stringify(r.hardeFouten));
});

/* C6 (SQLite met meerdere schrijvers): de merge tussen processen laat de
   laatste schrijver winnen, dus een tweede schrijvend proces op SQLite
   verliest stil updates. Een schrijver op SQLite blijft een geldige stand. */
const { DATABASE_URL: _weg, ...SQLITE } = { ...VEILIG, RTG_STORE: 'sqlite' };
const opslagFout = (r) => [...r.fouten, ...r.hardeFouten].some(f => /Meerdere schrijvende processen op SQLite/.test(f));

test('13. productie + SQLite + RTG_SPREIDING=1 weigert de start (C6)', () => {
  const r = config.valideer({ ...SQLITE, RTG_SPREIDING: '1' });
  assert.ok(weigert(r) && opslagFout(r), JSON.stringify([...r.fouten, ...r.hardeFouten]));
});

test('14. productie + SQLite + een opgesplitst RTG_DOMAINS weigert de start (C6)', () => {
  assert.ok(opslagFout(config.valideer({ ...SQLITE, RTG_DOMAINS: 'member,social' })));
  assert.ok(opslagFout(config.valideer({ ...SQLITE, RTG_DOMAINS: '-' })), 'een vlootproces naast het hoofdproces is ook een tweede schrijver');
});

test('15. CONTRAST: een schrijvend proces op SQLite blijft een geldige productiestand (C6)', () => {
  assert.equal(opslagFout(config.valideer(SQLITE)), false, 'het bestaande besluit: een bak met sqlite mag');
  assert.equal(opslagFout(config.valideer({ ...SQLITE, RTG_DOMAINS: '' })), false,
    'een lege RTG_DOMAINS is geen splitsing');
  assert.equal(opslagFout(config.valideer({ ...VEILIG, RTG_SPREIDING: '1' })), false, 'PostgreSQL met spreiding is de bedoelde stand');
});

test('16. een OPENBAAR adres zonder NODE_ENV + SQLite + spreiding => hardeFouten (C6)', () => {
  const { NODE_ENV, ...zonderProd } = SQLITE;
  const r = config.valideer({ ...zonderProd, APP_URL: PUBLIEK, RTG_SPREIDING: '1' });
  assert.ok(r.hardeFouten.some(f => /Meerdere schrijvende processen op SQLite/.test(f)), JSON.stringify(r.hardeFouten));
});

test('17. een uitgeschreven volledige domeinlijst telt ook als splitsing, met de uitweg erbij (C6)', () => {
  const r = config.valideer({ ...SQLITE, RTG_DOMAINS: 'auth,member,supplier,office,staff,social,techniek,zakelijk,wereld' });
  assert.ok(opslagFout(r), 'de keuring houdt geen kopie van de domeinlijst bij, dus een gezette RTG_DOMAINS is een splitsing');
  assert.ok([...r.fouten, ...r.hardeFouten].some(f => /DATABASE_URL/.test(f)), 'en de melding noemt de uitweg');
});
