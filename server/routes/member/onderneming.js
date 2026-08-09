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
  const { app, auth, save, ONDERNEMING_RECHTSVORMEN, ondernemingVind, ondernemingVanEigenaar,
    ondernemingBeeld, ondernemingNieuw, ondernemingRechtsvorm, ondernemingKoppel,
    ondernemingIngeschreven, ondernemingIntakeZet, ondernemingIntakeBeeld,
    ondernemingVerkenning, ondernemingPlanVastleggen, ondernemingDagbeeld } = kern;

  const stuur = (res, r) => res.status(r && r.status ? r.status : 200).json(r);

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
  app.get('/api/onderneming/rechtsvormen', (req, res) => {
    res.json({ ok: true, rechtsvormen: Object.entries(ONDERNEMING_RECHTSVORMEN).map(([id, r]) => ({
      id, label: r.label, kort: r.kort, rechtspersoon: r.rechtspersoon,
      notarieel: r.notarieel, aansprakelijk: r.aansprakelijk, stappen: r.oprichting.length
    })) });
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
     "aanmelding" en "supplier". */
  app.post('/api/onderneming/koppel', auth, (req, res) => {
    const o = mijn(req);
    if (!o) return stuur(res, nietGevonden);
    stuur(res, ondernemingKoppel(o, (req.body || {}).code));
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
