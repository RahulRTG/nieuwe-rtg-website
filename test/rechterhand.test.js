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

test('Rahul adviseert per app in de u-vorm (demo-antwoord zonder sleutel)', async () => {
  const tok = await lidMet('lifestyle');
  await rh('cellier/zet', { naam: 'Barolo', aantal: 3, waarde: 90 }, tok);
  const r = await json(await rh('ai', { app: 'cellier', vraag: 'Welke fles schenk ik vanavond?' }, tok));
  assert.ok(r.ok && r.antwoord && r.antwoord.length > 10);
  assert.match(r.antwoord, /\bu\b|uw/i, 'de sommelier spreekt u aan met u');
  // een onbekende app wordt geweigerd
  assert.equal((await rh('ai', { app: 'onzin', vraag: 'hoi' }, tok)).status, 400);
});

test('Garde-robe: een stuk en een vakman, geteld per categorie', async () => {
  const tok = await lidMet('lifestyle');
  assert.equal((await rh('garderobe/stuk', { naam: 'Smoking', categorie: 'pak', merk: 'op maat', kleur: 'zwart', maat: '50', waar: 'Villa Ibiza' }, tok)).status, 200);
  assert.equal((await rh('garderobe/stuk', { naam: 'Instappers', categorie: 'schoenen' }, tok)).status, 200);
  // een leeg stuk wordt geweigerd
  assert.equal((await rh('garderobe/stuk', { naam: '' }, tok)).status, 400);
  assert.equal((await rh('garderobe/vakman', { naam: 'Atelier X', vak: 'kleermaker', plaats: 'Milaan' }, tok)).status, 200);
  const d = await json(await rh('garderobe', {}, tok));
  assert.equal(d.aantal, 2);
  assert.equal(d.perCategorie.pak, 1);
  assert.equal(d.vaklui.length, 1);
});

test('Mecenaat: giften, betaald vs toegezegd en het deel via de RTFoundation', async () => {
  const tok = await lidMet('lifestyle');
  await rh('mecenaat/gift', { doel: 'Schoolproject', thema: 'onderwijs', bedrag: 50000, betaald: true, foundation: true }, tok);
  const open = await json(await rh('mecenaat/gift', { doel: 'Natuurfonds', thema: 'natuur', bedrag: 20000, betaald: false }, tok));
  assert.ok(open.ok);
  let d = await json(await rh('mecenaat', {}, tok));
  assert.equal(d.betaald, 50000);
  assert.equal(d.toegezegd, 20000);
  assert.equal(d.viaFoundation, 50000);
  // de toezegging alsnog markeren als betaald
  assert.equal((await rh('mecenaat/betaald', { id: open.gift.id, betaald: true }, tok)).status, 200);
  d = await json(await rh('mecenaat', {}, tok));
  assert.equal(d.betaald, 70000);
  assert.equal(d.toegezegd, 0);
});

test('Nalatenschap: documenten/contacten/wensen, ontsleuteld terug en versleuteld op schijf', async () => {
  const tok = await lidMet('lifestyle');
  const marker = 'KLUISPLEK-' + Math.random().toString(36).slice(2);
  assert.equal((await rh('nalatenschap/doc', { titel: 'Testament', soort: 'testament', waar: marker }, tok)).status, 200);
  assert.equal((await rh('nalatenschap/contact', { naam: 'Mr. De Vries', rol: 'notaris', telefoon: '0612345678' }, tok)).status, 200);
  assert.equal((await rh('nalatenschap/wens', { titel: 'Uitvaart', tekst: 'In stilte' }, tok)).status, 200);
  const d = await json(await rh('nalatenschap', {}, tok));
  assert.equal(d.documenten[0].waar, marker, 'de plek komt ontsleuteld terug');
  assert.equal(d.contacten[0].telefoon, '0612345678');
  assert.equal(d.wensen[0].tekst, 'In stilte');
  // de gevoelige plek staat NERGENS als platte tekst op schijf
  let opSchijf = false;
  const scan = dir => { for (const f of fs.readdirSync(dir)) { const p = path.join(dir, f); const st = fs.statSync(p); if (st.isDirectory()) scan(p); else if (fs.readFileSync(p).includes(marker)) opSchijf = true; } };
  scan(TMP);
  assert.equal(opSchijf, false, 'de plek mag niet leesbaar op schijf staan');
});

test('Logboek: object met een regel die verlopen is en opvalt', async () => {
  const tok = await lidMet('lifestyle');
  const o = await json(await rh('logboek/object', { naam: 'Riva', soort: 'jacht', merk: 'Riva', bouwjaar: 2018 }, tok));
  assert.ok(o.ok);
  let d = await json(await rh('logboek', {}, tok));
  const obj = d.objecten.find(x => x.naam === 'Riva');
  // een keuring die alweer had gemoeten -> attentiepunt
  assert.equal((await rh('logboek/regel', { objectId: obj.id, wat: 'Grote keuring', soort: 'keuring', datum: '2025-01-01', volgende: gisteren(), kosten: 4500 }, tok)).status, 200);
  // een regel zonder object wordt geweigerd
  assert.equal((await rh('logboek/regel', { objectId: 'bestaatniet', wat: 'iets' }, tok)).status, 404);
  d = await json(await rh('logboek', {}, tok));
  assert.equal(d.totaalKosten, 4500);
  assert.ok(d.attenties.some(a => a.object === 'Riva' && a.verlopen), 'de verlopen keuring valt op');
});

test('Cercle: clubs geteld per stad en gastpassen opgeteld', async () => {
  const tok = await lidMet('lifestyle');
  await rh('cercle/club', { naam: 'Annabel', stad: 'Londen', lidnummer: 'A-12', sinds: 2015, gastpassen: 4, reciprociteit: 'diverse clubs' }, tok);
  await rh('cercle/club', { naam: 'Le Cercle', stad: 'Parijs', gastpassen: 2 }, tok);
  await rh('cercle/club', { naam: 'The Club', stad: 'Londen', gastpassen: 0 }, tok);
  const d = await json(await rh('cercle', {}, tok));
  assert.equal(d.aantal, 3);
  assert.equal(d.steden, 2);
  assert.equal(d.gastpassen, 6);
});

test('de extra ROS-apps zijn gated op de Lifestyle Pass (RTG niet, Business wel)', async () => {
  const rtg = await lidMet('rtg');
  assert.equal((await rh('reisboek', {}, rtg)).status, 403);
  assert.equal((await rh('cellier', {}, rtg)).status, 403);
  assert.equal((await rh('garderobe', {}, rtg)).status, 403);
  assert.equal((await rh('mecenaat', {}, rtg)).status, 403);
  assert.equal((await rh('nalatenschap', {}, rtg)).status, 403);
  assert.equal((await rh('logboek', {}, rtg)).status, 403);
  assert.equal((await rh('cercle', {}, rtg)).status, 403);
  const biz = await lidMet('business');
  assert.equal((await rh('maison', {}, biz)).status, 200);
  assert.equal((await rh('cercle', {}, biz)).status, 200);
});
