/* DE DAGCHECK-IN VOOR DE VLOER -- en vooral: wat de werkgever NIET ziet.

   ONDERNEMEN.md par. 7 vond het gat: kern/gemoed.js hing aan `auth` (de
   LEDENsessie) terwijl personeel op `supplierAuth` binnenkomt, dus een
   medewerker zonder RTG-lidmaatschap kon er niet bij. De deur staat er nu; deze
   toets bewaakt de grens die eromheen hoort.

   DE DRAGENDE TOETSEN ZIJN 2 EN 3, en ze meten twee verschillende dingen.
   Toets 2 zegt dat het BEDRIJFSaccount niets krijgt (de baas is geen mens met
   een dagboek). Toets 3 zegt dat een COLLEGA met een geldige persoonlijke login
   niets van een ander ziet -- dat is de sleutel, niet de deur, en een toets die
   alleen 2 doet zou groen blijven terwijl alle medewerkers hetzelfde dagboek
   delen.

   TOETS 5 IS DE TEGENPROEF. Een laag die alles weigert haalt 2 en 3 ook, en is
   stuk. Er moet dus ook worden bewezen dat de goede weg WERKT: schrijven, direct
   teruglezen, en weghalen.

   Draai los: node --test test/staffgemoed.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

function verseDataDir() { return fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-sg-')); }
async function api(base, pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  const r = await fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}

/* Twee VERSCHILLENDE medewerkers van dezelfde zaak, plus het bedrijfsaccount.
   Zonder die twee is toets 3 niet te stellen. */
async function wereld(base) {
  /* TWEE VERSCHILLENDE MENSEN BIJ DEZELFDE ZAAK, en ze komen met opzet langs twee
     verschillende deuren binnen -- dat is wat de zaaiset biedt. Nora heeft een
     persoonlijk RTG-account (de moderne weg); Mateo is de manager en komt met de
     personeelspin. Beiden staan op het rooster van KIKUNOI, met een eigen
     staffId, en dat is precies wat toets 3 nodig heeft. */
  const roster = (await api(base, '/api/supplier/roster', { code: 'KIKUNOI' })).body;
  const lijst = (roster.staff || []).filter(x => x && x.id != null);
  const manager = lijst.find(x => x.role === 'manager');
  assert.ok(manager, 'de zaaiset hoort een manager bij KIKUNOI te hebben');

  const a = (await api(base, '/api/supplier/mijn/login', { login: 'nora@rtg.example', password: 'werk' })).body.token;
  const b = (await api(base, '/api/supplier/login', { code: 'KIKUNOI', staffId: manager.id, pin: '1234' })).body.token;
  const zaak = (await api(base, '/api/supplier/login', { username: 'rahul', password: 'Imran' })).body.token;
  assert.ok(a, 'Nora is ingelogd met haar persoonlijke RTG-account');
  assert.ok(b, 'de manager is ingelogd met zijn eigen staffId');
  assert.ok(zaak, 'het bedrijfsaccount is ingelogd');
  return { a, b, zaak };
}

test('1. een medewerker met een persoonlijke login kan zijn dag vastleggen en teruglezen', async () => {
  const TMP = verseDataDir();
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  try {
    const { a } = await wereld(base);
    const zet = await api(base, '/api/staff/gemoed/zet', { stemming: 'zwaar', notitie: 'drukke dienst' }, a);
    assert.equal(zet.status, 200, 'vastleggen lukt: ' + JSON.stringify(zet.body));
    assert.equal(zet.body.ok, true);

    const van = await api(base, '/api/staff/gemoed', {}, a);
    assert.equal(van.status, 200);
    /* OP `vandaagIngevuld` EN NIET OP DE TEKST VAN HET ANTWOORD. Het antwoord
       draagt ook `stemmingen`: de vaste KEUZELIJST, waarin het woord "zwaar"
       altijd staat. Een assertie op includes('zwaar') is daarmee altijd waar --
       een toets die niet kan zakken. Die stond hier eerst. */
    assert.ok(van.body.vandaagIngevuld, 'de dag van vandaag hoort ingevuld te zijn');
    assert.equal(van.body.vandaagIngevuld.stemming, 'zwaar');
    assert.equal(van.body.vandaagIngevuld.notitie, 'drukke dienst');
  } finally { await stop(child); fs.rmSync(TMP, { recursive: true, force: true }); }
});

test('2. het BEDRIJFSaccount krijgt niets -- niet lezen, niet schrijven, niet wissen', async () => {
  const TMP = verseDataDir();
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  try {
    const { a, zaak } = await wereld(base);
    await api(base, '/api/staff/gemoed/zet', { stemming: 'zwaar', notitie: 'drukke dienst' }, a);

    for (const pad of ['/api/staff/gemoed', '/api/staff/gemoed/zet', '/api/staff/gemoed/weg']) {
      const r = await api(base, pad, { stemming: 'goed' }, zaak);
      assert.equal(r.status, 403, pad + ' hoort 403 te geven voor het bedrijfsaccount, kreeg ' + r.status);
      assert.ok(!JSON.stringify(r.body).includes('zwaar'),
        pad + ' lekt de stemming van een medewerker naar de werkgever');
    }
  } finally { await stop(child); fs.rmSync(TMP, { recursive: true, force: true }); }
});

test('3. een COLLEGA met een geldige login ziet niets van een ander', async () => {
  const TMP = verseDataDir();
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  try {
    const { a, b } = await wereld(base);
    await api(base, '/api/staff/gemoed/zet', { stemming: 'zwaar', notitie: 'geheim van A' }, a);

    /* EERST DE VULCONTROLE. Zonder haar is "de lijst van B is leeg" een
       bewering die ook waar is als de lijst NOOIT vult -- dan staat deze toets
       groen boven een kapotte laag (scripts/tandeloos.js). Dus eerst vaststellen
       dat A's eigen lijst wel degelijk gevuld is. */
    const vanA = (await api(base, '/api/staff/gemoed', {}, a)).body;
    assert.equal(vanA.recent.length, 1, 'de lijst van A hoort juist WEL gevuld te zijn');

    const vanB = await api(base, '/api/staff/gemoed', {}, b);
    assert.equal(vanB.status, 200, 'B mag zijn EIGEN dagboek wel openen');
    /* De vergelijking gaat over de EIGEN dagen van B en niet over de tekst van
       het antwoord: `stemmingen` is de vaste keuzelijst en bevat "zwaar" altijd.
       Daarop toetsen liet deze toets zakken terwijl er niets lekte. */
    assert.equal(vanB.body.vandaagIngevuld, null,
      'B heeft zelf niets ingevuld en hoort dus niets te zien; nu staat er: ' + JSON.stringify(vanB.body.vandaagIngevuld));
    assert.deepEqual(vanB.body.recent, [], 'het dagboek van B hoort leeg te zijn');
    assert.ok(!JSON.stringify(vanB.body).includes('geheim van A'),
      'de notitie van A komt bij B terecht -- dan staat de sleutel op de zaak en niet op de mens');
  } finally { await stop(child); fs.rmSync(TMP, { recursive: true, force: true }); }
});

test('4. de grens van zorgniveau.js komt ook door DEZE deur', async () => {
  const TMP = verseDataDir();
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  try {
    const { a } = await wereld(base);
    /* Dezelfde vorm die kern/zorgniveau.js op de ledenweg tegenhoudt. Slaat hij
       aan, dan komt er GEEN tip en GEEN oefening terug -- alleen de weg naar
       hulp. Zou deze deur de grens overslaan, dan is er een tweede weg naar
       dezelfde laag met een ander veiligheidsmodel, en dat is precies wat
       kern/gemoed.js hergebruiken moest voorkomen. */
    /* EERST DE VULCONTROLE, en die is hier meer dan een formaliteit: zij maakt
       van deze toets een VERGELIJKING in plaats van een bewering. Een gewone dag
       levert wel degelijk oefeningen op; pas daarnaast betekent een lege lijst
       iets. Zonder dit zou de toets ook slagen als `doen` altijd leeg was. */
    let r = await api(base, '/api/staff/gemoed/zet',
      { stemming: 'gemiddeld', notitie: 'gewone dag' }, a);
    assert.equal(r.body.mag, true, 'een gewone dag hoort gewoon door te komen');
    assert.ok(r.body.doen.length > 0, 'en dan staan er wel degelijk dingen om te doen');

    r = await api(base, '/api/staff/gemoed/zet',
      { stemming: 'zwaar', notitie: 'ik wil niet meer leven' }, a);
    assert.equal(r.status, 200);
    assert.equal(r.body.mag, false,
      'de grens sloeg niet aan op deze deur; dan geldt het veiligheidsmodel maar voor een van de twee wegen');
    assert.deepEqual(r.body.doen, [], 'bij een aangeslagen grens hoort er geen tip of oefening terug te komen');
    assert.ok(r.body.escalatie, 'er hoort een weg naar echte hulp bij te staan');
  } finally { await stop(child); fs.rmSync(TMP, { recursive: true, force: true }); }
});

test('5. TEGENPROEF: de goede weg werkt echt -- schrijven, lezen, wissen', async () => {
  const TMP = verseDataDir();
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  try {
    const { a } = await wereld(base);
    await api(base, '/api/staff/gemoed/zet', { stemming: 'goed', notitie: 'prima dag' }, a);
    const na = (await api(base, '/api/staff/gemoed', {}, a)).body;
    assert.ok(na.vandaagIngevuld && na.vandaagIngevuld.notitie === 'prima dag',
      'wat er net is opgeschreven hoort er te staan');
    assert.equal(na.recent.length, 1, 'precies een dag');

    const weg = await api(base, '/api/staff/gemoed/weg', {}, a);
    assert.equal(weg.status, 200, 'weghalen hoort te lukken: wat je opschreef is van jou');
    const leeg = (await api(base, '/api/staff/gemoed', {}, a)).body;
    assert.equal(leeg.vandaagIngevuld, null, 'na het wissen staat er niets meer');
    assert.deepEqual(leeg.recent, [], 'en de dag is ook uit de reeks weg');
  } finally { await stop(child); fs.rmSync(TMP, { recursive: true, force: true }); }
});

test('6. er is geen overzichts- of managerroute, en die afwezigheid is het ontwerp', () => {
  /* DE TOELICHTING GAAT ER EERST UIT, en dat is geen nettigheid: de eerste versie
     van deze toets zakte op het woord "overzichtsroute" in de KOP van het bestand
     dat hij bewaakt. Een wacht die zijn eigen commentaar leest, meet niets --
     BEWIJSMACHINE.md par. 6a, hier prompt herhaald. */
  const ruw = fs.readFileSync(path.join(__dirname, '..', 'server', 'routes', 'gemoed.js'), 'utf8');
  const bron = ruw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  assert.ok(!/managerOnly/.test(bron),
    'deze laag mag geen managerroute kennen: een overzicht van stemmingen per zaak is precies wat hier niet mag bestaan');
  assert.ok(!/listStaff|overzicht/.test(bron),
    'geen opsomming over medewerkers heen');
  /* En de sleutel draagt de MENS. Zou hij alleen de zaakcode dragen, dan halen
     toets 2 en 3 het nog steeds op de deur terwijl de opslag gedeeld is. */
  assert.ok(/req\.actor\.staffId/.test(bron), 'de sleutel hoort de staffId te bevatten');
});

/* DE DUBBELTIK, EN HIJ STAAT HIER OMDAT HET CONTRACT EROP RUST.
   server/lib/mutatiecontracten-staffgemoed.js verklaart deze drie routes, en
   MUTATIECONTRACT.md is streng over de volgorde: een stand wordt NOOIT afgeleid
   uit een aanname over de code maar uit een meting. Dit is die meting; zakt hij,
   dan klopt het contract niet meer en hoort het te worden herzien -- niet deze
   toets. */
test('7. de dubbeltik: wat een TWEEDE identieke aanroep werkelijk doet', async () => {
  const TMP = verseDataDir();
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  try {
    const { a } = await wereld(base);

    // zet: twee keer hetzelfde laat exact een dag achter, met dezelfde inhoud
    await api(base, '/api/staff/gemoed/zet', { stemming: 'gemiddeld', notitie: 'zelfde' }, a);
    const een = (await api(base, '/api/staff/gemoed', {}, a)).body;
    await api(base, '/api/staff/gemoed/zet', { stemming: 'gemiddeld', notitie: 'zelfde' }, a);
    const twee = (await api(base, '/api/staff/gemoed', {}, a)).body;
    assert.equal(twee.recent.length, 1, 'een tweede identieke zet hoort geen tweede dag te maken');
    assert.deepEqual(twee.vandaagIngevuld, een.vandaagIngevuld, 'en ook de inhoud hoort gelijk te blijven');

    // lezen verandert niets: de opslagstand is voor en na gelijk
    const voor = (await api(base, '/api/staff/gemoed', {}, a)).body;
    const na = (await api(base, '/api/staff/gemoed', {}, a)).body;
    assert.deepEqual(na.recent, voor.recent, 'lezen hoort de opslag niet te raken');

    // weg: de tweede keer is een TOESTANDSCONTROLE en geen duplicaatlaag --
    // de stand is gelijk, maar het antwoord zegt eerlijk dat er niets stond.
    assert.equal((await api(base, '/api/staff/gemoed/weg', {}, a)).status, 200, 'de eerste keer wist');
    const tweedeWeg = await api(base, '/api/staff/gemoed/weg', {}, a);
    assert.equal(tweedeWeg.status, 404, 'de tweede keer meldt dat er niets stond');
    assert.deepEqual((await api(base, '/api/staff/gemoed', {}, a)).body.recent, [],
      'en de stand is na twee keer wissen dezelfde als na een keer');
  } finally { await stop(child); fs.rmSync(TMP, { recursive: true, force: true }); }
});
