/* RTG Festival (deelmodule): DE SOORTEN PLEK. Pure data, met de rollen erbij.

   Afgesplitst van ./terrein.js omdat het een tabel is en geen gedrag: wie er
   een soort bij zet, hoort geen functie te hoeven lezen.

   DRIE ROLLEN, EN DAAR ZIT DE HELE ONDERSCHEIDING IN:

     telt      hier zijn mensen BINNEN; ze tellen mee in de bezetting
     poort     hier ga je DOORHEEN; je wordt geteld in de ouder, niet hier
     (geen)    een voorziening: bar, toilet, generator -- doorvoer, geen bezetting

   EN DAARNAAST EEN VLAG DIE GEEN ROL IS: `besloten`. Rechten GEVEN; er is niets
   dat ontzegt. Dat is met opzet -- een model met zowel toekennen als verbieden
   krijgt vroeg of laat een verbod en een toekenning over dezelfde plek, en dan
   moet iemand raden welke wint. Maar zonder tegenwicht opent een recht op "het
   hele terrein" ook backstage, en dat is precies fout.

   Een BESLOTEN plek lost dat op zonder een tweede mechanisme: hij erft niet. Een
   recht opent hem alleen als het recht die plek ZELF noemt (of iets dat erin
   ligt). Backstage, een crewzone, een VIP-dek: dat zijn de plekken waar een
   algemeen kaartje niet hoort te komen, en nu is dat een eigenschap van de PLEK
   in plaats van een uitzondering in elk recht.

   Die scheiding is er omdat de scan aan een POORT gebeurt en de telling in de
   plek erachter. Zonder dat onderscheid telt een ingang zijn eigen rij als
   publiek, en dan staat er een bezetting van 800 bij een hek waar niemand
   blijft staan.
*/
'use strict';

const SOORTEN = {
  terrein:     { telt: true,  wortel: true },
  zone:        { telt: true },
  podium:      { telt: true },
  camping:     { telt: true },
  backstage:   { telt: true },
  parking:     { telt: true },
  ingang:      { poort: true },
  uitgang:     { poort: true },
  nooduitgang: { poort: true },
  hek:         { poort: true },
  halte:       { poort: true },
  bar:         {}, food: {}, toilet: {}, waterpunt: {}, locker: {},
  ehbo:        {}, magazijn: {}, generator: {}, camera: {}, laadlos: {}, route: {}
};

module.exports = { PLEK_SOORTEN: SOORTEN };
