/* Domein "livinglab", deel "werk": het kantoorwerk rondom een onderzoek --
   deelnemers, de bewijsmotor, de werkplaats, de apparatuur, de pijplijn naar
   verandering, de impactcijfers en de onderzoekscoach.

   ./index.js ernaast doet het onderzoek zelf: het kader, de labs, de studies,
   de cyclus, het plan en de ethiek. Afgesplitst toen dat bestand de 10 KB
   passeerde; de naad zit tussen "wat is dit onderzoek" en "wat gebeurt eromheen".

   Beide helften krijgen dezelfde `hulp` mee (stuur, veilig, veiligAsync, wie,
   staf, id) en delen daarmee één foutafhandeling en één kijker-begrip. Twee
   eigen varianten daarvan is precies hoe de ene helft van een domein stil een
   500 gaat teruggeven waar de andere een nette 400 geeft. */
'use strict';

module.exports = (kern, hulp) => {
  const { app, officeAuth, livinglab } = kern;
  const { veilig, veiligAsync, wie, staf, id } = hulp;

  /* ---------- deelnemers en rollen ---------- */
  app.post('/api/lab2/mens/bij', officeAuth, (req, res) => veilig(res, () => livinglab.mensen.deelnemerBij(id(req), req.body, wie(req))));
  app.post('/api/lab2/mens/weg', officeAuth, (req, res) => veilig(res, () => livinglab.mensen.deelnemerWeg(id(req), req.body, wie(req))));
  app.post('/api/lab2/mens/rol', officeAuth, (req, res) => veilig(res, () => livinglab.mensen.rolZet(id(req), req.body, wie(req))));
  app.post('/api/lab2/themas', officeAuth, (req, res) => veilig(res, () => livinglab.themas.themas(id(req))));
  app.post('/api/lab2/thema/koppel', officeAuth, (req, res) => veilig(res, () =>
    livinglab.themas.themaKoppel((req.body || {}).themaId, (req.body || {}).studieId, wie(req))));

  /* ---------- de bewijsmotor ---------- */
  app.post('/api/lab2/bewijs/observatie', officeAuth, (req, res) => veilig(res, () => livinglab.bewijs.observatieBij(id(req), req.body, wie(req))));
  app.post('/api/lab2/bewijs/dataset', officeAuth, (req, res) => veilig(res, () => livinglab.bewijs.datasetBij(id(req), req.body, wie(req))));
  app.post('/api/lab2/bewijs/conclusie', officeAuth, (req, res) => veilig(res, () => livinglab.bewijs.conclusieBij(id(req), req.body, wie(req))));
  app.post('/api/lab2/bewijs/koppel', officeAuth, (req, res) => veilig(res, () => livinglab.bewijs.bewijsKoppel(id(req), req.body, wie(req))));
  app.post('/api/lab2/bewijs/graad', officeAuth, (req, res) => veilig(res, () => livinglab.bewijs.graadZet(id(req), req.body, wie(req))));
  app.post('/api/lab2/bewijs/reflectie', officeAuth, (req, res) => veilig(res, () => livinglab.bewijs.reflectieBij(id(req), req.body, wie(req))));

  /* ---------- de werkplaats ---------- */
  app.post('/api/lab2/werk/taak', officeAuth, (req, res) => veilig(res, () => livinglab.werkplaats.taakBij(id(req), req.body, wie(req))));
  app.post('/api/lab2/werk/taak-zet', officeAuth, (req, res) => veilig(res, () => livinglab.werkplaats.taakZet(id(req), req.body, wie(req))));
  app.post('/api/lab2/werk/document', officeAuth, (req, res) => veilig(res, () => livinglab.werkplaats.documentBij(id(req), req.body, wie(req))));
  app.post('/api/lab2/werk/log', officeAuth, (req, res) => veilig(res, () => livinglab.werkplaats.logBij(id(req), req.body, wie(req))));
  app.post('/api/lab2/werk/besluit', officeAuth, (req, res) => veilig(res, () => livinglab.werkplaats.besluitBij(id(req), req.body, wie(req))));
  app.post('/api/lab2/werk/agenda', officeAuth, (req, res) => veilig(res, () => livinglab.werkplaats.agenda(id(req), staf())));

  /* ---------- apparatuur ---------- */
  app.post('/api/lab2/app/lijst', officeAuth, (req, res) => veilig(res, () => livinglab.apparatuur.apparatuur(id(req))));
  app.post('/api/lab2/app/maak', officeAuth, (req, res) => veilig(res, () => livinglab.apparatuur.apparaatBij(req.body, wie(req))));
  app.post('/api/lab2/app/bevoegd', officeAuth, (req, res) => veilig(res, () => livinglab.apparatuur.bevoegdZet(id(req), req.body, wie(req))));
  app.post('/api/lab2/app/kalibratie', officeAuth, (req, res) => veilig(res, () => livinglab.apparatuur.kalibratieZet(id(req), req.body, wie(req))));
  app.post('/api/lab2/app/onderhoud', officeAuth, (req, res) => veilig(res, () => livinglab.apparatuur.onderhoudBij(id(req), req.body, wie(req))));
  app.post('/api/lab2/app/storing-op', officeAuth, (req, res) => veilig(res, () => livinglab.apparatuur.storingOp(id(req), req.body, wie(req))));
  app.post('/api/lab2/app/reserveer', officeAuth, (req, res) => veilig(res, () => livinglab.apparatuur.reserveer(req.body, wie(req))));
  app.post('/api/lab2/app/reservering-weg', officeAuth, (req, res) => veilig(res, () => livinglab.apparatuur.reserveringWeg(req.body, wie(req))));
  app.post('/api/lab2/app/uitgifte', officeAuth, (req, res) => veilig(res, () => livinglab.apparatuur.uitgifte(req.body, wie(req))));

  /* ---------- van onderzoek naar verandering ---------- */
  app.post('/api/lab2/uit/maak', officeAuth, (req, res) => veilig(res, () => livinglab.doorbraak.uitgangBij(id(req), req.body, wie(req))));
  app.post('/api/lab2/uit/status', officeAuth, (req, res) => veilig(res, () => livinglab.doorbraak.uitgangZet(id(req), req.body, wie(req))));
  app.post('/api/lab2/uit/naar-lab', officeAuth, (req, res) => veilig(res, () => livinglab.doorbraak.naarLab(id(req), req.body, wie(req))));
  app.post('/api/lab2/uit/vervolg', officeAuth, (req, res) => veilig(res, () => livinglab.doorbraak.vervolgStudie(id(req), req.body, wie(req))));
  app.post('/api/lab2/uit/pijplijn', officeAuth, (req, res) => veilig(res, () => livinglab.doorbraak.pijplijn(id(req))));

  /* ---------- impact ---------- */
  app.post('/api/lab2/impact', officeAuth, (req, res) => veilig(res, () => livinglab.impact.impact(id(req))));
  app.post('/api/lab2/opbrengst', officeAuth, (req, res) => veilig(res, () => livinglab.impact.opbrengst(id(req), (req.body || {}).max)));

  /* ---------- de coach ----------
     Asynchroon, want hij kan een AI-aanbieder aanroepen. Zonder sleutel geeft
     hij het vaste advies dat bij de huidige stap hoort -- geen foutmelding, want
     een team zonder AI-sleutel moet dit systeem gewoon kunnen gebruiken. */
  app.post('/api/lab2/coach', officeAuth, (req, res) => veiligAsync(res, () => livinglab.ai.coach(id(req), (req.body || {}).vraag)));
  app.post('/api/lab2/coach/conclusie', officeAuth, (req, res) => veiligAsync(res, () => livinglab.ai.conclusieVoorstel(id(req), (req.body || {}).vraag, wie(req))));
  app.post('/api/lab2/coach/methoden', officeAuth, (req, res) => veilig(res, () =>
    livinglab.ai.methodeAdvies((req.body || {}).soort, (req.body || {}).ambitie)));
};
