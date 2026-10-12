/* DE TEGOEDBON ALS CREDENTIAL (CODECREDENTIALS.json, deur `pay.tegoedbon`).

   Elke control van de deur heeft hier een eigen toets, en elke toets is tegen
   een kapotgemaakte kern gezien zakken (LAT.md regel 2); de mutatie staat per
   toets erbij. De kern draait op een kleine maar ECHTE wereld: lib/idem.js
   voor de koop, db/economische-boeking.js voor de economische sleutel (de
   proceslokale weg die ook de ontwikkelserver neemt) en
   betaalopdracht/terugboeking.js eronder. Alleen het grootboek zelf is een
   kleine nabouw met dezelfde regel als ./index.js: een niet-externe rekening
   gaat nooit onder nul, een `extern:`-rekening wel.

   Wat hier NIET bewezen wordt: atomiciteit over twee processen. Dat kan alleen
   op een echte gedeelde database en staat in tegoedbon-credential.pg.test.js.

   Draai los: node --test test/tegoedbon-credential.test.js */
'use strict';
const metDekking = require('./lib/dekking');
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

function wereld({ tellendeCrypto } = {}) {
  const klok = { t: Date.parse('2026-09-27T10:00:00Z') };
  const data = { paySaldi: {}, payBoekingen: [] };
  const db = { data, writable: true };
  let n = 0, geboekt = 0;
  const saldi = () => data.paySaldi, grootboek = () => data.payBoekingen;
  const stuk = { boekFout: null, crashNaBoeking: false };
  const boek = ({ van, naar, centen, soort, oms, ref }) => {
    if (stuk.boekFout) return stuk.boekFout;
    if (!van.startsWith('extern:') && (saldi()[van] || 0) < centen) return { status: 402, error: 'Onvoldoende saldo.' };
    saldi()[van] = (saldi()[van] || 0) - centen;
    saldi()[naar] = (saldi()[naar] || 0) + centen;
    const rij = { id: 'PB' + (++n), van, naar, centen, soort, oms, ref: ref || null, at: klok.t };
    grootboek().unshift(rij);
    geboekt++;
    return { ok: true, boeking: rij };
  };
  const echtEenmaal = require('../server/db/economische-boeking')({ db, store: 'json',
    bijeen: async f => f(), save() {} });
  const cryptoIn = tellendeCrypto || crypto;
  const ctx = {
    crypto: cryptoIn, save() {}, nu: () => klok.t, d: () => data,
    schoon: (s, m) => String(s == null ? '' : s).slice(0, m),
    rekLid: c => 'lid:' + c, rekPartner: c => 'partner:' + c,
    saldoVan: r => Math.round(saldi()[r] || 0), id: p => (p || 'P') + (++n),
    metIdem: require('../server/lib/idem')({ d: () => data, save() {}, naam: 'payIdem' }),
    grootboek, boek, boekAsync: async a => boek(a), geldModus: 'schaduw',
    economischeBoekingEenmaal: async (i, w) => {
      const r = await echtEenmaal(i, w);
      if (stuk.crashNaBoeking) { stuk.crashNaBoeking = false; throw new Error('antwoord kwijt na commit'); }
      return r;
    },
    zorgSaldo: async () => ({ ok: true, bijgeladen: 0 }), seintje() {}, bestaatLid: async () => true,
    MIN_CENTEN: 1, MAX_CENTEN: 500000
  };
  const tegoed = require('../server/kern/pay/tegoed')(metDekking(ctx));
  return { tegoed, data, klok, stuk, saldi, grootboek, geboekt: () => geboekt };
}

const kaal = s => String(s).toUpperCase().replace(/[^0-9A-Z]/g, '');

/* raw_once + hash_only_at_rest + 128 bits.
   MUTATIE GEZIEN ZAKKEN: in tegoed-uitgifte.js `metCode` de code op het
   BEWAARDE antwoord zetten (r.tegoed.code = doos.code) in plaats van op een
   kopie -- de code belandde in payIdem en deze toets zakte al op de eerste
   opslagcontrole. En apart: in
   tegoed-bon.js `naarBuiten` het veld `toegang` vervangen door de hele toegang
   (met code_hash) -- zakte op "het overzicht draagt geen hash". */
test('de kale code bestaat alleen in het antwoord op de koop; op schijf en in het overzicht staat hij niet', async () => {
  const w = wereld();
  w.saldi()['lid:Koper'] = 10000;
  const koop = await w.tegoed.tegoedKoop({ codenaam: 'Koper', centen: 2500, idem: 'k1' });
  assert.equal(koop.ok, true, JSON.stringify(koop));
  assert.equal(koop.eenmalig, true);
  assert.match(koop.tegoed.code, /^TG(-[0-9A-F]{4}){8}$/, 'TG plus 32 hextekens = 128 bits');
  const k = kaal(koop.tegoed.code);
  const opSchijf = JSON.stringify(w.data);
  assert.equal(opSchijf.includes(k), false, 'de genormaliseerde code staat nergens in de opslag');
  assert.equal(opSchijf.includes(koop.tegoed.code), false, 'de opgemaakte code ook niet');
  assert.equal(JSON.stringify(w.data.payIdem).includes(k), false, 'payIdem draagt de kale code niet');
  const rij = w.data.payTegoedBon[koop.tegoed.id];
  assert.match(rij.toegang.code_hash, /^[a-f0-9]{64}$/, 'alleen een SHA-256 staat op schijf');

  const nog = await w.tegoed.tegoedKoop({ codenaam: 'Koper', centen: 2500, idem: 'k1' });
  assert.equal(nog.herhaald, true);
  assert.equal(nog.tegoed.code, undefined, 'een herhaling toont de code niet opnieuw');
  assert.equal(w.saldi()['lid:Koper'], 7500, 'en boekt niet dubbel');

  const ov = await w.tegoed.tegoedOverzicht('Koper');
  const ovTekst = JSON.stringify(ov);
  assert.equal(ovTekst.includes(k), false, 'het overzicht toont de code niet');
  assert.equal(ovTekst.includes(rij.toegang.code_hash), false, 'het overzicht draagt geen hash');
  assert.equal(ov.gekocht[0].toegang.doel, 'pay-tegoedbon');
});

/* issuer_doel_scope + issued_at_expires_at + max_gebruik_gebruik.
   MUTATIE GEZIEN ZAKKEN: in tegoed-claim.js de regel `bearer.gebruik(r.toegang)`
   weggehaald -- zakte op "gebruik telt de verzilvering". */
test('de toegang draagt uitgever, doel, scope, uitgifte, verval en een gebruiksteller van een', async () => {
  const w = wereld();
  w.saldi()['lid:Koper'] = 10000;
  const koop = await w.tegoed.tegoedKoop({ codenaam: 'Koper', centen: 1000, idem: 'k2' });
  const t = w.data.payTegoedBon[koop.tegoed.id].toegang;
  assert.equal(t.issuer, 'lid:Koper');
  assert.equal(t.doel, 'pay-tegoedbon');
  assert.deepEqual(t.scope, ['tegoed.verzilveren']);
  assert.equal(t.issued_at, new Date(w.klok.t).toISOString());
  assert.equal(Date.parse(t.expires_at) - Date.parse(t.issued_at), 365 * 86400000);
  assert.equal(t.max_gebruik, 1);
  assert.equal(t.gebruik, 0);
  const in_ = await w.tegoed.tegoedVerzilver({ codenaam: 'Ontvanger', code: koop.tegoed.code, idem: 'v' });
  assert.equal(in_.ok, true, JSON.stringify(in_));
  assert.equal(w.data.payTegoedBon[koop.tegoed.id].toegang.gebruik, 1, 'gebruik telt de verzilvering');
  const weer = await w.tegoed.tegoedVerzilver({ codenaam: 'Derde', code: koop.tegoed.code, idem: 'v2' });
  assert.equal(weer.status, 409);
  assert.equal(w.saldi()['lid:Ontvanger'], 1000);
  assert.equal(w.saldi()['extern:tegoed'], 0);
});

/* constant_time_lookup: elke rij wordt met timingSafeEqual vergeleken, ook na
   een treffer. MUTATIE GEZIEN ZAKKEN: `zoek` in tegoed-bon.js vervangen door
   Object.values(bron).find(... zelfdeHash ...) -- zakte op "alle vijf rijen
   vergeleken" (kreeg 1 bij de eerste bon). */
test('zoeken op code vergelijkt constant-time alle rijen en stopt niet bij de eerste treffer', async () => {
  let vergelijkingen = 0;
  const tellend = Object.assign({}, crypto, {
    randomBytes: crypto.randomBytes, createHash: crypto.createHash,
    timingSafeEqual: (a, b) => { vergelijkingen++; return crypto.timingSafeEqual(a, b); }
  });
  const w = wereld({ tellendeCrypto: tellend });
  w.saldi()['lid:Koper'] = 100000;
  const codes = [];
  for (let i = 0; i < 5; i++) codes.push((await w.tegoed.tegoedKoop({ codenaam: 'Koper', centen: 100, idem: 'c' + i })).tegoed.code);
  vergelijkingen = 0;
  const r = await w.tegoed.tegoedVerzilver({ codenaam: 'Ontvanger', code: codes[0], idem: 'x' });
  assert.equal(r.ok, true);
  /* De eerste bon in de kaart is de treffer; een zoektocht die daar stopt,
     vergelijkt er een. Toch worden alle vijf gezien. De saga zoekt een keer
     (stap 1). */
  assert.equal(vergelijkingen, 5, 'alle vijf rijen vergeleken');
  assert.equal((await w.tegoed.tegoedVerzilver({ codenaam: 'Ontvanger', code: 'TG-' + '0'.repeat(32), idem: 'y' })).status, 404);
});

/* server_side_intrekken_roteren.
   MUTATIE AFGESLAGEN, en dat is een bevinding: alleen `bearer.intrekken` op de
   oude toegang weghalen bijt niet, want de toegang wordt in zijn geheel
   VERVANGEN en de oude hash staat alleen nog in `historie`, waar niet wordt
   gezocht. De twee mutaties die wel raken: de oude code_hash op de nieuwe
   toegang laten staan, en `zoek` ook in `historie` laten kijken -- beide zakten
   op "de oude code is dood". En apart: in
   tegoed-gedeeld.js bij intrekken de vervalcontrole ook laten gelden -- zakte
   op "intrekken kan voor de vervaldatum". */
test('roteren maakt de oude code dood en toont de nieuwe een keer; intrekken zet het geld terug', async () => {
  const w = wereld();
  w.saldi()['lid:Koper'] = 10000;
  const koop = await w.tegoed.tegoedKoop({ codenaam: 'Koper', centen: 3000, idem: 'k3' });
  const zonder = await w.tegoed.tegoedRoteer({ codenaam: 'Koper', tegoedId: koop.tegoed.id });
  assert.equal(zonder.status, 400, 'zonder sleutel geen nieuwe code');
  const vreemd = await w.tegoed.tegoedRoteer({ codenaam: 'Ander', tegoedId: koop.tegoed.id, idem: 'r1' });
  assert.equal(vreemd.status, 404, 'alleen de koper roteert');
  const rot = await w.tegoed.tegoedRoteer({ codenaam: 'Koper', tegoedId: koop.tegoed.id, idem: 'r1' });
  assert.equal(rot.ok, true, JSON.stringify(rot));
  assert.notEqual(rot.tegoed.code, koop.tegoed.code);
  assert.equal(rot.tegoed.toegang.rotatie, 2);
  const nogmaals = await w.tegoed.tegoedRoteer({ codenaam: 'Koper', tegoedId: koop.tegoed.id, idem: 'r1' });
  assert.equal(nogmaals.status, 409);
  assert.equal(nogmaals.tegoed.code, undefined, 'dezelfde sleutel toont geen tweede code');
  assert.equal(JSON.stringify(w.data).includes(kaal(rot.tegoed.code)), false, 'ook de nieuwe code staat niet op schijf');
  assert.equal((await w.tegoed.tegoedVerzilver({ codenaam: 'X', code: koop.tegoed.code, idem: 'o' })).status, 404,
    'de oude code is dood');

  const intrek = await w.tegoed.tegoedTerug({ codenaam: 'Koper', tegoedId: koop.tegoed.id, intrekken: true, idem: 'i1' });
  assert.equal(intrek.ok, true, 'intrekken kan voor de vervaldatum: ' + JSON.stringify(intrek));
  assert.equal(w.saldi()['lid:Koper'], 10000, 'het volle bedrag is terug bij de koper');
  assert.equal(w.saldi()['extern:tegoed'], 0);
  const bon = w.data.payTegoedBon[koop.tegoed.id];
  assert.equal(bon.status, 'ingetrokken');
  assert.ok(bon.toegang.ingetrokken_at, 'de toegang is server-side ingetrokken');
  assert.equal((await w.tegoed.tegoedVerzilver({ codenaam: 'X', code: rot.tegoed.code, idem: 'n' })).status, 409,
    'en de nieuwe code werkt daarna ook niet meer');
  assert.equal((await w.tegoed.tegoedTerug({ codenaam: 'Koper', tegoedId: koop.tegoed.id, intrekken: true, idem: 'i1' })).herhaald, true);
  assert.equal(w.saldi()['lid:Koper'], 10000, 'een herhaling boekt niets');
});

/* atomic_claim, de saga. De boeking commit en het antwoord gaat verloren:
   de claim blijft staan en wordt hervat met DEZELFDE economische sleutel.
   MUTATIE GEZIEN ZAKKEN: in tegoed-claim.js de claim bij elke fout vrijgeven
   (de voorwaarde `b.status >= 400 && b.status < 500` weggehaald) -- de bon
   stond na de crash weer open, een tweede poging kreeg een nieuw claim-id en
   dus een nieuwe sleutel, en deze toets zakte. En apart: de hervat-tak voor
   'claimend' weggehaald -- ook die zakte hier (en in de toets hieronder niet,
   omdat de claim daar binnen EEN synchrone transactie wordt gezet). */
test('een verloren antwoord na de boeking wordt hervat en boekt nooit twee keer', async () => {
  const w = wereld();
  w.saldi()['lid:Koper'] = 10000;
  const koop = await w.tegoed.tegoedKoop({ codenaam: 'Koper', centen: 4000, idem: 'k4' });
  w.stuk.crashNaBoeking = true;
  const eerst = await w.tegoed.tegoedVerzilver({ codenaam: 'Ontvanger', code: koop.tegoed.code, idem: 'a' });
  assert.equal(eerst.status, 503, 'de eerste poging weet niet of het gelukt is: ' + JSON.stringify(eerst));
  assert.equal(w.data.payTegoedBon[koop.tegoed.id].status, 'claimend', 'de claim blijft staan');
  /* Een ANDER met dezelfde code maakt de lopende claim af -- naar de
     oorspronkelijke ontvanger -- en krijgt zelf niets. */
  const ander = await w.tegoed.tegoedVerzilver({ codenaam: 'Dief', code: koop.tegoed.code, idem: 'b' });
  assert.equal(ander.status, 409, JSON.stringify(ander));
  const uit = w.grootboek().filter(r => r.van === 'extern:tegoed');
  assert.equal(uit.length, 1, 'precies een boeking uit de escrow');
  assert.equal(w.saldi()['lid:Ontvanger'], 4000);
  assert.equal(w.saldi()['lid:Dief'] || 0, 0);
  assert.equal(w.saldi()['extern:tegoed'], 0);
  assert.equal(w.data.payTegoedBon[koop.tegoed.id].status, 'verzilverd');
});

/* atomic_claim, gelijktijdig in een proces: twee verzilveringen tegelijk.
   Dit is de ondergrens; over twee PROCESSEN bewijst
   tegoedbon-credential.pg.test.js het op een echte PostgreSQL.
   MUTATIE GEZIEN ZAKKEN: in tegoed-claim.js `t.status = 'claimend'` bij het
   claimen weggehaald -- beide aanvragers claimden, en deze toets zakte op
   "er gaat maar een keer geld uit de escrow". */
test('twee gelijktijdige verzilveringen van dezelfde code: een wint, de escrow loopt een keer leeg', async () => {
  const w = wereld();
  w.saldi()['lid:Koper'] = 10000;
  const koop = await w.tegoed.tegoedKoop({ codenaam: 'Koper', centen: 2000, idem: 'k5' });
  const r = await Promise.all([
    w.tegoed.tegoedVerzilver({ codenaam: 'A', code: koop.tegoed.code, idem: 'a' }),
    w.tegoed.tegoedVerzilver({ codenaam: 'B', code: koop.tegoed.code, idem: 'b' })
  ]);
  assert.equal(r.filter(x => x.ok).length, 1, JSON.stringify(r));
  assert.equal(w.grootboek().filter(x => x.van === 'extern:tegoed').length, 1, 'er gaat maar een keer geld uit de escrow');
  assert.equal(w.saldi()['extern:tegoed'], 0);
});

/* Een WEIGERING van het grootboek geeft de bon vrij; een ander kan hem daarna
   nog gebruiken. MUTATIE GEZIEN ZAKKEN: het vrijgeven bij een 4xx weggehaald --
   zakte op "na een weigering staat de bon weer open". */
test('weigert het grootboek (4xx), dan staat de bon weer open en is er niets geboekt', async () => {
  const w = wereld();
  w.saldi()['lid:Koper'] = 10000;
  const koop = await w.tegoed.tegoedKoop({ codenaam: 'Koper', centen: 500, idem: 'k6' });
  w.stuk.boekFout = { status: 409, code: 'wallet-plafond', error: 'vol' };
  const vol = await w.tegoed.tegoedVerzilver({ codenaam: 'Vol', code: koop.tegoed.code, idem: 'a' });
  assert.equal(vol.status, 409);
  w.stuk.boekFout = null;
  assert.equal(w.data.payTegoedBon[koop.tegoed.id].status, 'open', 'na een weigering staat de bon weer open');
  const ok = await w.tegoed.tegoedVerzilver({ codenaam: 'Ruim', code: koop.tegoed.code, idem: 'b' });
  assert.equal(ok.ok, true);
  assert.equal(w.saldi()['lid:Ruim'], 500);
});

/* Gericht tegoed zonder code: het id plus de sessie. MUTATIE GEZIEN ZAKKEN:
   in tegoed.js de voorwaarde `bron[tid].aan === codenaam` weggehaald -- zakte
   op "met het id haalt een ander het niet op". */
test('een gericht tegoed haalt de ontvanger op met het id, een ander niet', async () => {
  const w = wereld();
  w.saldi()['lid:Koper'] = 10000;
  const koop = await w.tegoed.tegoedKoop({ codenaam: 'Koper', centen: 700, aanCodenaam: 'Ontvanger', idem: 'k7' });
  assert.equal((await w.tegoed.tegoedVerzilver({ codenaam: 'Ander', tegoedId: koop.tegoed.id })).status, 404,
    'met het id haalt een ander het niet op');
  const voor = await w.tegoed.tegoedOverzicht('Ontvanger');
  assert.equal(voor.voorMij.length, 1);
  assert.equal(voor.voorMij[0].code, undefined);
  const ok = await w.tegoed.tegoedVerzilver({ codenaam: 'Ontvanger', tegoedId: koop.tegoed.id, idem: 'x' });
  assert.equal(ok.ok, true);
  assert.equal(w.saldi()['lid:Ontvanger'], 700);
});

/* De migratie: waardebehoud. Een oude 96-bit code blijft werken, maar staat
   daarna alleen nog als hash; 'bezig' wordt uit het grootboek beslist.
   MUTATIE GEZIEN ZAKKEN: in tegoed-migratie.js `stand()` voor 'bezig' altijd
   'open' laten geven -- zakte op "een bezig-bon met een boeking is afgerond"
   (en de escrow ging dan twee keer leeg). En apart: `codeHash(t.code)`
   vervangen door `codeHash('')` -- zakte op "de oude code werkt nog". */
test('oude bonnen worden hash-only overgezet zonder dat er waarde verdwijnt', async () => {
  const w = wereld();
  const oud = 'ABCD-EF01-2345-6789-ABCD-EF01';
  w.saldi()['extern:tegoed'] = 3000;
  w.saldi()['lid:Koper'] = -3000 + 10000;
  w.data.payTegoed = [
    { id: 'TGOPEN', code: oud, van: 'Koper', vanSoort: 'lid', aan: null, centen: 1000, oms: 'Oud',
      status: 'open', at: w.klok.t - 1000, vervalt: w.klok.t + 86400000, boeking: 'PB0' },
    { id: 'TGBEZIG', code: '1111-2222-3333-4444-5555-6666', van: 'Koper', vanSoort: 'lid', aan: null,
      centen: 2000, oms: 'Half', status: 'bezig', at: w.klok.t - 1000, vervalt: w.klok.t + 86400000 }
  ];
  /* De 'bezig'-bon had zijn boeking wel gekregen, het proces stierf ervoor
     het de stand kon zetten. */
  w.saldi()['extern:tegoed'] -= 2000; w.saldi()['lid:Eerder'] = 2000;
  w.grootboek().unshift({ id: 'PBX', van: 'extern:tegoed', naar: 'lid:Eerder', centen: 2000,
    soort: 'tegoed', ref: 'TGBEZIG', at: w.klok.t - 500 });

  const ov = await w.tegoed.tegoedOverzicht('Koper');
  assert.equal(ov.gekocht.length, 2);
  assert.deepEqual(w.data.payTegoed, [], 'de oude lijst is leeg');
  assert.equal(JSON.stringify(w.data).includes(kaal(oud)), false, 'de oude code staat niet meer kaal op schijf');
  assert.equal(w.data.payTegoedBon.TGOPEN.legacy96, true);
  assert.equal(w.data.payTegoedBon.TGBEZIG.status, 'verzilverd', 'een bezig-bon met een boeking is afgerond');
  assert.equal(w.data.payTegoedBon.TGBEZIG.verzilverdDoor, 'Eerder');

  const r = await w.tegoed.tegoedVerzilver({ codenaam: 'Houder', code: oud.toLowerCase(), idem: 'h' });
  assert.equal(r.ok, true, 'de oude code werkt nog: ' + JSON.stringify(r));
  assert.equal(w.saldi()['lid:Houder'], 1000);
  assert.equal(w.saldi()['extern:tegoed'], 0, 'de escrow sluit op nul');
  assert.equal((await w.tegoed.tegoedOverzicht('Koper')).gekocht.length, 2, 'een tweede ronde zet niets dubbel over');
});

/* De vervaldatum: terugnemen pas daarna, verzilveren niet meer. */
test('een verlopen tegoed gaat terug naar de koper en niet naar RTG', async () => {
  const w = wereld();
  w.saldi()['lid:Koper'] = 5000;
  const koop = await w.tegoed.tegoedKoop({ codenaam: 'Koper', centen: 4000, idem: 'k8' });
  assert.equal((await w.tegoed.tegoedTerug({ codenaam: 'Koper', tegoedId: koop.tegoed.id })).status, 409);
  w.klok.t += 366 * 86400000;
  assert.equal((await w.tegoed.tegoedVerzilver({ codenaam: 'Laat', code: koop.tegoed.code })).status, 409);
  assert.equal((await w.tegoed.tegoedRoteer({ codenaam: 'Koper', tegoedId: koop.tegoed.id, idem: 'r' })).status, 409);
  const terug = await w.tegoed.tegoedTerug({ codenaam: 'Koper', tegoedId: koop.tegoed.id });
  assert.equal(terug.ok, true, JSON.stringify(terug));
  assert.equal(w.saldi()['lid:Koper'], 5000);
  assert.equal(w.saldi()['extern:tegoed'], 0);
});

/* De economische sleutel heeft zijn eigen soort en haalt de vormcontrole van
   alle drie de opslagen. MUTATIE GEZIEN ZAKKEN: `pay-tegoed` uit SLEUTEL in
   db/economische-identiteit.js gehaald -- zakte hier op de vorm. */
test('de escrowboeking draagt een economische sleutel van de soort pay-tegoed', () => {
  const { SLEUTEL } = require('../server/db/economische-identiteit');
  assert.ok(SLEUTEL.test('pay-tegoed:' + 'a'.repeat(64)));
  assert.ok(SLEUTEL.test('payout-terug:' + 'a'.repeat(64)));
  assert.equal(SLEUTEL.test('vrij:' + 'a'.repeat(64)), false);
  assert.equal(SLEUTEL.test('pay-tegoed:TG1/C1'), false, 'nooit een ref of id in de sleutel');
});

/* Een escrow die op exact nul uitkomt, blijft een rekening. De publicatie na
   een economische commit liet hem vallen terwijl de database 0 bewaarde, en
   in PostgreSQL-stand gaf het eerstvolgende verzoek op die rekening daardoor
   409 (test/tegoedbon-routes.test.js, tweede toets, tegen een echte database).
   MUTATIE GEZIEN ZAKKEN: in db/economische-identiteit.js `saldoSamen` terug
   naar `if (waarde)` -- zakte hier, en de routetoets zakte tegen PostgreSQL. */
test('de saldopublicatie houdt een rekening op nul vast', () => {
  const { saldoSamen } = require('../server/db/economische-identiteit');
  const uit = saldoSamen({ 'extern:tegoed': 1200, 'lid:B': 0 })({
    live: { 'extern:tegoed': 1200, 'lid:B': 0 }, commit: { 'extern:tegoed': 0, 'lid:B': 1200 } });
  assert.deepEqual(uit, { 'extern:tegoed': 0, 'lid:B': 1200 });
  assert.equal(Object.keys(saldoSamen({})({ live: {}, commit: {} })).length, 0, 'wat nergens staat, komt er niet bij');
});

/* FASE 1: de tegoedbon op bearercode v2, als gelijke van de cadeaukaart
   (UITVOERINGSPLAN-AUTHORITY par. 6.1). Een absoluut einde dat de rotatie
   overleeft, een keer te gebruiken, geen afgeleide toegang. Een overschreven
   einde opent niets, en een v1-bon wordt bij de rotatie v2 met hetzelfde einde.
   MUTATIE GEZIEN ZAKKEN: nieuweToegang terug naar geldigMs/maxGebruik (v1) --
   zakt op de contractversie; roteren weer met nieuweToegang -- zakt op v1->v2. */
test('bearercode v2: contracthash op de bon, een verlengd einde opent niets, v1 wordt v2 bij rotatie', async () => {
  const w = wereld();
  w.saldi()['lid:Koper'] = 10000;
  const koop = await w.tegoed.tegoedKoop({ codenaam: 'Koper', centen: 2000, idem: 'v2a' });
  const bon = w.data.payTegoedBon[koop.tegoed.id];
  assert.deepEqual([bon.toegang.contractversie, bon.toegang.gebruiksvorm, bon.toegang.max_gebruik, bon.toegang.afgeleid],
    [2, 'teller', 1, 'geen']);
  const einde = bon.toegang.expires_at;
  bon.toegang.expires_at = '2099-01-01T00:00:00.000Z';
  assert.equal((await w.tegoed.tegoedVerzilver({ codenaam: 'X', code: koop.tegoed.code, idem: 'v2v' })).status, 409,
    'een overschreven einde opent niets');
  bon.toegang.expires_at = einde;

  const koop2 = await w.tegoed.tegoedKoop({ codenaam: 'Koper', centen: 1000, idem: 'v2b' });
  const v1 = w.data.payTegoedBon[koop2.tegoed.id].toegang;
  for (const veld of ['contractversie', 'contracthash', 'afgeleid', 'gebruiksvorm', 'stapOp', 'bron_toegang', 'geschiedenis']) delete v1[veld];
  const rot = await w.tegoed.tegoedRoteer({ codenaam: 'Koper', tegoedId: koop2.tegoed.id, idem: 'v2r' });
  assert.equal(rot.ok, true, JSON.stringify(rot));
  const nieuw = w.data.payTegoedBon[koop2.tegoed.id].toegang;
  assert.equal(nieuw.contractversie, 2);
  assert.equal(nieuw.expires_at, v1.expires_at, 'hetzelfde einde');
  const ver = await w.tegoed.tegoedVerzilver({ codenaam: 'Ontvanger', code: rot.tegoed.code, idem: 'v2z' });
  assert.equal(ver.ok, true, JSON.stringify(ver));
});
