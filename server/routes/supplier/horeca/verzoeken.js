/* Horeca OS (deellaag): de verzoeken van gasten, aan de kant van de zaak.

   De tegenhanger van routes/gast/verzoek.js. Wat een gast vraagt komt hier
   binnen, en de enige belofte die deze laag doet is dat het ZICHTBAAR is en
   BLIJFT staan tot een mens het sluit.

   TWEE DINGEN DIE DIT SCHERM ANDERS MAKEN DAN EEN MELDINGENLIJST:

   1. OUD STAAT BOVENAAN, NIET TAFEL 1. De wachtrij is gesorteerd op wat het
      langst wacht en niet op zaalvolgorde. Een lijst op tafelnummer laat de
      tafel die twaalf minuten wacht onderaan staan als hij toevallig hoog
      genummerd is, en dat is precies de tafel waar het misgaat.
   2. ER STAAT EEN GETAL EN GEEN KLEUR. Elk verzoek draagt hoeveel minuten het
      open staat; `oud` volgt uit dat getal en uit de soort (een servetje mag
      wachten, "er is iets niet goed" niet). Wie het rood niet ziet, leest het
      getal -- dezelfde regel als op het keukenscherm. */
module.exports = (kern) => {
  const { app, supplierAuth, sseToSupplier, verzoeklaag } = kern;

  app.post('/api/supplier/horeca/verzoeken', supplierAuth, (req, res) => {
    res.json(Object.assign({ ok: true }, verzoeklaag.wachtrij(req.supplier.code)));
  });

  /* Oppakken en afronden. Bewust twee stappen en niet één knop "klaar": tussen
     "ik ga erheen" en "het is gedaan" zit de tijd waarin een collega niet ook
     moet gaan. Zonder die tussenstand lopen er op een drukke avond twee mensen
     naar dezelfde tafel, of geen. */
  app.post('/api/supplier/horeca/verzoeken/zet', supplierAuth, (req, res) => {
    const b = req.body || {};
    const r = verzoeklaag.zet(req.supplier.code, b.verzoek, b.stand, req.actor && req.actor.name);
    if (r.error) return res.status(r.status || 400).json({ error: r.error });
    /* De andere schermen in de zaak moeten het meteen zien; anders pakt de
       collega naast je hetzelfde verzoek op omdat zijn lijst van een minuut
       geleden is. */
    if (sseToSupplier) sseToSupplier(req.supplier.code, 'sync', { scope: 'verzoeken' });
    res.json(r);
  });
};
