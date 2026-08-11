/* Horeca OS (deellaag): de gastrekening van het hotel (folio) -- alles wat een
   gast tijdens zijn verblijf uitgeeft op EEN rekening, en aan het eind een keer
   afrekenen.

   Het verblijf zelf bestaat al (routes/supplier/verblijf.js: check-in,
   check-out, no-show; kamerplanning en housekeeping elders). Wat er niet was,
   is de rekening eronder: het ontbijt, de minibar, de spa, de roomservice en
   het restaurantbezoek komen nu op dezelfde folio terecht als de kamer.

   Vier dingen die hier bewust zo zijn:

   1. OP DE KAMER BOEKEN KAN ALLEEN ALS ER EEN FOLIO IS. De betaalwijze "kamer"
      in horeca/betalen.js loopt via deze laag; is er geen open folio op dat
      kamernummer, dan gaat de boeking niet door. Anders verdwijnt een rekening
      in een kamer die leegstaat, en dat merkt niemand tot de dagafsluiting.
   2. DE NACHTRUN IS IDEMPOTENT OP DE DATUM. Twee keer draaien boekt niet twee
      kamernachten -- dezelfde regel als de renterun van RTG Bank. Een
      nachtadministratie die je niet twee keer mag draaien, gaat een keer per
      jaar mis en dan mist er een nacht.
   3. TOERISTENBELASTING IS EEN EIGEN REGEL. Niet verstopt in de kamerprijs,
      want de gast hoort te zien wat hij aan wie betaalt -- en de boekhouding
      moet hem apart kunnen afdragen.
   4. DE BORG IS EEN AANTEKENING, GEEN BLOKKADE. Er wordt niets vastgezet bij
      de bank van de gast; dat kan alleen een betaaldienst. Wat hier staat is
      wat er is AFGESPROKEN, met `geblokkeerdBijBank: false` erbij -- doen alsof
      er geld vaststaat, is precies het soort belofte dat later niet waar is. */
module.exports = (kern) => {
  const { app, save, schoon, supplierAuth, logActivity, horeca } = kern;
  const { H, nu, id, centen, uitEuro } = horeca;

  /* De leeskant EN het boeken staan in kern/horeca/foliolaag.js. Niet uit
     netheid: de gastkant heeft dezelfde vraag en dezelfde boeking nodig voor
     roomservice, en `kern` is hier de ctx-KOPIE die supplier/horeca.js met
     Object.assign maakt -- wat we hier op de kern zetten, ziet een ander domein
     nooit. Openen, de nachtrun, de borg en het afrekenen blijven hieronder: dat
     zijn besluiten van de zaak. */
  const { SOORTEN, F, som, betaald, openVan, publiek, folioVan, boek } =
    require('../../../kern/horeca/foliolaag')({ horeca, save, schoon });
  kern.horecaFolioBoek = boek;

  /* ---------- openen en boeken ---------- */
  app.post('/api/supplier/horeca/folio/open', supplierAuth, (req, res) => {
    const kamer = schoon(req.body.kamer, 20);
    if (!kamer) return res.status(400).json({ error: 'Welk kamernummer?' });
    if (folioVan(req.supplier.code, kamer)) return res.status(409).json({ error: 'Op kamer ' + kamer + ' staat al een open gastrekening.' });
    const f = { id: id(5), kamer, gastnaam: schoon(req.body.gastnaam, 60) || null,
      gasten: Math.max(1, Math.min(20, parseInt(req.body.gasten, 10) || 1)),
      van: schoon(req.body.van, 10) || nu().slice(0, 10), tot: schoon(req.body.tot, 10) || null,
      nachtprijsCenten: req.body.nachtprijs != null ? uitEuro(req.body.nachtprijs) : centen(req.body.nachtprijsCenten),
      toeristenbelastingCenten: req.body.toeristenbelasting != null ? uitEuro(req.body.toeristenbelasting) : centen(req.body.toeristenbelastingCenten),
      status: 'open', regels: [], betalingen: [], nachten: [], borg: null,
      at: nu(), door: req.actor.name };
    F(req.supplier.code)[f.id] = f;
    save();
    logActivity(req.supplier.code, req.actor, 'opende de gastrekening van kamer ' + kamer);
    res.json({ ok: true, folio: publiek(f) });
  });

  app.post('/api/supplier/horeca/folio/boek', supplierAuth, (req, res) => {
    const uit = boek(req.supplier.code, schoon(req.body.kamer, 20), {
      soort: req.body.soort, omschrijving: req.body.omschrijving,
      centen: req.body.bedrag != null ? uitEuro(req.body.bedrag) : centen(req.body.centen),
      door: req.actor.name, bron: schoon(req.body.bron, 40) || null });
    if (uit.error) return res.status(uit.status || 400).json({ error: uit.error });
    res.json(Object.assign({ ok: true }, uit, { soorten: SOORTEN }));
  });

  /* ---------- de nachtrun ----------
     Kamerprijs en toeristenbelasting voor een datum, hooguit een keer. */
  app.post('/api/supplier/horeca/folio/nacht', supplierAuth, (req, res) => {
    const datum = schoon(req.body.datum, 10) || nu().slice(0, 10);
    const folios = Object.values(F(req.supplier.code)).filter(f => f.status === 'open');
    let geboekt = 0, overgeslagen = 0, centenTotaal = 0;
    for (const f of folios) {
      if (f.nachten.includes(datum)) { overgeslagen++; continue; }
      if (f.van > datum) { overgeslagen++; continue; }
      if (!f.nachtprijsCenten) { overgeslagen++; continue; }
      f.regels.push({ id: id(3), soort: 'kamer', omschrijving: 'Overnachting ' + datum,
        centen: f.nachtprijsCenten, at: nu(), door: 'nachtrun' });
      centenTotaal += f.nachtprijsCenten;
      if (f.toeristenbelastingCenten) {
        const bel = f.toeristenbelastingCenten * f.gasten;
        f.regels.push({ id: id(3), soort: 'toeristenbelasting',
          omschrijving: 'Toeristenbelasting ' + datum + ' (' + f.gasten + ' gast(en))', centen: bel, at: nu(), door: 'nachtrun' });
        centenTotaal += bel;
      }
      f.nachten.push(datum);
      geboekt++;
    }
    save();
    logActivity(req.supplier.code, req.actor, 'draaide de nachtrun van ' + datum + ' (' + geboekt + ' kamer(s))');
    res.json({ ok: true, datum, geboekt, overgeslagen, centen: centenTotaal,
      let: 'De nachtrun is idempotent op de datum: twee keer draaien boekt niet twee nachten.' });
  });

  /* ---------- borg ---------- */
  app.post('/api/supplier/horeca/folio/borg', supplierAuth, (req, res) => {
    const f = folioVan(req.supplier.code, schoon(req.body.kamer, 20));
    if (!f) return res.status(404).json({ error: 'Er staat geen open gastrekening op die kamer.' });
    if (req.body.terug === true) {
      if (!f.borg) return res.status(409).json({ error: 'Er is geen borg genoteerd.' });
      f.borg.terugAt = nu(); f.borg.terugDoor = req.actor.name;
      f.borg.ingehouden = req.body.ingehouden != null ? uitEuro(req.body.ingehouden) : 0;
      f.borg.reden = schoon(req.body.reden, 160) || null;
      if (f.borg.ingehouden && !f.borg.reden) return res.status(400).json({ error: 'Noteer waarom er borg wordt ingehouden.' });
      if (f.borg.ingehouden) f.regels.push({ id: id(3), soort: 'schade', omschrijving: 'Ingehouden borg: ' + f.borg.reden,
        centen: f.borg.ingehouden, at: nu(), door: req.actor.name });
      save();
      return res.json({ ok: true, borg: f.borg, folio: publiek(f) });
    }
    const bedrag = req.body.bedrag != null ? uitEuro(req.body.bedrag) : centen(req.body.centen);
    if (!bedrag) return res.status(400).json({ error: 'Welk borgbedrag is afgesproken?' });
    f.borg = { centen: bedrag, at: nu(), door: req.actor.name, geblokkeerdBijBank: false };
    save();
    res.json({ ok: true, borg: f.borg,
      let: 'Dit is een aantekening van de afspraak. Er wordt niets vastgezet bij de bank van de gast; dat kan alleen de betaaldienst.' });
  });

  /* ---------- afrekenen ---------- */
  app.post('/api/supplier/horeca/folio/afrekenen', supplierAuth, (req, res) => {
    const f = folioVan(req.supplier.code, schoon(req.body.kamer, 20));
    if (!f) return res.status(404).json({ error: 'Er staat geen open gastrekening op die kamer.' });
    const open = openVan(f);
    if (open > 0) {
      const bedrag = req.body.bedrag != null ? uitEuro(req.body.bedrag) : (req.body.centen != null ? centen(req.body.centen) : open);
      if (bedrag > open) return res.status(400).json({ error: 'Dat is meer dan er openstaat (' + (open / 100).toFixed(2) + ').' });
      f.betalingen.push({ id: id(3), wijze: schoon(req.body.wijze, 20) || 'pin', centen: bedrag, at: nu(), door: req.actor.name });
    }
    const rest = openVan(f);
    if (rest <= 0) { f.status = 'afgerekend'; f.geslotenAt = nu(); }
    save();
    res.json({ ok: true, openstaand: rest, gesloten: f.status === 'afgerekend', folio: publiek(f),
      perSoort: (f.regels || []).reduce((o, r) => Object.assign(o, { [r.soort]: (o[r.soort] || 0) + r.centen }), {}) });
  });

  app.post('/api/supplier/horeca/folio', supplierAuth, (req, res) => {
    const kamer = schoon(req.body.kamer, 20);
    if (kamer) {
      const f = folioVan(req.supplier.code, kamer);
      if (!f) return res.status(404).json({ error: 'Er staat geen open gastrekening op kamer ' + kamer + '.' });
      return res.json({ ok: true, folio: publiek(f), soorten: SOORTEN });
    }
    const alle = Object.values(F(req.supplier.code)).filter(f => f.status === 'open')
      .map(f => ({ id: f.id, kamer: f.kamer, gastnaam: f.gastnaam, van: f.van, tot: f.tot,
        totaal: som(f), openstaand: openVan(f), nachten: f.nachten.length }));
    res.json({ ok: true, aantal: alle.length, folios: alle, openTotaal: alle.reduce((t, f) => t + f.openstaand, 0) });
  });
};
