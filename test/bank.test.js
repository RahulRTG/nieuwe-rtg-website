/* RTG Bank: de eigen bank op het RTG Pay-grootboek, met de 3-standen knop van de
   boardroom (partner -> hybride -> eigen). Getest: rekeningen met een geldig IBAN,
   storten dat langs de knop clearet (kaart vs eigen emissie), overboeken, de brug
   van/naar de wallet, sparen met rente, en de sluitcontrole die na alles nog klopt.
   Draai los: node --experimental-sqlite --test test/bank.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, lid, office;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-bank-'));

const api = (pad, body, token) => fetch(base + '/api/' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

function ibanGeldig(iban) {
  const her = iban.slice(4) + iban.slice(0, 4);
  const num = her.replace(/[A-Z]/g, ch => ch.charCodeAt(0) - 55);
  let rest = 0; for (const dgt of num) rest = (rest * 10 + Number(dgt)) % 97;
  return rest === 1;
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE: 'KANTOOR-BANK-1' } });
  base = srv.base;
  const l = await (await fetch(base + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tier: 'rtg' }) })).json();
  const ov = await api('bank/overzicht', {}, l.token);
  lid = { token: l.token };
  assert.equal(ov.status, 200, 'het lid ziet zijn (lege) bankoverzicht');
  const o = await (await fetch(base + '/api/office/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: 'KANTOOR-BANK-1' }) })).json();
  office = { token: o.token };
  assert.ok(office.token, 'het kantoor logt in');
});
test.after(() => { stop(srv && srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

test('een rekening openen levert een geldig IBAN; storten clearet in partner-stand via de kaart', async () => {
  const open = await api('bank/rekening/open', { soort: 'betaal', naam: 'Dagelijks' }, lid.token);
  assert.equal(open.status, 200);
  const iban = open.body.rekening.iban;
  assert.ok(/^NL\d{2}RTGB\d{10}$/.test(iban), 'IBAN met RTG-bankcode');
  assert.ok(ibanGeldig(iban), 'IBAN klopt op de mod-97-controle');
  const stort = await api('bank/storten', { iban, centen: 5000, idem: 's1' }, lid.token);
  assert.equal(stort.status, 200);
  assert.equal(stort.body.via, 'kaart', 'in partner-stand loopt storten via de kaart-naad');
  assert.equal(stort.body.saldoCenten, 5000);
  const weer = await api('bank/storten', { iban, centen: 5000, idem: 's1' }, lid.token);
  assert.equal(weer.body.herhaald, true, 'dubbeltik met dezelfde sleutel boekt niet dubbel');
  lid.iban = iban;
});

test('de 3-standen knop: verder draaien mag pas als de bank operationeel is', async () => {
  const eerst = await api('office/bank/draai', {}, office.token);
  assert.equal(eerst.status, 409, 'zonder operationele bank weigert de knop');
  assert.equal((await api('office/bank/operationeel', { aan: true }, office.token)).body.operationeel, true);
  assert.equal((await api('office/bank/draai', {}, office.token)).body.modus, 'hybride');
  assert.equal((await api('office/bank/draai', {}, office.token)).body.modus, 'eigen');
  // in de eigen-stand clearet storten als eigen emissie, niet via de kaart
  const stort = await api('bank/storten', { iban: lid.iban, centen: 10000, idem: 's2' }, lid.token);
  assert.equal(stort.body.via, 'eigen', 'in de eigen-stand emitteert de bank zelf');
  assert.equal(stort.body.saldoCenten, 15000);
  // en weer terug naar partner voor de rest
  assert.equal((await api('office/bank/modus', { modus: 'partner' }, office.token)).body.modus, 'partner');
});

test('sparen met rente: 1,5% per jaar wordt als echte boeking bijgeschreven', async () => {
  const sp = await api('bank/rekening/open', { soort: 'spaar' }, lid.token);
  const spaar = sp.body.rekening.iban;
  await api('bank/storten', { iban: spaar, centen: 100000, idem: 'sp1' }, lid.token);
  const ronde = await api('office/bank/rente', { dagen: 365 }, office.token);
  assert.equal(ronde.status, 200);
  assert.equal(ronde.body.bijgeschrevenCenten, 1500, '1,5% van 1000 euro = 15 euro');
  const na = await api('bank/rekening', { iban: spaar }, lid.token);
  assert.equal(na.body.rekening.saldoCenten, 101500);
});

test('de brug met RTG Pay: van de wallet naar de bank, beide grootboeken blijven sluiten', async () => {
  await api('pay/oplaad', { centen: 3000, idem: 'w1' }, lid.token);
  const brug = await api('bank/van-wallet', { iban: lid.iban, centen: 2000 }, lid.token);
  assert.equal(brug.status, 200, 'de brug boekt van de wallet naar de betaalrekening');
  assert.equal(brug.body.saldoCenten, 17000, 'het bankrekeningsaldo groeit met het overgemaakte bedrag');
  const gezond = await api('office/bank/gezond', {}, office.token);
  assert.equal(gezond.body.sluit.klopt, true, 'de som van alle bank-saldi is nul');
});

test('interne overboeking tussen twee eigen rekeningen', async () => {
  const naar = (await api('bank/rekening/open', { soort: 'zakelijk' }, lid.token)).body.rekening.iban;
  const r = await api('bank/overboek', { vanIban: lid.iban, naarIban: naar, centen: 5000, oms: 'Naar zakelijk' }, lid.token);
  assert.equal(r.status, 200);
  assert.equal((await api('bank/rekening', { iban: naar }, lid.token)).body.rekening.saldoCenten, 5000);
});

test('het kantoor ziet de bank: overzicht met regie, gezondheid en rekeningen', async () => {
  const o = await api('office/bank', {}, office.token);
  assert.equal(o.status, 200);
  assert.equal(o.body.regie.modi.length, 3, 'drie standen op de knop');
  assert.ok(o.body.gezondheid.aantalRekeningen >= 3, 'de geopende rekeningen staan in het bord');
  assert.equal(o.body.gezondheid.sluit.klopt, true);
  // zonder inlog blijft de deur dicht
  const dicht = await fetch(base + '/api/office/bank', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(dicht.status, 401);
});

async function nieuweRekening(soort, centen) {
  const iban = (await api('bank/rekening/open', { soort }, lid.token)).body.rekening.iban;
  if (centen) await api('bank/storten', { iban, centen, idem: 'f' + iban }, lid.token);
  return iban;
}

test('passen: uitgeven, betalen binnen de daglimiet, en bevriezen blokkeert', async () => {
  const iban = await nieuweRekening('betaal', 50000);
  const pas = (await api('bank/pas/uitgeven', { iban, soort: 'debit' }, lid.token)).body.pas;
  assert.ok(/•••• •••• •••• \d{4}/.test(pas.nummer), 'de pas toont alleen gemaskeerd');
  assert.equal((await api('bank/pas/betaal', { id: pas.id, centen: 3000 }, lid.token)).body.saldoCenten, 47000);
  await api('bank/pas/limiet', { id: pas.id, euro: 10 }, lid.token);
  assert.equal((await api('bank/pas/betaal', { id: pas.id, centen: 2000 }, lid.token)).status, 429, 'boven de daglimiet weigert de pas');
  await api('bank/pas/bevries', { id: pas.id, aan: true }, lid.token);
  assert.equal((await api('bank/pas/betaal', { id: pas.id, centen: 100 }, lid.token)).status, 423, 'een bevroren pas betaalt niet');
});

test('krediet: het lid vraagt aan, het kantoor keurt goed en stort, het lid lost af', async () => {
  const iban = await nieuweRekening('betaal', 0);
  const aanvraag = await api('bank/krediet/aanvraag', { iban, euro: 5000, looptijdMnd: 24 }, lid.token);
  assert.equal(aanvraag.body.krediet.status, 'aangevraagd');
  const id = aanvraag.body.krediet.id;
  const open = await api('office/bank/krediet', {}, office.token);
  assert.ok(open.body.aanvragen.some(k => k.id === id), 'de aanvraag staat op het kantoorbord');
  const besluit = await api('office/bank/krediet/besluit', { id, akkoord: true }, office.token);
  assert.equal(besluit.body.krediet.status, 'goedgekeurd');
  assert.equal((await api('bank/rekening', { iban }, lid.token)).body.rekening.saldoCenten, 500000, 'de hoofdsom staat op de rekening');
  const af = await api('bank/krediet/aflossing', { id, centen: 100000 }, lid.token);
  assert.equal(af.body.krediet.restCenten, 400000, 'de aflossing verlaagt het openstaande saldo');
});

test('terugkerende betaling + incassoronde vanuit het kantoor', async () => {
  const van = await nieuweRekening('betaal', 50000);
  const naar = await nieuweRekening('spaar', 0);
  const tk = await api('bank/terugkerend/zet', { vanIban: van, naarIban: naar, centen: 10000, interval: 'maand', oms: 'Sparen' }, lid.token);
  assert.equal(tk.status, 200);
  const ronde = await api('office/bank/incasso', { tot: Date.now() + 35 * 86400000 }, office.token);
  assert.ok(ronde.body.uitgevoerd >= 1, 'de incassoronde voert de vaste betaling uit');
  assert.equal((await api('bank/rekening', { iban: naar }, lid.token)).body.rekening.saldoCenten, 10000);
});

test('zakelijk: een bulkbetaling in één opdracht', async () => {
  const van = await nieuweRekening('zakelijk', 100000);
  const a = await nieuweRekening('betaal', 0);
  const b = await nieuweRekening('betaal', 0);
  const bulk = await api('bank/bulk', { vanIban: van, posten: [{ naarIban: a, centen: 20000, oms: 'A' }, { naarIban: b, centen: 30000, oms: 'B' }] }, lid.token);
  assert.equal(bulk.body.geboekt, 2, 'beide posten geboekt');
  assert.equal(bulk.body.totaalCenten, 50000);
});

test('de AI-bankier geeft advies over de eigen rekeningen (adviseert, beslist niet)', async () => {
  const adv = await api('bank/advies', { vraag: 'Hoe kan ik beter sparen?' }, lid.token);
  assert.equal(adv.status, 200);
  assert.ok(Array.isArray(adv.body.tips) && adv.body.tips.length >= 1, 'er komt minstens één concrete tip');
  assert.ok(typeof adv.body.antwoord === 'string' && adv.body.antwoord.length > 0);
});
