/* Kern-module "levensgraaf": wat u heeft, en wanneer het aandacht vraagt.

   DIT IS DE MOTOR, EN HIJ IS VOOR IEDEREEN. Hij is hier weggehaald uit
   kern/bureau, waar hij achter de Lifestyle Pass zat. Dat was verkeerd om: een
   gratis lid heeft ook een paspoort dat verloopt en een bestelling die komt, en
   dat is precies zo'n datum die je vergeet en op de verkeerde dag tegenkomt --
   op een vliegveld. De motor hoort algemeen te zijn; wat het KANTOOR ermee doet
   (mandaat, zaken, orkestratie, twintig kamers) mag premium blijven.

   Twee delen, en verder niets:

     ./graaf.js      de Life Graph: elke knoop met zijn vijf etiketten (bron,
                     eigenaar, wie het mag zien, gevoeligheid, vervaldatum).
     ./termijnen.js  de Control Tower: alle datums in vier vensters, plus het
                     venster dat nergens bestond -- achterstallig.

   De bronnen staan in ./bronnen*.js. Ze leveren alle drie hun knopen op dezelfde
   manier en weten niets van elkaar:

     bronnen-basis     het ledendossier zelf (paspoort). Iedereen.
     bronnen-platform  wat het lid HIER al deed (boekingen, agenda). Iedereen.
     bronnen 1/2/3     het lifestyle-dossier (Maison, Hangar, Cellier, ...).
                       Die geven vanzelf niets terug voor wie dat dossier niet
                       heeft -- er is dus GEEN pas-controle in de motor nodig,
                       en die staat er ook niet. De poort zit op de route.

   NIETS HIERVAN SCHRIJFT. De graaf is een projectie: hij leest de apps die de
   waarheid beheren en bouwt zijn knopen elke keer opnieuw. Zie de kop van
   ./graaf.js voor waarom dat de hele opzet draagt.

   Gemount vanuit opzet/kernlaag3.js, vóór kern/bureau (dat hem gebruikt). */
'use strict';

module.exports = ({ db, paspoortVervalt }) => {
  const vandaag = () => new Date().toISOString().slice(0, 10);
  const graafMod = require('./graaf')({ db, vandaag, paspoortVervalt });
  const termijnenMod = require('./termijnen')({ graaf: graafMod.graaf });

  return {
    levensgraaf: {
      graaf: graafMod.graaf,
      voor: graafMod.graafVoor,
      samenvatting: graafMod.samenvatting,
      knoopFabriek: graafMod.knoop,
      tower: termijnenMod.tower,
      termijnen: termijnenMod.termijnenAlle
    }
  };
};
