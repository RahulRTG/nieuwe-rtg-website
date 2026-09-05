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

  /* De twee deuren staan in ./deuren.js: het contractquotum en de
     organisatiemeting hangen eraan, en die horen op één plek te hangen. */
  const { ruimteVan, beheerVan, lidVan } = require('./deuren')({ kern, W, eigenVeld });

  /* In productie komt ELKE bedrijfsroute eerst langs de centrale RTG-
     accountpoort en een verse PostgreSQL-baseline. Deze mount staat bewust
     vóór de eerste app.post hieronder. Ontwikkeling gebruikt dezelfde routes
     zonder deze cutover, zodat bestaande lokale scenario's bruikbaar blijven. */
  const productieIdentiteit = require('./productie-identiteit')({
    app, auth: kern.auth, db
  });
  productieIdentiteit.hang('/api/bedrijf', {
    zonderWerkruimte: ['/api/bedrijf/mijn', '/api/bedrijf/werkruimte/maak']
  });

  const sctx = { app, db, save, crypto, schoon, kern, W, nu, rid, dag, ruimteVan, beheerVan, lidVan, eigenVeld };

  // de deellagen; de volgorde is gedrag (rollen zet de poort die de rest
  // gebruikt, en start zet de blokkenregistratie waar de rest zich op meldt)
  require('./werkruimte')(sctx);
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
  sctx.hangProductieIdentiteit = productieIdentiteit.hang;
  return sctx;
};
