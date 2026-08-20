/* DE MELDKNOP VAN DE LEDENPRIJSGARANTIE.

   De voorwaarden beloven: "Ziet u het bij de zaak zelf toch goedkoper, meld het
   via de app: de partner past de prijs aan en het verschil wordt voor u
   rechtgezet." Het plafond was gebouwd, deze knop niet (PRIJZEN.md 4.11).

   Drie kanten, drie poorten:
   - het LID meldt en ziet zijn eigen meldingen
   - de ZAAK erkent of betwist, en ziet alleen die van haarzelf
   - het KANTOOR komt erbij als het vastloopt, en wijst af met een reden

   De zaak kan NIET zelf rechtzetten zonder eerst te erkennen, en het kantoor kan
   niet rechtzetten wat niet erkend is -- die volgorde staat in de kern
   (kern/commercie/prijsmelding.js) en niet hier. */
module.exports = (kern) => {
  const { app, db, save, auth, supplierAuth, officeAuth, schoon } = kern;
  /* `veilig` is geen kern-sleutel maar een helper die elk routebestand zelf
     opzet -- zie routes/aanmeldingen.js. Hier stond hem uit kern halen, en dan
     is hij undefined en geeft elke aanroep een 500 zonder dat je ziet waarom. */
  const veilig = (res, werk) => {
    try { const r = werk(); res.status(r && r.status ? r.status : 200).json(r); }
    catch (e) { console.error('[prijsgarantie]', e); res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' }); }
  };
  const meldingen = require('../../kern/commercie/prijsmelding')
    .maakPrijsmeldingen({ db, save, nu: () => Date.now() });

  const lidVan = req => (req.session && req.session.key) || (req.member && req.member.codename) || null;

  /* --- het lid --- */
  app.post('/api/member/prijsgarantie/meld', auth, (req, res) => veilig(res, () => {
    const b = req.body || {};
    return meldingen.meld({
      codenaam: lidVan(req),
      supplierCode: b.supplierCode,
      omschrijving: schoon(b.omschrijving, 200),
      betaaldCenten: Math.round(Number(b.betaald) * 100),
      gezienCenten: Math.round(Number(b.gezien) * 100),
      ref: b.ref || null,
      bewijs: schoon(b.bewijs, 500)
    });
  }));
  app.post('/api/member/prijsgarantie', auth, (req, res) => veilig(res, () =>
    ({ status: 200, ok: true, meldingen: meldingen.lijst({ codenaam: lidVan(req) }) })));

  /* --- de zaak --- */
  app.post('/api/supplier/prijsgarantie', supplierAuth, (req, res) => veilig(res, () =>
    ({ status: 200, ok: true, meldingen: meldingen.lijst({ supplierCode: req.supplier.code }),
      stand: meldingen.stand(req.supplier.code) })));
  app.post('/api/supplier/prijsgarantie/erken', supplierAuth, (req, res) => veilig(res, () => {
    const b = req.body || {};
    const m = meldingen.vind(b.id);
    if (!m || m.supplierCode !== req.supplier.code)
      return { status: 404, error: 'Deze melding hoort niet bij uw zaak.' };
    return meldingen.erken(b.id, req.supplier.name,
      Number.isFinite(Number(b.nieuwePrijs)) ? Math.round(Number(b.nieuwePrijs) * 100) : undefined);
  }));
  app.post('/api/supplier/prijsgarantie/betwist', supplierAuth, (req, res) => veilig(res, () => {
    const b = req.body || {};
    const m = meldingen.vind(b.id);
    if (!m || m.supplierCode !== req.supplier.code)
      return { status: 404, error: 'Deze melding hoort niet bij uw zaak.' };
    return meldingen.betwist(b.id, req.supplier.name, schoon(b.reden, 300));
  }));

  /* --- het kantoor --- */
  app.post('/api/office/prijsgarantie', officeAuth, (req, res) => veilig(res, () =>
    ({ status: 200, ok: true, meldingen: meldingen.lijst(req.body || {}), stand: meldingen.stand() })));
  app.post('/api/office/prijsgarantie/rechtzetten', officeAuth, (req, res) => veilig(res, () =>
    meldingen.zetRecht((req.body || {}).id, (req.body || {}).ref)));
  app.post('/api/office/prijsgarantie/afwijzen', officeAuth, (req, res) => veilig(res, () =>
    meldingen.wijsAf((req.body || {}).id, (req.body || {}).naam || 'backoffice', schoon((req.body || {}).reden, 300))));

  return { prijsmeldingen: meldingen };
};
