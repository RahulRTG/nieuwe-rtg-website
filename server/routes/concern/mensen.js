/* Concern (deelmodule): DE MENSEN -- dienstverbanden, uitnodigen, rechten.

   Afgesplitst van ../concern.js dat over de 10 kB ging. De naad is inhoudelijk
   en niet cosmetisch: daar staat het BEDRIJF (entiteit, vestiging, juridische
   feiten), hier de MENSEN die erin werken. Twee onderwerpen die elkaars
   eigendomscontrole delen maar verder niets.

   DE ACCEPTEER-ROUTE IS DE ENIGE DIE NIET OM EEN ENTITEIT VRAAGT, en dat is met
   opzet. Wie een uitnodiging accepteert heeft nog geen enkele band met dat
   bedrijf -- zou hij eerst moeten bewijzen dat hij erbij hoort, dan kon niemand
   ooit ergens beginnen. Wat hem binnenlaat is de code, en die is eenmalig. */
module.exports = (kern, hulp) => {
  const { app, auth, employmentVind, employmentNieuw, employmentBeeindig, employmentZet,
    employmentVanEntiteit, employmentVanPersoon, employmentOpDatum, employmentOrganigram,
    uitnodigingNieuw, uitnodigingAccepteer, uitnodigingIntrek, uitnodigingVind,
    uitnodigingVanEntiteit, uitnodigingBulk, uitnodigingBulkVerstuur,
    scopeMag, scopeFunctiescheiding, kwalificatieZet, kwalificatiesVan,
    werkOverzicht, entiteitVind } = kern;
  const { mijn, stuur, nietGevonden } = hulp;

  /* ---- wat IK zelf heb ----
     Geen entiteit-eis: dit gaat over de aanvrager zelf. De codenaam komt uit de
     sessie, dus niemand leest andermans werkplekken. */
  app.post('/api/concern/mijnwerk', auth, (req, res) => {
    res.json(werkOverzicht(req.session.key));
  });

  /* ---- uitnodigen ---- */
  app.post('/api/concern/uitnodigen', auth, (req, res) => {
    const e = mijn(req);
    if (!e) return stuur(res, nietGevonden);
    stuur(res, uitnodigingNieuw(req.session.key, Object.assign({}, req.body, { entiteit: e.id })));
  });

  app.post('/api/concern/uitnodigingen', auth, (req, res) => {
    const e = mijn(req);
    if (!e) return stuur(res, nietGevonden);
    res.json({ ok: true, uitnodigingen: uitnodigingVanEntiteit(e.id) });
  });

  /* ACCEPTEREN. `persoon` komt uit de GEVERIFIEERDE sessie en nooit uit het
     lichaam -- anders accepteert de een op naam van de ander. Dezelfde regel als
     bij ondernemingAanvraag(). */
  app.post('/api/concern/uitnodiging/accepteer', auth, (req, res) => {
    stuur(res, uitnodigingAccepteer(String((req.body || {}).code || ''), req.session.key));
  });

  app.post('/api/concern/uitnodiging/intrek', auth, (req, res) => {
    const u = uitnodigingVind(String((req.body || {}).uitnodiging || ''));
    if (!u) return stuur(res, { status: 404, error: 'Deze uitnodiging bestaat niet.' });
    const e = entiteitVind(u.entiteit);
    if (!e || e.eigenaar !== req.session.key) return stuur(res, nietGevonden);
    stuur(res, uitnodigingIntrek(u));
  });

  /* Bulk in twee stappen: eerst wat er uit het bestand komt (met de
     twijfelgevallen apart), dan pas versturen. 1.464 uitnodigingen is een
     handeling met gevolgen voor 1.464 mensen -- wet 5. */
  app.post('/api/concern/bulk/lees', auth, (req, res) => {
    const e = mijn(req);
    if (!e) return stuur(res, nietGevonden);
    stuur(res, uitnodigingBulk(req.session.key, e.id, (req.body || {}).regels));
  });

  app.post('/api/concern/bulk/verstuur', auth, (req, res) => {
    const e = mijn(req);
    if (!e) return stuur(res, nietGevonden);
    stuur(res, uitnodigingBulkVerstuur(req.session.key, e.id, (req.body || {}).voorstel));
  });

  /* ---- dienstverbanden ---- */
  app.post('/api/concern/mensen', auth, (req, res) => {
    const e = mijn(req);
    if (!e) return stuur(res, nietGevonden);
    const b = req.body || {};
    res.json({ ok: true,
      mensen: b.op ? employmentOpDatum(e.id, b.op) : employmentVanEntiteit(e.id, !!b.ookOud),
      op: b.op || null });
  });

  app.post('/api/concern/mens/nieuw', auth, (req, res) => {
    const e = mijn(req);
    if (!e) return stuur(res, nietGevonden);
    stuur(res, employmentNieuw(Object.assign({}, req.body, { entiteit: e.id })));
  });

  /* Een dienstverband is van een entiteit; de eigendomscontrole loopt daarlangs
     en niet langs het dienstverband zelf. Anders zou een employment-id uit het
     lichaam genoeg zijn om andermans personeel te ontslaan. */
  function mijnEmployment(req) {
    const emp = employmentVind(String((req.body || {}).employment || ''));
    if (!emp) return null;
    const e = entiteitVind(emp.entiteit);
    if (!e || e.eigenaar !== req.session.key) return null;
    return emp;
  }

  app.post('/api/concern/mens/zet', auth, (req, res) => {
    const emp = mijnEmployment(req);
    if (!emp) return stuur(res, nietGevonden);
    stuur(res, employmentZet(emp, req.body || {}));
  });

  app.post('/api/concern/mens/uitdienst', auth, (req, res) => {
    const emp = mijnEmployment(req);
    if (!emp) return stuur(res, nietGevonden);
    stuur(res, employmentBeeindig(emp, (req.body || {}).per));
  });

  /* Het organigram wordt niet getekend maar gevolgd uit de dienstverbanden. */
  app.post('/api/concern/organigram', auth, (req, res) => {
    const e = mijn(req);
    if (!e) return stuur(res, nietGevonden);
    res.json(Object.assign({ ok: true }, employmentOrganigram(e.id)));
  });

  /* ---- rechten ----
     Deze route VERLEENT NIETS. Zij antwoordt op "mag deze persoon dit, hier?"
     en geeft de uitleg mee -- ook bij ja. Een systeem dat niet kan zeggen waarom
     iemand ergens NIET bij kan, leert mensen rechten stapelen tot het werkt. */
  app.post('/api/concern/mag', auth, (req, res) => {
    const e = mijn(req);
    if (!e) return stuur(res, nietGevonden);
    const b = req.body || {};
    const doel = b.doel && b.doel.soort ? b.doel : { soort: 'entiteit', id: e.id };
    /* De uitslag gaat ONGEWIJZIGD de deur uit. Er stond hier even een `ok: true`
       omheen, en dat is precies verkeerd: scopeMag() draagt zijn eigen `ok`, en
       een tweede eromheen maakt van "mag niet" een geslaagd antwoord. */
    res.json(scopeMag(String(b.persoon || ''), String(b.recht || ''), doel,
      { kwalificatie: b.kwalificatie || null }));
  });

  app.post('/api/concern/functiescheiding', auth, (req, res) => {
    const e = mijn(req);
    if (!e) return stuur(res, nietGevonden);
    res.json(Object.assign({ ok: true }, scopeFunctiescheiding(e.id)));
  });

  /* ---- kwalificaties ----
     De rol geeft mogelijke toegang; dit bepaalt de werkelijke. Verloopt er een,
     dan valt het werk weg en blijft de rol staan. */
  app.post('/api/concern/kwalificatie/zet', auth, (req, res) => {
    const e = mijn(req);
    if (!e) return stuur(res, nietGevonden);
    stuur(res, kwalificatieZet(req.body || {}));
  });

  app.post('/api/concern/kwalificaties', auth, (req, res) => {
    const e = mijn(req);
    if (!e) return stuur(res, nietGevonden);
    const b = req.body || {};
    /* Alleen van iemand die hier werkt: kwalificaties van een willekeurige
       codenaam opvragen zou een leesbare persoonslijst opleveren. */
    const persoon = String(b.persoon || '');
    const werkt = employmentVanPersoon(persoon, true).some(x => x.entiteit === e.id);
    if (!werkt) return stuur(res, { status: 404, error: 'Deze persoon werkt hier niet.' });
    res.json({ ok: true, kwalificaties: kwalificatiesVan(persoon) });
  });
};
