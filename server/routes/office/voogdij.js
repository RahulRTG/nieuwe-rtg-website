/* HET KANTOORBESLUIT OVER EEN VOOGDIJ (kern/vertegenwoordiging/jeugd.js).

   Hij staat hier en niet bij de andere vertegenwoordigingsroutes, en dat is geen
   ordeningskwestie: routes/vertegenwoordiging.js draait achter de domeingrens
   `vertegenwoordiging` en kan per definitie niet bij `kluisAuth`. Een besluit
   dat zegt "deze volwassene mag meetekenen voor dit kind" hoort achter de
   kantoordeur, dus hoort de route daar waar die deur woont.

   OP NAAM, NIET OP DE GEDEELDE CODE. `wieKijkt(req)` geeft alleen een naam als
   er een lid-account achter het kantoortoken hangt; met de gedeelde OFFICE_CODE
   blijft hij leeg en weigert de kern (jeugd-acties.js). Dat is dezelfde grens
   die scripts/toelatingsproef.js blootlegde bij het aftekenen van een
   vergunning: een spoor dat eindigt bij een gedeelde code is geen spoor.
   KANTOORMACHT.md noemt dat een alibi. */
module.exports = (octx, gedeeld) => {
  const { kern } = octx;
  const { app, kluisAuth, vertegenwoordiging } = kern;
  const { wieKijkt } = gedeeld;

  app.post('/api/office/voogdij/besluit', kluisAuth, async (req, res) => {
    const b = req.body || {};
    const r = await vertegenwoordiging.voogdBesluit(
      wieKijkt(req), String(b.client || ''), !!b.akkoord, b.reden);
    if (r && r.error) return res.status(r.status || 400).json({ error: r.error });
    res.json(r);
  });
};
