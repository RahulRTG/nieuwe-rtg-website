/* DE BELEIDSMOTOR -- fase 1 van AUTHORITY.md: meelopen, niet beslissen.

   Besluit A1 (vervangen, geleidelijk) en A3 (default-deny, eerst in de schaduw)
   van 23 september 2026 komen hier samen. De motor kent de kantoordeuren als
   gegevens (./regels.js) en velt bij elke aanroep een eigen besluit naast dat van
   de poort die vandaag afdwingt. Twee dingen worden geteld, en verder niets:

     A1  was de motor het eens met de poort?   (eens / oneens / onbekend)
     A3  liep er een kantoorroute zonder enige poort die de motor kent?
                                                (zonderPoort -- default-deny zou
                                                 die weigeren)

   ER IS GEEN TAK DIE IETS TEGENHOUDT. `bewaak` geeft de poort ongewijzigd door
   en kijkt na afloop; een fout in de motor raakt geen antwoord. Pas als de
   schaduw rijp is (dezelfde eis als ../commercie/schaduw.js: 200 waarnemingen
   over 7 dagen) EN er nul keer oneens is, kan een deur verhuizen. Dat is een
   volgende stap met een eigen besluit, niet iets wat deze module zelf doet.

   EEN TELLER EN GEEN JOURNAAL (de grens van ../kantoor/mensdeur.js, woord voor
   woord): per deur en routepatroon een paar getallen, geen wie, geen wanneer.
   De enige voorbeelden zijn die van ONEENS, in het geheugen, zonder sleutel of
   naam -- alleen welke feiten er klopten. Een oneens zonder voorbeeld is niet te
   repareren; een voorbeeld met een naam is een gedragslogboek over personeel.

   De sleutel is het ROUTEPATROON (door de router gezet), nooit het rauwe pad: een
   pad komt van buiten en zou de opslag laten groeien. */
'use strict';

const { kan, DEUREN, FEITEN, UITKOMST, STAPOP_DEUREN } = require('./regels');
const { maakFeiten } = require('./feiten');
const { RIJP } = require('../commercie/schaduw');

const VELDEN = ['eens', 'oneens', 'onbekend', 'zonderPoort', 'eigenaarZonderStapop'];
const MAX_SLEUTELS = 2400;   // ~600 kantoorroutes maal hoogstens vier deuren
const VOORBEELDEN = 20;
const DAG = 86400000;

/* Kantoorroutes die met opzet geen poort van de motor dragen, elk met de reden.
   Een route op deze lijst telt niet als zonderPoort; een route die er ten
   onrechte op staat, verbergt een gat -- vandaar de reden, en de toets die
   zakt als een verklaring naar een route wijst die niet bestaat. */
const VERKLAARD_OPEN = Object.freeze({
  'POST /api/office/login': 'de inlog zelf: wie hier komt, heeft nog geen sessie',
  'GET /api/office/stream': 'de live-stroom; het token komt als query binnen en wordt daar gecontroleerd (officeQueryMag)',
  'GET /api/office/doc': 'een paspoortscan in een <img>: het token komt als query binnen en moet op naam zijn (officeQueryOpNaam)'
});

function maakBeleidsmotor({ db, save, bewerkCollectie, sessionFor, accounts, eigenaar, boardroomWie, magBoardroom, boardroomBaas, balieBron, nu }) {
  const tijd = nu || Date.now;
  const eigen = require('../eigencollectie')({ db, domein: 'kern/beleidsmotor', bezit: { beleidsmotor: 'kaart' } });
  const bak = () => eigen.bak('beleidsmotor');
  const kijk = () => eigen.kijk('beleidsmotor');
  const spoeler = require('../kantoor/mensdeur-spoel').maakSpoeler({
    bak, save, bewerkCollectie, collectie: 'beleidsmotor', maxPaden: MAX_SLEUTELS, velden: VELDEN });
  const feitenVan = maakFeiten({ sessionFor, accounts, eigenaar, boardroomWie, magBoardroom, boardroomBaas, balieBron });
  const oneensVoorbeelden = [];
  const sinds = tijd();

  const patroon = (req) => (req.method || 'GET') + ' ' + (req.routePatroon || '(geen patroon)');

  /* DE POORT MET EEN MEELOPER ERNAAST. Zelfde naam als de poort: de registers
     van dit huis herkennen een poortwachter aan zijn naam (zie de kop van
     ../kantoor/kluispoort.js). */
  function bewaak(deur, poort) {
    if (!DEUREN[deur]) throw new Error('beleidsmotor: onbekende deur ' + deur);
    const gewikkeld = function (req, res, next) {
      let besluit = null, feiten = null;
      try {
        (req.beleidsPoorten || (req.beleidsPoorten = [])).push(deur);
        feiten = feitenVan(req);
        besluit = kan(feiten, deur);
      } catch (e) { besluit = null; }
      let door = false;
      if (besluit && res && typeof res.once === 'function') {
        res.once('finish', () => {
          try {
            vergelijk(deur, patroon(req), door, besluit);
            /* A2 in de schaduw: de eigenaar door een gevoelige deur, zonder
               stap-op. Alleen als hij er echt doorheen ging. */
            if (door && feiten && feiten.eigenaarMens === true && STAPOP_DEUREN.includes(deur)) {
              spoeler.tikVeld('stapop ' + deur + ' ' + patroon(req), 'eigenaarZonderStapop');
            }
          } catch (e) { /* een meting raakt geen antwoord */ }
        });
      }
      return poort(req, res, function () { door = true; return next.apply(this, arguments); });
    };
    Object.defineProperty(gewikkeld, 'name', { value: poort.name || deur });
    return gewikkeld;
  }

  function vergelijk(deur, sleutel, door, besluit) {
    const k = deur + ' ' + sleutel;
    if (besluit.uitkomst === UITKOMST.ONBEKEND) return spoeler.tikVeld(k, 'onbekend');
    const eens = (besluit.uitkomst === UITKOMST.TOESTAAN) === door;
    spoeler.tikVeld(k, eens ? 'eens' : 'oneens');
    if (!eens) {
      oneensVoorbeelden.unshift({ deur, route: sleutel, poort: door ? 'TOESTAAN' : 'WEIGEREN',
        motor: besluit.uitkomst, opbouw: besluit.opbouw });
      oneensVoorbeelden.length = Math.min(oneensVoorbeelden.length, VOORBEELDEN);
    }
  }

  /* A3 IN DE SCHADUW: hangt VOOR de kantoorroutes en kijkt na afloop of er een
     poort van de motor heeft gelopen. Een 404 is geen route; die telt niet. */
  function meelezer(req, res, next) {
    if (res && typeof res.once === 'function') {
      res.once('finish', () => {
        try {
          if (req.beleidsPoorten && req.beleidsPoorten.length) return;
          if (!req.routePatroon || res.statusCode === 404) return;
          const sleutel = patroon(req);
          if (VERKLAARD_OPEN[sleutel]) return;
          spoeler.tikVeld('geen-poort ' + sleutel, 'zonderPoort');
        } catch (e) { /* idem */ }
      });
    }
    next();
  }

  /* DE STAND. Drie bakken en geen percentage, en de rijpheid per deur apart: een
     deur die rijp is en nul keer oneens, kan verhuizen; de rest niet. */
  function stand() {
    const beeld = spoeler.projecteer(JSON.parse(JSON.stringify(kijk() || {})));
    const perDeur = {};
    const zonderPoort = [];
    const stapop = [];
    for (const r of Object.values(beeld)) {
      if (r.pad.startsWith('stapop ')) {
        const [, deur, ...rest] = r.pad.split(' ');
        stapop.push({ deur, route: rest.join(' '), keer: r.eigenaarZonderStapop || 0 });
        continue;
      }
      if (r.pad.startsWith('geen-poort ')) {
        zonderPoort.push({ route: r.pad.slice(11), keer: r.zonderPoort || 0 });
        continue;
      }
      const deur = r.pad.split(' ')[0];
      const d = perDeur[deur] || (perDeur[deur] = { eens: 0, oneens: 0, onbekend: 0, routes: 0 });
      d.eens += r.eens || 0; d.oneens += r.oneens || 0; d.onbekend += r.onbekend || 0; d.routes += 1;
    }
    const dagen = Math.floor((tijd() - sinds) / DAG);
    const deuren = Object.keys(DEUREN).map(deur => {
      const d = perDeur[deur] || { eens: 0, oneens: 0, onbekend: 0, routes: 0 };
      const waarnemingen = d.eens + d.oneens;
      const tekort = [];
      if (waarnemingen < RIJP.minWaarnemingen) tekort.push(waarnemingen + ' van ' + RIJP.minWaarnemingen + ' waarnemingen');
      if (dagen < RIJP.minDagen) tekort.push(dagen + ' van ' + RIJP.minDagen + ' dagen in dit proces');
      return Object.assign({ deur, poort: DEUREN[deur].poort, eisen: DEUREN[deur].eisen }, d, {
        kanVerhuizen: !tekort.length && d.oneens === 0,
        waarom: d.oneens ? d.oneens + ' keer oneens; eerst verklaren en repareren'
          : (tekort.length ? 'nog niet rijp: ' + tekort.join(', ') : 'rijp, en nooit oneens') });
    });
    return {
      uitleg: 'De beleidsmotor loopt in de schaduw mee met de vier kantoordeuren (AUTHORITY.md fase 1, besluiten A1 en A3). ' +
        'Hij houdt niets tegen.',
      grens: 'Een teller en geen journaal. De schaduw bewijst dat de SAMENSTELLING van de regels gelijk is aan die van de ' +
        'poorten; de feiten lezen dezelfde bronnen, dus een fout in een bron zit aan beide kanten. ONBEKEND is geen WEIGEREN.',
      rijp: RIJP, meetSinds: new Date(sinds).toISOString(),
      rijpheidNoot: 'De dagen tellen sinds dit proces startte; de getallen zelf blijven over herstarts staan.',
      deuren,
      feiten: FEITEN,
      oneens: oneensVoorbeelden.slice(),
      zonderPoort: zonderPoort.sort((a, b) => b.keer - a.keer).slice(0, 100),
      zonderPoortTotaal: zonderPoort.length,
      /* Besluit A2 in de schaduw: waar de eigenaar door een gevoelige deur ging
         zonder stap-op. Zodra dit afdwingt, vraagt elk van deze een passkey en een
         reden -- ook van hem. */
      eigenaarZonderStapop: stapop.sort((a, b) => b.keer - a.keer).slice(0, 100),
      stapopDeuren: STAPOP_DEUREN,
      verklaardOpen: VERKLAARD_OPEN
    };
  }

  return { kan: (req, deur) => kan(feitenVan(req), deur), bewaak, meelezer, stand, spoel: spoeler.spoel };
}

module.exports = { maakBeleidsmotor, VERKLAARD_OPEN, VELDEN };
