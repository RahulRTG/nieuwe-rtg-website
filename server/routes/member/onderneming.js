/* Member-submodule "onderneming": de ingang van het Ondernemers-OS.

   GEEN PASPOORT-POORT, EN DAT IS EEN KEUZE. De zzp-belastingtool en de
   AI-boekhouder hiernaast (./zakelijk.js) zitten achter de Business Pass, en
   dat blijft zo. De onderneming zelf niet: het uitgangspunt is één
   ondernemersproduct zonder lagen, en de eerste stand van dit object is
   letterlijk "ik denk erover na". Iemand die dat denkt heeft nog geen zakelijke
   pas, en zou hem op dat moment ook niet moeten hoeven kopen om te mogen
   nadenken. Wat er in een latere fase bijkomt en wat dat kost, is een
   afzonderlijk besluit -- het hoort niet als bijwerking in deze poort te staan.

   Alle handelingen lopen via `mijn()`: de onderneming moet bestaan EN van de
   ingelogde eigenaar zijn. Dat is een eigendomscontrole op het doel en niet op
   de aanvrager (lat-regel 7); een id uit het lichaam is nooit een bewijs. */
module.exports = (kern) => {
  const { accounts, app, auth, save, ONDERNEMING_RECHTSVORMEN, ondernemingRechtsvormenVanLand,
    ondernemingRechtsvormLanden, ondernemingVind, ondernemingVanEigenaar,
    ondernemingBeeld, ondernemingNieuw, ondernemingRechtsvorm, ondernemingKoppel,
    ondernemingIngeschreven, ondernemingIntakeZet, ondernemingIntakeBeeld,
    ondernemingVerkenning, ondernemingPlanVastleggen, ondernemingDagbeeld,
    ondernemingOprichting, ondernemingOprichtingZet, ondernemingAanvraag,
    ondernemingAanvraagStand, ondernemingEersteKlant, ondernemingMallProfiel } = kern;

  /* `status` betekent in dit huis de HTTP-code, maar een kernmodule kan een
     domeinstand in datzelfde veld zetten ('geen-aanvraag'). Dat gebeurde hier
     twee keer, en beide keren viel een verder volstrekt correct verzoek om met
     een 500: res.status() weigert een niet-numerieke code. Alleen een echte
     code telt dus als code; al het andere reist gewoon mee in het lichaam.
     De veldnamen zijn daarnaast uit elkaar gehaald (de kern geeft `stand`),
     maar dit is de grendel: hij maakt de hele klasse fouten onmogelijk in
     plaats van hem per aanroep te repareren. */
  const httpCode = (v) => (Number.isInteger(v) && v >= 100 && v <= 599 ? v : 200);
  const stuur = (res, r) => res.status(httpCode(r && r.status)).json(r);

  /* De onderneming van deze aanvrager, of een fout. Bewust één 404 voor
     "bestaat niet" en "niet van jou": het verschil zou verklappen welke id's
     bestaan. */
  function mijn(req) {
    const o = ondernemingVind(String((req.body || {}).id || ''));
    if (!o || o.eigenaar !== req.session.key) return null;
    return o;
  }
  const nietGevonden = { status: 404, error: 'Deze onderneming staat niet op uw naam.' };

  /* De rechtsvormen als keuzelijst -- zonder inlog, want het is voorlichting
     en geen bedrijfsdata. Wat een B.V. van een stichting onderscheidt hoort
     iemand te kunnen lezen vóórdat hij een account heeft. */
  /* Nederland en het buitenland staan in EEN lijst, elk met hun land erbij.
     Met ?land=DE komt alleen dat land -- en voor een land dat wij niet kennen
     komt er geen halve Nederlandse lijst maar een eerlijk "wij weten het niet";
     zie kern/onderneming/rechtsvorm-landen.js. */
  app.get('/api/onderneming/rechtsvormen', (req, res) => {
    const kort = (id, r) => ({ id, label: r.label, kort: r.kort, land: r.land,
      rechtspersoon: r.rechtspersoon, notarieel: r.notarieel,
      aansprakelijk: r.aansprakelijk, stappen: r.oprichting.length });
    const land = String((req.query || {}).land || '').trim();
    if (land) {
      const l = ondernemingRechtsvormenVanLand(land);
      return res.json(Object.assign({}, l, { rechtsvormen: l.vormen.map(v => kort(v.id, v)) }));
    }
    res.json({ ok: true, landen: ondernemingRechtsvormLanden(),
      rechtsvormen: Object.entries(ONDERNEMING_RECHTSVORMEN).map(([id, r]) => kort(id, r)) });
  });

  // Alles wat op mijn naam staat. Meerdere mag: dat is een groep in wording.
  app.post('/api/onderneming/mijn', auth, (req, res) => {
    res.json({ ok: true, ondernemingen: ondernemingVanEigenaar(req.session.key).map(ondernemingBeeld) });
  });

  app.post('/api/onderneming/nieuw', auth, (req, res) => {
    stuur(res, ondernemingNieuw(req.session.key, req.body || {}));
  });

  app.post('/api/onderneming/beeld', auth, (req, res) => {
    const o = mijn(req);
    if (!o) return stuur(res, nietGevonden);
    res.json({ ok: true, onderneming: ondernemingBeeld(o) });
  });

  app.post('/api/onderneming/rechtsvorm', auth, (req, res) => {
    const o = mijn(req);
    if (!o) return stuur(res, nietGevonden);
    stuur(res, ondernemingRechtsvorm(o, (req.body || {}).rechtsvorm));
  });

  /* De koppeling aan de bestaande zaak: hier verdwijnt de naad tussen
     "aanmelding" en "supplier".

     HET BEWIJS KOMT UIT DE SESSIE EN NIET UIT HET LICHAAM. De kern weet WELK
     bewijs nodig is (zie kern/onderneming/levensloop.js); deze route weet WIE
     er klopt. Een lid dat als actieve beheerder in het personeelsregister van
     die zaak staat, mag koppelen -- verder niemand. Zonder identiteitskluis
     (in een toets) is er geen bewijs, en dan wint de aanvraagweg of niets. */
  const beheertZaak = (req) => (code) => {
    const acc = req.session && req.session.account;
    if (!acc || acc.id == null || !accounts || !accounts.staffByMember) return false;
    const rij = accounts.staffByMember(code, acc.id);
    return !!(rij && rij.role === 'manager');
  };

  app.post('/api/onderneming/koppel', auth, (req, res) => {
    const o = mijn(req);
    if (!o) return stuur(res, nietGevonden);
    stuur(res, ondernemingKoppel(o, (req.body || {}).code, beheertZaak(req)));
  });

  app.post('/api/onderneming/ingeschreven', auth, (req, res) => {
    const o = mijn(req);
    if (!o) return stuur(res, nietGevonden);
    stuur(res, ondernemingIngeschreven(o, (req.body || {}).kvk));
  });

  /* Het ene scherm: waar sta ik, wat doet er vandaag toe, wat kan ik doen.
     Fase-bewust -- een idee krijgt geen debiteurenbeheer te zien. */
  app.post('/api/onderneming/dagbeeld', auth, (req, res) => {
    const o = mijn(req);
    if (!o) return stuur(res, nietGevonden);
    stuur(res, ondernemingDagbeeld(o));
  });

  /* ---- het oprichtingsproject ---- */

  app.post('/api/onderneming/oprichting', auth, (req, res) => {
    const o = mijn(req);
    if (!o) return stuur(res, nietGevonden);
    stuur(res, ondernemingOprichting(o));
  });

  app.post('/api/onderneming/oprichting/zet', auth, (req, res) => {
    const o = mijn(req);
    if (!o) return stuur(res, nietGevonden);
    stuur(res, ondernemingOprichtingZet(o, String((req.body || {}).stap || ''), (req.body || {}).klaar));
  });

  /* De weg naar klant nummer een: staat de etalage klaar, en wat is de
     volgende mijlpaal. Null zolang er geen zaak is. */
  app.post('/api/onderneming/eersteklant', auth, (req, res) => {
    const o = mijn(req);
    if (!o) return stuur(res, nietGevonden);
    res.json({ ok: true, eersteklant: ondernemingEersteKlant(o) });
  });

  /* Hoe de Mall-pagina van deze zaak is opgebouwd, en wat er nog mist.
     Zegt niets over zichtbaarheid; dat blijft aan de ondernemerspoort. */
  app.post('/api/onderneming/mallprofiel', auth, (req, res) => {
    const o = mijn(req);
    if (!o) return stuur(res, nietGevonden);
    res.json({ ok: true, mall: ondernemingMallProfiel(o) });
  });

  /* De geldkant (klanten, openstaand, te betalen, contracten, belasting) staat
     in ./onderneming-geld.js: dit bestand ging over de 10 kB van het
     modulebeleid. Hij krijgt dezelfde eigendomscontrole mee, zodat er maar een
     poort is. */
  require('./onderneming-geld')(kern, mijn, stuur, nietGevonden);
  require('./onderneming-bestuur')(kern, mijn, stuur, nietGevonden);

  /* ---- de zaak aanvragen ----
     Loopt langs de bestaande aanmeldingsstroom: RTG-personeel beslist, wij
     kennen niets toe. Het account-id komt uit de GEVERIFIEERDE sessie en nooit
     uit het lichaam -- anders koppelde je andermans account aan je aanvraag. */
  app.post('/api/onderneming/aanvraag', auth, (req, res) => {
    const o = mijn(req);
    if (!o) return stuur(res, nietGevonden);
    const accountId = (req.session.account && req.session.account.id) || null;
    stuur(res, ondernemingAanvraag(o, accountId, req.body || {}));
  });

  app.post('/api/onderneming/aanvraag/stand', auth, (req, res) => {
    const o = mijn(req);
    if (!o) return stuur(res, nietGevonden);
    stuur(res, ondernemingAanvraagStand(o));
  });

  /* ---- de verkenning: intake -> kans -> simulatie -> stress -> plan ---- */

  app.post('/api/onderneming/intake', auth, (req, res) => {
    const o = mijn(req);
    if (!o) return stuur(res, nietGevonden);
    if (req.body && (req.body.persoon || req.body.idee)) { ondernemingIntakeZet(o, req.body); save(); }
    res.json({ ok: true, intake: ondernemingIntakeBeeld(o) });
  });

  /* Alles in één antwoord, in de juiste volgorde. Zie kern/onderneming/index.js:
     een scherm dat de vier stappen zelf moet ordenen, ordent ze ooit verkeerd. */
  app.post('/api/onderneming/verkenning', auth, (req, res) => {
    const o = mijn(req);
    if (!o) return stuur(res, nietGevonden);
    stuur(res, ondernemingVerkenning(o, (req.body || {}).aannames));
  });

  /* Het plan vastleggen. Dit is de handeling die de fase van 'idee' naar
     'validatie' brengt -- niet een knop die de fase zet, maar het feit
     waar ./fase.js op kijkt. Adviseert de stress test 'niet starten', dan
     weigert dit met 409 tot `tochDoorzetten` meekomt; die keuze wordt dan
     mét het advies in het archief vastgelegd. */
  app.post('/api/onderneming/plan/vastleggen', auth, (req, res) => {
    const o = mijn(req);
    if (!o) return stuur(res, nietGevonden);
    const v = ondernemingVerkenning(o, (req.body || {}).aannames);
    stuur(res, ondernemingPlanVastleggen(o, v.plan, v.stress, req.body || {}));
  });
};
