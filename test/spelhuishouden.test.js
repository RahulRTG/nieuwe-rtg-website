/* MAGNAAT: LAAG 3 -- loon dat terugkomt.

   ECONOMIE.md noemde dit *de scherpste openstaande fout*: `lonen = v.personeel *
   s.loon` was geld dat de wereld verliet zonder ergens aan te komen. Zolang loon
   alleen een kostenpost is, is er geen kringloop.

   NEGEN BEWERINGEN, en de derde, de vierde en de achtste zijn de eigenlijke:

   1. EEN LEGE STAD REKENT ZOALS IN FASE A -- exact, niet ongeveer.
   2. LOON DAT BETAALD WORDT KOMT TERUG als bestedingskracht.
   3. DEZELFDE SCHOK RAAKT NIET IEDEREEN GELIJK, en het verschil komt uit de
      structuur (wie er langskomt) en niet uit een tabel.
   4. ALLEEN WAT WEGLEKTE KAN TERUGKEREN. Een dienstverband tussen spelers is
      geen koopkracht erbij -- anders is een kring van salarissen een geldpomp.
   5. ER KOMT GEEN EURO BIJ. Deze laag raakt de vraag, niet de kas.
   6. WIE IN ZIJN EENTJE DE STAD RIJK MAAKT, BETAALT DAT ZELF.
   7. EEN ZAAK DIE SLUIT NEEMT ZIJN LOONSOM MEE -- zo reist een faillissement.
   8. SCHADE IS NIET METEEN MAXIMAAL, EN WORDT ERGER NAARMATE HIJ LANGER DUURT.
      De buffer vangt de eerste maanden op en loopt daarna leeg.
   9. ELKE AFTREKPOST HEEFT EEN BESTEMMING -- geen euro gaat er zomaar af.

   Draai los: node --experimental-sqlite --test test/spelhuishouden.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');

const HUIS = require('../server/kern/spellen/magnaat/huishoudens');
const BOEKJE = require('../server/kern/spellen/magnaat/huishoudboekje');
const TYPEN = require('../server/kern/spellen/magnaat/huishoudtypen');
const V = require('../server/kern/spellen/magnaat/vraag');
const { kaart } = require('../server/kern/spellen/magnaat/kaart');

const maakMagnaat = () => require('../server/kern/spellen/magnaat/index')({
  save() {}, crypto: require('crypto'), codenaamVan: (h) => h, nudge() {}
});
const ECO = { vorm: 'economie', stad: 'IJmuiden', duur: 'weekend' };
const K = kaart('ijmuiden');
const kavelIn = (zone, n = 0) => K.kavels.filter(k => k.zone === zone)[n];

/* Een stad waar je zaken in kunt zetten. `zaken` is een lijst [sector, omvang,
   zone] zodat elke toets precies de stad krijgt die zijn bewering nodig heeft. */
function stad(id, zaken, { spelers = ['anna'] } = {}) {
  const m = maakMagnaat();
  const p = { id, soort: 'magnaat', spelers, teams: spelers.map((_, i) => i), modus: 'vrij',
    status: 'bezig', beurt: 0, winnaar: null, variant: ECO };
  m.spel.init(p);
  for (const h of spelers) p.staat.geld[h] = 60000000;
  const vrij = K.kavels.slice();
  for (const [sector, omvang, zone, wie] of zaken) {
    const i = vrij.findIndex(k => (!zone || k.zone === zone)
      && m.eco.zet(p, wie || spelers[0], { actie: 'open', kavel: k.id, sector, omvang }).ok);
    if (i >= 0) vrij.splice(i, 1);
  }
  return { m, p, st: p.staat,
    zaken: (h) => p.staat.vestigingen[h || spelers[0]] || [],
    regel: (v, h) => (p.staat.laatste[h || spelers[0]].regels || []).find(r => r.id === v.id),
    maand: (n = 1) => { for (let i = 0; i < n; i++) { p.staat.gerekendTot -= p.staat.maandMs; m.eco.bijrekenen(p); } } };
}

/* ============ 1. een lege stad rekent zoals in fase A ============ */

test('zonder een enkele zaak is de bestedingskracht exact 1', () => {
  /* EXACT, en niet 0.998. Alles onder deze laag is geijkt in fase A
     (scripts/magnaat-balans.js); een economie die anders gaat rekenen zodra er
     een laag bijkomt, is twee economieen. */
  const o = stad('h-1', []);
  assert.equal(HUIS.bestedingskracht(o.st, K), 1);
  assert.equal(HUIS.factorVoor(K, kavelIn('boulevard'), 'horeca', 6, 1), 1);
});

test('en de vraagsom van fase A is tot op de bit dezelfde gebleven', () => {
  /* DE SEGMENTSPLITSING IS EEN UITSNEDE EN GEEN HERSCHRIJVING. magnaat/vraag.js
     kreeg er een tweede lezer bij (huishoudens.js wil de segmenten apart), en
     de lus is daarvoor uit `basisvraag` gehaald. Deze getallen komen uit de
     versie VAN VOOR die ingreep, met git opgehaald en hier ingemetseld. Ze zijn
     geen verwachting maar een afdruk: wijkt er een af, dan is fase A verschoven
     en dan klopt elke ijking erboven niet meer. */
  const kav = kavelIn('boulevard');
  const golden = {
    horeca: [1.490559929375, 2.233759213125, 1.558123500625],
    hotel: [1.144813043100, 2.276593629300, 1.247702187300],
    retail: [1.400316044460, 1.727657499780, 1.430074358580],
    industrie: [0.136259338200, 0.142019382600, 0.136782978600]
  };
  for (const [sector, rij] of Object.entries(golden))
    [0, 6, 11].forEach((m, i) => assert.equal(V.basisvraag(K, kav, sector, m).toFixed(12),
      rij[i].toFixed(12), sector + ' in maand ' + m));
});

/* ============ 2. loon komt terug ============ */

test('een zaak die mensen betaalt maakt de stad rijker', () => {
  const leeg = stad('h-2a', []);
  const vol = stad('h-2b', [['horeca', 60, 'boulevard'], ['retail', 60, 'centrum']]);
  vol.maand(2);
  assert.ok(HUIS.loonsom(vol.st) > 0, 'er wordt loon betaald');
  assert.equal(HUIS.loonsom(leeg.st), 0);
  assert.ok(vol.st.besteding > 1.0001,
    'de bestedingskracht hoort boven 1 te staan: ' + vol.st.besteding);
  /* EN HET IS DE LOONSOM DIE HET DOET, niet de omzet of het aantal zaken. */
  const verwacht = 1 + HUIS.loonsom(vol.st) / HUIS.stadsLoon(K);
  assert.ok(Math.abs(vol.st.besteding - verwacht) < 1e-9);
});

/* EEN WINKEL MET RUIMTE. Dat is geen truc maar de voorwaarde waaronder deze
   laag uberhaupt te zien is: ./maat.js `capaciteit` maakt van een zaak op maat
   een zaak die alles verkoopt wat hij aankan, en die merkt van meer koopkracht
   niets -- hij zat al vol. Extra vraag landt dan in `gemist`, en pas als de
   eigenaar uitbreidt in de omzet.

   DAT IS ECONOMISCH JUIST EN HET IS HET VERMELDEN WAARD: koopkracht die stijgt
   raakt eerst wie ruimte heeft. Koopkracht die ZAKT raakt uiteindelijk iedereen,
   want die duwt de vraag onder de capaciteit die er al stond.

   EN HET IS EEN RESTAURANT EN GEEN WINKEL, met reden. Hier stond eerst `retail`,
   en die toets overleefde een mutatie die deze hele laag uitzette -- want een
   winkel LEVERT goederen (./sectoren.js) en de fabriek in dezelfde toets is
   daar een afnemer van. Wat er gemeten werd was dus ./keten.js: een klant die
   wegvalt. Een restaurant levert niets en de fabriek koopt niets bij hem, dus
   het enige dat die twee nog verbindt is dat de mensen die daar werkten hier
   aten. Dat is precies het kanaal dat deze toetsen beweren te meten. */
const RUIM = ['horeca', 120, 'centrum'];

test('meer werk in de stad is meer vraag in de winkel', () => {
  /* TWEE WERELDEN DIE ALLEEN IN BEZETTING VERSCHILLEN. Dezelfde winkel op
     hetzelfde kavel in dezelfde maand; alleen heeft de fabriek in de tweede
     wereld meer mensen in dienst. Zonder die tweede wereld zou je maanden met
     elkaar vergelijken, en dan meet je het seizoen. */
  const mager = stad('h-3', [RUIM, ['industrie', 20, 'haven']]);
  const rijk = stad('h-3', [RUIM, ['industrie', 20, 'haven']]);
  for (const v of rijk.zaken()) if (v.sector === 'industrie') v.personeel = v.personeel * 8;
  mager.maand(3); rijk.maand(3);
  const a = mager.regel(mager.zaken()[0]), b = rijk.regel(rijk.zaken()[0]);
  // `bezetting` staat in procenten (./stap.js), niet als deel
  assert.ok(a.bezetting < 99, 'de zaak hoort ruimte te hebben, anders meet deze toets niets: '
    + a.bezetting);
  assert.ok(b.omzet > a.omzet,
    'het restaurant verkoopt meer als de fabriek om de hoek meer mensen betaalt: '
    + b.omzet + ' tegen ' + a.omzet);
});

/* ============ 3. niet iedereen gelijk ============ */

test('dezelfde schok raakt een buurtwinkel harder dan een strandhotel', () => {
  /* DE GRENS UIT ECONOMIE.md, en hij komt hier uit de STRUCTUUR: een hotel op
     de boulevard leeft van toeristen die hun geld elders verdienden, een winkel
     in het centrum van mensen die hier werken. Er staat geen tabel met
     uitzonderingen achter -- alleen ./vraag.js `segmenten`. */
  const kavH = kavelIn('boulevard'), kavW = kavelIn('centrum');
  const hotel = HUIS.loongevoelig(K, kavH, 'hotel', 6);
  const winkel = HUIS.loongevoelig(K, kavW, 'retail', 6);
  assert.ok(winkel > hotel + 0.1,
    'de winkel hoort duidelijk lokaler te zijn: ' + winkel.toFixed(3) + ' tegen ' + hotel.toFixed(3));
  /* EN DAT VERTAALT ZICH IN DE KLAP. Bij een loonsom die met een kwart zakt
     verliest de winkel meer vraag dan het hotel. */
  const val = 0.75;
  const klapH = 1 - HUIS.factorVoor(K, kavH, 'hotel', 6, val);
  const klapW = 1 - HUIS.factorVoor(K, kavW, 'retail', 6, val);
  assert.ok(klapW > klapH * 1.3, 'en de winkel verliest meer: ' + klapW.toFixed(3) + ' tegen ' + klapH.toFixed(3));
});

/* ============ 4. alleen wat weglekte kan terugkeren ============ */

test('een kring van salarissen tussen spelers stookt de stad niet op', () => {
  /* DE ENIGE ECHTE UITBUITING DIE DEZE LAAG KON KRIJGEN. Drie spelers die
     elkaar in dienst nemen betalen elkaar netto niets -- dat geld is de wereld
     nooit uit geweest. Zou het meetellen als koopkracht, dan is een kring van
     dienstverbanden een gratis vraagverhoging voor de hele stad.
     scripts/magnaat-pomp.js heeft daar een scenario voor dat neutraal HOORT te
     blijven; deze toets zegt waarom het neutraal blijft. */
  const o = stad('h-4', [['horeca', 60, 'boulevard']], { spelers: ['anna', 'boris'] });
  const voor = HUIS.loonsom(o.st);
  o.st.diensten = [{ id: 'd1', werkgever: 'anna', werknemer: 'boris', rol: 'manager',
    loon: 99999, status: 'loopt', vestiging: o.zaken()[0].id, sinds: 0 }];
  assert.equal(HUIS.loonsom(o.st), voor,
    'een dienstverband tussen spelers hoort de bestedingskracht niet te raken');
});

/* ============ 5. er komt geen euro bij ============ */

test('deze laag verandert geen enkele kas rechtstreeks', () => {
  /* Loon dat terugkomt landt op de VRAAG en niet op een saldo. Zou hier ook
     maar een euro bijgeschreven worden, dan maakt de laag geld -- en dan valt
     scripts/magnaat-pomp.js erover. */
  const st = { vestigingen: { anna: [{ sector: 'horeca', personeel: 12 }] }, geld: { anna: 1000 } };
  HUIS.bestedingskracht(st, K);
  HUIS.loonsom(st);
  HUIS.factorVoor(K, kavelIn('centrum'), 'retail', 6, 1.5);
  assert.equal(st.geld.anna, 1000);
});

/* ============ 6. koopkracht is van de stad, niet van jou ============ */

test('het loon dat jij betaalt landt ook bij de concurrent die niets deed', () => {
  /* HIER STOND EERST EEN ANDERE TOETS, en die moest weg. Hij beweerde dat
     personeel aannemen om de vraag op te stoken nooit uit kan -- waar, maar niet
     door DEZE laag: ./maat.js zegt `capaciteit = min(omvang, personeel x
     perMens)`, dus extra personeel koopt geen capaciteit, en de loonpost is een
     orde van grootte groter dan de vraag die je ermee koopt. Er bleek GEEN
     mutatie te bestaan die hem liet zakken -- niet met een koppeling die tien of
     honderd keer zo sterk stond, en niet met het capaciteitsplafond eruit. Een
     toets die niet kan zakken is geen toets (LAT.md regel 9).

     WAT ER WEL TOE DOET is de reden dat opstoken zinloos is, en die is
     eigen aan deze laag: de bestedingskracht is van de STAD. Boris zet een
     restaurant neer en houdt zijn handen stil; anna neemt in haar fabriek een
     veelvoud aan mensen aan. Boris verdient daaraan, zonder een cent loon te
     betalen. Zo hoort het te zijn -- en het is meteen waarom niemand er in zijn
     eentje iets aan heeft. */
  const stil = stad('h-6', [RUIM, ['industrie', 40, 'haven', 'boris']], { spelers: ['anna', 'boris'] });
  const gul = stad('h-6', [RUIM, ['industrie', 40, 'haven', 'boris']], { spelers: ['anna', 'boris'] });
  for (const v of gul.zaken('boris')) v.personeel = v.personeel * 10;
  stil.maand(3); gul.maand(3);
  const a = stil.regel(stil.zaken()[0]), b = gul.regel(gul.zaken()[0]);
  assert.ok(b.omzet > a.omzet,
    'anna verkoopt meer terwijl zij niets veranderde: ' + b.omzet + ' tegen ' + a.omzet);
  /* EN ZIJ BETAALDE ER NIETS VOOR: haar eigen loonpost is in beide werelden
     precies dezelfde. Dat is het verschil tussen koopkracht die van de stad is
     en een bonus die je voor jezelf koopt. */
  assert.equal(b.lonen, a.lonen, 'anna betaalde in beide werelden hetzelfde loon');
});

/* ============ 7. een faillissement reist ============ */

test('een zaak die sluit neemt zijn loonsom mee, en dat merkt de buurt', () => {
  /* ECONOMIE.md laag 28: een bedrijf verdwijnt nooit gewoon. Hier is de
     eenvoudigste vorm daarvan, en er is niets voor gescript -- de som telt
     gewoon over de zaken die er NOG zijn. */
  const blijft = stad('h-7', [RUIM, ['industrie', 30, 'haven']]);
  const sluit = stad('h-7', [RUIM, ['industrie', 30, 'haven']]);
  blijft.maand(3); sluit.maand(3);
  const fabriek = sluit.zaken().find(v => v.sector === 'industrie');
  assert.ok(fabriek, 'de fabriek hoort er te staan');
  sluit.m.eco.zet(sluit.p, 'anna', { actie: 'sluiten', id: fabriek.id });
  blijft.maand(1); sluit.maand(1);
  assert.ok(sluit.st.besteding < blijft.st.besteding - 0.001,
    'de bestedingskracht hoort te zakken: ' + sluit.st.besteding + ' tegen ' + blijft.st.besteding);
  /* EN DE ZAAK DIE ER NIETS MEE TE MAKEN HAD merkt het. Hij staat in een andere
     zone, heeft geen contract met de fabriek, levert hem niets en koopt niets
     van hem; het enige dat hen verbindt is dat de mensen die daar werkten hier
     aten. */
  const a = blijft.regel(blijft.zaken()[0]), b = sluit.regel(sluit.zaken()[0]);
  assert.ok(b.omzet < a.omzet,
    'en het restaurant verkoopt minder: ' + b.omzet + ' tegen ' + a.omzet);
});

/* ============ 8. de buffer, en dat schade tijd nodig heeft ============ */

test('een klap komt niet in een keer aan, maar wordt erger naarmate hij duurt', () => {
  /* HUISHOUDEN.md par. 6, en er staat nergens een fase, een vlag of een teller.
     Een huishouden dat deze maand minder verdient eet deze maand nog hetzelfde;
     pas als het spaargeld op is valt de consumptie terug op wat er binnenkomt.

     TWEE WERELDEN MET DEZELFDE ZAAIING, want anders meet je het seizoen. In de
     ene wordt de fabriek leeggehaald, in de andere niet -- en het verschil moet
     GROEIEN over de maanden. */
  const heel = stad('h-8', [RUIM, ['industrie', 40, 'haven']]);
  const klap = stad('h-8', [RUIM, ['industrie', 40, 'haven']]);
  heel.maand(3); klap.maand(3);
  for (const v of klap.zaken()) if (v.sector === 'industrie') v.personeel = 1;
  const gat = [];
  for (let i = 0; i < 6; i++) {
    heel.maand(1); klap.maand(1);
    gat.push(heel.st.besteding - klap.st.besteding);
  }
  assert.ok(gat[0] > 0, 'er hoort meteen iets te gebeuren: ' + gat[0]);
  assert.ok(gat[5] > gat[0] * 1.5,
    'en het hoort erger te worden naarmate het duurt: ' + gat.map(x => x.toFixed(4)).join(' '));
  /* EN HET SPAARGELD IS WAAR HET UIT BETAALD WORDT. Let op wat hier NIET staat:
     dat de buffer opraakt. Dat doet hij niet -- zie de kop van
     magnaat/huishoudboekje.js -- want er is nu een gemiddeld huishouden per stad
     en een gemiddelde buffer haalt het altijd. De verergering komt hier van de
     traagheid; de bodem van de buffer bestaat pas met huishoudtypen. */
  assert.ok(klap.st.huishoudens.spaargeld < heel.st.huishoudens.spaargeld,
    'het spaargeld hoort aangesproken te zijn');
});

test('en een huishouden geeft nooit geld uit dat er niet is', () => {
  /* DE BEHOUDSREGEL UIT HUISHOUDEN.md par. 2. Een instorting tot een procent van
     het inkomen, zes maanden lang: geen enkel cohort mag ergens onderweg geld
     uitgeven dat er niet is.

     EN LET OP WAT ER NIET WORDT BEWEERD: dat ze aan het eind nog tegen de bodem
     zitten. Dat doen ze niet -- ze zijn dan volledig aangepast, en `krap` is
     juist weer vals. Wat de toets vasthoudt is dat ze er onderweg WEL tegenaan
     zaten, want dat is het verschil met het gemiddelde huishouden van hiervoor. */
  const st = {};
  TYPEN.maand(st, 400000);
  const geraakt = {};
  for (let i = 0; i < 6; i++) {
    TYPEN.maand(st, 4000);
    for (const t of TYPEN.TYPEN) {
      const h = st.huishoudens.per[t.id];
      assert.ok(h.spaargeld >= -1e-6, t.id + ' maand ' + i + ': spaargeld onder nul: ' + h.spaargeld);
      assert.ok(h.consumptie >= 0, t.id + ': consumptie onder nul');
      if (h.krap) geraakt[t.id] = true;
    }
  }
  assert.ok(geraakt.krap, 'het dunne-bufferhuishouden hoort de bodem te hebben geraakt');
  assert.ok(geraakt.schuld, 'het huishouden met hoge schuld ook');
});

/* ============ 8b. en ze zijn niet gemiddeld ============ */

test('dezelfde inkomensschok landt totaal anders per huishouden', () => {
  /* HUISHOUDEN.md 3.4, en dit is de reden dat deze laag bestaat. Een gemiddelde
     lijn verbergt precies waar het bij een schok om gaat: wie stopt er als
     eerste met uit eten gaan?

     GEEN STEREOTYPEN MAAR BALANSEN: het enige dat `krap` van `ruim` onderscheidt
     is hoeveel er binnenkomt, hoe vast het eruit gaat en hoeveel er ligt. */
  const st = {};
  TYPEN.maand(st, 300000);
  const voor = {};
  for (const t of TYPEN.TYPEN) voor[t.id] = st.huishoudens.per[t.id].consumptie;
  for (let i = 0; i < 4; i++) TYPEN.maand(st, 300000 * 0.7);
  const val = (id) => 1 - st.huishoudens.per[id].consumptie / voor[id];
  assert.ok(val('krap') > val('ruim') * 1.3,
    'het dunne-bufferhuishouden snijdt veel dieper dan het dikke: '
    + (val('krap') * 100).toFixed(1) + '% tegen ' + (val('ruim') * 100).toFixed(1) + '%');
  assert.ok(val('ruim') >= 0, 'en het dikke huishouden snijdt wel iets');
});

test('vaste lasten zijn stijver dan boodschappen, en dus valt de vrije besteding harder', () => {
  /* HUISHOUDEN.md 3.2. Zakt het inkomen met een vijfde, dan zakt de huur niet
     mee -- een contract loopt door. De VRIJE besteding wordt daardoor met veel
     meer dan een vijfde samengedrukt, en dat is precies waarom de horeca eerder
     een klap krijgt dan de verhuurder. Er staat nergens dat dat zo moet zijn;
     het volgt uit de volgorde van betalen. */
  const st = {};
  TYPEN.maand(st, 300000);
  const voor = st.huishoudens.consumptie;
  const val = [];
  for (let i = 0; i < 12; i++) {
    TYPEN.maand(st, 300000 * 0.8);
    val.push(1 - st.huishoudens.consumptie / voor);
  }
  /* DE HEFBOOM BOUWT OP: de eerste maand valt mee (traagheid), en pas als de
     consumptie is meegezakt staat de volle klap er. Op het diepste punt is hij
     duidelijk groter dan de inkomensdaling zelf. */
  const diepst = Math.max(...val);
  assert.ok(diepst > 0.25,
    'een inkomensdaling van 20% hoort de vrije besteding met veel meer dan 20% te drukken: '
    + val.map(x => (x * 100).toFixed(0)).join(' '));
  /* EN HIJ ZAKT DAARNA WEER, want een huurcontract loopt af en wordt opnieuw
     gesloten. Dat is geen herstel van het inkomen -- dat blijft laag -- maar van
     de VERHOUDING tussen vaste en vrije lasten. */
  assert.ok(val[11] < diepst - 0.005,
    'en hij hoort weer te zakken als de vaste lasten meegeven: '
    + val.map(x => (x * 100).toFixed(0)).join(' '));
});

test('maar opgeteld zijn ze precies het gemiddelde huishouden van hiervoor', () => {
  /* DE EIS WAARONDER DEZE LAAG MOCHT BESTAAN, en hij wordt afgedwongen en niet
     gehoopt: de gewichten en de lastenverdeling worden bij het laden
     genormaliseerd. Zou de optelsom afwijken, dan had een laag over de VERDELING
     van inkomens het NIVEAU van de economie verschoven -- en dan klopt elke
     ijking uit fase A niet meer. */
  const st = {};
  TYPEN.maand(st, 250000);
  assert.ok(Math.abs(st.huishoudens.consumptie - BOEKJE.doelVan(250000)) < 1e-6,
    'de som van de cohorten hoort de evenwichtsconsumptie te zijn: '
    + st.huishoudens.consumptie + ' tegen ' + BOEKJE.doelVan(250000));
  /* En de loonsom wordt volledig verdeeld: geen euro verzonnen of kwijtgeraakt. */
  const som = TYPEN.TYPEN.reduce((n, t) => n + TYPEN.GEWICHT[t.id], 0);
  assert.ok(Math.abs(som - 1) < 1e-12, 'de gewichten horen op te tellen tot 1: ' + som);
});

/* ============ 9. elke aftrekpost heeft een bestemming ============ */

test('van loonkosten naar besteedbaar gaat geen euro zomaar af', () => {
  /* DE WET UIT HUISHOUDEN.md par. 2, op de plek waar hij voor het eerst geldt:
     wat de wereld verlaat, verlaat hem NAAR IETS. Vandaag zijn dat allemaal
     partijen buiten de wereld -- er is geen overheid en geen verhuurder -- en
     juist daarom moet elke post een naam hebben. Een lek met een naam is een
     lek dat je kunt dichten; zo zijn keten.js en deze laag allebei ontstaan. */
  const { stand, stroom } = BOEKJE.boekje(3000);
  assert.ok(stand.besteedbaar < stand.netto, 'vaste lasten gaan van het netto af');
  assert.ok(stand.netto < stand.bruto, 'heffing en pensioen gaan van het bruto af');
  assert.ok(stand.bruto < stand.loonkosten, 'premies gaan van de loonkosten af');
  for (const x of stroom) {
    assert.ok(x.bedrag > 0, x.post + ' hoort een bedrag te hebben');
    assert.ok(x.naar && x.naar.length > 2, x.post + ' hoort een bestemming te hebben');
  }
  /* EN DE SOM KLOPT: wat eraf gaat plus wat overblijft is wat erin ging. */
  const af = stroom.reduce((n, x) => n + x.bedrag, 0);
  assert.ok(Math.abs((af + stand.besteedbaar) - 3000) < 1e-9,
    'afgedragen plus besteedbaar hoort de loonkost te zijn: ' + (af + stand.besteedbaar));
});

test('de wig verandert de bestedingskracht niet -- alleen wat er te zien is', () => {
  /* DIT IS DE EIS WAARONDER HET HUISHOUDBOEKJE MOCHT BESTAAN. De stad ondergaat
     dezelfde wig als de spelers, dus in de evenwichtsstand valt hij tegen elkaar
     weg. Zou dat niet zo zijn, dan was elke ijking uit fase A verschoven door een
     laag die daar niets mee te maken heeft. */
  const o = stad('h-9', [['horeca', 60, 'boulevard'], ['retail', 60, 'centrum']]);
  o.maand(2);
  assert.ok(Math.abs(o.st.besteding - (1 + HUIS.loonsom(o.st) / HUIS.stadsLoon(K))) < 1e-9,
    'de evenwichtsstand hoort de kale loonverhouding te zijn: ' + o.st.besteding);
});
