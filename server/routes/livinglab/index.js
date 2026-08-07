/* Domein "livinglab": de routes van het RTF Living Lab achter de kantoorinlog
   (RTG- en RTF-personeel delen die deur). De publieke kant -- de bewoner met
   zijn labpas, de vragen uit de buurt, de klachtenprocedure -- staat in
   ./bewoner.js, want die deuren gaan op een CODE open en hebben een rem nodig
   die meer uitleg vraagt dan de routes zelf.

   DE KIJKER. Elke leesroute geeft een `kijker` mee aan de kern, en die bepaalt
   welke van de drie ringen iemand ziet (zie de kop van kern/livinglab/studie.js).
   Personeel achter deze deur is `staf: true` en ziet het hele dossier. Dat is
   hier verdedigbaar omdat het lab van de stichting is en de staf hem beheert --
   maar het is NIET vrijblijvend: elke inzage in een gescheiden studie loopt langs
   het auditspoor, zodat achteraf te zien is wie wat heeft geopend.

   WAT HIER NIET STAAT, met opzet: geen enkele route die een ethische review
   tekent, een risicoklasse verlaagt of een bewijsgraad optilt ZONDER de naam van
   een mens in het lijf. Die namen worden in de kern getoetst tegen het
   tekenaarsregister van het lab; deze laag geeft ze alleen door. Een route die
   `door` uit de sessie zou afleiden, maakt van elke ingelogde medewerker een
   tekenbevoegde -- en dat is precies de sluiproute die de hele ethieklaag
   waardeloos maakt. */
'use strict';

module.exports = (kern) => {
  const { app, officeAuth, boardroomWie, livinglab } = kern;

  const stuur = (res, r) => (r && r.error) ? res.status(r.status || 400).json(r) : res.json(r);
  const veilig = (res, werk) => {
    try { stuur(res, werk()); }
    catch (e) { console.error('[livinglab]', e); res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' }); }
  };
  const veiligAsync = async (res, werk) => {
    try { stuur(res, await werk()); }
    catch (e) { console.error('[livinglab]', e); res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' }); }
  };
  // wie is dit, voor het auditspoor en de logboekregels
  const wie = req => boardroomWie(req) || 'kantoor';
  const staf = () => ({ staf: true });
  const id = req => String((req.body || {}).id || '');

  /* ---------- het kader ----------
     De cyclus, de methoden, de risicoklassen en de bewijsgraden zoals de kern ze
     kent. Het scherm bouwt zijn keuzelijsten hieruit en nergens anders uit, zodat
     er geen stap of methode in beeld kan staan die de server niet accepteert. */
  app.post('/api/lab2/kader', officeAuth, (req, res) => veilig(res, () => livinglab.kaderVoorScherm()));

  /* ---------- labs (bestuur) ---------- */
  app.post('/api/lab2/labs', officeAuth, (req, res) => veilig(res, () => livinglab.bestuur.labs()));
  app.post('/api/lab2/lab/maak', officeAuth, (req, res) => veilig(res, () => livinglab.bestuur.labMaak(req.body, wie(req))));
  app.post('/api/lab2/lab/zet', officeAuth, (req, res) => veilig(res, () => livinglab.bestuur.labZet(id(req), req.body, wie(req))));
  app.post('/api/lab2/lab/tekenaar', officeAuth, (req, res) => veilig(res, () => livinglab.bestuur.tekenaarZet(id(req), req.body, wie(req))));
  app.post('/api/lab2/lab/budget', officeAuth, (req, res) => veilig(res, () => livinglab.bestuur.budgetZet(id(req), req.body, wie(req))));
  app.post('/api/lab2/lab/partner', officeAuth, (req, res) => veilig(res, () => livinglab.bestuur.partnerZet(id(req), req.body, wie(req))));
  app.post('/api/lab2/lab/audit', officeAuth, (req, res) => veilig(res, () => livinglab.bestuur.auditlog(id(req), (req.body || {}).over, (req.body || {}).max)));

  /* ---------- studies en de cyclus ---------- */
  app.post('/api/lab2/overzicht', officeAuth, (req, res) => veilig(res, () => livinglab.studie.overzicht(id(req), staf())));
  app.post('/api/lab2/studie', officeAuth, (req, res) => veilig(res, () => livinglab.studie.studie(id(req), staf())));
  app.post('/api/lab2/studie/maak', officeAuth, (req, res) => veilig(res, () => livinglab.studie.studieMaak(req.body, wie(req))));
  app.post('/api/lab2/studie/vraagstuk', officeAuth, (req, res) => veilig(res, () => livinglab.studie.vraagstukZet(id(req), req.body, wie(req))));
  app.post('/api/lab2/studie/stap', officeAuth, (req, res) => veilig(res, () => livinglab.cyclus.stapZet(id(req), req.body, wie(req))));
  app.post('/api/lab2/studie/watnu', officeAuth, (req, res) => veilig(res, () => livinglab.cyclus.watNu(id(req))));
  app.post('/api/lab2/studie/besluit', officeAuth, (req, res) => veilig(res, () => livinglab.cyclus.besluitZet(id(req), req.body, wie(req))));

  /* ---------- hypothese, plan en bronnen ---------- */
  app.post('/api/lab2/plan/hypothese', officeAuth, (req, res) => veilig(res, () => livinglab.plan.hypotheseZet(id(req), req.body, wie(req))));
  app.post('/api/lab2/plan/zet', officeAuth, (req, res) => veilig(res, () => livinglab.plan.planZet(id(req), req.body, wie(req))));
  // het advies vóór het plan: wat de gekozen methoden aan steekproef en
  // meetmomenten vragen. Zelfde rekenwerk als de poort, dus het scherm kan niets
  // voorstellen wat straks alsnog wordt geweigerd.
  app.post('/api/lab2/plan/advies', officeAuth, (req, res) => veilig(res, () => livinglab.plan.advies((req.body || {}).methoden)));
  app.post('/api/lab2/plan/bron', officeAuth, (req, res) => veilig(res, () => livinglab.plan.bronZet(id(req), req.body, wie(req))));
  app.post('/api/lab2/plan/bron-natrek', officeAuth, (req, res) => veilig(res, () => livinglab.plan.bronNatrek(id(req), req.body, wie(req))));

  /* ---------- ethiek ---------- */
  app.post('/api/lab2/ethiek/klasse', officeAuth, (req, res) => veilig(res, () => livinglab.ethiek.klasseZet(id(req), req.body, wie(req))));
  app.post('/api/lab2/ethiek/review', officeAuth, (req, res) => veilig(res, () => livinglab.ethiek.reviewTeken(id(req), req.body, wie(req))));
  app.post('/api/lab2/ethiek/privacy', officeAuth, (req, res) => veilig(res, () => livinglab.ethiek.privacytoets(id(req), req.body, wie(req))));
  app.post('/api/lab2/ethiek/toestemming', officeAuth, (req, res) => veilig(res, () => livinglab.ethiek.toestemmingZet(id(req), req.body, wie(req))));
  app.post('/api/lab2/ethiek/stopcriterium', officeAuth, (req, res) => veilig(res, () => livinglab.ethiek.stopcriteriumZet(id(req), req.body, wie(req))));
  app.post('/api/lab2/ethiek/stilleggen', officeAuth, (req, res) => veilig(res, () => livinglab.ethiek.stilleggen(id(req), req.body, wie(req))));
  app.post('/api/lab2/ethiek/klacht-af', officeAuth, (req, res) => veilig(res, () => livinglab.ethiek.klachtAf(id(req), req.body, wie(req))));

  /* De rest van het kantoorwerk -- deelnemers, bewijs, werkplaats, apparatuur,
     de pijplijn, impact en de coach -- staat in ./werk.js. Ze delen dit
     hulpgereedschap zodat er één foutafhandeling en één kijker-begrip is; twee
     varianten van `veilig()` is hoe de ene helft van een domein stil 500's gaat
     teruggeven waar de andere netjes een 400 geeft. */
  const hulp = { stuur, veilig, veiligAsync, wie, staf, id };
  require('./werk')(kern, hulp);
  require('./bewoner')(kern, hulp);
};
