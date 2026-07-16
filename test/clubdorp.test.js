/* Het clubdorp: bars, clubs en beachclubs krijgen dezelfde afdelingen-motor
   als het hotel, maar met de eigen afdelingen van de nachtzaak: van de deur
   en de garderobe tot promo, inkoop en het kantoor. Draai los:
   node --experimental-sqlite --test test/clubdorp.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base;
let club, hotel, resto;      // PONTO (bar), HOSHI (hotel), KIKUNOI (restaurant)
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-clubdorp-'));

const api = (pad, body, t) => fetch(base + '/api/' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

const managerVan = async (code) => {
  const roster = await api('supplier/roster', { code });
  const m = (roster.body.staff || []).find(x => x.role === 'manager');
  return (await (await fetch(base + '/api/supplier/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, staffId: m.id, pin: '1234' })
  })).json()).token;
};

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  club = await managerVan('PONTO');
  hotel = await managerVan('HOSHI');
  resto = await managerVan('KIKUNOI');
  assert.ok(club && hotel && resto, 'de bar, het hotel en het restaurant zijn binnen');
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

const CLUB = ['entree', 'garderobe', 'bar', 'vip', 'dj', 'techniek', 'vloer', 'promo', 'security', 'klussen', 'it', 'sales', 'events', 'inkoop', 'kantoor'];

test('elke zaak zijn eigen dorp: de bar ziet de nachtzaak, het restaurant niets', async () => {
  const dorp = (await api('supplier/dorp', {}, club)).body;
  assert.equal(dorp.afdelingen.length, 15, 'het clubdorp: van de deur tot het kantoor');
  const keys = dorp.afdelingen.map(a => a.key);
  for (const k of CLUB) assert.ok(keys.includes(k), 'afdeling ' + k + ' bestaat in de club');
  assert.ok(!keys.includes('frontoffice') && !keys.includes('concierge'), 'hotelafdelingen horen hier niet');
  // en andersom: het hotel kent de deur van de club niet
  assert.equal((await api('supplier/dorp/post', { afdeling: 'entree', tekst: 'x' }, hotel)).status, 400);
  assert.equal((await api('supplier/dorp/post', { afdeling: 'concierge', tekst: 'x' }, club)).status, 400);
  // het restaurant heeft (nog) geen afdelingenbord
  assert.equal((await api('supplier/dorp', {}, resto)).status, 409);
});

test('de ketens van de nachtzaak: deur, garderobe en vip lopen netjes door', async () => {
  // de deur: op de lijst -> aan de deur -> binnen
  const groep = await api('supplier/dorp/post', { afdeling: 'entree', waar: 'Groep Marbella', tekst: 'Zes personen, tafel bij de booth' }, club);
  assert.equal(groep.body.post.status, 'op de lijst');
  assert.equal((await api('supplier/dorp/verder', { id: groep.body.post.id }, club)).body.post.status, 'aan de deur');
  assert.equal((await api('supplier/dorp/verder', { id: groep.body.post.id }, club)).body.post.status, 'binnen');
  // de garderobe: in bewaring -> opgehaald
  const jas = await api('supplier/dorp/post', { afdeling: 'garderobe', waar: '214', tekst: 'Jas en helm' }, club);
  assert.equal(jas.body.post.status, 'in bewaring');
  // vip: aangevraagd -> bevestigd -> zit -> afgerekend
  const tafel = await api('supplier/dorp/post', { afdeling: 'vip', waar: 'Booth 3', tekst: 'Tafel voor acht, magnum om 01:00' }, club);
  assert.equal(tafel.body.post.status, 'aangevraagd');
  assert.equal((await api('supplier/dorp/verder', { id: tafel.body.post.id }, club)).body.post.status, 'bevestigd');
  // afdelingen praten met elkaar: een klacht bij de deur wordt een security-post
  const duw = await api('supplier/dorp/post', { afdeling: 'entree', waar: 'Voorste rij', tekst: 'Opstootje in de rij' }, club);
  const r = await api('supplier/dorp/stuurdoor', { id: duw.body.post.id, naar: 'security' }, club);
  assert.equal(r.body.post.afdeling, 'security');
  assert.deepEqual(r.body.post.via, ['Entree & deur'], 'het spoor reist mee');
});

test('ook in de club: minstens vijf tools per afdeling, met eigen borden en meters', async () => {
  for (const key of CLUB) {
    const r = await api('supplier/dorp/tools', { afdeling: key }, club);
    assert.equal(r.status, 200, key + ' heeft gereedschap');
    assert.ok(r.body.tools.length >= 5, key + ' heeft minstens vijf tools (' + r.body.tools.length + ')');
    const types = r.body.tools.map(w => w.type);
    for (const t of ['cijfers', 'lijst', 'knoppen', 'actie', 'meter']) assert.ok(types.includes(t), key + ' heeft een ' + t + '-widget');
  }
  const widget = async (key, titel) => ((await api('supplier/dorp/tools', { afdeling: key }, club)).body.tools.find(w => w.titel === titel));
  // de deurstaat telt wie er binnen is (de groep uit de vorige test)
  const deur = await widget('entree', 'Deurstaat');
  assert.ok(deur.items.find(i => i.label === 'binnen vanavond').waarde >= 1);
  // de garderobe weet wat er hangt
  const rekken = await widget('garderobe', 'In bewaring (1)');
  assert.ok(rekken.rijen.some(p => /helm/i.test(p.tekst)), 'de jas en de helm hangen er');
  // vip ziet de tafels van vanavond
  assert.ok((await widget('vip', 'Tafels vanavond')).rijen.some(p => /magnum/i.test(p.tekst)));
  // de meters spreken de taal van de afdeling
  assert.equal((await api('supplier/dorp/drukte', { afdeling: 'entree', stand: 'rij tot de hoek' }, club)).status, 200);
  assert.equal((await api('supplier/dorp/drukte', { afdeling: 'bar', stand: 'aanvullen' }, club)).status, 200);
  assert.equal((await api('supplier/dorp/drukte', { afdeling: 'bar', stand: 'druk' }, club)).status, 400, 'de bar meet voorraad, geen drukte');
  assert.equal((await widget('entree', 'Rij aan de deur')).stand.stand, 'rij tot de hoek');
  // de snelknoppen van het vak
  assert.ok((await widget('bar', 'Veelgevraagd')).knoppen.includes('86 doorgeven'));
  assert.ok((await widget('kantoor', 'Veelgevraagd')).knoppen.includes('Kas opmaken'));
});
