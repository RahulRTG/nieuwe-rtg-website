/* De horecabon en het polsbandsaldo (horeca.bon_en_polsbandsaldo), control
   voor control: 128 bits en de kale code eenmaal, hash-only, issuer/doel/
   scope, vervaldatum, max_gebruik (bon 100, band 10000 naast het saldo),
   intrekken en roteren, constant-time zoeken, de atomaire claim met
   idempotentie, de binding aan EEN gastsessie, en de migratie van oude
   32-bitcodes met behoud van waarde. De routes tegen een echte server staan in
   test/horecabon-routes.test.js, de raceproef over twee instances in
   test/horecabon-credential.pg.test.js.

   Draai los: node --test test/horecabon-credential.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const T0 = Date.parse('2026-09-27T12:00:00.000Z');
const DAG = 86400000;

function wereld(data, cryptoMod) {
  let klok = T0;
  const sleutels = [];
  const db = { data: Object.assign({}, data), writable: true };
  const basis = require('../server/db/collectie-bewerken')({ store: 'json', db, save() {} });
  const bewerkCollectie = (s, werk) => { sleutels.push(s); return basis(s, werk); };
  const kern = require('../server/kern/horeca/bon')({ db, bewerkCollectie, crypto: cryptoMod || crypto,
    nu: () => new Date(klok).toISOString() });
  const opCode = (code, zaak = 'ZAAK') => kern.opCode(zaak, code);
  const boek = (code, centen, extra) => kern.boek(Object.assign({ zaak: 'ZAAK', vind: opCode(code), centen }, extra));
  const rijen = () => Object.values(db.data.horecaBonnen || {});
  return { db, kern, boek, opCode, rijen, sleutels, schuif: ms => { klok += ms; } };
}

test('1. 128 bits, de kale code een keer, en op schijf alleen de hash', async () => {
  const w = wereld();
  const r = await w.kern.maak({ zaak: 'ZAAK', centen: 2500, naam: 'Jubileum' });
  assert.equal(r.eenmalig, true);
  assert.match(r.code, /^HB(-[0-9A-F]{4}){8}$/, '32 hexcijfers = randomBytes(16)');
  const band = await w.kern.band({ zaak: 'ZAAK', nummer: '077', centen: 5000 });
  assert.match(band.code, /^PB(-[0-9A-F]{4}){8}$/);
  const opslag = JSON.stringify(w.db.data);
  for (const c of [r.code, band.code]) assert.equal(opslag.includes(c.replace(/-/g, '').slice(2)), false, 'het geheim staat nergens');
  const bon = w.rijen().find(b => b.id === r.bon.id);
  assert.match(bon.toegang.code_hash, /^[a-f0-9]{64}$/);
  assert.equal('code' in bon, false);
  const buiten = JSON.stringify(r.bon);
  assert.equal(buiten.includes(bon.toegang.code_hash), false, 'naar buiten geen hash');
  const tweede = await w.kern.band({ zaak: 'ZAAK', nummer: '077', centen: 100 });
  assert.equal(tweede.code, undefined, 'opwaarderen toont de code niet opnieuw');
  assert.equal(tweede.bon.saldo, 5100);
  const her = await w.kern.maak({ zaak: 'ZAAK', centen: 100, idem: 'k-1' });
  const nog = await w.kern.maak({ zaak: 'ZAAK', centen: 100, idem: 'k-1' });
  assert.equal(nog.herhaald, true); assert.equal(nog.code, undefined, 'een herhaling toont geen code');
  assert.equal(nog.bon.id, her.bon.id);
  // een dubbeltik op de band: een opwaardering, en de tweede keer geen code
  const t1 = await w.kern.band({ zaak: 'ZAAK', nummer: '078', centen: 500, idem: 'tik-1' });
  const t2 = await w.kern.band({ zaak: 'ZAAK', nummer: '078', centen: 500, idem: 'tik-1' });
  assert.equal(t2.herhaald, true); assert.equal(t2.code, undefined); assert.equal(t2.bon.saldo, 500);
  await w.kern.band({ zaak: 'ZAAK', nummer: '078', centen: 500, idem: 'tik-2' });
  const t3 = await w.kern.band({ zaak: 'ZAAK', nummer: '078', centen: 500, idem: 'tik-2' });
  assert.equal(t3.bon.saldo, 1000, 'een herhaalde opwaardering telt een keer');
  assert.equal(t1.bon.id, t3.bon.id);
});

test('2. issuer, doel en scope: de code geldt bij EEN zaak voor EEN handeling', async () => {
  const w = wereld();
  const { code, bon } = await w.kern.maak({ zaak: 'ZAAK', centen: 1000 });
  const t = w.rijen()[0].toegang;
  assert.equal(t.issuer, 'zaak:ZAAK');
  assert.equal(t.doel, 'horeca-bon-saldo');
  assert.deepEqual(t.scope, ['horeca.bon.afboeken']);
  assert.deepEqual(t.onderwerp, { soort: 'cadeaubon', id: bon.id, zaak: 'ZAAK' });
  assert.equal((await w.boek(code, 1, { zaak: 'ANDER', vind: w.opCode(code, 'ANDER') })).status, 404, 'een andere zaak kent hem niet');
  w.db.data.horecaBonnen[bon.id].toegang.doel = 'iets-anders';
  assert.equal((await w.boek(code, 1)).status, 409, 'een ander doel opent niets');
});

test('3. vervaldatum: bon een jaar, band dertig dagen, de zaak mag inkorten en niet verlengen', async () => {
  const w = wereld();
  const bon = await w.kern.maak({ zaak: 'ZAAK', centen: 1000 });
  assert.equal(Date.parse(w.rijen()[0].toegang.expires_at) - T0, 365 * DAG);
  const band = await w.kern.band({ zaak: 'ZAAK', nummer: '1', centen: 1000 });
  assert.equal(Date.parse(w.db.data.horecaBonnen[band.bon.id].toegang.expires_at) - T0, 30 * DAG);
  const kort = await w.kern.maak({ zaak: 'ZAAK', centen: 1000, geldigTot: '2026-10-01' });
  assert.equal(kort.bon.geldigTot, '2026-10-01');
  const lang = await w.kern.maak({ zaak: 'ZAAK', centen: 1000, geldigTot: '2099-01-01' });
  assert.equal(Date.parse(w.db.data.horecaBonnen[lang.bon.id].toegang.expires_at) - T0, 365 * DAG, 'verlengen kan niet');
  w.schuif(31 * DAG);
  assert.equal((await w.boek(band.code, 1)).code, 'bon-verlopen');
  assert.equal((await w.boek(kort.code, 1)).code, 'bon-verlopen');
  assert.equal((await w.boek(bon.code, 1)).ok, true, 'de bon van een jaar loopt nog');
});

test('4. max_gebruik: een bon 100 keer, een band 10000 keer -- het saldo is de echte grens', async () => {
  const w = wereld();
  const bon = await w.kern.maak({ zaak: 'ZAAK', centen: 100000 });
  const band = await w.kern.band({ zaak: 'ZAAK', nummer: '9', centen: 100000 });
  assert.equal(w.db.data.horecaBonnen[bon.bon.id].toegang.max_gebruik, 100);
  assert.equal(w.db.data.horecaBonnen[band.bon.id].toegang.max_gebruik, 10000);
  w.db.data.horecaBonnen[bon.bon.id].toegang.gebruik = 99;
  assert.equal((await w.boek(bon.code, 1)).ok, true, 'het honderdste gebruik mag');
  assert.equal(w.db.data.horecaBonnen[bon.bon.id].toegang.gebruik, 100, 'elke afboeking telt');
  assert.equal((await w.boek(bon.code, 1)).code, 'bon-opgebruikt');
  const r = await w.boek(band.code, 150000);
  assert.equal(r.geboekt, 100000, 'nooit meer dan het saldo'); assert.equal(r.restVraag, 50000);
  assert.equal((await w.boek(band.code, 1)).code, 'bon-leeg', 'en nooit onder nul');
});

test('5. intrekken en roteren aan de serverkant', async () => {
  const w = wereld();
  const a = await w.kern.maak({ zaak: 'ZAAK', centen: 5000 });
  const inn = await w.kern.intrek({ zaak: 'ZAAK', id: a.bon.id, door: 'zaak:ZAAK', reden: 'gestolen' });
  assert.equal(inn.ok, true);
  assert.equal((await w.boek(a.code, 1)).code, 'bon-ingetrokken');
  assert.equal(w.db.data.horecaBonnen[a.bon.id].saldo, 5000, 'het saldo blijft staan: het is geld van de houder');
  const b = await w.kern.maak({ zaak: 'ZAAK', centen: 5000 });
  assert.equal((await w.kern.roteer({ zaak: 'ZAAK', id: b.bon.id, door: 'x' })).status, 400, 'zonder sleutel geen nieuwe code');
  const rot = await w.kern.roteer({ zaak: 'ZAAK', id: b.bon.id, door: 'x', idem: 'r1' });
  assert.match(rot.code, /^HB(-[0-9A-F]{4}){8}$/);
  assert.notEqual(rot.code, b.code);
  assert.equal((await w.boek(b.code, 1)).code, 'bon-vervangen', 'de oude code opent niets meer');
  assert.equal((await w.boek(rot.code, 1)).ok, true);
  const nog = await w.kern.roteer({ zaak: 'ZAAK', id: b.bon.id, door: 'x', idem: 'r1' });
  assert.equal(nog.status, 409); assert.equal(nog.code, 'bon-al-geroteerd'); assert.equal('eenmalig' in nog, false);
  assert.equal((await w.kern.roteer({ zaak: 'ANDER', id: b.bon.id, door: 'x', idem: 'r2' })).status, 404, 'alleen de eigen zaak');
});

test('6. constant-time: elke rij wordt vergeleken, ook na een treffer', async () => {
  let n = 0;
  const teller = Object.assign(Object.create(crypto), { timingSafeEqual: (a, b) => { n++; return crypto.timingSafeEqual(a, b); } });
  const w = wereld({}, teller);
  const eerste = await w.kern.maak({ zaak: 'ZAAK', centen: 100 });
  for (let i = 0; i < 9; i++) await w.kern.maak({ zaak: 'ZAAK', centen: 100 });
  n = 0;
  assert.equal((await w.kern.lees({ zaak: 'ZAAK', code: eerste.code })).ok, true);
  assert.ok(n >= 10, 'de zoektocht stopte na ' + n + ' vergelijkingen in plaats van alle tien te doen');
});

test('7. de claim is een transactie, nooit onder nul, en een herhaling boekt niet opnieuw', async () => {
  const w = wereld();
  const { code, bon } = await w.kern.maak({ zaak: 'ZAAK', centen: 1000 });
  w.sleutels.length = 0;
  const r1 = await w.boek(code, 600, { idem: 'kassa-1' });
  assert.deepEqual(w.sleutels, ['horecaBonnen'], 'EEN collectietransactie per afboeking');
  const r2 = await w.boek(code, 600, { idem: 'kassa-1' });
  assert.equal(r2.herhaald, true); assert.equal(r2.ref, r1.ref); assert.equal(r2.geboekt, 600);
  assert.equal(w.db.data.horecaBonnen[bon.id].saldo, 400, 'een keer afgeboekt');
  assert.equal((await w.boek(code, 500, { idem: 'kassa-1' })).status, 409, 'dezelfde sleutel voor een ander bedrag');
  const r3 = await w.boek(code, 600);
  assert.equal(r3.geboekt, 400);
  const her = await w.kern.herstel({ zaak: 'ZAAK', id: bon.id, ref: r3.ref });
  assert.equal(her.saldo, 400, 'terugzetten geeft het saldo terug');
  assert.equal((await w.kern.herstel({ zaak: 'ZAAK', id: bon.id, ref: r3.ref })).herhaald, true, 'een keer');
  assert.equal(w.db.data.horecaBonnen[bon.id].saldo, 400);
});

test('8. een gast boekt alleen af wat aan ZIJN sessie hangt', async () => {
  const w = wereld();
  const { code, bon } = await w.kern.maak({ zaak: 'ZAAK', centen: 3000 });
  let open = true;
  const leeft = () => open;
  assert.equal((await w.kern.boek({ zaak: 'ZAAK', vind: w.kern.opSessie('ZAAK', 'R1', 'd1'), centen: 100 })).code,
    'bon-niet-gekoppeld', 'zonder koppeling vindt de sessie niets');
  assert.equal((await w.kern.koppel({ zaak: 'ZAAK', code, rekeningId: 'R1', deelnemer: 'd1', leeft })).ok, true);
  const ander = await w.kern.koppel({ zaak: 'ZAAK', code, rekeningId: 'R2', deelnemer: 'd2', leeft });
  assert.equal(ander.code, 'bon-elders-gekoppeld', 'zolang die rekening open is, koppelt geen ander');
  assert.equal((await w.kern.boek({ zaak: 'ZAAK', vind: w.kern.opSessie('ZAAK', 'R2', 'd2'), centen: 100 })).code, 'bon-niet-gekoppeld');
  assert.equal((await w.kern.boek({ zaak: 'ZAAK', vind: w.kern.opSessie('ZAAK', 'R1', 'd1'), centen: 100 })).geboekt, 100);
  assert.equal((await w.kern.koppel({ zaak: 'ANDER', code, rekeningId: 'R9', deelnemer: 'd9', leeft })).status, 404);
  open = false;
  assert.equal((await w.kern.koppel({ zaak: 'ZAAK', code, rekeningId: 'R2', deelnemer: 'd2', leeft })).ok, true, 'na sluiten wel');
  assert.equal(w.db.data.horecaBonnen[bon.id].binding.deelnemer, 'd2');
  await w.kern.roteer({ zaak: 'ZAAK', id: bon.id, door: 'x', idem: 'r' });
  assert.equal(w.db.data.horecaBonnen[bon.id].binding, null, 'een rotatie verbreekt de koppeling');
});

test('9. de migratie: oude 32-bitbonnen worden hash, met behoud van waarde', async () => {
  const OUD = 'ABCD1234';
  const w = wereld({ horeca: { ZAAK: {
    bonnen: { [OUD]: { code: OUD, soort: 'tegoed', uitgegeven: 5000, saldo: 3000, naam: 'Polsband 7', geldigTot: '2027-01-01',
      at: '2026-01-01T00:00:00.000Z', mutaties: [{ at: 'x', centen: -2000 }] } },
    club: { banden: { 7: { nummer: '7', bonCode: OUD } } },
    rekeningen: { R: { status: 'betaald', betalingen: [{ wijze: 'tegoed', centen: 2000, bon: OUD }] } } } } });
  const r = await w.boek(OUD.toLowerCase(), 500);
  assert.equal(r.geboekt, 500, 'de houder betaalt met wat hij had');
  const json = JSON.stringify(w.db.data);
  assert.equal(json.includes(OUD), false, 'de kale code staat nergens meer');
  const bon = w.rijen()[0];
  assert.equal(bon.legacy32, true); assert.equal(bon.saldo, 2500); assert.equal(bon.band, '7');
  assert.equal(bon.toegang.expires_at, '2027-01-01T23:59:59.999Z');
  assert.equal(w.db.data.horeca.ZAAK.club.banden[7].bonId, bon.id);
  assert.equal(w.db.data.horeca.ZAAK.rekeningen.R.betalingen[0].bonId, bon.id);
  assert.equal('bonnen' in w.db.data.horeca.ZAAK, false);
  await w.kern.zorg();
  assert.equal(w.rijen().length, 1, 'nog een keer migreren maakt geen tweede');
});
