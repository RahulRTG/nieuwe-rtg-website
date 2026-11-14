/* Route-handlerproef met echte toelatingskern; office-auth is een fixture.
   Geen HTTP-, browser- of werkelijke personeelsbevoegdheidsclaim. */
'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
function deur() {
  const db = { data: { tenants: { 'ORG-A': { org: 'ORG-A', actief: true, zaken: [], werkruimtes: [] } } } };
  const a = { id: 'eigen-aanvraag', accountId: 1, pas: 'business', status: 'in behandeling' }, handlers = new Map();
  const accounts = { getUserById: id => id === 1 ? { id } : null };
  const { beslis } = require('../server/kern/aanmeldingen/besluit')({ vind: id => id === a.id ? a : null,
    beeld: x => JSON.parse(JSON.stringify(x)), kap: (x, n) => String(x || '').slice(0, n),
    nu: () => '2026-11-13T10:00:00.000Z', accounts, save() {}, startBetalingen() { throw Error('Geen factuur'); },
    PASSEN: { business: { naam: 'Business' } }, zelfservice: true,
    organisatieVoor: require('../server/kern/tenant/lezen')({ db }).haal });
  const auth = (req, res, next) => req.office ? next() : res.status(401).json({ error: 'Kantoor vereist' });
  require('../server/routes/aanmeldingen')({ app: { post(pad, ...rij) { handlers.set(pad, rij); } },
    accounts, auth, officeAuth: auth, boardroomWie: req => req.actor || null, aanmeldingen: { beslis } });
  async function api(body, office = true, actor = 'persoon:medewerker') {
    const req = { body, office, actor }, uit = { status: 200 };
    const res = { status(n) { uit.status = n; return this; }, json(v) { uit.body = v; return this; } };
    const rij = handlers.get('/api/aanmelding/beslis'); let n = 0;
    const next = () => rij[n] && rij[n++](req, res, next);
    await next(); return uit;
  }
  return { a, api };
}
test('kantoorroute geeft orgkeuze/prijs door, actor alleen uit kantoorsessie; body kan die niet vervalsen', async () => {
  const f = deur(), b = { id: f.a.id, besluit: 'geaccepteerd', organisatie: 'org-a', contractEuro: 7100,
    door: 'verzonnen persoon', accountId: 2 };
  assert.equal((await f.api(b, false)).status, 401);
  assert.equal((await f.api(b, true, null)).status, 403);
  assert.equal((await f.api({ ...b, organisatie: 'ONTBREEKT' })).status, 409);
  assert.equal(f.a.status, 'in behandeling');
  const r = await f.api(b); assert.equal(r.status, 200);
  assert.equal(r.body.aanmelding.besluit.organisatie, 'ORG-A');
  assert.equal(r.body.aanmelding.besluit.door, 'persoon:medewerker');
  assert.equal(f.a.accountId, 1); assert.equal(f.a.contract.maandCenten, 710000);
});
