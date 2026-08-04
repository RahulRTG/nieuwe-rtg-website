/* ============================================================================
   RTG WERK OS -- de bedrijfslaag: een werkruimte per organisatie.

   WAT DIT WEL IS. De ontbrekende helft van een enterprise-werkplek: projecten,
   kennis, klanten, service, bouw, contracten, IT, besluiten en het beeld dat
   de directie eruit leest. Alles achter EEN werkruimte met eigen leden, rollen
   en journaal, zodat het later ook aan een andere organisatie te verkopen is
   (en een holding meerdere werkruimtes kan dragen).

   WAT DIT MET OPZET NIET IS. Geen tweede Docs, geen tweede chat, geen tweede
   agenda, geen tweede loonrun. Die staan al in dit huis (kern/office/,
   routes/rtmail.js, routes/agenda.js, routes/payroll.js, kern/klok.js,
   kern/facturatie.js, routes/sso.js, routes/scim.js) en worden hier
   AANGESLOTEN, niet overgedaan. Twee plekken die dezelfde waarheid bewaren is
   de fout die dit huis het vaakst heeft gemaakt (LAT-regel 4); een werkplek
   die zijn eigen agenda meebrengt, is die fout in het groot.

   DE WERKRUIMTE IS DE GRENS. Elk gegeven hangt aan een werkruimtecode. Een lid
   van werkruimte A ziet niets van B, ook niet als het dezelfde holding is --
   geconsolideerd kijken is een APARTE handeling met een eigen recht, en niet
   iets wat er per ongeluk uitrolt.

   Opslag: db.data.werkruimtes[CODE]. Routes: /api/bedrijf/...
   ========================================================================== */
'use strict';
const { eigenVeld } = require('../kern/util');

module.exports = (kern) => {
  const { app, db, save, crypto, schoon } = kern;

  const nu = () => new Date().toISOString();
  const rid = (n) => crypto.randomBytes(n || 4).toString('hex');
  const dag = () => nu().slice(0, 10);

  function W() {
    if (!db.data.werkruimtes) db.data.werkruimtes = {};
    return db.data.werkruimtes;
  }
  const code = () => { let c; do { c = 'W' + crypto.randomBytes(3).toString('hex').toUpperCase().slice(0, 5); } while (W()[c]); return c; };

  /* De twee sleutels, precies zoals bij de schoollaag: een beheer-token voor
     wie de werkruimte opende, en een lid-token per medewerker. Ze staan naast
     elkaar en niet in elkaar: een beheerder is geen medewerker met extra
     vinkjes maar een aparte sleutel, zodat "wie deed dit" nooit vaag wordt. */
  function ruimteVan(req) {
    return eigenVeld(W(), String((req.body || {}).werkruimte || '').trim().toUpperCase()) || null;
  }
  function beheerVan(req, res) {
    const w = ruimteVan(req);
    if (!w || w.beheerToken !== String(req.body.beheerToken || '')) {
      res.status(403).json({ error: 'Onbekende werkruimte of verkeerd beheer-token.' });
      return null;
    }
    return w;
  }
  function lidVan(req, res) {
    const w = ruimteVan(req);
    const tok = String(req.body.lidToken || '');
    const l = w && tok ? Object.values(w.leden || {}).find(x => x.token === tok) : null;
    if (!l) { res.status(403).json({ error: 'Onbekende werkruimte of verkeerd lid-token.' }); return null; }
    if (l.status !== 'actief') { res.status(403).json({ error: 'Dit lidmaatschap staat op ' + l.status + '.' }); return null; }
    return { w, l };
  }

  const sctx = { app, db, save, crypto, schoon, kern, W, nu, rid, dag, ruimteVan, beheerVan, lidVan, eigenVeld };

  /* ---------- de werkruimte zelf ----------
     Een holding is een gewone werkruimte met kinderen eronder. Dat is bewust
     geen apart soort: anders krijgt de tweede laag zijn eigen rechten- en
     journaalregels, en die lopen gegarandeerd uit de pas met de eerste. */
  app.post('/api/bedrijf/werkruimte/maak', (req, res) => {
    const naam = schoon(req.body.naam, 80);
    if (!naam) return res.status(400).json({ error: 'Hoe heet de organisatie?' });
    const moeder = schoon(req.body.moeder, 8).toUpperCase();
    if (moeder && !eigenVeld(W(), moeder)) return res.status(404).json({ error: 'Die moederwerkruimte kennen we niet.' });
    const w = {
      code: code(), naam, land: schoon(req.body.land, 2).toUpperCase() || 'NL',
      valuta: schoon(req.body.valuta, 3).toUpperCase() || 'EUR',
      taal: schoon(req.body.taal, 5) || 'nl', moeder: moeder || null,
      kvk: schoon(req.body.kvk, 20) || null, btwNummer: schoon(req.body.btw, 20) || null,
      beheerToken: crypto.randomBytes(24).toString('hex'),
      leden: {}, journaal: [], at: nu()
    };
    W()[w.code] = w;
    save();
    res.json({ ok: true, werkruimte: w.code, naam: w.naam, beheerToken: w.beheerToken,
      let: 'Bewaar dit beheer-token: het wordt EEN keer getoond en is de sleutel van deze werkruimte. Leden krijgen straks hun eigen lid-token; dat is bewust een andere sleutel.' });
  });

  app.post('/api/bedrijf/werkruimte', (req, res) => {
    const w = beheerVan(req, res); if (!w) return;
    const kinderen = Object.values(W()).filter(x => x.moeder === w.code).map(x => ({ code: x.code, naam: x.naam, land: x.land, valuta: x.valuta }));
    res.json({ ok: true,
      werkruimte: { code: w.code, naam: w.naam, land: w.land, valuta: w.valuta, taal: w.taal,
        moeder: w.moeder, kvk: w.kvk, btwNummer: w.btwNummer, at: w.at },
      leden: Object.values(w.leden).length, dochters: kinderen,
      let: kinderen.length
        ? 'Dochters staan hier met naam, meer niet. Geconsolideerd kijken is een eigen handeling met een eigen recht; het rolt er niet vanzelf uit.'
        : null });
  });

  /* ---------- leden ----------
     Aanmelden kan iedereen; TOEGEVEN doet de werkruimte. Zonder die tweede
     stap is een werkruimte een open deur met een lijst erachter. */
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

  // de deellagen; de volgorde is gedrag (rollen zet de poort die de rest
  // gebruikt, en start zet de blokkenregistratie waar de rest zich op meldt)
  Object.assign(sctx, require('./rollen')(sctx));
  require('./start')(sctx);
  Object.assign(sctx, require('./project')(sctx));
  Object.assign(sctx, require('./taak')(sctx));
  Object.assign(sctx, require('./kennis')(sctx));
  Object.assign(sctx, require('./klant')(sctx));
  Object.assign(sctx, require('./service')(sctx));
  Object.assign(sctx, require('./storing')(sctx));
  Object.assign(sctx, require('./bouw')(sctx));
  require('./vlag')(sctx);
  Object.assign(sctx, require('./it')(sctx));
  require('./uitdienst')(sctx);
  return sctx;
};
