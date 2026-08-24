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
  /* HET QUOTUM VAN DE TENANT, op de twee deuren en niet op 104 routes.

     Elke route van deze laag komt langs beheerVan() of lidVan(); daar tellen is
     dus de enige plek waar het volledig is, en de enige plek waar het niet
     vergeten kan worden bij route 105. De laag zelf weet niets van contracten:
     hij vraagt het aan kern.tenant als die er is, en werkt gewoon door als die
     er niet is (een werkruimte zonder tenant heeft geen contractgrens).

     De UITVOER telt nooit mee en wordt nooit geweigerd. Die zet `geenQuotum` op
     het verzoek (routes/tenant.js), want exit-recht dat op een teller kan
     stuklopen is geen recht. */
  function quotumOk(req, res, w) {
    if (req.geenQuotum || !kern.tenant) return true;
    const t = kern.tenant.register.vanWerkruimte(w.code);
    if (!t) return true;
    const uit = kern.tenant.contract.tel(t.org);
    if (uit.ok) return true;
    res.status(429).json({ error: uit.reden, quotum: { gebruikt: uit.gebruikt, grens: uit.grens } });
    return false;
  }

  function beheerVan(req, res) {
    const w = ruimteVan(req);
    if (!w || w.beheerToken !== String(req.body.beheerToken || '')) {
      res.status(403).json({ error: 'Onbekende werkruimte of verkeerd beheer-token.' });
      return null;
    }
    return quotumOk(req, res, w) ? w : null;
  }
  function lidVan(req, res) {
    const w = ruimteVan(req);
    const tok = String(req.body.lidToken || '');
    const l = w && tok ? Object.values(w.leden || {}).find(x => x.token === tok) : null;
    if (!l) { res.status(403).json({ error: 'Onbekende werkruimte of verkeerd lid-token.' }); return null; }
    if (l.status !== 'actief') { res.status(403).json({ error: 'Dit lidmaatschap staat op ' + l.status + '.' }); return null; }
    return quotumOk(req, res, w) ? { w, l } : null;
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

  /* De ledenroutes staan in ./leden.js -- dit bestand ging door de mounts
     over de 10 kB van keuringsregel 13, en de naad is echt: hier staat de
     werkruimte, daar staan de mensen erin. */

  // de deellagen; de volgorde is gedrag (rollen zet de poort die de rest
  // gebruikt, en start zet de blokkenregistratie waar de rest zich op meldt)
  require('./leden')(sctx);
  Object.assign(sctx, require('./rollen')(sctx));
  require('./start')(sctx);
  Object.assign(sctx, require('./wieis')(sctx));
  Object.assign(sctx, require('./project')(sctx));
  Object.assign(sctx, require('./taak')(sctx));
  Object.assign(sctx, require('./waarom')(sctx));
  Object.assign(sctx, require('./kennis')(sctx));
  Object.assign(sctx, require('./klant')(sctx));
  Object.assign(sctx, require('./service')(sctx));
  Object.assign(sctx, require('./storing')(sctx));
  Object.assign(sctx, require('./bouw')(sctx));
  require('./vlag')(sctx);
  Object.assign(sctx, require('./it')(sctx));
  require('./uitdienst')(sctx);
  Object.assign(sctx, require('./indienst')(sctx));
  Object.assign(sctx, require('./contract')(sctx));
  // Regels + handhaving: na contract.js, en contract.js roept ze aan via sctx.
  Object.assign(sctx, require('./regels')(sctx));
  Object.assign(sctx, require('./regelpoort')(sctx));
  Object.assign(sctx, require('./besluit')(sctx));
  require('./besluitlijst')(sctx);
  require('./aansluiting')(sctx);
  require('./postbrug')(sctx);
  require('./mijn')(sctx);
  // Herkomst uit een andere RTG-app (verwijzing bewaren, NOOIT oplossen) en
  // het eigen werk van een lid (geen parameter om naar een ander te vragen).
  Object.assign(sctx, require('./herkomst')(sctx));
  require('./mijnwerk')(sctx);
  Object.assign(sctx, require('./beeld')(sctx));
  // Gezondheid en dagbriefing: lezen het directiebeeld, meten zelf niets.
  Object.assign(sctx, require('./gezondheid')(sctx));
  // Besluitgeheugen: na besluit.js, en voor inzicht.js (dossier leest het).
  Object.assign(sctx, require('./geheugen')(sctx));
  Object.assign(sctx, require('./geheugenlezen')(sctx));
  // De organisatie op een datum (bestaan, geen toestand) en de uitvalanalyse.
  require('./toen')(sctx);
  require('./uitval')(sctx);
  // Zoeken, dossier en samenhang: leest de soorten van alle lagen hierboven.
  require('./inzicht')(sctx);
  /* Handelen via de commandobalk. Als LAATSTE, want hij leunt op de poort van
     rollen.js, op zetWie() van wieis.js en op de bakken van taak.js en
     service.js -- en hij schrijft in die bakken en niet in een eigen opslag
     ernaast. */
  require('./handeling')(sctx);
  /* De gevolgsimulatie: wat blijft er open als deze wijziging doorgaat. Leest
     alle bakken hierboven en schrijft in geen enkele -- er staat niet eens een
     save() in. */
  require('./gevolg')(sctx);
  return sctx;
};
