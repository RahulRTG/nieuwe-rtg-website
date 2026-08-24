/* Guest OS (deellaag): BESTELLEN, DE LEVENDE REKENING EN "WAAROM?".

   De bestelling gaat door kern/gast/order.js op de bestaande rekening. Hier
   staat alleen de bedrading: sleutel eraf, mandje erin, antwoord eruit.

   WAAROM ER EEN WAAROM-ROUTE IS. Een gast die op een grijze knop tikt en niets
   ziet gebeuren, denkt dat de app stuk is. Een gast die leest "dit gerecht is
   door de keuken op uitverkocht gezet" weet wat er aan de hand is en roept geen
   ober. Elke weigering in deze laag draagt daarom een machineleesbare code EN
   een zin, en deze route geeft die zin ook los -- zodat een scherm hem naast
   een uitgegrijsd gerecht kan zetten zonder eerst een bestelling te proberen.
   Wegstoppen wat niet kan is oneerlijk naar beide kanten: je weet niet wat je
   mist, en je merkt ook niet dat het bestaat. */
'use strict';

module.exports = (kern) => {
  const { app, schoon, beleid, orderlaag, gastAuth, stuur } = kern;

  /* ---------- bestellen ---------- */
  app.post('/api/gast/bestel', gastAuth, (req, res) => {
    const { zaakcode, rekening, deelnemer } = req.gast;
    const b = req.body || {};
    const kaart = kern.gastKaartVanZaak(zaakcode);
    /* De kaart wordt HIER opgehaald en als opzoekfunctie doorgegeven, zodat de
       orderlaag niets van leveranciers hoeft te weten. De prijs komt daarmee
       altijd van de zaak en nooit van de client -- een bedrag dat de telefoon
       meestuurt is een bedrag dat de telefoon kan verzinnen. */
    const kaartVan = (id) => kaart.find(x => x.id === id) || null;
    const uit = orderlaag.bestel(zaakcode, rekening, deelnemer, {
      items: b.items, allergie: schoon(b.allergie, 120) || null,
      idem: b.idem, apparaat: schoon(b.apparaat, 40) || null,
      kaartVan: (id) => { const m = kaartVan(id); return m ? { id: m.id, name: m.naam, price: m.centen / 100,
        cat: m.cat, station: m.station, alcohol: m.alcohol, opties:m.opties, ingredienten:m.ingredienten,
        allergenen:m.allergenen, prepMin:m.prepMin } : null; }
    });
    stuur(res, uit);
  });

  /* ---------- de rekening, live ----------
     Iedereen aan tafel ziet hetzelfde: welke producten er staan, wie wat
     bestelde en wat er nog openstaat. Dat is het punt van een gedeelde tafel --
     en het is ook de reden dat er geen bedragen per persoon in verstopt zitten
     die anderen niet kunnen zien. */
  app.post('/api/gast/rekening', gastAuth, (req, res) => {
    const { rekening, deelnemer } = req.gast;
    res.json({ ok: true, rekening: orderlaag.gastBeeld(rekening, deelnemer),
      verdeling: rekening.verdeling || null });
  });

  /* ---------- waarom? ----------
     Twee soorten vragen: over een gerecht ("waarom kan ik dit niet bestellen")
     en over de rekening ("waarom moet een medewerker mijn bestelling nakijken").
     Allebei worden ze beantwoord door dezelfde beleidslaag die het ook
     werkelijk tegenhoudt -- een uitleg uit een andere bron dan de beslissing is
     vroeg of laat een uitleg die niet klopt. */
  app.post('/api/gast/waarom', gastAuth, (req, res) => {
    const { zaakcode, rekening, deelnemer } = req.gast;
    const b = req.body || {};
    const antwoorden = [];

    if (b.itemId) {
      const item = (kern.gastKaartVanZaak(zaakcode) || []).find(x => x.id === String(b.itemId));
      const oordeel = beleid.magItem(zaakcode, item ? { id: item.id, name: item.naam, alcohol: item.alcohol } : null, deelnemer);
      antwoorden.push({ vraag: 'Kan ik dit bestellen?', kan: oordeel.mag,
        code: oordeel.code || null, uitleg: oordeel.uitleg || 'Ja, dit staat gewoon op de kaart.' });
    }

    const mag = beleid.magBestellen(zaakcode, rekening.kanaal);
    antwoorden.push({ vraag: 'Mag ik hier zelf bestellen?', kan: mag.mag,
      code: mag.code || null, uitleg: mag.uitleg || 'Ja, deze zaak neemt bestellingen van je telefoon aan.' });

    const afr = beleid.magAfrekenen(zaakcode);
    antwoorden.push({ vraag: 'Kan ik zelf afrekenen?', kan: afr.mag,
      code: afr.code || null,
      uitleg: afr.uitleg || 'Ja, met een cadeaubon, tegoed of op je hotelkamer. Kaart en pin lopen via de bediening.' });

    const wachtend = (rekening.regels || []).filter(r => r.bevestiging === 'wacht');
    if (wachtend.length) antwoorden.push({ vraag: 'Waarom kijkt een medewerker mijn bestelling na?',
      kan: true, code: wachtend[0].bevestigingCode || 'bevestiging',
      uitleg: wachtend[0].bevestigingUitleg });

    res.json({ ok: true, antwoorden, beleid: beleid.beleidVan(zaakcode) });
  });
};
