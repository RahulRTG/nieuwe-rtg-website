/* NEGENTIEN ZAKELIJKE INGANGEN DIE DOOR GEEN ENKELE TOETS WERDEN AANGEROEPEN.
   Draai los: node --experimental-sqlite --test test/supplier-comm-mob-payroll.test.js

   Ze staan in vier bestanden, ze zitten alle vier in de zaak-app, en de suite
   kwam er nooit langs:

     routes/supplier/comm.js      inbox, gesprek, stuur, lees, typt, zoek, collega
     routes/supplier/handel.js    handel/intrekken
     routes/mobiliteit/werkkant   mob/telefoon, overboeken, plekken, pendel, pendel/noshow
     routes/payroll-os-zaak.js    payroll/runs, bevindingen, contracten,
                                  verzuim/planning, identiteit, identiteit/opvraag

   WAT "ONGETOETST" HIER BETEKENT. Niet "misschien stuk", maar ONBEWAAKT. Elk van
   deze paden draagt een grens die je niet ziet als hij wegvalt: een collega-DM
   waar de hele zaaksleutel in mag meelezen, een loonrun die uit de code van een
   ander bedrijf komt, een ziekmelding die "ziek" gaat zeggen in plaats van
   "afwezig", een aanvraag die de leverancier zelf kan intrekken. Dat wordt geen
   foutmelding maar een stille verkeerde uitkomst -- en er was niets dat kon
   zakken.

   DAAROM PINGT DEZE TOETS NIET. Elke aanroep hieronder draagt of de vorm van het
   antwoord, of de poort die dichtgaat, of de foutmelding bij verkeerde invoer,
   of het gevolg van een schrijfactie dat daarna wordt teruggelezen -- LAT.md
   regel 9: een toets die niet kan zakken is erger dan geen toets. De volgorde is
   de weg van een echt bedrijf: eerst iemand aannemen, dan met hem praten, dan
   inkopen, vervoeren, zijn identiteit, zijn verzuim en zijn loon.

   DE CAST, en waarom juist deze:
     MERIDIAAN  Meridiaan Toren, de NL-zaak. Een loonrun vraagt het regelpakket
                van het LAND van de zaak, en er ligt alleen een NL-jaargang; de
                Spaanse demo-zaken kunnen dus geen run draaien, en dat hoort ook.
     KIKUNOI    Sal de Mar. Het tweede paar ogen: alles wat "alleen de eigen
                zaak" heet, wordt hier gemeten en niet beweerd.
     MKKX       Ibiza Executive Cars, de taxicentrale die de dispatch doet.
     TRANSIT    de vervoerder waar een rit naartoe wordt overgeboekt.
     LAVANDA    de wasserij die op de inkoopaanvraag offreert.
     Nova Bakker  een nieuwe medewerker die de hele weg aflegt: uitnodiging ->
                eigen RTG-account -> dienstverband -> identiteit -> contract ->
                verzuim -> loonrun. Zij verbindt de vier domeinen; zonder een
                mens met een echt dienstverband is de halve payroll-kant niet te
                bereiken.

   Mutaties die deze toets horen te laten zakken: haal de eigendomstoets uit
   /api/supplier/payroll/bevindingen (dan leest de buurzaak mee), zet de
   zaaksleutel in het collega-gesprek (dan leest het team mee), laat
   voorPlanning() de soort "ziek" teruggeven, of geef intrekken aan de
   leverancier. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { startServer, stop } = require('./helper');

const ZAAK = 'MERIDIAAN';     // Meridiaan Toren -- NL, dus hier kan loon draaien
const ANDERE = 'KIKUNOI';     // Sal de Mar -- het tweede paar ogen
const TAXI = 'MKKX';          // Ibiza Executive Cars -- de dispatch
const PARTNER = 'TRANSIT';    // de vervoerder waar naartoe wordt overgeboekt
const WASSERIJ = 'LAVANDA';
const KANTOOR = 'KANTOOR-SUPPLIER-19';
const PERIODE = '2026-04';

/* Een echte 1x1 PNG. De verificatieroute eist een afbeelding met een geldige
   magic (en de Ontsmetter kijkt mee), dus een verzonnen base64-string komt er
   niet langs. */
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJ' +
  'AAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-supplier19-'));
let srv, base;
let baas, receptie, security;          // MERIDIAAN: manager, receptie, security
let kikBaas, taxiBaas, taxiPda, wasBaas, kantoor;
let novaLid, novaTok, novaStaff;       // de nieuwe medewerker: lid, PDA, nummer
let kikStaffId;                        // iemand die NIET bij ons werkt

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
// het rooster is openbaar (het inlogscherm heeft het nodig); de PINs staan in de seed
async function inlog(code, rol, pin) {
  const r = await api('/api/supplier/roster', { code });
  const lijst = r.body.staff || [];
  const s = rol === 'manager' ? lijst.find(x => x.role === 'manager')
    : lijst.filter(x => x.role !== 'manager')[rol];
  assert.ok(s, 'de seed hoort bij ' + code + ' een ' + rol + ' te kennen');
  const l = await api('/api/supplier/login', { code, staffId: s.id, pin });
  assert.ok(l.body.token, 'inloggen bij ' + code + ' als ' + s.name + ': ' + (l.body.error || ''));
  return { token: l.body.token, id: s.id, naam: s.name };
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE: KANTOOR } });
  base = srv.base;

  baas = await inlog(ZAAK, 'manager', '1234');
  receptie = await inlog(ZAAK, 0, '5678');
  security = await inlog(ZAAK, 1, '5678');
  kikBaas = await inlog(ANDERE, 'manager', '1234');
  const kikStaff = await inlog(ANDERE, 0, '5678');
  kikStaffId = kikStaff.id;
  taxiBaas = await inlog(TAXI, 'manager', '1234');
  taxiPda = (await inlog(TAXI, 0, '5678')).token;
  wasBaas = (await inlog(WASSERIJ, 'manager', '1234')).token;

  const k = await api('/api/office/login', { code: KANTOOR });
  kantoor = k.body.token;
  assert.ok(kantoor, 'kantoorsessie: ' + JSON.stringify(k.body).slice(0, 120));

  /* Nova komt binnen zoals iedereen binnenkomt: de manager nodigt uit, zij maakt
     haar eigen RTG-account en verbindt zichzelf met de kassacode. Haar
     personeelsnummer en pincode komen dus uit die weg en niet uit de seed --
     alles hieronder over contracten, verzuim en identiteit hangt eraan. */
  const inv = await api('/api/supplier/staff/invite',
    { name: 'Nova Bakker', role: 'staff', func: 'Receptie' }, baas.token);
  assert.equal(inv.status, 200, 'uitnodiging: ' + JSON.stringify(inv.body).slice(0, 160));
  const reg = await api('/api/auth/register', { name: 'Nova Bakker', email: 'nova@rtg.example',
    phone: '0612349001', password: 'geheim123', geboortedatum: '1994-02-02', geslacht: 'v',
    tier: 'rtg', pasApp: 'rtg' });
  novaLid = reg.body.token;
  assert.ok(novaLid, 'Nova heeft een eigen RTG-account');
  const verb = await api('/api/werving/verbind', { kassacode: inv.body.invite.kassacode }, novaLid);
  assert.equal(verb.status, 200, 'verbinden: ' + JSON.stringify(verb.body).slice(0, 160));
  novaStaff = verb.body.staffId;
  const pda = await api('/api/supplier/login', { code: ZAAK, staffId: novaStaff, pin: verb.body.pin });
  novaTok = pda.body.token;
  assert.ok(novaTok, 'Nova kan met haar eigen pincode op de vloer inloggen');
});

test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { /* al weg */ }
});

/* ================= 1. het communicatieplatform, zakelijke deur ================= */

/* EEN COLLEGA-DM IS VAN TWEE MENSEN EN NIET VAN HET BEDRIJF. Iedereen met een
   zaaklogin draagt de zaaksleutel in zijn sessie; zou die ook in dit gesprek
   staan, dan las de halve ploeg mee. Vandaar dat er hier een DERDE collega bij
   staat: zonder hem meet "het werkt" alleen dat de deur opengaat. */
test('1. een collega-gesprek: het werkt, en het blijft bij de twee die het voeren', async () => {
  const onbekend = await api('/api/supplier/comm/collega', { staffId: 99999 }, baas.token);
  assert.equal(onbekend.status, 400);
  assert.match(onbekend.body.error, /niet gevonden/i, 'een verzonnen nummer hoort niets op te leveren');
  const vreemd = await api('/api/supplier/comm/collega', { staffId: kikStaffId }, baas.token);
  assert.equal(vreemd.status, 400, 'personeel van een andere zaak is geen collega');
  assert.match(vreemd.body.error, /niet gevonden/i,
    'en de foutmelding verraadt niet dat dat nummer elders wel bestaat');
  const zelf = await api('/api/supplier/comm/collega', { staffId: baas.id }, baas.token);
  assert.equal(zelf.status, 400);
  assert.match(zelf.body.error, /uzelf/i);

  const begin = await api('/api/supplier/comm/collega', { staffId: receptie.id }, baas.token);
  assert.equal(begin.status, 200, begin.body.error || '');
  const id = begin.body.gesprek.id;
  assert.equal(begin.body.gesprek.titel, receptie.naam, 'het gesprek heet naar de ander');
  assert.deepEqual(begin.body.gesprek.berichten, [], 'en begint leeg');

  const stuur = await api('/api/supplier/comm/stuur',
    { id, tekst: 'Kun jij morgen de vroege dienst draaien?' }, baas.token);
  assert.equal(stuur.status, 200, stuur.body.error || '');

  const bijB = await api('/api/supplier/comm/gesprek', { id }, receptie.token);
  assert.equal(bijB.status, 200, bijB.body.error || '');
  assert.equal(bijB.body.gedeeld, false, 'een collega-DM is geen gedeelde zaakinbox');
  assert.equal(bijB.body.alsWie, 'mens:' + ZAAK + ':' + receptie.id,
    'zij komt binnen als persoon, niet als zaak');
  assert.equal(bijB.body.gesprek.berichten.length, 1);
  assert.equal(bijB.body.gesprek.berichten[0].tekst, 'Kun jij morgen de vroege dienst draaien?');
  assert.equal(bijB.body.gesprek.berichten[0].door, null,
    'in een eigen gesprek is de afzender de persoon zelf; een tweede naam zou ruis zijn');

  // de derde collega: dezelfde zaak, dezelfde sessievorm, en toch buiten
  const bijC = await api('/api/supplier/comm/gesprek', { id }, security.token);
  assert.equal(bijC.status, 400, 'een collega van dezelfde zaak las mee in een onderling gesprek');
  assert.match(bijC.body.error, /niet van jou/i);
  const zoekC = await api('/api/supplier/comm/zoek', { vraag: 'vroege dienst' }, security.token);
  assert.equal(zoekC.status, 200, zoekC.body.error || '');
  assert.deepEqual(zoekC.body.treffers, [], 'en hij kon er ook niet naar zoeken');

  const weg = await api('/api/supplier/comm/gesprek', { id: 'gsp_bestaatniet' }, baas.token);
  assert.equal(weg.status, 400);
  assert.match(weg.body.error, /bestaat niet/i,
    'een onbekend gesprek is iets anders dan een gesprek van een ander');
});

/* De teller, het typen en het zoeken zijn de drie dingen waar een berichtenapp
   op afgerekend wordt, en ze zijn alle drie alleen zichtbaar aan de ANDERE kant.
   Daarom staat elke handeling hier naast een terugleesactie van de tegenpartij. */
test('2. lezen, typen en zoeken hebben elk een gevolg aan de andere kant', async () => {
  const inbox = await api('/api/supplier/comm/inbox', {}, receptie.token);
  assert.equal(inbox.status, 200, inbox.body.error || '');
  const rij = (inbox.body.gesprekken || []).find(g => g.titel === baas.naam);
  assert.ok(rij, 'het gesprek met de manager staat in haar inbox');
  assert.equal(rij.ongelezen, 1, 'en het bericht van zojuist staat als ongelezen');
  assert.equal(rij.gedeeld, false);
  assert.equal(rij.open.soort, 'collega', 'de lijst zegt zelf welke deur erbij hoort');
  assert.equal(rij.open.staffId, baas.id, 'en wijst de juiste collega aan');
  assert.equal(inbox.body.ongelezen, 1, 'de teller boven de lijst telt hetzelfde');
  assert.ok((inbox.body.laden || []).some(l => l.id === 'mensen'), 'met de laden erbij');
  const id = rij.id;

  const typt = await api('/api/supplier/comm/typt', { id }, baas.token);
  assert.equal(typt.status, 200, typt.body.error || '');
  const ziet = await api('/api/supplier/comm/gesprek', { id }, receptie.token);
  assert.deepEqual(ziet.body.gesprek.typt, [baas.naam],
    'wie typt, verschijnt bij de ander -- en niet bij zichzelf');
  const bijMij = await api('/api/supplier/comm/gesprek', { id }, baas.token);
  assert.deepEqual(bijMij.body.gesprek.typt, [], 'de typer ziet zichzelf niet typen');

  const lees = await api('/api/supplier/comm/lees', { id }, receptie.token);
  assert.equal(lees.status, 200, lees.body.error || '');
  assert.ok(lees.body.stand.gelezen, 'de leesstand draagt een tijdstip');
  const na = await api('/api/supplier/comm/inbox', {}, receptie.token);
  const naRij = na.body.gesprekken.find(g => g.id === id);
  assert.equal(naRij.ongelezen, 0, 'na het melden staat de teller op nul');
  assert.equal(na.body.ongelezen, 0);

  const zoek = await api('/api/supplier/comm/zoek', { vraag: 'vroege dienst' }, baas.token);
  assert.equal(zoek.status, 200, zoek.body.error || '');
  assert.equal(zoek.body.treffers.length, 1, 'de zoekvraag vindt het bericht');
  assert.equal(zoek.body.treffers[0].gesprekId, id);
  assert.match(zoek.body.treffers[0].tekst, /vroege dienst/);
  assert.equal(zoek.body.vraag, 'vroege dienst', 'en het antwoord zegt waarop gezocht is');
  const niets = await api('/api/supplier/comm/zoek', { vraag: 'kerstborrel' }, baas.token);
  assert.deepEqual(niets.body.treffers, [], 'een woord dat nergens staat levert niets op');
});

/* DE GEDEELDE ZAAKINBOX is het spiegelbeeld van hierboven: wat een klant
   schrijft is van het BEDRIJF (iedereen met een zaaklogin hoort te kunnen
   helpen), maar wie het antwoord typte staat er wel bij. Die twee tegelijk zijn
   de hele reden dat er twee sleutels bestaan. */
test('3. de gedeelde inbox: het gesprek is van de zaak, de naam van wie typte staat erbij', async () => {
  const lid = await api('/api/login', { tier: 'rtg', pasApp: 'rtg' });
  assert.ok(lid.body.token, 'demo-inlog (staat RTG_DEMO=1 aan?)');
  const gast = await api('/api/partner/chat/send',
    { supplierCode: ZAAK, dept: 'Team', text: 'Staat de vergaderzaal klaar?' }, lid.body.token);
  assert.equal(gast.status, 200, gast.body.error || '');

  const inbox = await api('/api/supplier/comm/inbox', {}, baas.token);
  const rij = (inbox.body.gesprekken || []).find(g => g.gedeeld);
  assert.ok(rij, 'het gastgesprek staat in dezelfde ene lijst als de collega-DM');
  assert.equal(rij.alsWie, 'zaak:' + ZAAK, 'en het is van de zaak, niet van de manager');
  assert.equal(rij.open.soort, 'gast', 'de lijst zegt welke draad het is');
  assert.equal(rij.open.dept, 'Team');
  assert.equal(rij.ongelezen, 1);

  const antwoord = await api('/api/supplier/comm/stuur',
    { id: rij.id, tekst: 'De zaal staat klaar, koffie om tien uur.' }, baas.token);
  assert.equal(antwoord.status, 200, antwoord.body.error || '');
  const leeg = await api('/api/supplier/comm/stuur', { id: rij.id, tekst: '   ' }, baas.token);
  assert.equal(leeg.status, 400, 'een leeg bericht is geen bericht');

  /* De collega die NIET in de collega-DM zat, hoort deze wel te zien: dit is de
     inbox van het bedrijf. En hij ziet de hele naam van wie het typte, want
     binnen de zaak werk je met elkaar. */
  const bijC = await api('/api/supplier/comm/gesprek', { id: rij.id }, security.token);
  assert.equal(bijC.status, 200, bijC.body.error || '');
  assert.equal(bijC.body.gedeeld, true);
  assert.equal(bijC.body.alsWie, 'zaak:' + ZAAK);
  const mijn = bijC.body.gesprek.berichten.find(m => /koffie om tien uur/.test(m.tekst || ''));
  assert.ok(mijn, 'de collega ziet het antwoord van de zaak');
  assert.equal(mijn.door, baas.naam, 'met de naam van wie het typte -- binnen het team volledig');

  const klant = await api('/api/partner/chat/history', { supplierCode: ZAAK, dept: 'Team' }, lid.body.token);
  assert.equal(klant.status, 200, klant.body.error || '');
  const bijKlant = (klant.body.messages || []).find(m => m.from === 'partner');
  assert.ok(bijKlant, 'en de klant krijgt het antwoord echt te zien');
  assert.equal(bijKlant.text, 'De zaal staat klaar, koffie om tien uur.');

  const kik = await api('/api/supplier/comm/gesprek', { id: rij.id }, kikBaas.token);
  assert.equal(kik.status, 400, 'een andere zaak kwam in de gedeelde inbox van deze zaak');
  assert.match(kik.body.error, /niet van jou/i);
});

test('4. zonder leverancierssessie gaat elke deur van het platform dicht', async () => {
  const dicht = [];
  for (const pad of ['/api/supplier/comm/inbox', '/api/supplier/comm/gesprek',
    '/api/supplier/comm/stuur', '/api/supplier/comm/lees', '/api/supplier/comm/typt',
    '/api/supplier/comm/zoek', '/api/supplier/comm/collega']) {
    const r = await api(pad, { id: 'gsp_x', tekst: 'hallo', vraag: 'hallo', staffId: receptie.id });
    dicht.push(pad + ':' + r.status);
  }
  assert.deepEqual(dicht, [
    '/api/supplier/comm/inbox:401', '/api/supplier/comm/gesprek:401',
    '/api/supplier/comm/stuur:401', '/api/supplier/comm/lees:401',
    '/api/supplier/comm/typt:401', '/api/supplier/comm/zoek:401',
    '/api/supplier/comm/collega:401'
  ], 'een van de deuren stond zonder inlog open');
});

/* ================= 2. de handelsketen ================= */

/* INTREKKEN IS VAN DE KOPER, EN VAN ZIJN BEHEER. Twee verschillende nee's, en de
   keten geeft ze bewust met verschillende codes: 403 "niet aan jou" tegenover
   409 "kan niet in deze stand". Wie die twee gelijktrekt, laat een leverancier
   de aanvraag van zijn concurrent opruimen. */
test('5. een inkoopaanvraag intrekken is aan de koper, en aan zijn beheer', async () => {
  const aan = await api('/api/supplier/handel/aanvraag', { genre: 'wasserij',
    titel: 'Handdoeken voor de fitnessvloer',
    regels: [{ wat: 'handdoeken', aantal: 300, eenheid: 'stuk' }] }, baas.token);
  assert.equal(aan.status, 200, JSON.stringify(aan.body).slice(0, 160));
  const id = aan.body.handel.id;
  const off = await api('/api/supplier/handel/offreren', { id, prijs: 190 }, wasBaas);
  assert.equal(off.status, 200, JSON.stringify(off.body).slice(0, 160));

  const doorLeverancier = await api('/api/supplier/handel/intrekken', { id }, wasBaas);
  assert.equal(doorLeverancier.status, 403, 'de leverancier trok de aanvraag van de koper in');
  assert.match(doorLeverancier.body.error, /aan de koper/i);
  const doorReceptie = await api('/api/supplier/handel/intrekken', { id }, receptie.token);
  assert.equal(doorReceptie.status, 403, 'intrekken bindt de zaak; dat is beheer');
  assert.match(doorReceptie.body.error, /manager/i);
  const onbekend = await api('/api/supplier/handel/intrekken', { id: 'hbestaatniet' }, baas.token);
  assert.equal(onbekend.status, 404);

  const uit = await api('/api/supplier/handel/intrekken', { id }, baas.token);
  assert.equal(uit.status, 200, JSON.stringify(uit.body).slice(0, 160));
  assert.equal(uit.body.handel.status, 'ingetrokken');
  assert.deepEqual(uit.body.handel.mag, [], 'een ingetrokken aanvraag kent geen volgende stap meer');

  // en dat is echt gebeurd: bij de wasserij ligt geen open werk meer
  const bijWas = await api('/api/supplier/handel/mijn', {}, wasBaas);
  assert.equal(bijWas.status, 200);
  assert.ok(!(bijWas.body.open || []).some(h => h.id === id),
    'de ingetrokken aanvraag stond nog als open werk bij de wasserij');
  const gunnen = await api('/api/supplier/handel/gunnen',
    { id, offerteId: off.body.handel.offertes[0].id }, baas.token);
  assert.equal(gunnen.status, 409, 'en er kan niets meer aan gegund worden');
  const nogmaals = await api('/api/supplier/handel/intrekken', { id }, baas.token);
  assert.equal(nogmaals.status, 409, 'twee keer intrekken is geen tweede intrekking');
});

/* ================= 3. mobility: dispatch en pendel ================= */

/* De bestemmingenlijst van de DISPATCHER. Hij tikt geen adres in maar kiest een
   van onze eigen zaken -- en juist daarom mag er niets van een lid in zitten:
   er is geen sessie, dus ook geen favorieten. */
test('6. de plekkenlijst van de dispatcher: onze eigen zaken, zonder iemands favorieten', async () => {
  const zoek = await api('/api/supplier/mob/plekken', { zoek: 'Sal de Mar' }, taxiBaas.token);
  assert.equal(zoek.status, 200, zoek.body.error || '');
  assert.equal(zoek.body.plekken.length, 1, 'op deze naam hoort er precies een te staan');
  const sal = zoek.body.plekken[0];
  assert.equal(sal.soort, 'zaak');
  assert.equal(sal.code, ANDERE);
  assert.equal(sal.genre, 'restaurant');
  assert.ok(Number.isFinite(sal.afstandM), 'met de afstand vanaf de standplaats erbij');
  assert.ok(!zoek.body.plekken.some(p => p.soort === 'favoriet'),
    'favorieten zijn van het lid en horen niet in een dispatchlijst');
  assert.ok((zoek.body.genres || []).includes('restaurant'),
    'de lijst noemt zelf de genres die er echt zijn, zodat de app niet hoeft te raden');

  const genre = await api('/api/supplier/mob/plekken', { genre: 'restaurant', limiet: 10 }, taxiBaas.token);
  assert.ok(genre.body.plekken.length > 0, 'het genrefilter levert wel iets op');
  assert.ok(genre.body.plekken.every(p => p.genre === 'restaurant'),
    'en levert alleen dat genre: ' + genre.body.plekken.map(p => p.genre).join(','));
  assert.equal(genre.body.plekken.length, Math.min(10, genre.body.totaal),
    'de limiet wordt gerespecteerd en het totaal staat er eerlijk bij');

  const niets = await api('/api/supplier/mob/plekken', { zoek: 'zzzbestaatniet' }, taxiBaas.token);
  assert.equal(niets.body.totaal, 0, 'en een zoekterm die nergens op slaat levert niets');
  assert.deepEqual(niets.body.plekken, []);
});

/* EEN TELEFONISCHE BOEKING EN EEN OVERBOEKING zijn de twee handelingen waarmee
   een dispatcher andermans rit aanraakt. De rit blijft daarbij DEZELFDE rit --
   zelfde ref, zelfde reiziger -- want een kopie zou twee ritten opleveren
   waarvan er een stil blijft hangen. */
test('7. de dispatcher boekt telefonisch, en boekt die rit daarna over', async () => {
  const rit = { ritsoort: 'direct', categorie: 'taxi', van: { lat: 38.908, lng: 1.432 },
    naar: { zaak: ANDERE }, stad: 'Ibiza' };
  const zonderNaam = await api('/api/supplier/mob/telefoon', rit, taxiBaas.token);
  assert.equal(zonderNaam.status, 400, 'een rit zonder naam is voor niemand terug te vinden');
  assert.match(zonderNaam.body.error, /naam/i);

  const tel = await api('/api/supplier/mob/telefoon',
    Object.assign({ naamOpDeRit: 'Mw. Bosch', telefoon: '0612345678' }, rit), taxiBaas.token);
  assert.equal(tel.status, 200, tel.body.error || '');
  const ref = tel.body.opdracht.ref;
  assert.equal(tel.body.opdracht.vervoerder, TAXI, 'de rit staat meteen op de eigen zaak');
  assert.equal(tel.body.opdracht.geboektDoor, 'dispatcher');
  assert.equal(tel.body.opdracht.reizigerCodenaam, 'Mw. Bosch', 'onder de naam die de dispatcher noteerde');
  assert.equal(tel.body.opdracht.naar.zaak, ANDERE, 'en met de gekozen zaak als bestemming');

  const eigen = await api('/api/supplier/mob/dispatch', {}, taxiBaas.token);
  assert.ok((eigen.body.open || []).concat(eigen.body.lopend || []).some(o => o.ref === ref),
    'de telefonische rit staat op het eigen dispatchbord');

  const doorChauffeur = await api('/api/supplier/mob/overboeken', { ref, naar: PARTNER }, taxiPda);
  assert.equal(doorChauffeur.status, 403, 'overboeken is beheer, geen handeling van de vloer');
  const onbekendeRit = await api('/api/supplier/mob/overboeken',
    { ref: 'RTG-M-BESTAATNIET', naar: PARTNER }, taxiBaas.token);
  assert.equal(onbekendeRit.status, 404);
  const onbekendePartner = await api('/api/supplier/mob/overboeken',
    { ref, naar: 'GEENVERVOERDER' }, taxiBaas.token);
  assert.equal(onbekendePartner.status, 404);
  assert.match(onbekendePartner.body.error, /partnervervoerder/i);

  const over = await api('/api/supplier/mob/overboeken', { ref, naar: PARTNER }, taxiBaas.token);
  assert.equal(over.status, 200, over.body.error || '');
  assert.equal(over.body.opdracht.ref, ref, 'het is dezelfde rit gebleven, geen kopie');
  assert.equal(over.body.opdracht.vervoerder, PARTNER);
  assert.equal(over.body.opdracht.voertuig, null, 'en de wagen van de oude vervoerder is losgelaten');

  const na = await api('/api/supplier/mob/dispatch', {}, taxiBaas.token);
  assert.ok(!(na.body.open || []).concat(na.body.lopend || []).some(o => o.ref === ref),
    'de overgeboekte rit hangt nog bij de oude vervoerder op het bord');
  const spoor = await api('/api/supplier/mob/spoor', { ref }, taxiBaas.token);
  assert.equal(spoor.status, 200, 'de oude vervoerder mag zijn eigen spoor blijven lezen');
  assert.deepEqual((spoor.body.overgeboekt || []).map(x => [x.van, x.naar]), [[TAXI, PARTNER]],
    'en de overboeking staat als gebeurtenis vast');
  assert.equal(spoor.body.overgeboekt[0].door, taxiBaas.naam, 'op naam van wie hem zette');
});

/* DE BEDRIJFSPENDEL. Een no-show wordt GETELD, want anders kan een planner de
   capaciteit niet bijstellen -- maar er hangt geen boete, geen score en geen
   blokkade aan. Dat de teller ook terug kan, hoort daarbij: een strafblad kun je
   niet corrigeren, een telling wel. */
test('8. de pendeldienst: van dienstregeling naar een geteld -- en herroepbaar -- niet-verschenen', async () => {
  const leeg = await api('/api/supplier/mob/pendel', {}, baas.token);
  assert.equal(leeg.status, 200, leeg.body.error || '');
  assert.deepEqual(leeg.body.pendels, [], 'de zaak begint zonder pendeldienst');

  const zet = await api('/api/supplier/mob/pendel/zet', { naam: 'Ochtendpendel',
    van: { lat: 38.908, lng: 1.432, label: 'Station' }, naar: { zaak: ANDERE },
    vensters: [{ van: '07:00', tot: '09:00', elkeMin: 60 }], dagen: [0, 1, 2, 3, 4, 5, 6],
    capaciteit: 2, stad: 'Ibiza' }, baas.token);
  assert.equal(zet.status, 200, JSON.stringify(zet.body).slice(0, 160));
  const pid = zet.body.pendel.id;

  const lijst = await api('/api/supplier/mob/pendel', {}, baas.token);
  assert.equal(lijst.body.pendels.length, 1, 'en ziet daarna precies zijn eigen dienst');
  const p = lijst.body.pendels[0];
  assert.equal(p.id, pid);
  assert.equal(p.werkgever, ZAAK);
  assert.equal(p.naam, 'Ochtendpendel');
  assert.equal(p.capaciteit, 2);
  assert.equal(p.reserveringen, 0, 'nog niemand heeft een zitplaats');
  assert.deepEqual(p.dagnamen, ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'],
    'de dagen komen als leesbare namen terug, niet als getallen');
  const bijBuur = await api('/api/supplier/mob/pendel', {}, kikBaas.token);
  assert.deepEqual(bijBuur.body.pendels, [], 'de buurzaak ziet onze dienstregeling niet');

  /* Het vertrek komt uit het ROOSTER en wordt hier niet uitgerekend: de
     dienstregeling wordt gerekend uit de regel, en een toets die dat naast de
     server nog eens doet, meet zijn eigen som. */
  const rooster = await api('/api/supplier/mob/pendel/rooster', { id: pid }, baas.token);
  assert.equal(rooster.status, 200, rooster.body.error || '');
  const vertrek = (rooster.body.vertrekken || [])[0];
  assert.ok(vertrek, 'de dienst rijdt vandaag, dus er staan vertrekken');
  assert.equal(vertrek.bezet, 0);

  const geenDienst = await api('/api/supplier/mob/pendel/noshow', { id: 'pd_bestaatniet' }, baas.token);
  assert.equal(geenDienst.status, 404);
  const geenPlek = await api('/api/supplier/mob/pendel/noshow',
    { id: pid, reservering: 'rs_bestaatniet' }, baas.token);
  assert.equal(geenPlek.status, 404);
  assert.match(geenPlek.body.error, /reservering/i);

  const res = await api('/api/mob/pendel/reserveer',
    { werkgever: ZAAK, id: pid, vertrek: vertrek.vertrek }, novaLid);
  assert.equal(res.status, 200, JSON.stringify(res.body).slice(0, 160));
  assert.equal(res.body.wachtlijst, false, 'de bus is niet vol, dus de plaats staat vast');
  const bezet = await api('/api/supplier/mob/pendel', {}, baas.token);
  assert.equal(bezet.body.pendels[0].reserveringen, 1,
    'de werkgeverslijst telt de zitplaats die de medewerker nam');

  /* De buurzaak probeert het met de ECHTE reservering in de hand, en dat is de
     enige vorm waarin deze poort gemeten wordt: met een verzonnen nummer stuit
     hij toch al op "reservering niet gevonden", en dan blijft de toets groen
     terwijl de eigendomstoets weg is. */
  const vanAnder = await api('/api/supplier/mob/pendel/noshow',
    { id: pid, reservering: res.body.reservering.id, nietVerschenen: true }, kikBaas.token);
  assert.equal(vanAnder.status, 404, 'een vreemde zaak zette een no-show op onze pendel');
  assert.match(vanAnder.body.error, /pendeldienst/i,
    'en hij mag de dienst niet eens vinden: ' + (vanAnder.body.error || ''));

  const noshow = await api('/api/supplier/mob/pendel/noshow',
    { id: pid, reservering: res.body.reservering.id, nietVerschenen: true }, baas.token);
  assert.equal(noshow.status, 200, noshow.body.error || '');
  assert.equal(noshow.body.vertrek, vertrek.vertrek, 'geteld op het vertrek waar de plaats bij hoorde');
  assert.equal(noshow.body.nietVerschenen, 1);
  assert.match(noshow.body.uitleg, /geen boete/i,
    'en het antwoord zegt zelf dat hier geen straf aan hangt');
  const terug = await api('/api/supplier/mob/pendel/noshow',
    { id: pid, reservering: res.body.reservering.id, nietVerschenen: false }, baas.token);
  assert.equal(terug.body.nietVerschenen, 0, 'een telling kun je corrigeren; een strafblad niet');
});

/* ================= 4. payroll: identiteit, verzuim, contract, run ================= */

/* JA OF NEE, EN VERDER NIETS. Een werkgever ziet standaard alleen of de
   identiteit is vastgesteld. Opvragen mag -- de loonadministratie vraagt erom --
   maar nooit stil: met een reden die iets zegt, en de medewerker hoort het. */
test('9. de identiteit van eigen personeel: ja of nee, en opvragen laat een spoor na', async () => {
  const standen = await api('/api/supplier/identiteit', {}, baas.token);
  assert.equal(standen.status, 200, standen.body.error || '');
  const nova = standen.body.standen.find(s => s.staffId === novaStaff);
  assert.ok(nova, 'de nieuwe medewerker staat op de lijst');
  assert.equal(nova.geverifieerd, false, 'zij heeft haar identiteit nog niet laten vaststellen');
  assert.ok(!standen.body.standen.some(s => s.geverifieerd), 'en niemand anders ook');
  assert.ok(!/geboortedatum|nummer|paspoort|nationaliteit/i.test(JSON.stringify(standen.body)),
    'de standaardweergave lekt geen enkel gegeven: ' + JSON.stringify(standen.body).slice(0, 200));
  assert.ok(!standen.body.standen.some(s => s.staffId === kikStaffId),
    'en er staat niemand van een andere zaak op');

  const REDEN = 'loonadministratie april, identificatieplicht';
  const kort = await api('/api/supplier/identiteit/opvraag',
    { staffId: novaStaff, niveau: 'gegevens', reden: 'ok' }, baas.token);
  assert.equal(kort.status, 400, 'een reden van niks is geen reden');
  const vreemd = await api('/api/supplier/identiteit/opvraag',
    { staffId: kikStaffId, niveau: 'gegevens', reden: REDEN }, baas.token);
  assert.equal(vreemd.status, 404, 'niet over iemand die hier niet werkt');
  const kopieDoorReceptie = await api('/api/supplier/identiteit/opvraag',
    { staffId: novaStaff, niveau: 'kopie', reden: REDEN }, receptie.token);
  assert.equal(kopieDoorReceptie.status, 403, 'een kopie is de zwaarste inzage; daar is de manager voor');
  const teVroeg = await api('/api/supplier/identiteit/opvraag',
    { staffId: novaStaff, niveau: 'gegevens', reden: REDEN }, baas.token);
  assert.equal(teVroeg.status, 409, 'er is nog niets vastgesteld, dus niets op te vragen');
  assert.equal(teVroeg.body.stand.geverifieerd, false, 'met de stand erbij, zodat het scherm iets kan zeggen');

  // de bestaande weg: Nova levert haar bewijs, RTG beoordeelt het
  const upload = await api('/api/verify/upload', { image: PNG }, novaLid);
  assert.equal(upload.status, 200, JSON.stringify(upload.body).slice(0, 160));
  const wacht = await api('/api/office/verifications', {}, kantoor);
  const inRij = (wacht.body.pending || []).find(u => u.name === 'Nova Bakker');
  assert.ok(inRij, 'haar bewijs staat in de beoordelingsrij van het kantoor');
  const keur = await api('/api/office/verify', { userId: inRij.id, decision: 'approve' }, kantoor);
  assert.equal(keur.body.status, 'verified');

  const na = await api('/api/supplier/identiteit', {}, baas.token);
  assert.equal(na.body.standen.find(s => s.staffId === novaStaff).geverifieerd, true,
    'de werkgever ziet dat het gelukt is');
  assert.equal(na.body.standen.filter(s => s.geverifieerd).length, 1,
    'en alleen bij haar -- de rest is niet meeveranderd');

  const gegevens = await api('/api/supplier/identiteit/opvraag',
    { staffId: novaStaff, niveau: 'gegevens', reden: REDEN }, baas.token);
  assert.equal(gegevens.status, 200, JSON.stringify(gegevens.body).slice(0, 200));
  assert.equal(gegevens.body.gegevens.geboortedatum, '1994-02-02');
  assert.ok(gegevens.body.gegevens.geverifieerdOp, 'met de datum waarop het is vastgesteld');
  assert.equal(gegevens.body.kopie, undefined, 'maar de scan blijft bij dit niveau in de kluis');

  const kopie = await api('/api/supplier/identiteit/opvraag',
    { staffId: novaStaff, niveau: 'kopie', reden: 'identificatieplicht: kopie in het dossier' }, baas.token);
  assert.equal(kopie.status, 200, JSON.stringify(kopie.body).slice(0, 200));
  assert.equal(kopie.body.kopie.beschikbaar, true);
  assert.match(kopie.body.let, /kluis/i, 'met de waarschuwing dat de kopie de kluis verlaat');

  /* DE REM DIE ECHT WERKT: zij ziet het, met de reden erbij. Zonder deze
     terugleesactie meet alles hierboven alleen dat er gegevens uit komen. */
  const bijHaar = await api('/api/member/identiteit/verzoeken', {}, novaLid);
  assert.equal(bijHaar.status, 200, bijHaar.body.error || '');
  assert.equal(bijHaar.body.verzoeken.length, 2, 'beide opvragingen staan bij de medewerker');
  assert.deepEqual(bijHaar.body.verzoeken.map(v => v.niveau), ['kopie', 'gegevens'],
    'de laatste bovenaan');
  assert.equal(bijHaar.body.verzoeken[1].reden, REDEN, 'met de reden die de werkgever opgaf');
  assert.equal(bijHaar.body.verzoeken[1].door, baas.naam, 'en met wie het vroeg');
});

/* DAT IEMAND ER NIET IS, NIET WAT HIJ HEEFT. Bij ziekte staat er "afwezig" en
   niet "ziek"; wat iemand nog wel kan staat er wel, want daar plant een
   leidinggevende mee. Bij verlof mag de soort er juist wel bij: dat is geen
   medisch gegeven. */
test('10. verzuim voor de planning: afwezig, met wat iemand nog kan -- en zonder de reden', async () => {
  const zonder = await api('/api/supplier/verzuim/planning', {}, baas.token);
  assert.equal(zonder.status, 400, 'zonder venster is er niets te plannen');
  assert.match(zonder.body.error, /JJJJ-MM-DD/);
  const half = await api('/api/supplier/verzuim/planning', { van: '2026-04-01', tot: 'morgen' }, baas.token);
  assert.equal(half.status, 400, 'een half venster is geen venster');

  const ziek = await api('/api/staff/leave/request', { soort: 'ziek' }, novaTok);
  assert.equal(ziek.status, 200, JSON.stringify(ziek.body).slice(0, 160));

  /* Het venster wordt PAS NA de melding uitgerekend en is een dag ruim aan
     beide kanten: loopt de testrun over middernacht, dan schuift de melding
     niet uit het venster en zakt deze toets niet om een reden die niets met de
     code te maken heeft. */
  const dag = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
  const nu = await api('/api/supplier/verzuim/planning', { van: dag(-1), tot: dag(1) }, baas.token);
  assert.equal(nu.status, 200, nu.body.error || '');
  const rij = (nu.body.afwezig || []).find(a => a.staffId === novaStaff);
  assert.ok(rij, 'de zieke medewerker staat op het planbord');
  assert.equal(rij.naam, 'Nova Bakker');
  assert.equal(rij.func, 'Receptie', 'met haar functie, want daar gaat de bezetting over');
  assert.equal(rij.regels.length, 1);
  assert.equal(rij.regels[0].wat, 'afwezig', 'er staat afwezig, niet ziek');
  assert.equal(rij.regels[0].inzetbaarheid, 'niets', 'en wat zij nog kan, want daar plant men mee');
  assert.ok(!/ziek/i.test(JSON.stringify(rij)),
    'het woord ziek staat in de regel van deze medewerker: ' + JSON.stringify(rij));

  const verlofVan = dag(30), verlofTot = dag(34);
  const verlof = await api('/api/staff/leave/request',
    { soort: 'verlof', van: verlofVan, tot: verlofTot }, novaTok);
  assert.equal(verlof.status, 200, JSON.stringify(verlof.body).slice(0, 160));
  const later = await api('/api/supplier/verzuim/planning', { van: verlofVan, tot: verlofTot }, baas.token);
  const vak = (later.body.afwezig || []).find(a => a.staffId === novaStaff);
  assert.ok(vak, 'het verlof staat op het planbord van die weken');
  assert.ok(vak.regels.some(r => r.wat === 'Vakantie'),
    'bij verlof mag de soort er wel bij: dat is geen medisch gegeven -- ' +
    vak.regels.map(r => r.wat).join(', '));
  /* De ziekmelding van hierboven heeft nog geen einddatum en loopt dus ook in dit
     venster mee. Ook daar blijft het "afwezig": de scheiding hangt aan de soort
     en niet aan het venster waarin toevallig gekeken wordt. */
  assert.ok(vak.regels.every(r => !/ziek/i.test(r.wat)),
    'de lopende ziekmelding noemt zichzelf in dit venster wel: ' + JSON.stringify(vak.regels));

  const leeg = await api('/api/supplier/verzuim/planning', { van: '2020-01-01', tot: '2020-01-05' }, baas.token);
  assert.deepEqual(leeg.body.afwezig, [], 'buiten het venster staat er niemand');
  const buur = await api('/api/supplier/verzuim/planning', { van: dag(-1), tot: dag(1) }, kikBaas.token);
  assert.deepEqual(buur.body.afwezig, [], 'en de buurzaak ziet ons verzuim niet');
});

/* HET CONTRACT IS DE INVOER VAN DE LOONRUN, en de geschiedenis ervan is het
   antwoord op "waarom is juni anders dan juli". De laag eronder overschrijft
   nooit; een wijziging is een VERSIE erbij. Dat is hier meetbaar gemaakt door de
   tweede versie terugwerkend te laten ingaan: de loonrun hoort dat als bevinding
   te melden, en dat is precies het gevolg dat je terugleest. */
test('11. contracten stapelen als versies, en de loonrun blijft bij de eigen zaak', async () => {
  const vreemd = await api('/api/supplier/payroll/contracten', { staffId: kikStaffId }, baas.token);
  assert.equal(vreemd.status, 404, 'niet over iemand die hier niet werkt');
  assert.match(vreemd.body.error, /uw zaak/i);

  const leeg = await api('/api/supplier/payroll/contracten', { staffId: novaStaff }, baas.token);
  assert.equal(leeg.status, 200, leeg.body.error || '');
  assert.deepEqual(leeg.body.contracten, {}, 'zonder vastgelegd contract is er ook geen geschiedenis');

  const v1 = await api('/api/supplier/payroll/contract', { staffId: novaStaff, vanaf: '2026-01-01',
    soort: 'vast', uurloonCenten: 1800, urenPerWeek: 32, functie: 'Receptie' }, baas.token);
  assert.equal(v1.status, 200, JSON.stringify(v1.body).slice(0, 160));
  const v2 = await api('/api/supplier/payroll/contract', { staffId: novaStaff, vanaf: '2026-03-01',
    soort: 'vast', uurloonCenten: 1950, urenPerWeek: 32, functie: 'Receptie' }, baas.token);
  assert.equal(v2.status, 200, JSON.stringify(v2.body).slice(0, 160));

  const gesch = await api('/api/supplier/payroll/contracten', { staffId: novaStaff }, baas.token);
  assert.equal(gesch.status, 200, gesch.body.error || '');
  assert.equal(gesch.body.staffId, novaStaff);
  const reeks = gesch.body.contracten[1];
  assert.ok(Array.isArray(reeks), 'contract nummer 1 heeft een geschiedenis');
  assert.equal(reeks.length, 2, 'de loonsverhoging is een versie erbij, geen overschrijving');
  assert.deepEqual(reeks.map(r => r.uurloonCenten), [1800, 1950], 'in de volgorde van ingang');
  assert.deepEqual(reeks.map(r => r.vanaf), ['2026-01-01', '2026-03-01']);
  assert.ok(reeks.every(r => r.door === baas.naam), 'met de naam van wie het vastlegde');

  const nogGeen = await api('/api/supplier/payroll/runs', {}, baas.token);
  assert.equal(nogGeen.status, 200, nogGeen.body.error || '');
  assert.deepEqual(nogGeen.body.runs, [], 'er is nog geen loonrun gedraaid');

  // het kantoor voert de administratie; de werkgever draait zelf geen run
  const open = await api('/api/office/payroll/run/open', { code: ZAAK, periode: PERIODE }, kantoor);
  assert.equal(open.status, 200, JSON.stringify(open.body).slice(0, 200));
  const runId = open.body.run.id;

  const runs = await api('/api/supplier/payroll/runs', {}, baas.token);
  assert.equal(runs.body.runs.length, 1, 'en de werkgever ziet hem terug');
  assert.equal(runs.body.runs[0].id, runId);
  assert.equal(runs.body.runs[0].periode, PERIODE);
  assert.equal(runs.body.runs[0].code, ZAAK);
  assert.equal(runs.body.runs[0].stand, 'concept', 'nog niet definitief: dat vraagt vier ogen');
  assert.equal(runs.body.runs[0].aantal, 1, 'precies de ene medewerker met een contract');
  const bijBuur = await api('/api/supplier/payroll/runs', {}, kikBaas.token);
  assert.deepEqual(bijBuur.body.runs, [],
    'de zaak komt uit het token: de buurzaak ziet onze loonrun niet');

  const onbekend = await api('/api/supplier/payroll/bevindingen', { runId: 'run_bestaatniet' }, baas.token);
  assert.equal(onbekend.status, 404);
  const gekaapt = await api('/api/supplier/payroll/bevindingen', { runId }, kikBaas.token);
  assert.equal(gekaapt.status, 404, 'met het runId in de hand komt de buurzaak er nog niet in');
  assert.match(gekaapt.body.error, /kennen we niet/i);

  const bev = await api('/api/supplier/payroll/bevindingen', { runId }, baas.token);
  assert.equal(bev.status, 200, bev.body.error || '');
  assert.equal(bev.body.run.id, runId, 'de run zelf staat erbij, zodat het scherm niet twee vragen hoeft te stellen');
  assert.ok(Array.isArray(bev.body.bevindingen) && bev.body.bevindingen.length,
    'een run zonder bevindingenlijst nodigt uit om hem over te slaan');
  const terug = bev.body.bevindingen.find(b => b.soort === 'terugwerkende_contractwijziging');
  assert.ok(terug, 'de terugwerkende loonsverhoging hoort als bevinding boven te komen: ' +
    bev.body.bevindingen.map(b => b.soort).join(', '));
  assert.equal(terug.staffId, novaStaff, 'bij de juiste medewerker');
  assert.equal(terug.status, 'open', 'en hij staat open tot iemand hem afhandelt');
});
