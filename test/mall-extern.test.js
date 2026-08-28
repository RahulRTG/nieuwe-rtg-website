/* De twee gaten die met naam openstonden na de Supplier OS-koppeling:

   1. DE KLOK. Alles rekende in servertijd, en een zaak droeg geen tijdzone.
      Voor een Mall van Haarlem tot Ibiza is "Nu open" dan een uur mis -- de
      stilste fout die er is, want de klant staat voor een dichte deur en denkt
      dat de zaak gesloten is.
   2. EEN SYSTEEM VAN BUITEN. De koppeling werkte omdat alles in een database
      staat. Een partner met een eigen kassa had geen weg naar binnen.

   Draai los: node --test test/mall-extern.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');
const tz = require('../server/kern/tijdzone');
const { VERS_MIN } = require('../server/kern/mall/extern');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-extern-'));
let srv, base, lid;
const tok = {};

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
async function login(code) {
  const roster = await api('/api/supplier/roster', { code });
  const chef = (roster.body.staff || []).find(m => m.role === 'manager');
  if (!chef) return null;
  return (await api('/api/supplier/login', { code, staffId: chef.id, pin: '1234' })).body.token || null;
}
async function mallVan(code, extra) {
  const r = await api('/api/mall/zoek', { per: 60, ...(extra || {}) }, lid);
  return r.body.items.filter(a => a.aanbieder.code === code);
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  const reg = await api('/api/auth/register', { name: 'Extern Kijker', email: 'ext@x.nl', phone: '0612345675',
    password: 'geheim123', geboortedatum: '1990-01-01', tier: 'lifestyle', pasApp: 'lifestyle' });
  lid = reg.body.token;
  for (const c of ['SERENA', 'MAISON']) tok[c] = await login(c);
  assert.ok(tok.MAISON, 'de modepartner kan inloggen');
  /* Een eigen artikel met een eigen sku. De demo-boutieks van de Mall worden
     pas gezaaid zodra /api/mall wordt geopend; een toets die daarvan afhangt
     meet de volgorde van andere toetsen mee. */
  const art = await api('/api/supplier/retail/artikel', {
    artikel: {
      sku: 'TESTSJAAL', naam: 'Testsjaal', categorie: 'Sjaals', publiekePrijs: 120,
      varianten: [{ vsku: 'TESTSJAAL-ONE', kleur: 'Ecru', maat: 'one', voorraad: 5 }]
    }
  }, tok.MAISON);
  assert.equal(art.status, 200, 'het artikel is aangemaakt: ' + JSON.stringify(art.body).slice(0, 160));
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

/* ---------------------------------------------------------------------------
   1. De klok van de zaak.
   --------------------------------------------------------------------------- */

test('1. de tijdzonehulp rekent met de zone en niet met de server', () => {
  // 23:30 UTC is in Amsterdam en Auckland al de volgende dag; in UTC nog niet
  const m = new Date('2026-08-09T23:30:00Z');
  const utc = tz.lokaal('UTC', m);
  const ams = tz.lokaal('Europe/Amsterdam', m);
  const akl = tz.lokaal('Pacific/Auckland', m);
  assert.equal(utc.datum, '2026-08-09', 'in UTC is het nog zondag');
  assert.equal(ams.datum, '2026-08-10', 'in Amsterdam is het al maandag');
  assert.equal(akl.datum, '2026-08-10', 'in Auckland ook');
  assert.notEqual(ams.dag, utc.dag, 'en de weekdag verschilt dus echt');
  assert.equal(ams.minuten, 90, '01:30 in Amsterdam');
  assert.equal(akl.minuten, 690, '11:30 in Auckland');
  // een onbekende zone valt terug op UTC in plaats van om te vallen
  assert.equal(tz.lokaal('Onzin/Zone', m).zone, 'UTC');
});

test('2. de zone van een zaak: eigen instelling, anders het land, en dat staat erbij', () => {
  assert.deepEqual(tz.zoneVan({ tijdzone: 'Asia/Tokyo' }), { zone: 'Asia/Tokyo', bron: 'zaak', aangenomen: false });
  assert.deepEqual(tz.zoneVan({ country: 'ES' }), { zone: 'Europe/Madrid', bron: 'land', aangenomen: true });
  assert.deepEqual(tz.zoneVan({}, 'NL'), { zone: 'Europe/Amsterdam', bron: 'land', aangenomen: true });
  const onbekend = tz.zoneVan({ country: 'XX' });
  assert.equal(onbekend.zone, 'UTC');
  assert.equal(onbekend.aangenomen, true, 'een terugval is een aanname en zegt dat');
  // een onzin-instelling van de zaak wordt niet blind overgenomen
  assert.equal(tz.zoneVan({ tijdzone: 'Onzin/Zone', country: 'NL' }).zone, 'Europe/Amsterdam');
});

test('3. een zaak zet haar eigen tijdzone, en de Mall rekent er meteen mee', async () => {
  const spiegel = await api('/api/supplier/mall', {}, tok.SERENA);
  assert.equal(spiegel.status, 200);
  assert.ok(spiegel.body.tijdzone.aangenomen, 'zonder eigen instelling is de zone een aanname');
  assert.ok(spiegel.body.ontbreekt.some(x => x.wat === 'tijdzone'), 'en dat staat als ontbrekend gemeld');

  const zet = await api('/api/supplier/tijdzone', { tijdzone: 'Pacific/Auckland' }, tok.SERENA);
  assert.equal(zet.status, 200);
  assert.equal(zet.body.tijdzone.zone, 'Pacific/Auckland');
  assert.equal(zet.body.tijdzone.aangenomen, false, 'nu is het een keuze en geen aanname');

  const na = await api('/api/supplier/mall', {}, tok.SERENA);
  assert.equal(na.body.tijdzone.zone, 'Pacific/Auckland');
  assert.ok(!na.body.ontbreekt.some(x => x.wat === 'tijdzone'), 'de melding is weg');

  const fout = await api('/api/supplier/tijdzone', { tijdzone: 'Niet/Bestaand' }, tok.SERENA);
  assert.equal(fout.status, 400, 'een onbekende zone wordt geweigerd en niet stil genegeerd');

  await api('/api/supplier/tijdzone', { tijdzone: 'auto' }, tok.SERENA);
  const terug = await api('/api/supplier/mall', {}, tok.SERENA);
  assert.ok(terug.body.tijdzone.aangenomen, 'auto zet hem terug op de landzone');
  /* En die landzone is echt afgeleid en geen terugval: de zaak staat in Ibiza,
     dus Europe/Madrid. Zonder de registratie van de plaatsbepaling uit de
     Reiswijzer zou hier UTC staan en zou niemand het merken. */
  assert.equal(terug.body.tijdzone.zone, 'Europe/Madrid', 'Ibiza is herkend als Spanje');
  assert.equal(terug.body.tijdzone.bron, 'land');
});

test('4. "Nu open" volgt de klok van de zaak, niet die van de server', async () => {
  /* De zaak krijgt een venster dat op haar EIGEN klok nu open is, en daarna een
     tijdzone waarin datzelfde venster juist gesloten is. Verandert het antwoord
     niet mee, dan rekent de Mall nog met de server. */
  const zone = 'Europe/Amsterdam';
  await api('/api/supplier/tijdzone', { tijdzone: zone }, tok.SERENA);
  const hier = tz.lokaal(zone);
  const pad = (n) => String(Math.floor(n / 60)).padStart(2, '0') + ':' + String(n % 60).padStart(2, '0');
  // een venster van een uur rond de lokale tijd van de zaak
  const van = Math.max(0, hier.minuten - 30), tot = Math.min(1439, hier.minuten + 30);
  await api('/api/supplier/vak/uren-zet', { dagen: [true, true, true, true, true, true, true], van: pad(van), tot: pad(tot) }, tok.SERENA);
  const open = (await mallVan('SERENA'))[0];
  assert.equal(open.open.open, true, 'op haar eigen klok staat de zaak open (' + open.open.tekst + ')');

  // dezelfde uren, maar de zaak staat nu twaalf uur verderop
  await api('/api/supplier/tijdzone', { tijdzone: 'Pacific/Auckland' }, tok.SERENA);
  const ginds = tz.lokaal('Pacific/Auckland');
  const binnenVenster = ginds.minuten >= van && ginds.minuten < tot;
  const na = (await mallVan('SERENA'))[0];
  assert.equal(na.open.open, binnenVenster,
    'in Auckland is het ' + pad(ginds.minuten) + ', dus het venster ' + pad(van) + '-' + pad(tot) +
    ' geeft ' + binnenVenster + ' -- de Mall rekent met de zone van de zaak');
  assert.notEqual(binnenVenster, true, 'en dat is hier een ander antwoord dan zojuist, anders bewijst deze toets niets');

  await api('/api/supplier/tijdzone', { tijdzone: 'auto' }, tok.SERENA);
});

/* ---------------------------------------------------------------------------
   2. Een kassasysteem van buiten.
   --------------------------------------------------------------------------- */

test('5. een extern systeem meldt voorraad, en de Mall neemt hem over', async () => {
  const voor = (await mallVan('MAISON')).find(a => a.titel === 'Testsjaal');
  assert.ok(voor, 'het artikel staat in de Mall');
  assert.equal(voor.beschikbaar.uit, undefined, 'en ligt er nog (' + voor.beschikbaar.tekst + ')');

  // het kassasysteem meldt dat de sjaal op is
  const sync = await api('/api/supplier/mall/sync', {
    bron: 'Kassa Maison v2', voorraad: [{ sku: 'TESTSJAAL', aantal: 0 }]
  }, tok.MAISON);
  assert.equal(sync.status, 200);
  assert.equal(sync.body.aangenomen.voorraadregels, 1);
  assert.equal(sync.body.versMinuten, VERS_MIN, 'en het antwoord zegt hoe lang de melding telt');

  const na = (await mallVan('MAISON')).find(a => a.titel === 'Testsjaal');
  assert.equal(na.beschikbaar.tekst, 'Uitverkocht', 'de Mall volgt de kassa');
  assert.equal(na.beschikbaar.uit, true);

  // en de eigen voorraad van de zaak is NIET aangeraakt: de kassa overschrijft
  // de weergave, niet de administratie
  const eigen = await api('/api/supplier/retail', {}, tok.MAISON);
  const rij = ((eigen.body.retail || {}).artikelen || []).find(a => a.sku === 'TESTSJAAL');
  assert.ok(rij && (rij.varianten || []).some(v => v.voorraad === 5), 'de eigen voorraadrij staat er nog op 5');
});

test('6. de houdbaarheid: een verlopen melding telt niet meer mee', () => {
  /* Hier zat eerst een toets die de melding via een testhaak liet verouderen en
     zichzelf oversloeg als die haak er niet was -- precies de vorm die
     LAT-regel 3 verbiedt. De regel is puur, dus hij hoort puur gemeten te
     worden: de klok terugzetten kan hier gewoon.

     Dit is de hele veiligheid van de koppeling. Een kassa die stopt met melden
     is niet te onderscheiden van een kassa die "alles nog steeds op voorraad"
     bedoelt, behalve door de tijd. */
  const maakExtern = require('../server/kern/mall/extern');
  const db = { data: {} };
  const ctx = { db, save() {} };
  const ex = maakExtern(ctx);
  const zaak = { code: 'X', artikelen: [{ id: 'a1', sku: 'SKU1' }], mall: {} };

  ex.meld(zaak, { bron: 'Kassa', voorraad: [{ sku: 'SKU1', aantal: 0 }], open: true });
  assert.equal(ex.voorraadVan(zaak, { sku: 'SKU1' }), 0, 'vers: het externe getal geldt');
  assert.equal(ex.openVan(zaak).open, true, 'en de open-melding ook');
  assert.equal(ex.openVan(zaak).bron, 'extern', 'met de bron erbij, zodat het te herleiden is');

  // de klok terugzetten tot voorbij de houdbaarheid
  zaak.mall.extern.at = new Date(Date.now() - (ex.VERS_MIN + 1) * 60000).toISOString();
  assert.equal(ex.voorraadVan(zaak, { sku: 'SKU1' }), null, 'verlopen: het externe getal telt niet meer');
  assert.equal(ex.openVan(zaak), null, 'en de open-melding evenmin');
});

test('7. het kassasysteem overrulet de schakelaar van de ondernemer niet', () => {
  const maakExtern = require('../server/kern/mall/extern');
  const ex = maakExtern({ data: {}, save() {} });
  const zaak = { code: 'Y', artikelen: [], mall: {}, settings: { reservationsOpen: false } };
  ex.meld(zaak, { bron: 'Kassa', open: true });
  assert.equal(ex.openVan(zaak), null,
    'de zaak zette zichzelf dicht; een kassa die "open" roept mag dat niet omzetten');
  zaak.settings.reservationsOpen = true;
  assert.equal(ex.openVan(zaak).open, true, 'staat de schakelaar weer aan, dan telt de kassa gewoon mee');
});

test('8. de koppeling zegt wat zij NIET heeft aangenomen', async () => {
  const r = await api('/api/supplier/mall/sync', {
    bron: 'Kassa', open: 'misschien',
    voorraad: [{ aantal: 3 }, { sku: 'BESTAAT-NIET', aantal: 5 }]
  }, tok.MAISON);
  assert.equal(r.status, 200);
  assert.ok(r.body.genegeerd.some(x => /geen ja\/nee/.test(x)), '"misschien" is geen open/dicht en dat wordt gezegd');
  assert.ok(r.body.genegeerd.some(x => /zonder sku/.test(x)), 'een regel zonder sku wordt gemeld, niet stil weggegooid');
  assert.ok(r.body.onbekendeSleutels.includes('BESTAAT-NIET'), 'een sku die hier niet bestaat wordt teruggemeld');
});

test('9. de zaak ziet de stand van haar eigen koppeling', async () => {
  await api('/api/supplier/mall/sync', { bron: 'Kassa Maison v2', voorraad: [] }, tok.MAISON);
  const r = await api('/api/supplier/mall', {}, tok.MAISON);
  assert.equal(r.status, 200);
  assert.equal(r.body.extern.gekoppeld, true);
  assert.equal(r.body.extern.systeem, 'Kassa Maison v2');
  assert.equal(r.body.extern.vers, true);
  assert.equal(r.body.extern.versMinuten, VERS_MIN);

  // een zaak zonder koppeling zegt dat gewoon
  const zonder = await api('/api/supplier/mall', {}, tok.SERENA);
  assert.equal(zonder.body.extern.gekoppeld, false);
});

/* DE ZONE VAN DE ZAAK WORDT GEKOZEN EN STAAT NIET VAST (hetzelfde patroon als
   toets 12 verderop). De twee toetsen hierna hebben een zaak nodig die aan twee
   eisen tegelijk voldoet:
   1. ze loopt VOOR op de server. Alleen dan laat een filter op servertijd
      tijdvakken staan die bij de zaak al geweest zijn, en dat is precies de
      fout die hier bewaakt wordt;
   2. ze heeft nog uren te gaan voor sluitingstijd, anders staat er op haar
      eigen dag niets meer open en meet de toets niets.
   Hier stond Pacific/Auckland VAST. Dat voldeed tweeentwintig uur per dag en
   zakte de andere twee: tussen ongeveer 10:00 en 12:00 UTC loopt het daar tegen
   middernacht, is er op de eigen dag niets meer open, en zakte deze toets
   zonder dat er iets kapot was -- rood dat niets over de code zei. */
const ZONEKEUS = ['Pacific/Kiritimati', 'Pacific/Auckland', 'Australia/Brisbane',
  'Asia/Tokyo', 'Asia/Singapore', 'Asia/Dhaka', 'Asia/Dubai', 'Europe/Amsterdam',
  'UTC', 'America/Sao_Paulo', 'America/New_York', 'America/Los_Angeles', 'Pacific/Honolulu'];
const OPEN_TOT = 20 * 60;   // eis 2: uiterlijk acht uur 's avonds bij de zaak
const VOORSPRONG = 2 * 60;  // eis 1: minstens twee uur voor op de server

function zoneVoorZaak() {
  const server = tz.lokaal().minuten; // de klok waarmee een fout filter zou rekenen
  const open = ZONEKEUS.map(zone => ({ zone, minuten: tz.lokaal(zone).minuten }))
    .filter(z => z.minuten <= OPEN_TOT);
  const voor = open.filter(z => z.minuten >= server + VOORSPRONG);
  /* Lukt eis 1 niet -- de server staat zelf al laat op de dag, en dan ligt geen
     enkele open zone er nog VOOR -- dan wordt het de zone die er het verst
     ACHTER ligt. Toets 10 wordt daar zwakker van (bij een zaak die achterloopt
     ligt alles wat servertijd overlaat sowieso in haar toekomst), maar de
     laatste bewering van toets 11 blijft even scherp: die vergelijkt het eerste
     tijdvak met wat er bij de ZAAK als eerste komt, en juist dat loopt dan
     maximaal uiteen. */
  const keus = voor.length
    ? voor.sort((a, b) => b.minuten - a.minuten)[0]
    : open.sort((a, b) => a.minuten - b.minuten)[0];
  assert.ok(keus, 'er is altijd een zone waar de zaak nog uren open is');
  return keus.zone;
}

test('10. een tijdvak van vandaag ligt nooit in het verleden van de zaak zelf', async () => {
  /* Gevonden doordat de mutatie "filter vandaag niet tegen de eigen klok" werd
     AFGESLAGEN. vakwerk laat de tijden weg die op de SERVER al voorbij zijn;
     voor een zaak in een andere zone klopt dat niet, en dan biedt de Mall een
     tijdvak aan dat daar al is geweest. */
  const zone = zoneVoorZaak();
  await api('/api/supplier/tijdzone', { tijdzone: zone }, tok.SERENA);
  await api('/api/supplier/vak/uren-zet', {
    dagen: [true, true, true, true, true, true, true], van: '00:00', tot: '23:59'
  }, tok.SERENA);

  const hier = tz.lokaal(zone);
  const mijn = (await mallVan('SERENA')).filter(a => a.beschikbaar && a.beschikbaar.datum);
  assert.ok(mijn.length >= 1, 'er is een dienst met een tijdvak, anders meet deze toets niets');
  const naarMin = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  let vandaag = 0;
  for (const a of mijn) {
    if (a.beschikbaar.datum !== hier.datum) continue;
    vandaag++;
    assert.ok(naarMin(a.beschikbaar.tijd) > hier.minuten,
      a.titel + ': ' + a.beschikbaar.tijd + ' ligt na ' + Math.floor(hier.minuten / 60) + ':' +
      String(hier.minuten % 60).padStart(2, '0') + ' bij de zaak zelf');
  }
  assert.ok(vandaag >= 1, 'en minstens een tijdvak valt op de eigen dag van de zaak (' + hier.datum + ')');

  await api('/api/supplier/tijdzone', { tijdzone: 'auto' }, tok.SERENA);
});

/* ---------------------------------------------------------------------------
   3. De reparatie bij de oorzaak: vakwerk en de Food Court rekenen zelf in de
      zone van de zaak. Daarvoor deed alleen de leeslaag dat, en dan kan de
      Mall-kaart een tijdvak tonen dat het boekscherm niet kent.
   --------------------------------------------------------------------------- */

test('11. de Mall-kaart en het boekscherm noemen hetzelfde eerste tijdvak', async () => {
  const zone = zoneVoorZaak();
  await api('/api/supplier/tijdzone', { tijdzone: zone }, tok.SERENA);
  await api('/api/supplier/vak/uren-zet', {
    dagen: [true, true, true, true, true, true, true], van: '00:00', tot: '23:59'
  }, tok.SERENA);

  const kaart = (await mallVan('SERENA')).find(a => a.beschikbaar && a.beschikbaar.datum);
  assert.ok(kaart, 'de Mall toont een tijdvak');

  // hetzelfde vragen langs de weg waarlangs je werkelijk boekt
  const dienstId = kaart.id.split(':')[2];
  const boek = await api('/api/booking/slots', { supplierCode: 'SERENA', serviceId: dienstId, date: kaart.beschikbaar.datum }, lid);
  assert.equal(boek.status, 200);
  assert.ok(boek.body.tijden.length, 'het boekscherm heeft tijden op die dag');
  assert.equal(boek.body.tijden[0], kaart.beschikbaar.tijd,
    'het eerste tijdvak op de Mall-kaart is hetzelfde als in het boekscherm');

  /* En het BOEKSCHERM filtert zelf, niet alleen de Mall eroverheen. Dit stond
     eerst achter `if (datum === vandaag bij de zaak)`, en dan bewees het niets:
     de mutatie "vakwerk terug naar servertijd" liet geen toets zakken omdat de
     Mall zijn eigen filter er nog overheen legde. Nu wordt de eigen dag van de
     zaak expliciet opgevraagd. */
  const hier = tz.lokaal(zone);
  const vandaagDaar = await api('/api/booking/slots', { supplierCode: 'SERENA', serviceId: dienstId, date: hier.datum }, lid);
  assert.equal(vandaagDaar.status, 200);
  const min = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  assert.ok(vandaagDaar.body.tijden.length >= 1, 'de zaak is de klok rond open, dus er staat iets open op haar eigen dag');
  for (const t of vandaagDaar.body.tijden) {
    assert.ok(min(t) > hier.minuten,
      t + ' ligt na ' + Math.floor(hier.minuten / 60) + ':' + String(hier.minuten % 60).padStart(2, '0') + ' bij de zaak zelf');
  }
  /* En het EERSTE tijdvak is precies het eerste dat bij de zaak nog komt. "Alles
     ligt in de toekomst" was niet genoeg: staat de zaak VOOR de server, dan
     filtert servertijd juist te veel weg en zijn alle overgebleven tijden nog
     steeds toekomst. Dan mis je een uur aanbod zonder dat iets klaagt. */
  const duur = vandaagDaar.body.duurMin;
  const stap = Math.max(30, Math.min(duur, 120));
  let verwacht = null;
  for (let m = 0; m + duur <= 1439; m += stap) { if (m > hier.minuten) { verwacht = m; break; } }
  assert.ok(verwacht != null, 'er hoort vandaag nog een tijdvak te komen');
  assert.equal(min(vandaagDaar.body.tijden[0]), verwacht,
    'het eerste tijdvak is het eerste dat bij de zaak nog komt, niet het eerste dat op de server nog komt');
  await api('/api/supplier/tijdzone', { tijdzone: 'auto' }, tok.SERENA);
});

test('12. de Food Court rekent datum en tijd met dezelfde klok', async () => {
  /* Hier stond de datum in UTC en de tijd in de zone van de server: twee
     klokken in dezelfde functie, wat rond middernacht een tijdslot van gisteren
     of morgen opleverde. De zone wordt zo gekozen dat de lokale datum GEGARAND-
     EERD van de UTC-datum verschilt, ongeacht wanneer deze toets draait. */
  const kok = await login('KIKUNOI');
  assert.ok(kok, 'het restaurant kan inloggen');
  const utcUur = new Date().getUTCHours();
  const zone = utcUur < 11 ? 'Pacific/Midway' : 'Pacific/Kiritimati';
  const zet = await api('/api/supplier/tijdzone', { tijdzone: zone }, kok);
  assert.equal(zet.status, 200);

  const daar = tz.lokaal(zone);
  const utcDatum = new Date().toISOString().slice(0, 10);
  assert.notEqual(daar.datum, utcDatum, 'de zone is zo gekozen dat de datum echt verschilt');

  const t = await api('/api/foodcourt/tijden', { code: 'KIKUNOI' }, lid);
  assert.equal(t.status, 200);
  assert.equal(t.body.datum, daar.datum, 'zonder datum pakt de Food Court de dag van de ZAAK, niet die van de server');

  await api('/api/supplier/tijdzone', { tijdzone: 'auto' }, kok);
});

test('13. de datumgrens van het boekscherm ligt bij de zaak, niet bij de server', async () => {
  /* De laatste van de drie mutaties die eerst afsloegen. vakwerk weigerde een
     datum die "in het verleden" ligt, gemeten op de server. Voor een zaak die
     achterloopt op de server is haar eigen vandaag dan al verleden; voor een
     zaak die voorloopt is haar eigen gisteren nog toekomst.

     Welke van de twee we kunnen meten hangt af van het uur waarop deze toets
     draait, dus de zone EN de bewering worden op EEN vastgelegd moment
     gekozen. De achterlopende zone telt alleen mee als er daarna nog ruim tijd
     is voor de korte controledienst. Zo meet een lege lijst echt de
     datumgrens, en niet toevallig een behandeling die niet meer voor
     middernacht past. */
  const moment = new Date();
  const utcDatum = moment.toISOString().slice(0, 10);
  const zones = ['Etc/GMT+12', 'Pacific/Kiritimati']
    .map(zone => ({ zone, lokaal: tz.lokaal(zone, moment) }));
  const keuze = zones.find(x => x.lokaal.datum < utcDatum && x.lokaal.minuten < 22 * 60) ||
    zones.find(x => x.lokaal.datum > utcDatum);
  assert.ok(keuze, 'er is altijd een zone aan de andere kant van de UTC-datumgrens');
  const { zone, lokaal: daar } = keuze;
  const achter = daar.datum < utcDatum;
  await api('/api/supplier/tijdzone', { tijdzone: zone }, tok.SERENA);
  await api('/api/supplier/vak/uren-zet', {
    dagen: [true, true, true, true, true, true, true], van: '00:00', tot: '23:59'
  }, tok.SERENA);

  assert.notEqual(daar.datum, utcDatum, 'de zone is zo gekozen dat de dag echt verschilt');

  /* Een vaste korte dienst houdt deze toets onafhankelijk van het toevallig
     eerste Mall-aanbod. Dat was een massage van 60 minuten; om 22:53 lokaal
     was de eigen datum geldig maar paste de massage terecht niet meer. */
  const toegevoegd = await api('/api/supplier/service', {
    action: 'add', name: 'Datumgrenscontrole', price: 1, duurMin: 30
  }, tok.SERENA);
  assert.equal(toegevoegd.status, 200);
  const dienst = (toegevoegd.body.services || []).find(x => x.name === 'Datumgrenscontrole');
  assert.ok(dienst && dienst.id, 'de korte controledienst is aangemaakt');

  if (achter) {
    // de zaak loopt achter: haar eigen vandaag is de dag VOOR die van de server
    assert.ok(daar.datum < utcDatum);
    const r = await api('/api/booking/slots', { supplierCode: 'SERENA', serviceId: dienst.id, date: daar.datum }, lid);
    assert.equal(r.status, 200);
    assert.ok(r.body.tijden.length >= 1,
      'de eigen dag van de zaak wordt aangenomen, ook al is hij op de server al voorbij');
  } else {
    // de zaak loopt voor: haar eigen gisteren is de dag van de server
    const gisteren = new Date(new Date(daar.datum + 'T12:00:00Z').getTime() - 86400000).toISOString().slice(0, 10);
    assert.equal(gisteren, utcDatum, 'haar gisteren is de dag van de server');
    const r = await api('/api/booking/slots', { supplierCode: 'SERENA', serviceId: dienst.id, date: gisteren }, lid);
    assert.equal(r.status, 200);
    assert.equal(r.body.tijden.length, 0,
      'een dag die bij de zaak al voorbij is levert niets op, ook al is hij op de server vandaag');
  }

  await api('/api/supplier/service', { action: 'remove', id: dienst.id }, tok.SERENA);
  await api('/api/supplier/tijdzone', { tijdzone: 'auto' }, tok.SERENA);
});
