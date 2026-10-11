/* DE OVERGANG VAN EEN LEVERING -- mag deze bestelling nu naar deze stand?

   WAAR DIT UIT KOMT. De bezorgproef (scripts/bezorgproef.js) vond twee dingen
   die geen losse routetoets zag, en ze zaten op TWEE wegen tegelijk:

   1. BEZORGD ZONDER OOIT ONDERWEG TE ZIJN. `bezorg/status` en `order/status`
      zetten een levering op `bezorgd` terwijl de tas nog in de keuken stond, en
      het lid las "Uw bestelling is bezorgd. Eet smakelijk!" voor eten dat de
      deur nooit uit ging. Vertrekken had wel een poort (inpak + pakcheck), de
      eindstand niet -- dus kon je de hele bezorgketen overslaan door haar
      laatste stap te zetten.
   2. DEZELFDE STAND TWEE KEER. Een PDA die het antwoord niet kreeg en opnieuw
      stuurt, gaf het lid een tweede bericht over iets dat een keer gebeurde.

   WAAROM EEN EIGEN BESTAND. Beide routes kennen de bezorgstanden, en een regel
   die op twee plekken staat loopt uiteen (LAT-regel 4) -- de vertrekpoort stond
   al twee keer overgetypt. De regel staat hier een keer, de routes vragen hem.

   Wat dit NIET doet: een stand terugzetten verbieden in het algemeen. De
   bestelketen van een zaak kent ook `nieuw` -> `in bereiding` -> `klaar`, en
   die is van de keuken. De VOLGORDE geldt alleen voor de bezorghelft: het
   vertrek en de aankomst van een levering die bezorgd wordt. De HERHALING geldt
   voor elke bestelling: dezelfde stand nog eens zetten verandert niets, dus
   stuurt hij ook geen tweede "Uw bestelling is nu: klaar." */
'use strict';

const EIND = ['bezorgd', 'opgehaald', 'geweigerd', 'terugbetaald'];

/* Geeft { herhaling: true } als de bestelling al in deze stand staat (dan
   verandert er niets en gaat er geen bericht uit), { error, status } als de
   overgang niet mag, of {} als hij mag. */
function overgang(o, naar) {
  if (!o) return { status: 404, error: 'Bestelling niet gevonden.' };
  if (o.status === naar) return { herhaling: true };
  if (o.levering !== 'bezorgen') return {};
  if (naar === 'bezorgd' && o.status !== 'onderweg')
    return { status: 409, code: 'nooit-vertrokken',
      error: 'Een levering is pas bezorgd als hij onderweg was. Pak hem in, vink af en vertrek eerst.' };
  if (naar === 'onderweg' && EIND.includes(o.status))
    return { status: 409, code: 'al-klaar', error: 'Deze levering is al afgerond (' + o.status + ').' };
  return {};
}

module.exports = { overgang };
