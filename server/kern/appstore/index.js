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

   DE ZES GRENZEN. Ze staan in APPSTORE.md met hun herkomst; hier staan ze omdat
   dit het bestand is dat ze afdwingt.

     1. Derdencode draait nooit op de RTG-herkomst. Er is geen vlag, geen
        vertrouwde uitgever en geen uitzondering die dat verandert.
     2. De machinepoort keurt nooit goed -- hij keurt af of laat door naar een
        mens. En die mens is nooit de uitgever zelf.
     3. Een app ziet codenamen. Nooit een naam, een e-mailadres of een nummer.
     4. Een machtiging die niet is verleend, bestaat niet. De brug kijkt naar wat
        er is VERLEEND en niet naar wat er is gevraagd.
     5. Intrekken werkt onmiddellijk en overal. Een ingetrokken versie valt ook
        weg bij de leden die hem al hadden.
     6. Wat er niet is, staat er met een reden. Niet als lege waarde.

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
const STATUS_UITGEVER = ['aangevraagd', 'toegelaten', 'geweigerd', 'geschorst'];
const STATUS_VERSIE = ['wacht-op-mens', 'gepubliceerd', 'geweigerd', 'ingetrokken'];

function maakAppstore({ db, save, dir, antivirus, log, pay, findSupplier }) {
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
    return j[0];
  }
  const journaal = (n) => S().journaal.slice(0, Math.max(1, Math.min(500, Number(n) || 100)));

  /* ---------------------------------------------------------------- uitgevers */

  function uitgever(org) { return eigen(S().uitgevers, norm(org)); }
  const magInzenden = (org) => { const u = uitgever(org); return !!u && u.status === 'toegelaten'; };

  /* Aanvragen doet de partij zelf; TOELATEN doet een mens van RTG. Dat is geen
     formaliteit: dit is het moment waarop er een aanspreekbare rechtspersoon
     achter een app komt te staan. Een aanvraag die al bestaat, wordt bijgewerkt
     zolang er nog niet over besloten is -- twee aanvragen van dezelfde org zou
     betekenen dat "de uitgever" op twee plekken staat (LAT-regel 4). */
  function uitgeverAanvragen({ org, naam, contact, leverancier }) {
    const o = norm(org);
    if (!/^[A-Z0-9][A-Z0-9-]{1,30}$/.test(o)) return { status: 400, error: 'Een organisatiecode bestaat uit hoofdletters, cijfers en streepjes.' };
    const nm = String(naam || '').trim().slice(0, 120);
    const ct = String(contact || '').trim().slice(0, 160);
    if (nm.length < 2) return { status: 400, error: 'Vul de naam in waaronder je publiceert; die staat straks bij elke app.' };
    if (ct.length < 5) return { status: 400, error: 'Vul een contactadres in waarop RTG je kan bereiken over een inzending.' };
    const bestaand = uitgever(o);
    if (bestaand && bestaand.status === 'toegelaten') return { status: 200, ok: true, uitgever: publiekU(bestaand), al: true };
    if (bestaand && bestaand.status === 'geschorst') return { status: 403, error: 'Deze uitgever is geschorst. Reden: ' + (bestaand.reden || 'niet vastgelegd') + '.' };
    const u = bestaand && bestaand.status === 'aangevraagd'
      ? Object.assign(bestaand, { naam: nm, contact: ct, leverancier: leverancier || bestaand.leverancier || null, at: nu() })
      : { org: o, naam: nm, contact: ct, leverancier: leverancier || null, status: 'aangevraagd', reden: null, at: nu(), besloten: null };
    S().uitgevers[o] = u;
    boek('uitgever-aangevraagd', o, leverancier || null, { naam: nm });
    save();
    return { status: 200, ok: true, uitgever: publiekU(u) };
  }

  /* De mens van RTG beslist. `door` is wie er tekent en gaat mee het journaal in;
     een besluit zonder naam is een besluit dat niemand heeft genomen. */
  function uitgeverBesluit({ org, besluit, reden, door }) {
    const u = uitgever(org);
    if (!u) return { status: 404, error: 'Deze uitgever bestaat niet.' };
    if (!STATUS_UITGEVER.includes(besluit) || besluit === 'aangevraagd') return { status: 400, error: 'Een besluit is toegelaten, geweigerd of geschorst.' };
    const wie = String(door || '').trim().slice(0, 80);
    if (!wie) return { status: 400, error: 'Zet je naam erbij: een besluit over een uitgever hoort een mens te hebben genomen.' };
    if (besluit !== 'toegelaten' && String(reden || '').trim().length < 5) return { status: 400, error: 'Een weigering of schorsing draagt een reden; die krijgt de uitgever te lezen.' };
    u.status = besluit;
    u.reden = besluit === 'toegelaten' ? null : String(reden || '').trim().slice(0, 400);
    u.besloten = { door: wie, at: nu() };
    /* Een geschorste uitgever verliest zijn etalage onmiddellijk. Zou dat pas bij
       de volgende publicatie gebeuren, dan blijft een app van een partij waar we
       net afscheid van namen gewoon draaien bij de leden. */
    let gevallen = 0;
    if (besluit !== 'toegelaten') {
      for (const a of Object.values(S().apps)) {
        if (a.org !== u.org || !a.live) continue;
        const v = eigen(S().versies, a.live);
        if (v) v.status = 'ingetrokken';
        a.live = null; a.ingetrokken = { at: nu(), door: wie, reden: 'de uitgever is ' + besluit };
        gevallen++;
      }
    }
    boek('uitgever-' + besluit, u.org, wie, { reden: u.reden, appsGevallen: gevallen });
    save();
    return { status: 200, ok: true, uitgever: publiekU(u), appsGevallen: gevallen };
  }

  const publiekU = (u) => ({ org: u.org, naam: u.naam, contact: u.contact, status: u.status, reden: u.reden || null, at: u.at, besloten: u.besloten || null });
  const uitgevers = () => Object.values(S().uitgevers).map(publiekU);

  /* De versiekant (inzenden, keuren, aftekenen, intrekken) staat in ./versies.js.
     Hij krijgt de motor-delen mee die hij leest -- de opslag, het journaal, de
     uitgeverslijst -- en niet de kern eromheen. */
  const V = require('./versies')({ S, save, nu, boek, opslag, eigen, norm, uitgever, magInzenden, antivirus });
  const { app, versie, inzenden, proef, publiekV } = V;
  /* En het aftekenen apart daarvan (./besluit.js): dat is de ENIGE plek waar een
     versie live gaat, en die scheiding is de reden dat grens 2 na te lezen is
     zonder de hele motor door te moeten. */
  const { wachtrij, besluit, intrekken: intrekkenKaal, mijnUitgeverij } =
    require('./besluit')({ S, save, nu, boek, eigen, norm, uitgever, publiekU, opslag, app, versie, publiekV });

  /* De naad met het geld (./naad.js): daar wordt de betaalde kant opgebouwd en
     wordt intrekken uitgebreid met de teruggaverechten. Apart bestand omdat het
     een NAAD is en geen laag -- het is de enige plek waar de store en het geld
     elkaar raken, en dat hoort een naam te hebben. */
  const { geld, intrekken } = require('./naad')({
    S, save, nu, boek, eigen, norm, uitgever, app, versie, pay, findSupplier, intrekkenKaal });

  const motor = { S, journaal, boek, opslag, nu, save,
    uitgever, uitgevers, uitgeverAanvragen, uitgeverBesluit, magInzenden,
    app, versie, inzenden, proef, wachtrij, besluit, intrekken, mijnUitgeverij,
    publiekV, publiekU, eigen, norm, STATUS_VERSIE, STATUS_UITGEVER, geld };

  /* De drie lagen komen als EEN geheel naar buiten. Zou de winkel of de brug
     apart moeten worden opgebouwd, dan is er een volgorde die iemand fout kan
     doen, en een halve App Store is erger dan geen. */
  return { appstore: motor,
    appstoreWinkel: require('./winkel').maakWinkel(motor),
    appstoreBrug: require('./brug').maakBrug(motor) };
}

module.exports = { maakAppstore, BUDGET, INZENDINGEN_PER_UUR };
