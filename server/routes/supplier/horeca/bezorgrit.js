/* Horeca OS (deellaag): de rit zelf -- de gecombineerde route en het
   afleverbewijs. Hoort bij horeca/bezorging.js (zones en tijdsloten).

   Twee eerlijkheden zitten hier in het antwoord zelf:

   - DE ROUTE IS EEN HEURISTIEK. Dichtstbijzijnde-eerst vanaf de zaak; dat is
     geen optimale route en het antwoord doet ook niet alsof
     (`heuristiek: 'dichtstbijzijnde eerst'`). Een echte planner weegt verkeer
     en tijdvensters mee, en die hebben we hier niet.
   - HET AFLEVERBEWIJS BEWAART GEEN FOTO VAN EEN MENS of van een deur. Het legt
     vast wat nodig is om later een geschil te beslechten: het tijdstip, hoe er
     is afgeleverd, wie er tekende, en of de leeftijdscontrole is gedaan. Bij
     een rit die om die controle vraagt, kan er zonder die controle niet worden
     afgetekend -- anders is het vinkje een formaliteit. */
module.exports = (kern) => {
  const { app, save, schoon, supplierAuth, logActivity, haversine, horeca } = kern;
  const { H, nu, id } = horeca;
  const B = (code) => { const h = H(code); if (!h.bezorg) h.bezorg = { zones: [], sloten: {}, open: true, ritten: {} }; return h.bezorg; };

  /* ---------- de gecombineerde route ----------
     Dichtstbijzijnde-eerst vanaf de zaak. Dat is een heuristiek en geen
     optimale route; het antwoord zegt dat er zelf bij, zodat niemand hem
     verkoopt als routeoptimalisatie. */
  app.post('/api/supplier/horeca/bezorg/route', supplierAuth, (req, res) => {
    const stops = (Array.isArray(req.body.stops) ? req.body.stops : []).slice(0, 30)
      .map(s => ({ id: schoon(s && s.id, 30) || id(3), adres: schoon(s && s.adres, 120) || null,
        lat: s && s.lat != null ? Number(s.lat) : null, lng: s && s.lng != null ? Number(s.lng) : null,
        minuten: Math.max(0, Math.min(120, parseInt(s && s.minuten, 10) || 0)) }))
      .filter(s => s.adres || (s.lat != null && s.lng != null));
    if (stops.length < 2) return res.status(400).json({ error: 'Geef minstens twee stops om te combineren.' });
    const metCoord = stops.filter(s => s.lat != null && s.lng != null);
    if (metCoord.length !== stops.length)
      return res.status(400).json({ error: 'Zonder coordinaten kan er geen volgorde uitgerekend worden; ' + (stops.length - metCoord.length) + ' stop(s) missen een locatie.' });

    let hier = { lat: req.supplier.lat, lng: req.supplier.lng };
    if (hier.lat == null || hier.lng == null) hier = { lat: metCoord[0].lat, lng: metCoord[0].lng };
    const over = metCoord.slice();
    const route = [];
    let km = 0;
    while (over.length) {
      let beste = 0, besteKm = Infinity;
      for (let i = 0; i < over.length; i++) {
        const d = haversine(hier.lat, hier.lng, over[i].lat, over[i].lng);
        if (d < besteKm) { besteKm = d; beste = i; }
      }
      const s = over.splice(beste, 1)[0];
      km += besteKm;
      route.push(Object.assign({}, s, { kmVanVorige: Math.round(besteKm * 10) / 10 }));
      hier = { lat: s.lat, lng: s.lng };
    }
    res.json({ ok: true, stops: route.length, route, totaalKm: Math.round(km * 10) / 10,
      heuristiek: 'dichtstbijzijnde eerst',
      let: 'Dit is een eenvoudige volgorde en geen optimale route; een echte routeplanner weegt ook verkeer en tijdvensters mee.' });
  });

  /* ---------- het afleverbewijs ---------- */
  app.post('/api/supplier/horeca/bezorg/afgeleverd', supplierAuth, (req, res) => {
    const b = B(req.supplier.code);
    const ritId = schoon(req.body.ritId, 40);
    if (!ritId) return res.status(400).json({ error: 'Welke rit is afgeleverd?' });
    const hoe = String(req.body.hoe || 'overhandigd');
    if (!['overhandigd', 'op de stoep', 'buren', 'niet thuis'].includes(hoe))
      return res.status(400).json({ error: 'Hoe is er afgeleverd? Kies: overhandigd, op de stoep, buren, niet thuis.' });
    if (req.body.leeftijdNodig === true && req.body.leeftijdGecontroleerd !== true)
      return res.status(409).json({ error: 'Deze rit vraagt een leeftijdscontrole. Zonder die controle mag hij niet worden afgetekend.' });
    const bewijs = { ritId, hoe, at: nu(), door: req.actor.name,
      ontvanger: hoe === 'overhandigd' || hoe === 'buren' ? (schoon(req.body.ontvanger, 60) || null) : null,
      leeftijdGecontroleerd: req.body.leeftijdGecontroleerd === true,
      notitie: schoon(req.body.notitie, 160) || null };
    if ((hoe === 'overhandigd' || hoe === 'buren') && !bewijs.ontvanger)
      return res.status(400).json({ error: 'Aan wie is het overhandigd? Een naam volstaat.' });
    b.ritten[ritId] = bewijs;
    save();
    logActivity(req.supplier.code, req.actor, 'tekende af voor rit ' + ritId + ' (' + hoe + ')');
    res.json({ ok: true, bewijs,
      let: 'Er wordt geen foto van een mens of een deur bewaard; alleen wat nodig is om later een geschil te beslechten.' });
  });
};
