/* ============================================================================
   MELDINGEN-ISOLATIE -- regressie voor RTG-V1-RELEASE blocker 2.

   DE FOUT (bewezen in de audit): persoonlijke meldingen gingen via
   notify(customerTier,...) naar de GEDEELDE bak db.data.notifications[tier] en
   via een SSE-broadcast doel:'tier'. meldingenVan() gaf die bak onverkort aan
   ELK account van die pas. Omdat echte accounts hun pas als tier delen, zag elk
   lid de boekingen, conciërge-/gast-chatteksten en identiteitsverificaties van
   alle leden met dezelfde pas -- een cross-member AVG-lek, onzichtbaar in demo
   (daar is key===tier).

   DE FIX:
   - notify(dest) routeert op bestemmingssoort: een lid-SLEUTEL ('user-<id>')
     is persoonlijk (key-bak + SSE doel:'key'); een pas als bestemming wordt in
     productie NIET bezorgd/opgeslagen (fail-closed), tenzij expliciet
     notify.broadcast(). In DEMO valt de sleutel samen met de pas, dus daar
     blijft de persoonlijke bezorging werken.
   - meldingenVan() geeft uit de pas-bak alleen nog `broadcast:true`-items terug.
   - de persoonlijke schrijvers geven nu de ledensleutel mee.

   Deze toets zou VÓÓR de fix zakken (B ziet A's melding) en slaagt erna.

   Draai los: node --test test/meldingen-isolatie.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { startServer, stop, postJson, kantoorAlsPersoon } = require('./helper');

/* ---------------------------------------------------------------------------
   DEEL A -- de routering van meld/notify, geïsoleerd (geen server).
   ------------------------------------------------------------------------- */
function maakMeldingen(DEMO) {
  const publishes = [];
  const db = { data: { notifications: {}, meldingVoorkeur: {}, pushSubs: {}, pushSubsUser: {} } };
  const bus = { publish: (kanaal, msg) => publishes.push({ kanaal, msg }) };
  let ids = 0;
  const m = require('../server/opzet/meldingen')({
    DEMO, crypto, db, bus, save: () => {}, webpush: null, nextSseId: () => ++ids,
    accounts: {}, eigenaar: {}, sessions: {}, PERSONAS: {}, GIDS_SEED_TIERS: [],
    ensureSupplierDefaults: () => {}, tokenHash: () => '' });
  return { notify: m.notify, db, publishes };
}

test('A1. een persoonlijke melding (lid-sleutel) landt in de key-bak en gaat per SSE naar die ENE key', () => {
  const { notify, db, publishes } = maakMeldingen(false);
  notify('user-7', { title: 'T', body: 'persoonlijk', scope: 'orders' });
  assert.equal((db.data.notifications['user-7'] || []).length, 1, 'in de key-bak van user-7');
  assert.equal(db.data.notifications['business'], undefined, 'niet in een gedeelde pas-bak');
  const p = publishes.find(x => x.msg && x.msg.event === 'notify');
  /* SSE-ISOLATIE, deterministisch bewezen: de melding gaat als doel:'key' met
     match === 'user-7'. server/kern/sse.js levert een doel:'key'-event alleen
     aan een verbinding met c.key === m.match. Een ander lid (c.key !== 'user-7')
     ontvangt hem dus structureel NIET -- geen tijd/stream nodig om dat te zien. */
  assert.ok(p, 'er is een notify-SSE');
  assert.equal(p.msg.doel, 'key', 'persoonlijk: doel is key, geen tier-broadcast');
  assert.equal(p.msg.match, 'user-7', 'alleen de verbinding met c.key===user-7 matcht in sse.js');
  assert.notEqual(p.msg.doel, 'tier', 'nooit een tier-broadcast voor een persoonlijke melding');
});

test('A2. PRODUCTIE: een pas als bestemming zonder broadcast wordt NIET opgeslagen en NIET verzonden (fail-closed)', () => {
  const { notify, db, publishes } = maakMeldingen(false);
  notify('business', { title: 'T', body: 'zou lekken', scope: 'orders' });
  assert.equal(db.data.notifications['business'], undefined, 'een pas-bak mag niet met persoonlijke inhoud vollopen');
  assert.equal(publishes.filter(x => x.msg && x.msg.event === 'notify').length, 0, 'geen enkele SSE-uitzending');
});

test('A3. een EXPLICIETE broadcast landt wél in de pas-bak met broadcast:true en gaat per tier-SSE', () => {
  const { notify, db, publishes } = maakMeldingen(false);
  notify.broadcast('business', { title: 'Mededeling', body: 'voor iedereen' });
  const bak = db.data.notifications['business'] || [];
  assert.equal(bak.length, 1);
  assert.equal(bak[0].broadcast, true, 'gemarkeerd als broadcast');
  const p = publishes.find(x => x.msg && x.msg.event === 'notify');
  assert.ok(p && p.msg.doel === 'tier' && p.msg.match.includes('business'), 'SSE doel:tier naar de pas');
});

test('A4. DEMO: een persona-sleutel (==pas) wordt persoonlijk bezorgd (demo heeft één persona per pas)', () => {
  const { notify, db, publishes } = maakMeldingen(true);
  notify('business', { title: 'T', body: 'demo-persona', scope: 'orders' });
  assert.equal((db.data.notifications['business'] || []).length, 1, 'in demo is de pas de persona zelf');
  const p = publishes.find(x => x.msg && x.msg.event === 'notify');
  assert.ok(p && p.msg.doel === 'key' && p.msg.match === 'business', 'persoonlijk bezorgd, niet als broadcast');
  assert.ok(!db.data.notifications['business'][0].broadcast, 'geen broadcast-vlag');
});

/* ---------------------------------------------------------------------------
   DEEL B -- end-to-end tegen een echte server: twee leden, dezelfde pas.
   A krijgt een persoonlijke conciërge-melding; B mag die niet kunnen LEZEN.
   (De realtime/SSE-isolatie is deterministisch bewezen in A1: een persoonlijke
   melding gaat als doel:'key' naar precies die sleutel, en sse.js levert zo'n
   event alleen aan c.key===match -- een ander lid ontvangt hem structureel niet.
   De notify-schrijf is synchroon klaar vóór het antwoord van /api/office/reply,
   dus deze proef heeft geen tijdsafhankelijke wachten nodig.)
   ------------------------------------------------------------------------- */
async function registreer(post, n) {
  const email = 'iso' + n + '@voorbeeld.test';
  const reg = await post('/api/auth/register', { name: 'Iso ' + n, email, password: 'geheim12', geboortedatum: '1990-01-01' });
  assert.ok(reg.token, 'registratie ' + n + ' faalde: ' + JSON.stringify(reg).slice(0, 140));
  const me = await post('/api/auth/me', {}, reg.token);
  return { token: reg.token, id: me.user.id, tier: me.user.tier };
}

test('B1. e2e: een persoonlijke melding voor A kan B (zelfde pas) niet lezen', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-meld-iso-'));
  const srv = await startServer({ env: { RTG_DATA_DIR: dir } });
  const base = srv.base;
  const post = postJson(base);
  try {
    const A = await registreer(post, 'A');
    const B = await registreer(post, 'B');
    assert.equal(A.tier, B.tier, 'beide leden horen dezelfde pas te hebben (de leaksituatie)');

    const office = await kantoorAlsPersoon(base);
    assert.ok(office, 'een kantoorsessie is nodig om de conciërge te spelen');

    // de conciërge beantwoordt A -> notify('user-'+A.id); de melding wordt
    // synchroon bewaard voordat /api/office/reply antwoordt.
    const merk = 'hallo-A-' + crypto.randomBytes(3).toString('hex');
    const rep = await post('/api/office/reply', { userId: A.id, text: merk }, office);
    assert.ok(!rep.error, 'conciërge-antwoord faalde: ' + JSON.stringify(rep).slice(0, 140));

    const nA = await post('/api/notifications', {}, A.token);
    const nB = await post('/api/notifications', {}, B.token);
    const aHeeft = (nA.notifications || []).some(x => (x.scope === 'chat'));
    assert.ok(aHeeft, 'A hoort zijn eigen conciërge-melding te zien');
    const bHeeft = (nB.notifications || []).some(x => (x.scope === 'chat') || (x.body || '').includes(merk));
    assert.equal(bHeeft, false, 'B mag de persoonlijke melding van A NIET kunnen lezen');
  } finally {
    await stop(srv);
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {}
  }
});
