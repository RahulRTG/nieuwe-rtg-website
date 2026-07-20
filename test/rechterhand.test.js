/* Integratietests voor de extra premium ROS-apps van de Lifestyle Pass:
   Reisboek (reisdossier + documenten-attentie), Cellier (wijnkelder + drinkvenster),
   Table (diners: gasten + menu) en Maison (staf + taken). Gated op de Lifestyle Pass.
   Draai los: node --experimental-sqlite --test test/rechterhand.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer } = require('./helper');

let BASE;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-rechterhand-'));
let child;

const raw = (pad, body, token) => fetch(BASE + '/api' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
});
const json = r => r.json();
const rh = (pad, body, token) => raw('/member/rechterhand/' + pad, body, token);

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
const gisteren = () => new Date(Date.now() - 86400000).toISOString().slice(0, 10);

test('Reisboek: een reis met legs, verblijf en een verlopen document dat opvalt', async () => {
  const tok = await lidMet('lifestyle');
  const r = await json(await rh('reis/zet', { naam: 'Ibiza zomer', bestemming: 'Ibiza', van: '2026-08-01', tot: '2026-08-10' }, tok));
  assert.ok(r.ok && r.reis.id);
  const id = r.reis.id;
  assert.equal((await rh('reis/item', { reisId: id, lijst: 'legs', van: 'Rotterdam', naar: 'Ibiza', vervoer: 'privéjet', datum: '2026-08-01' }, tok)).status, 200);
  assert.equal((await rh('reis/item', { reisId: id, lijst: 'verblijven', naam: 'Villa', plaats: 'Ibiza', in: '2026-08-01', uit: '2026-08-10' }, tok)).status, 200);
  // een paspoort dat al verlopen is -> attentiepunt
  assert.equal((await rh('reis/item', { reisId: id, lijst: 'documenten', soort: 'Paspoort', houder: 'De heer', geldigTot: gisteren() }, tok)).status, 200);
  // een leeg onderdeel wordt geweigerd
  assert.equal((await rh('reis/item', { reisId: id, lijst: 'legs', van: '' }, tok)).status, 400);
  const d = await json(await rh('reisboek', {}, tok));
  const reis = d.reizen.find(x => x.id === id);
  assert.equal(reis.legs.length, 1);
  assert.equal(reis.verblijven.length, 1);
  assert.ok(d.attenties.some(a => a.soort === 'Paspoort' && a.verlopen), 'het verlopen paspoort valt op');
});

test('Cellier: flessen met drinkvenster, kelderwaarde en een fles schenken', async () => {
  const tok = await lidMet('lifestyle');
  const j = new Date().getFullYear();
  await rh('cellier/zet', { naam: 'Margaux', domein: 'Ch. Margaux', kleur: 'rood', jaargang: j - 10, aantal: 6, waarde: 800, drinkVan: j - 2, drinkTot: j + 5 }, tok);
  const f2 = await json(await rh('cellier/zet', { naam: 'Champagne', kleur: 'mousserend', aantal: 12, waarde: 120, drinkVan: j + 3, drinkTot: j + 8 }, tok));
  assert.ok(f2.ok);
  const d = await json(await rh('cellier', {}, tok));
  assert.equal(d.totaalFlessen, 18);
  assert.equal(d.kelderwaarde, 6 * 800 + 12 * 120);
  const margaux = d.flessen.find(x => x.naam === 'Margaux');
  assert.equal(margaux.staat, 'op dronk');
  assert.equal(d.flessen.find(x => x.naam === 'Champagne').staat, 'laten liggen');
  assert.ok(d.opDronk >= 1);
  // een fles schenken telt af
  assert.equal((await json(await rh('cellier/schenk', { id: margaux.id }, tok))).aantal, 5);
});

test('Table: een diner met gastenlijst (dieet) en een menu per gang', async () => {
  const tok = await lidMet('lifestyle');
  const e = await json(await rh('table/zet', { naam: 'Verjaardag', datum: '2026-09-20', tijd: '19:30', locatie: 'Thuis' }, tok));
  const id = e.event.id;
  assert.equal((await rh('table/gast', { eventId: id, naam: 'Sanne', dieet: 'geen noten', tafel: '1' }, tok)).status, 200);
  assert.equal((await rh('table/gast', { eventId: id, naam: 'Omar', dieet: 'halal', tafel: '1' }, tok)).status, 200);
  assert.equal((await rh('table/menu', { eventId: id, gang: 'voor', gerecht: 'Oesters', wijn: 'Chablis' }, tok)).status, 200);
  const d = await json(await rh('table', {}, tok));
  const ev = d.events.find(x => x.id === id);
  assert.equal(ev.gastenAantal, 2);
  assert.equal(ev.menu.length, 1);
  assert.ok(ev.gasten.some(g => g.dieet === 'halal'));
});

test('Maison: staf, een taak toewijzen en afvinken, en een logboek', async () => {
  const tok = await lidMet('lifestyle');
  await rh('maison/staf', { naam: 'Maria', rol: 'huishoudster', telefoon: '0612' }, tok);
  let d = await json(await rh('maison', {}, tok));
  const mariaId = d.staf[0].id;
  await rh('maison/taak', { wat: 'Zilver poetsen', voor: mariaId, dag: '2026-08-01' }, tok);
  d = await json(await rh('maison', {}, tok));
  assert.equal(d.openTaken, 1);
  const taak = d.taken[0];
  assert.equal(taak.voorNaam, 'Maria');
  assert.equal((await rh('maison/taak/klaar', { id: taak.id, klaar: true }, tok)).status, 200);
  assert.equal((await json(await rh('maison', {}, tok))).openTaken, 0);
  await rh('maison/log', { tekst: 'Loodgieter komt woensdag' }, tok);
  assert.ok((await json(await rh('maison', {}, tok))).logboek.some(l => /Loodgieter/.test(l.tekst)));
});

test('de extra ROS-apps zijn gated op de Lifestyle Pass (RTG niet, Business wel)', async () => {
  const rtg = await lidMet('rtg');
  assert.equal((await rh('reisboek', {}, rtg)).status, 403);
  assert.equal((await rh('cellier', {}, rtg)).status, 403);
  const biz = await lidMet('business');
  assert.equal((await rh('maison', {}, biz)).status, 200);
});
