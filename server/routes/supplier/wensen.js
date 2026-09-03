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

  /* KIJKEN ZONDER SCHEPPEN, naast bak() en niet in plaats daarvan. bak() zet de
     wensenlijst van een zaak neer zodra iemand ernaar vraagt -- ook als die
     vraag daarna op een 404 eindigt, en dan laat een geweigerd verzoek een lege
     lijst achter die er niet was. Bestaat de lijst wel, dan geeft kijk() hem
     ECHT terug: de wens die hieronder wordt omgezet landt gewoon in de opslag.
     Bestaat hij niet, dan is hij hier leeg en loopt het afvinken dood op een
     nette 404. */
  const kijk = code => {
    const alle = (db.data.bedrijfsWensen && typeof db.data.bedrijfsWensen === 'object') ? db.data.bedrijfsWensen : {};
    return Array.isArray(alle[code]) ? alle[code] : [];
  };

  app.post('/api/supplier/wensen', supplierAuth, (req, res) => {
    res.json({ ok: true, wensen: bak(req.supplier.code).slice(0, 20) });
  });

  app.post('/api/supplier/wensen/klaar', supplierAuth, (req, res) => {
    const lijst = kijk(req.supplier.code);
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
