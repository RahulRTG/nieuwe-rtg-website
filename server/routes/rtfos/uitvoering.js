/* Domein "rtfos", deel "uitvoering": wat er in een stad gebeurt.

   Vrijwilligers, geld, hulpvragen, meldingen, rapportages, gemeenten,
   ondernemers, subsidies, voorraad, activiteiten en communicatie. Zelfde vorm
   als de organisatielaag: `officeAuth` op de deur, de echte bevoegdheidsvraag
   in de kern, per object.

   ELK PAD STAAT HIER LETTERLIJK. Zie de kop van ./index.js voor het waarom: een
   opgebouwd pad (`'/api/rtfos/' + pad`) maakt een route onzichtbaar voor de
   poort-audit, de schakelbaarheid, de dubbele-routecontrole en de dekking --
   vier meters die allemaal de bron lezen. Dat is hier een keer misgegaan en
   het staat daar met naam.

   `H` komt mee uit index.js en is dus letterlijk dezelfde verpakking: als daar
   ooit een logregel of een kop bij komt, geldt die hier ook. Twee helpers met
   dezelfde naam en een eigen leven is LAT.md regel 4 in routevorm. */
module.exports = ({ app, officeAuth, rtfos, H }) => {

  // ---------- vrijwilligers ----------
  app.post('/api/rtfos/vrijwilligers', officeAuth, H((req, b) => rtfos.vrijwilligers.lijst(req, b.stad, b)));
  app.post('/api/rtfos/vrijwilliger/maak', officeAuth, H((req, b) => rtfos.vrijwilligers.maak(req, b)));
  app.post('/api/rtfos/vrijwilliger/zet', officeAuth, H((req, b) => rtfos.vrijwilligers.zet(req, b.id, b)));
  app.post('/api/rtfos/vrijwilliger/koppel', officeAuth, H((req, b) => rtfos.vrijwilligers.koppel(req, b.id, b.projectId, b.los === true)));
  app.post('/api/rtfos/vrijwilliger/uren', officeAuth, H((req, b) => rtfos.vrijwilligers.urenBoek(req, b.id, b)));
  app.post('/api/rtfos/vrijwilliger/evaluatie', officeAuth, H((req, b) => rtfos.vrijwilligers.evaluatie(req, b.id, b.tekst)));

  // ---------- geld: bronnen met een oormerk, uitgaven met vier ogen ----------
  app.post('/api/rtfos/geld', officeAuth, H((req, b) => rtfos.geld.lijst(req, b.stad)));
  app.post('/api/rtfos/bron/maak', officeAuth, H((req, b) => rtfos.geld.bronMaak(req, b)));
  app.post('/api/rtfos/bron/verplaats', officeAuth, H((req, b) => rtfos.geld.verplaats(req, b.id, b.projectId, b)));
  app.post('/api/rtfos/uitgave/aanvraag', officeAuth, H((req, b) => rtfos.geld.uitgaveAanvraag(req, b)));
  app.post('/api/rtfos/uitgave/besluit', officeAuth, H((req, b) => rtfos.geld.uitgaveBesluit(req, b.id, b.akkoord === true, b.reden)));

  // ---------- hulpvragen ----------
  app.post('/api/rtfos/casussen', officeAuth, H((req, b) => rtfos.casus.lijst(req, b.stad, b)));
  app.post('/api/rtfos/casus/maak', officeAuth, H((req, b) => rtfos.casus.maak(req, b)));
  app.post('/api/rtfos/casus/status', officeAuth, H((req, b) => rtfos.casus.status(req, b.id, b.status, b)));
  app.post('/api/rtfos/casus/stap', officeAuth, H((req, b) => rtfos.casus.stap(req, b.id, b)));
  // wie ja zegt mag ook nee zeggen; daarna stopt het werk bij de eerstvolgende
  // stap die toestemming nodig heeft (kern/rtfos/casus-keten.js)
  app.post('/api/rtfos/casus/toestemming-weg', officeAuth, H((req, b) => rtfos.casus.toestemmingWeg(req, b.id, b.reden)));
  // apart, met een eigen auditregel: dit is het moment dat iemand de naam ziet
  app.post('/api/rtfos/casus/contact', officeAuth, H((req, b) => rtfos.casus.contactOpen(req, b.id)));

  /* ---------- beschermzaken: geweld, uitbuiting, vlucht ----------
     EEN ANDERE DATAKLASSE EN DUS EEN ANDER PAD. Ze staan hier onder de
     hulpvragen omdat een medewerker ze in hetzelfde scherm tegenkomt, maar ze
     delen geen enkele route met de casus -- en dat is met opzet: een gedeeld
     pad wordt vanzelf een gedeelde export. Zie kern/beschermzaak/klasse.js.

     Let op dat er GEEN /zoek en GEEN /export bij staat, en dat /lees een eigen
     route is. Een zaak lezen is een handeling met een auditregel, en niet iets
     wat je en passant doet in een lijst. */
  app.post('/api/rtfos/bescherming/zaken', officeAuth, H((req, b) => rtfos.beschermzaak.lijst(req, b.stad, b)));
  app.post('/api/rtfos/bescherming/open', officeAuth, H((req, b) => rtfos.beschermzaak.open(req, b)));
  app.post('/api/rtfos/bescherming/lees', officeAuth, H((req, b) => rtfos.beschermzaak.lees(req, b.id)));
  app.post('/api/rtfos/bescherming/veiligheid', officeAuth, H((req, b) => rtfos.beschermzaak.veiligheid(req, b.id, b)));
  app.post('/api/rtfos/bescherming/stand', officeAuth, H((req, b) => rtfos.beschermzaak.stand(req, b.id, b.naar, b)));
  app.post('/api/rtfos/bescherming/toestemming', officeAuth, H((req, b) => rtfos.beschermzaak.toestemming(req, b.id, b)));
  app.post('/api/rtfos/bescherming/toestemming-weg', officeAuth, H((req, b) => rtfos.beschermzaak.trekIn(req, b.id, b.reden)));
  app.post('/api/rtfos/bescherming/overdracht', officeAuth, H((req, b) => rtfos.beschermzaak.draagOver(req, b.id, b)));
  app.post('/api/rtfos/bescherming/sluit', officeAuth, H((req, b) => rtfos.beschermzaak.sluit(req, b.id, b)));

  // ---------- integriteit ----------
  app.post('/api/rtfos/meldingen', officeAuth, H((req, b) => rtfos.integriteit.lijst(req, b.stad)));
  app.post('/api/rtfos/melding/maak', officeAuth, H((req, b) => rtfos.integriteit.meld(req, b)));
  app.post('/api/rtfos/melding/stap', officeAuth, H((req, b) => rtfos.integriteit.stap(req, b.id, b.tekst)));
  app.post('/api/rtfos/melding/sluit', officeAuth, H((req, b) => rtfos.integriteit.sluit(req, b.id, b.uitkomst)));

  // ---------- impact ----------
  app.post('/api/rtfos/rapport', officeAuth, H((req, b) => rtfos.rapport.stadRapport(req, b.stad)));
  app.post('/api/rtfos/rapport/landelijk', officeAuth, H(req => rtfos.rapport.landelijk(req)));

  // ---------- gemeenten ----------
  app.post('/api/rtfos/gemeenten', officeAuth, H((req, b) => rtfos.gemeente.lijst(req, b.stad)));
  app.post('/api/rtfos/gemeente/maak', officeAuth, H((req, b) => rtfos.gemeente.maak(req, b)));
  app.post('/api/rtfos/gemeente/opdracht', officeAuth, H((req, b) => rtfos.gemeente.opdrachtZet(req, b.id, b)));

  // ---------- lokale ondernemers ----------
  app.post('/api/rtfos/ondernemers', officeAuth, H((req, b) => rtfos.ondernemers.lijst(req, b.stad)));
  app.post('/api/rtfos/ondernemer/maak', officeAuth, H((req, b) => rtfos.ondernemers.maak(req, b)));
  app.post('/api/rtfos/ondernemer/aanbod', officeAuth, H((req, b) => rtfos.ondernemers.aanbodMaak(req, b.id, b)));
  app.post('/api/rtfos/ondernemer/koppel', officeAuth, H((req, b) => rtfos.ondernemers.koppel(req, b.id, b.aanbodId, b.projectId)));
  app.post('/api/rtfos/ondernemer/aanbod-status', officeAuth, H((req, b) => rtfos.ondernemers.aanbodStatus(req, b.id, b.aanbodId, b.status)));

  // ---------- subsidies ----------
  // Toekennen maakt zelf de geoormerkte bron in geld.js; er is met opzet geen
  // route die dat los doet (kern/rtfos/subsidies-keten.js).
  app.post('/api/rtfos/subsidies', officeAuth, H((req, b) => rtfos.subsidies.lijst(req, b.stad)));
  app.post('/api/rtfos/subsidie/maak', officeAuth, H((req, b) => rtfos.subsidies.maak(req, b)));
  app.post('/api/rtfos/subsidie/zet', officeAuth, H((req, b) => rtfos.subsidies.zet(req, b.id, b)));
  app.post('/api/rtfos/subsidie/status', officeAuth, H((req, b) => rtfos.subsidies.status(req, b.id, b.status, b)));
  app.post('/api/rtfos/subsidie/moment', officeAuth, H((req, b) => rtfos.subsidies.moment(req, b.id, b)));
  app.post('/api/rtfos/subsidie/bewijs', officeAuth, H((req, b) => rtfos.subsidies.bewijsMaak(req, b.id, b)));

  // ---------- voorraad en goederen ----------
  app.post('/api/rtfos/voorraad', officeAuth, H((req, b) => rtfos.voorraad.lijst(req, b.stad)));
  app.post('/api/rtfos/voorraad/binnen', officeAuth, H((req, b) => rtfos.voorraad.binnen(req, b)));
  app.post('/api/rtfos/voorraad/uit', officeAuth, H((req, b) => rtfos.voorraad.uitgifte(req, b.id, b)));
  app.post('/api/rtfos/voorraad/afschrijven', officeAuth, H((req, b) => rtfos.voorraad.afschrijven(req, b.id, b)));

  // ---------- activiteiten ----------
  app.post('/api/rtfos/activiteiten', officeAuth, H((req, b) => rtfos.activiteiten.lijst(req, b.stad)));
  app.post('/api/rtfos/activiteit/maak', officeAuth, H((req, b) => rtfos.activiteiten.maak(req, b)));
  app.post('/api/rtfos/activiteit/zet', officeAuth, H((req, b) => rtfos.activiteiten.zet(req, b.id, b)));
  app.post('/api/rtfos/activiteit/begeleiders', officeAuth, H((req, b) => rtfos.activiteiten.begeleiders(req, b.id, b.ids)));
  app.post('/api/rtfos/activiteit/open', officeAuth, H((req, b) => rtfos.activiteiten.open(req, b.id)));
  app.post('/api/rtfos/activiteit/status', officeAuth, H((req, b) => rtfos.activiteiten.status(req, b.id, b.status, b)));
  app.post('/api/rtfos/activiteit/inschrijven', officeAuth, H((req, b) => rtfos.activiteiten.inschrijven(req, b.id, b)));
  app.post('/api/rtfos/activiteit/afmelden', officeAuth, H((req, b) => rtfos.activiteiten.afmelden(req, b.id, b.inschrijvingId)));
  app.post('/api/rtfos/activiteit/incheck', officeAuth, H((req, b) => rtfos.activiteiten.inchecken(req, b.id, b.checkinCode)));

  // ---------- communicatie ----------
  // Naar binnen stuurt de stad zelf; naar buiten pas na een landelijk besluit.
  app.post('/api/rtfos/berichten', officeAuth, H((req, b) => rtfos.berichten.lijst(req, b.stad)));
  app.post('/api/rtfos/bericht/maak', officeAuth, H((req, b) => rtfos.berichten.maak(req, b)));
  app.post('/api/rtfos/bericht/zet', officeAuth, H((req, b) => rtfos.berichten.zet(req, b.id, b)));
  app.post('/api/rtfos/bericht/verzend', officeAuth, H((req, b) => rtfos.berichten.verzend(req, b.id)));
  app.post('/api/rtfos/bericht/besluit', officeAuth, H((req, b) => rtfos.berichten.besluit(req, b.id, b.akkoord === true, b.reden)));
};
