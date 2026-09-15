/* ============================================================================
   DE WERELD -- een catalogus, drie standen.

   Uit ./index.js geknipt op de 10 kB-grens (keuringsregel 13). De naad is echt:
   index.js STELT SAMEN -- twaalf deelmodules in een volgorde die zelf de inhoud
   is -- en dit was de enige plek waar dat bestand ook echt iets DEED. Een
   ophanglijst met een functie erin leest als twee bestanden die toevallig een
   naam delen.

   WAAROM HIJ NU PAS GEKNIPT WORDT, en dat hoort erbij te staan: index.js stond
   op 10238 bytes, TWEE onder de grens. Een enkele bedradingsregel erbij --
   `werkherkomst` doorgeven aan ./wekken.js -- zette hem eroverheen. De
   verleiding is dan om het bestand met een reden op de uitzonderingenlijst van
   keuringsregel 13 te zetten, en die lijst zegt daar zelf het juiste over: *een
   ratel die je losdraait omdat je er zelf tegenaan loopt, is geen ratel*. Dus
   geknipt, en wel op de plek waar er sowieso een grens lag.

   ZEVEN AFHANKELIJKHEDEN EN GEEN MEER. Ze komen alle zeven uit de samenstelling
   en worden meegegeven in plaats van hier opnieuw opgebouwd: wie hier `require`
   gaat schrijven, bouwt een tweede catalogus naast de eerste (LAT.md regel 4).

   HET WAREN ER EERST ZES, en dat is het vermelden waard omdat de fout
   leerzaamer is dan de reparatie. Ik heb die lijst met een regex over de
   verplaatste code GERADEN in plaats van hem te laten vaststellen, en `biebVan`
   viel eruit -- een naam die index.js uit `eigen` haalt en die in deze functie
   maar een keer voorkomt. Zeven toetsen van test/mediaos.test.js zakten meteen
   met een ReferenceError, en dat is precies zoals het hoort: een gemiste
   afhankelijkheid bij een verplaatsing is niet subtiel, hij is luid. Wie hier
   nog eens knipt, draait de code en laat de runtime de lijst opschrijven.
   ========================================================================== */
'use strict';

/* Deze twee reizen MEE uit index.js en worden hier niet opnieuw bedacht.
   `legeStand` is de lege-stand-tekst uit ./leeg.js (waarom een leeg raster geen
   antwoord is, staat daar), en WERELD_MAX is de bovengrens die deze wereld
   eindig maakt -- dat getal hoort bij de wereld en nergens anders. Ze stonden
   bovenaan index.js als bestandsconstanten; hier zijn ze wat ze al waren. */
const { legeStand } = require('./leeg');
const WERELD_MAX = 60; // een eindige wereld

module.exports = ({ MODI, catalogus, bronnen, smaak, zaakWereld, modiVoor, biebVan }) => {
/* ---- de wereld: één catalogus, drie standen ---- */
function wereld(sess, opties) {
  const o = opties || {};
  if (o.modus === 'zaak') return zaakWereld(sess);
  const modusNaam = MODI[o.modus] ? o.modus : 'alles';
  const modus = MODI[modusNaam];
  const alles = catalogus.alles(sess);
  const s = smaak.smaakVan(sess.key);

  // wie u volgt, afgeleid uit de domeinen zelf (geen tweede lijst)
  const volgt = new Set();
  for (const r of alles.rijen) if (r.volgIk) volgt.add((r.maker || {}).codenaam);

  const inModus = alles.rijen.filter(r => modus.vormen.includes(r.vorm));
  const geordend = smaak.smaakOrden(inModus, s, volgt);
  const bewaard = new Set(biebVan(sess.key).map(x => x.id));
  const rijen = geordend.rijen.slice(0, WERELD_MAX)
    .map(r => Object.assign({}, r, { bewaard: bewaard.has(r.id) }));

  const meer = geordend.rijen.length - rijen.length;
  /* Een leeg raster ziet eruit als een kapotte app en zegt niet waarom. Bij
     niets te tonen komt er daarom een stand mee die WEL iets zegt: wat hier
     komt, waarom het er nu niet is, en welke stap dat opheft (./leeg.js). */
  const leeg = rijen.length ? null : legeStand(modusNaam, alles.buiten, geordend.weggelaten, modus.vormen);
  return {
    status: 200, modus: modusNaam, modusNaam: modus.naam,
    leeg,
    modi: modiVoor(sess),
    stukken: rijen,
    totaal: geordend.rijen.length,
    einde: meer > 0
      ? 'Dat is wat er nu voor u klaarstaat; er staan nog ' + meer + ' stukken achter de rand.'
      : 'Dat was alles wat er nu staat.',
    uitleg: 'Op volgorde van: wie u volgt, wat u zelf hebt aangewezen, en daarna wat er het laatst bij kwam. ' +
      'Er is geen hitlijst en geen volgorde op kijkcijfers; bij elk stuk staat waarom het er staat.',
    weggelaten: geordend.weggelaten,
    /* Alleen de bronnen die in DEZE stand horen. Onder FLOW stond anders een
       kaart "Live staat buiten uw wereld" -- waar in die stand helemaal geen
       live in zit. Zelfde filter als in ./leeg.js, en om dezelfde reden: een
       scherm hoort geen deur te noemen die er niet toe doet. */
    buiten: (alles.buiten || []).filter(b => modus.vormen.includes(b.vorm)),
    smaak: s, regelaars: smaak.smaakRegelaars(),
    volgt: [...volgt].filter(Boolean)
  };
}

  return { wereld };
};
