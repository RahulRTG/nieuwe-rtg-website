/* DE HERKOMSTSCHAKELAAR -- voor WELKE WERELD bijt de herkomstpoort?

   LOS VAN ./lusstap.js OMDAT HET TWEE DINGEN ZIJN, en de naad is dezelfde als
   tussen ../isolatie/ontsluiting.js en ../isolatie/ceremonie-eisen.js: dat
   bestand VOERT de ceremonie uit en dit bepaalt wat zij VRAAGT. Hier voert
   lusstap.js de poort uit en bepaalt dit bestand voor wie hij geldt. De eerste
   schuift als de lus verandert, de tweede als het BELEID verandert -- en samen
   in een bestand betekent dat elke beleidswijziging de lusmachinerie aanraakt.
   (Praktisch gaf lusstap.js daar ook meteen de rekening voor: hij ging door de
   10 KB van keuringsregel 13.)

   HIJ IS PUUR EN HEEFT GEEN TOESTAND BUITEN DE OMGEVING, zodat een toets hem
   kan beproeven zonder een lus, een server of een sessie op te tuigen. */
'use strict';

/* PER WERELD EN NIET EEN SCHAKELAAR VOOR HET HELE HUIS.

   `RTG_HERKOMST_AFDWINGEN=1` zette de poort in een klap aan voor lid, zaak en
   personeel tegelijk, en dat is precies de vorm waarin een gemeten prijs niet
   te dragen is: de prijs verschilt per wereld (een lid houdt 36 van 120 paden
   over, een zaak 9 van 53) en de eigenaar hoort hem per wereld te kunnen
   betalen. CONTROLPLANE.md schrijft die volgorde voor -- schaduw, dan beperkt,
   dan wereld voor wereld -- en met een enkele boolean kan die middelste stap
   niet bestaan.

   DE WERELDNAMEN KOMEN UIT HET BELEID en staan hier niet overgetypt: wie er een
   wereld bij zet in ./beleid-lijsten.js krijgt hem hier vanzelf, en een tikfout
   in de omgeving valt op in plaats van stil niets te doen.

   EEN TIKFOUT IS EEN FOUT EN GEEN "UIT". Dit is de gevaarlijke kant: wie
   `RTG_HERKOMST_AFDWINGEN=leden` zet (in plaats van `member`) zou met een stille
   `false` een beveiliging uit hebben staan terwijl hij denkt van niet. Daarom
   wordt de waarde EEN KEER bij het laden gekeurd, met dezelfde fail-fast als
   ../isolatie/herkomst.js: een onbekende naam gooit, met de bekende namen erbij.

   EN EEN ONBEKENDE WERELD VALT DICHT. Staat er ergens iets aan en komt er een
   wereld langs die we niet kennen, dan telt hij als afgedwongen. Dat is dezelfde
   keuze als SEC-LOCK-004 en als `klasseVan()` in herkomst.js: "we weten het
   niet" is bij onvertrouwde invoer geen grond om door te laten. */
const WERELDEN = Object.freeze(Object.keys(require('./beleid-lijsten').LEZEN));

function keurAfdwingen() {
  const rauw = String(process.env.RTG_HERKOMST_AFDWINGEN || '').trim();
  if (!rauw) return { aan: false, werelden: new Set(), alle: false };
  if (rauw === '1' || rauw.toLowerCase() === 'alle') return { aan: true, werelden: new Set(WERELDEN), alle: true };
  const gekozen = rauw.split(/[,\s]+/).filter(Boolean).map(w => w.toLowerCase());
  const onbekend = gekozen.filter(w => !WERELDEN.includes(w));
  if (onbekend.length) {
    throw new Error('stuur/lusstap: RTG_HERKOMST_AFDWINGEN noemt de onbekende wereld(en) "' +
      onbekend.join('", "') + '". Bekend zijn: ' + WERELDEN.join(', ') + ', of "1"/"alle" voor allemaal. ' +
      'Een tikfout hier zou de herkomstpoort stil uit laten staan.');
  }
  return { aan: true, werelden: new Set(gekozen), alle: gekozen.length === WERELDEN.length };
}

/* Een keer gelezen, want de omgeving verandert niet tijdens een proces -- en een
   keuring die per aanroep gooit, gooit midden in een gesprek. */
let _stand = null;
const stand = () => (_stand || (_stand = keurAfdwingen()));

function AFDWINGEN(wereld) {
  const st = stand();
  if (!st.aan) return false;
  const w = String(wereld || '').toLowerCase();
  if (!w || !WERELDEN.includes(w)) return true;   // onbekende wereld: dicht
  return st.werelden.has(w);
}

/* Alleen voor de toets: de omgeving kan daar wel wisselen. */
AFDWINGEN.vergeet = () => { _stand = null; };

module.exports = AFDWINGEN;
