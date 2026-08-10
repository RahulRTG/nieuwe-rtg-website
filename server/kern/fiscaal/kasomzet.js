/* EEN plek voor de vraag: telt deze kassabon mee, of staat het bedrag al ergens
   anders?

   Die vraag stond op vier plekken en werd op vier manieren beantwoord: de
   maandboekhouding (kern/fiscaal/index.js) sloeg 'rtg' en 'kamer' over, het
   dagrapport (./rapporten.js) ook 'tafel', het kassa-dagoverzicht
   (kern/leverancier/zaak.js) alleen 'kamer', en de weekgrafiek van het kantoor
   (routes/supplier/backoffice.js) weer 'rtg' en 'kamer'. Vier antwoorden op
   dezelfde vraag; het verschil was geen keuze maar drift, en het kostte de
   maandboekhouding een dubbeltelling (TAKEN.md 4.28).

   Het zijn WEL twee vragen, en dat is precies waar ze uiteenliepen:

     btwOmzet(bon)    -- draagt deze bon omzet van de zaak, met btw erover?
     doorDeKassa(bon) -- ging dit bedrag door de kassa?

   Ze verschillen op EEN punt: een bon op 'rtg' is een bestelling uit de app die
   aan de balie wordt geind. De omzet staat al op die bestelling (db.data.orders
   telt hem), dus voor de btw telt de bon niet -- maar het geld ging wel degelijk
   over de toonbank, dus in het kassaoverzicht hoort hij er wel bij te staan.

   Wat ze delen:
     'kamer' en 'tafel'  openstaande lasten op een rekening. Het bedrag telt pas
                         bij het uitchecken, en dan draagt de gebundelde bon het.
     omzetElders         een gebundelde bon waarvan de DELEN al meetellen. Het
                         tafelticket bundelt bestellingen uit db.data.orders;
                         zonder dit merk telde de zaak ze twee keer.

   Nieuwe soorten bundelbonnen zetten `omzetElders` op de reden ('bonnen',
   'kamerlasten', ...) in plaats van hier een methode bij te schrijven -- een
   merk op de bon zelf kan niet uiteenlopen met de plek die hem maakt. */

// methoden waarvan het bedrag elders al als omzet staat
const NIET_ALS_OMZET = new Set(['rtg', 'kamer', 'tafel']);
// methoden die geen echt geld door de kassa laten gaan (open rekeningposten)
const NIET_DOOR_KASSA = new Set(['kamer', 'tafel']);

// een gebundelde bon waarvan de onderdelen al ergens geteld worden
const isBundel = (bon) => !!(bon && bon.omzetElders);

/* Telt deze kassabon als omzet van de zaak (en dus voor de btw)? */
function btwOmzet(bon) {
  if (!bon || isBundel(bon)) return false;
  return !NIET_ALS_OMZET.has(bon.method);
}

/* Ging dit bedrag echt door de kassa? Zelfde regel, maar 'rtg' telt hier wel:
   dat is geld dat aan de balie is geind, alleen boekt de bestelling de btw. */
function doorDeKassa(bon) {
  if (!bon || isBundel(bon)) return false;
  return !NIET_DOOR_KASSA.has(bon.method);
}

module.exports = { btwOmzet, doorDeKassa, isBundel, NIET_ALS_OMZET, NIET_DOOR_KASSA };
