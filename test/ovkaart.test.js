/* De OV-kaartverkoop: een vervoerbewijs mag alleen bestaan als er een geldige
   overeenkomst met de vervoerder onder ligt. Draai los:
   node --experimental-sqlite --test test/ovkaart.test.js

   Wat deze toetsen bewaken:

   1. DRIE POORTEN, en alle drie moeten open: de module, de overeenkomst, en de
      lijn/het product dat erin staat. Dit is de belangrijkste: je kunt niet
      zelf besluiten dat jouw app een geldig treinkaartje uitgeeft, en die
      grens hoort in code te staan en niet in een voornemen.
   2. Een verlopen of ingetrokken overeenkomst sluit de verkoop meteen. De
      geldigheid wordt gerekend, niet bewaard.
   3. Een kaartje wordt opgebruikt bij de CONTROLE en nergens anders.
   4. Een kaartje van vervoerder A is niets waard bij vervoerder B, en een
      kaartje voor lijn 1 niet op de ferry.
   5. De teruggave bij een storing gebeurt EEN keer, door een mens die daar
      over gaat, en raakt alleen wie een kaartje had in dat venster. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, lidA, lidB, pda, baas, kantoor;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-kaart-'));
const OFFICE_CODE = 'KANTOOR-KAART-1';

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
let seq = 0;
async function lid() {
  const u = (Date.now() + (++seq)).toString().slice(-8);
  const reg = await api('/api/auth/register', { name: 'Reiziger ' + seq, email: 'kt' + u + '@x.nl',
    phone: '06' + u, password: 'geheim123', geboortedatum: '1990-05-05', geslacht: 'v',
    tier: 'rtg', pasApp: 'rtg' });
  return reg.body.token;
}
// de standaardovereenkomst waar de meeste toetsen op leunen
const CONTRACT = { vervoerder: 'TRANSIT', van: '2020-01-01', tot: '2099-12-31',
  producten: ['enkel', 'retour'], lijnen: ['L1'], getekendDoor: 'J. Directeur' };

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE } });
  base = srv.base;
  lidA = await lid(); lidB = await lid();
  const roster = await api('/api/supplier/roster', { code: 'TRANSIT' });
  const ch = (roster.body.staff || []).find(x => x.role !== 'manager');
  const mg = (roster.body.staff || []).find(x => x.role === 'manager');
  pda = (await api('/api/supplier/login', { code: 'TRANSIT', staffId: ch.id, pin: '5678' })).body.token;
  baas = (await api('/api/supplier/login', { code: 'TRANSIT', staffId: mg.id, pin: '1234' })).body.token;
  kantoor = (await api('/api/office/login', { code: OFFICE_CODE })).body.token;
  assert.ok(pda && baas && kantoor, 'chauffeur, manager en kantoor zijn ingelogd');
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. de module is de eerste poort: zonder kaartverkoop geen kaartje, met de reden erbij', async () => {
  const koop = await api('/api/mob/kaart/koop', { vervoerder: 'TRANSIT', lijnId: 'L1',
    van: 'h-stad', naar: 'h-tal', product: 'enkel', idem: 'p1' }, lidA);
  assert.equal(koop.status, 409, 'standaard staat de kaartverkoop uit');
  assert.equal(koop.body.module, 'public_transport_ticketing');
  assert.match(koop.body.error, /Partnercontracten staat uit/, 'en hij noemt de vereiste die ontbreekt');

  // het aanbod zwijgt niet, hij legt uit waarom hij leeg is
  const aanbod = await api('/api/mob/kaart/aanbod', { vervoerder: 'TRANSIT' }, lidA);
  assert.equal(aanbod.status, 200);
  assert.equal(aanbod.body.aanbod.length, 0);
  assert.match(aanbod.body.reden, /Partnercontracten/, 'een lege lijst zegt waarom hij leeg is');

  for (const m of ['partner_contracts', 'public_transport_ticketing'])
    assert.equal((await api('/api/office/mob/module/zet', { id: m, aan: true }, kantoor)).status, 200, m);
});

test('2. de overeenkomst is de tweede poort, en die kan RTG niet zelf omzeilen', async () => {
  // module aan, maar er is met niemand iets afgesproken
  const zonder = await api('/api/mob/kaart/koop', { vervoerder: 'TRANSIT', lijnId: 'L1',
    van: 'h-stad', naar: 'h-tal', product: 'enkel', idem: 'p2' }, lidA);
  assert.equal(zonder.status, 409);
  assert.match(zonder.body.error, /geen overeenkomst met deze vervoerder/);

  // een overeenkomst over een lijn die de vervoerder niet rijdt, is geen overeenkomst
  const lucht = await api('/api/office/mob/overeenkomst',
    Object.assign({}, CONTRACT, { lijnen: ['LIJN-X'] }), kantoor);
  assert.equal(lucht.status, 400);
  assert.match(lucht.body.error, /zelf rijdt/);

  // en zonder handtekening ook niet
  const ongetekend = await api('/api/office/mob/overeenkomst',
    Object.assign({}, CONTRACT, { getekendDoor: '' }), kantoor);
  assert.equal(ongetekend.status, 400);
  assert.match(ongetekend.body.error, /getekend/);

  const goed = await api('/api/office/mob/overeenkomst', CONTRACT, kantoor);
  assert.equal(goed.status, 200, goed.body.error || '');
  assert.equal(goed.body.overeenkomst.geldigNu, true);
});

test('3. een kaartje: prijs uit het lijntarief, op codenaam, met een code die niet te raden is', async () => {
  const r = await api('/api/mob/kaart/koop', { vervoerder: 'TRANSIT', lijnId: 'L1',
    van: 'h-stad', naar: 'h-tal', product: 'enkel', idem: 'k1' }, lidA);
  assert.equal(r.status, 200, r.body.error || '');
  const k = r.body.kaartje;
  assert.equal(k.lijnNaam, 'Kustlijn 1');
  assert.equal(k.van.naam, 'Ibiza-stad');
  assert.equal(k.naar.naam, 'Talamanca');
  assert.equal(k.stand, 'geldig');
  /* De prijs volgt het tarief van de lijn (basis 180 + 22 per km) en is dus
     dezelfde som als het uitchecken in RTG OV. Zou de kaartverkoop een eigen
     formule hebben, dan betaalt een reiziger aan de balie iets anders dan bij
     het uitstappen -- en dat merkt niemand tot een klant het narekent. */
  const verwacht = Math.round(180 + k.km * 22);
  assert.ok(Math.abs(k.prijs - verwacht) <= 1, 'prijs ' + k.prijs + ' volgt het lijntarief (' + verwacht + ')');
  assert.ok(k.code && k.code.length >= 12, 'de code is lang genoeg om niet te raden');
  assert.ok(!/Reiziger \d/.test(JSON.stringify(k)), 'er staat geen echte naam op het kaartje');
});

test('4. de overeenkomst bepaalt WAT er verkocht mag worden, niet de app', async () => {
  const dag = await api('/api/mob/kaart/koop', { vervoerder: 'TRANSIT', lijnId: 'L1',
    product: 'dagkaart', idem: 'k2' }, lidA);
  assert.equal(dag.status, 409, 'de dagkaart staat niet in de overeenkomst');
  assert.match(dag.body.error, /dekt geen dagkaart/);

  const ferry = await api('/api/mob/kaart/koop', { vervoerder: 'TRANSIT', lijnId: 'F1',
    van: 'f-ibz', naar: 'f-sav', product: 'enkel', idem: 'k3' }, lidA);
  assert.equal(ferry.status, 409, 'de ferry staat niet in de overeenkomst');
  assert.match(ferry.body.error, /dekt lijn F1 niet/);

  // en het aanbod toont precies wat er wel mag, niet meer
  const aanbod = await api('/api/mob/kaart/aanbod', { vervoerder: 'TRANSIT' }, lidA);
  assert.ok(aanbod.body.aanbod.length, 'er is nu wel aanbod');
  assert.ok(aanbod.body.aanbod.every(a => a.lijnId === 'L1'), 'alleen de gedekte lijn');
  assert.ok(aanbod.body.aanbod.every(a => ['enkel', 'retour'].includes(a.product)), 'alleen de gedekte producten');
});

test('5. de controle is de enige plek waar een kaartje opgaat', async () => {
  const r = await api('/api/mob/kaart/koop', { vervoerder: 'TRANSIT', lijnId: 'L1',
    van: 'h-stad', naar: 'h-mar', product: 'enkel', idem: 'k4' }, lidB);
  const code = r.body.kaartje.code;

  // eerst het verkeerde: een andere lijn, en een code die niet bestaat
  const anders = await api('/api/staff/mob/kaart/controle', { code, lijnId: 'F1' }, pda);
  assert.equal(anders.status, 409, 'een kaartje voor lijn 1 geldt niet op de ferry');
  assert.equal(anders.body.geldig, false);
  const onzin = await api('/api/staff/mob/kaart/controle', { code: 'BESTAATNIET' }, pda);
  assert.equal(onzin.status, 404);

  // die mislukte pogingen mogen het kaartje NIET hebben opgebruikt
  const goed = await api('/api/staff/mob/kaart/controle', { code, lijnId: 'L1' }, pda);
  assert.equal(goed.status, 200, goed.body.error || '');
  assert.equal(goed.body.geldig, true);
  assert.equal(goed.body.kaartje.stand, 'gebruikt', 'een enkeltje is na een rit op');

  const nogmaals = await api('/api/staff/mob/kaart/controle', { code, lijnId: 'L1' }, pda);
  assert.equal(nogmaals.status, 409, 'en gaat geen tweede keer');

  /* De conducteur ziet het bewijs, niet de persoon: geen e-mailadres, geen
     wallet, geen reisgeschiedenis. De codenaam staat er wel op, want anders
     kan hij twee reizigers met hetzelfde product niet uit elkaar houden. */
  assert.ok(goed.body.kaartje.codenaam, 'de codenaam staat erbij');
  const tekst = JSON.stringify(goed.body);
  assert.ok(!/@x\.nl/.test(tekst), 'geen e-mailadres in het controlescherm');
  assert.ok(!/saldo|wallet/i.test(tekst), 'en geen wallet');
});

test('6. een retour heeft twee ritten, en is goedkoper dan twee enkeltjes', async () => {
  const enkel = await api('/api/mob/kaart/koop', { vervoerder: 'TRANSIT', lijnId: 'L1',
    van: 'h-stad', naar: 'h-tal', product: 'enkel', idem: 'k5' }, lidA);
  const retour = await api('/api/mob/kaart/koop', { vervoerder: 'TRANSIT', lijnId: 'L1',
    van: 'h-stad', naar: 'h-tal', product: 'retour', idem: 'k6' }, lidA);
  assert.equal(retour.status, 200, retour.body.error || '');
  assert.equal(retour.body.kaartje.rittenOver, 2);
  assert.ok(retour.body.kaartje.prijs < enkel.body.kaartje.prijs * 2,
    'de terugweg heeft korting: ' + retour.body.kaartje.prijs + ' < 2x' + enkel.body.kaartje.prijs);

  const code = retour.body.kaartje.code;
  const een = await api('/api/staff/mob/kaart/controle', { code, lijnId: 'L1' }, pda);
  assert.equal(een.body.kaartje.rittenOver, 1, 'na de heenweg is er nog een rit over');
  const twee = await api('/api/staff/mob/kaart/controle', { code, lijnId: 'L1' }, pda);
  assert.equal(twee.body.kaartje.stand, 'gebruikt', 'na de terugweg is hij op');
  const drie = await api('/api/staff/mob/kaart/controle', { code, lijnId: 'L1' }, pda);
  assert.equal(drie.status, 409, 'en een derde rit zit er niet in');
});

test('7. de teruggave: een keer, door wie erover gaat, en alleen wie het raakte', async () => {
  const raakt = await api('/api/mob/kaart/koop', { vervoerder: 'TRANSIT', lijnId: 'L1',
    van: 'h-stad', naar: 'h-tal', product: 'enkel', idem: 'k7' }, lidB);
  assert.equal(raakt.status, 200, raakt.body.error || '');

  const van = new Date(Date.now() - 3600e3).toISOString();
  const tot = new Date(Date.now() + 3600e3).toISOString();
  const st = await api('/api/staff/mob/kaart/storing', { lijnId: 'L1', soort: 'vertraging',
    oorzaak: 'omleiding', van, tot }, pda);
  assert.equal(st.status, 200, st.body.error || '');

  // een venster dat niet klopt is geen storing
  const krom = await api('/api/staff/mob/kaart/storing', { lijnId: 'L1', soort: 'vertraging',
    van: tot, tot: van }, pda);
  assert.equal(krom.status, 400);

  // uitbetalen is geld verplaatsen: dat doet de manager, niet iedereen met een PDA
  const chauffeur = await api('/api/supplier/mob/kaart/teruggave', { id: st.body.storing.id }, pda);
  assert.equal(chauffeur.status, 403, 'de chauffeur betaalt niet uit');

  const uit = await api('/api/supplier/mob/kaart/teruggave', { id: st.body.storing.id }, baas);
  assert.equal(uit.status, 200, uit.body.error || '');
  assert.ok(uit.body.terugbetaald >= 1, 'er is minstens een reiziger terugbetaald');
  assert.equal(uit.body.deel, 0.5, 'bij vertraging de helft');
  assert.ok(uit.body.centen > 0);

  const weer = await api('/api/supplier/mob/kaart/teruggave', { id: st.body.storing.id }, baas);
  assert.equal(weer.status, 409, 'een storing wordt maar een keer verwerkt');

  // het kaartje draagt de teruggave, en de reiziger ziet hem
  const mijn = await api('/api/mob/kaart/mijn', {}, lidB);
  const vergoed = mijn.body.kaartjes.find(k => k.terugbetaald && k.terugbetaald.centen > 0);
  assert.ok(vergoed, 'de reiziger ziet zijn teruggave op het kaartje staan');

  /* EN HIJ MAG NOG STEEDS MEE. Bij een vertraging is de teruggave een
     vergoeding, geen ontbinding: de bus reed, alleen te laat. Hier stond eerst
     dat elke teruggave het kaartje afsloot, en dan pakt de compensatie voor een
     late bus zijn rit af -- precies andersom dan bedoeld. */
  assert.equal(vergoed.stand, 'geldig', 'een vergoeding voor vertraging kost je je rit niet');
  const rijdt = await api('/api/staff/mob/kaart/controle', { code: vergoed.code, lijnId: 'L1' }, pda);
  assert.equal(rijdt.status, 200, 'en de conducteur laat hem gewoon door: ' + (rijdt.body.error || ''));

  /* Bij UITVAL is het omgekeerd: die rit is niet gereden, het geld is helemaal
     terug, en het kaartje vervalt. */
  const nieuw = await api('/api/mob/kaart/koop', { vervoerder: 'TRANSIT', lijnId: 'L1',
    van: 'h-stad', naar: 'h-tal', product: 'enkel', idem: 'k7b' }, lidB);
  assert.equal(nieuw.status, 200, nieuw.body.error || '');
  const st2 = await api('/api/staff/mob/kaart/storing', { lijnId: 'L1', soort: 'uitval',
    oorzaak: 'geen chauffeur', van, tot }, pda);
  const uit2 = await api('/api/supplier/mob/kaart/teruggave', { id: st2.body.storing.id }, baas);
  assert.equal(uit2.status, 200, uit2.body.error || '');
  assert.equal(uit2.body.deel, 1, 'bij uitval alles terug');
  const naUitval = await api('/api/staff/mob/kaart/controle', { code: nieuw.body.kaartje.code, lijnId: 'L1' }, pda);
  assert.equal(naUitval.status, 409, 'een volledig terugbetaald kaartje is geen vervoerbewijs meer');
  assert.match(naUitval.body.error, /uitgevallen/);
});

test('8. een verlopen of ingetrokken overeenkomst sluit de verkoop meteen', async () => {
  /* Eerst een VERS kaartje kopen, want de bewering hieronder gaat over een
     kaartje dat is gekocht toen het nog mocht. Leunen op een kaartje uit een
     eerdere toets zou hem laten afhangen van wat die toets ermee deed -- en dat
     is hier ook echt misgegaan: de storingsronde van toets 7 had ze allemaal
     terugbetaald. */
  const voor = await api('/api/mob/kaart/koop', { vervoerder: 'TRANSIT', lijnId: 'L1',
    van: 'h-stad', naar: 'h-mar', product: 'enkel', idem: 'k8a' }, lidA);
  assert.equal(voor.status, 200, voor.body.error || '');
  assert.equal(voor.body.kaartje.stand, 'geldig');

  const lijst = await api('/api/office/mob/overeenkomst', { lijst: true, vervoerder: 'TRANSIT' }, kantoor);
  const o = lijst.body.overeenkomsten.find(x => x.geldigNu);
  assert.ok(o, 'er is een geldige overeenkomst');

  const in1 = await api('/api/office/mob/overeenkomst', { id: o.id, intrekken: true, reden: 'opgezegd' }, kantoor);
  assert.equal(in1.status, 200, in1.body.error || '');
  assert.equal(in1.body.overeenkomst.geldigNu, false);

  const na = await api('/api/mob/kaart/koop', { vervoerder: 'TRANSIT', lijnId: 'L1',
    van: 'h-stad', naar: 'h-tal', product: 'enkel', idem: 'k8' }, lidA);
  assert.equal(na.status, 409, 'na het intrekken kan er niets meer verkocht worden');
  assert.match(na.body.error, /ingetrokken/);

  /* En het AL VERKOCHTE kaartje blijft geldig. Dat is geen slordigheid maar het
     punt: de reiziger heeft betaald toen het mocht, en het opzeggen van een
     contract tussen twee bedrijven is geen reden om zijn rit af te pakken. */
  const mijn = await api('/api/mob/kaart/mijn', {}, lidA);
  const mijnKaart = mijn.body.kaartjes.find(k => k.code === voor.body.kaartje.code);
  assert.ok(mijnKaart, 'het kaartje staat nog in de app');
  assert.equal(mijnKaart.stand, 'geldig', 'en is nog steeds geldig na het intrekken');
  const rijdt = await api('/api/staff/mob/kaart/controle', { code: mijnKaart.code, lijnId: 'L1' }, pda);
  assert.equal(rijdt.status, 200, 'de conducteur laat hem gewoon door: ' + (rijdt.body.error || ''));

  // een overeenkomst die pas volgend jaar begint, verkoopt vandaag niets
  const later = await api('/api/office/mob/overeenkomst',
    Object.assign({}, CONTRACT, { van: '2099-01-01', tot: '2099-12-31' }), kantoor);
  assert.equal(later.status, 200);
  assert.equal(later.body.overeenkomst.geldigNu, false);
  const nog = await api('/api/mob/kaart/koop', { vervoerder: 'TRANSIT', lijnId: 'L1',
    van: 'h-stad', naar: 'h-tal', product: 'enkel', idem: 'k9' }, lidA);
  assert.equal(nog.status, 409);
  assert.match(nog.body.error, /begint pas op 2099-01-01/);
});

test('9. de deuren: een gast koopt niets, een lid controleert niets, een vreemde zaak evenmin', async () => {
  const gast = (await api('/api/login', { tier: 'guest' })).body.token;
  for (const pad of ['/api/mob/kaart/koop', '/api/mob/kaart/mijn', '/api/mob/kaart/aanbod'])
    assert.equal((await api(pad, { vervoerder: 'TRANSIT' }, gast)).status, 403, pad + ' is dicht voor gasten');

  assert.ok([401, 403].includes((await api('/api/staff/mob/kaart/controle', { code: 'X' }, lidA)).status),
    'een ledentoken controleert geen kaartjes');
  assert.ok([401, 403].includes((await api('/api/office/mob/overeenkomst', {}, baas)).status),
    'een vervoerder schrijft zijn eigen overeenkomst niet');

  // een taxizaak is geen OV-vervoerder en komt niet bij de kaartfuncties
  const roster = await api('/api/supplier/roster', { code: 'MKKX' });
  const m = roster.body.staff.find(x => x.role === 'manager');
  const taxi = (await api('/api/supplier/login', { code: 'MKKX', staffId: m.id, pin: '1234' })).body.token;
  assert.equal((await api('/api/staff/mob/kaart/controle', { code: 'X' }, taxi)).status, 409,
    'kaartcontrole hoort bij een OV-vervoerder');
});
