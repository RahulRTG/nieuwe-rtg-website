/* Integratietests voor De Rechterhand: de premium Lifestyle Pass-suite. Het
   Concierge-bureau (verzoeken + voorkeuren), het Bezittingenregister met
   attentiepunten, en Gezondheid & welzijn (afspraken + prive-dossier). Gated op
   de Lifestyle Pass; een gewoon RTG-lid komt er niet in.
   Draai los: node --experimental-sqlite --test test/lifestyle.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer } = require('./helper');

let BASE;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-lifestyle-'));
let child;

const raw = (pad, body, token) => fetch(BASE + '/api' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
});
const json = r => r.json();
const ls = (pad, body, token) => raw('/member/lifestyle/' + pad, body, token);
const oc = (pad, body, token) => raw('/office/' + pad, body, token);
const officeTok = async () => (await json(await raw('/office/login', { code: 'RTG-OFFICE' }))).token;

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } }));
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

let teller = 0;
async function lidMet(tier) {
  const t = Date.now() + '' + (teller++);
  const r = await json(await raw('/auth/register', { name: 'Lid ' + t, email: 'l' + t + '@v.test', phone: '06' + String(t).slice(-8), password: 'geheim123', geboortedatum: '1980-05-05', tier }));
  return r.token;
}
const morgen = () => new Date(Date.now() + 86400000).toISOString().slice(0, 10);
const gisteren = () => new Date(Date.now() - 86400000).toISOString().slice(0, 10);

test('concierge-bureau: verzoek indienen met statusketen, intrekken, en vaste voorkeuren', async () => {
  const tok = await lidMet('lifestyle');
  // een verzoek zonder titel kan niet
  assert.equal((await ls('concierge/vraag', { titel: '' }, tok)).status, 400);
  const v = await json(await ls('concierge/vraag', { titel: 'Tafel voor vier, vrijdag', categorie: 'restaurant', details: 'Bij het raam graag' }, tok));
  assert.ok(v.ok && v.verzoek.id);
  assert.equal(v.verzoek.status, 'aangevraagd');
  assert.ok(v.verzoek.updates.length >= 1, 'de statusketen begint bij aangevraagd');
  // het verzoek staat in het overzicht
  const lijst = await json(await ls('concierge', {}, tok));
  assert.ok(lijst.verzoeken.some(x => x.id === v.verzoek.id));
  assert.ok(lijst.categorieen.includes('restaurant'));
  // intrekken
  assert.equal((await ls('concierge/intrek', { id: v.verzoek.id }, tok)).status, 200);
  const na = await json(await ls('concierge', {}, tok));
  assert.equal(na.verzoeken.find(x => x.id === v.verzoek.id).status, 'ingetrokken');
  // vaste voorkeuren bewaren en teruglezen
  await ls('voorkeuren/zet', { dieet: 'pescotarisch', stoel: 'raam, voorin' }, tok);
  const vk = await json(await ls('voorkeuren', {}, tok));
  assert.equal(vk.voorkeuren.dieet, 'pescotarisch');
  assert.equal(vk.voorkeuren.stoel, 'raam, voorin');
});

test('bezittingenregister: objecten, totaalwaarde en attentiepunten (verlopen verzekering)', async () => {
  const tok = await lidMet('lifestyle');
  await ls('bezit/zet', { soort: 'vastgoed', naam: 'Villa Ibiza', waarde: 4200000, verzekeraar: 'Lloyd', verzekerdTot: gisteren() }, tok);
  const auto = await json(await ls('bezit/zet', { soort: 'voertuig', naam: 'Aston', waarde: 250000, onderhoudOp: morgen() }, tok));
  assert.ok(auto.ok);
  // een object zonder naam kan niet
  assert.equal((await ls('bezit/zet', { soort: 'kunst', naam: '' }, tok)).status, 400);
  const d = await json(await ls('bezit', {}, tok));
  assert.equal(d.bezittingen.length, 2);
  assert.equal(d.bezittingen[0].naam, 'Villa Ibiza', 'op waarde gesorteerd');
  assert.equal(d.totaalWaarde, 4200000 + 250000);
  // attenties: de verlopen verzekering en het naderende onderhoud
  assert.ok(d.attenties.some(a => a.soort === 'verzekering' && a.verlopen), 'verlopen verzekering is een attentiepunt');
  assert.ok(d.attenties.some(a => a.soort === 'onderhoud'), 'naderend onderhoud staat erbij');
  // verwijderen
  assert.equal((await ls('bezit/weg', { id: auto.bezit.id }, tok)).status, 200);
  assert.equal((await json(await ls('bezit', {}, tok))).bezittingen.length, 1);
});

test('gezondheid & welzijn: afspraken (aankomend) en het prive-dossier', async () => {
  const tok = await lidMet('lifestyle');
  await ls('gezondheid/afspraak', { wat: 'Controle cardioloog', datum: morgen(), tijd: '09:30', specialist: 'dr. Vermeer', waar: 'Kliniek' }, tok);
  assert.equal((await ls('gezondheid/afspraak', { wat: 'Fout', datum: 'nope' }, tok)).status, 400);
  const d = await json(await ls('gezondheid', {}, tok));
  assert.equal(d.volgende.wat, 'Controle cardioloog');
  assert.equal(d.volgende.dagenTot, 1);
  // prive-dossier
  const n = await json(await ls('gezondheid/dossier', { titel: 'Bloeddruk', tekst: 'Streefwaarde afgesproken' }, tok));
  assert.ok(n.ok);
  assert.ok((await json(await ls('gezondheid', {}, tok))).dossier.some(x => x.titel === 'Bloeddruk'));
});

test('het overzicht en Rahul spreken u aan (u-vorm), zonder een boeking te beloven', async () => {
  const tok = await lidMet('lifestyle');
  await ls('concierge/vraag', { titel: 'Privéjet naar Nice' }, tok);
  const o = await json(await ls('overzicht', {}, tok));
  assert.equal(o.verzoekenOpen, 1);
  const r = await json(await ls('ai', { vraag: 'Kunt u een tafel bij een restaurant regelen?' }, tok));
  assert.ok(r.antwoord && r.antwoord.length > 10);
  assert.match(r.antwoord, /\bu\b|uw/i, 'Rahul spreekt het lid aan met u');
});

test('de concierge-kant: het kantoor ziet open verzoeken en loopt de statusketen door', async () => {
  const tok = await lidMet('lifestyle');
  const v = await json(await ls('concierge/vraag', { titel: 'Tafel bij een sterrenzaak', categorie: 'restaurant' }, tok));
  const otok = await officeTok();
  let desk = await json(await oc('concierge', {}, otok));
  const item = desk.verzoeken.find(x => x.id === v.verzoek.id);
  assert.ok(item && item.key, 'het verzoek staat met ledensleutel op het concierge-bureau');
  // in behandeling nemen, dan bevestigen (een MENS bevestigt de boeking)
  assert.equal((await oc('concierge/voortgang', { key: item.key, id: v.verzoek.id, status: 'in behandeling' }, otok)).status, 200);
  assert.equal((await oc('concierge/voortgang', { key: item.key, id: v.verzoek.id, status: 'bevestigd', notitie: 'Tafel om 20:00 op uw naam.' }, otok)).status, 200);
  // het lid ziet de nieuwe status en de notitie in zijn verzoek
  const mijn = (await json(await ls('concierge', {}, tok))).verzoeken.find(x => x.id === v.verzoek.id);
  assert.equal(mijn.status, 'bevestigd');
  assert.ok(mijn.updates.some(u => /20:00/.test(u.notitie)));
  // afronden haalt het verzoek van het bureau af
  await oc('concierge/voortgang', { key: item.key, id: v.verzoek.id, status: 'afgerond' }, otok);
  desk = await json(await oc('concierge', {}, otok));
  assert.ok(!desk.verzoeken.some(x => x.id === v.verzoek.id), 'afgerond verzoek is van het bureau af');
  // een onbekende status wordt geweigerd
  assert.equal((await oc('concierge/voortgang', { key: item.key, id: v.verzoek.id, status: 'onzin' }, otok)).status, 400);
});

test('de concierge-kant is dicht zonder office-sessie', async () => {
  assert.equal((await raw('/office/concierge', {})).status, 401);
});

test('De Rechterhand is gated: een gewoon RTG-lid komt er niet in, Business wel', async () => {
  const rtg = await lidMet('rtg');
  assert.equal((await ls('overzicht', {}, rtg)).status, 403);
  assert.equal((await ls('concierge/vraag', { titel: 'x' }, rtg)).status, 403);
  const biz = await lidMet('business');
  assert.equal((await ls('overzicht', {}, biz)).status, 200, 'de Business Pass erft de suite mee');
});
