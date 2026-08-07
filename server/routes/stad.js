/* Domein "stad": RTG Stad voor de BEWONER (de app "Mijn Stad" in het leden-OS).
   Kijken mag met elke ingelogde sessie, ook de gratis laag: de stad is van
   iedereen. Melden vraagt een RTG-profiel (codenaam), zodat de melder zijn
   eigen melding kan volgen en de veldploeg een aanspreekpunt heeft -- op
   pseudoniem, zoals alles in het huis. */
module.exports = (kern) => {
  const { app, auth, liveCodename, stad } = kern;
  const stuur = (res, r) => r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(r);
  const cn = req => liveCodename(req.session);

  // het bewonersbeeld: standen, scenario, waarschuwingen en mijn meldingen
  app.post('/api/stad/bewoner', auth, (req, res) => stuur(res, stad.stadBewonerBeeld(cn(req))));

  // iets melden dat stuk of vol is; het staat direct op de veldwerk-lijst
  app.post('/api/stad/melding', auth, (req, res) => {
    if (req.session.tier === 'guest') return res.status(403).json({ error: 'Melden kan met een RTG-profiel; meekijken mag altijd.' });
    stuur(res, stad.stadBewonerMeld({ codenaam: cn(req), zone: req.body.zone, soort: req.body.soort, tekst: req.body.tekst }));
  });

  /* HET ALGORITMEREGISTER, EN HET IS MET OPZET OPENBAAR.

     Welke rekenregels er in de stad meedraaien, wat ze mogen beslissen, welke
     gegevens ze gebruiken en waar ze de mist in gaan -- dat is precies de
     informatie waar een inwoner recht op heeft, en een register dat alleen
     achter de kantoorinlog staat geeft hem niets. Vandaar geen `auth`: dit is
     een publieke pagina zoals het privacybeleid dat ook is.

     Er staat niets persoonlijks in en niets dat over een individu gaat: het
     register beschrijft regels, geen mensen. Dat het niet achter een poort
     staat, is dus geen versoepeling maar de bedoeling. */
  app.post('/api/stad/algoritmes', (req, res) => stuur(res, kern.weefsel.weefselAlgoritmes()));
  app.get('/api/stad/algoritmes', (req, res) => stuur(res, kern.weefsel.weefselAlgoritmes()));

  /* HET BESLUITENREGISTER, om dezelfde reden openbaar als het
     algoritmeregister. Wat een stad besluit, met welke stemverhouding, tegen
     welk advies in en voor hoeveel geld, is geen bedrijfsinformatie maar de
     kern van waarom een inwoner er iets over te zeggen heeft. Er staan geen
     personen in: fracties stemmen met zetels, en een collegestem draagt een
     functie en geen dossier. */
  app.post('/api/stad/besluiten', (req, res) => stuur(res, kern.weefsel.weefselBesluiten({
    orgaan: req.body && req.body.orgaan, status: req.body && req.body.status })));
  app.get('/api/stad/besluiten', (req, res) => stuur(res, kern.weefsel.weefselBesluiten({})));

  /* Meepraten. Kijken mag met elke sessie; REAGEREN vraagt een RTG-profiel,
     want een raadpleging waarin dezelfde persoon twintig keer kan antwoorden
     meet niets. Eén reactie per codenaam, te wijzigen zolang hij loopt. */
  app.post('/api/stad/raadplegingen', auth, (req, res) => stuur(res, kern.weefsel.weefselRaadplegingen({
    codenaam: cn(req), alleenOpen: req.body.alleenOpen === true })));
  app.post('/api/stad/raadpleging/reageer', auth, (req, res) => {
    if (req.session.tier === 'guest') return res.status(403).json({ error: 'Meepraten kan met een RTG-profiel; meelezen mag altijd.' });
    stuur(res, kern.weefsel.weefselReageer({ raadplegingId: req.body.id, codenaam: cn(req),
      keuze: req.body.keuze, tekst: req.body.tekst, zone: req.body.zone }));
  });
};
