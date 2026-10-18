/* Het spoor van een website: wie deed wat, wanneer.

   Dit hoort bij de goedkeuringsflow uit routes/zaakweb.js. Daar is vastgelegd
   dat alleen de leiding iets naar buiten brengt -- maar een goedkeuring waar
   geen verslag van is, is achteraf niet te controleren, en dan is het geen
   goedkeuring maar een gewoonte. Vandaar dit spoor.

   Het spoor noemt de handeling en de mens die hem deed. Bij een zaak is dat de
   naam waarmee die persoon is ingelogd (die staat toch al in de
   activiteitenlijst van de zaak); bij een lid is er niemand anders, dus daar
   blijft de naam leeg. Er staat nooit inhoud in: wat er veranderde staat in de
   versiegeschiedenis, hier staat alleen dat het gebeurde. */
module.exports = ({ store, save, scho }) => {
  const MAX = 40;

  function pot() {
    const s = store();
    if (!s.spoor || typeof s.spoor !== 'object') s.spoor = {};
    return s.spoor;
  }

  function noteer(id, wat, wie) {
    if (!id || !wat) return;
    const p = pot();
    const rij = p[id] = (p[id] || []);
    rij.unshift({ op: new Date().toISOString(), wat: scho(wat, 40), wie: wie ? scho(wie, 60) : null });
    p[id] = rij.slice(0, MAX);
    // bewaren doet de aanroeper: die weet of er nog meer in dezelfde stap verandert
  }

  function lees(id) { return (pot()[id] || []).slice(); }
  /* WISSEN LEGT GEEN BAK AAN. Hier stond `const p = pot(); delete p[id];`, en
     pot() maakt de bak als hij er niet is -- dus het verwijderen van een site
     zonder spoor liet een lege `spoor: {}` achter. Precies het omgekeerde
     van wat webmaker.js bij verwijder() belooft ("een site die weg is, laat
     niets achter"), en de herstelproef zag het: /api/site/bewaar ->
     /api/site/verwijder stond daardoor op compensatie in plaats van exact. */
  function wis(id) {
    const p = store().spoor;
    if (!p || typeof p !== 'object' || !Object.prototype.hasOwnProperty.call(p, id)) return;
    delete p[id];
    save();
  }

  return { noteer, lees, wis, MAX };
};
