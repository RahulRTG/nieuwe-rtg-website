/* Routes "concern": RTG Concern -- het Company Launch & Workforce OS.
   Zie CONCERN.md voor de doctrine; dit bestand is alleen de deur.

   ALLES LOOPT LANGS `mijn()`. De entiteit moet bestaan EN van de ingelogde
   eigenaar zijn. Dat is een eigendomscontrole op het DOEL en niet op de
   aanvrager (LAT-regel 7): een id uit het lichaam is nooit een bewijs. Dezelfde
   vorm als routes/member/onderneming.js, en om dezelfde reden -- daar is die
   controle een keer vergeten en lekte het hele Ondernemers-OS erdoorheen.

   ÉÉN 404 VOOR "BESTAAT NIET" EN "NIET VAN JOU". Het verschil zou verklappen
   welke id's bestaan.

   De mensenkant (dienstverbanden, uitnodigen, rechten) staat in
   ./concern/mensen.js en de veranderkant in ./concern/verandering.js: dit
   bestand ging over de 10 kB van het modulebeleid, en dat is de goede naad --
   hier het bedrijf, daar de mensen, daar de verbouwing. */
module.exports = (kern) => {
  const { app, auth, accounts, concernNieuw, concernZet, concernBoom, concernUbo,
    concernBelangen, concernMagTekenen, concernGeraaktDoorVerloop, concernReadiness,
    concernLaunch, concernOverzicht, concernHangtAan, entiteitVind, entiteitNieuw,
    entiteitVanEigenaar, entiteitBeeld, entiteitRegistratie, entiteitOnderneming,
    entiteitGeschiedenis, entiteitVerwijder, ondernemingVind, tijdZet, tijdBeeindig,
    tijdOpDatum, vestigingNieuw, vestigingVind, vestigingUnit, vestigingUnitLos,
    vestigingSluit, vestigingBeeld, vestigingAlleVanEntiteit } = kern;

  /* Zoals in routes/member/onderneming.js: een kernmodule mag een domeinstand in
     `status` zetten, en res.status() weigert een niet-numerieke code. Alleen een
     echte HTTP-code telt als code. */
  const httpCode = (v) => (Number.isInteger(v) && v >= 100 && v <= 599 ? v : 200);
  const stuur = (res, r) => res.status(httpCode(r && r.status)).json(r);

  const nietGevonden = { status: 404, error: 'Deze entiteit staat niet op uw naam.' };
  function mijn(req) {
    const e = entiteitVind(String((req.body || {}).entiteit || ''));
    if (!e || e.eigenaar !== req.session.key) return null;
    return e;
  }
  /* De vestiging moet bij een entiteit van deze aanvrager horen. Zonder deze
     tweede stap zou een vestiging-id uit het lichaam genoeg zijn om aan
     andermans vestiging te komen -- dezelfde fout, een niveau lager. */
  function mijnVestiging(req) {
    const v = vestigingVind(String((req.body || {}).vestiging || ''));
    if (!v) return null;
    const e = entiteitVind(v.entiteit);
    if (!e || e.eigenaar !== req.session.key) return null;
    return v;
  }

  /* ---- het geheel ---- */
  app.post('/api/concern/overzicht', auth, (req, res) => {
    res.json(concernOverzicht(req.session.key));
  });

  app.post('/api/concern/nieuw', auth, (req, res) => {
    stuur(res, concernNieuw(req.session.key, req.body || {}));
  });

  app.post('/api/concern/boom', auth, (req, res) => {
    const b = req.body || {};
    /* De boom van een groep waar geen enkele entiteit van deze aanvrager in
       zit, is niet zijn boom. Zonder deze controle leest iedereen elke groep. */
    const eigen = entiteitVanEigenaar(req.session.key).some(e => e.concern === String(b.concern || ''));
    if (!eigen) return stuur(res, { status: 404, error: 'Deze groep staat niet op uw naam.' });
    res.json(concernBoom(String(b.concern), b.op));
  });

  /* ---- de entiteit ---- */
  app.post('/api/concern/entiteiten', auth, (req, res) => {
    res.json({ ok: true, entiteiten: entiteitVanEigenaar(req.session.key).map(e => entiteitBeeld(e)) });
  });

  app.post('/api/concern/entiteit/nieuw', auth, (req, res) => {
    stuur(res, entiteitNieuw(req.session.key, Object.assign({}, req.body, { wie: req.session.key })));
  });

  app.post('/api/concern/entiteit', auth, (req, res) => {
    const e = mijn(req);
    if (!e) return stuur(res, nietGevonden);
    res.json({ ok: true, entiteit: entiteitBeeld(e, (req.body || {}).op) });
  });

  app.post('/api/concern/entiteit/groep', auth, (req, res) => {
    const e = mijn(req);
    if (!e) return stuur(res, nietGevonden);
    stuur(res, concernZet(e, (req.body || {}).concern ?? null));
  });

  app.post('/api/concern/entiteit/registratie', auth, (req, res) => {
    const e = mijn(req);
    if (!e) return stuur(res, nietGevonden);
    stuur(res, entiteitRegistratie(e, Object.assign({}, req.body, { wie: req.session.key })));
  });

  /* De bestaande onderneming aanwijzen. Het bewijs komt uit de SESSIE en niet
     uit het lichaam: alleen de eigenaar van die onderneming mag hem onder zijn
     eigen entiteit hangen. */
  app.post('/api/concern/entiteit/onderneming', auth, (req, res) => {
    const e = mijn(req);
    if (!e) return stuur(res, nietGevonden);
    const magKoppelen = (id) => {
      const o = ondernemingVind(id);
      return !!(o && o.eigenaar === req.session.key);
    };
    stuur(res, entiteitOnderneming(e, (req.body || {}).onderneming, magKoppelen));
  });

  app.post('/api/concern/entiteit/verwijder', auth, (req, res) => {
    const e = mijn(req);
    if (!e) return stuur(res, nietGevonden);
    stuur(res, entiteitVerwijder(e, concernHangtAan));
  });

  /* ---- de juridische feiten (de tijdmachine) ----
     Elk feit draagt een bron; ./kern/concern/bron.js weigert het zonder. `wie`
     komt uit de sessie zodat het spoor op een codenaam staat en niet op iets
     wat de aanvrager zelf mag verzinnen. */
  app.post('/api/concern/feit/zet', auth, (req, res) => {
    const e = mijn(req);
    if (!e) return stuur(res, nietGevonden);
    const b = req.body || {};
    stuur(res, tijdZet(e.id, String(b.soort || ''), Object.assign({}, b, { wie: req.session.key })));
  });

  app.post('/api/concern/feit/beeindig', auth, (req, res) => {
    const e = mijn(req);
    if (!e) return stuur(res, nietGevonden);
    const b = req.body || {};
    stuur(res, tijdBeeindig(String(b.feit || ''), b.tot, Object.assign({}, b, { wie: req.session.key })));
  });

  /* DE TIJDMACHINE ZELF: geef een datum en je krijgt de entiteit zoals zij er
     toen bij stond. Dit is de route achter "wie was bevoegd op 14 juni 2027?". */
  app.post('/api/concern/opdatum', auth, (req, res) => {
    const e = mijn(req);
    if (!e) return stuur(res, nietGevonden);
    res.json(Object.assign({ ok: true, entiteit: entiteitBeeld(e, (req.body || {}).op) },
      tijdOpDatum(e.id, (req.body || {}).op)));
  });

  app.post('/api/concern/geschiedenis', auth, (req, res) => {
    const e = mijn(req);
    if (!e) return stuur(res, nietGevonden);
    const b = req.body || {};
    res.json({ ok: true, geschiedenis: entiteitGeschiedenis(e, b.soort || null, b.sleutel || null) });
  });

  /* ---- eigendom en bevoegdheid ---- */
  app.post('/api/concern/ubo', auth, (req, res) => {
    const e = mijn(req);
    if (!e) return stuur(res, nietGevonden);
    const b = req.body || {};
    res.json({ ok: true, ubo: concernUbo(e.id, b.op), belangen: concernBelangen(e.id, b.op),
      grens: 'Dit is de voorbereiding van uw UBO-opgave, niet de opgave zelf. Die doet u bij het handelsregister, met echte namen en identiteitsbewijzen.' });
  });

  app.post('/api/concern/tekenen', auth, (req, res) => {
    const e = mijn(req);
    if (!e) return stuur(res, nietGevonden);
    const b = req.body || {};
    res.json(Object.assign({ ok: true }, concernMagTekenen(e.id, Number(b.bedrag), b.op)));
  });

  app.post('/api/concern/verloopt', auth, (req, res) => {
    const e = mijn(req);
    if (!e) return stuur(res, nietGevonden);
    res.json({ ok: true, verloopt: concernGeraaktDoorVerloop(e.id, Number((req.body || {}).dagen) || 60) });
  });

  /* ---- vestigingen en operating units ---- */
  app.post('/api/concern/vestigingen', auth, (req, res) => {
    const e = mijn(req);
    if (!e) return stuur(res, nietGevonden);
    res.json({ ok: true, vestigingen: vestigingAlleVanEntiteit(e.id).map(vestigingBeeld) });
  });

  app.post('/api/concern/vestiging/nieuw', auth, (req, res) => {
    const e = mijn(req);
    if (!e) return stuur(res, nietGevonden);
    stuur(res, vestigingNieuw(e, req.body || {}));
  });

  /* De zaak aanwijzen. Het bewijs is hetzelfde als bij de onderneming: een lid
     dat als actieve beheerder in het personeelsregister van die zaak staat. */
  app.post('/api/concern/vestiging/zaak', auth, (req, res) => {
    const v = mijnVestiging(req);
    if (!v) return stuur(res, nietGevonden);
    const beheert = (code) => {
      const acc = req.session && req.session.account;
      if (!acc || acc.id == null || !accounts || !accounts.staffByMember) return false;
      const rij = accounts.staffByMember(code, acc.id);
      return !!(rij && rij.role === 'manager');
    };
    stuur(res, vestigingUnit(v, (req.body || {}).code, beheert));
  });

  app.post('/api/concern/vestiging/zaaklos', auth, (req, res) => {
    const v = mijnVestiging(req);
    if (!v) return stuur(res, nietGevonden);
    stuur(res, vestigingUnitLos(v, (req.body || {}).code));
  });

  app.post('/api/concern/vestiging/sluit', auth, (req, res) => {
    const v = mijnVestiging(req);
    if (!v) return stuur(res, nietGevonden);
    stuur(res, vestigingSluit(v, (req.body || {}).per));
  });

  /* ---- readiness en livegang ---- */
  app.post('/api/concern/readiness', auth, (req, res) => {
    const e = mijn(req);
    if (!e) return stuur(res, nietGevonden);
    res.json(Object.assign({ ok: true }, concernReadiness(e)));
  });

  app.post('/api/concern/launch', auth, (req, res) => {
    const e = mijn(req);
    if (!e) return stuur(res, nietGevonden);
    res.json(Object.assign({ ok: true }, concernLaunch(e)));
  });

  require('./concern/mensen')(kern, { mijn, mijnVestiging, stuur, nietGevonden });
  require('./concern/verandering')(kern, { mijn, stuur, nietGevonden });
};
