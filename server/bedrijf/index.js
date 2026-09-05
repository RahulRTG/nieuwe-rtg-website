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
  const PRODUCTIE = String(process.env.NODE_ENV || '') === 'production';

  const nu = () => new Date().toISOString();
  const rid = (n) => crypto.randomBytes(n || 4).toString('hex');
  const dag = () => nu().slice(0, 10);

  function W() {
    if (!db.data.werkruimtes) db.data.werkruimtes = {};
    return db.data.werkruimtes;
  }
  const code = () => { let c; do { c = 'W' + crypto.randomBytes(3).toString('hex').toUpperCase().slice(0, 5); } while (W()[c]); return c; };

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

  /* ---------- de werkruimte zelf ----------
     Een holding is een gewone werkruimte met kinderen eronder. Dat is bewust
     geen apart soort: anders krijgt de tweede laag zijn eigen rechten- en
     journaalregels, en die lopen gegarandeerd uit de pas met de eerste. */
  /* De eerste deur van het Werk OS is BEWUST open (zie scripts/poortwacht.js,
     PUBLIEK): wie hem aanroept heeft nog niets -- geen zaak, geen login. Maar
     een open scheppingsdeur zonder rem is een uitnodiging om de opslag vol te
     gieten. Vijf per afzender per tien minuten is voor een echt bedrijf ruim
     en voor een script niets. Lokaal geteld: de gedeelde tooManyTries-emmer
     wordt alleen door mislukte logins gevuld en zou hier dus nooit remmen. */
  const maakBeurten = new Map();
  // Zelfde ontsnapping als foundation/basis.js: in de testsuite delen alle
  // aanroepers een IP, en daar remt er niets.
  const GEEN_LIMIET = process.env.NODE_ENV === 'test';
  function maakRem(ip) {
    if (GEEN_LIMIET) return false;
    const t = Date.now();
    if (maakBeurten.size > 10000) maakBeurten.clear();
    const b = (maakBeurten.get(ip) || []).filter(x => t - x < 10 * 60000);
    b.push(t); maakBeurten.set(ip, b);
    return b.length > 5;
  }

  app.post('/api/bedrijf/werkruimte/maak', (req, res) => {
    if (maakRem(String(req.ip || ''))) {
      return res.status(429).json({ error: 'Te veel nieuwe werkruimtes achter elkaar. Wacht een paar minuten.' });
    }
    const naam = schoon(req.body.naam, 80);
    if (!naam) return res.status(400).json({ error: 'Hoe heet de organisatie?' });
    const moeder = schoon(req.body.moeder, 8).toUpperCase();
    if (moeder && PRODUCTIE) {
      const c = req.werkosContext;
      const ouder = c && c.werkruimte;
      const rechten = ouder && c.lid && kern.bedrijf && kern.bedrijf.rechtenVan
        ? kern.bedrijf.rechtenVan(c.lid) : [];
      if (!ouder || ouder.code !== moeder || !rechten.includes('werkruimte')) {
        return res.status(404).json({ error: 'Die moederwerkruimte kennen we niet of u mag er geen werkruimte aan koppelen.' });
      }
    } else if (moeder) {
      const ouder = eigenVeld(W(), moeder);
      const moederBeheerToken = String(req.body.moederBeheerToken || '');
      /* Een bekende werkruimtecode is geen bevoegdheid om aan die holding te
         schrijven. Bestaande en onbekende ouders krijgen bewust hetzelfde
         antwoord, zodat deze grens ook geen werkruimtes laat enumereren. */
      if (!ouder || !moederBeheerToken || ouder.beheerToken !== moederBeheerToken) {
        return res.status(404).json({ error: 'Die moederwerkruimte kennen we niet of u mag er geen werkruimte aan koppelen.' });
      }
    }
    const w = {
      code: code(), naam, land: schoon(req.body.land, 2).toUpperCase() || 'NL',
      valuta: schoon(req.body.valuta, 3).toUpperCase() || 'EUR',
      taal: schoon(req.body.taal, 5) || 'nl', moeder: moeder || null,
      kvk: schoon(req.body.kvk, 20) || null, btwNummer: schoon(req.body.btw, 20) || null,
      beheerToken: PRODUCTIE ? null : crypto.randomBytes(24).toString('hex'),
      leden: {}, journaal: [], at: nu()
    };
    if (PRODUCTIE) {
      const sessie = req.session;
      const naamAccount = sessie && sessie.account && kern.accounts && kern.accounts.realNameOf
        ? kern.accounts.realNameOf(sessie.account) : null;
      const l = { id: rid(4), naam: naamAccount || 'Directie', functie: 'directie',
        afdeling: 'directie', extern: false,
        rollen: [{ id: 'directie', van: null, tot: null, at: nu() }],
        status: 'actief', token: null, rtgKey: sessie.key,
        rtgCodenaam: sessie.account && sessie.account.codename || null,
        gekoppeldAt: nu(), toegelatenAt: nu(), at: nu() };
      w.leden[l.id] = l;
    }
    W()[w.code] = w;
    save();
    const antwoord = { ok: true, werkruimte: w.code, naam: w.naam };
    if (!PRODUCTIE) {
      antwoord.beheerToken = w.beheerToken;
      antwoord.let = 'Bewaar dit beheer-token: het wordt EEN keer getoond en is de sleutel van deze werkruimte. Leden krijgen straks hun eigen lid-token; dat is bewust een andere sleutel.';
    } else antwoord.let = 'De werkruimte is aan uw RTG-account gekoppeld. Uw huidige directierol bepaalt wat u mag.';
    res.json(antwoord);
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
  sctx.hangProductieIdentiteit = productieIdentiteit.hang;
  return sctx;
};
