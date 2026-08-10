/* Het gemiddelde cijfer van een zaak, als PURE functie.

   Waarom dit apart staat: de Mall wil bij elk aanbod laten zien hoe de zaak
   beoordeeld is, en de verleiding is dan om dat gemiddelde daar nog een keer
   uit te rekenen. Dat is precies de dubbele waarheid die LAT-regel 4 verbiedt:
   twee sommen over dezelfde reviews die na een wijziging uit elkaar lopen.
   Daarom staat de som hier een keer, en lezen zowel kern/ervaring/leden/
   waardering.js als kern/mall/aanbod.js hem uit dit bestand.

   De lopende som staat in db.data.reviewStats (code -> {som, aantal}), gezet
   bij het plaatsen van een review. Dat is O(1) per opzoeking, ook met miljoenen
   reviews -- de reden dat de Mall dit uberhaupt per aanbod kan tonen.

   NIETS is hier een keurmerk. Een cijfer zegt wat leden na een afgeronde
   dienst hebben ingevuld; het zegt niet dat RTG de zaak goedkeurt. Dat verschil
   staat ook in de Mall zelf naast het cijfer. */

function ratingVanZaak(db, code) {
  const st = (((db || {}).data || {}).reviewStats || {})[code];
  if (!st || !st.aantal) return null;
  return { score: Math.round((st.som / st.aantal) * 10) / 10, aantal: st.aantal };
}

module.exports = { ratingVanZaak };
