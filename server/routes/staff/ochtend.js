/* Staff (deelmodule): DE OCHTENDKAART (PERSONEEL.md par. 4, kern/ochtendkaart.js).

   Een lezing voor de eigen persoonlijke login, en niets anders: een kaart van
   een ander bestaat niet, en een zaak-inlog zonder persoon heeft er geen. De
   kaart mag ontbreken (een kaal testproces monteert de werkdaglaag niet); dan
   zegt de route dat hij er niet is in plaats van een lege kaart te tonen. */
module.exports = (actx) => {
  const { app, supplierAuth, ochtendkaart } = actx;

  app.post('/api/staff/ochtend', supplierAuth, (req, res) => {
    if (!req.actor.staffId) return res.status(403).json({ error: 'Alleen met een persoonlijke login.' });
    if (typeof ochtendkaart !== 'function') return res.status(503).json({ error: 'De ochtendkaart is niet gemonteerd.' });
    res.json({ ok: true, kaart: ochtendkaart(req.supplier.code, req.actor.staffId) });
  });
};
