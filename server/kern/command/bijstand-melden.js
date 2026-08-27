/* HET BERICHT AAN DE KLANT BIJ EEN LOPENDE BIJSTANDSSESSIE.

   WAT ER MIS WAS, EN HET WAS SUBTIEL. De klant kon alles zien: het spoor loopt
   live mee, het dossier staat open, de kaart in het Werk OS toont de sessie. Hij
   zag het dus -- ALS HIJ KEEK. Hij kreeg geen seintje. En "toegang is een
   uitnodiging" wordt dun als de uitgenodigde binnenkomt op een moment dat de
   gastheer toevallig niet naar de deur kijkt.

   HET KANAAL IS ZIJN EIGEN JOURNAAL, en dat is een BESLUIT met een reden.

   Waarom dit kanaal: het bestaat al (bedrijf/rollen.js en kern/tenant/bewijs.js
   schrijven er ook in), de klant leest het al (bedrijf/inzicht.js toont het bij
   elk object), het is duurzaam (het overleeft een gesloten tabblad, anders dan
   een melding op een scherm) en het is auditeerbaar (wie later vraagt "wist ik
   dit", ziet de regel met tijdstip staan). Een supportsessie die in het
   auditspoor van de klant staat, is een supportsessie waarover geen discussie
   ontstaat.

   EN WAAROM ER GEEN MAIL EN GEEN TELEFOONMELDING BIJ KOMT. Dat is hetzelfde
   kanaalbesluit als bij het alarm in SLO.md, met dezelfde prijs: een kanaal naar
   buiten dat niemand heeft afgesproken, is een kanaal dat op het verkeerde
   moment bij de verkeerde persoon aankomt -- 's nachts, bij een oud adres, of
   bij iemand die er niets mee kan. Dat hoort een klant IN TE STELLEN en niet
   stilzwijgend te krijgen. Zolang dat niet is afgesproken, staat het in
   BESTUUR.md par. 8 bij wat er bewust niet komt, en niet hier als knop.

   WAT DIT DUS WEL EN NIET IS: het is een bericht dat er ALTIJD is als hij kijkt,
   en dat blijft staan. Het is geen duwtje op zijn telefoon. */
'use strict';

const tenantJournaal = require('../tenant/journaal');

/* De werkruimte van de sessie. Een sessie hoort bij een ORGANISATIE, en een
   organisatie kan meer werkruimtes hebben -- maar de uitnodiging kwam uit één
   werkruimte, en dat is de plek waar de mensen zitten die hem opende. Daar hoort
   het bericht. Staat die er niet (meer), dan gebeurt er niets: een bericht in
   het journaal van een andere werkruimte zou bij mensen aankomen die er niets
   mee te maken hebben. */
function ruimteVan(opslag, s) {
  return opslag.vreemd.werkruimte(s && s.werkruimte);
}

/* `wie` is met opzet 'RTG Bijstand' en geen medewerkersnaam. Aan de RTG-kant
   draagt een medewerker een codenaam (`user-...`), en die in het journaal van
   een klant zetten geeft hem een handvat dat hem niets zegt en ons een naam die
   hij niet hoort te hebben. Wat hij WEL moet kunnen: dit terugvinden. Daarom
   staat het sessie-id in `waarover`. */
function meld({ opslag, save }, s, wat, reden) {
  const w = ruimteVan(opslag, s);
  if (!w) return false;
  tenantJournaal.schrijf(w, 'RTG Bijstand', wat, 'bijstand ' + s.id, reden || null);
  save();
  return true;
}

module.exports = { meld, ruimteVan };
