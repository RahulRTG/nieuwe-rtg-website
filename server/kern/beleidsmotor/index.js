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

  /* DE STAND staat in ./stand.js: hoe de tellers gelezen worden is een eigen
     onderwerp naast hoe ze ontstaan. */
  const stand = () => require('./stand')({
    beeld: spoeler.projecteer(JSON.parse(JSON.stringify(kijk() || {}))),
    dagen: Math.floor((tijd() - sinds) / DAG), sinds, oneens: oneensVoorbeelden, verklaardOpen: VERKLAARD_OPEN });

  /* WAAROM (AUTHORITY.md fase 8, het eerste stuk): per deur het besluit over
     DEZE aanroeper, met de opbouw. Alleen over jezelf -- een vraag over een
     ander is een rechtensimulator, en die hoort achter de boardroom met een
     reden (een volgende stap). Er staan geen feiten in het antwoord die de
     aanroeper niet al over zichzelf weet. */
  function waarom(req) {
    const f = feitenVan(req);
    return Object.keys(DEUREN).map(deur => {
      const b = kan(f, deur);
      return { deur, uitleg: DEUREN[deur].uitleg, uitkomst: b.uitkomst, reden: b.reden,
        opbouw: b.opbouw.map(o => ({ eis: o.eis.map(n => FEITEN[n] || n), gehaald: o.gehaald, onbekend: o.onbekend })) };
    });
  }

  return { kan: (req, deur) => kan(feitenVan(req), deur), waarom, bewaak, meelezer, stand, spoel: spoeler.spoel };
}

module.exports = { maakBeleidsmotor, VERKLAARD_OPEN, VELDEN };
