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
  /* De gebeurtenissenstroom. Hij mag ontbreken -- de App Store werkt zonder bus
     precies zoals hij altijd deed -- maar is hij er, dan gaat elke journaalregel
     ook als envelop naar buiten (kern/gebeurtenis.js). */
  const gebeurtenis = require('../gebeurtenis').maakGebeurtenis({ bus, log });
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

       De klasse is `intern` en niet `codenaam`: dit journaal noemt organisaties
       en appsleutels, geen mensen. Zou hier ooit een codenaam in belanden, dan
       hoort die klasse mee te veranderen -- daar zakt test/gebeurtenis.test.js
       op. */
    gebeurtenis.meld(require('../gebeurtenis').soortVan('appstore', wat), {
      bron: 'kern/appstore',
      klasse: 'intern',
      onderwerp: over || '',
      actor: wie || '',
      lading: extra && typeof extra === 'object' && !Array.isArray(extra) ? extra : {}
    });
    return j[0];
  }
  const journaal = (n) => S().journaal.slice(0, Math.max(1, Math.min(500, Number(n) || 100)));

  /* Wie hier mag publiceren en wie dat besloot, staat in ./uitgevers.js. Dat is
     een naad en geen opdeling om de omvang: het gaat over een PARTIJ, terwijl de
     rest van dit bestand over BYTES gaat. */
  const U = require('./uitgevers')({ S, save, nu, boek, eigen, norm });
  const { uitgever, magInzenden, uitgeverAanvragen, uitgeverBesluit, publiekU, uitgevers } = U;

  /* De versiekant (inzenden, keuren, aftekenen, intrekken) staat in ./versies.js.
     Hij krijgt de motor-delen mee die hij leest -- de opslag, het journaal, de
     uitgeverslijst -- en niet de kern eromheen. */
  const V = require('./versies')({ S, save, nu, boek, opslag, eigen, norm, uitgever, magInzenden, antivirus });
  const { app, versie, inzenden, proef, publiekV } = V;
  /* En het aftekenen apart daarvan (./besluit.js): dat is de ENIGE plek waar een
     versie live gaat, en die scheiding is de reden dat grens 2 na te lezen is
     zonder de hele motor door te moeten. */
  const { wachtrij, besluit, intrekkenKaal, mijnUitgeverij } =
    require('./besluit')({ S, save, nu, boek, eigen, norm, uitgever, publiekU, opslag, app, versie, publiekV });

  /* De naad met het geld (./naad.js): daar wordt de betaalde kant opgebouwd en
     wordt intrekken uitgebreid met de teruggaverechten. Apart bestand omdat het
     een NAAD is en geen laag -- het is de enige plek waar de store en het geld
     elkaar raken, en dat hoort een naam te hebben. */
  const { geld, intrekken, hercontrole, tijdlijn, noteer, TIJDLIJN_SOORTEN } = require('./naad')({
    S, save, nu, boek, eigen, norm, uitgever, app, versie, opslag, pay, findSupplier, intrekkenKaal });

  const motor = { S, journaal, boek, opslag, nu, save,
    uitgever, uitgevers, uitgeverAanvragen, uitgeverBesluit, magInzenden,
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
