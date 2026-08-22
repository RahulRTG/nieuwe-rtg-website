/* Kantoren, deel "reisbureau": de balie achter het RTG-reisbureau.

   Twee helften, en ze horen bij elkaar omdat ze allebei op dezelfde
   auditregel steunen (wie besliste of klaarzette komt uit de SESSIE):

   - het BESLUIT over een reisaanvraag van een lid (bevestigen/afwijzen);
   - het KLAARZETTEN van een reis voor iemand die nog geen lid is, met een
     link als uitkomst -- en zonder dat er iets over die persoon wordt
     bewaard (zie de kop van kern/reisuitnodiging.js).

   Afgesplitst uit kantoren/index.js op de 10 kB-grens. */
module.exports = ({ app, officeAuth, veilig, stuur, afdelingen, kern }) => {

  // de openstaande reisaanvragen (codenamen, nooit echte namen)
  app.post('/api/office/reisbureau', officeAuth, (req, res) => veilig(res, () => kern.reisbureau.aanvragen()));
  /* Het besluit van de reisadviseur: hier wordt "aangevraagd" pas iets anders.
     WIE beslist komt uit de sessie en niet uit de body -- precies de reden die
     hierboven bij de identiteitskluis staat: een spoor dat de aanvrager zelf
     invult is geen spoor. Anoniem binnengekomen op de gedeelde kantoorcode? Dan
     staat dat er ook zo bij, in plaats van een verzonnen adviseursnaam.
     Het besluit gaat ook het kantoor-auditlog in: een reis bevestigen is een
     toezegging aan een lid, en die hoort navraagbaar te zijn. */
  app.post('/api/office/reisbureau/besluit', officeAuth, async (req, res) => {
    const wie = kern.boardroomWie(req) || 'backoffice (gedeelde code)';
    const stand = String(req.body.besluit || '');
    try {
      const r = await kern.reisbureau.besluit(req.body.ref, stand, wie, req.body.bericht);
      if (r.ok) afdelingen.audit(wie, 'Reisbureau: aanvraag ' + r.aanvraag.ref + ' ' + r.aanvraag.status + ' (' + r.aanvraag.titel + ')');
      stuur(res, r);
    } catch (e) { console.error('[kantoren]', e); res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' }); }
  });
  /* De losse ingangen naast /besluit. Ze bestaan omdat het dossier van het lid
     eraan hangt: bevestigen zet de reis daar op bevestigd, afwijzen haalt hem
     eruit (kern/lid/reisdossier.js). De regel eronder is dezelfde als bij
     /besluit -- zie kern/reisbureau.js, waar de gedeelde stappen een keer
     staan -- en het verschil is alleen hoe het bericht aan het lid heet. */
  app.post('/api/office/reisbureau/bevestig', officeAuth, (req, res) =>
    veilig(res, () => kern.reisbureau.bevestig(String((req.body || {}).ref || ''), (req.body || {}).door)));
  app.post('/api/office/reisbureau/afwijzen', officeAuth, async (req, res) => {
    try {
      const r = await kern.reisbureau.wijsAf(String((req.body || {}).ref || ''),
        (req.body || {}).door, (req.body || {}).reden);
      stuur(res, r);
    } catch (e) { console.error('[kantoren]', e); res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' }); }
  });

  /* DE REIS KLAARZETTEN VOOR EEN KLANT (REIZEN.md fase 2, kantoorkant). Het
     reisbureau leest de bevestigingen van een klant voor, zet de reis klaar en
     krijgt een link terug. Er wordt hierbij NIETS over die klant bewaard: geen
     naam, geen e-mailadres, geen telefoonnummer -- de medewerker stuurt de link
     zelf. Waarom dat zo streng is, staat in de kop van kern/reisuitnodiging.js.

     Het voorlezen bewaart ook niets: er is nog geen account om een voorstel aan
     te hangen en geen kluis om een origineel in te leggen. */
  app.post('/api/office/reisbureau/lees', officeAuth, (req, res) => veilig(res, () => kern.invoer.leesVoor((req.body || {}).tekst)));
  app.post('/api/office/reisbureau/klaarzetten', officeAuth, (req, res) => {
    const wie = kern.boardroomWie(req) || 'backoffice (gedeelde code)';
    veilig(res, () => {
      const r = kern.reisuitnodiging.zetKlaar(wie, (req.body || {}).onderdelen);
      if (r.ok) afdelingen.audit(wie, 'Reisbureau: reis klaargezet voor een klant (' +
        (r.uitnodiging.bestemming || 'zonder bestemming') + ', ' + r.uitnodiging.onderdelen.length + ' onderdelen)');
      return r;
    });
  });
  app.post('/api/office/reisbureau/uitnodigingen', officeAuth, (req, res) => veilig(res, () => ({ ok: true, uitnodigingen: kern.reisuitnodiging.lijst('kantoor') })));
  app.post('/api/office/reisbureau/uitnodiging-weg', officeAuth, (req, res) => {
    const wie = kern.boardroomWie(req) || 'backoffice (gedeelde code)';
    veilig(res, () => {
      const r = kern.reisuitnodiging.trekIn('kantoor', (req.body || {}).id);
      if (r.ok) afdelingen.audit(wie, 'Reisbureau: klaargezette reis ingetrokken (' + String((req.body || {}).id) + ')');
      return r;
    });
  });
};
