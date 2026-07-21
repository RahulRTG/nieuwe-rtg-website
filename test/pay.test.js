/* RTG Pay: de interne betaallaag. Een wallet per lid op een dubbel grootboek,
   alles EEN knop: opladen via de betaal-naad, Klompjes (de RTG-eigen betaalverzoeken, ook gesplitst) die je
   met een tik betaalt waarbij de wallet zelf bijlaadt, de kassacode bij de
   partner, en uitbetalen. De sluitcontrole bewaakt dat de som van alle saldi
   altijd exact nul is. Draai los:
   node --experimental-sqlite --test test/pay.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base;
let lidA, lidB;       // { token, codenaam }
let supToken, supCode; // de partner voor de kassa
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-pay-'));

const api = (pad, body, token) => fetch(base + '/api/' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

async function lid(tier) {
  const r = await fetch(base + '/api/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tier })
  });
  const d = await r.json();
  const o = await api('pay/overzicht', {}, d.token);
  return { token: d.token, codenaam: o.body.codenaam };
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  lidA = await lid('rtg');
  lidB = await lid('lifestyle');
  assert.ok(lidA.codenaam && lidB.codenaam && lidA.codenaam !== lidB.codenaam, 'twee leden met eigen codenaam');
  const login = await fetch(base + '/api/supplier/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'rahul', password: 'Imran' })
  });
  const d = await login.json();
  supToken = d.token;
  supCode = d.state.supplier.code;
  assert.ok(supToken && supCode, 'de partner logt in voor de kassa');
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('opladen: een tik en het staat op de wallet; dubbel tikken laadt nooit dubbel', async () => {
  const sleutel = 'oplaad-eenmalig-1';
  const r1 = await api('pay/oplaad', { centen: 5000, idem: sleutel }, lidA.token);
  assert.equal(r1.status, 200);
  assert.equal(r1.body.saldo, 5000, 'vijftig euro geladen');
  const r2 = await api('pay/oplaad', { centen: 5000, idem: sleutel }, lidA.token);
  assert.equal(r2.body.herhaald, true, 'de dubbeltik is hetzelfde antwoord');
  assert.equal((await api('pay/overzicht', {}, lidA.token)).body.saldo, 5000, 'en boekt niet dubbel');
});

test('het Klompje: gesplitst uitsturen, en de ander betaalt met EEN knop (autolaad doet de rest)', async () => {
  // A schoot 30 euro voor en splitst met zichzelf mee: B moet 15 euro
  const t = await api('pay/verzoek', { aan: [lidB.codenaam], totaalCenten: 3000, oms: 'Strandbedjes', splitsMetMij: true }, lidA.token);
  assert.equal(t.status, 200);
  assert.equal(t.body.perPersoon, 1500, 'het totaal is eerlijk gesplitst');
  // B ziet hem staan en betaalt met een knop, ZONDER saldo: de wallet laadt zelf bij
  const zicht = await api('pay/overzicht', {}, lidB.token);
  const v = zicht.body.aanMij.find(x => x.van === lidA.codenaam);
  assert.ok(v, 'B ziet het verzoek van A');
  const betaal = await api('pay/verzoek/betaal', { id: v.id, idem: 'tikkie-1' }, lidB.token);
  assert.equal(betaal.status, 200);
  assert.equal(betaal.body.bijgeladen, 2000, 'de wallet laadde zelf 20 euro bij (tientjes)');
  assert.equal(betaal.body.saldo, 500, 'en er blijft 5 euro saldo over');
  assert.equal((await api('pay/overzicht', {}, lidA.token)).body.saldo, 6500, 'A heeft de 15 euro binnen');
  // nog een keer dezelfde knop: geen dubbele boeking, verzoek is dicht
  assert.equal((await api('pay/verzoek/betaal', { id: v.id, idem: 'tikkie-2' }, lidB.token)).status, 409);
});

test('geld sturen op codenaam werkt met een knop; onbekende namen ketsen af', async () => {
  const r = await api('pay/stuur', { aan: lidB.codenaam, centen: 500, oms: 'Terug voor de taxi', idem: 'stuur-1' }, lidA.token);
  assert.equal(r.status, 200);
  assert.equal(r.body.saldo, 6000);
  assert.equal((await api('pay/overzicht', {}, lidB.token)).body.saldo, 1000, 'B ving de 5 euro');
  assert.equal((await api('pay/stuur', { aan: 'BestaatNiet999', centen: 100 }, lidA.token)).status, 404);
});

test('de kassacode: het lid toont een code, de zaak int, en uitbetalen leegt de partnerpot', async () => {
  const k = await api('pay/kascode', { maxCenten: 5000 }, lidA.token);
  assert.equal(k.status, 200);
  assert.match(k.body.code, /^[0-9A-F]{6}$/);
  // boven het maximum weigert de kassa
  assert.equal((await api('supplier/pay/in', { code: k.body.code, centen: 9000 }, supToken)).status, 402);
  const inn = await api('supplier/pay/in', { code: k.body.code, centen: 2500, oms: 'Lunch aan zee', idem: 'kas-1' }, supToken);
  assert.equal(inn.status, 200);
  assert.equal(inn.body.centen, 2500);
  // de kosten van de betaaldienst gaan DIRECT naar de ondernemer: 10 centen
  // vaste voet + 1% van 2500 = 35 centen, per transactie meteen verrekend
  assert.equal(inn.body.kosten, 35, 'de kosten staan meteen op de transactie');
  // de code is eenmalig
  assert.equal((await api('supplier/pay/in', { code: k.body.code, centen: 100 }, supToken)).status, 404);
  const pot = await api('supplier/pay/overzicht', {}, supToken);
  assert.equal(pot.body.saldo, 2465, 'de partnerpot telt de kassabetaling netto (kosten direct verrekend)');
  assert.equal(pot.body.kostenVandaag, 35, 'en toont de betaaldienstkosten van vandaag transparant');
  const uit = await api('supplier/pay/uitbetaal', { idem: 'uit-1' }, supToken);
  assert.equal(uit.body.uitbetaald, 2465);
  assert.equal((await api('supplier/pay/overzicht', {}, supToken)).body.saldo, 0, 'uitbetaald naar de bank');
});

test('de kassabon op RTG Pay: code tonen, afrekenen, en de betaler staat op de bon', async () => {
  // het lid maakt een verse betaalcode; de kassa rekent de bon ermee af
  const k = await api('pay/kascode', { maxCenten: 5000 }, lidA.token);
  assert.equal(k.status, 200);
  const bon = await api('supplier/pos/sale', {
    total: 21, method: 'rtgpay', payCode: k.body.code, idem: 'bon-rtgpay-1',
    items: [{ name: 'Gazpacho de sandia', qty: 1, price: 21 }]
  }, supToken);
  assert.equal(bon.status, 200);
  assert.equal(bon.body.sale.method, 'rtgpay');
  assert.equal(bon.body.betaler, lidA.codenaam, 'de bon weet wie er betaalde');
  assert.equal(bon.body.sale.betaaldienstKosten, 31, 'de bon draagt de direct verrekende betaaldienstkosten (10 + 1% van 2100)');
  assert.equal((await api('supplier/pay/overzicht', {}, supToken)).body.saldo, 2069, 'de partnerpot ving 21 euro netto');
  // een verkeerde of verlopen code betekent: geen betaling en geen bon
  const mis = await api('supplier/pos/sale', { total: 10, method: 'rtgpay', payCode: 'FFFFFF', idem: 'bon-rtgpay-2' }, supToken);
  assert.equal(mis.status, 404);
  assert.ok(mis.body.error, 'de kassa legt uit waarom het niet lukte');
});

test('de tik: ontvangen met een aanraking, betalen met een knop', async () => {
  // B zet zijn toestel op ontvangen; A tikt en betaalt
  const t = await api('pay/tikcode', {}, lidB.token);
  assert.equal(t.status, 200);
  assert.match(t.body.code, /^[0-9A-F]{6}$/);
  const voorB = (await api('pay/overzicht', {}, lidB.token)).body.saldo;
  const r = await api('pay/tik', { code: t.body.code, centen: 750, oms: 'Koffie terug', idem: 'tik-1' }, lidA.token);
  assert.equal(r.status, 200);
  assert.equal(r.body.aan, lidB.codenaam, 'de betaler ziet naar wie het ging');
  assert.equal((await api('pay/overzicht', {}, lidB.token)).body.saldo, voorB + 750);
  // dezelfde tik mag binnen zijn vijf minuten door een hele tafel gebruikt worden
  assert.equal((await api('pay/tik', { code: t.body.code, centen: 250, idem: 'tik-2' }, lidA.token)).status, 200);
  // naar jezelf tikken kan niet, en een onzincode ketst af
  assert.equal((await api('pay/tik', { code: t.body.code, centen: 100, idem: 'tik-3' }, lidB.token)).status, 400);
  assert.equal((await api('pay/tik', { code: '000000', centen: 100, idem: 'tik-4' }, lidA.token)).status, 404);
});

test('de tikgeschiedenis leest als een sociaal logboek: wie tikte wie', async () => {
  const vanA = await api('pay/tiks', {}, lidA.token);
  assert.equal(vanA.status, 200);
  const uit = vanA.body.tiks.find(x => x.richting === 'uit' && x.met === lidB.codenaam && x.centen === 750);
  assert.ok(uit, 'A ziet: jij tikte B');
  assert.equal(uit.oms, 'Koffie terug', 'met het verhaaltje erbij');
  const vanB = await api('pay/tiks', {}, lidB.token);
  assert.ok(vanB.body.tiks.some(x => x.richting === 'in' && x.met === lidA.codenaam), 'B ziet: A tikte jou');
  // gewone stortingen en kassabetalingen horen er niet in: alleen tikken
  assert.ok(vanA.body.tiks.every(x => x.met !== 'opgeladen'), 'opladen staat niet in de tikgeschiedenis');
});

test('het grootboek sluit op de cent en gasten komen er niet in', async () => {
  const g = await fetch(base + '/api/pay/gezond');
  assert.equal(g.status, 200);
  assert.equal((await g.json()).klopt, true, 'som van alle saldi is nul, niemand staat rood');
  // een gast heeft geen wallet
  const gast = await fetch(base + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tier: 'guest' }) });
  const gastToken = (await gast.json()).token;
  assert.equal((await api('pay/overzicht', {}, gastToken)).status, 403);
  // en de geschiedenis leest als een bankafschrift
  const o = await api('pay/overzicht', {}, lidA.token);
  assert.ok(o.body.geschiedenis.some(h => h.centen === -2500 && /zaak /.test(h.tegen)), 'de kassabetaling staat erin');
  assert.ok(o.body.geschiedenis.some(h => h.centen === 5000 && h.tegen === 'opgeladen'), 'het opladen staat erin');
});
