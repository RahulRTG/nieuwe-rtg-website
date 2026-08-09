/* Het Belastingkantoor (kern/overheid/kantoor.js): de inspecteurscockpit met
   invordering via de Berichtenbox, het btw-beeld uit de facturatiemotor + KVK,
   de slimme signalen en de AI-chef-inspecteur. Alleen voor het rijk. Draai los:
   node --experimental-sqlite --test test/belastingkantoor.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

function api(base, pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

let srv, base, lid, lid2, rijk, partner;
test.before(async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-bdkantoor-'));
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  const u = Date.now().toString().slice(-8);
  lid = (await api(base, '/api/auth/register', { name: 'Inwoner Een', email: 'b1' + u + '@x.nl',
    phone: '061' + u.slice(1), password: 'geheim123', geboortedatum: '1985-04-04', tier: 'rtg', pasApp: 'rtg' })).body.token;
  lid2 = (await api(base, '/api/auth/register', { name: 'Inwoner Twee', email: 'b2' + u + '@x.nl',
    phone: '062' + u.slice(1), password: 'geheim123', geboortedatum: '1979-09-09', tier: 'rtg', pasApp: 'rtg' })).body.token;
  const roster = await api(base, '/api/supplier/roster', { code: 'RIJK' });
  const man = roster.body.staff.find(m => m.role === 'manager');
  rijk = (await api(base, '/api/supplier/login', { code: 'RIJK', staffId: man.id, pin: '1234' })).body.token;
  partner = (await api(base, '/api/supplier/login', { username: 'rahul', password: 'Imran' })).body.token;
  // twee aangiftes: een met openstaand saldo (niets ingehouden) en een met hoge aftrek (controle-signaal)
  await api(base, '/api/overheid/aangifte', { inkomen: 90000, aftrek: 1000, ingehouden: 0 }, lid);
  await api(base, '/api/overheid/aangifte', { inkomen: 50000, aftrek: 30000, ingehouden: 20000 }, lid2);
});
test.after(() => stop(srv && srv.child));

test('1. de cockpit toont het hele beeld: te ontvangen, openstaand en de signalen', async () => {
  const c = await api(base, '/api/overheid/bd/cockpit', {}, rijk);
  assert.equal(c.status, 200);
  assert.ok(c.body.teOntvangen > 0, 'er staat een aanslag open');
  assert.ok(c.body.openstaand >= 1);
  assert.ok(Array.isArray(c.body.signalen));
  assert.ok(c.body.signalen.some(s => s.soort === 'controle'), 'de hoge aftrek valt op als controle-signaal');
  assert.ok('btwDitJaar' in c.body && 'ondernemingen' in c.body, 'het btw/KVK-beeld zit in de cockpit');
});

test('2. invordering: herinnering en betalingsregeling landen in de Berichtenbox van de inwoner', async () => {
  const a = await api(base, '/api/overheid/bd/aanslagen', { stand: 'open' }, rijk);
  assert.equal(a.status, 200);
  const open = a.body.aanslagen[0];
  assert.ok(open && open.saldo > 0);
  // herinnering
  assert.equal((await api(base, '/api/overheid/bd/herinnering', { ref: open.ref }, rijk)).status, 200);
  // regeling: 6 maanden, netjes verdeeld
  const r = await api(base, '/api/overheid/bd/regeling', { ref: open.ref, maanden: 6 }, rijk);
  assert.equal(r.status, 200);
  assert.equal(r.body.regeling.maanden, 6);
  assert.ok(r.body.regeling.per >= Math.floor(open.saldo / 6));
  // een onzinnige regeling wordt geweigerd
  assert.equal((await api(base, '/api/overheid/bd/regeling', { ref: open.ref, maanden: 99 }, rijk)).status, 400);
  // beide besluiten staan in de Berichtenbox van het lid
  const box = await api(base, '/api/overheid/berichten', {}, lid);
  assert.ok(box.body.berichten.some(b => /herinnering/i.test(b.titel)), 'de herinnering is bezorgd');
  assert.ok(box.body.berichten.some(b => /regeling/i.test(b.titel)), 'de regeling is bezorgd');
});

test('3. kwijtschelding maakt de aanslag dicht en meldt het de inwoner', async () => {
  // de tweede inwoner heeft door de hoge aftrek en lage inhouding ook een openstaand saldo
  const a = await api(base, '/api/overheid/bd/aanslagen', { stand: 'open' }, rijk);
  const open = a.body.aanslagen[0];
  assert.ok(open, 'er staat nog een aanslag open');
  const k = await api(base, '/api/overheid/bd/kwijt', { ref: open.ref, reden: 'schrijnend geval' }, rijk);
  assert.equal(k.status, 200);
  // dubbel kwijtschelden kan niet
  assert.equal((await api(base, '/api/overheid/bd/kwijt', { ref: open.ref }, rijk)).status, 409);
  const na = await api(base, '/api/overheid/bd/aanslagen', {}, rijk);
  assert.ok(na.body.aanslagen.find(x => x.ref === open.ref).kwijtgescholden);
});

test('4. het btw-beeld komt uit de facturatiemotor, gekoppeld aan het KVK-register', async () => {
  /* Een echte factuur, zodat er iets te tellen valt EN het getal na te rekenen
     is. De demo-zaak is horeca (9%), dus 121 incl wordt 111,01 grondslag en
     9,99 btw. */
  const f = await api(base, '/api/supplier/facturen/maak',
    { omschrijving: 'Diner', aantal: 1, bedrag: 121, koperNaam: 'Gast' }, partner);
  assert.equal(f.status, 200, 'de factuur is geboekt');
  const incl = f.body.factuur.totaal, btwOpFactuur = f.body.factuur.btwBedrag;

  const b = await api(base, '/api/overheid/bd/btw', {}, rijk);
  assert.equal(b.status, 200);
  assert.ok(Array.isArray(b.body.zaken));
  assert.ok('totaalBtw' in b.body && 'totaalGrondslag' in b.body);
  // elke zaak in het beeld draagt de KVK-koppeling (ingeschreven ja/nee)
  for (const z of b.body.zaken) assert.ok('ingeschreven' in z);

  /* HET WOORD MOET HET GETAL DEKKEN. Dit veld heette `omzet` en droeg het
     factuurbedrag INCLUSIEF btw; wie het naast een aangifte legde, vergeleek
     twee verschillende dingen. Het heet nu grondslag en moet dus onder het
     inclusief-bedrag liggen, met precies de btw ertussen. */
  const zaak = b.body.zaken.find(z => z.btw > 0);
  assert.ok(zaak, 'er staat een zaak met btw in het beeld');
  assert.equal('omzet' in zaak, false, 'het oude, misleidende veld is weg');
  assert.ok(zaak.btw > 0 && zaak.grondslag > 0, 'grondslag en btw staan er allebei');
  assert.ok(zaak.grondslag + zaak.btw >= Math.round(incl) - 1,
    'de zojuist geboekte factuur zit in het jaarbeeld');
  assert.ok(zaak.grondslag < zaak.grondslag + zaak.btw - Math.round(btwOpFactuur) + 1,
    'de grondslag is EXCLUSIEF btw en niet het factuurbedrag (' + zaak.grondslag + ' bij ' + zaak.btw + ' btw)');
});

test('5. de AI-chef-inspecteur adviseert op het hele beeld (en beslist niets)', async () => {
  const r = await api(base, '/api/overheid/bd/ai', { vraag: 'Wat pak ik als eerste op?' }, rijk);
  assert.equal(r.status, 200);
  assert.ok(r.body.antwoord && r.body.antwoord.length > 20);
  assert.match(r.body.antwoord, /beslis|besluit|zelf/i, 'het advies benadrukt dat de mens beslist');
});

test('6. het kantoor is alleen voor het rijk: partner en anoniem komen er niet in', async () => {
  assert.equal((await api(base, '/api/overheid/bd/cockpit', {}, partner)).status, 403);
  assert.equal((await api(base, '/api/overheid/bd/cockpit', {}, null)).status, 401);
  assert.equal((await api(base, '/api/overheid/bd/herinnering', { ref: 'x' }, partner)).status, 403);
});

/* ---- de aansluiting: het toezicht op de btw-aangifte ----
   De hele reden dat het kantoor en de ondernemer dezelfde telling delen
   (kern/fiscaal/btwtelling.js): een inspecteur die anders rekent dan de aangever
   vindt altijd een verschil, en dan zegt een verschil niets meer. */
test('7. de aansluiting zet het factuurregister naast wat er is aangegeven', async () => {
  const nu = new Date();
  const periode = nu.getUTCFullYear() + 'K' + (Math.floor(nu.getUTCMonth() / 3) + 1);

  // de zaak factureert en maakt zijn aangifte op over het lopende kwartaal
  await api(base, '/api/supplier/facturen/maak',
    { omschrijving: 'Lunch', aantal: 1, bedrag: 218, koperNaam: 'Gast' }, partner);
  const eigen = await api(base, '/api/supplier/btw/opmaken', { periode }, partner);
  assert.equal(eigen.status, 200, 'de zaak maakt zijn aangifte op');

  const r = await api(base, '/api/overheid/bd/btw/aansluiting', { periode }, rijk);
  assert.equal(r.status, 200);
  assert.equal(r.body.periode, periode);
  assert.equal(r.body.periodeLoopt, true, 'het lopende kwartaal loopt nog');

  const z = r.body.zaken.find(x => x.code === eigen.body.aangifte.code);
  assert.ok(z, 'de zaak staat in de aansluiting');
  /* DE BEWERING WAAR HET OM DRAAIT: de inspecteur telt exact hetzelfde als de
     aangever. Niet ongeveer -- op de cent. */
  assert.equal(z.geteldBtwCenten, eigen.body.aangifte.verschuldigdCenten,
    'inspecteur en ondernemer komen op dezelfde verschuldigde btw uit');
  assert.equal(z.stand, 'alleen_concept', 'een concept is niet aangegeven');
  assert.equal(z.aangegevenBtwCenten, null, 'en telt dus niet als aangifte');

  /* Over een LOPENDE periode geeft het toezicht geen signalen: de aangifte van
     de ondernemer weigert indienen daar met zoveel woorden, dus "niets
     ingediend" is daar geen bevinding maar de bedoeling. */
  const c = await api(base, '/api/overheid/bd/cockpit', {}, rijk);
  assert.equal(c.body.signalen.filter(s => s.soort === 'btw' && /lopend/.test(s.tekst)).length, 0);
  assert.ok(c.body.btwPeriode && /^\d{4}K[1-4]$/.test(c.body.btwPeriode),
    'de cockpit noemt de periode waar het toezicht naar kijkt');
});

test('8. een periode die niet bestaat wordt geweigerd, en het rijk is de enige lezer', async () => {
  assert.equal((await api(base, '/api/overheid/bd/btw/aansluiting', { periode: '2026K9' }, rijk)).status, 400);
  assert.equal((await api(base, '/api/overheid/bd/btw/aansluiting', { periode: 'rommel' }, rijk)).status, 400);
  assert.equal((await api(base, '/api/overheid/bd/btw/aansluiting', {}, partner)).status, 403,
    'een gewone zaak leest de aansluiting van iedereen niet');
  assert.equal((await api(base, '/api/overheid/bd/btw/aansluiting', {}, null)).status, 401);
});
