/* RTG Werk OS (deellaag): de LEDEN van een werkruimte.

   Aanmelden kan iedereen; TOEGEVEN doet de werkruimte. Zonder die tweede stap
   is een werkruimte een open deur met een lijst erachter -- dat is de regel die
   deze routes dragen, en de reden dat een lid-token pas iets doet nadat iemand
   met het beheer-token het lidmaatschap heeft toegelaten.

   Staat los van ./index.js omdat dat bestand door zijn mounts over de 10 kB van
   keuringsregel 13 ging. De naad is echt en niet gekunsteld: daar staat de
   werkruimte, hier staan de mensen erin. Alles wat deze routes gebruiken komt
   uit de gedeelde context, dus er is niets gekopieerd. */
'use strict';

module.exports = (sctx) => {
  const { app, save, crypto, schoon, nu, rid, dag, ruimteVan, beheerVan, eigenVeld } = sctx;

  app.post('/api/bedrijf/lid/aanmeld', (req, res) => {
    const w = ruimteVan(req);
    if (!w) return res.status(404).json({ error: 'Die werkruimte kennen we niet.' });
    const naam = schoon(req.body.naam, 60);
    if (!naam) return res.status(400).json({ error: 'Onder welke naam werkt u hier?' });
    const l = { id: rid(4), naam, functie: schoon(req.body.functie, 60) || null,
      afdeling: schoon(req.body.afdeling, 40) || null, extern: req.body.extern === true,
      rollen: [], status: 'wacht', token: crypto.randomBytes(24).toString('hex'), at: nu() };
    w.leden[l.id] = l;
    save();
    res.json({ ok: true, lidId: l.id, lidToken: l.token, status: l.status,
      let: 'U staat op de lijst maar bent nog niet toegelaten. Tot iemand met het beheer-token u toelaat, werkt dit token nergens voor.' });
  });

  app.post('/api/bedrijf/lid/besluit', (req, res) => {
    const w = beheerVan(req, res); if (!w) return;
    const l = eigenVeld(w.leden, String(req.body.lidId || ''));
    if (!l) return res.status(404).json({ error: 'Dat lid kennen we niet.' });
    const akkoord = req.body.akkoord === true;
    if (!akkoord) {
      l.status = 'afgewezen'; l.token = null; l.afgewezenAt = nu();
      save();
      return res.json({ ok: true, lid: { id: l.id, status: l.status } });
    }
    l.status = 'actief'; l.toegelatenAt = nu();
    save();
    res.json({ ok: true, lid: { id: l.id, naam: l.naam, status: l.status, rollen: l.rollen } });
  });

  /* Uit dienst: EEN handeling die de sleutel intrekt en het spoor laat staan.
     Het IT-deel (apparaten terug, accounts blokkeren) hangt hier later aan;
     de plek waar dat gebeurt is deze, en niet een tweede knop ergens anders. */
  app.post('/api/bedrijf/lid/uit-dienst', (req, res) => {
    const w = beheerVan(req, res); if (!w) return;
    const l = eigenVeld(w.leden, String(req.body.lidId || ''));
    if (!l) return res.status(404).json({ error: 'Dat lid kennen we niet.' });
    if (l.status === 'uit dienst') return res.status(409).json({ error: 'Dit lid staat al uit dienst.' });
    const reden = schoon(req.body.reden, 120);
    if (!reden) return res.status(400).json({ error: 'Noteer waarom dit lidmaatschap eindigt; een lege uitstroom is later niet te reconstrueren.' });
    l.status = 'uit dienst'; l.token = null; l.uitReden = reden; l.uitAt = nu();
    l.laatsteDag = schoon(req.body.laatsteDag, 10) || dag();
    save();
    res.json({ ok: true, lid: { id: l.id, naam: l.naam, status: l.status, laatsteDag: l.laatsteDag },
      let: 'De sleutel is per direct ingetrokken. Wat er van deze persoon in de werkruimte staat blijft staan, met zijn naam erbij -- werk uitwissen maakt een dossier onleesbaar.' });
  });

  app.post('/api/bedrijf/leden', (req, res) => {
    const w = beheerVan(req, res); if (!w) return;
    const rijen = Object.values(w.leden)
      .filter(l => !req.body.status || l.status === String(req.body.status))
      .map(l => ({ id: l.id, naam: l.naam, functie: l.functie, afdeling: l.afdeling,
        extern: l.extern, rollen: l.rollen, status: l.status, at: l.at }));
    res.json({ ok: true, aantal: rijen.length, leden: rijen,
      wacht: Object.values(w.leden).filter(l => l.status === 'wacht').length });
  });
};
