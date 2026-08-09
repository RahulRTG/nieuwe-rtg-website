/* RTG Stadsweefsel, deel "gebiedmaak": er komt een gebied bij.

   ./geografie.js bevraagt de boom; dit bestand voegt eraan toe. De regels hier
   zijn kort maar geen formaliteit:

   ALLEEN EEN STAD IS EEN WORTEL. Er stond geen eis op de ouder; wat een gebied
   zonder ouder tegenhield was de coordinaattoets tegen de vaste rechthoek van
   Ibiza. Dat werkte zolang er EEN stad was, en het is de verkeerde reden: een
   buurt zonder ouder hangt nergens onder, en met meerdere steden hoort hij dan
   bij geen enkele -- dus mist elke stad-gescopete vraag hem stilzwijgend.

   EN DE GRENZEN ZIJN DIE VAN DE STAD waarin het gebied komt. Met de ene vaste
   rechthoek als enige toets is een gebied in een tweede stad per definitie
   "buiten de stadsgrenzen", en dan kan die stad nooit gevuld worden. */
'use strict';

module.exports = ({ NIVEAUS, gebied, gebieden, save, crypto, schoon, middenVan,
  zorgGeografie, grenzenVan, stadVan }) => {
  return function gebiedMaak({ niveau, naam, ouder, punten, soort }) {
    zorgGeografie();
    if (!NIVEAUS.includes(String(niveau || ''))) return { status: 400, error: 'Kies een niveau: ' + NIVEAUS.join(', ') + '.' };
    const n = schoon(naam, 60);
    if (!n) return { status: 400, error: 'Hoe heet het gebied?' };
    const o = ouder ? gebied(ouder) : null;
    if (ouder && !o) return { status: 404, error: 'Dat ouder-gebied bestaat niet.' };
    /* ALLEEN EEN STAD IS EEN WORTEL. Hier stond geen eis op de ouder; wat een
       gebied zonder ouder tegenhield was de coordinaattoets tegen de vaste
       rechthoek van Ibiza. Dat werkte zolang er EEN stad was, en het is de
       verkeerde reden: een buurt zonder ouder hangt nergens onder, en met
       meerdere steden hoort hij dan bij geen enkele -- dus mist elke
       stad-gescopete vraag hem stilzwijgend. De eis is nu wat hij altijd had
       moeten zijn. */
    if (niveau === 'stad') {
      return { status: 400, error: 'Een stad maak je met stadErbij; die bouwt ook meteen de wijken, ' +
        'buurten, zones en straatsegmenten eromheen. Een kale stad zonder raster is een lege wortel.' };
    }
    if (!o) return { status: 400, error: 'Een ' + niveau + ' hangt onder een gebied. Geef een ouder op.' };
    if (o && NIVEAUS.indexOf(o.niveau) >= NIVEAUS.indexOf(niveau))
      return { status: 400, error: 'Een ' + niveau + ' hoort onder een ' + NIVEAUS[NIVEAUS.indexOf(niveau) - 1] + ', niet onder een ' + o.niveau + '.' };
    /* DE GRENZEN ZIJN DIE VAN DE STAD WAARIN HET GEBIED KOMT, en niet meer de
       ene vaste rechthoek uit kern/navigatie. Die rechthoek beschrijft Ibiza;
       met hem als enige toets is een gebied in een tweede stad per definitie
       "buiten de stadsgrenzen" -- en dan kan die stad nooit gevuld worden.
       Zonder ouder (een nieuwe stad zelf) gelden alleen geldige coordinaten. */
    const grens = o ? grenzenVan(stadVan(o.id)) : null;
    const rij = (Array.isArray(punten) ? punten : []).map(q => ({ lat: Number(q && q.lat), lng: Number(q && q.lng) }))
      .filter(q => Number.isFinite(q.lat) && Number.isFinite(q.lng) &&
        Math.abs(q.lat) <= 90 && Math.abs(q.lng) <= 180 &&
        (!grens || (q.lat >= grens.lat0 && q.lat <= grens.lat1 && q.lng >= grens.lng0 && q.lng <= grens.lng1)));
    if (!rij.length) {
      return { status: 400, error: o ? 'Geef minstens een punt binnen de grenzen van ' + stadVan(o.id).naam + '.'
        : 'Geef minstens een geldig punt.' };
    }
    const s = ['punt', 'lijn', 'vlak'].includes(soort) ? soort : (rij.length === 1 ? 'punt' : rij.length === 2 ? 'lijn' : 'vlak');
    const g = { id: 'G-' + crypto.randomBytes(4).toString('hex'), niveau, naam: n,
      ouder: o ? o.id : null, geometrie: { soort: s, punten: rij }, centrum: middenVan(rij) };
    gebieden().push(g);
    save();
    return { ok: true, gebied: g };
  }


};
