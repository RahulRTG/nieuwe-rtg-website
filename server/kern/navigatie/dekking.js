/* WAT WEET DEZE MOTOR OVER ZICHZELF: welk wegennet ligt er onder de voeten van
   deze gebruiker, en kan er hier werkelijk een route gerekend worden?

   Dit stond verspreid en dat kostte een defect. `route()` weigerde een
   Nederlandse rit netjes met 503 zolang de NWB-import niet gedraaid was, maar
   `kaart()`, `bestemmingen()` en `poi()` vielen zonder een woord terug op het
   demonstratieraster rond Ibiza -- een lid in Amsterdam kreeg een kaart van een
   ander eiland, zocht zijn straat en vond nul. Het scherm leidde intussen zijn
   badge af uit de dekkingsvelden en kwam op "Motor actief" uit terwijl elke
   route 503 gaf.

   Vier antwoorden op een ontbrekende bron zijn vier waarheden. Hier staat er
   een, en iedereen leest hem hiervandaan: de kern voor zijn weigeringen, het
   scherm voor wat het mag beweren.

   BUITEN NEDERLAND VERANDERT ER NIETS. Daar IS het eigen net alles wat er is,
   en dan heet het ook zo (`demonstratie`) in plaats van dat het zich voordoet
   als landsdekking. */
'use strict';

const { binnenNederland } = require('./nederland');
const gebieden = require('./gebieden');

/* Een weigering zegt wat er ontbreekt EN hoe het goedkomt. Zonder dat tweede
   deel leest 503 als een storing, terwijl het een niet-gedraaide importstap is.
   De tekst van `error` is met opzet exact gelijk aan wat route() al jaren zegt:
   twee zinnen voor dezelfde oorzaak zijn twee oorzaken voor wie meeleest. */
const geenNederlandsNet = () => ({
  status: 503,
  error: 'Het Nederlandse wegennet is nog niet ingeladen.',
  hoe: 'Lees het NWB van Rijkswaterstaat (CC0) in met `npm run navigatie:nederland`; zie NEDERLAND-WEGENNET.md.'
});

/* DEZELFDE WEIGERING VOOR EEN GEBIED UIT DE CATALOGUS. Vier antwoorden op een
   ontbrekende bron zijn vier waarheden -- die les staat in toets 13 van
   test/navigatie.test.js, waar kaart, bestemmingen en poi zonder een woord op
   het eiland terugvielen terwijl route() netjes weigerde. Bij een gebied buiten
   Nederland gold hetzelfde, en erger: het raster gaf een route van 1583 km met
   een echte reistijd. `reden` komt uit navigatie/gebiednetten.js en zegt of het
   pakket ontbreekt of dat de licentiepoort hem tegenhield. */
const geenGebiedsnet = (gebiedNet) => ({
  status: 503,
  error: (gebiedNet && gebiedNet.reden) || 'De kaart van dit gebied is niet geladen.',
  hoe: 'Kies een gebied waarvan het pakket gebouwd is, of laat dit gebied bouwen; ' +
    'de catalogus staat in /api/nav/status onder `gebied`.',
  gebied: gebiedNet ? { code: gebiedNet.code, naam: gebiedNet.naam } : null
});

/* De enige plek waar "hier kan ik niets" wordt vastgesteld. `nederland` is het
   ingelezen net of null; `hier` mag ontbreken -- dan weten we niet waar de
   vrager staat en weigeren we niets, want raden is erger dan doorlaten. */
const inNLZonderNet = (nederland, hier) => !nederland && binnenNederland(hier);

/* Welk net ligt hier, in een woord dat een scherm mag tonen:
     nwb           het Nationaal Wegenbestand, echte landsdekking
     gebied        een gebouwd pakket uit de catalogus (OSM), hier geladen
     gebied-geen   hier wordt een gebied AANGEBODEN maar het pakket is niet
                   geladen: routeren gaat niet, en de reden staat erbij
     demonstratie  het eigen raster; werkt, maar is geen kaart van een land
     geen          binnen Nederland zonder import: hier valt niets te rekenen

   DE TWEE MIDDELSTE ZIJN ERBIJ GEKOMEN EN DAT WAS NODIG: met een gebouwd
   OSM-pakket onder de voeten zei deze laag `demonstratie`, en het scherm zette
   daarop de badge "Demonstratienet" terwijl er op een echte kaart gerekend
   werd. Precies waar de kop van haalStatus() in apps/navigatie.html voor
   waarschuwt: een badge die niet is bijgewerkt is geen lege badge, hij liegt.

   `gebiedNet` is de post uit navigatie/gebiednetten.js -- die laag weet als
   enige of een motor werkelijk geladen is. Zonder dat argument gedraagt deze
   functie zich exact als hiervoor. */
function netVoor(nederland, hier, gebiedNet) {
  if (nederland && binnenNederland(hier)) return 'nwb';
  /* HET GEBIED GAAT VOOR DE NEDERLANDSE WEIGERING. Wie het OSM-pakket van
     Nederland heeft gebouwd en het NWB niet, kreeg anders "Geen kaartdata voor
     Nederland" terwijl er een bruikbare kaart klaarlag. Dezelfde orde als in
     kern/navigatie.js -- twee plekken die hem anders leggen, geven twee
     antwoorden op dezelfde vraag. */
  if (gebiedNet && gebiedNet.net) return 'gebied';
  if (inNLZonderNet(nederland, hier)) return 'geen';
  if (gebiedNet) return 'gebied-geen';
  return 'demonstratie';
}

/* De dekkingsregel voor navStatus. Geeft `net`, `routeerbaarHier`, `netReden`
   en `dekking` -- vier velden die samen een scherm alles vertellen wat het over
   de motor mag zeggen, zodat het niets meer hoeft af te leiden. */
/* WELKE KAART BIEDT RTG HIER AAN, los van of hij geladen is.

   Dit is de tweede helft van het eerlijke antwoord, en hij ontbrak. Buiten
   Nederland zei deze laag `demonstratie` en daarmee was het gesprek klaar --
   terecht zolang er EEN land was. Nu RTG wereldwijd gebieden aanbiedt, wil een
   lid buiten de dekking iets anders weten: bestaat er een kaart voor waar ik
   ben, en ligt hij er al?

   Drie standen die niet door elkaar mogen lopen (zie ./gebieden.js):
   aangeboden is geen dekking, en gebouwd is nog niet actief. En wat hier staat
   is met een RECHTHOEK bepaald: `vakIsGeenGrens` reist mee, want anders leest
   "u bent in Nederland" als een landsbepaling. */
function gebiedsbeeld(hier) {
  const k = gebieden.gebiedVoor(hier);
  if (!k.gebied) {
    return { code: null, naam: null, aangeboden: false, gebouwd: false,
      grond: k.grond, kandidaten: k.kandidaten || [], reden: k.waarom || null };
  }
  const g = k.gebied;
  /* De licentiepoort reist mee: mag dit pakket worden aangeboden, en met welke
     naamsvermelding? Een scherm dat de kaart toont, moet die vermelding kunnen
     zetten -- zonder komt hij er niet door (ODbL). */
  const poort = gebieden.mag(g);
  return { code: g.code, naam: g.naam, soort: g.soort, aangeboden: true, gebouwd: !!g.gebouwd,
    bron: g.bron || null, licentie: g.licentie || null,
    naamsvermelding: poort.ok ? poort.naamsvermelding : null,
    mag: poort.ok, magNietOmdat: poort.ok ? null : poort.reden,
    grond: k.grond, vakIsGeenGrens: !!k.vakIsGeenGrens,
    kandidaten: k.kandidaten || [], reden: k.waarom || null };
}

function dekkingsbeeld(nederland, hier, gebiedNet) {
  const inNL = binnenNederland(hier);
  const net = netVoor(nederland, hier, gebiedNet);
  const gb = gebiedsbeeld(hier);
  return {
    net,
    /* Naast `net` (waarop kan ik NU routeren) staat `gebied` (wat biedt RTG
       hier aan). Twee verschillende vragen, en ze werden er een toen er nog
       maar een land was. */
    gebied: gb,
    routeerbaarHier: net !== 'geen' && net !== 'gebied-geen',
    netReden: net === 'geen' ? geenNederlandsNet().error
      : net === 'gebied-geen' ? geenGebiedsnet(gebiedNet).error
        : (net === 'demonstratie' ? 'Buiten de NWB-dekking rekent RTG op het eigen demonstratienet.' : null),
    /* DE NAAMSVERMELDING HOORT OP HET SCHERM EN NIET ALLEEN IN EEN POORT. ODbL
       eist haar, en `mag()` weigert een pakket zonder -- maar een vermelding
       die nergens te zien is, is geen vermelding. Bij een geladen gebied gaat
       zij daarom mee in `dekking`, op dezelfde plek waar Nederland zijn bron
       en licentie zet, zodat een scherm er niets over hoeft af te leiden. */
    dekking: net === 'gebied'
      ? { land: gb.naam, actief: true, hierActief: true, bron: gb.bron, licentie: gb.licentie,
        naamsvermelding: gb.naamsvermelding, code: gb.code }
      : nederland
        ? { land: 'Nederland', actief: true, hierActief: inNL, wegvakken: Number(nederland.info.wegvakken || 0),
          bron: nederland.info.bron, licentie: nederland.info.licentie, gebouwdAt: nederland.info.gebouwd_at }
        : { land: 'Nederland', actief: false, hierActief: false, hierBinnenNederland: inNL, reden: geenNederlandsNet().error }
  };
}

module.exports = { geenNederlandsNet, geenGebiedsnet, inNLZonderNet, netVoor, dekkingsbeeld, gebiedsbeeld };
