/* De kaart lezen heeft geen rekeningmutatie, correctie of opslag nodig. */
module.exports = (ctx) => {
  const { app, supplierAuth, kaartPerGroep } = ctx;
  /* ---------- DE KAART VAN DE ZAAK, voor de bediening ----------

     Dezelfde kaart die de gast op zijn telefoon ziet (kern/horeca/kaart.js) en
     met opzet geen tweede opbouw. Een tweede kaart is een tweede antwoord op
     "wat kost een biertje" en op "staat dit gerecht uitverkocht" -- en dan wijst
     de gast op zijn scherm terwijl de bediening iets anders ziet (LAT-regel 4).

     WEL EEN VERSCHIL, EN DAT IS GEEN INCONSEQUENTIE: uitverkochte gerechten
     blijven hier STAAN, met hun vlag. De gast hoort ze niet te kunnen kiezen;
     de bediening hoort te kunnen zien dat ze op zijn, en mag na overleg met de
     keuken alsnog iets aanslaan. Wegfilteren zou van "op" een geheim maken. */
  app.post('/api/supplier/horeca/kaart', supplierAuth, (req, res) => {
    const groepen = kaartPerGroep(req.supplier.code).map(g => ({ cat: g.cat,
      items: g.items.map(i => ({ id: i.id, naam: i.naam, centen: i.centen, station: i.station,
        alcohol: i.alcohol, uitverkocht: i.uitverkocht, allergenen: i.allergenen })) }));
    res.json({ ok: true, aantal: groepen.reduce((n, g) => n + g.items.length, 0), groepen,
      let: 'Uitverkochte gerechten staan er met hun vlag bij: de gast kan ze niet kiezen, de bediening ziet ze wel.' });
  });

};
