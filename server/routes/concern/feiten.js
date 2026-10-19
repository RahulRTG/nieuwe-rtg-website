/* Routes "concern" (deel): DE JURIDISCHE FEITEN EN DE TIJDMACHINE -- een feit
   vastleggen of beeindigen, de entiteit op een datum, en de geschiedenis.

   Afgesplitst van ../concern.js. De naad is inhoudelijk: daar staat de entiteit
   zoals zij NU is (aanmaken, registratie, groep, readiness); hier de tijdas
   eronder (../../kern/concern/tijd), waar elk feit een bron, een begin en een
   einde draagt en "wie was bevoegd op 14 juni 2027?" beantwoord wordt. Dezelfde
   eigendomscontrole (mijn) als de rest van het concern, plus de eis dat een
   feit-id uit het lichaam bij DEZE entiteit hoort. */
'use strict';

const { duidBestuurder } = require('../../kern/concern/persoon');

module.exports = (kern, { mijn, stuur, nietGevonden }) => {
  const { app, auth, entiteitBeeld, entiteitGeschiedenis, tijdZet, tijdBeeindig, tijdOpDatum } = kern;

  /* ---- de juridische feiten (de tijdmachine) ----
     Elk feit draagt een bron; ./kern/concern/bron.js weigert het zonder. `wie`
     komt uit de sessie zodat het spoor op een codenaam staat en niet op iets
     wat de aanvrager zelf mag verzinnen. */
  app.post('/api/concern/feit/zet', auth, async (req, res) => {
    const e = mijn(req);
    if (!e) return stuur(res, nietGevonden);
    const soort = String((req.body || {}).soort || '');
    /* Een bestuurder of gevolmachtigde is een codenaam of uitdrukkelijk extern
       (kern/concern/persoon.js): een tekengrens moet weten wie het is. */
    const d = await duidBestuurder(soort, req.body, kern.keyVanCodenaam);
    if (!d.ok) return stuur(res, d);
    stuur(res, tijdZet(e.id, soort, Object.assign({}, d.body, { wie: req.session.key })));
  });

  app.post('/api/concern/feit/beeindig', auth, (req, res) => {
    const e = mijn(req);
    if (!e) return stuur(res, nietGevonden);
    const b = req.body || {};
    /* HET FEIT MOET BIJ DEZE ENTITEIT HOREN. mijn() bewijst alleen dat de
       entiteit van de aanvrager is; het feit-id komt uit het lichaam. Zonder
       deze regel beeindigde een eigen entiteit plus andermans feit-id diens
       bestuurder (test/concern-routes.test.js). Dezelfde 404 als "bestaat niet". */
    const feitId = String(b.feit || '');
    if (!entiteitGeschiedenis(e).some(f => f.id === feitId)) return stuur(res, { status: 404, error: 'Dit gegeven bestaat niet.' });
    stuur(res, tijdBeeindig(feitId, b.tot, Object.assign({}, b, { wie: req.session.key })));
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
};
