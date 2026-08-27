/* ============================================================================
   DE RTG APP STORE -- het kanaal waarlangs een DERDE een app in dit huis krijgt.

   HET PRINCIPE IN EEN ZIN: een App Store is geen etalage maar een POORT met een
   CEL erachter. De etalage is het makkelijke deel en het minst belangrijke.

   ZES BEGRIPPEN, EN ER KOMT ER GEEN ZEVENDE BIJ.

     uitgever   een `org` (TENANT.md: org IS de klant) die mag inzenden. Door een
                MENS van RTG toegelaten, en intrekbaar.
     app        de identiteit: sleutel, naam, uitgever. Bestaat los van code.
     versie     een onveranderlijke bundel met een hash. Alleen VERSIES worden
                gepubliceerd; "de app" is nooit iets anders dan een versie.
     manifest   wat de app zegt te zijn en wat hij VRAAGT (./manifest.js).
     keuring    de poort: machine (vorm, ./keuring.js) en daarna mens (inhoud).
     machtiging wat een lid werkelijk VERLEENT. Nooit wat het manifest vroeg.

   DE ZES GRENZEN staan voluit in APPSTORE.md met hun herkomst, en NIET ook hier:
   twee plekken die dezelfde regels opschrijven, lopen uit elkaar (LAT-regel 4),
   en dan is de vraag "wat geldt er nu" op twee manieren te beantwoorden. Waar ze
   worden AFGEDWONGEN staat wel hier, bij de code die het doet.

   Dit bestand is de motor. De winkelkant (bladeren, installeren, verlenen) staat
   in ./winkel.js, de uitvoering van de machtigingen in ./brug.js.
   ========================================================================== */
'use strict';

const crypto = require('crypto');
const { datum } = require('../../lib/klok');
const { BUDGET } = require('./keuring');
const { maakOpslag } = require('./bundel');
const { INZENDINGEN_PER_UUR } = require('./versies');

/* De twee levenslopen die dit huis kent, en er komen er geen bij. Ze staan hier
   bij elkaar omdat ze samen het antwoord vormen op "in welke stand kan dit
   staan"; de overgangen zelf worden afgedwongen in ./index.js (uitgever) en
   ./besluit.js (versie). */
const STATUS_VERSIE = ['wacht-op-mens', 'gepubliceerd', 'geweigerd', 'ingetrokken'];

function maakAppstore({ db, save, dir, antivirus, log, pay, findSupplier, bus }) {
  /* De gebeurtenissenstroom loopt over de BUS, en de bus doet de envelop.

     Hier stond eerst een eigen laag (kern/gebeurtenis.js) die zelf een envelop
     maakte en hem op de bus zette. Die is weg, en niet omdat hij stuk was:
     server/bus.js doet sinds OS.md precies hetzelfde voor ELKE publicerende
     plek, inclusief de keten die vanzelf doorloopt. Twee lagen die allebei een
     envelop maken is een tweede berichtformaat binnen een jaar -- wat de kop van
     kern/envelop.js zelf als de fout benoemt (LAT-regel 4).

     Wat een publicist nog wel zelf zegt, zegt hij in `envelop`: WIE het deed en
     hoe gevoelig het is. De rest -- id, tijd, keten, oorzaak -- vult de bus in. */
  const KANAAL = 'rtg:appstore:v1';
  const opslag = maakOpslag({ dir, log });
  const nu = () => datum().toISOString();
  const id = (p) => p + crypto.randomBytes(6).toString('hex');
  const norm = (o) => String(o == null ? '' : o).trim().toUpperCase();
  const eigen = (o, k) => (o && Object.prototype.hasOwnProperty.call(o, String(k)) ? o[String(k)] : null);

  function S() {
    const d = db.data;
    if (!d.appstore || typeof d.appstore !== 'object') d.appstore = {};
    const s = d.appstore;
    for (const k of ['uitgevers', 'apps', 'versies', 'verleend', 'bakjes', 'opslag']) if (!s[k] || typeof s[k] !== 'object') s[k] = {};
    if (!Array.isArray(s.journaal)) s.journaal = [];
    return s;
  }

  /* Het journaal GROEIT AAN en wordt nooit herschreven -- dezelfde regel als het
     actielog van de werelden (PLATFORM.md, de vijfde laag). Elke beslissing over
     een derde is hier terug te vinden, ook een die iemand liever kwijt was. */
  function boek(wat, over, wie, extra) {
    const j = S().journaal;
    j.unshift(Object.assign({ at: nu(), wat, over: over || null, wie: wie || null }, extra || null));
    if (j.length > 5000) j.length = 5000;
    /* En dezelfde regel gaat als GEBEURTENIS naar buiten. Het journaal blijft de
       waarheid -- het groeit aan en wordt nooit herschreven; de uitzending is
       vluchtig en belooft niets (envelop.NIET_GEBOUWD). Twee dingen met een
       eigen taak dus, en geen tweede boekhouding.

       De classificatie is `intern` en niet `persoonsgegeven`: dit journaal noemt
       organisaties en appsleutels, geen mensen. Zou hier ooit een codenaam in
       belanden, dan hoort die classificatie mee te veranderen -- een codenaam
       telt in kern/envelop.js uitdrukkelijk als persoonsgegeven. */
    if (bus && typeof bus.publish === 'function') {
      try {
        bus.publish(KANAAL, {
          /* De OPGAVE aan de bus: alleen wat deze plek weet. Geen id en geen
             tijd -- die verzint een publicist niet zelf. */
          envelop: { actor: wie || undefined, classificatie: 'intern' },
          soort: 'appstore.' + wat, onderwerp: over || null,
          inhoud: extra && typeof extra === 'object' && !Array.isArray(extra) ? extra : {}
        });
      } catch (e) {
        /* Een bus die stukgaat is geen reden om de handeling te laten mislukken,
           maar wel om het te zeggen (LAT-regel 5). Het journaal hierboven is de
           waarheid; de uitzending is vluchtig en belooft niets. */
        try { (log || console.warn)('[appstore] de bus weigerde ' + wat + ': ' + (e && e.message)); } catch (e2) {}
      }
    }
    return j[0];
  }
  const journaal = (n) => S().journaal.slice(0, Math.max(1, Math.min(500, Number(n) || 100)));

  /* Het journaal van EEN uitgever: wat er met zijn eigen inzendingen is gebeurd.
     Tot nu toe zag een uitgever alleen de STAND van een versie -- wachtend,
     live, geweigerd -- en niet wat er onderweg gebeurde. Dat is precies de
     informatie waar hij iets aan heeft, en het is zijn eigen.

     Twee regels. Een regel telt mee als hij OVER zijn app gaat of DOOR zijn
     organisatie is gedaan; wie alleen op `wie` filtert, mist de besluiten die
     een mens van RTG over zijn app nam. En een regel van iemand anders komt er
     nooit uit: de app moet van deze org zijn (APPSTORE.md -- een uitgever ziet
     aantallen en bedragen, nooit een ander). */
  /* Welke apps van een organisatie zijn. Staat hier omdat de motor de apps
     kent; de meter kent ze met opzet niet (die weet alleen sleutels). */
  const uitgeverApps = (org) => Object.values(S().apps).filter(a => a.org === norm(org)).map(a => a.sleutel);

  function journaalVan(org, n) {
    const o = norm(org);
    const eigenApps = new Set(Object.values(S().apps).filter(a => a.org === o).map(a => a.sleutel));
    return S().journaal
      .filter(r => (r.over && eigenApps.has(r.over)) || r.wie === o)
      .slice(0, Math.max(1, Math.min(200, Number(n) || 50)));
  }

  /* Wie hier mag publiceren en wie dat besloot, staat in ./uitgevers.js. Dat is
     een naad en geen opdeling om de omvang: het gaat over een PARTIJ, terwijl de
     rest van dit bestand over BYTES gaat. */
  const U = require('./uitgevers')({ S, save, nu, boek, eigen, norm });
  const { uitgever, magInzenden, uitgeverAanvragen, uitgeverAanvragenPersoon, uitgeverBesluit, publiekU, uitgevers,
    magPrijsVragen, uitgeverVanPersoon } = U;

  /* De versiekant (inzenden, keuren, aftekenen, intrekken) staat in ./versies.js.
     Hij krijgt de motor-delen mee die hij leest -- de opslag, het journaal, de
     uitgeverslijst -- en niet de kern eromheen. */
  const V = require('./versies')({ S, save, nu, boek, opslag, eigen, norm, uitgever, magInzenden, magPrijsVragen, antivirus });
  const { app, versie, inzenden, proef, publiekV } = V;
  /* De toegankelijkheidspoort. Hij wordt VOOR ./besluit.js opgebouwd omdat die
     hem meekrijgt: publiceren kan niet zonder een geslaagde keuring op deze
     bundelhash (besluit 27 augustus 2026, kern/appstore/toegankelijk.js). */
  const toegankelijk = require('./toegankelijk').maakToegankelijk({ S, save, nu, versie, boek });

  /* En het aftekenen apart daarvan (./besluit.js): dat is de ENIGE plek waar een
     versie live gaat, en die scheiding is de reden dat grens 2 na te lezen is
     zonder de hele motor door te moeten. */
  const { wachtrij, besluit, intrekkenKaal, mijnUitgeverij } =
    require('./besluit')({ S, save, nu, boek, eigen, norm, uitgever, publiekU, opslag, app, versie, publiekV, toegankelijk });

  /* De naad met het geld (./naad.js): daar wordt de betaalde kant opgebouwd en
     wordt intrekken uitgebreid met de teruggaverechten. Apart bestand omdat het
     een NAAD is en geen laag -- het is de enige plek waar de store en het geld
     elkaar raken, en dat hoort een naam te hebben. */
  const { geld, intrekken, hercontrole, tijdlijn, noteer, TIJDLIJN_SOORTEN } = require('./naad')({
    S, save, nu, boek, eigen, norm, uitgever, app, versie, opslag, pay, findSupplier, intrekkenKaal });

  const motor = { S, journaal, journaalVan, uitgeverApps, boek, opslag, nu, save, toegankelijk,
    uitgever, uitgevers, uitgeverAanvragen, uitgeverAanvragenPersoon, uitgeverBesluit,
    magInzenden, magPrijsVragen, uitgeverVanPersoon,
    app, versie, inzenden, proef, wachtrij, besluit, intrekken, mijnUitgeverij,
    publiekV, publiekU, eigen, norm, STATUS_VERSIE, STATUS_UITGEVER: U.STATUS_UITGEVER, geld,
    tijdlijn, noteer, hercontrole, TIJDLIJN_SOORTEN };
  /* Het inkoopdossier leest alleen (./dossier.js): wie de leverancier is, wat er
     draait, wat het mag, wat het nooit krijgt en wat wij NIET kunnen aantonen.
     Het hangt achteraan omdat het alles hierboven leest en zelf niets zet. */
  Object.assign(motor, require('./dossier')({ S: motor.S, app: motor.app, versie: motor.versie,
    uitgever: motor.uitgever, opslag: motor.opslag, journaal: motor.journaal, geld }));

  /* De drie lagen komen als EEN geheel naar buiten. Zou de winkel of de brug
     apart moeten worden opgebouwd, dan is er een volgorde die iemand fout kan
     doen, en een halve App Store is erger dan geen. */
  return { appstore: motor,
    appstoreWinkel: require('./winkel').maakWinkel(motor),
    appstoreBrug: require('./brug').maakBrug(motor) };
}

module.exports = { maakAppstore, BUDGET, INZENDINGEN_PER_UUR };
