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
  const { nu, id, heleCenten, uitEuro } = horeca;
  /* De rekensom (zones, kosten, sloten) staat in kern/horeca/bezorglaag.js,
     want de gastkant stelt dezelfde vragen. Een zone die de zaak anders
     uitrekent dan de gast levert een bestelling op die wordt aangenomen en niet
     gereden kan worden. */
  const laag = require('../../../kern/horeca/bezorglaag')({ save, horeca, haversine });
  const { B, pc, zoekZone, slotenVan, reserveerSlot } = laag;

  /* ---------- zones ---------- */
  app.post('/api/supplier/horeca/bezorg/zone', supplierAuth, (req, res) => {
    const b = B(req.supplier.code);
    if (Array.isArray(req.body.zones)) {
      b.zones = req.body.zones.slice(0, 40).map(z => ({
        id: schoon(z && z.id, 20) || id(3), naam: schoon(z && z.naam, 40) || 'Zone',
        postcodes: Array.isArray(z && z.postcodes) ? z.postcodes.slice(0, 200).map(pc).filter(Boolean) : [],
        straalKm: z && z.straalKm != null ? Math.max(0, Math.min(100, Number(z.straalKm) || 0)) : null,
        kostenCenten: z && z.kosten != null ? uitEuro(z.kosten) : heleCenten(z && z.kostenCenten),
        minimumCenten: z && z.minimum != null ? uitEuro(z.minimum) : heleCenten(z && z.minimumCenten),
        gratisVanafCenten: z && z.gratisVanaf != null ? uitEuro(z.gratisVanaf) : null,
        minuten: Math.max(5, Math.min(180, parseInt(z && z.minuten, 10) || 30)) }));
    }
    if (req.body.open != null) b.open = req.body.open !== false;
    if (req.body.reden !== undefined) b.redenDicht = schoon(req.body.reden, 120) || null;
    save();
    res.json({ ok: true, open: b.open, redenDicht: b.redenDicht || null, zones: b.zones });
  });

  app.post('/api/supplier/horeca/bezorg/check', supplierAuth, (req, res) => {
    const b = B(req.supplier.code);
    if (!b.zones.length) return res.status(409).json({ error: 'Er zijn nog geen bezorgzones ingesteld.' });
    const uit = zoekZone(b, req.body || {}, req.supplier);
    if (!uit.zone) return res.json({ ok: true, bezorgbaar: false, reden: uit.reden, km: uit.km || null });
    const z = uit.zone;
    const bedrag = req.body.bedrag != null ? uitEuro(req.body.bedrag) : heleCenten(req.body.centen);
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
    const uit = slotenVan(req.supplier.code, schoon(req.body.datum, 10));
    res.json({ ok: true, datum: uit.datum, sloten: uit.sloten,
      let: 'De capaciteit staat in keukenminuten, niet in bestellingen.' });
  });

  app.post('/api/supplier/horeca/bezorg/reserveer-slot', supplierAuth, (req, res) => {
    const uit = reserveerSlot(req.supplier.code, { datum: schoon(req.body.datum, 10),
      tijd: schoon(req.body.tijd, 5), minuten: req.body.minuten });
    if (uit.error) return res.status(uit.status || 400).json(uit);
    res.json(uit);
  });
};
