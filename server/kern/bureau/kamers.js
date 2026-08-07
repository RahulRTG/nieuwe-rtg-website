/* Het Privekantoor, deelbestand "kamers": de twintig werelden.

   Een privekantoor beslaat een heel leven, en dat leven valt uiteen in werelden:
   het huis, de reizen, het vervoer, de kring, het vermogen, wat er na u komt. Dit
   bestand is de plattegrond.

   DE STATUS WORDT AFGELEID EN NIET BEWEERD. Elke kamer noemt de apps die hem
   vullen; heeft hij er geen, dan staat hij op "in aanbouw" en zegt het scherm dat
   ook. Er is dus geen veld waarin iemand "ingericht" kan typen voor een kamer die
   leeg is. Dat is regel 6 van de lat -- een belofte in tekst is een belofte in
   code -- toegepast op de plattegrond zelf: de enige manier om een kamer
   ingericht te krijgen is er een app achter zetten.

   `test/bureau.test.js` trekt het door: elk pad hieronder moet als bestand
   bestaan. Een kamer die naar een pagina wijst die er niet is, is een gesloten
   deur met een bordje erop, en dat is precies het soort belofte dat een
   twintigduizend-euro-propositie niet kan hebben.

   ER STAAT GEEN KAMER MEER LEEG. Beveiliging, reputatie, persoonlijke inkoop en
   dieren stonden hier een tijd als "in aanbouw"; die vier zijn gebouwd. Het
   mechanisme blijft staan en dat is de bedoeling: `status` volgt uit de apps, en
   een nieuwe wereld die niemand nog heeft gebouwd komt hier vanzelf als "in
   aanbouw" op het scherm in plaats van dat hij wordt weggelaten.

   Wat de orkestratie zegt over wat zij NIET weet, komt uit ditzelfde bestand
   (inAanbouw). Nu die lijst leeg is, zegt zij dat ook -- en zodra er weer een
   kamer bij komt die nog niet af is, zegt zij dat vanzelf opnieuw.

   Gemount via ./index.js. */
'use strict';

// De twintig werelden staan als tabel in ./plattegrond.js; hier staat de motor.
const KAMERS = require('./plattegrond');

/* De statusregel, als functie en niet als uitdrukking midden in een map().

   Reden: zolang elke kamer apps heeft, is "status wordt afgeleid" niet te
   beproeven via de echte plattegrond -- er is geen kamer die "in aanbouw" hoort
   te heten, dus een mutatie die de regel vervangt door de vaste tekst
   'ingericht' verandert niets en blijft groen. Dat is precies de vorm waar regel
   9 van de lat voor waarschuwt.

   Als functie kan de toets hem rechtstreeks een kamer zonder deur voeren. Zie
   test/bureau.test.js. Hij heet `kamerStatus` en niet `statusVan`: dat laatste
   stond al in twee andere kernmodules, en de keuring wees dat aan. */
function kamerStatus(kamer) {
  return (kamer && kamer.apps && kamer.apps.length) ? 'ingericht' : 'in aanbouw';
}

module.exports = (ctx) => {
  const { samenvatting } = ctx;

  /* De plattegrond met de stand van dit lid erop. `status` volgt uit de apps
     (zie de kop), `gevuld` uit de graaf: een kamer kan ingericht zijn en toch
     leeg, en dat is iets anders dan in aanbouw. Het scherm zegt dat verschil
     hardop, want "u heeft hier nog niets staan" nodigt uit en "wij hebben dit
     nog niet gebouwd" is een excuus. */
  function kamers(key, voorafG) {
    const sam = samenvatting(key, voorafG);
    return {
      status: 200,
      kamers: KAMERS.map(k => {
        const telling = k.kamers.reduce((s, naam) => {
          const c = sam.perKamer[naam];
          return { knopen: s.knopen + (c ? c.knopen : 0), waarde: s.waarde + (c ? c.waarde : 0), termijnen: s.termijnen + (c ? c.termijnen : 0) };
        }, { knopen: 0, waarde: 0, termijnen: 0 });
        return Object.assign({}, k, {
          status: kamerStatus(k),
          gevuld: telling.knopen > 0,
          knopen: telling.knopen, waarde: telling.waarde, termijnen: telling.termijnen
        });
      }),
      ingericht: KAMERS.filter(k => kamerStatus(k) === 'ingericht').length,
      inAanbouw: KAMERS.filter(k => kamerStatus(k) === 'in aanbouw').length
    };
  }

  // welke werelden nog geen deur hebben; de orkestratie gebruikt dit om te
  // zeggen waar hij geen zicht op heeft (zie orkestratie.js)
  const inAanbouw = () => KAMERS.filter(k => kamerStatus(k) === 'in aanbouw').map(k => k.id);

  return { kamers, inAanbouw, kamerStatus, BUREAU_KAMERS: KAMERS };
};
