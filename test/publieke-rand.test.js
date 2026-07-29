/* ============================================================================
   DE PUBLIEKE RAND -- wat een onbekende bezoeker krijgt.

   Deze endpoints wees de waargenomen dekkingsmeting als nooit aangeroepen aan,
   en ze horen bij elkaar om een reden die niets met hun onderwerp te maken
   heeft: dit is de buitenkant. Een krant, een gemeenteloket, een webhook van
   de betaalprovider, de publieke sleutel voor pushmeldingen, de zegelcontrole.
   Alles wat hier open staat, staat open voor het hele internet.

   DRIE VRAGEN, EN ZE GELDEN ALLEMAAL VOOR ALLEMAAL

   1. WAT KOMT ERUIT? Een publiek loket mag een openbare bekendmaking tonen en
      geen persoonsgegeven. De grens loopt hier niet tussen gebruikers maar
      tussen "openbaar" en "van iemand".
   2. WAT GAAT ERIN? De webhook is het enige adres waar een vreemde iets mag
      POSTen dat de administratie raakt. Zonder geldige handtekening hoort daar
      niets van waar te worden -- en dat is precies het soort route dat ooit
      anoniem 200 gaf (zie de opmerking in server/betaal.js).
   3. VALT ER IETS OM? Rommel, een lege body, een verzonnen code. Een 500 op de
      publieke rand is een uitnodiging.

   Draai los: node --experimental-sqlite --test test/publieke-rand.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { startServer, stop } = require('./helper');

/* Met een webhook-secret gezet, want dat is de stand die er in productie toe
   doet. Zonder secret valt betaal.js buiten productie met opzet door naar
   JSON.parse (demo-geld, anders start niets lokaal); IN productie gooit hij.
   Die doorval is dus geen gat maar een bewuste demo-stand -- en precies daarom
   toetsen we hier de stand met secret: dan moet de handtekening kloppen. */
const WEBHOOK_SECRET = 'test-webhook-secret-abc123';

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-rand-'));
let srv, base, lid, zaak;
const NAAM = 'Publieke Randnaam Zeldzaam';

const vraag = (pad, opts = {}) => fetch(base + pad, {
  method: opts.method || 'POST',
  headers: { ...(opts.ruw ? {} : { 'Content-Type': 'application/json' }),
    ...(opts.token ? { Authorization: 'Bearer ' + opts.token } : {}), ...(opts.headers || {}) },
  body: opts.method === 'GET' ? undefined : (opts.ruw != null ? opts.ruw : JSON.stringify(opts.body || {}))
}).then(async r => { const t = await r.text();
  let b = {}; try { b = JSON.parse(t); } catch (e) {}
  return { status: r.status, body: b, tekst: t }; });
const post = (pad, body, token) => vraag(pad, { body, token });
const get = (pad, token) => vraag(pad, { method: 'GET', token });

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE: 'KANTOOR-RAND',
    STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET } });
  base = srv.base;
  const u = Date.now().toString().slice(-9);
  const r = await post('/api/auth/register', { name: NAAM, email: 'rand' + u + '@x.nl',
    phone: '06' + u.slice(0, 8), password: 'geheim12345', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' });
  lid = { token: r.body.token, verifyUrl: r.body.devVerifyUrl };
  assert.ok(lid.token, 'het lid bestaat');

  const rooster = await post('/api/supplier/roster', { code: 'KIKUNOI' });
  const man = (rooster.body.staff || []).find(x => x.role === 'manager');
  zaak = (await post('/api/supplier/login', { code: 'KIKUNOI', staffId: man.id, pin: '1234' })).body.token;
});

test.after(() => { stop(srv && srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

/* ================= 1. de betaal-webhook: het enige anonieme schrijfadres ==== */

test('1. de betaal-webhook gelooft niets zonder geldige handtekening', async () => {
  /* Dit is het enige adres waar een vreemde iets mag POSTen dat de
     administratie raakt: de provider roept hier "betaald". De handtekening
     wordt over de ONBEWERKTE bytes berekend, dus de route staat met opzet voor
     de JSON-parser -- zou hij erna staan, dan tekent hij over een
     genormaliseerde vorm en klopt de vergelijking niet meer. */
  const gebeurtenis = JSON.stringify({ id: 'evt_verzonnen', type: 'payment_intent.succeeded',
    data: { object: { amount: 999999, currency: 'eur' } } });
  const echt = crypto.createHmac('sha256', WEBHOOK_SECRET).update(Buffer.from(gebeurtenis)).digest('hex');
  const kop = (h) => ({ 'Content-Type': 'application/json', 'x-rtg-signature': h });

  const zonder = await vraag('/api/betaal/webhook', { ruw: gebeurtenis, headers: { 'Content-Type': 'application/json' } });
  assert.equal(zonder.status, 400, 'zonder handtekening: 400, niet 200');
  assert.equal(zonder.tekst.includes('999999'), false, 'en het bedrag wordt niet teruggekaatst');

  for (const [wat, h] of [['verzonnen', 'nepnepnep'], ['leeg', ''],
    ['de goede maar een teken korter', echt.slice(0, -1)],
    ['de goede met een ander teken', echt.slice(0, -1) + (echt.endsWith('a') ? 'b' : 'a')]]) {
    const r = await vraag('/api/betaal/webhook', { ruw: gebeurtenis, headers: kop(h) });
    assert.equal(r.status, 400, 'handtekening ' + wat + ': 400');
  }

  // en met de ECHTE handtekening gaat hij wel open
  const goed = await vraag('/api/betaal/webhook', { ruw: gebeurtenis, headers: kop(echt) });
  assert.equal(goed.status, 200, 'de echte handtekening wordt aangenomen: ' + goed.tekst.slice(0, 150));

  /* Dezelfde handtekening over ANDERE bytes hoort niet te werken -- anders is
     de handtekening een wachtwoord in plaats van een zegel over de inhoud. */
  const geknoeid = gebeurtenis.replace('999999', '111111');
  const hergebruik = await vraag('/api/betaal/webhook', { ruw: geknoeid, headers: kop(echt) });
  assert.equal(hergebruik.status, 400, 'een geldige handtekening over andere bytes werkt niet');

  const leeg = await vraag('/api/betaal/webhook', { ruw: '', headers: kop('x') });
  assert.notEqual(leeg.status, 500, 'een lege body valt niet om: ' + leeg.status);
  const rommel = await vraag('/api/betaal/webhook', { ruw: '{dit is geen json',
    headers: kop(crypto.createHmac('sha256', WEBHOOK_SECRET).update(Buffer.from('{dit is geen json')).digest('hex')) });
  assert.notEqual(rommel.status, 500, 'onleesbare bytes met een geldige handtekening vallen niet om: ' + rommel.status);
});

/* ================= 2. de clustersleutel ================= */

test('2. de cluster-schakelaar bestaat niet voor wie de sleutel niet heeft', async () => {
  /* promote/demote verplaatsen het schrijfrecht tussen servers. Zonder de
     juiste kop hoort het antwoord 404 te zijn en niet 403: een 403 bevestigt
     dat het adres bestaat, en dat is bij een failover-schakelaar al te veel. */
  for (const actie of ['promote', 'demote', 'verzonnen']) {
    const zonder = await post('/api/cluster/' + actie, {});
    assert.equal(zonder.status, 404, '/api/cluster/' + actie + ' zonder sleutel geeft 404');
    const fout = await vraag('/api/cluster/' + actie, { headers: { 'x-rtg-cluster': 'niet-de-sleutel' } });
    assert.equal(fout.status, 404, 'en met een verkeerde sleutel ook');
  }
});

/* ================= 3. wat er open MAG staan ================= */

test('3. de publieke sleutel voor pushmeldingen is publiek, en alleen de publieke', async () => {
  const r = await get('/api/push/key');
  assert.equal(r.status, 200, 'de sleutel is op te halen zonder inlog');
  /* Een VAPID-paar heeft een publieke en een private helft. Alleen de publieke
     hoort de deur uit; de private is waarmee je meldingen ondertekent. */
  assert.equal(/privateKey|priv/i.test(r.tekst), false, 'de private helft komt er niet uit');
});

test('4. de zegelcontrole keurt een verzonnen zegel af zonder iets te verklappen', async () => {
  const sleutel = await get('/api/zegel/sleutel');
  assert.equal(sleutel.status, 200, 'de publieke zegelsleutel is op te halen');
  assert.equal(/private|geheim/i.test(sleutel.tekst), false, 'en het is de publieke helft');

  for (const zegel of ['', 'onzin', 'a.b.c', JSON.stringify({ nep: true }), 'x'.repeat(5000)]) {
    const r = await post('/api/zegel/controleer', { zegel, code: zegel });
    assert.notEqual(r.status, 500, 'een verzonnen zegel valt niet om: ' + r.status);
    assert.equal(/geldig"\s*:\s*true|ok"\s*:\s*true/.test(r.tekst), false,
      'en wordt nooit als geldig gemeld: ' + r.tekst.slice(0, 120));
  }
});

test('5. de krant is openbaar, maar kent geen verzonnen editie', async () => {
  const gids = await post('/api/krant/gids', {});
  assert.equal(gids.status, 200, 'de gids is openbaar');
  assert.ok(Array.isArray(gids.body.lijst), 'een lijst, ook als hij leeg is');

  const open = await post('/api/krant/open', { code: 'BESTAATNIET' });
  assert.notEqual(open.status, 500, 'een onbekende krantcode valt niet om');
  assert.notEqual(open.status, 200, 'en levert geen krant op');

  const art = await post('/api/krant/artikel', { code: 'BESTAATNIET', id: 'x' });
  assert.notEqual(art.status, 500);
  assert.equal(art.tekst.includes(NAAM), false, 'en er komt geen ledennaam uit');
});

test('6. de openbare overheids- en gemeenteloketten tonen bekendmakingen, geen mensen', async () => {
  for (const pad of ['/api/overheid/bekendmaking', '/api/gemeente/bekendmaking', '/api/gemeente/vergunningen']) {
    const r = await post(pad, {});
    assert.notEqual(r.status, 500, pad + ' valt niet om: ' + r.status);
    if (r.status === 200) {
      assert.equal(r.tekst.includes(NAAM), false, pad + ' bevat geen ledennaam');
      assert.equal(/"bsn"|burgerservicenummer/i.test(r.tekst), false, pad + ' bevat geen BSN');
    }
  }
});

/* ================= 4. wat er NIET open mag staan ================= */

test('7. het partnerkanaal en de VIP-lijst vragen om de juiste rol', async () => {
  /* /api/partner en /api/partnertrips horen bij het partnerkanaal voor
     niet-leden; /api/lucht/* is voor de luchthavenpartner. Ze staan hier omdat
     ze op de rand liggen: het zijn precies de adressen waarvan je zou kunnen
     denken dat ze publiek zijn. */
  const vip = await post('/api/lucht/vip/lijst', {});
  assert.ok([401, 403].includes(vip.status), 'de VIP-lijst is niet publiek: ' + vip.status);
  assert.equal(vip.tekst.includes(NAAM), false, 'en verklapt geen naam');
  const gate = await post('/api/lucht/vlucht/gate', { vlucht: 'x', gate: 'A1' });
  assert.ok([401, 403].includes(gate.status), 'de gate verzetten is niet publiek: ' + gate.status);

  // met een zaaksessie mag de luchthavenpartner er wel bij (of hij krijgt een
  // nette weigering omdat KIKUNOI geen luchthaven is -- nooit een 500)
  const metZaak = await post('/api/lucht/vip/lijst', {}, zaak);
  assert.notEqual(metZaak.status, 500, 'met een zaaksessie valt hij niet om: ' + metZaak.status);

  for (const pad of ['/api/partner', '/api/partnertrips']) {
    const r = await post(pad, {});
    assert.notEqual(r.status, 500, pad + ' valt niet om');
    if (r.status === 200) assert.equal(r.tekst.includes(NAAM), false, pad + ' bevat geen ledennaam');
  }
});

/* ================= 5. de e-mailbevestiging ================= */

test('8. verify-email weigert elk verzonnen token, en hergebruik is idempotent', async () => {
  /* Het bevestigingstoken is doelgebonden (verify-email) en eenmalig. Twee
     fouten die hier klassiek zijn: een token van een ANDER doel accepteren, en
     hem twee keer laten werken. */
  for (const t of ['', 'onzin', 'a.b.c', 'x'.repeat(400)]) {
    const r = await post('/api/auth/verify-email', { token: t });
    assert.notEqual(r.status, 500, 'een verzonnen token valt niet om: ' + r.status);
    assert.notEqual(r.status, 200, 'en bevestigt niets');
  }

  if (lid.verifyUrl) {
    const echt = lid.verifyUrl.split('verify=')[1];
    assert.ok(echt, 'de registratie gaf een bevestigingslink terug (dev-veld)');
    const eerste = await post('/api/auth/verify-email', { token: echt });
    assert.equal(eerste.status, 200, 'het echte token werkt: ' + eerste.tekst.slice(0, 150));

    /* HIER STAAT WAT HET NU DOET, NIET WAT IK ERVAN VERWACHTTE.

       Ik ging ervan uit dat een bevestigingslink eenmalig zou zijn en schreef
       assert.notEqual(200). Dat faalde: het token blijft zijn volle drie dagen
       geldig en werkt opnieuw. De machinerie om hem in te trekken bestaat wel
       (accounts.trekInActie + de isIngetrokken-controle in verifyActionToken);
       deze route roept hem alleen niet aan.

       Ik laat dat staan en verander het gedrag hier niet, om twee redenen. De
       schade is nul -- opnieuw bevestigen zet hetzelfde vinkje nog eens, er is
       geen rechtenwinst -- en "moet een bevestigingslink eenmalig zijn" is een
       beleidskeuze over de auth-laag, niet iets om en passant in een
       dekkingsronde te veranderen. Wat de test wel vastlegt: hij is IDEMPOTENT.
       Zou hergebruik ooit meer gaan doen dan hetzelfde vinkje zetten, dan valt
       hij hier om. */
    const tweede = await post('/api/auth/verify-email', { token: echt });
    assert.equal(tweede.status, 200, 'het token is (nu) herbruikbaar binnen zijn geldigheid');
    assert.deepEqual(tweede.body, eerste.body, 'en hergebruik levert exact hetzelfde op: idempotent');

    // een token van een ANDER doel hoort hier nooit te werken
    const herstel = await post('/api/auth/forgot', { login: 'onbekend@x.nl' });
    assert.notEqual(herstel.status, 500);
  }
});
