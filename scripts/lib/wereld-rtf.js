/* ============================================================================
   DE RTF-KANT VAN HET GEZIN -- wie er aanklopt, per deelgebied.

   HET PROBLEEM is de derde variant van iets wat deze ronde al twee keer
   langskwam: een veldnaam die per deelgebied iets anders betekent. Bij het
   livinglab was dat `id` (een studie, een lab, een apparaat, een labpas); hier
   is het `token`.

   Alles onder /api/rtf/ draait op een gezinscode plus een PROFIELtoken
   (server/foundation/gezinshulp.js, verifieerProfiel). De lijfsleutelfamilie
   `gezin` levert het token van de BEHEERDER, en dat is voor een deel van dit
   domein precies de verkeerde persoon:

     /api/rtf/leerling/*   18 routes, allemaal "Vul eerst de geboortedatum in;
                           zonder leeftijdspas blijft het leerpaspoort dicht"
                           -- de beheerder is volwassen en heeft geen
                           leerlingpas; het KIND wel (routes/rtfleerling.js)
     /api/rtf/leren/*      dezelfde leerstof, dezelfde persoon
     /api/rtf/spel/*       een potje speelt het kind, niet zijn ouder
     /api/rtf/tiener/*     staat er in de naam

   en een deel juist wel de beheerder: /api/rtf/social/gezin/* is TOEZICHT --
   een ouder die naar de contacten van zijn kind kijkt. Die routes vragen niet
   om het kind als afzender maar om zijn HANDLE als onderwerp, en dat is weer
   iets anders: `rtf:<GEZINSCODE>:<profielId>` (gezinshulp.js, rtfHandle).

   Drie dingen dus, uit dezelfde wereld:

     token        wie klopt er aan          -- ouder of kind
     kindHandle   over wie gaat het         -- alleen bij toezicht
     profielId    welk profiel binnen het gezin

   DE BRON van het kind is de schoolwereld: die maakt er al een, met een
   geboortedatum (verplicht, want de school hangt er de leeftijdspas aan) en
   een eigen pincode waarmee het zichzelf kiest. Deze module maakt dus niets
   nieuws -- zij WIJST AAN wie van de twee bij welk deelgebied hoort.

   WAAROM EEN TABEL EN GEEN GOK. Elke regel hieronder komt uit een gemeten
   weigering: de route zegt zelf wie zij mist. Staat een deelgebied er niet in,
   dan gaat er niets extra's mee en blijft de beheerder de afzender -- dat is
   het bestaande gedrag en geen stille verandering. */
'use strict';

/* Deelgebieden waar het KIND de afzender is. */
const KIND_SPREEKT = [
  { pad: '/api/rtf/leerling', gemeten: 18, waarom: 'het leerpaspoort hoort bij een leerlingprofiel met een leeftijdspas' },
  { pad: '/api/rtf/leren', gemeten: 19, waarom: 'dezelfde leerstof als de school; de leerling doet de opgaven' },
  { pad: '/api/rtf/tiener', gemeten: 6, waarom: 'een tienerrekening staat op naam van de tiener' },
  { pad: '/api/rtf/spel', gemeten: 22, waarom: 'een potje speelt het kind zelf; zijn ouder zit er niet in' }
];

/* Deelgebieden die niet het kind als AFZENDER willen maar als ONDERWERP.
   Toezicht is de ouder die kijkt, dus het token blijft van de beheerder. */
const KIND_ALS_ONDERWERP = [
  { pad: '/api/rtf/social', gemeten: 8, waarom: 'toezicht: de ouder vraagt naar de contacten van zijn kind (kindHandle)' }
];

const rtfHandle = (code, profielId) => 'rtf:' + String(code).toUpperCase() + ':' + profielId;

function dekt(pad, lijst) {
  const p = String(pad || '');
  return lijst.find(x => p === x.pad || p.startsWith(x.pad + '/')) || null;
}

/* Wat er extra mee moet voor DIT pad. De basis (code + token van de beheerder)
   komt uit de gezinsfamilie en staat hier niet: deze module vult aan en
   vervangt alleen waar zij daar een gemeten reden voor heeft. */
function lijfVoor(wereld, pad) {
  if (!wereld || !wereld.code) return {};
  const uit = {};
  if (wereld.profielId) uit.profielId = wereld.profielId;

  if (dekt(pad, KIND_SPREEKT) && wereld.kindToken) {
    uit.token = wereld.kindToken;
    return uit;
  }
  if (dekt(pad, KIND_ALS_ONDERWERP) && wereld.profielId) {
    uit.kindHandle = rtfHandle(wereld.code, wereld.profielId);
    return uit;
  }
  return uit;
}

module.exports = { KIND_SPREEKT, KIND_ALS_ONDERWERP, rtfHandle, lijfVoor };
