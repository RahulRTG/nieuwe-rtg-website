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

test('4b. de uitgang overleeft ook een HUIS dat alles zou sluiten', () => {
  /* DIT IS WAT TOETS 4 NIET MAT, en dat kwam uit een mutatie: de
     openpaden-controle uit weeg() halen liet toets 4 groen, want vandaag laat
     `besluit()` diezelfde paden toch al door -- ze staan in EIGEN_UITGANG, dus de
     leesset redt ze een laag lager. De controle in de poort beschermt dus niet
     tegen VANDAAG maar tegen MORGEN: het HUIS-been draait ervoor, kent openpaden
     niet, en sluit die paden zodra een van hen een functie in de catalogus
     krijgt. Dan is de val er, en dan is hij niet te ontsluiten.

     Een toets die dat niet kan meten met de echte beschermstand, meet het met een
     die alles sluit. Dat is geen gekunsteld geval: het IS de toekomstige stand
     waar de regel voor bestaat.

     MUTATIE: de openpaden-controle uit weeg() halen -> ZAKT. */
  opstelling({ afdwingen: true });
  const allesDicht = { houdtTegen: () => ({ functie: 'verzonnen', naam: 'Alles',
    categorie: 'Geld', waarom: 'een beschermstand die alles sluit' }) };
  const db = { data: { techniek: { incidentcontrole: { modus: 'beschermd' } } } };

  for (const pad of UITGANGEN) {
    assert.equal(poort.weeg(verzoek(pad), { db, beschermstand: allesDicht }), null,
      pad + ' viel dicht op het huis-been; dan is de uitgang weg zodra iemand dat pad een functie ' +
      'geeft, en een stand zonder uitgang is een val');
  }

  /* En de tegenproef: een gewoon pad valt daar WEL dicht -- anders zou deze toets
     ook slagen op een poort die het huis-been helemaal niet raadpleegt. */
  const gewoon = poort.weeg(verzoek('/api/pay/stuur'), { db, beschermstand: allesDicht });
  assert.ok(gewoon && gewoon.been === 'huis', 'het huis-been hoort een gewoon pad wel te sluiten');
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
