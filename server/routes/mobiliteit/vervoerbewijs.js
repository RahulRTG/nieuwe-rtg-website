/* Domein "mobiliteit" (deelmodule): de OV-kaartverkoop en de CDT.

   Twee onderwerpen in een bestand omdat ze dezelfde eigenschap hebben: bij
   allebei bepaalt iets BUITEN deze code of het mag. Bij de kaartverkoop is dat
   de overeenkomst met de vervoerder, bij de CDT de Nederlandse wet. De routes
   hier bewaken dus vooral WIE er aan mag komen; het oordeel zelf staat in de
   kern (kern/mobiliteit/overeenkomst, /kaartje, /cdt).

   De verdeling:
     /api/mob/kaart/...          de reiziger koopt en toont
     /api/staff/mob/kaart/...    het personeel controleert, meldt een storing
     /api/staff/mob/cdt/...      de chauffeur meldt zich aan, af, en met pauze
     /api/supplier/mob/cdt/...   de onderneming: het bord, het regime, de export
     /api/office/mob/overeenkomst  RTG legt de contracten vast

   WAAROM DE OVEREENKOMST ACHTER DE KANTOORDEUR ZIT en niet bij de vervoerder:
   een partij die zijn eigen overeenkomst kan schrijven, heeft geen overeenkomst
   maar een vinkje. */
module.exports = (kern, hulp) => {
  const { app, auth, supplierAuth, managerOnly, officeAuth, schoon, gegevensStop,
    kaartKoop, kaartMijn, kaartAanbod, kaartControle,
    storingMeld, storingLijst, storingTeruggave,
    overeenkomstZet, overeenkomstLijst,
    dienstStart, dienstSoort, dienstEind, cdtBeeld, regimeZet,
    cdtExport, cdtExportLijst, cdtOverdracht, dienstverlenerZet, koppelingStand } = kern;
  const { stuur } = hulp;

  const geenGast = (req, res) => {
    if (req.session.tier === 'guest') { res.status(403).json({ error: 'RTG Vervoer is voor leden.' }); return true; }
    return false;
  };
  const ovZaakOnly = (req, res) => {
    if (req.supplier.type !== 'ov') { res.status(409).json({ error: 'Deze functies horen bij een OV-vervoerder.' }); return true; }
    return false;
  };

  /* ---------------- de reiziger ---------------- */
  app.post('/api/mob/kaart/aanbod', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, kaartAanbod(req.session, req.body || {}));
  });
  /* De gegevenspoort staat hier om dezelfde reden als bij een rit: het
     vervoerbewijs is een afspraak met een DERDE partij (de vervoerder), en bij
     een controle of een terugbetaling moet die u kunnen bereiken. */
  app.post('/api/mob/kaart/koop', auth, async (req, res) => {
    if (geenGast(req, res)) return;
    if (gegevensStop(req, res, 'reservering')) return;
    stuur(res, await kaartKoop(req.session, req.body || {}));
  });
  app.post('/api/mob/kaart/mijn', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, kaartMijn(req.session));
  });

  /* ---------------- het personeel: controleren ---------------- */
  app.post('/api/staff/mob/kaart/controle', supplierAuth, (req, res) => {
    if (ovZaakOnly(req, res)) return;
    stuur(res, kaartControle(req.supplier, req.actor && req.actor.name, req.body || {}));
  });
  app.post('/api/staff/mob/kaart/storing', supplierAuth, (req, res) => {
    if (ovZaakOnly(req, res)) return;
    stuur(res, storingMeld(req.supplier, req.actor && req.actor.name, req.body || {}));
  });
  app.post('/api/staff/mob/kaart/storingen', supplierAuth, (req, res) => {
    if (ovZaakOnly(req, res)) return;
    stuur(res, storingLijst(req.supplier));
  });
  /* Uitbetalen is geld verplaatsen en dus een besluit van de manager, niet van
     iedereen met een PDA -- ook al mag iedereen de storing zelf melden. */
  app.post('/api/supplier/mob/kaart/teruggave', supplierAuth, async (req, res) => {
    if (ovZaakOnly(req, res)) return;
    if (!managerOnly(req, res)) return;
    stuur(res, await storingTeruggave(req.supplier, req.actor && req.actor.name, req.body || {}));
  });

  /* ---------------- RTG: de overeenkomsten ---------------- */
  app.post('/api/office/mob/overeenkomst', officeAuth, (req, res) => {
    stuur(res, req.body && req.body.lijst ? overeenkomstLijst(req.body) : overeenkomstZet(req.body || {}, 'kantoor'));
  });

  /* ---------------- de chauffeur: zijn dienst ---------------- */
  app.post('/api/staff/mob/cdt/aanmelden', supplierAuth, (req, res) => {
    stuur(res, dienstStart(req.supplier, req.actor && req.actor.name, req.body || {}));
  });
  app.post('/api/staff/mob/cdt/soort', supplierAuth, (req, res) => {
    stuur(res, dienstSoort(req.supplier, req.actor && req.actor.name, req.body || {}));
  });
  app.post('/api/staff/mob/cdt/afmelden', supplierAuth, (req, res) => {
    stuur(res, dienstEind(req.supplier, req.actor && req.actor.name, req.body || {}));
  });

  /* ---------------- de onderneming: het bord en de uitvoer ---------------- */
  app.post('/api/supplier/mob/cdt', supplierAuth, (req, res) => {
    stuur(res, cdtBeeld(req.supplier, req.body || {}));
  });
  /* Het regime is de vertaling van de wet naar deze onderneming (loondienst,
     zelfstandig, cao). Dat is een besluit van de werkgever, niet van een
     chauffeur die op zijn eigen grenzen zou kunnen schuiven. */
  app.post('/api/supplier/mob/cdt/regime', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return;
    stuur(res, regimeZet(req.supplier.code, req.body || {}));
  });
  app.post('/api/supplier/mob/cdt/export', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return;
    stuur(res, req.body && req.body.lijst ? cdtExportLijst(req.supplier) : cdtExport(req.supplier, req.body || {}));
  });
  app.post('/api/supplier/mob/cdt/overdracht', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return;
    stuur(res, cdtOverdracht(req.supplier, req.actor && req.actor.name, req.body || {}));
  });
  app.post('/api/supplier/mob/cdt/dienstverlener', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return;
    stuur(res, req.body && req.body.lees
      ? { ok: true, koppeling: koppelingStand(req.supplier.code) }
      : dienstverlenerZet(req.supplier, req.actor && req.actor.name, req.body || {}));
  });
};
