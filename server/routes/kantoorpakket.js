/* Domein "kantoorpakket": RTG Office, het kantoorpakket voor het hele
   ecosysteem. Drie ingangen op dezelfde kern:
   - leden (RTG, Lifestyle en Business Pass) onder /api/kantoorpakket,
     op het eigen account (gasten niet);
   - elke leverancier en partner onder /api/supplier/kantoorpakket, als
     team-drive per zaak (sleutel 'sup:CODE', het hele team dezelfde map);
   - de eigen RTG-kantoren onder /api/office/kantoorpakket, op de gedeelde
     kantoor-drive ('rtg:kantoor').
   De bewaar-route heeft een ruimere body-limiet; los van de RTG-backoffice
   (/api/office) zelf. */
module.exports = (kern) => {
  const { app, auth, supplierAuth, officeAuth, express, officeMijn, officeMaak, officeOpen,
    officeBewaar, officeDeel, officeWeg, officeSter, officeVersies, officeTerug, officeAI,
    officeVul, officeUitslag, officeFase } = kern;
  const stuur = (res, r) => r.error ? res.status(r.status || 400).json(r) : res.json(r);
  const ruim = express.json({ limit: '600kb' });

  /* Dezelfde acties voor elke ingang; alleen de sleutel verschilt. */
  /* De drive van een ZAAK: alles op de leverancierscode.

     De paden staan voluit en niet als basis + pad. Hier stond EEN mount()-lus
     die met twee aanroepen 24 routes maakte; scripts/schakelbaar.js zag er
     daardoor nul, en wat die census niet ziet is vanuit de boardroom niet uit
     te zetten en niet per stad te sluiten (scripts/check.js regel 45). De
     acties zijn dezelfde als hieronder en roepen dezelfde kern aan; alleen de
     SLEUTEL verschilt, en die staat nu per ingang zichtbaar in de wrapper. */
  const supDoe = (fn) => async (req, res) => {
    stuur(res, await fn('sup:' + req.supplier.code, req.body || {}));
  };
  app.post('/api/supplier/kantoorpakket/mijn', supplierAuth, supDoe((key) => officeMijn(key)));
  app.post('/api/supplier/kantoorpakket/maak', supplierAuth, supDoe((key, b) => officeMaak(key, b)));
  app.post('/api/supplier/kantoorpakket/open', supplierAuth, supDoe((key, b) => officeOpen(key, b.id)));
  app.post('/api/supplier/kantoorpakket/bewaar', ruim, supplierAuth, supDoe((key, b) => officeBewaar(key, b.id, b)));
  app.post('/api/supplier/kantoorpakket/deel', supplierAuth, supDoe((key, b) => officeDeel(key, b.id, b.codenaam, b.aan !== false, b.rechten)));
  app.post('/api/supplier/kantoorpakket/weg', supplierAuth, supDoe((key, b) => officeWeg(key, b.id)));
  app.post('/api/supplier/kantoorpakket/ster', supplierAuth, supDoe((key, b) => officeSter(key, b.id, b.aan)));
  app.post('/api/supplier/kantoorpakket/versies', supplierAuth, supDoe((key, b) => officeVersies(key, b.id)));
  app.post('/api/supplier/kantoorpakket/terug', supplierAuth, supDoe((key, b) => officeTerug(key, b.id, b.nr)));
  app.post('/api/supplier/kantoorpakket/ai', supplierAuth, supDoe((key, b) => officeAI(key, b.id, b.opdracht, b.vraag)));
  app.post('/api/supplier/kantoorpakket/fase', supplierAuth, supDoe((key, b) => officeFase(key, b.id, b)));
  app.post('/api/supplier/kantoorpakket/vul', supplierAuth, supDoe((key, b) => officeVul(key, b.id, b)));
  app.post('/api/supplier/kantoorpakket/uitslag', supplierAuth, supDoe((key, b) => officeUitslag(key, b.id)));

  /* De drive van de RTG-kantoren zelf: een gedeelde sleutel.

     De paden staan voluit en niet als basis + pad. Hier stond EEN mount()-lus
     die met twee aanroepen 24 routes maakte; scripts/schakelbaar.js zag er
     daardoor nul, en wat die census niet ziet is vanuit de boardroom niet uit
     te zetten en niet per stad te sluiten (scripts/check.js regel 45). De
     acties zijn dezelfde als hieronder en roepen dezelfde kern aan; alleen de
     SLEUTEL verschilt, en die staat nu per ingang zichtbaar in de wrapper. */
  const kantoorDoe = (fn) => async (req, res) => {
    stuur(res, await fn('rtg:kantoor', req.body || {}));
  };
  app.post('/api/office/kantoorpakket/mijn', officeAuth, kantoorDoe((key) => officeMijn(key)));
  app.post('/api/office/kantoorpakket/maak', officeAuth, kantoorDoe((key, b) => officeMaak(key, b)));
  app.post('/api/office/kantoorpakket/open', officeAuth, kantoorDoe((key, b) => officeOpen(key, b.id)));
  app.post('/api/office/kantoorpakket/bewaar', ruim, officeAuth, kantoorDoe((key, b) => officeBewaar(key, b.id, b)));
  app.post('/api/office/kantoorpakket/deel', officeAuth, kantoorDoe((key, b) => officeDeel(key, b.id, b.codenaam, b.aan !== false, b.rechten)));
  app.post('/api/office/kantoorpakket/weg', officeAuth, kantoorDoe((key, b) => officeWeg(key, b.id)));
  app.post('/api/office/kantoorpakket/ster', officeAuth, kantoorDoe((key, b) => officeSter(key, b.id, b.aan)));
  app.post('/api/office/kantoorpakket/versies', officeAuth, kantoorDoe((key, b) => officeVersies(key, b.id)));
  app.post('/api/office/kantoorpakket/terug', officeAuth, kantoorDoe((key, b) => officeTerug(key, b.id, b.nr)));
  app.post('/api/office/kantoorpakket/ai', officeAuth, kantoorDoe((key, b) => officeAI(key, b.id, b.opdracht, b.vraag)));
  app.post('/api/office/kantoorpakket/fase', officeAuth, kantoorDoe((key, b) => officeFase(key, b.id, b)));
  app.post('/api/office/kantoorpakket/vul', officeAuth, kantoorDoe((key, b) => officeVul(key, b.id, b)));
  app.post('/api/office/kantoorpakket/uitslag', officeAuth, kantoorDoe((key, b) => officeUitslag(key, b.id)));

  // leden: op het eigen account; de gratis gast-app heeft geen Office
  const geenGast = (req, res, next) => {
    if (req.session.tier === 'guest') return res.status(403).json({ error: 'RTG Office is voor leden.' });
    next();
  };
  const ledenAuth = [auth, geenGast];
  {
    /* Voluit, zelfde reden als hierboven: `ruim` staat nu zichtbaar bij de
       routes die een groot lijf aannemen. */
    const doe = (fn) => async (req, res) => {
      stuur(res, await fn(req.session.key, req.body || {}));
    };
    app.post('/api/kantoorpakket/mijn', ...ledenAuth, doe((key) => officeMijn(key)));
    app.post('/api/kantoorpakket/maak', ...ledenAuth, doe((key, b) => officeMaak(key, b)));
    app.post('/api/kantoorpakket/open', ...ledenAuth, doe((key, b) => officeOpen(key, b.id)));
    app.post('/api/kantoorpakket/bewaar', ruim, ...ledenAuth, doe((key, b) => officeBewaar(key, b.id, b)));
    app.post('/api/kantoorpakket/deel', ...ledenAuth, doe((key, b) => officeDeel(key, b.id, b.codenaam, b.aan !== false, b.rechten)));
    app.post('/api/kantoorpakket/weg', ...ledenAuth, doe((key, b) => officeWeg(key, b.id)));
    app.post('/api/kantoorpakket/ster', ...ledenAuth, doe((key, b) => officeSter(key, b.id, b.aan)));
    app.post('/api/kantoorpakket/versies', ...ledenAuth, doe((key, b) => officeVersies(key, b.id)));
    app.post('/api/kantoorpakket/terug', ...ledenAuth, doe((key, b) => officeTerug(key, b.id, b.nr)));
    app.post('/api/kantoorpakket/ai', ...ledenAuth, doe((key, b) => officeAI(key, b.id, b.opdracht, b.vraag)));
    app.post('/api/kantoorpakket/fase', ...ledenAuth, doe((key, b) => officeFase(key, b.id, b)));
    app.post('/api/kantoorpakket/vul', ...ledenAuth, doe((key, b) => officeVul(key, b.id, b)));
    app.post('/api/kantoorpakket/uitslag', ...ledenAuth, doe((key, b) => officeUitslag(key, b.id)));
  }

  // elke leverancier en partner: de team-drive van de zaak
  // de eigen RTG-kantoren: de gedeelde kantoor-drive

  /* De ingangen van het foundation-huis en de werkplekken staan in een eigen
     bestand: samen pasten ze niet meer binnen de 10 KB-maat toen de paden
     voluit kwamen. stuur en ruim reizen mee -- die horen bij het pakket, niet
     bij een ingang. */
  require('./kantoorpakket-huis')(kern, { stuur, ruim });
  require('./kantoorpakket-samen')(kern);
};
