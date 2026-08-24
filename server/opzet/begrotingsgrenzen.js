/* ============================================================================
   WELKE GRENS GELDT VOOR WELKE COLLECTIE, EN MAG HIJ BIJTEN?

   server/opzet/begroting.js is het MECHANISME: hij weegt een hervulling voordat
   hij landt. Dit bestand is het BESLUIT: hoeveel rijen mag er weg, per
   collectie, en telt dat als weigering of alleen als melding.

   WAAROM DAT UIT ELKAAR HOORT. De kop van begroting.js zei het al: "bewust een
   getal en geen tabel per actor -- die tabel zou verzonnen zijn, en een
   verzonnen risicoklasse is gevaarlijker dan geen. Welke actor een eigen grens
   nodig heeft, moet uit de meting komen." Die meting is er nu (KRIMP.json:
   negentien collecties, met de route erbij), dus de tabel kan bestaan zonder
   verzonnen te zijn -- maar dan wel als een eigen ding, met per regel waarom
   hij er staat.

   DE REGEL IS EEN BLAST RADIUS EN GEEN GEBRUIKSGRENS. De vraag is niet "hoeveel
   verwijdert iemand normaal" maar "hoeveel mag er in EEN handeling kapot". Voor
   een route die er per keer een weghaalt -- een clip, een video, een zetel -- is
   honderd twee ordes boven zowel het gemetene (een) als het ontworpene (een), en
   ver onder een massaverwijdering. Dat is het hele recept, en het staat hier
   zodat niemand hoeft te raden waar die honderd vandaan komt.

   DE UITZONDERINGEN ZIJN HET BELANGRIJKSTE DEEL. Zes collecties worden geraakt
   door het vergeetpad (server/kern/vergeten/): daar haalt EEN handeling alles
   van EEN lid weg, en dat is per ontwerp onbegrensd -- een lid met achthonderd
   berichten hoort die achthonderd te kunnen laten wissen. Een grens daarop
   breekt het recht om vergeten te worden, en dat is geen risico maar een
   toezegging. Die zes staan hieronder met handhaaf:false, en ze horen daar te
   blijven staan tot iemand het vergeetpad buiten een verzoek trekt.

   WAT ER NIET IN STAAT. Collecties die de meting niet heeft gezien, staan hier
   niet en vallen op de standaardgrens terug. Dat is met opzet: de catalogus is
   een ONDERGRENS (de toetsen doen niet wat gebruikers doen), dus een collectie
   die hier ontbreekt is geen collectie waarvan we weten dat hij nooit krimpt --
   het is er een waar we niets over hebben gemeten. De standaardgrens van
   duizend is voor die gevallen een noodrem en geen fijnregeling.

   HET REGISTER STAAT BUITEN DE CODE (BEGROTING.json) omdat het een besluit is
   en geen implementatie: wie een grens verzet, hoort dat te doen op een plek
   waar de reden ernaast staat en waar een diff het laat zien.
   ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');

const REGISTER = path.join(__dirname, '..', '..', 'BEGROTING.json');
const STANDAARD = 1000;

let geladen = null;

/* EEN ONLEESBAAR REGISTER MAG DE OPSLAG NIET TEGENHOUDEN, maar het mag ook niet
   stil de tabel laten verdwijnen: dan zou elke collectie ineens op de
   standaardgrens vallen zonder dat iemand het merkt. Dus: terugvallen op leeg
   EN het zeggen (LAT.md regel 5). */
function laad(deps) {
  if (geladen && !(deps && deps.opnieuw)) return geladen;
  let ruw = null;
  try { ruw = JSON.parse(fs.readFileSync((deps && deps.pad) || REGISTER, 'utf8')); }
  catch (e) {
    const meld = (deps && deps.log) || ((n, b, v) => { try { require('../log').log[n](b, v); } catch (e2) {} });
    meld('warn', 'begroting: register niet leesbaar, alles valt op de standaardgrens',
      { fout: String((e && e.message) || e).slice(0, 120) });
    ruw = {};
  }
  const collecties = (ruw && typeof ruw.collecties === 'object' && ruw.collecties) || {};
  geladen = {
    standaard: Number.isFinite(ruw && ruw.standaard) ? ruw.standaard : STANDAARD,
    collecties
  };
  return geladen;
}

/* De grens voor deze collectie: uit het register, anders de standaard. */
function grensVoor(collectie, deps) {
  const r = laad(deps);
  const c = r.collecties[String(collectie)];
  return (c && Number.isFinite(c.grens)) ? c.grens : r.standaard;
}

/* MAG DEZE COLLECTIE GEWEIGERD WORDEN? Standaard ja -- een collectie waar niets
   over besloten is, valt onder de noodrem van de standaardgrens. Nee is een
   EXPLICIETE uitzondering met een reden ernaast; vandaag zijn dat de zes
   collecties van het vergeetpad. */
function handhaaft(collectie, deps) {
  const c = laad(deps).collecties[String(collectie)];
  return !(c && c.handhaaf === false);
}

function stand(deps) {
  const r = laad(deps);
  const namen = Object.keys(r.collecties);
  return {
    standaard: r.standaard,
    collecties: namen.length,
    uitgezonderd: namen.filter(n => r.collecties[n].handhaaf === false)
  };
}

module.exports = { grensVoor, handhaaft, stand, laad, REGISTER, STANDAARD };
