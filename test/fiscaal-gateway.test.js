/* DE AANGIFTEGATEWAY: klaargezet, niet aangezet.

   Zeven beweringen, en de eerste is de enige die er echt toe doet.

   1. ER IS GEEN WEG NAAR BUITEN. Ook niet met een geldig mandaat, een
      verzegelde zending en een kanaal dat zegt dat het actief is: zolang het
      zekerheidsregister `verzenden` op `voorbehouden` heeft, gaat er niets weg.
      Geen vlag, geen omgevingsvariabele, geen force.
   2. ZONDER MANDAAT WORDT ER NIET EENS IETS KLAARGEZET -- andermans cijfers
      klaarzetten is al een verwerking.
   3. DEZELFDE INHOUD GEEFT DEZELFDE ZENDING (idempotentie), een andere inhoud
      een nieuwe. Bij een instantie die traag antwoordt is dat het verschil
      tussen een aangifte en twee aangiften.
   4. DE STAAT GAAT EEN KANT OP: een afgewezen zending wordt niet opnieuw
      aangeboden, een mislukte wel.
   5. EEN ONTVANGSTBEWIJS DAT NERGENS OP PAST WORDT BEWAARD en niet weggegooid.
   6. DE KETEN VERRAADT EEN WIJZIGING ACHTERAF -- dat is wat "bewijs van wat
      exact is verzonden" betekent als je het serieus neemt.
   7. HET KANAAL ZEGT WAT HET VRAAGT, ook nu het niet aan staat.

   Draai los: node --experimental-sqlite --test test/fiscaal-gateway.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { maakGateway } = require('../server/kern/fiscaal/gateway');
const { maakMandaat } = require('../server/kern/fiscaal/gateway/mandaat');
const { kanaal: sbr } = require('../server/kern/fiscaal/gateway/sbr');

const PAYLOAD = { tijdvak: '2026K3', omzetbelastingNummer: 'NL001234567B01',
  rubrieken: { '1a': { omzet: 100000, btw: 21000 } } };

function opzet(kanalen) {
  const db = { data: {} };
  let n = 0;
  const nu = () => '2026-10-05T09:0' + (n++ % 10) + ':00.000Z';
  const { mandaat } = maakMandaat({ db, save: () => {}, nu });
  const { gateway } = maakGateway({ db, save: () => {}, crypto, nu, mandaat,
    kanalen: kanalen || { sbr } });
  mandaat.verleen({ code: 'KIKUNOI', soort: 'btw', van: '2026-01-01', tot: '2026-12-31',
    doorNaam: 'R. Sardjoe', doorRol: 'eigenaar' });
  return { db, mandaat, gateway };
}

const klaar = (k, payload) => k.gateway.maakKlaar({ code: 'KIKUNOI', soort: 'btw',
  aangifteId: 'btw_1', periode: '2026K3', payload: payload || PAYLOAD, kanaal: 'sbr', door: 'Beheer' });

test('er is geen weg naar buiten, ook niet met een kanaal dat zegt dat het aan staat', async () => {
  /* Een kanaal dat WEL actief is en WEL zou versturen. Als er ergens een gaatje
     zit, valt hij hier door -- en dan is `verstuurd` waar. */
  let verstuurd = false;
  const nep = { naam: 'Nep', actief: true, eist: () => ({ ok: true }),
    verstuur: async () => { verstuurd = true; return { ok: true }; } };
  const k = opzet({ sbr: nep });
  const z = klaar(k).zending;
  assert.equal(z.status, 'KLAAR');

  const r = await k.gateway.biedAan(z.id, 'Beheer');
  assert.equal(r.status, 451, 'geweigerd op de grens, niet op een ontbrekende koppeling');
  assert.equal(r.grens, true);
  assert.equal(r.klasse, 'voorbehouden');
  assert.equal(verstuurd, false, 'ER IS NIETS VERSTUURD');
  assert.match(r.let, /geen koppeling maar een besluit/i);
  assert.equal(k.gateway.haal(z.id).status, 'KLAAR', 'en de zending is niet van staat veranderd');
});

test('zonder mandaat wordt er niet eens iets klaargezet', () => {
  const k = opzet();
  const zonder = k.gateway.maakKlaar({ code: 'ANDERE', soort: 'btw', payload: PAYLOAD, kanaal: 'sbr', door: 'Beheer' });
  assert.equal(zonder.status, 403);
  assert.match(zonder.error, /Geen geldig mandaat/);

  // en na intrekken kan het ook niet meer
  const m = k.mandaat.vanZaak('KIKUNOI')[0];
  k.mandaat.trekIn(m.id, 'R. Sardjoe', 'overgestapt');
  const na = klaar(k);
  assert.equal(na.status, 403);
  assert.match(na.error, /ingetrokken/i);
});

test('dezelfde inhoud geeft dezelfde zending, een andere inhoud een nieuwe', () => {
  const k = opzet();
  const een = klaar(k).zending;
  const twee = klaar(k);
  assert.equal(twee.ongewijzigd, true, 'geen tweede zending op dezelfde inhoud');
  assert.equal(twee.zending.id, een.id);

  /* De sleutel hangt aan de INHOUD en niet aan de volgorde waarin die is
     opgebouwd -- anders werkt de idempotentie niet bij de retry waarvoor hij
     bedoeld is. */
  const omgekeerd = { rubrieken: PAYLOAD.rubrieken, omzetbelastingNummer: PAYLOAD.omzetbelastingNummer, tijdvak: PAYLOAD.tijdvak };
  assert.equal(klaar(k, omgekeerd).zending.id, een.id, 'dezelfde velden in een andere volgorde is dezelfde zending');

  const anders = klaar(k, Object.assign({}, PAYLOAD, { tijdvak: '2026K4' })).zending;
  assert.notEqual(anders.id, een.id, 'andere inhoud is een nieuwe zending');
  assert.equal(k.gateway.vanZaak('KIKUNOI').length, 2, 'en de oude blijft staan als bewijs van wat er lag');
});

test('de staat gaat een kant op, en de bevestigingstak is vandaag onbereikbaar', () => {
  const k = opzet();
  const z = klaar(k).zending;

  /* EEN ONTVANGSTBEWIJS OP EEN ZENDING DIE NOOIT IS AANGEBODEN, WORDT GEWEIGERD.
     Dat is geen randgeval maar de stand van zaken: zolang de gateway inert is
     komt geen enkele zending voorbij KLAAR, dus BEVESTIGD en AFGEWEZEN zijn
     langs de gewone weg niet te bereiken. De staatmachine zegt dat zelf, en dat
     is precies wat je wilt -- een bevestiging voor iets wat nooit is weggegaan,
     hoort niet te kunnen. */
  const vroeg = k.gateway.ontvangstbewijs({ idem: z.id, aangenomen: false, reden: 'rubriek 1a ontbreekt' });
  assert.equal(vroeg.status, 409);
  assert.match(vroeg.error, /van KLAAR kan een zending alleen naar/i);
  assert.equal(k.gateway.haal(z.id).status, 'KLAAR');

  /* De controle die WEL voor de overgang komt en dus wel bereikbaar is: een
     aangenomen zending zonder kenmerk is een bevestiging zonder bewijs. */
  const leeg = k.gateway.ontvangstbewijs({ idem: z.id, aangenomen: true, kenmerk: '' });
  assert.equal(leeg.status, 400);
  assert.match(leeg.error, /zonder bewijs/i);

  // intrekken kan wel, want dat is de andere uitgang uit KLAAR
  assert.ok(k.gateway.trekIn(z.id, 'Beheer', 'toch niet').ok);
  assert.equal(k.gateway.haal(z.id).status, 'INGETROKKEN');
  const weer = k.gateway.trekIn(z.id, 'Beheer', 'nog eens');
  assert.equal(weer.status, 409);
  assert.match(weer.error, /daar vertrekt niets meer uit/i);

  /* En de overgangen die pas na aansluiting aan de beurt komen, staan als regel
     al vast -- puur te toetsen zonder dat er iets hoeft te kunnen vertrekken. */
  const st = require('../server/kern/fiscaal/gateway/staten');
  assert.equal(st.mag('AANGEBODEN', 'BEVESTIGD'), true);
  assert.equal(st.mag('AANGEBODEN', 'AFGEWEZEN'), true);
  assert.equal(st.mag('MISLUKT', 'AANGEBODEN'), true, 'een technische misser mag opnieuw');
  assert.equal(st.mag('AFGEWEZEN', 'AANGEBODEN'), false, 'een afgewezen zending niet: die inhoud deugde niet');
  assert.deepEqual(st.EINDE.slice().sort(), ['AFGEWEZEN', 'BEVESTIGD', 'INGETROKKEN']);
});

test('een ontvangstbewijs dat nergens op past, wordt bewaard', () => {
  const k = opzet();
  const r = k.gateway.ontvangstbewijs({ idem: 'zdg_bestaatniet', kenmerk: 'BD-123456', aangenomen: true });
  assert.equal(r.status, 404);
  assert.equal(r.bewaard, true);
  assert.equal(k.db.data.gatewayLosseBewijzen.length, 1);
  assert.equal(k.db.data.gatewayLosseBewijzen[0].kenmerk, 'BD-123456');
  assert.match(r.let, /signaal en geen ruis/i);
});

test('de keten verraadt een wijziging achteraf', () => {
  const k = opzet();
  const z = klaar(k).zending;
  const heel = k.gateway.controleer(z.id);
  assert.equal(heel.heel, true);
  assert.deepEqual(heel.bevindingen, []);
  assert.ok(heel.schakels >= 1);

  // de inhoud stiekem veranderen
  k.gateway.haal(z.id).payload.tijdvak = '2026K1';
  const stuk = k.gateway.controleer(z.id);
  assert.equal(stuk.heel, false);
  assert.ok(stuk.bevindingen.some(b => b.soort === 'inhoud-gewijzigd'));

  // en een schakel verdraaien
  const z2 = klaar(k, Object.assign({}, PAYLOAD, { tijdvak: '2026K4' })).zending;
  k.gateway.haal(z2.id).gebeurtenissen[0].door = 'Iemand anders';
  const stuk2 = k.gateway.controleer(z2.id);
  assert.equal(stuk2.heel, false);
  assert.ok(stuk2.bevindingen.some(b => b.soort === 'schakel-gewijzigd'));
});

test('het kanaal zegt wat het vraagt, ook nu het niet aan staat', () => {
  assert.equal(sbr.actief, false);
  assert.match(sbr.let, /voorbereid, niet aangesloten/i);
  assert.equal(sbr.ondertekening.aanwezig, false);
  assert.match(sbr.ondertekening.let, /geen rechtsgeldige handtekening/i);

  const compleet = sbr.eist({ soort: 'btw', payload: PAYLOAD });
  assert.equal(compleet.ok, true);
  const half = sbr.eist({ soort: 'btw', payload: { tijdvak: '2026K3' } });
  assert.equal(half.ok, false);
  assert.deepEqual(half.ontbreekt, ['omzetbelastingNummer', 'rubrieken']);
  assert.equal(sbr.eist({ soort: 'iets', payload: {} }).ok, false, 'een onbekende soort kent hij niet');
});

/* ------------------------------------------------------- door de API heen ---
   De scheiding die dit bestand bewaakt: de ZAAK verleent het mandaat en het
   KANTOOR leest. Als het kantoor zijn eigen mandaat kan aanmaken, is het
   register een formaliteit -- en dan is "verleend door" een tekstveld. */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

const CODE = 'KANTOOR-GATEWAY-1';
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-gateway-'));
let srv, base, kantoor, zaak;

const post = (pad, body, token) => fetch(base + pad, {
  method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' },
    token ? { Authorization: 'Bearer ' + token } : {}),
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE: CODE } });
  base = srv.base;
  kantoor = (await post('/api/office/login', { code: CODE })).body.token;
  zaak = (await post('/api/supplier/login', { username: 'rahul', password: 'Imran' })).body.token;
});
test.after(() => { stop(srv && srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

test('het mandaat komt van de zaak, en de naam uit het token', async () => {
  assert.ok(zaak, 'de zaak is ingelogd');

  const uit = await post('/api/supplier/gateway/mandaat',
    { soort: 'btw', van: '2026-01-01', tot: '2026-12-31', rol: 'eigenaar', doorNaam: 'IEMAND ANDERS' }, zaak);
  assert.equal(uit.status, 200, uit.body.error);
  /* De naam in het lijf wordt genegeerd: hij komt uit het token. Anders is
     "verleend door" een tekstveld. */
  assert.notEqual(uit.body.mandaat.doorNaam, 'IEMAND ANDERS');
  assert.ok(uit.body.mandaat.doorNaam.length >= 2);
  assert.equal(uit.body.mandaat.soort, 'btw');

  const lijst = await post('/api/supplier/gateway/mandaten', {}, zaak);
  assert.equal(lijst.status, 200);
  assert.ok(lijst.body.mandaten.some(m => m.id === uit.body.mandaat.id));

  // en het kantoor kan er geen bij maken: die route bestaat niet
  const viaKantoor = await post('/api/supplier/gateway/mandaat',
    { soort: 'btw', van: '2026-01-01' }, kantoor);
  assert.ok([401, 403].includes(viaKantoor.status), 'het kantoor verleent geen mandaat namens de zaak');
});

test('er is geen route om iets aan te bieden', async () => {
  /* Niet vergeten maar weggelaten: er kan vandaag niets weg, en een knop die
     altijd afketst is een knop die niet had moeten staan. */
  for (const pad of ['/api/supplier/gateway/aanbieden', '/api/office/gateway/aanbieden',
    '/api/supplier/gateway/verstuur', '/api/office/gateway/verstuur']) {
    const r = await post(pad, { id: 'x' }, kantoor);
    assert.equal(r.status, 404, pad + ' hoort niet te bestaan');
  }
});

test('zonder token komt er niets uit de gateway-routes', async () => {
  for (const pad of ['/api/supplier/gateway/mandaat', '/api/supplier/gateway/mandaten',
    '/api/supplier/gateway/zendingen', '/api/office/gateway/zendingen', '/api/office/gateway/controleer']) {
    assert.equal((await post(pad, {})).status, 401, pad + ' zonder token');
    assert.equal((await post(pad, {}, 'nep-token')).status, 401, pad + ' met een verzonnen token');
  }
});
