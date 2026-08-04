/* Horeca OS (deellaag): de bezorgdienst van de zaak zelf -- zones, tijdsloten,
   capaciteit, gecombineerde routes en het afleverbewijs.

   De rit zelf bestaat al (routes/supplier/bezorg.js: aannemen, gps, status,
   inpakken, terug). Wat er niet was, is de laag ervoor: MAG deze bestelling
   hier bezorgd worden, VOOR hoeveel, en KAN het in dit tijdslot nog? Dat zijn
   de drie vragen die een bezorgdienst draaiend houden.

   Twee keuzes die hier in de code staan:

   1. EEN ZONE ANTWOORDT ALTIJD MET EEN REDEN. Buiten het gebied is geen "sorry,
      dat gaat niet" maar "uw postcode valt buiten onze zones" of "u zit 9,2 km
      verderop en we rijden tot 7 km". Wie een adres invoert, hoort te weten
      waarom het niet kan.
   2. EEN VOL TIJDSLOT NOEMT HET EERSTVOLGENDE. Een capaciteitsrem die alleen
      nee zegt, stuurt de klant naar een ander. De rem telt bovendien in
      KEUKENMINUTEN en niet in bestellingen: tien pizza's zijn geen tien
      diners.
   De gecombineerde route en het afleverbewijs staan in horeca/bezorgrit.js. */
module.exports = (kern) => {
  const { app, save, schoon, supplierAuth, haversine, horeca } = kern;
  const { H, nu, id, centen, uitEuro } = horeca;

  const B = (code) => { const h = H(code); if (!h.bezorg) h.bezorg = { zones: [], sloten: {}, open: true, ritten: {} }; return h.bezorg; };
  const pc = (s) => String(s || '').toUpperCase().replace(/\s+/g, '').slice(0, 6);

  /* ---------- zones ---------- */
  app.post('/api/supplier/horeca/bezorg/zone', supplierAuth, (req, res) => {
    const b = B(req.supplier.code);
    if (Array.isArray(req.body.zones)) {
      b.zones = req.body.zones.slice(0, 40).map(z => ({
        id: schoon(z && z.id, 20) || id(3), naam: schoon(z && z.naam, 40) || 'Zone',
        postcodes: Array.isArray(z && z.postcodes) ? z.postcodes.slice(0, 200).map(pc).filter(Boolean) : [],
        straalKm: z && z.straalKm != null ? Math.max(0, Math.min(100, Number(z.straalKm) || 0)) : null,
        kostenCenten: z && z.kosten != null ? uitEuro(z.kosten) : centen(z && z.kostenCenten),
        minimumCenten: z && z.minimum != null ? uitEuro(z.minimum) : centen(z && z.minimumCenten),
        gratisVanafCenten: z && z.gratisVanaf != null ? uitEuro(z.gratisVanaf) : null,
        minuten: Math.max(5, Math.min(180, parseInt(z && z.minuten, 10) || 30)) }));
    }
    if (req.body.open != null) b.open = req.body.open !== false;
    if (req.body.reden !== undefined) b.redenDicht = schoon(req.body.reden, 120) || null;
    save();
    res.json({ ok: true, open: b.open, redenDicht: b.redenDicht || null, zones: b.zones });
  });

  /* De poort voor een adres: welke zone, wat kost het, en wat is het minimum.
     Hij antwoordt ook als het NIET kan, met de reden erbij. */
  function zoekZone(b, { postcode, lat, lng }, zaak) {
    const code = pc(postcode);
    for (const z of b.zones) if (z.postcodes.length && z.postcodes.some(p => code.startsWith(p))) return { zone: z, hoe: 'postcode' };
    if (lat != null && lng != null && zaak && zaak.lat != null && zaak.lng != null) {
      const km = haversine(Number(lat), Number(lng), Number(zaak.lat), Number(zaak.lng));
      for (const z of b.zones) if (z.straalKm && km <= z.straalKm) return { zone: z, hoe: 'straal', km: Math.round(km * 10) / 10 };
      const grootste = b.zones.filter(z => z.straalKm).sort((a, c) => c.straalKm - a.straalKm)[0];
      if (grootste) return { zone: null, reden: 'U zit ' + (Math.round(km * 10) / 10) + ' km verderop; we bezorgen tot ' + grootste.straalKm + ' km.', km: Math.round(km * 10) / 10 };
    }
    return { zone: null, reden: code ? 'Postcode ' + code + ' valt buiten onze bezorgzones.' : 'Geef een postcode of een locatie op.' };
  }

  app.post('/api/supplier/horeca/bezorg/check', supplierAuth, (req, res) => {
    const b = B(req.supplier.code);
    if (!b.zones.length) return res.status(409).json({ error: 'Er zijn nog geen bezorgzones ingesteld.' });
    const uit = zoekZone(b, req.body || {}, req.supplier);
    if (!uit.zone) return res.json({ ok: true, bezorgbaar: false, reden: uit.reden, km: uit.km || null });
    const z = uit.zone;
    const bedrag = req.body.bedrag != null ? uitEuro(req.body.bedrag) : centen(req.body.centen);
    const gratis = z.gratisVanafCenten && bedrag >= z.gratisVanafCenten;
    res.json({ ok: true, bezorgbaar: b.open, gesloten: !b.open, redenDicht: b.open ? null : (b.redenDicht || 'De bezorging is tijdelijk gesloten.'),
      zone: { id: z.id, naam: z.naam, minuten: z.minuten }, hoe: uit.hoe, km: uit.km || null,
      kostenCenten: gratis ? 0 : z.kostenCenten, gratisBezorging: !!gratis,
      minimumCenten: z.minimumCenten,
      haaltMinimum: !z.minimumCenten || bedrag >= z.minimumCenten,
      tekort: z.minimumCenten && bedrag < z.minimumCenten ? z.minimumCenten - bedrag : 0 });
  });

  /* ---------- tijdsloten ----------
     De rem telt in keukenminuten, niet in bestellingen: tien pizza's zijn geen
     tien diners. Een vol slot noemt altijd het eerstvolgende dat wel kan. */
  app.post('/api/supplier/horeca/bezorg/sloten', supplierAuth, (req, res) => {
    const b = B(req.supplier.code);
    if (req.body.sloten && typeof req.body.sloten === 'object') {
      b.slotInstel = {};
      for (const [tijd, cap] of Object.entries(req.body.sloten).slice(0, 96)) {
        const t = schoon(tijd, 5);
        if (!/^\d{2}:\d{2}$/.test(t)) continue;
        b.slotInstel[t] = Math.max(0, Math.min(600, parseInt(cap, 10) || 0));
      }
      save();
    }
    const dag = schoon(req.body.datum, 10) || nu().slice(0, 10);
    const bezet = (b.sloten[dag] || {});
    const rijen = Object.entries(b.slotInstel || {}).sort().map(([tijd, cap]) => ({
      tijd, capaciteitMinuten: cap, gebruiktMinuten: bezet[tijd] || 0,
      vrij: Math.max(0, cap - (bezet[tijd] || 0)), vol: (bezet[tijd] || 0) >= cap }));
    res.json({ ok: true, datum: dag, sloten: rijen,
      let: 'De capaciteit staat in keukenminuten, niet in bestellingen.' });
  });

  app.post('/api/supplier/horeca/bezorg/reserveer-slot', supplierAuth, (req, res) => {
    const b = B(req.supplier.code);
    const dag = schoon(req.body.datum, 10) || nu().slice(0, 10);
    const tijd = schoon(req.body.tijd, 5);
    const minuten = Math.max(1, Math.min(600, parseInt(req.body.minuten, 10) || 15));
    const cap = (b.slotInstel || {})[tijd];
    if (cap == null) return res.status(404).json({ error: 'Dat tijdslot bestaat niet. Stel de sloten eerst in.' });
    b.sloten[dag] = b.sloten[dag] || {};
    const gebruikt = b.sloten[dag][tijd] || 0;
    if (gebruikt + minuten > cap) {
      const volgende = Object.entries(b.slotInstel).sort()
        .find(([t, c]) => t > tijd && (c - ((b.sloten[dag] || {})[t] || 0)) >= minuten);
      return res.status(409).json({ error: 'Dat tijdslot is vol (' + gebruikt + ' van ' + cap + ' minuten bezet).',
        vol: true, eerstvolgende: volgende ? volgende[0] : null,
        let: volgende ? 'Om ' + volgende[0] + ' is er nog ruimte.' : 'Vandaag is er geen slot meer vrij met genoeg ruimte.' });
    }
    b.sloten[dag][tijd] = gebruikt + minuten;
    save();
    res.json({ ok: true, datum: dag, tijd, gereserveerd: minuten, gebruikt: b.sloten[dag][tijd], capaciteit: cap });
  });
};
