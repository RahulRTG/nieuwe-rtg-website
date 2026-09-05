/* DE BEVEILIGINGS-AS IN DE HTTP-KETEN -- telt hij, en houdt hij niets tegen?

   HET GAT DAT DIT SLUIT. De isolatiestand per drager werd nergens in de
   verzoekketen afgedwongen: middleware/functieschakelaars.js las alleen het
   HUIS-veld, en isolatie.besluit() werd alleen aangeroepen door het AI-filter,
   een proefroute en een meter. Een lid dat zichzelf op `isolatie` zette,
   versmalde alleen de lijst waaruit het model kiest -- zijn gewone HTTP-paden
   bleven open, terwijl het scherm zei dat het meteen werkte.

   WAT DEZE TOETS BEWIJST, en de tweede is de belangrijkste:
   1. de poort WEEGT: hij ziet een verzoek van een account met een stand;
   2. de poort BIJT NIET: in de schaduw loopt het verzoek gewoon door. Dat is
      geen tekortkoming maar het besluit (CONTROLPLANE.md: je kunt niet
      afdwingen wat nooit heeft meegelopen), en het hoort net zo hard te worden
      vastgelegd als het bijten zelf -- anders gaat de vlag ooit stilletjes om;
   3. met de vlag om houdt hij WEL tegen, en met een uitgeschreven reden;
   4. de UITGANG blijft altijd open, ook met de vlag om. Een stand zonder uitgang
      is een val, en de val ontstaat hier precies zodra iemand een van die paden
      een functie in de catalogus geeft.

   WAAROM DIT TEGEN DE MODULE DRAAIT EN NIET TEGEN EEN SERVER. De poort draagt
   MODULESTAND (de late binding van de laag), en de servertoetsen draaien in een
   KIND-proces: een toets die de server vraagt en zijn eigen register nakijkt,
   vergelijkt twee processen. Die fout is in test/isolatie-lid.test.js toets 8
   echt gemaakt. Hier wordt daarom de middleware zelf aangeroepen, met een
   nagebootst verzoek.

   MUTATIES die zijn gedraaid en welke toets erop zakte (LAT.md regel 2):
   - `if (!bijt) return null;` weghalen in isolatiepoort.js -> 2 ZAKT (de poort
     bijt dan in de schaduw, en dat is precies de stille omzetting).
   - de openpaden-controle uit weeg() halen -> 4 ZAKT (RAAK).
   - de GET-snelweg weghalen -> geen enkele toets zakt, en dat hoort: hij is een
     versnelling en geen regel. Zie toets 5 voor wat hem wél bewaakt.

   Draai los: node --test test/isolatiepoort.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

const poort = require('../server/middleware/isolatiepoort');
const maakIsolatie = require('../server/kern/isolatie');
const functies = require('../server/functies');

/* Een isolatielaag met EEN lid in isolatie, en een nagebootst verzoek van dat
   lid. Alleen wat de echte deur ook levert: een sessie en de Authorization-kop. */
function opstelling({ afdwingen, stand }) {
  const iso = maakIsolatie({ db: { data: {} }, save() {}, functies, klok: null, huisStand: () => 'normaal' });
  iso.zet({ drager: 'identiteit', sleutel: 'user-7', naar: stand || 'isolatie',
    door: 'toets', reden: 'meting van de HTTP-poort' });
  poort._wisTelling();
  poort.zetLaag(iso, { afdwingen: !!afdwingen });
  return iso;
}
function verzoek(pad, methode) {
  return { path: pad, method: methode || 'POST', session: { key: 'user-7' },
    get: (h) => (String(h).toLowerCase() === 'authorization' ? 'Bearer tok-7' : '') };
}

test.after(() => { poort.zetLaag(null); poort._wisTelling(); });

test('1. de poort weegt een verzoek van een account met een stand', () => {
  opstelling({ afdwingen: false });
  poort.weeg(verzoek('/api/pay/stuur'), {});
  const s = poort.stand();
  assert.ok(s.gewogen > 0, 'de poort hoort dit verzoek te hebben gewogen: ' + JSON.stringify(s));
  assert.ok(s.zouSluiten > 0, 'en te zien dat hij het zou sluiten');
  assert.ok(s.voorbeelden.some(v => v.includes('/api/pay/stuur')));
  assert.deepEqual(Object.keys(s.perDrager), ['identiteit'],
    'en te zeggen WELKE drager het sluit, want anders is de telling niet te gebruiken');
});

test('2. in de schaduw houdt hij NIETS tegen', () => {
  opstelling({ afdwingen: false });
  const uit = poort.weeg(verzoek('/api/pay/stuur'), {});
  assert.equal(uit, null,
    'de schaduw telt en blokkeert niet; wie dit omdraait, zet de vlag stilletjes om');
  assert.equal(poort.stand().bijt, false);
  assert.equal(poort.stand().modus, 'schaduw');
  assert.equal(poort.stand().afdwingen, false, 'schaduw is geen handhaving');
  /* En de telling is WEL bewogen -- anders zou "hij houdt niets tegen" ook waar
     zijn voor een poort die helemaal niet kijkt. */
  assert.ok(poort.stand().zouSluiten > 0);
});

test('3. met de vlag om houdt hij tegen, met een reden', () => {
  opstelling({ afdwingen: true });
  const uit = poort.weeg(verzoek('/api/pay/stuur'), {});
  assert.ok(uit, 'met afdwingen hoort hij te sluiten');
  assert.equal(uit.been, 'drager');
  assert.equal(uit.antwoord.as, 'isolatie', 'het scherm moet weten dat dit dezelfde as is');
  assert.ok(String(uit.antwoord.waarom || '').length > 20, 'een verhindering draagt altijd een reden');
  assert.match(String(uit.antwoord.uitweg), /Mijn bescherming/,
    'en zegt hoe je er weer uit komt; een weigering zonder uitweg is een val');
  assert.deepEqual(uit.antwoord.dragers, ['identiteit']);
});

const UITGANGEN = ['/api/isolatie/mijn', '/api/isolatie/mijn/zet',
  '/api/isolatie/mijn/ontsluiting', '/api/isolatie/mijn/ontsluiting/commit',
  '/api/privacy/inzage', '/api/verblijf/deur', '/api/foundation/gezin/inloggen'];

test('4. de uitgang blijft open, OOK met de vlag om', () => {
  opstelling({ afdwingen: true });
  for (const pad of UITGANGEN) {
    assert.equal(poort.weeg(verzoek(pad), {}), null,
      pad + ' hoort altijd open te blijven: een stand zonder uitgang is een val');
  }
});

test('4b. de uitgang overleeft de DRAGER, en het HUIS overrulet de uitgang', () => {
  /* TWEE BEWERINGEN DIE MAKKELIJK EEN WORDEN, en het verschil is een echte fout
     die ik in de eerste versie heb gemaakt.

     WAT TOETS 4 NIET MAT: de openpaden-controle uit weeg() halen liet hem groen,
     want vandaag laat `besluit()` diezelfde paden toch al door -- ze staan in
     EIGEN_UITGANG, dus de leesset redt ze een laag lager. De controle in de poort
     beschermt tegen MORGEN: zodra een van die paden een functie krijgt, sluit het
     drager-been ze. Dat wordt hieronder gemeten met een besluitlaag die alles
     sluit.

     WAT DE EERSTE VERSIE FOUT DEED: hij zette de uitgangen voor BEIDE benen, dus
     ook voor het huis. Dat is SEC-LOCK-003 overtreden -- een vrijstellingslijst
     uit de ledenlaag die het oordeel van de eigenaar overrulet is een lagere
     drager die een hogere neutraliseert. Vandaag maakte het geen verschil (geen
     van de twintig paden wordt onder `beschermd` door houdtTegen gesloten), en
     juist daarom was het het moment om de volgorde goed te zetten.

     MUTATIES: de openpaden-controle uit weeg() halen -> deel 1 ZAKT. De controle
     terugzetten VOOR het huis-been -> deel 2 ZAKT. */
  const db = { data: { techniek: { incidentcontrole: { modus: 'beschermd' } } } };
  const allesDicht = { houdtTegen: () => ({ functie: 'verzonnen', naam: 'Alles',
    categorie: 'Geld', waarom: 'een beschermstand die alles sluit' }) };

  /* 1. TEGEN DE DRAGER blijft de uitgang open -- ook als het drager-oordeel alles
        zou sluiten. Dit is de val die deze laag al twee keer heeft gerepareerd:
        een lid dat zichzelf dichtzette en er niet meer uit kon. */
  const iso = opstelling({ afdwingen: true });
  const echteBesluit = iso.besluit;
  iso.besluit = () => ({ toegestaan: false, reden: 'PROEF', uitleg: 'alles dicht', dragers: [] });
  try {
    for (const pad of UITGANGEN) {
      assert.equal(poort.weeg(verzoek(pad), {}), null,
        pad + ' viel dicht op het drager-been; een stand zonder uitgang is een val');
    }
    assert.ok(poort.weeg(verzoek('/api/pay/stuur'), {}),
      'een gewoon pad valt daar WEL dicht -- anders meet deze toets niets');
  } finally { iso.besluit = echteBesluit; }

  /* 2. TEGEN HET HUIS wint het HUIS. De eigenaar zet de noodstop om; een lijst
        uit de laag daaronder houdt die niet open. */
  opstelling({ afdwingen: true });
  const opHuis = poort.weeg(verzoek(UITGANGEN[0]), { db, beschermstand: allesDicht });
  assert.ok(opHuis && opHuis.been === 'huis',
    'het huis-oordeel hoort te winnen van de uitgangslijst (SEC-LOCK-003): een lagere drager ' +
    'neutraliseert een hogere niet');

  /* En het huis sluit een gewoon pad ook -- de tegenproef op de tegenproef. */
  const gewoon = poort.weeg(verzoek('/api/pay/stuur'), { db, beschermstand: allesDicht });
  assert.ok(gewoon && gewoon.been === 'huis');
});

test('5. lezen loopt door, en een verzoek zonder sessie wordt niet gewogen', () => {
  opstelling({ afdwingen: true });
  assert.equal(poort.weeg(verzoek('/api/pay/stuur', 'GET'), {}), null,
    'een GET wordt in geen enkele stand tegengehouden (kern/beschermstand.js geeft er null op)');

  /* Geen sessie en geen token: er is geen drager, dus er valt niets te wegen.
     Dat is iets anders dan "alles mag" -- het huis-been hierboven geldt gewoon. */
  const vreemd = { path: '/api/pay/stuur', method: 'POST', get: () => '' };
  assert.equal(poort.weeg(vreemd, {}), null);
});

test('6. het huis-been blijft werken, en gaat VOOR het drager-been', () => {
  /* Het huis stond in middleware/functieschakelaars.js en is meeverhuisd. Dat
     mocht alleen als het gedrag identiek blijft: `dicht = huis || drager`, want
     besluit() is op 255 paden LOSSER dan de beschermstand en mag hem dus nooit
     vervangen. */
  const { maakBeschermstand } = require('../server/kern/beschermstand');
  poort.zetLaag(null);                       // geen dragerlaag: alleen het huis
  poort._wisTelling();
  const db = { data: { techniek: { incidentcontrole: { modus: 'beschermd' } } } };
  const uit = poort.weeg(verzoek('/api/pay/stuur'), { db, beschermstand: maakBeschermstand({ functies }) });
  assert.ok(uit, 'de veilige noodstand hoort nog steeds te sluiten');
  assert.equal(uit.been, 'huis');
  assert.equal(uit.antwoord.reden, 'bescherming');
  assert.ok(uit.antwoord.categorie, 'en zegt welke categorie bevroren is');
});

test('7. de poort is VLAK: 50.000 standen kosten niet meer dan nul', () => {
  /* DE EIGENSCHAP DIE DE KOP VAN isolatiepoort.js CLAAMT, hier vastgepind. Een
     bewering over complexiteit in commentaar is een bewering die niemand
     nakijkt, en juist deze glijdt makkelijk weg: elke `Object.keys()`,
     `for..in` of `.filter()` op een dragerkaart maakt de poort O(n), en dan
     wordt het platform trager naarmate MEER mensen zich beschermen -- precies
     op het moment dat de laag wordt gebruikt.

     GEMETEN, en de getallen zijn hard: `Object.keys(kaart).length === 0` kost
     bij 50.000 sleutels 8,5 MILLISECONDE, en `for (const k in kaart) return
     false;` -- de voor de hand liggende uitweg -- 8,4 ms, want V8 materialiseert
     de sleutelverzameling voordat de lus begint. Een gewone opzoeking blijft op
     0,013 us. Er is dus geen goedkope leegtetest; er is alleen de juiste vraag.

     DEZE TOETS MEET TIJD, EN DAT IS NORMAAL EEN SLECHT IDEE -- een trage
     bouwmachine laat hem dan zakken om de verkeerde reden. Vandaar een RUIME
     drempel (factor 4) en een VERHOUDING in plaats van een absoluut getal: hij
     vergelijkt de poort met zichzelf op een lege kaart, op dezelfde machine, in
     hetzelfde proces. Een O(n)-regressie is hier geen factor 4 maar een factor
     duizend, dus de ruimte kost geen scherpte.

     MUTATIE die hem laat zakken: in weeg() een aanroep zetten die de hele kaart
     afloopt (`laag.overzicht()`) -> ZAKT, gedraaid. Die eerste ronde liep met
     20.000 herhalingen 170 seconden door in plaats van te zakken; het aantal
     ronden staat daarom laag. Een toets die de bouw laat HANGEN is erger dan
     geen toets.

     Draait NIET mee in de gewone ronde als RTG_SNELLE_TOETS=1 staat: op een
     gedeelde bouwmachine is een tijdmeting het eerste dat ruist. */
  if (process.env.RTG_SNELLE_TOETS === '1') return;

  const maakIso = require('../server/kern/isolatie');
  function poortMet(n) {
    const iso = maakIso({ db: { data: {} }, save() {}, functies, klok: null, huisStand: () => 'normaal' });
    for (let i = 0; i < n; i++) {
      iso.zet({ drager: 'identiteit', sleutel: 'lid-' + i, naar: 'isolatie',
        door: 'toets', reden: 'meting van de vlakheid van de poort' });
    }
    poort._wisTelling();
    poort.zetLaag(iso, { afdwingen: false });
    /* Een lid dat er met opzet BUITEN valt: de dure weg is die van een schoon
       lid, want die moet alle dragers opzoeken voordat hij niets vindt. */
    const r = verzoek('/api/agenda/mijn');
    r.session = { key: 'buitenstaander' };
    /* WEINIG RONDEN, EN DAT IS EEN LES UIT DE MUTATIE. Met 20.000 ronden liep de
       toets bij een O(n)-regressie 170 seconden door in plaats van te zakken --
       een toets die de bouw laat HANGEN is erger dan geen toets, want niemand
       weet dan wat er aan de hand is. Een O(n)-regressie is hier een factor
       duizend, geen factor vier: 200 ronden zijn ruim genoeg om dat te zien, en
       ze begrenzen de schade bij een regressie tot een paar seconden. */
    for (let i = 0; i < 500; i++) poort.weeg(r, {});      // opwarmen
    const t = process.hrtime.bigint();
    for (let i = 0; i < 200; i++) poort.weeg(r, {});
    return Number(process.hrtime.bigint() - t) / 200;
  }

  const leeg = poortMet(0);
  const vol = poortMet(50000);
  assert.ok(vol < leeg * 4,
    'de poort wordt trager naarmate er MEER mensen in isolatie staan: ' +
    (leeg / 1000).toFixed(2) + ' us bij 0 standen tegenover ' + (vol / 1000).toFixed(2) +
    ' us bij 50.000. Ergens loopt hij nu een kaart af in plaats van er een sleutel in op te ' +
    'zoeken -- en dan wordt het platform traag op het moment dat deze laag wordt gebruikt.');
});

test('8. handhaving komt uitsluitend uit de expliciete productievlag', () => {
  const stand = require('../server/middleware/isolatiepoort-stand');
  assert.equal(stand.afdwingenUitOmgeving({}), false);
  assert.equal(stand.afdwingenUitOmgeving({ NODE_ENV: 'production' }), false,
    'alleen production noemen mag de veiligheidsbelofte niet stil aanzetten');
  assert.equal(stand.afdwingenUitOmgeving({ RTG_ISOLATIE_AFDWINGEN: '0' }), false);
  assert.equal(stand.afdwingenUitOmgeving({ RTG_ISOLATIE_AFDWINGEN: 'true' }), false);
  assert.equal(stand.afdwingenUitOmgeving({ RTG_ISOLATIE_AFDWINGEN: '1' }), true,
    'alleen de expliciet gekeurde waarde activeert de HTTP-handhaving');
});

test('9. onleesbare isolatie-opslag faalt dicht en wordt nooit als leeg hersteld', () => {
  const db = { data: { isolatie: { identiteit: 'kapot' } } };
  const iso = maakIsolatie({ db, save() {}, functies, klok: null, huisStand: () => 'normaal' });
  poort.zetLaag(null);
  poort.zetLaag(iso, { afdwingen: true });
  const uit = poort.weeg(verzoek('/api/notifications/read'), {});
  assert.equal(uit && uit.antwoord.reden, 'ISOLATIE_ONBEPAALD');
  assert.equal(db.data.isolatie.identiteit, 'kapot',
    'de fout mag niet worden weggeschreven als een lege kaart; dat zou alle standen wissen');
  assert.equal(poort.stand().onzeker, 1);

  /* In schaduw wordt de fout gemeten maar nog niet door deze nieuwe regel
     geblokkeerd. Productie kan niet in die stand starten (toets 10). */
  poort.zetLaag(null);
  poort.zetLaag(iso, { afdwingen: false });
  assert.equal(poort.weeg(verzoek('/api/notifications/read'), {}), null);
  assert.ok(poort.stand().onzeker >= 2);
});

test('9b. een lege beveiligingslezing schept geen opslag', () => {
  const db = { data: {} };
  const iso = maakIsolatie({ db, save() {
    assert.fail('een lege beveiligingslezing hoort niets te bewaren');
  }, functies, klok: null, huisStand: () => 'normaal' });
  assert.equal(iso.standVan('identiteit', 'user-zonder-stand'), null);
  assert.equal(iso.context({ identiteit: 'user-zonder-stand' }).standen.identiteit, null);
  assert.deepEqual(iso.overzicht().perDrager.identiteit, { aantal: 0, perStand: {} });
  assert.deepEqual(db.data, {},
    'een read-only HTTP- of SSE-verzoek mag geen lege isolatietakken aanmaken');
});

test('10. een mislukte save vergiftigt de laag; latere mutaties lopen niet door', () => {
  let stuk = false;
  const iso = maakIsolatie({ db: { data: {} }, save() {
    if (stuk) throw new Error('schijf niet bereikbaar');
  }, functies, klok: null, huisStand: () => 'normaal' });
  stuk = true;
  assert.throws(() => iso.zet({ drager: 'identiteit', sleutel: 'user-7', naar: 'isolatie',
    door: 'toets', reden: 'opslagstoring tijdens containment' }), /schijf niet bereikbaar/);

  poort.zetLaag(null);
  poort.zetLaag(iso, { afdwingen: true });
  const uit = poort.weeg(verzoek('/api/notifications/read'), {});
  assert.equal(uit && uit.antwoord.reden, 'ISOLATIE_ONBEPAALD',
    'ook als de geheugenmutatie al gebeurde mag duurzaamheidsonzekerheid niet doorlopen');
  assert.throws(() => iso.standVan('identiteit', 'user-7'), /duurzaamheid is onzeker/);
});

test('11. productie eist de vlag, de echte laag, een sessieoplosser en gekeurde opslag', () => {
  const poortstand = require('../server/middleware/isolatiepoort-stand');
  const sessies = require('../server/kern/isolatie/sessiedragers');
  const intrekking = require('../server/kern/intreksignaal');
  const env = { NODE_ENV: 'production', RTG_ISOLATIE_AFDWINGEN: '1' };
  intrekking._wis();
  poort.zetLaag(null);
  sessies.zetSessieOplosser(null);
  assert.throws(() => poortstand.eisProductieGereed(env), /geen bijtende isolatielaag/);

  poort.zetLaag({ context() {}, besluit() {} }, { afdwingen: true });
  assert.throws(() => poortstand.eisProductieGereed(env), /sessieoplosser/);
  sessies.zetSessieOplosser(() => null);
  assert.throws(() => poortstand.eisProductieGereed(env), /opslag niet keuren/);

  const iso = maakIsolatie({ db: { data: {} }, save() {}, functies, klok: null, huisStand: () => 'normaal' });
  poort.zetLaag(null);
  poort.zetLaag(iso, { afdwingen: true });
  assert.throws(() => poortstand.eisProductieGereed(env), /intrekkingsleiding/);
  intrekking.koppelBus({ soort: 'in-proces', publish() {}, subscribe() {},
    gereed: () => true, onStand: fn => fn({ soort: 'in-proces', gereed: true }) });
  assert.deepEqual(poortstand.eisProductieGereed(env), { nodig: true, gereed: true });
  assert.throws(() => poortstand.eisProductieGereed({ ...env, REDIS_URL: 'redis://cluster' }),
    /niet op Redis gemonteerd/,
    'een ingestelde clusterleiding mag niet stil op het lokale transport terugvallen');

  /* Ontkoppelen wist ook het openbare handhavingsregister; geen stale groen. */
  poort.zetLaag(null);
  assert.equal(poort.stand().gemonteerd, false);
  assert.equal(poort.stand().afdwingen, false);
  sessies.zetSessieOplosser(null);
  intrekking._wis();
});
