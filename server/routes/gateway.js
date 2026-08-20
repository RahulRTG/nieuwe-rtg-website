/* Routes van de AANGIFTEGATEWAY -- klaargezet, niet aangezet.

   TWEE KANTEN, en de scheiding daartussen is het punt van dit bestand.

   DE ZAAK VERLEENT HET MANDAAT. Niet het kantoor, en niet RTG. Dat lijkt
   vanzelfsprekend tot je bedenkt dat het kantoor alle knoppen heeft: als het
   kantoor zijn eigen mandaat kan aanmaken, is het register een formaliteit. De
   naam van de gever komt daarom uit het TOKEN van de manager en nooit uit het
   verzoek -- anders is "verleend door R. Sardjoe" een tekstveld.

   HET KANTOOR LEEST EN CONTROLEERT. Het ziet welke zendingen er klaarstaan en
   kan de keten narekenen; het kan er geen mandaat bij verzinnen.

   EN ER IS GEEN ROUTE OM IETS AAN TE BIEDEN. Dat is geen vergetelheid: er kan
   vandaag niets weg (kern/fiscaal/zekerheid.js zet `verzenden` op
   `voorbehouden`, en de kern kijkt daar als eerste naar). Een knop die altijd
   afketst is een knop die niet had moeten staan. Wie de gateway ooit aansluit,
   voegt die route toe bij hetzelfde besluit dat de grens verzet. */
module.exports = (kern) => {
  const { app, supplierAuth, officeAuth, mandaat, gateway, schoon } = kern;
  if (!mandaat || !gateway) return;

  const stuur = (res, r) => (r && r.error) ? res.status(r.status || 400).json(r) : res.json(r);
  const managerOf = (req, res) => {
    if (!req.actor || !req.actor.manager) { res.status(403).json({ error: 'Alleen voor management.' }); return null; }
    return req.actor.name || null;
  };

  /* ---- de zaak: mandaat verlenen, teruglezen, intrekken ---- */
  app.post('/api/supplier/gateway/mandaat', supplierAuth, (req, res) => {
    const naam = managerOf(req, res); if (naam === null) return;
    if (!naam) return res.status(403).json({ error: 'Een mandaat wordt op naam verleend; deze sessie draagt er geen.' });
    const b = req.body || {};
    stuur(res, mandaat.verleen({ code: req.supplier.code, soort: schoon(b.soort, 20),
      van: schoon(b.van, 10), tot: schoon(b.tot, 10) || null,
      doorNaam: naam, doorRol: schoon(b.rol, 60), kenmerk: schoon(b.kenmerk, 60) }));
  });

  app.post('/api/supplier/gateway/mandaten', supplierAuth, (req, res) => {
    const naam = managerOf(req, res); if (naam === null) return;
    res.json({ ok: true, mandaten: mandaat.vanZaak(req.supplier.code), soorten: mandaat.SOORTEN });
  });

  app.post('/api/supplier/gateway/mandaat/intrek', supplierAuth, (req, res) => {
    const naam = managerOf(req, res); if (naam === null) return;
    const b = req.body || {};
    /* De eigen zaak, uit het token: zonder deze regel trekt een manager het
       mandaat van de buurman in. */
    const m = mandaat.vanZaak(req.supplier.code).find(x => x.id === String(b.id || ''));
    if (!m) return res.status(404).json({ error: 'Dit mandaat kennen we niet.' });
    stuur(res, mandaat.trekIn(m.id, naam || 'manager', schoon(b.reden, 300)));
  });

  /* ---- de zaak: wat staat er van mij klaar ---- */
  app.post('/api/supplier/gateway/zendingen', supplierAuth, (req, res) => {
    const naam = managerOf(req, res); if (naam === null) return;
    res.json({ ok: true, zendingen: gateway.vanZaak(req.supplier.code).map(z => ({
      id: z.id, soort: z.soort, periode: z.periode, status: z.status, kanaal: z.kanaalNaam,
      zegel: z.zegel, verzegeldOp: z.verzegeldOp, kenmerk: z.kenmerk, pogingen: z.pogingen })) });
  });

  /* ---- het kantoor: lezen en de keten narekenen ---- */
  app.post('/api/office/gateway/zendingen', officeAuth, (req, res) => {
    const code = schoon((req.body || {}).code, 40);
    res.json({ ok: true, zendingen: (code ? gateway.vanZaak(code) : []).map(z => ({
      id: z.id, code: z.code, soort: z.soort, periode: z.periode, status: z.status,
      zegel: z.zegel, mandaat: z.mandaat, pogingen: z.pogingen })) });
  });

  /* Narekenen, en niet "de vlag lezen": een zegel die niemand ooit natelt,
     bewijst niets. */
  app.post('/api/office/gateway/controleer', officeAuth, (req, res) =>
    stuur(res, gateway.controleer(schoon((req.body || {}).id, 40))));
};
