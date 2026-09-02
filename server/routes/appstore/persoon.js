/* ============================================================================
   DE TWEEDE DEUR VAN HET UITGEVERSBUREAU -- een geverifieerd PERSOON.

   HET BESLUIT (27 augustus 2026). Tot nu toe kon alleen een ZAAK publiceren:
   ./uitgever.js staat op supplierAuth en leidt de organisatie af uit het
   tenantregister. Wie geen bedrijf heeft, kwam er niet in -- en dat is precies
   de mens waar CREATE.md over gaat: de amateur die maker wordt.

   De eigenaar heeft gekozen: een geverifieerd persoon mag publiceren, maar
   alleen GRATIS. Betaalde distributie blijft een rechtspersoon vragen; daar
   hangen de btw, de afdracht en een aanspreekbare partij aan. Die grens staat
   niet hier maar op EEN plek in de kern (kern/appstore/uitgevers.js:
   magPrijsVragen), zodat er geen tweede plek is die op een dag iets anders zegt
   (LAT-regel 4). In dit bestand komt het woord prijs dan ook niet voor.

   WAAROM DIT GEEN VIJFDE IDENTITEITSBEGRIP IS. De kop van ./uitgever.js zegt dat
   er geen tweede inlog voor dezelfde partij bij komt (TENANT.md). Dat blijft
   staan. Ook hier IS `org` de klant. Wat verschilt is niet WIE de klant is maar
   hoe hij aantoont dat hij het is: een zaak toont een zaakinlog, een mens toont
   zijn ledeninlog. Twee deuren, een motor -- elke route hieronder roept dezelfde
   kernfunctie aan als zijn tegenhanger hiernaast, en de routes staan uitgeschreven
   in plaats van in een lus, zodat elk pad zijn eigen mutatieverklaring draagt.

   DE POORTEN VOOR DE MENS. Twee daarvan (geverifieerd, achttien jaar) staan als
   pure functie in de kern -- mensMagUitgeven -- en niet hier: een toegangsregel
   die in een route woont, kan alleen worden getoetst door een server op te
   starten, en wordt daarom bijna nooit getoetst. Deze route levert de FEITEN
   aan; wat ze betekenen staat in de kern. De derde poort is ongewijzigd: een
   MENS VAN RTG laat toe, net als bij een zaak (APPSTORE.md grens 2). Daar kijkt
   die mens ook of de naam waaronder iemand wil publiceren bij de geverifieerde
   identiteit past.
   ========================================================================== */
module.exports = (kern) => {
  const { app, auth, appstore, appstoreBrug, idGeverifieerd, leeftijdVan, geborenVan } = kern;
  const { mensMagUitgeven } = require('../../kern/appstore/uitgevers');

  /* De poort, op een plek. Geeft de org terug, of de reden waarom die er niet
     is -- en die reden is nooit een stilte (LAT-regel 5). */
  function persoonVan(req, plekNodig) {
    const mag = mensMagUitgeven({
      geverifieerd: idGeverifieerd(req.session),
      leeftijd: leeftijdVan(geborenVan(req.session))
    });
    if (!mag.mag) return { status: mag.status, error: mag.error };
    const u = appstore.uitgeverVanPersoon(req.session.key);
    if (!u) {
      return plekNodig
        ? { status: 409, error: 'Je hebt nog geen uitgeversplek. Vraag er een aan; een mens van RTG kijkt ernaar.' }
        : { ok: true, org: null, uitgever: null };
    }
    return { ok: true, org: u.org, uitgever: u };
  }

  const metPersoon = (plekNodig, fn) => (req, res) => {
    const p = persoonVan(req, plekNodig);
    if (!p.ok) return res.status(p.status).json({ error: p.error });
    const r = fn(req, p);
    if (r && r.error) return res.status(r.status || 400).json(r);
    res.json(r);
  };

  // wie ben ik hier, en wat mag ik
  /* mutatie: idempotent -- lezen */
  app.post('/api/appstore/persoon', auth, metPersoon(false, (req, p) => p.org
    ? Object.assign({ status: 200, org: p.org, soort: 'persoon' }, appstore.mijnUitgeverij(p.org))
    : { status: 200, org: null, soort: 'persoon', uitgever: null,
        let: 'Je mag een uitgeversplek aanvragen. Als persoon publiceer je gratis; voor een betaalde app vraagt RTG een rechtspersoon.' }));

  /* De uitgeversplek aanvragen. De organisatiecode wordt in de kern gemaakt en
     is willekeurig: hij staat publiek in de catalogus bij elke app. */
  /* mutatie: idempotent -- een tweede aanvraag werkt de eerste bij of zegt dat hij er al is */
  app.post('/api/appstore/persoon/aanvraag', auth, metPersoon(false, (req) => appstore.uitgeverAanvragenPersoon({
    persoonKey: req.session.key, naam: String(req.body.naam || ''), contact: String(req.body.contact || '') })));

  /* mutatie: idempotent -- dezelfde bundel levert dezelfde hash en dus geen tweede versie */
  /* Ook hier de mens: bij een persoonlijke uitgever is de sessiesleutel het
     handvat. Er gaat geen naam mee -- die staat in de kluis en hoort niet in de
     App Store (grens 3). De vier-ogenregel werkt dan op de sleutel, en die is
     harder dan een naam. */
  app.post('/api/appstore/persoon/inzenden', auth, metPersoon(true, (req, p) => appstore.inzenden({
    inzender: { soort: 'persoon', id: req.session.key, naam: null },
    org: p.org, manifest: req.body.manifest, bestanden: req.body.bestanden })));

  /* mutatie: idempotent -- twee keer intrekken laat dezelfde stand achter */
  app.post('/api/appstore/persoon/intrekken', auth, metPersoon(true, (req, p) => appstore.intrekken({
    sleutel: req.body.sleutel, reden: req.body.reden, door: p.uitgever.naam, doorOrg: p.org })));

  /* mutatie: idempotent -- lezen */
  app.post('/api/appstore/persoon/journaal', auth, metPersoon(true, (req, p) => ({
    status: 200, lijst: appstore.journaalVan(p.org, req.body && req.body.n) })));

  /* mutatie: idempotent -- lezen */
  app.post('/api/appstore/persoon/cijfers', auth, metPersoon(true, (req, p) => ({
    status: 200, apps: appstoreBrug.meting.cijfersVan(appstore.uitgeverApps(p.org), req.body && req.body.dagen) })));

  /* De proefkeuring, en die staat hier met opzet ZONDER uitgeversplek. Voor een
     mens die begint is dit het belangrijkste scherm dat er is: hij leert waar de
     poort staat voordat hij iets aanvraagt. Zou hij eerst een plek moeten hebben,
     dan is de enige manier om de poort te leren kennen een echte inzending -- en
     dan bewaakt de rem niet het misbruik maar het leren. */
  /* mutatie: idempotent -- de proefkeuring bewaart niets */
  app.post('/api/appstore/persoon/proef', auth, metPersoon(false, (req) => Object.assign({ status: 200 },
    appstore.proef({ manifest: req.body.manifest, bestanden: req.body.bestanden }))));

  /* Het naslagwerk, uit dezelfde bron als `rtg sdk` en als het zaakbureau
     (kern/appstore/naslag.js). Ook zonder plek: wie nog niets heeft aangevraagd,
     hoort te kunnen lezen wat er te bouwen valt. */
  /* mutatie: idempotent -- lezen */
  app.post('/api/appstore/persoon/naslag', auth, metPersoon(false, () =>
    Object.assign({ status: 200 }, require('../../kern/appstore/naslag').naslag())));

  /* Het inkoopdossier van mijn eigen app, woord voor woord zoals een klant het
     leest. Alleen de EIGEN app, en die controle staat hier en niet in de kern:
     welke apps van wie zijn is een vraag van de POORT en geen eigenschap van het
     dossier -- dezelfde regel als in ./uitgever.js. */
  /* mutatie: idempotent -- lezen */
  app.post('/api/appstore/persoon/dossier', auth, metPersoon(true, (req, p) => {
    const a = appstore.app(req.body.sleutel);
    if (!a || a.org !== p.org) return { status: 404, error: 'Deze app is niet van jou.' };
    const d = appstore.dossier(a.sleutel);
    if (d.error) return d;
    return Object.assign({}, d, { kanaal: appstore.kanaal(),
      let: 'Dit is woord voor woord wat een klant leest. Je kunt er niets aan veranderen: elk gegeven komt uit een meting op je bundel of uit een besluit van RTG.' });
  }));

  /* WAT ER MET OPZET NIET STAAT: een omzetscherm. Een persoon publiceert gratis
     (kern/appstore/uitgevers.js: magPrijsVragen), dus er valt geen omzet te
     tonen. Een lege omzetpagina zou suggereren dat er ooit iets in komt te
     staan; deze regel zegt waarom dat niet zo is. Dat is dezelfde afspraak als
     overal in deze laag: wat er niet is, staat er met de reden en niet als lege
     waarde (APPSTORE.md, TENANT.md). */
  /* mutatie: idempotent -- lezen */
  app.post('/api/appstore/persoon/omzet', auth, metPersoon(true, () => ({ status: 200, aantal: null,
    nietGebouwd: 'Als persoon publiceer je gratis, dus er is geen omzet. Wil je geld vragen voor een app, dan vraagt RTG een rechtspersoon: vraag een uitgeversplek aan vanuit een zaak.' })));
};
