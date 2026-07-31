/* Supplier-submodule "wensen": de behoeften die de ondernemer bij de
   AI-intake opgaf, als open wensenlijst bij de eigen zaak. De eigenaar
   ziet waar hij om vroeg en vinkt af wat geregeld is; zo begint elke
   nieuwe zaak met een concreet startlijstje in plaats van een leeg scherm. */
module.exports = (kern) => {
  const { app, db, save, supplierAuth } = kern;

  const bak = code => {
    if (!db.data.bedrijfsWensen) db.data.bedrijfsWensen = {};
    if (!Array.isArray(db.data.bedrijfsWensen[code])) db.data.bedrijfsWensen[code] = [];
    return db.data.bedrijfsWensen[code];
  };

  app.post('/api/supplier/wensen', supplierAuth, (req, res) => {
    res.json({ ok: true, wensen: bak(req.supplier.code).slice(0, 20) });
  });

  app.post('/api/supplier/wensen/klaar', supplierAuth, (req, res) => {
    const lijst = bak(req.supplier.code);
    /* Een index, en niets anders. Number(null) is 0 en JSON maakt van een
       ontbrekend veld precies null -- dus een aanroep ZONDER index vinkte
       stilzwijgend de eerste wens van de lijst af. Zelfde familie als de
       coordinaten van keuringsregel 24 en de foto-index van photo/remove:
       JavaScript geeft een bruikbaar antwoord op iets wat geen invoer is. */
    const i = typeof req.body.index === 'number' ? req.body.index : NaN;
    const w = Number.isInteger(i) && i >= 0 ? lijst[i] : null;
    if (!w) return res.status(404).json({ error: 'Deze wens staat niet op de lijst.' });
    w.status = w.status === 'klaar' ? 'open' : 'klaar';
    save();
    res.json({ ok: true, wensen: lijst.slice(0, 20) });
  });
};
