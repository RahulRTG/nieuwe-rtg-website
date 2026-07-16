/* Toren 3, RTG Shared Assets: altijd 300 tickets per object, een ticket is
   24 uur per jaar, tien jaar lang. Access loopt af; Asset heeft een aandeel
   in de restwaarde (waarde / 300) en stapt uit via een Tik. Alleen voor
   betalende leden. Draai los:
   node --experimental-sqlite --test test/assets.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base;
let lid, zakelijk, gast;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-assets-'));

const api = (pad, body, t) => fetch(base + '/api/' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
const login = tier => fetch(base + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tier }) }).then(r => r.json()).then(d => d.token);

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  lid = await login('rtg');
  zakelijk = await login('business');
  gast = await login('guest');
  assert.ok(lid && zakelijk && gast);
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

let villa; // het object waarop de keten wordt getest
let accessTicketId; // om te bewijzen dat Access geen restwaarde heeft

test('de pool: drie objecten, altijd 300 tickets, alleen betalende leden kopen', async () => {
  const d = (await api('assets', {}, lid)).body;
  assert.equal(d.assets.length, 3, 'jet, jacht en villa');
  assert.ok(d.assets.every(a => a.totaal === 300 && a.beschikbaar === 300));
  assert.equal(d.regels.urenPerJaar, 24);
  assert.equal(d.regels.jaren, 10);
  villa = d.assets.find(a => a.soort === 'villa');
  assert.equal(villa.ticketWaarde, Math.round(villa.waarde / 300), 'ticketwaarde is waarde gedeeld door 300');
  // de prijzen van de twee smaken zijn een formule op de ticketwaarde
  const rond = n => Math.round(n / 100) * 100;
  for (const a of d.assets) {
    assert.equal(a.prijsAccess, rond(a.ticketWaarde * 0.25), a.naam + ': Access is 25% van de ticketwaarde');
    assert.equal(a.prijsAsset, rond(a.ticketWaarde * 1.15), a.naam + ': Asset is ticketwaarde plus 15% pool-premie');
    assert.ok(a.prijsAccess < a.ticketWaarde && a.ticketWaarde < a.prijsAsset, 'Access < ticketwaarde < Asset');
  }
  // de gratis gebruiker mag kijken maar niet kopen
  assert.equal((await api('asset/koop', { assetId: villa.id, smaak: 'access', aantal: 1 }, gast)).status, 403);
});

test('kopen: Access en Asset, tien jaar geldig, en vol is echt vol (300)', async () => {
  const k1 = await api('asset/koop', { assetId: villa.id, smaak: 'access', aantal: 2 }, lid);
  assert.equal(k1.status, 200);
  assert.equal(k1.body.totaalPrijs, villa.prijsAccess * 2);
  accessTicketId = k1.body.tickets[0].id;
  // de Asset-smaak is een deelneming: zonder uitdrukkelijk akkoord geen koop
  assert.equal((await api('asset/koop', { assetId: villa.id, smaak: 'asset', aantal: 1 }, lid)).status, 400);
  const k2 = await api('asset/koop', { assetId: villa.id, smaak: 'asset', aantal: 1, akkoord: true }, lid);
  assert.equal(k2.body.totaalPrijs, villa.prijsAsset);
  // tien jaar geldig
  const jaarNu = new Date().getFullYear();
  assert.ok(k2.body.tickets[0].vervaltOp.startsWith(String(jaarNu + 10)));
  // een zakelijk lid koopt mee in dezelfde pool
  assert.equal((await api('asset/koop', { assetId: villa.id, smaak: 'access', aantal: 1 }, zakelijk)).status, 200);
  // 296 over; meer dan beschikbaar ketst af, precies de rest mag
  assert.equal((await api('assets', {}, lid)).body.assets.find(a => a.id === villa.id).beschikbaar, 296);
  assert.equal((await api('asset/koop', { assetId: villa.id, smaak: 'access', aantal: 297 }, zakelijk)).status, 409);
  assert.equal((await api('asset/koop', { assetId: villa.id, smaak: 'access', aantal: 296 }, zakelijk)).status, 200);
  assert.equal((await api('assets', {}, lid)).body.assets.find(a => a.id === villa.id).beschikbaar, 0);
  assert.equal((await api('asset/koop', { assetId: villa.id, smaak: 'access', aantal: 1 }, lid)).status, 409, 'vol is vol');
});

test('gebruik: 24 uur per ticket per jaar, dubbel boeken kan niet', async () => {
  // toekomstige dagen buiten juli/augustus (de piekregel heeft een eigen test)
  const rustig = [];
  for (let n = 7; n < 200 && rustig.length < 4; n++) {
    const d = new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
    if (!['07', '08'].includes(d.slice(5, 7))) rustig.push(d);
  }
  const zelfdeJaar = rustig.every(x => x.slice(0, 4) === String(new Date().getFullYear()));
  const b1 = await api('asset/gebruik', { assetId: villa.id, datum: rustig[0] }, lid);
  assert.equal(b1.status, 200);
  assert.equal((await api('asset/gebruik', { assetId: villa.id, datum: rustig[0] }, lid)).status, 409, 'dezelfde dag niet twee keer');
  await api('asset/gebruik', { assetId: villa.id, datum: rustig[1] }, lid);
  const b3 = await api('asset/gebruik', { assetId: villa.id, datum: rustig[2] }, lid);
  // alleen als alle dagen in dit kalenderjaar vielen, is de teller daarna vol
  if (zelfdeJaar) {
    assert.equal(b3.status, 200);
    assert.equal(b3.body.dagenTegoed, 0);
    assert.equal((await api('asset/gebruik', { assetId: villa.id, datum: rustig[3] }, lid)).status, 400, 'de teller is vol tot 1 januari');
  }
  const mijn = (await api('asset/mijn', {}, lid)).body.posities.find(p => p.assetId === villa.id);
  assert.equal(mijn.tickets, 3);
  assert.equal(mijn.access, 2);
  assert.equal(mijn.asset, 1);
});

test('een object, een gezelschap per dag; en de piekregel houdt augustus eerlijk', async () => {
  // de dagclaim is poolbreed: wat een ander lid heeft, is vergeven
  const jaar = new Date().getFullYear() + 1;
  const dagZ = jaar + '-05-10';
  assert.equal((await api('asset/gebruik', { assetId: villa.id, datum: dagZ }, zakelijk)).status, 200);
  const geclaimd = await api('asset/gebruik', { assetId: villa.id, datum: dagZ }, lid);
  assert.equal(geclaimd.status, 409);
  assert.ok(/vergeven/.test(geclaimd.body.error), 'de dag is al van een ander pool-lid');
  // piekseizoen: met 3 tickets hooguit ceil(3/2) = 2 dagen in juli/augustus
  assert.equal((await api('asset/gebruik', { assetId: villa.id, datum: jaar + '-07-14' }, lid)).status, 200);
  assert.equal((await api('asset/gebruik', { assetId: villa.id, datum: jaar + '-08-14' }, lid)).status, 200);
  const piek = await api('asset/gebruik', { assetId: villa.id, datum: jaar + '-08-15' }, lid);
  assert.equal(piek.status, 400);
  assert.ok(/Piekseizoen/.test(piek.body.error), 'de derde piekdag ketst af');
});

test('uitstappen zonder wachtlijst: terugkoop, kantoor betaalt binnen het venster', async () => {
  const mijn = (await api('asset/mijn', {}, lid)).body.posities.find(p => p.assetId === villa.id);
  assert.equal(mijn.uitstapWaarde, mijn.ticketWaarde, 'een Asset-ticket = waarde / 300');
  // trap 2: er staat niemand op de wachtlijst, dus het wordt een terugkoopverzoek
  const uit = await api('asset/uitstap', { ticketId: mijn.assetTicketIds[0] }, lid);
  assert.equal(uit.status, 200);
  assert.equal(uit.body.soort, 'terugkoop-aangevraagd');
  assert.equal(uit.body.waarde, mijn.ticketWaarde);
  assert.ok(uit.body.uiterlijk > new Date().toISOString().slice(0, 10), 'met een harde uiterste betaaldatum');
  // het ticket valt pas terug in de pool na de uitbetaling
  assert.equal((await api('assets', {}, lid)).body.assets.find(a => a.id === villa.id).beschikbaar, 0);
  const tussen = (await api('asset/mijn', {}, lid)).body.posities.find(p => p.assetId === villa.id);
  assert.equal(tussen.terugkoopOnderweg.length, 1);
  // het kantoor betaalt uit: de Tik gaat eruit en de pool krijgt het ticket terug
  const kantoor = (await api('office/login', { code: 'RTG-OFFICE' })).body.token;
  const bord = (await api('office/asset/overzicht', {}, kantoor)).body.objecten.find(o => o.id === villa.id);
  assert.equal(bord.terugkoopOpen.length, 1);
  assert.ok(bord.kas > 0, 'de premies staan in de poolkas');
  assert.ok(bord.restdagen < 365 && bord.restdagen > 300, 'de restdagen zijn zichtbaar om te verhuren');
  const betaald = await api('office/asset/terugkoop', { verzoekId: bord.terugkoopOpen[0].id }, kantoor);
  assert.equal(betaald.status, 200);
  assert.equal(betaald.body.waarde, mijn.ticketWaarde);
  assert.equal((await api('assets', {}, lid)).body.assets.find(a => a.id === villa.id).beschikbaar, 1);
  const na = (await api('asset/mijn', {}, lid)).body.posities.find(p => p.assetId === villa.id);
  assert.equal(na.tickets, 2);
  assert.equal(na.asset, 0);
  // Access heeft geen restwaarde en een vreemd ticket bestaat niet
  assert.equal((await api('asset/uitstap', { ticketId: accessTicketId }, lid)).status, 400);
  assert.equal((await api('asset/uitstap', { ticketId: 'bestaat-niet' }, lid)).status, 404);
});

test('uitstappen met wachtlijst: directe overdracht, koper betaalt de 5% naar de poolkas', async () => {
  // het lid koopt het vrijgevallen ticket weer in (pool weer vol)
  const vers = (await api('assets', {}, lid)).body.assets.find(a => a.id === villa.id);
  const k = await api('asset/koop', { assetId: villa.id, smaak: 'asset', aantal: 1, akkoord: true }, lid);
  assert.equal(k.status, 200);
  // het zakelijke lid meldt zich op de wachtlijst (dubbel melden kan niet)
  assert.equal((await api('asset/wachtlijst', { assetId: villa.id }, zakelijk)).status, 200);
  assert.equal((await api('asset/wachtlijst', { assetId: villa.id }, zakelijk)).status, 409);
  assert.equal((await api('assets', {}, lid)).body.assets.find(a => a.id === villa.id).wachtenden, 1);
  // trap 1: de uitstapper matcht direct met de wachtende koper
  const uit = await api('asset/uitstap', { ticketId: k.body.tickets[0].id }, lid);
  assert.equal(uit.status, 200);
  assert.equal(uit.body.soort, 'overdracht');
  assert.equal(uit.body.waarde, vers.ticketWaarde);
  // het ticket is nu van de koper, de wachtlijst is leeg
  const koperPos = (await api('asset/mijn', {}, zakelijk)).body.posities.find(p => p.assetId === villa.id);
  assert.ok(koperPos && koperPos.asset >= 1, 'de koper heeft het Asset-ticket');
  assert.equal((await api('assets', {}, lid)).body.assets.find(a => a.id === villa.id).wachtenden, 0);
});

test('bedenktijd: binnen veertien dagen herroepen is volledige terugbetaling', async () => {
  // het zakelijke lid herroept een van zijn verse tickets (het overgenomen Asset-ticket telt ook)
  const pos = (await api('asset/mijn', {}, zakelijk)).body.posities.find(p => p.assetId === villa.id);
  assert.ok(pos.herroepbaar.length >= 1, 'verse tickets zitten in de bedenktijd');
  const h = pos.herroepbaar[0];
  const r = await api('asset/herroep', { ticketId: h.id }, zakelijk);
  assert.equal(r.status, 200);
  assert.equal(r.body.terug, h.prijs, 'de volledige koopsom komt terug');
  assert.equal(r.body.ticket.status, 'herroepen');
  // twee keer herroepen kan niet
  assert.equal((await api('asset/herroep', { ticketId: h.id }, zakelijk)).status, 404);
});

test('het informatiedocument: eigen entiteit, kosten, risico en de uitstaptrap', async () => {
  const d = (await api('asset/document', { assetId: villa.id }, lid)).body.document;
  assert.ok(/RTG Asset Pool/.test(d.entiteit), 'elk object zit in een eigen entiteit');
  assert.ok(/bedenktijd/i.test(d.bedenktijd) && /14/.test(d.bedenktijd));
  assert.ok(/wachtlijst/i.test(d.uitstappen) && /30/.test(d.uitstappen));
  assert.ok(/dalen/i.test(d.risico), 'het risico staat er eerlijk in');
  assert.ok(/2%/.test(d.kosten.serviceFee));
  // de servicefee-inning: het eerste jaar zit in de koopsom, dus nu valt er niets te innen
  const kantoor = (await api('office/login', { code: 'RTG-OFFICE' })).body.token;
  const fees = await api('office/asset/fees', {}, kantoor);
  assert.equal(fees.status, 200);
  assert.equal(fees.body.geind, 0, 'alle tickets zijn dit jaar gekocht; de fee loopt vanaf volgend jaar');
});

test('hertaxatie: de waarde beweegt, en beide prijzen en de uitstapwaarde schuiven mee', async () => {
  const kantoor = (await api('office/login', { code: 'RTG-OFFICE' })).body.token;
  assert.ok(kantoor, 'het kantoor is binnen');
  const rond = n => Math.round(n / 100) * 100;
  // de villa wordt hoger getaxeerd: waarde keer anderhalf
  const nieuw = Math.round(villa.waarde * 1.5);
  const r = await api('office/asset/waarde', { assetId: villa.id, waarde: nieuw }, kantoor);
  assert.equal(r.status, 200);
  assert.equal(r.body.asset.ticketWaarde, Math.round(nieuw / 300));
  assert.equal(r.body.asset.prijsAccess, rond(r.body.asset.ticketWaarde * 0.25), 'Access schuift mee');
  assert.equal(r.body.asset.prijsAsset, rond(r.body.asset.ticketWaarde * 1.15), 'Asset schuift mee');
  // het lid ziet de nieuwe ticketwaarde meteen in het overzicht en de positie
  const na = (await api('assets', {}, lid)).body.assets.find(a => a.id === villa.id);
  assert.equal(na.ticketWaarde, Math.round(nieuw / 300));
  assert.equal(na.prijsAccess, r.body.asset.prijsAccess);
  const pos = (await api('asset/mijn', {}, lid)).body.posities.find(p => p.assetId === villa.id);
  assert.equal(pos.ticketWaarde, Math.round(nieuw / 300), 'de uitstapwaarde beweegt automatisch mee');
  // grenzen: een rare taxatie ketst af, en alleen het kantoor mag taxeren
  assert.equal((await api('office/asset/waarde', { assetId: villa.id, waarde: 5 }, kantoor)).status, 400);
  assert.equal((await api('office/asset/waarde', { assetId: villa.id, waarde: nieuw }, lid)).status, 401);
});
