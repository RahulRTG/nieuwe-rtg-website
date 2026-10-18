/* DE CODENAAM DIE HET LID INTYPT, ALLEEN ONDER ZIJN EIGEN CONNECTIES.

   De kring en de Live Circle vragen op het scherm om een codenaam ("Codenaam
   of sleutel", "Codenaam of bedrijfscode"), maar de kern kende alleen de
   sessiesleutel -- dus een verbonden vriend die je bij naam intypte, heette
   "niet verbonden" (gevonden door de voltooiproef, 18 oktober 2026). Het
   opzoeken gebeurt in de eigen connecties en nergens anders: een codenaam van
   een vreemde wordt zo nooit een sleutel, en deze weg is geen ledengids.

   `connecties` is een FUNCTIE die de vriendenlaag pas bij het opzoeken
   vraagt: die laag komt later in de kern dan RTG Veilig (opzet/kernlaag1.js).
   Is hij er (nog) niet, dan is er niemand te vinden -- nooit een gok.

   Losgemaakt uit opzet/kernlaag1.js, dat bedrading is en geen beleid; deze
   regel is beleid van RTG Veilig en woont daarom hier. */
'use strict';

module.exports = function maakVriendOpCodenaam(connecties) {
  return function vriendOpCodenaam(handle, tekst) {
    const t = String(tekst || '').trim().toLowerCase();
    const lees = connecties();
    if (!t || typeof lees !== 'function') return null;
    const c = ((lees(handle) || {}).connections || []).find(x => String(x.codename || '').toLowerCase() === t);
    return c ? c.key : null;
  };
};
