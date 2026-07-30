/* Domein "supplier" (deelmodule): bezorg-keten -- de sluitende keten rond een
   thuisbezorging:
   1) de INPAKKER vinkt af dat alles in de JUISTE TAS zit, op het JUISTE
      BONNUMMER (de server eist de volledige artikellijst plus het bonnummer);
   2) de BEZORGER vinkt af dat hij alles gepakt heeft (pakcheck);
   3) pas dan mag de rit vertrekken (de poort zit in bezorg.js);
   4) de beste route over meerdere adressen, met voertuigkeuze;
   5) terugmelden op de zaak (de PDA zet de GPS dan vanzelf uit). */
module.exports = (kern) => {
  const { app, db, haversine, logActivity, orderMetRef, ordersVanZaak, save, schoon,
    sseToSupplier, supplierAuth } = kern;

  // stadstempo per voertuig in km/u; lopen is de ondergrens
  const VOERTUIGEN = { auto: 28, motor: 32, scooter: 25, fatbike: 20, lopen: 5 };

  const vanZaak = (req, ref) => {
    const o = orderMetRef(String(ref || ''));
    return o && o.supplierCode === req.supplier.code && o.levering ? o : null;
  };

  /* De inpakker: alles zit erin, in deze tas, op dit bonnummer. De server
     controleert dat ELKE regel is afgevinkt en dat het getypte bonnummer
     klopt -- zo kan een tas nooit stilletjes half de deur uit. */
  app.post('/api/supplier/bezorg/inpak', supplierAuth, (req, res) => {
    const o = vanZaak(req, req.body.ref);
    if (!o) return res.status(404).json({ error: 'Levering niet gevonden.' });
    if (['onderweg', 'bezorgd', 'opgehaald', 'geweigerd', 'terugbetaald'].includes(o.status))
      return res.status(409).json({ error: 'Deze levering is al onderweg of klaar.' });
    if (String(req.body.bon || '').trim().toUpperCase() !== o.ref)
      return res.status(400).json({ error: 'Het bonnummer klopt niet met deze levering. Pak de juiste bon erbij.' });
    const tas = schoon(req.body.tas, 40);
    if (!tas) return res.status(400).json({ error: 'Zet erbij in welke tas alles zit.' });
    const gevinkt = new Set((Array.isArray(req.body.items) ? req.body.items : []).map(String));
    const mis = (o.items || []).filter(i => !gevinkt.has(String(i.id)));
    if (mis.length) return res.status(400).json({ error: 'Nog niet alles is afgevinkt: ' + mis.map(i => i.name).join(', ') + '.' });
    o.inpak = { door: req.actor.name, staffId: req.actor.staffId || null, tas, at: new Date().toISOString() };
    save();
    logActivity(req.supplier.code, req.actor, 'pakte ' + o.ref + ' in (tas ' + tas + ', alles afgevinkt)');
    sseToSupplier(req.supplier.code, 'sync', { scope: 'bezorg' });
    res.json({ ok: true, inpak: o.inpak });
  });

  /* De bezorger: "ik heb alles gepakt" -- per rit (meerdere refs tegelijk),
     alleen op ingepakte leveringen die op zijn eigen naam staan. */
  app.post('/api/supplier/bezorg/pakcheck', supplierAuth, (req, res) => {
    const refs = (Array.isArray(req.body.refs) ? req.body.refs : [req.body.ref]).filter(Boolean).slice(0, 8);
    const gedaan = [];
    for (const ref of refs) {
      const o = vanZaak(req, ref);
      if (!o || !o.inpak || o.status === 'onderweg') continue;
      if (!o.bezorger || (req.actor.staffId && o.bezorger.staffId !== req.actor.staffId && !req.actor.manager)) continue;
      o.pakcheck = { door: req.actor.name, staffId: req.actor.staffId || null, at: new Date().toISOString() };
      gedaan.push(o.ref);
    }
    if (!gedaan.length) return res.status(409).json({ error: 'Niets om af te vinken: eerst inpakken (en de rit op uw naam).' });
    save();
    logActivity(req.supplier.code, req.actor, 'vinkte af dat alles gepakt is (' + gedaan.join(', ') + ')');
    sseToSupplier(req.supplier.code, 'sync', { scope: 'bezorg' });
    res.json({ ok: true, refs: gedaan });
  });

  /* De beste route: vanaf de zaak langs alle adressen (dichtstbijzijnde
     eerst, telkens vanaf de vorige stop), met de reistijd per voertuig.
     De PDA opent hiermee vanzelf de navigatie naar de eerstvolgende stop. */
  app.post('/api/supplier/bezorg/route', supplierAuth, (req, res) => {
    const voertuig = VOERTUIGEN[req.body.voertuig] ? String(req.body.voertuig) : 'auto';
    const refs = (Array.isArray(req.body.refs) ? req.body.refs : []).filter(Boolean).slice(0, 8);
    const rest = refs.map(r => vanZaak(req, r)).filter(o => o && o.geo && Number.isFinite(o.geo.lat));
    if (!rest.length) return res.status(400).json({ error: 'Geen leveringen met een adres op de kaart.' });
    const kmU = VOERTUIGEN[voertuig];
    let hier = (req.supplier.loc && Number.isFinite(req.supplier.loc.lat)) ? req.supplier.loc : rest[0].geo;
    const stops = [];
    let totaalM = 0;
    while (rest.length) {
      let bi = 0, bm = Infinity;
      for (let i = 0; i < rest.length; i++) {
        const m = haversine(hier, rest[i].geo);
        if (m < bm) { bm = m; bi = i; }
      }
      const o = rest.splice(bi, 1)[0];
      totaalM += bm;
      o.voertuig = voertuig;
      stops.push({ ref: o.ref, adres: o.adres, meters: Math.round(bm),
        minuten: Math.max(1, Math.round((bm / 1000) / kmU * 60)),
        nav: 'geo:' + o.geo.lat + ',' + o.geo.lng + '?q=' + o.geo.lat + ',' + o.geo.lng });
      hier = o.geo;
    }
    save();
    res.json({ ok: true, voertuig, kmU, stops,
      totaal: { meters: Math.round(totaalM), minuten: Math.max(1, Math.round((totaalM / 1000) / kmU * 60)) } });
  });

  /* Terug op de zaak: de rit is klaar, de positie van de bezorger gaat weg.
     De PDA roept dit zelf aan zodra de GPS ziet dat hij weer bij de zaak is
     (en zet daarna de GPS uit). */
  app.post('/api/supplier/bezorg/terug', supplierAuth, (req, res) => {
    const nogOnderweg = ordersVanZaak(req.supplier.code).some(o => o.status === 'onderweg' &&
      o.bezorger && o.bezorger.staffId === (req.actor.staffId || null));
    if (nogOnderweg) return res.status(409).json({ error: 'Er is nog een levering onderweg; eerst afronden.' });
    const B = db.data.bezorgers = db.data.bezorgers || {};
    delete B[req.supplier.code + ':' + (req.actor.staffId || 'beheer')];
    logActivity(req.supplier.code, req.actor, 'is terug op de zaak (GPS uit)');
    sseToSupplier(req.supplier.code, 'sync', { scope: 'bezorg' });
    res.json({ ok: true });
  });

};
