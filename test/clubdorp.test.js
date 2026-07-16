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

test('elke zaak zijn eigen dorp: club, restaurant en beachclub zien elk het hunne', async () => {
  const dorp = (await api('supplier/dorp', {}, club)).body;
  assert.equal(dorp.afdelingen.length, 15, 'het clubdorp: van de deur tot het kantoor');
  const keys = dorp.afdelingen.map(a => a.key);
  for (const k of CLUB) assert.ok(keys.includes(k), 'afdeling ' + k + ' bestaat in de club');
  assert.ok(!keys.includes('frontoffice') && !keys.includes('concierge'), 'hotelafdelingen horen hier niet');
  // en andersom: het hotel kent de deur van de club niet
  assert.equal((await api('supplier/dorp/post', { afdeling: 'entree', tekst: 'x' }, hotel)).status, 400);
  assert.equal((await api('supplier/dorp/post', { afdeling: 'concierge', tekst: 'x' }, club)).status, 400);
  // het restaurantdorp: van het boek tot de pas, zonder deur of dj
  const rd = (await api('supplier/dorp', {}, resto)).body;
  const rk = rd.afdelingen.map(a => a.key);
  for (const k of ['host', 'bediening', 'keuken', 'bar', 'vloer', 'inkoop', 'kantoor', 'security']) assert.ok(rk.includes(k), 'restaurant heeft ' + k);
  assert.ok(!rk.includes('entree') && !rk.includes('dj') && !rk.includes('garderobe'), 'de deur en de dj horen bij de club');
  // de beachclub: hetzelfde als het restaurant, plus het strand
  const beach = await managerVan('VORA');
  const bd = (await api('supplier/dorp', {}, beach)).body;
  const bk = bd.afdelingen.map(a => a.key);
  for (const k of ['host', 'bediening', 'keuken', 'ligbedden', 'watersport']) assert.ok(bk.includes(k), 'beachclub heeft ' + k);
  assert.equal(bd.afdelingen.length, rd.afdelingen.length + 2, 'restaurant plus ligbedden en watersport');
  // het strand: gereserveerd -> bezet -> vrijgegeven, met de strandstaat
  const bed = await api('supplier/dorp/post', { afdeling: 'ligbedden', waar: 'Eerste rij 4', tekst: 'Twee bedden, champagne-emmer om 15:00' }, beach);
  assert.equal(bed.body.post.status, 'gereserveerd');
  await api('supplier/dorp/verder', { id: bed.body.post.id }, beach);
  const strand = (await api('supplier/dorp/tools', { afdeling: 'ligbedden' }, beach)).body.tools;
  assert.equal(strand.find(w => w.titel === 'Strandstaat').items.find(i => i.label === 'bezet').waarde, 1);
  assert.ok(strand.find(w => w.titel === 'Nu op het strand').rijen.some(r => /champagne/i.test(r.tekst)));
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
  // de runners zien wat de bar open heeft staan als bijvullijst
  const barVraag = await api('supplier/dorp/post', { afdeling: 'bar', waar: 'Bar links', tekst: 'IJs en limoenen aanvullen' }, club);
  assert.equal(barVraag.status, 200);
  assert.ok((await widget('vloer', 'Bijvullen voor de bar')).rijen.some(r => /limoenen/i.test(r.tekst)), 'de bar-vraag staat op de bijvullijst van de runners');
  // security en de deur checken leeftijden: ja/nee op codenaam, nooit gegevens
  const sec = (await api('supplier/dorp/tools', { afdeling: 'security' }, club)).body.tools;
  assert.ok(sec.some(w => w.type === 'leeftijd'), 'de leeftijdscheck staat bij security');
  assert.ok(((await api('supplier/dorp/tools', { afdeling: 'entree' }, club)).body.tools).some(w => w.type === 'leeftijd'), 'en aan de deur');
  assert.equal((await api('supplier/paspoort/vraag', { codenaam: 'bestaatniet-xyz', niveau: 'bevestiging', minLeeftijd: 18 }, club)).status, 404);
});

test('deurverkoop en VIP-entree: de kassa aan de deur, de code kan meteen naar binnen', async () => {
  // de manager zet de avond op de kaart (drie plekken, 23:00)
  const avond = await api('supplier/activiteit', { name: 'Vrijdagnacht', prijs: 25, capaciteit: 3, tijden: '23:00' }, club);
  assert.equal(avond.status, 200);
  const actId = avond.body.activiteiten.find(a => a.name === 'Vrijdagnacht').id;
  // deurverkoop: twee VIP-kaartjes, contant
  const vk = await api('supplier/ticket/deurverkoop', { activiteitId: actId, tijd: '23:00', personen: 2, vip: true, method: 'contant' }, club);
  assert.equal(vk.status, 200);
  assert.equal(vk.body.ticket.total, 50, 'twee keer 25');
  assert.ok(vk.body.ticket.vip);
  // het programma telt mee en zet de VIP bovenaan de deurlijst
  const slot = (await api('supplier/programma', {}, club)).body.slots.find(x => x.activiteitId === actId);
  assert.equal(slot.verkocht, 2);
  assert.ok(slot.gasten[0].vip, 'VIP staat bovenaan');
  // de omzet staat gewoon op de kassa van de zaak
  // en de code kan meteen naar binnen, maar maar een keer
  const inche = await api('supplier/ticket/checkin', { code: vk.body.ticket.code }, club);
  assert.equal(inche.status, 200);
  assert.ok(inche.body.ticket.vip, 'de deur ziet dat het VIP is');
  assert.equal((await api('supplier/ticket/checkin', { code: vk.body.ticket.code }, club)).status, 409, 'niet twee keer naar binnen');
  // vol is vol: er zijn nog maar 1 van de 3 plekken over
  assert.equal((await api('supplier/ticket/deurverkoop', { activiteitId: actId, tijd: '23:00', personen: 2, method: 'contant' }, club)).status, 409);
  assert.equal((await api('supplier/ticket/deurverkoop', { activiteitId: actId, tijd: '23:00', personen: 1, method: 'contant' }, club)).status, 200);
  // grenzen: onbekende avond of raar tijdslot ketsen af
  assert.equal((await api('supplier/ticket/deurverkoop', { activiteitId: 'nee', tijd: '23:00', personen: 1, method: 'contant' }, club)).status, 404);
  assert.equal((await api('supplier/ticket/deurverkoop', { activiteitId: actId, tijd: '02:00', personen: 1, method: 'contant' }, club)).status, 400);
});
