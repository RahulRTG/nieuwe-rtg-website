/* De CDT-laag: rittenregistratie en arbeids-, rij- en rusttijden voor het
   Nederlandse taxivervoer. Draai los:
   node --experimental-sqlite --test test/cdt.test.js

   Wat deze toetsen bewaken:

   1. Zonder chauffeurskaart geen registratie. Fail-closed, want een registratie
      die niemand identificeert legt iets vast waar niemand iets aan heeft.
   2. De tijdlijn heeft geen gaten: er is altijd precies EEN open blok, en de
      optelsom klopt met de blokken.
   3. De signalen noemen hun eigen rekensom, en een nette dienst levert er GEEN
      op -- anders kan de meter niet zakken.
   4. De export is herhaalbaar en heeft een vingerafdruk die verandert zodra de
      gegevens veranderen.
   5. HET SYSTEEM LIEGT NIET OVER DE KOPPELING. Er is geen weg om te zeggen dat
      er aan de CDT is geleverd, want dat loopt via een ICT-dienstverlener die
      aan de ILT-eisen voldoet en dat is RTG niet. Wat vastgelegd wordt is een
      OVERDRACHT, en het antwoord zegt dat er met zoveel woorden bij. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');
const T = require('../server/kern/mobiliteit/cdt-tijden');

let srv, base, pda, baas;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-cdt-'));
const KAART = 'NL-12345678';

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  const roster = await api('/api/supplier/roster', { code: 'MKKX' });
  const ch = (roster.body.staff || []).find(x => x.role !== 'manager');
  const mg = (roster.body.staff || []).find(x => x.role === 'manager');
  pda = (await api('/api/supplier/login', { code: 'MKKX', staffId: ch.id, pin: '5678' })).body.token;
  baas = (await api('/api/supplier/login', { code: 'MKKX', staffId: mg.id, pin: '1234' })).body.token;
  assert.ok(pda && baas, 'chauffeur en manager zijn ingelogd');
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

/* De rekenlaag is puur en wordt daarom rechtstreeks getoetst: geen server, geen
   klok, geen database. Zo is elke bewering hieronder een som die je op papier
   kunt narekenen. */
test('1. de tijdenrekening: de som klopt met de blokken', () => {
  const u = (h, m = 0) => new Date(Date.UTC(2026, 7, 6, h, m)).toISOString();
  const som = T.tel([
    { soort: 'ander', van: u(6), tot: u(7) },          // 60 min arbeid, geen rijtijd
    { soort: 'rijden', van: u(7), tot: u(12) },        // 300 min arbeid en rijtijd
    { soort: 'pauze', van: u(12), tot: u(12, 30) },    // 30 min pauze, telt nergens in
    { soort: 'rijden', van: u(12, 30), tot: u(18, 30) } // 360 min arbeid en rijtijd
  ], new Date(u(18, 30)).getTime());
  assert.equal(som.arbeidMin, 720, 'arbeidstijd = 60 + 300 + 360, pauze telt niet mee');
  assert.equal(som.rijMin, 660, 'rijtijd = 300 + 360');
  assert.equal(som.pauzeMin, 30);
  assert.equal(som.langstePauze, 30);
});

test('2. de signalen noemen hun rekensom, en een nette dienst geeft er geen', () => {
  const u = (h, m = 0) => new Date(Date.UTC(2026, 7, 6, h, m)).toISOString();
  /* Een nette dienst: 7,25 uur arbeid waarvan 7,25 uur rijden, met 45 minuten
     pauze. Deze regel is de belangrijkste van de twee -- een meter die altijd
     uitslaat, meet niets. */
  const net = T.tel([
    { soort: 'rijden', van: u(8), tot: u(12) },
    { soort: 'pauze', van: u(12), tot: u(12, 45) },
    { soort: 'rijden', van: u(12, 45), tot: u(16) }
  ], new Date(u(16)).getTime());
  assert.deepEqual(T.signalen(net, {}), [], 'een dienst binnen de grenzen geeft geen signaal');

  // en een te lange dienst wel, met de getallen erin
  const lang = T.tel([
    { soort: 'rijden', van: u(6), tot: u(17) },
    { soort: 'pauze', van: u(17), tot: u(17, 30) },
    { soort: 'ander', van: u(17, 30), tot: u(19) }
  ], new Date(u(19)).getTime());
  const sig = T.signalen(lang, {});
  const ids = sig.map(s => s.id);
  assert.ok(ids.includes('arbeidstijd'), 'de arbeidstijd slaat aan');
  assert.ok(ids.includes('rijtijd'), 'de rijtijd ook');
  for (const s of sig) {
    assert.ok(/\d/.test(s.tekst), 'elk signaal noemt getallen: ' + s.tekst);
    assert.ok(/grens staat op/.test(s.tekst), 'en de grens waaraan het is getoetst: ' + s.tekst);
  }

  // te weinig pauze na lang rijden
  const zonderPauze = T.tel([{ soort: 'rijden', van: u(6), tot: u(13) }], new Date(u(13)).getTime());
  assert.ok(T.signalen(zonderPauze, {}).some(s => s.id === 'pauze'), 'zonder pauze na 7 uur rijden slaat hij aan');

  // en de grenzen zijn instelbaar: een strenger regime ziet meer
  assert.ok(T.signalen(net, { rijtijdPerDienst: 60 }).some(s => s.id === 'rijtijd'),
    'met een strengere grens slaat dezelfde dienst wel aan');
});

test('3. de dagelijkse rust wordt tussen twee diensten gemeten', () => {
  const u = h => new Date(Date.UTC(2026, 7, 6, h)).toISOString();
  assert.equal(T.rustSignaal(new Date(u(2)).getTime(), new Date(u(20)).getTime(), {}), null,
    '18 uur rust is ruim genoeg');
  const kort = T.rustSignaal(new Date(u(2)).getTime(), new Date(u(8)).getTime(), {});
  assert.ok(kort, '6 uur rust is te weinig');
  assert.match(kort.tekst, /6 uur/, 'en hij noemt hoeveel het was');
  assert.match(kort.tekst, /10 uur/, 'en waar de grens ligt');
});

test('4. zonder chauffeurskaart geen registratie', async () => {
  const leeg = await api('/api/staff/mob/cdt/aanmelden', {}, pda);
  assert.equal(leeg.status, 400);
  assert.match(leeg.body.error, /chauffeurskaart/);
  const rommel = await api('/api/staff/mob/cdt/aanmelden', { chauffeurskaart: 'ab' }, pda);
  assert.equal(rommel.status, 400, 'een kaartnummer van twee tekens is geen kaartnummer');

  const goed = await api('/api/staff/mob/cdt/aanmelden', { chauffeurskaart: KAART, voertuig: 'wagen1' }, pda);
  assert.equal(goed.status, 200, goed.body.error || '');
  assert.equal(goed.body.dienst.chauffeurskaart, KAART);
  assert.equal(goed.body.dienst.lopend, true);

  const dubbel = await api('/api/staff/mob/cdt/aanmelden', { chauffeurskaart: KAART }, pda);
  assert.equal(dubbel.status, 409, 'twee lopende diensten op een kaart kan niet');
});

test('5. de tijdlijn heeft geen gaten: precies een open blok', async () => {
  for (const soort of ['rijden', 'pauze', 'rijden']) {
    const r = await api('/api/staff/mob/cdt/soort', { chauffeurskaart: KAART, soort }, pda);
    assert.equal(r.status, 200, soort + ': ' + (r.body.error || ''));
    assert.equal(r.body.dienst.huidigeSoort, soort);
    const open = r.body.dienst.blokken.filter(b => b.open);
    assert.equal(open.length, 1, 'er is altijd precies EEN open blok, anders lopen de tellingen mis');
  }
  const zelfde = await api('/api/staff/mob/cdt/soort', { chauffeurskaart: KAART, soort: 'rijden' }, pda);
  assert.equal(zelfde.status, 409, 'twee keer dezelfde soort achter elkaar is geen overgang');
  const onzin = await api('/api/staff/mob/cdt/soort', { chauffeurskaart: KAART, soort: 'zweven' }, pda);
  assert.equal(onzin.status, 400);

  const af = await api('/api/staff/mob/cdt/afmelden', { chauffeurskaart: KAART }, pda);
  assert.equal(af.status, 200);
  assert.equal(af.body.dienst.lopend, false);
  assert.ok(af.body.dienst.blokken.every(b => !b.open), 'na afmelden staat er geen blok meer open');
  const nogmaals = await api('/api/staff/mob/cdt/afmelden', { chauffeurskaart: KAART }, pda);
  assert.equal(nogmaals.status, 404, 'afmelden zonder lopende dienst kan niet');
});

test('6. het bord van de onderneming toont de dienst en de gehanteerde grenzen', async () => {
  const bord = await api('/api/supplier/mob/cdt', {}, baas);
  assert.equal(bord.status, 200);
  assert.ok(bord.body.afgerond.length >= 1, 'de afgeronde dienst staat erop');
  assert.equal(bord.body.grenzen.arbeidstijdPerDienst, 12 * 60, 'standaard 12 uur arbeidstijd');
  assert.deepEqual(bord.body.standaardGrenzen, T.GRENZEN, 'en de standaard staat erbij ter vergelijking');

  // het regime is een besluit van de werkgever, niet van de chauffeur
  const chauffeur = await api('/api/supplier/mob/cdt/regime', { grenzen: { rijtijdPerDienst: 480 } }, pda);
  assert.equal(chauffeur.status, 403, 'een chauffeur schuift niet aan zijn eigen grenzen');
  const onzin = await api('/api/supplier/mob/cdt/regime', { grenzen: { verzonnen: 10 } }, baas);
  assert.equal(onzin.status, 400, 'een onbekende grens wordt geweigerd, niet stil genegeerd');
  const zet = await api('/api/supplier/mob/cdt/regime', { grenzen: { rijtijdPerDienst: 480 } }, baas);
  assert.equal(zet.status, 200);
  assert.equal(zet.body.grenzen.rijtijdPerDienst, 480, 'de eigen grens staat');
  assert.equal(zet.body.grenzen.arbeidstijdPerDienst, 12 * 60, 'en de rest blijft op de standaard staan');
});

test('7. de export: herhaalbaar, met een vingerafdruk die meebeweegt', async () => {
  const eerste = await api('/api/supplier/mob/cdt/export', {}, baas);
  assert.equal(eerste.status, 200, eerste.body.error || '');
  assert.ok(eerste.body.export.hash && eerste.body.export.hash.length === 64, 'een sha256 over de inhoud');
  assert.ok(eerste.body.inhoud.diensten.length >= 1, 'de dienst zit in de export');

  const d = eerste.body.inhoud.diensten[0];
  assert.equal(d.chauffeurskaart, KAART, 'de kaart identificeert de registratie');
  assert.ok('arbeidMinuten' in d && 'rijMinuten' in d && 'pauzeMinuten' in d, 'de tijden staan erin');
  /* Wat er NIET in staat is net zo belangrijk: een arbeidstijdenregistratie
     hoort geen bestemmingen, codenamen of bedragen te bevatten. Wat je niet
     uitlevert, kan ook niet uitlekken. */
  const tekst = JSON.stringify(eerste.body.inhoud);
  assert.ok(!/prijs|codenaam|bestemming|label/.test(tekst), 'geen prijzen, codenamen of bestemmingen in de export');

  // dezelfde gegevens geven dezelfde vingerafdruk
  const tweede = await api('/api/supplier/mob/cdt/export', {}, baas);
  assert.equal(tweede.body.export.hash, eerste.body.export.hash, 'ongewijzigde gegevens geven dezelfde hash');

  // en een nieuwe dienst verandert hem
  await api('/api/staff/mob/cdt/aanmelden', { chauffeurskaart: 'NL-99999999' }, pda);
  await api('/api/staff/mob/cdt/afmelden', { chauffeurskaart: 'NL-99999999' }, pda);
  const derde = await api('/api/supplier/mob/cdt/export', {}, baas);
  assert.notEqual(derde.body.export.hash, eerste.body.export.hash, 'gewijzigde gegevens geven een andere hash');

  const chauffeur = await api('/api/supplier/mob/cdt/export', {}, pda);
  assert.equal(chauffeur.status, 403, 'de export is van de onderneming, niet van de chauffeur');
});

test('8. het systeem liegt niet over de koppeling met de CDT', async () => {
  const e = await api('/api/supplier/mob/cdt/export', {}, baas);
  const k = e.body.koppeling;
  assert.equal(k.gekoppeld, false, 'RTG levert niet rechtstreeks aan de CDT');
  assert.match(k.uitleg, /ICT-dienstverlener/, 'en legt uit langs welke weg het wel moet');
  assert.equal(k.vanaf, '2028-01-01', 'met de datum waarop het verplicht wordt');

  // overdragen kan pas als er een dienstverlener bekend is
  const zonder = await api('/api/supplier/mob/cdt/overdracht', { id: e.body.export.id }, baas);
  assert.equal(zonder.status, 409);
  assert.match(zonder.body.error, /dienstverlener/);

  const dv = await api('/api/supplier/mob/cdt/dienstverlener',
    { naam: 'Voorbeeld ICT B.V.', registratie: 'ILT-0001' }, baas);
  assert.equal(dv.status, 200);
  assert.match(dv.body.let, /controleert deze registratie niet/,
    'RTG doet niet alsof het de ILT-registratie van een derde heeft gecontroleerd');

  const over = await api('/api/supplier/mob/cdt/overdracht', { id: e.body.export.id, notitie: 'per portaal' }, baas);
  assert.equal(over.status, 200, over.body.error || '');
  assert.equal(over.body.overdracht.dienstverlener, 'Voorbeeld ICT B.V.');
  assert.equal(over.body.overdracht.hash, e.body.export.hash, 'de overdracht legt vast WELK bestand is gegeven');
  /* En de zin die het verschil maakt tussen een systeem dat helpt en een dat
     schijnzekerheid geeft: wij weten niet of de CDT het heeft aanvaard. */
  assert.match(over.body.let, /RTG kan dat niet zien/);
  assert.ok(over.body.export.overdrachten.length === 1, 'de overdracht staat in het journaal');

  // er bestaat geen route die zegt dat er is aangeleverd
  const verzend = await api('/api/supplier/mob/cdt/verzenden', { id: e.body.export.id }, baas);
  assert.equal(verzend.status, 404, 'er is geen "verzenden naar de CDT"-knop, en die hoort er ook niet te zijn');
});
