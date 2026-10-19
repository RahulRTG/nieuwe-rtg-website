/* Routes "concern" (deel): DE RECHTEN EN KWALIFICATIES -- mag deze persoon dit,
   hier, en waarom (niet).

   Afgesplitst van ./mensen.js. De naad is inhoudelijk: daar staat wie er WERKT
   (uitnodigen, dienstverbanden, organigram); hier wat zo iemand MAG. De rol
   geeft mogelijke toegang, de kwalificatie de werkelijke -- en geen van deze
   routes verleent iets zonder dat de persoon bij deze entiteit werkt. */
'use strict';

module.exports = (kern, { mijn, stuur, nietGevonden }) => {
  const { app, auth, employmentVanPersoon, scopeMag, scopeFunctiescheiding,
    kwalificatieZet, kwalificatiesVan } = kern;

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
      /* `binnen`: anders las een eigenaar via `bijna` iemands rollen bij ANDERE werkgevers. */
      { kwalificatie: b.kwalificatie || null, binnen: e.id }));
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
    /* Alleen op iemand die hier werkt -- dezelfde zeef als de leesroute
       hieronder. Zonder deze regel zette een eigen entiteit een kwalificatie
       (de werkelijke toegang) op een willekeurige persoon (test/concern-routes.test.js). */
    const persoon = String((req.body || {}).persoon || '');
    const werkt = employmentVanPersoon(persoon, true).some(x => x.entiteit === e.id);
    if (!werkt) return stuur(res, { status: 404, error: 'Deze persoon werkt hier niet.' });
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
