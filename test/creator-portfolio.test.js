/* ============================================================================
   HET PORTFOLIO VAN EEN CREATOR -- de laatste losse supplier-route.

   creator/portfolio stond als nooit aangeroepen in de waargenomen
   dekkingsmeting. Hij was bijna aan mijn aandacht ontsnapt: de route wordt
   niet met een letterlijk pad geregistreerd maar in een LUS over vijf paren
   (profiel, platform, tarief, portfolio, idee), dus een zoekopdracht op
   '/api/supplier/creator/portfolio' vindt niets. Ik dacht daardoor even dat
   de routekaart een spookroute noemde -- het was andersom: de routekaart had
   gelijk en mijn zoekopdracht niet.

   Dat is meteen de reden dat die vijf hier samen staan. Ze delen een
   registratie, dus ze delen ook hun deuren: als er ooit een managercontrole
   uit die lus valt, valt hij uit alle vijf tegelijk.

   WAT ER OP HET SPEL STAAT

   - EEN PORTFOLIO IS EEN ETALAGE, EN DIE HANGT AAN EEN CREATOR-ACCOUNT. Een
     restaurant dat portfoliowerk opvoert is geen creator maar een fout.
   - VIJF ROUTES, EEN DEUR. Alle vijf zitten achter dezelfde managercontrole
     uit dezelfde lus; deze toets loopt ze allemaal langs zodat een gat in de
     lus niet vier keer onopgemerkt blijft.

   Draai los: node --test test/creator-portfolio.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, creator, creatorWerker, resto;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-creator-'));

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
async function inlog(code, rol) {
  const roster = await api('/api/supplier/roster', { code });
  const wie = (roster.body.staff || []).find(x => x.role === rol);
  return wie ? (await api('/api/supplier/login', { code, staffId: wie.id, pin: rol === 'manager' ? '1234' : '5678' })).body.token : null;
}
/* Het overzicht geeft de creator-gegevens PLAT terug, niet onder een
   creator-sleutel -- mijn eerste versie las .body.creator en kreeg altijd een
   lege lijst, waardoor toets 1 op nul bleef staan. */
const portfolio = async t => (await api('/api/supplier/creator/overzicht', {}, t)).body.portfolio || [];

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  creator = await inlog('LUMINA', 'manager');     // Lumina Media: type 'creator' (cap 'creator')
  creatorWerker = await inlog('LUMINA', 'staff');
  resto = await inlog('KIKUNOI', 'manager');
  assert.ok(creator && resto, 'de creator en het restaurant staan klaar');
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. een portfolio hangt aan een creator-account', async () => {
  assert.equal((await api('/api/supplier/creator/portfolio', { titel: 'Iets' }, resto)).status, 409,
    'een restaurant heeft geen portfolio');
  assert.equal((await api('/api/supplier/creator/overzicht', {}, resto)).status, 409);
  assert.equal((await api('/api/supplier/creator/portfolio', { titel: '' }, creator)).status, 400,
    'werk zonder titel is geen werk');

  const voor = (await portfolio(creator)).length;
  const mk = await api('/api/supplier/creator/portfolio',
    { titel: 'Campagne Sal de Mar, zomer', link: 'https://voorbeeld.test/werk/1', soort: 'video' }, creator);
  assert.equal(mk.status, 200, JSON.stringify(mk.body).slice(0, 200));

  const na = await portfolio(creator);
  assert.equal(na.length, voor + 1, 'het werk staat in de etalage');
  const item = na.find(p => p.titel === 'Campagne Sal de Mar, zomer');
  assert.ok(item, 'met titel: ' + JSON.stringify(na).slice(0, 200));

  const weg = await api('/api/supplier/creator/portfolio', { weg: true, id: item.id }, creator);
  assert.equal(weg.status, 200);
  assert.equal((await portfolio(creator)).length, voor, 'en het gaat er weer af');
});

test('2. vijf routes, een deur: de hele lus zit achter het management', async () => {
  if (!creatorWerker) return;
  /* Alle vijf worden in dezelfde lus geregistreerd, met dezelfde
     managercontrole. Ze hier alle vijf langslopen is geen herhaling maar de
     hele reden dat deze toets bestaat: valt die ene regel ooit uit de lus,
     dan valt hij uit alle vijf tegelijk, en dan hoort er meer dan een toets
     rood te worden. */
  for (const [pad, body] of [
    ['profiel', { niche: 'Reizen', bio: 'Gekaapt' }],
    ['platform', { naam: 'instagram', volgers: 99999 }],
    ['tarief', { soort: 'post', bedrag: 1 }],
    ['portfolio', { titel: 'Gekaapt' }],
    ['idee', { titel: 'Gekaapt' }]
  ]) {
    assert.equal((await api('/api/supplier/creator/' + pad, body, creatorWerker)).status, 403,
      pad + ' hoort achter het management te zitten');
  }
  // lezen mag het hele team wel: je moet weten wat er in de etalage staat
  assert.equal((await api('/api/supplier/creator/overzicht', {}, creatorWerker)).status, 200,
    'het overzicht lezen mag zonder managerrol');
});
