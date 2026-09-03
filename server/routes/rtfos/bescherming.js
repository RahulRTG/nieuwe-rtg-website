/* Domein "rtfos", deel "bescherming": de tien kantoorroutes van de beschermzaak,
   plus de brug naar de meldcode.

   EEN ANDERE DATAKLASSE EN DUS EEN ANDER PAD. Ze deelden bewust geen enkele
   route met de hulpvraag, en toen ze samen met de casus in een bestand stonden
   was dat verschil alleen nog een kopregel. Nu staan ze apart, en dat is
   dezelfde scheiding als in kern/: een gedeeld pad wordt vanzelf een gedeelde
   export.

   Afgesplitst uit ./uitvoering.js op de 10 KB van keuringsregel 13. */
module.exports = ({ app, officeAuth, rtfos, H }) => {
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

  /* ---------- de weg terug: een beschermzaak die een meldcode blijkt ----------

     DE BRUG STAAT HIER EN NIET IN EEN VAN DE TWEE MODULES, en dat is het punt.
     kern/beschermzaak/ is de enige die in de beschermzaken schrijft; kern/rtfos/
     meldcode.js is de enige die meldcode-dossiers maakt. Zou een van beide de
     ander aanroepen, dan is een van die twee zinnen niet meer waar -- en de
     scheiding tussen de klassen is precies wat test/beschermzaak.test.js
     bewaakt. Hier zijn ze allebei bereikbaar zonder dat een van beide de ander
     hoeft te laden.

     WAT ER MEEREIST IS EEN CODENAAM. De meldcode haalt hem zelf op uit de zaak
     (kern/rtfos/meldcode-herkomst.js) en neemt verder niets over: geen
     omschrijving, geen veiligheidsantwoord, geen toestemming. En de AARD komt
     uit de aanleiding van de zaak, niet uit dit verzoek -- een uitbuitingszaak
     kan hier dus niet als "huiselijk geweld" doorheen.

     DE NOTITIE TERUG IS BEST EFFORT, en met opzet in die volgorde: het dossier
     bestaat dan al. Mislukt het noteren, dan is er een meldcode zonder verwijzing
     terug -- hinderlijk. Andersom zou er een verwijzing staan naar een dossier
     dat niet bestaat, en dat is erger. */
  app.post('/api/rtfos/bescherming/meldcode', officeAuth, H((req, b) => {
    const m = rtfos.meldcode.open(req, { stad: b.stad, beschermzaakId: b.id,
      betreft: b.betreft, aandachtsfunctionaris: b.aandachtsfunctionaris });
    if (!m.ok) return m;
    const terug = rtfos.beschermzaak.noteerMeldcode(req, b.id, m.dossier.id);
    return { ok: true, dossier: m.dossier, zaak: terug.ok ? terug.zaak : null,
      melding: 'Meldcode-dossier geopend als ' + m.dossier.aard + '. Alleen de codenaam is meegegaan; ' +
        'de inhoud van de beschermzaak blijft waar hij staat.' +
        (terug.ok ? '' : ' Let op: de verwijzing terug op de zaak is NIET gelukt.') };
  }));
};
