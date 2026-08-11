/* RTG Werk OS (deellaag): de LIJST van besluiten en wat er op het startscherm
   van komt.

   Staat los van ./besluit.js omdat dat bestand over de 10 kB van keuringsregel
   13 ging. De naad is echt en niet gekunsteld: daar wordt besloten (voorstel,
   advies, stemming, sluiten), hier wordt geteld.

   DE SCHERPSTE TELLER IS `zonderUitkomst`: een aangenomen besluit waarvan de
   evaluatiedatum is verstreken terwijl er niets is opgeschreven. Dat is precies
   het geval waarin een besluit "geevalueerd" heet zonder dat iemand heeft
   teruggekeken, en het staat apart van `teEvalueren` -- die telt ook wat vandaag
   pas aan de beurt is. Het verschil tussen "nog doen" en "blijven liggen" is de
   hele reden dat die twee niet een getal zijn.

   En `zonderKoppeling` telt de besluiten die volgens de administratie nergens
   over gaan. Voor alles van voor het besluitgeheugen is dat geen fout maar een
   gat; het staat hier zodat iemand die erbij WAS het alsnog kan leggen. */
'use strict';

module.exports = (sctx) => {
  const { app, dag, werkPoort } = sctx;
  const B = (w) => sctx.BESLUITEN(w);
  const telling = (b) => ({
    voor: b.stemmen.filter(s => s.stem === 'voor').length,
    tegen: b.stemmen.filter(s => s.stem === 'tegen').length,
    onthouding: b.stemmen.filter(s => s.stem === 'onthouding').length
  });

  app.post('/api/bedrijf/besluiten', (req, res) => {
    const g = werkPoort(req, res, 'besluit'); if (!g) return;
    const rijen = Object.values(B(g.w))
      .filter(b => !req.body.status || b.status === String(req.body.status))
      .map(b => ({ id: b.id, titel: b.titel, soort: b.soort, status: b.status, eigenaar: b.eigenaar,
        telling: telling(b), bezwaren: b.bezwaren.length, evalueerOp: b.evalueerOp,
        evaluatieTeGaan: b.evalueerOp ? Math.round((Date.parse(b.evalueerOp) - Date.parse(dag())) / 86400000) : null }));
    res.json({ ok: true, aantal: rijen.length, besluiten: rijen,
      teEvalueren: rijen.filter(b => b.evaluatieTeGaan != null && b.evaluatieTeGaan <= 0) });
  });

  sctx.startBron('goedkeuringen', 'besluit', (g) => {
    const alle = Object.values(B(g.w));
    /* `zonderUitkomst` is de scherpe van de drie: een evaluatiedatum die is
       verstreken terwijl er niets is opgeschreven, is precies het geval waarin
       een besluit "geëvalueerd" heet zonder dat iemand heeft teruggekeken. Hij
       staat apart van `teEvalueren` (die telt ook wat vandaag aan de beurt is)
       zodat het verschil tussen "nog doen" en "blijven liggen" zichtbaar is. */
    return { inAdvies: alle.filter(b => b.status === 'advies').length,
      teStemmen: alle.filter(b => b.status === 'stemmen' && !b.stemmen.some(s => s.lidId === g.l.id)).length,
      teEvalueren: alle.filter(b => b.evalueerOp && b.evalueerOp <= dag()).length,
      zonderUitkomst: alle.filter(b => b.status === 'aangenomen' && b.evalueerOp && b.evalueerOp <= dag()
        && !(b.evaluaties || []).length).length,
      /* Besluiten die nergens over gaan -- geen enkel object eraan gekoppeld.
         Voor besluiten van voor het geheugen bestond is dat geen fout maar een
         gat, en het staat hier zodat iemand die erbij WAS het alsnog kan leggen.
         Er wordt niets geraden: een koppeling is een uitspraak van een mens. */
      zonderKoppeling: alle.filter(b => !(Array.isArray(b.raakt) ? b.raakt : []).some(k => !k.terug)).length };
  });
};
