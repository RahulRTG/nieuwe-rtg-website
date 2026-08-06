/* Domein "rtfos", deel "uitvoering": wat er in een stad gebeurt.

   Vrijwilligers, geld, hulpvragen, meldingen, rapportages, de gemeente en de
   lokale ondernemers. Zelfde vorm als de organisatielaag: `officeAuth` op de
   deur, de echte bevoegdheidsvraag in de kern, per object.

   Afgesplitst van ./index.js omdat de organisatie (steden, zetels, partners,
   projecten) en de uitvoering twee onderwerpen zijn -- en omdat een routebestand
   van veertig regels op een rij niet meer te lezen is als het er tachtig zijn.

   `op()` komt mee uit index.js en is dus letterlijk dezelfde helper: als daar
   ooit een kop, een rem of een logregel bij komt, geldt die hier ook. Twee
   helpers met dezelfde naam en een eigen leven is LAT.md regel 4 in routevorm. */
module.exports = ({ rtfos, op }) => {

  // ---------- vrijwilligers ----------
  op('vrijwilligers', (req, b) => rtfos.vrijwilligers.lijst(req, b.stad, b));
  op('vrijwilliger/maak', (req, b) => rtfos.vrijwilligers.maak(req, b));
  op('vrijwilliger/zet', (req, b) => rtfos.vrijwilligers.zet(req, b.id, b));
  op('vrijwilliger/koppel', (req, b) => rtfos.vrijwilligers.koppel(req, b.id, b.projectId, b.los === true));
  op('vrijwilliger/uren', (req, b) => rtfos.vrijwilligers.urenBoek(req, b.id, b));
  op('vrijwilliger/evaluatie', (req, b) => rtfos.vrijwilligers.evaluatie(req, b.id, b.tekst));

  // ---------- geld: bronnen met een oormerk, uitgaven met vier ogen ----------
  op('geld', (req, b) => rtfos.geld.lijst(req, b.stad));
  op('bron/maak', (req, b) => rtfos.geld.bronMaak(req, b));
  op('bron/verplaats', (req, b) => rtfos.geld.verplaats(req, b.id, b.projectId, b));
  op('uitgave/aanvraag', (req, b) => rtfos.geld.uitgaveAanvraag(req, b));
  op('uitgave/besluit', (req, b) => rtfos.geld.uitgaveBesluit(req, b.id, b.akkoord === true, b.reden));

  // ---------- hulpvragen ----------
  op('casussen', (req, b) => rtfos.casus.lijst(req, b.stad, b));
  op('casus/maak', (req, b) => rtfos.casus.maak(req, b));
  op('casus/status', (req, b) => rtfos.casus.status(req, b.id, b.status, b));
  op('casus/stap', (req, b) => rtfos.casus.stap(req, b.id, b));
  // wie ja zegt mag ook nee zeggen; daarna stopt het werk bij de eerstvolgende
  // stap die toestemming nodig heeft (kern/rtfos/casus.js)
  op('casus/toestemming-weg', (req, b) => rtfos.casus.toestemmingWeg(req, b.id, b.reden));
  // apart, met een eigen auditregel: dit is het moment dat iemand de naam ziet
  op('casus/contact', (req, b) => rtfos.casus.contactOpen(req, b.id));

  // ---------- integriteit ----------
  op('meldingen', (req, b) => rtfos.integriteit.lijst(req, b.stad));
  op('melding/maak', (req, b) => rtfos.integriteit.meld(req, b));
  op('melding/stap', (req, b) => rtfos.integriteit.stap(req, b.id, b.tekst));
  op('melding/sluit', (req, b) => rtfos.integriteit.sluit(req, b.id, b.uitkomst));

  // ---------- impact ----------
  op('rapport', (req, b) => rtfos.rapport.stadRapport(req, b.stad));
  op('rapport/landelijk', req => rtfos.rapport.landelijk(req));

  // ---------- gemeenten ----------
  op('gemeenten', (req, b) => rtfos.gemeente.lijst(req, b.stad));
  op('gemeente/maak', (req, b) => rtfos.gemeente.maak(req, b));
  op('gemeente/opdracht', (req, b) => rtfos.gemeente.opdrachtZet(req, b.id, b));

  // ---------- lokale ondernemers ----------
  op('ondernemers', (req, b) => rtfos.ondernemers.lijst(req, b.stad));
  op('ondernemer/maak', (req, b) => rtfos.ondernemers.maak(req, b));
  op('ondernemer/aanbod', (req, b) => rtfos.ondernemers.aanbodMaak(req, b.id, b));
  op('ondernemer/koppel', (req, b) => rtfos.ondernemers.koppel(req, b.id, b.aanbodId, b.projectId));
  op('ondernemer/aanbod-status', (req, b) => rtfos.ondernemers.aanbodStatus(req, b.id, b.aanbodId, b.status));
};
