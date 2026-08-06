/* Domein "rtfos", deel "governance": fase drie.

   Bestuursvergaderingen, landelijk beleid, het jaarverslag, het risicoregister,
   de herkomstcontrole op grote giften en de meldcode. Zelfde vorm als de rest:
   `officeAuth` op de deur, de echte bevoegdheidsvraag in de kern.

   ELK PAD STAAT LETTERLIJK -- zie de kop van ./index.js.

   EEN ROUTE HIER IS PUBLIEK, en die staat er niet per ongeluk: de gepubliceerde
   jaarverslagen. Een ANBI moet zijn jaarstuk openbaar en vindbaar hebben; achter
   een inlog is het dat niet. Wat eruit komt is uitsluitend wat het bestuur heeft
   vastgesteld EN gepubliceerd (kern/rtfos/jaarverslag.js), met dezelfde leesrem
   als de rest van de publieke routes. */
const rem = require('../../rem');

module.exports = ({ app, officeAuth, rtfos, H, veilig }) => {
  const leesRem = rem({ windowMs: 60000, limit: 120, key: req => 'rtfpubliek|' + String(req.ip) });

  // ---------- bestuursvergaderingen, quorum en besluiten ----------
  app.post('/api/rtfos/vergaderingen', officeAuth, H((req, b) => rtfos.bestuur.lijst(req, b)));
  app.post('/api/rtfos/vergadering', officeAuth, H((req, b) => rtfos.bestuur.een(req, b.id)));
  app.post('/api/rtfos/vergadering/maak', officeAuth, H((req, b) => rtfos.bestuur.maak(req, b)));
  app.post('/api/rtfos/vergadering/agenda', officeAuth, H((req, b) => rtfos.bestuur.agendaBij(req, b.id, b.punt)));
  app.post('/api/rtfos/vergadering/presentie', officeAuth, H((req, b) => rtfos.bestuur.presentie(req, b.id, b)));
  app.post('/api/rtfos/vergadering/besluit', officeAuth, H((req, b) => rtfos.bestuur.besluit(req, b.id, b)));
  // Vaststellen doet een LATERE vergadering van hetzelfde orgaan; daarna ligt alles vast.
  app.post('/api/rtfos/vergadering/vaststellen', officeAuth, H((req, b) => rtfos.bestuur.stelVast(req, b.id, b.doorId)));

  // ---------- landelijk beleid ----------
  app.post('/api/rtfos/beleid', officeAuth, H((req, b) => rtfos.beleid.lijst(req, b)));
  app.post('/api/rtfos/beleid/maak', officeAuth, H((req, b) => rtfos.beleid.maak(req, b)));
  // Herzien zet ALLE bevestigingen terug: een handtekening onder v1 dekt v2 niet.
  app.post('/api/rtfos/beleid/herzien', officeAuth, H((req, b) => rtfos.beleid.herzien(req, b.id, b)));
  app.post('/api/rtfos/beleid/bevestig', officeAuth, H((req, b) => rtfos.beleid.bevestig(req, b.id, b.stad)));

  // ---------- het jaarverslag en de ANBI-publicatie ----------
  app.post('/api/rtfos/jaarverslagen', officeAuth, H(req => rtfos.jaarverslag.lijst(req)));
  app.post('/api/rtfos/jaarverslag/opstellen', officeAuth, H((req, b) => rtfos.jaarverslag.stelOp(req, b)));
  app.post('/api/rtfos/jaarverslag/aanvullen', officeAuth, H((req, b) => rtfos.jaarverslag.vulAan(req, b.id, b)));
  app.post('/api/rtfos/jaarverslag/vaststellen', officeAuth, H((req, b) => rtfos.jaarverslag.stelVast(req, b.id, b.besluitId)));
  app.post('/api/rtfos/jaarverslag/publiceren', officeAuth, H((req, b) => rtfos.jaarverslag.publiceer(req, b.id)));

  // ---------- het risicoregister ----------
  app.post('/api/rtfos/risicos', officeAuth, H((req, b) => rtfos.risico.lijst(req, b)));
  app.post('/api/rtfos/risico/meld', officeAuth, H((req, b) => rtfos.risico.meld(req, b)));
  app.post('/api/rtfos/risico/zet', officeAuth, H((req, b) => rtfos.risico.zet(req, b.id, b)));
  app.post('/api/rtfos/risico/herbeoordeel', officeAuth, H((req, b) => rtfos.risico.herbeoordeel(req, b.id, b)));

  // ---------- grote en contante giften ----------
  // De grendel zelf zit op de bron (kern/rtfos/geld-uitgaven.js); dit is de
  // handeling waarmee hij eraf gaat, en die is landelijk.
  app.post('/api/rtfos/herkomst', officeAuth, H((req, b) => rtfos.herkomst.lijst(req, b)));
  app.post('/api/rtfos/herkomst/beoordeel', officeAuth, H((req, b) => rtfos.herkomst.beoordeel(req, b.bronId, b)));

  // ---------- meldcode huiselijk geweld en kindermishandeling ----------
  app.post('/api/rtfos/meldcodes', officeAuth, H((req, b) => rtfos.meldcode.lijst(req, b.stad)));
  app.post('/api/rtfos/meldcode/open', officeAuth, H((req, b) => rtfos.meldcode.open(req, b)));
  app.post('/api/rtfos/meldcode/stap', officeAuth, H((req, b) => rtfos.meldcode.stap(req, b.id, b)));
  app.post('/api/rtfos/meldcode/sluit', officeAuth, H((req, b) => rtfos.meldcode.sluit(req, b.id, b)));

  // ---------- de ANBI-publicatie: openbaar, want anders is het geen publicatie ----------
  app.post('/api/rtfos/publiek/jaarverslagen', leesRem, (req, res) => veilig(res, () => rtfos.jaarverslag.openbaar()));
};
