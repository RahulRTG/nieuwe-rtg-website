/* De zorgpas en de RTG Wallet: Segur (de verzekeraar) schrijft een lid
   in op codenaam en de zorgpas ligt direct in de wallet van het lid;
   de declaratieketen (een mens beslist, afwijzen alleen met reden);
   de pas-controle die niet meer teruggeeft dan actief/pakket/codenaam;
   en de wallet zelf: klantenkaarten, tickets, sleutels en feestmunten
   met een saldo dat nooit onder nul komt. Plus de poorten: gasten en
   anoniemen niet, en zonder polis-cap geen zorgtak.
   Draai los: node --experimental-sqlite --test test/zorgwallet.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, lidTok, lidCode, segur, kikunoi;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-zw-'));

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
let seq = 0;
async function lid() {
  const u = (Date.now() + (++seq)).toString().slice(-8);
  const reg = await api('/api/auth/register', { name: 'Lid ' + seq, email: 'zw' + u + '@x.nl', phone: '06' + u,
    password: 'geheim123', geboortedatum: '1990-05-05', geslacht: 'v', tier: 'rtg', pasApp: 'rtg' });
  const st = await api('/api/state', {}, reg.body.token);
  return { token: reg.body.token, codenaam: st.body.state.user.codename };
}
async function zaak(code) {
  const roster = await api('/api/supplier/roster', { code });
  const wie = roster.body.staff.find(x => x.role === 'manager');
  return (await api('/api/supplier/login', { code, staffId: wie.id, pin: '1234' })).body.token;
}
const zp = (pad, body, tok) => api('/api/supplier/zorgpolis' + pad, body, tok);
const wallet = (pad, body, tok) => api('/api/wallet' + pad, body, tok);

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  const a = await lid();
  lidTok = a.token; lidCode = a.codenaam;
  segur = await zaak('SEGUR');
  kikunoi = await zaak('KIKUNOI');
  assert.ok(lidTok && lidCode && segur && kikunoi, 'alle rollen zijn binnen');
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. inschrijven op codenaam: de zorgpas ligt direct in de wallet van het lid', async () => {
  const inschrijf = await zp('/inschrijf', { codenaam: lidCode, pakket: 'plus', door: 'Ines Vos' }, segur);
  assert.equal(inschrijf.status, 200);
  assert.equal(inschrijf.body.maandpremie, 159);
  const pas = inschrijf.body.verzekerde.pas;
  assert.match(pas, /^ZP-[0-9A-F]{4}$/, 'het pasnummer heeft de vaste vorm');
  // het lid opent de wallet en ziet de pas onder Passen, met een geldigheid
  const w = await wallet('', {}, lidTok);
  assert.equal(w.status, 200);
  const item = w.body.perSoort.pas.find(x => x.code === pas);
  assert.ok(item, 'de zorgpas staat in de wallet');
  assert.equal(item.bron, 'zorgpolis');
  assert.match(item.geldigTot, /-12-31$/, 'geldig tot het einde van het jaar');
  assert.ok(item.titel.includes('plus'), 'de titel noemt het pakket');
  // dubbel inschrijven kan niet, en een onbekende codenaam ook niet
  assert.equal((await zp('/inschrijf', { codenaam: lidCode, pakket: 'basis' }, segur)).status, 409, 'al actief verzekerd');
  assert.equal((await zp('/inschrijf', { codenaam: 'ZILVEREN EENHOORN 999', pakket: 'basis' }, segur)).status, 404);
  assert.equal((await zp('/inschrijf', { codenaam: lidCode, pakket: 'goud' }, segur)).status, 400, 'alleen basis/plus/top');
});

test('2. het overzicht van de werkplek: kpi\'s en nooit de memberKey naar de client', async () => {
  const o = await zp('', {}, segur);
  assert.equal(o.status, 200);
  assert.ok(o.body.kpi.actief >= 1);
  assert.equal(o.body.pakketten.basis, 129);
  const v = o.body.verzekerden.find(x => x.codenaam === lidCode);
  assert.ok(v, 'de verzekerde staat in het overzicht');
  assert.ok(!('memberKey' in v), 'de sleutel van de identiteitskluis blijft binnen');
  assert.ok(!JSON.stringify(o.body).includes('memberKey'), 'nergens in het antwoord');
});

test('3. de declaratieketen: een mens beslist, en afwijzen kan alleen met een reden', async () => {
  const o = await zp('', {}, segur);
  const pas = o.body.verzekerden.find(x => x.codenaam === lidCode).pas;
  // indienen op de pas, met de vaste grenzen
  assert.equal((await zp('/declaratie', { pas, omschrijving: '', bedrag: 40 }, segur)).status, 400);
  assert.equal((await zp('/declaratie', { pas, omschrijving: 'Fysio', bedrag: -5 }, segur)).status, 400);
  assert.equal((await zp('/declaratie', { pas: 'ZP-0000', omschrijving: 'Fysio', bedrag: 40 }, segur)).status, 409, 'onbekende pas');
  const d1 = await zp('/declaratie', { pas, omschrijving: 'Fysiotherapie, drie behandelingen', bedrag: 135.5 }, segur);
  assert.equal(d1.status, 200);
  assert.equal(d1.body.declaratie.status, 'ingediend');
  const d2 = await zp('/declaratie', { pas, omschrijving: 'Tandarts, controle', bedrag: 60 }, segur);
  // goedkeuren met een tik; afwijzen alleen met een reden
  const goed = await zp('/declaratie/beslis', { id: d1.body.declaratie.id, besluit: 'goedgekeurd', door: 'Ines Vos' }, segur);
  assert.equal(goed.status, 200);
  assert.equal(goed.body.declaratie.status, 'goedgekeurd');
  assert.equal((await zp('/declaratie/beslis', { id: d1.body.declaratie.id, besluit: 'afgewezen', reden: 'x' }, segur)).status, 409, 'er is al beslist');
  assert.equal((await zp('/declaratie/beslis', { id: d2.body.declaratie.id, besluit: 'afgewezen' }, segur)).status, 400, 'afwijzen zonder reden kan niet');
  const af = await zp('/declaratie/beslis', { id: d2.body.declaratie.id, besluit: 'afgewezen', reden: 'Valt onder het eigen risico.' }, segur);
  assert.equal(af.status, 200);
  assert.equal(af.body.declaratie.reden, 'Valt onder het eigen risico.');
  assert.equal((await zp('/declaratie/beslis', { id: 'dxxx', besluit: 'goedgekeurd' }, segur)).status, 404);
});

test('4. de pas-controle en de stopzetting: sober antwoord, en de pas verdwijnt uit de wallet', async () => {
  const o = await zp('', {}, segur);
  const v = o.body.verzekerden.find(x => x.codenaam === lidCode);
  // de controle geeft niet meer dan actief/pakket/codenaam (kleine letters mogen ook)
  const c = await zp('/pas', { pas: v.pas.toLowerCase() }, segur);
  assert.equal(c.status, 200);
  assert.deepEqual(Object.keys(c.body).sort(), ['actief', 'codenaam', 'pakket'], 'niet meer dan drie velden');
  assert.equal(c.body.actief, true);
  assert.equal((await zp('/pas', { pas: 'ZP-FFFF' }, segur)).status, 404);
  // stopzetten: de pas gaat uit de wallet, declareren kan niet meer, nog eens stoppen ook niet
  assert.equal((await zp('/stop', { id: v.id }, segur)).status, 200);
  assert.equal((await zp('/pas', { pas: v.pas }, segur)).body.actief, false);
  assert.equal((await zp('/stop', { id: v.id }, segur)).status, 409, 'al gestopt');
  assert.equal((await zp('/declaratie', { pas: v.pas, omschrijving: 'Nazorg', bedrag: 20 }, segur)).status, 409, 'op een gestopte pas declareert niemand');
  const w = await wallet('', {}, lidTok);
  assert.ok(!w.body.items.some(x => x.code === v.pas), 'de zorgpas is uit de wallet');
  // en opnieuw inschrijven kan daarna gewoon weer
  assert.equal((await zp('/inschrijf', { codenaam: lidCode, pakket: 'basis' }, segur)).status, 200);
});

test('5. de wallet zelf: klantenkaarten en tickets toevoegen, tonen en weghalen', async () => {
  assert.equal((await wallet('/voeg', { soort: 'klantenkaart', titel: '', code: 'K1' }, lidTok)).status, 400);
  assert.equal((await wallet('/voeg', { soort: 'ticket', titel: 'Concert', code: '' }, lidTok)).status, 400);
  const k = await wallet('/voeg', { soort: 'klantenkaart', titel: 'Boekhandel Passage', code: 'BP-2231' }, lidTok);
  assert.equal(k.status, 200);
  const t = await wallet('/voeg', { soort: 'ticket', titel: 'Zomerconcert', code: 'TK-88' }, lidTok);
  const s = await wallet('/voeg', { soort: 'sleutel', titel: 'Kluisje strand', code: 'SL-4' }, lidTok);
  // een pas of munt maakt een lid nooit zelf aan; dat wordt gewoon een klantenkaart
  const nep = await wallet('/voeg', { soort: 'pas', titel: 'Nep zorgpas', code: 'ZP-9999' }, lidTok);
  assert.equal(nep.body.item.soort, 'klantenkaart', 'zelf een pas maken kan niet');
  const w = await wallet('', {}, lidTok);
  assert.ok(w.body.perSoort.klantenkaart.some(x => x.code === 'BP-2231'));
  assert.ok(w.body.perSoort.ticket.some(x => x.id === t.body.item.id));
  assert.ok(w.body.perSoort.sleutel.some(x => x.id === s.body.item.id));
  // weghalen, en wat er niet is geeft een nette 404
  assert.equal((await wallet('/weg', { id: k.body.item.id }, lidTok)).status, 200);
  assert.equal((await wallet('/weg', { id: k.body.item.id }, lidTok)).status, 404);
});

test('6. feestmunten: kopen stapelt per zaak, inwisselen verlaagt, en onder nul kan nooit', async () => {
  assert.equal((await wallet('/munt/koop', { zaak: '', aantal: 5 }, lidTok)).status, 400);
  assert.equal((await wallet('/munt/koop', { zaak: 'Zomerfeest', aantal: 0 }, lidTok)).status, 400);
  assert.equal((await wallet('/munt/koop', { zaak: 'Zomerfeest', aantal: 101 }, lidTok)).status, 400);
  const k1 = await wallet('/munt/koop', { zaak: 'Zomerfeest', aantal: 10 }, lidTok);
  assert.equal(k1.status, 200);
  assert.equal(k1.body.item.saldo, 10);
  assert.equal(k1.body.prijs, 35, '10 munten a 3,50');
  // nog eens kopen bij dezelfde zaak stapelt op hetzelfde item
  const k2 = await wallet('/munt/koop', { zaak: 'Zomerfeest', aantal: 5 }, lidTok);
  assert.equal(k2.body.item.id, k1.body.item.id, 'een saldo per zaak');
  assert.equal(k2.body.item.saldo, 15);
  // inwisselen, en te veel inwisselen ketst af zonder het saldo te raken
  const wis = await wallet('/munt/wissel', { id: k1.body.item.id, aantal: 3 }, lidTok);
  assert.equal(wis.body.item.saldo, 12);
  assert.equal((await wallet('/munt/wissel', { id: k1.body.item.id, aantal: 99 }, lidTok)).status, 409);
  const w = await wallet('', {}, lidTok);
  assert.equal(w.body.perSoort.munt.find(x => x.id === k1.body.item.id).saldo, 12, 'het saldo bleef staan');
  assert.equal(w.body.muntPrijs, 3.5);
  assert.equal((await wallet('/munt/wissel', { id: 'wxxx', aantal: 1 }, lidTok)).status, 404);
});

test('7. de poorten: gasten en anoniemen niet, en zonder polis-cap geen zorgtak', async () => {
  const gast = (await api('/api/login', { tier: 'guest', pasApp: 'rtg' })).body.token;
  assert.equal((await wallet('', {}, gast)).status, 403, 'de gratis app heeft geen wallet');
  assert.equal((await wallet('', {})).status, 401, 'zonder inlog geen wallet');
  assert.equal((await zp('', {}, kikunoi)).status, 403, 'het restaurant is geen verzekeraar');
  assert.equal((await zp('/inschrijf', { codenaam: lidCode, pakket: 'basis' }, kikunoi)).status, 403);
  assert.equal((await zp('', {})).status, 401, 'zonder zaak-inlog geen werkplek');
  // en de wallet van het ene lid is niet die van het andere
  const b = await lid();
  const wb = await wallet('', {}, b.token);
  assert.equal(wb.body.items.length, 0, 'een vers lid begint met een lege wallet');
});
