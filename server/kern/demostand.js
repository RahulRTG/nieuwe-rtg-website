/* STAAT DE DEMO AAN? ÉÉN VRAAG, ÉÉN ANTWOORD.

   server.js beantwoordt hem al voor de demo-INLOG (`const DEMO`), en de seed
   volgt sinds kort dezelfde regel. Maar de zes VERZONNEN INSTELLINGEN --
   Gemeente Eivissa, RTG Airport, Ibiza Transit, FC RTG, de Rijksoverheid en de
   Brigade RTG Airport -- worden lui gezaaid, diep in hun eigen wereldmodule, en
   die modules krijgen de DEMO-vlag niet mee. Ze stonden daarom OOK op een echte
   server: wie de gemeente-app opende zag een gemeente op Ibiza met twee
   bekendmakingen over een boulevard die niet bestaat.

   Dat via zes constructor-signaturen doorgeven zou zes plekken raken voor één
   feit. Dit bestand is dat ene feit: dezelfde omgevingsvariabele, één keer
   uitgelegd, door iedereen te lezen.

   TWEE DINGEN ZIJN NODIG, EN HET ZIJN VERSCHILLENDE DINGEN:
   - `demoAan()` gaat over ZAAIEN: zonder demo maken we die instellingen niet
     aan, dus een schone installatie blijft schoon.
   - `geseed: true` op de zaak zelf gaat over OPRUIMEN: op een database die ooit
     mét demo begon staan ze er al, en dan haalt de opruiming in
     kern/initdata/index.js ze weg -- die gaat op dat merkteken en niet op een
     handlijst (zie daar waarom).

   Bewust GEEN cache: een toets die de vlag tussen twee servers omzet moet dat
   ook echt gemeten krijgen. */
'use strict';

function demoAan() {
  /* De synthetische wereldmodules moeten exact dezelfde poort gebruiken als
     server.js. Sinds de afgescheiden Magnaat-testomgeving heet die vlag
     RTG_MAGNAAT_TEST; alleen de oude RTG_DEMO-vlag lezen liet de accounts wel
     ontstaan, maar niet hun gemeente, luchthaven, rijk en andere instellingen. */
  return require('../testomgeving').actief(process.env);
}

module.exports = { demoAan };
