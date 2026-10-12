/* WIJZIGEN IN WOORDEN -- "maak er vijf dagen van" over het object dat het lid
   aanwijst, langs de EIGEN wijzigingsroute van zijn domein (EDGE.md par. 14.7).

   Dit bestand verzint geen wijziging en voert er zelf geen uit. Het domein leest
   de velden uit de zin (tekstVelden) en past ze toe (pasAan) -- dezelfde functie
   die het scherm gebruikt, zodat typen en klikken nooit twee wegen zijn. Wat
   hier staat is de poort ertussen:
     - alleen als de vraag het object wil VERANDEREN (relatie `wijzig`);
     - alleen een object dat de server voor deze mens vond (canoniek);
     - en vlak voor het schrijven nog een keer: is het van deze sessie?

   Afgesplitst uit ./menscontext-opzoek.js om de bestandsgrens; `achter` is de
   koppeling beeld -> { dom, rij } van die module, hier alleen gelezen. */
'use strict';

module.exports = function maakWijziging(achter) {
  /* Leest alleen: welke velden noemt de vraag, over welk object. */
  function lees(relatie, object, vraag) {
    const a = relatie === 'wijzig' && object ? achter.get(object) : null;
    if (!a || !a.dom.tekstVelden) return null;
    let velden = null;
    try { velden = a.dom.tekstVelden(String(vraag || '')); } catch (e) { velden = null; }
    return velden && typeof velden === 'object' && Object.keys(velden).length ? Object.freeze({ object, velden }) : null;
  }
  /* Past toe met de sessie van de vraag; null als er niets toe te passen is. */
  function pasAanUitTekst(sessie, sch) {
    const w = sch && sch.wijziging;
    const a = w ? achter.get(w.object) : null;
    if (!a || !a.dom.pasAan || !sessie || !sessie.key) return null;
    if (String(a.dom.eigenaar(a.rij)) !== String(sessie.key)) return null;
    return a.dom.pasAan(sessie, a.rij, w.velden);
  }
  return { lees, pasAanUitTekst };
};
