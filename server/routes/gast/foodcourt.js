/* Guest OS (deellaag): DE FOODCOURT -- één mandje bij meer loketten.

   De poort is `auth`, net als bij bezorgen en afhalen: er is geen tafel en geen
   kamer om aanwezigheid mee te bewijzen, en er moet iemand zijn die de tassen
   komt halen. De rekensom staat in kern/gast/foodcourt.js; hier de bedrading
   plus het enige stuk dat leverancierskennis vraagt: welke kaart hoort bij
   welke zaak. */
'use strict';

module.exports = (kern) => {
  const { app, auth, schoon, findSupplier, foodcourtlaag, naad } = kern;

  // dezelfde handle als bij bezorgen: zie kern/gast/naad.js
  const handleVan = naad.handleVanReq;
  const naamVan = (code) => { const s = findSupplier(code); return s ? s.name : code; };

  /* ---------- bestellen bij meer loketten ---------- */
  app.post('/api/gast/foodcourt/bestel', auth, (req, res) => {
    if (kern.gegevensStop(req, res, 'bestelling')) return;
    const b = req.body || {};
    const items = Array.isArray(b.items) ? b.items.slice(0, 60) : [];
    if (!items.length) return res.status(400).json({ error: 'Er staat niets in je mandje.', code: 'leeg' });

    /* Groeperen per zaak. Een mandje met drie loketten wordt drie bestellingen
       -- elk bij zijn eigen keuken, in zijn eigen kassa en in zijn eigen
       omzet. Eén rekening over drie zaken zou betekenen dat de ene zaak de
       bestelling van de andere op zijn scherm krijgt. */
    const perZaak = new Map();
    for (const it of items) {
      const code = schoon(it && it.zaak, 30);
      if (!code) return res.status(400).json({ error: 'Bij welk loket hoort dit gerecht?', code: 'zaak-leeg' });
      if (!findSupplier(code)) return res.status(404).json({ error: 'Loket ' + code + ' kennen we niet.', code: 'zaak-onbekend' });
      if (!perZaak.has(code)) perZaak.set(code, []);
      perZaak.get(code).push({ itemId: it.itemId, aantal: it.aantal,
        keuzes:Array.isArray(it.keuzes) ? it.keuzes.slice(0, 30) : [], notitie: it.notitie });
    }
    if (perZaak.size > 8) return res.status(400).json({ error: 'Een mandje gaat over hooguit acht loketten.', code: 'te-veel-loketten' });

    const opdracht = [...perZaak.entries()].map(([zaakcode, zaakItems]) => {
      const kaart = kern.gastKaartVanZaak(zaakcode);
      return { zaakcode, items: zaakItems,
        kaartVan: (id) => { const m = kaart.find(x => x.id === id); return m
          ? { id: m.id, name: m.naam, price: m.centen / 100, cat: m.cat, station: m.station, alcohol: m.alcohol,
            opties:m.opties, ingredienten:m.ingredienten, allergenen:m.allergenen, prepMin:m.prepMin } : null; } };
    });

    const uit = foodcourtlaag.bestel(schoon(b.mandjeId, 40) || null, handleVan(req), opdracht, {
      allergie: schoon(b.allergie, 120) || null, idem: schoon(b.idem, 60) || null,
      apparaat: schoon(b.apparaat, 40) || null, tijd: schoon(b.tijd, 5) || null });

    const beeld = foodcourtlaag.mandjeBeeld(uit.mandjeId, handleVan(req), naamVan);
    /* Een deel dat mislukt is GEEN 200 met een vinkje, maar ook geen 4xx die
       doet alsof er niets is gebeurd -- want bij de andere loketten staat de
       keuken al te werken. 207 zegt precies wat er is: deels gelukt. */
    const status = uit.mislukt === 0 ? 200 : (uit.gelukt === 0 ? 409 : 207);
    res.status(status).json(Object.assign({ ok: uit.mislukt === 0 }, uit, { mandje: beeld,
      let: uit.mislukt
        ? 'Niet alles is gelukt. Wat wel is doorgegeven staat hieronder; dat kan niet worden teruggehaald omdat die keukens al bezig zijn.'
        : undefined }));
  });

  /* ---------- mijn mandje volgen ----------
     Het antwoord dat een wachtende gast echt wil: is ALLES klaar. Bij drie
     loketten sta je te wachten op het langzaamste, en één loket dat klaar is
     zegt niets over of je kunt gaan lopen. */
  app.post('/api/gast/foodcourt/mandje', auth, (req, res) => {
    const id = schoon((req.body || {}).mandjeId, 40);
    if (!id) return res.status(400).json({ error: 'Welk mandje?', code: 'mandje-leeg' });
    const beeld = foodcourtlaag.mandjeBeeld(id, handleVan(req), naamVan);
    if (!beeld.delen.length) return res.status(404).json({ error: 'Dit mandje kennen we niet.', code: 'mandje-onbekend' });
    res.json({ ok: true, mandje: beeld });
  });

  app.post('/api/gast/foodcourt/mijn', auth, (req, res) => {
    const handle = handleVan(req);
    res.json({ ok: true, mandjes: foodcourtlaag.mijne(handle)
      .map(id => foodcourtlaag.mandjeBeeld(id, handle, naamVan)) });
  });
};
