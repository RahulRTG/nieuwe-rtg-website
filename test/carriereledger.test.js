/* HET CARRIERE LEDGER -- chronologisch, per regel bewijsbaar, met herkomst.

   CARRIERE.md par. 4.1 wijst een Career Score af en dit ledger in de plaats. Wat
   deze suite vastlegt, is precies waar die keuze op rust -- want een ledger dat
   zijn eigen verleden kan bijwerken, is een etalage met een andere naam.

   ZEVEN DINGEN, EN ELK ERVAN IS EEN MANIER WAAROP HET FOUT GAAT.

   1. EEN LEDGER WIST NIETS. Intrekken voegt een REGEL toe; de oorspronkelijke
      blijft staan en blijft leesbaar. Dezelfde regel als bij de machtiging:
      intrekken stopt de toekomst en niet het verleden.
   2. `ingetrokken` IS AFGELEID EN NIET OPGESLAGEN. Zou het een vlag op de regel
      zijn, dan was die regel herschreven -- en dan is de reeks een verslag.
   3. EEN FEIT ZONDER HERKOMST IS EEN HALF FEIT, en elke herkomst draagt WAT ZIJ
      NIET ZEGT. Dat blok is even groot als wat zij wel zegt (APPSTORE.md).
   4. DE BEVESTIGINGEN WORDEN NIET SAMENGEVAT. "gezien door RTG" en "bevestigd
      door bond X" zijn twee dingen; platslaan gooit weg wat het bewijsbaar maakt.
   5. EEN BEDRAG IS GEEN CARRIEREFEIT, en een cijfer ook niet. De eerste zou de
      tweede boekhouding maken die WAARDE.md nergens wil; de tweede is CAR-05.
   6. DE ENIGE ORDE IS DE TIJD. Niet op gewicht, niet op aantal bevestigingen,
      niet op kapitaal -- dat zou een ranglijst zijn met een andere naam.
   7. EEN DUBBELKLIK VERDUBBELT GEEN REGEL. Toets 12, en hij staat er omdat de
      dubbeltik-ronde hem VOND: 0 -> 2 op `zet` en op `bevestig`. In een ledger
      weegt dat zwaarder dan elders, want een regel kan alleen worden ingetrokken.

   Draai los: node --test test/carriereledger.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

const R = require('../server/kern/carriereledger/regels');
const { maakCarriereLedger } = require('../server/kern/carriereledger');
const { grensScan, mensVrij } = require('../scripts/lib/cijferopmens');

const NU = Date.parse('2026-09-11T12:00:00Z');
const GISTEREN = '2025-06-14';

function huis() {
  const db = { data: {} };
  const L = maakCarriereLedger({ db, save: () => {}, bijeen: (f) => f(), inBundel: () => false,
    crypto, schoon: (v, n) => String(v == null ? '' : v).trim().slice(0, n || 200),
    codenaamVan: (k) => ({ ka: 'Zilveren Reiger' }[k] || null) });
  return { db, L };
}
const feitje = (L, extra) => L.zet('ka', Object.assign(
  { kapitaal: 'vermogen', wat: 'Nederlands kampioen junior', op: GISTEREN }, extra || {}));

/* ---------- 1. het besluit, zonder opslag ---------- */

test('1. de regels zijn te beproeven zonder server', () => {
  assert.equal(R.toets({ kapitaal: 'vermogen', herkomst: 'zelf', wat: 'NK junior', op: GISTEREN }, NU), null);
  assert.match(R.toets({ kapitaal: 'geluk', herkomst: 'zelf', wat: 'x', op: GISTEREN }, NU), /Kies waar dit bij hoort/);
  assert.match(R.toets({ kapitaal: 'vermogen', herkomst: 'bedacht', wat: 'x', op: GISTEREN }, NU),
    /Een feit zonder herkomst is een half feit/);
});

test('2. een voornemen is geen prestatie', () => {
  const morgen = new Date(NU + 86400000).toISOString().slice(0, 10);
  assert.match(R.toets({ kapitaal: 'vermogen', herkomst: 'zelf', wat: 'wereldkampioen', op: morgen }, NU),
    /NOOIT\.toekomst/);
});

test('3. een bedrag en een cijfer zijn geen carrierefeit', () => {
  const b = { kapitaal: 'financieel', herkomst: 'zelf', wat: 'contract getekend', op: GISTEREN };
  assert.match(R.toets(Object.assign({ bedragCenten: 100 }, b), NU), /NOOIT\.bedrag/);
  assert.match(R.toets(Object.assign({ bedrag: 1 }, b), NU), /NOOIT\.bedrag/);
  assert.match(R.toets(Object.assign({ cijfer: 8 }, b), NU), /NOOIT\.cijfer/);
  assert.match(R.toets(Object.assign({ punten: 8 }, b), NU), /NOOIT\.cijfer/);
  assert.equal(R.toets(b, NU), null, 'DAT er een contract was, is wel een feit');
});

test('4. elke herkomst zegt ook wat zij NIET zegt', () => {
  for (const [naam, h] of Object.entries(R.HERKOMST)) {
    assert.ok(h.stelt && h.stelt.length > 20, naam + ' zegt niet wat er wordt vastgesteld');
    assert.ok(h.nietZegt && h.nietZegt.length > 20,
      naam + ' zegt niet wat hij NIET zegt; een stempel dat overal ja zegt is niets waard');
    assert.ok(h.doorWie, naam + ' zegt niet wie hem zet');
  }
  assert.match(R.HERKOMST.gezien.nietZegt, /valideert niets inhoudelijk|belt geen bond/i,
    'RTG bellen het BIG-register niet en doen niet alsof -- dat hoort in de herkomst zelf te staan');
});

/* ---------- 2. de reeks ---------- */

test('5. een feit komt binnen als `zelf` en nooit hoger', () => {
  const { L } = huis();
  const r = feitje(L);
  assert.equal(r.status, 200);
  /* Op het moment van schrijven heeft niemand anders er iets van gezien. Een
     hogere herkomst kan alleen ontstaan doordat een ANDER hem toevoegt. */
  assert.equal(r.regel.herkomst, 'zelf');
  assert.equal(L.zet('ka', { kapitaal: 'vermogen', wat: 'x y z', op: GISTEREN, herkomst: 'gezien' })
    .regel.herkomst, 'zelf', 'het lid kan zijn eigen regel niet tot `gezien` verklaren');
});

test('6. een bevestiging gaat op naam, en `zelf` is geen bevestiging', () => {
  const { L } = huis();
  const f = feitje(L).regel.id;
  assert.equal(L.bevestig('ka', f, { herkomst: 'gezien', door: '' }).status, 403,
    'een bevestiging zonder naam is geen bevestiging -- een spoor dat eindigt bij een gedeelde code is een alibi');
  assert.equal(L.bevestig('ka', f, { herkomst: 'zelf', door: 'iemand' }).status, 400);
  assert.equal(L.bevestig('ka', 'clbestaatniet', { herkomst: 'gezien', door: 'M. de Vries' }).status, 404);
  assert.equal(L.bevestig('ka', f, { herkomst: 'gezien', door: 'M. de Vries (RTG)' }).status, 200);
});

test('7. intrekken wist niets en eist een reden', () => {
  const { db, L } = huis();
  const f = feitje(L).regel.id;
  assert.equal(L.intrek('ka', f, { reden: '' }).status, 400, 'een intrekking zonder reden laat de lezer raden');
  assert.equal(L.intrek('ka', f, { reden: 'verkeerd kapitaal gekozen' }).status, 200);

  const rs = db.data.carriereLedger.ka.regels;
  const oud = rs.find(r => r.id === f);
  assert.ok(oud, 'de oorspronkelijke regel is weg; een ledger dat kan wissen is een etalage');
  assert.equal(oud.ingetrokken, undefined,
    '`ingetrokken` staat OP de regel; dan is die regel herschreven en is de reeks een verslag');
  assert.equal(rs.filter(r => r.soort === 'intrekking').length, 1);
  assert.equal(L.mijn('ka').feiten[0].ingetrokken, true, 'bij het LEZEN hoort hij wel ingetrokken te heten');
});

test('8. de bevestigingen worden niet samengevat tot een sterkste herkomst', () => {
  const { L } = huis();
  const f = feitje(L).regel.id;
  L.bevestig('ka', f, { herkomst: 'gezien', door: 'M. de Vries (RTG)' });
  L.bevestig('ka', f, { herkomst: 'bevestigd', door: 'Atletiekunie (J. Bakker)' });
  const feit = L.mijn('ka').feiten[0];
  assert.equal(feit.bevestigingen.length, 2, 'twee bronnen zijn twee bevestigingen en geen hoogste');
  assert.deepEqual(feit.bevestigingen.map(b => b.herkomst), ['gezien', 'bevestigd']);
  for (const b of feit.bevestigingen) {
    assert.ok(b.stelt && b.nietZegt, 'elke bevestiging draagt haar eigen voorbehoud mee naar de lezer');
  }
  assert.equal(feit.herkomst, undefined, 'er hoort geen samengevatte herkomst op het feit te staan');
});

test('9. de enige orde is de tijd', () => {
  const { L } = huis();
  L.zet('ka', { kapitaal: 'publiek', wat: 'uitverkochte zaal', op: '2024-02-02' });
  L.zet('ka', { kapitaal: 'vermogen', wat: 'NK junior', op: '2022-01-01' });
  const f = L.zet('ka', { kapitaal: 'netwerk', wat: 'bij club X gaan spelen', op: '2023-03-03' }).regel.id;
  /* Drie bevestigingen op de MIDDELSTE: als er ergens op gewicht werd gesorteerd,
     zou die naar voren schuiven. */
  for (const wie of ['A (RTG)', 'B (RTG)', 'C (RTG)']) L.bevestig('ka', f, { herkomst: 'gezien', door: wie });
  assert.deepEqual(L.mijn('ka').feiten.map(x => x.op), ['2022-01-01', '2023-03-03', '2024-02-02']);
});

test('10. zeven voorraden met hun opbouw, en nergens een totaal', () => {
  const { L } = huis();
  feitje(L);
  const m = L.mijn('ka');
  assert.equal(m.voorraden.length, 7, 'de zeven kapitalen uit CARRIERE.md punt 30');
  for (const v of m.voorraden) {
    assert.ok(Array.isArray(v.regels), v.kapitaal + ' draagt geen opbouw');
    assert.ok(v.wat && v.wat.length > 10, v.kapitaal + ' zegt niet wat erin hoort');
    assert.equal(typeof v.aantal, 'undefined', 'een telling per kapitaal is de eerste stap naar een cijfer');
  }
  const vlak = JSON.stringify(m);
  assert.equal(/"(totaal|percentage|niveau|scoreOp)"/.test(vlak), false,
    'CARRIERE.md par. 4.1: geen samengesteld getal over een mens');
});

test('11. CAR-05: geen getal op een mens in het antwoord', () => {
  const { L } = huis();
  feitje(L);
  const m = L.mijn('ka');
  const fout = mensVrij(m.feiten.map(f => {
    const kaal = Object.assign({}, f); delete kaal.bevestigingen; return kaal;
  }), {});
  assert.deepEqual(fout, [], 'een getal op een carrierefeit is een maat op de mens erachter');
  assert.deepStrictEqual(grensScan([require('path').join(__dirname, '..', 'server', 'kern', 'carriereledger')]).gevonden, []);
});

test('12. een dubbelklik verdubbelt geen regel, en een correctie mag wel', () => {
  const { L } = huis();
  const eerste = feitje(L);
  assert.equal(eerste.status, 200);
  assert.equal(feitje(L).status, 409, 'de dubbeltik-ronde vond hier 0 -> 2; in een ledger blijft die tweede staan');
  assert.equal(L.mijn('ka').feiten.length, 1);

  /* Wijk ergens van af en het is een ander feit. */
  assert.equal(L.zet('ka', { kapitaal: 'vermogen', wat: 'Nederlands kampioen junior', op: '2024-06-14' }).status, 200);

  /* En een INGETROKKEN regel opnieuw zetten is een correctie en moet kunnen. */
  L.intrek('ka', eerste.regel.id, { reden: 'verkeerde dag' });
  assert.equal(feitje(L).status, 200, 'na intrekken is dezelfde regel opnieuw zetten een correctie');
});

test('13. een dubbele bevestiging is geen hardere bevestiging', () => {
  const { L } = huis();
  const f = feitje(L).regel.id;
  const een = { herkomst: 'gezien', door: 'M. de Vries (RTG)', wat: 'uitslagenlijst gezien' };
  assert.equal(L.bevestig('ka', f, een).status, 200);
  assert.equal(L.bevestig('ka', f, een).status, 409);
  assert.equal(L.bevestig('ka', f, Object.assign({}, een, { door: 'K. Jansen (RTG)' })).status, 200,
    'een andere medewerker is een andere bevestiging');
  assert.equal(L.mijn('ka').feiten[0].bevestigingen.length, 2);
});

/* ---------- 3. een regel bewijzen zonder het dossier te openen ---------- */

test('14. een deelcode toont EEN feit en nooit het ledger', () => {
  const { L } = huis();
  const f = feitje(L).regel.id;
  L.zet('ka', { kapitaal: 'netwerk', wat: 'iets anders dat niemand hoeft te zien', op: '2020-01-01' });
  L.bevestig('ka', f, { herkomst: 'gezien', door: 'M. de Vries (RTG)' });

  const d = L.deel('ka', f, { dagen: 7, voor: 'Sponsor X' });
  assert.equal(d.status, 200);
  const t = L.toon(d.code);
  assert.equal(t.status, 200);
  assert.equal(t.feit.wat, 'Nederlands kampioen junior');
  const vlak = JSON.stringify(t);
  assert.equal(vlak.includes('iets anders'), false, 'de ontvanger ziet een regel en niet het ledger');
  assert.equal(vlak.includes('kapitaal'), false,
    'ook het kapitaal blijft weg: een lege voorraad is zelf een mededeling over een mens');
  assert.ok(t.voorbehoud.length >= 3, 'wat dit NIET zegt hoort er even groot bij te staan');
});

test('15. de code zelf staat niet in de opslag', () => {
  const { db, L } = huis();
  const f = feitje(L).regel.id;
  const d = L.deel('ka', f, {});
  const opslag = JSON.stringify(db.data.carriereDelen);
  assert.equal(opslag.includes(d.code), false,
    'wie de opslag leest, kan er geen bewijs mee tonen; alleen de hash hoort er te staan');
  assert.equal(L.mijnDelen('ka').some(x => JSON.stringify(x).includes(d.code)), false,
    'de kale code gaat precies eenmaal de deur uit');
});

test('16. een ingetrokken feit wordt getoond als ingetrokken en verdwijnt niet stil', () => {
  const { L } = huis();
  const f = feitje(L).regel.id;
  const d = L.deel('ka', f, {});
  L.intrek('ka', f, { reden: 'bij nader inzien de verkeerde titel' });
  const t = L.toon(d.code);
  assert.equal(t.status, 200, 'stil op 404 gaan laat een sponsor aan een storing denken');
  assert.equal(t.feit.ingetrokken, true);
});

test('17. een gestopte code doet niets meer, en zegt waarom', () => {
  const { L } = huis();
  const f = feitje(L).regel.id;
  const d = L.deel('ka', f, {});
  const did = L.mijnDelen('ka')[0].id;
  assert.equal(L.stopDelen('ka', did).status, 200);
  assert.equal(L.stopDelen('ka', did).status, 409);
  const t = L.toon(d.code);
  assert.equal(t.status, 404);
  assert.equal(t.waarom, 'ingetrokken', 'een weigering zonder reden stuurt iemand op zoek');
  assert.equal(L.toon('RTGCL.ONZIN').status, 404);
});

test('18. een deelcode verloopt, en een jaar is het maximum', () => {
  const { db, L } = huis();
  const f = feitje(L).regel.id;
  L.deel('ka', f, { dagen: 4000 });
  const rij = db.data.carriereDelen[0];
  const dagen = (Date.parse(rij.expires_at) - Date.parse(rij.issued_at)) / 86400000;
  assert.ok(dagen <= 366, 'LINK.md: alles wat met een oude foto nog iets in gang kan zetten, hoort tijdelijk te zijn');
  assert.ok(dagen > 300);
});
