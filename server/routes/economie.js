/* RTG ECONOMIC CONTROL PLANE -- de endpoints van de werelden en de firewall.

   Alles achter boardroomAuth, en dat is geen voorzichtigheid maar de kern van
   de zaak. Een economische relatie openen betekent dat de ene rechtspersoon de
   andere iets in rekening mag brengen; dat is een bestuursbesluit en geen
   instelling. Wie hem mag zetten, mag ook de rekening van een stichting laten
   ontstaan.

   ER IS MET OPZET GEEN ROUTE OM EEN WERELD TE VERANDEREN. De wereld van een
   gebruiker volgt uit wat hij is (kern/economie/werelden.js): een lid hoort bij
   de consumenteneconomie, een gezin bij de RTFoundation. Een knop waarmee je
   een gebruiker in een andere economie zet, is een knop waarmee je de firewall
   omzeilt zonder hem aan te raken.

   EN ER IS GEEN ROUTE DIE EEN DOORBELASTING FORCEERT. Wie iets wil doorbelasten
   dat nu geweigerd wordt, legt de relatie vast met een grondslag en een
   plafond; daarna gaat het langs dezelfde poort als al het andere. Een
   noodknop naast een firewall is de deur waar iedereen op mikt. */
module.exports = (kern) => {
  const { app, boardroomAuth, boardroomWie, economie, kosten } = kern;

  app.post('/api/office/economie/werelden', boardroomAuth, (req, res) => {
    const p = String((req.body || {}).periode || '').trim();
    const periode = /^\d{4}-\d{2}$/.test(p) ? p : kosten.periodeVan();
    const verbruik = kosten.verbruikPerWereld(periode);
    res.json({ ok: true, periode,
      werelden: economie.werelden().map(w => Object.assign({}, w, {
        gemetenGewicht: (verbruik[w.id] || {}).gewicht || 0,
        gebruikers: ((verbruik[w.id] || {}).dragers || []).length
      })),
      relaties: economie.relaties(),
      /* De verdeling van de nota's over de werelden staat in hetzelfde antwoord
         als de werelden zelf. Twee endpoints zouden twee schermen opleveren die
         op een dag iets anders zeggen over dezelfde maand. */
      wereldposten: kosten.verdeling(periode).wereldposten });
  });

  app.post('/api/office/economie/relatie/zet', boardroomAuth, (req, res) => {
    const b = req.body || {};
    const r = economie.relatieZet({ van: b.van, naar: b.naar, grondslag: b.grondslag,
      plafondCenten: b.plafondCenten, tot: b.tot, door: boardroomWie(req) });
    res.status(r.status || 200).json(r);
  });

  app.post('/api/office/economie/relatie/weg', boardroomAuth, (req, res) => {
    const b = req.body || {};
    const r = economie.relatieWeg({ van: b.van, naar: b.naar, reden: b.reden, door: boardroomWie(req) });
    res.status(r.status || 200).json(r);
  });

  /* Het journaal van de relaties: geopend, gewijzigd, gesloten. Groeit aan en
     wordt nooit herschreven -- er zijn facturen op gebaseerd, en een verdwenen
     grondslag maakt die onverklaarbaar. */
  app.post('/api/office/economie/journaal', boardroomAuth, (req, res) => {
    res.json({ ok: true, journaal: economie.relatiejournaal() });
  });

  /* De firewall bevragen zonder iets te boeken: mag deze wereld die wereld iets
     in rekening brengen, en zo nee, waarom niet. Bestaat omdat een weigering
     die je pas ziet op het moment dat een factuurronde stilvalt, te laat komt. */
  app.post('/api/office/economie/proef', boardroomAuth, (req, res) => {
    const b = req.body || {};
    res.json({ ok: true, uitslag: economie.magBelasten({ van: b.van, naar: b.naar,
      centen: b.centen == null ? null : Number(b.centen) }) });
  });
};
