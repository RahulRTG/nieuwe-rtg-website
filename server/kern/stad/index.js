/* RTG Stad: het slimme-stad-platform van het huis, op EIGEN hardware en EIGEN
   software. De hardware is de Stadsdoos (dezelfde familie als de Zaakdoos in de
   zaken): een kastje in de openbare ruimte dat met een eigen apparaat-sleutel
   metingen instuurt -- verkeer, lucht, geluid, energie, water, afval, licht,
   parkeren. De software is dit bord: per domein een stand en een regime, en
   EEN scenario-knop in de boardroom die de hele stad in een stand zet
   (nacht / rustig / normaal / druk / evenement / nood).

   PRIVACY BY DESIGN, net als de rest van het huis: de stad meet DINGEN, geen
   mensen. Geen camera's, geen kentekens, geen volgen van personen; alleen
   tellingen en toestanden per zone. De AI-stadsregisseur adviseert; besluiten
   over de openbare ruimte neemt een mens in de boardroom.

   Dit is de orkestrator: het stadsbeeld en de gedeelde ctx wonen hier; de
   Stadsdoos-vloot in ./nodes, de domeinen/regimes in ./domeinen, de
   scenario-knop in ./scenario en de AI in ./advies. */

module.exports = (deps) => {
  const { db, save, crypto, schoon, anthropic, sseToOffice, beveilig, weefsel } = deps;
  /* Het stadsweefsel is geen optie maar een voorwaarde: de zones, de plaats van
     elke Stadsdoos, het geheugen achter de metingen en de zaken achter de
     bewonersmeldingen wonen daar. Een stille terugval op een eigen zonelijstje
     zou precies de dubbele waarheid terugbrengen die deze laag wegnam, dus dit
     valt hard om bij het opstarten in plaats van scheef te gaan lopen. */
  if (!weefsel || typeof weefsel.weefselZones !== 'function')
    throw new Error('kern/stad heeft kern/stadsweefsel nodig (mount het weefsel eerder in server.js)');
  const nu = () => Date.now();
  const d = () => db.data;

  const ONLINE_MS = 10 * 60 * 1000;   // een doos die 10 min niets liet horen is offline
  const MAX_METINGEN = 20000;         // begrensd venster; het beeld leeft op het heden

  /* De zones komen uit de geografie van het weefsel. Ze stonden hier als een
     eigen lijstje in db.data.stadZones; dat was dezelfde waarheid op twee
     plekken, en die lopen uiteen zodra iemand een zone toevoegt -- dan meldt
     een bewoner iets in een zone die de veldploeg niet kent. */
  function zones() { return weefsel.weefselZones(); }
  function nodes() { if (!d().stadNodes || typeof d().stadNodes !== 'object') d().stadNodes = {}; return d().stadNodes; }
  function metingen() { if (!Array.isArray(d().stadMetingen)) d().stadMetingen = []; return d().stadMetingen; }
  function regie() {
    if (!d().stadRegie || typeof d().stadRegie !== 'object') d().stadRegie = {};
    const s = d().stadRegie;
    if (!s.scenario) s.scenario = 'normaal';
    if (!s.regimes || typeof s.regimes !== 'object') s.regimes = {};
    return s;
  }

  const seintje = () => { try { if (sseToOffice) sseToOffice('sync', { scope: 'stad' }); } catch (e) {} };

  /* De verkeers-naad (laat gebonden): het verkeersdomein kijkt ook naar de
     eigen OV-vloot -- hoeveel voertuigen zijn er NU met een verse positie
     onderweg. Geteld, geen routes en geen personen. */
  let verkeerBron = null;
  function koppelVerkeer(fn) { if (typeof fn === 'function') verkeerBron = fn; }

  // de gedeelde context voor de deelbestanden
  const ctx = { db, save, crypto, schoon, anthropic, beveilig, nu, d, weefsel,
    ONLINE_MS, MAX_METINGEN, zones, nodes, metingen, regie, seintje };

  // de OV-telling ook voor de deelbestanden (o.a. het bewonersbeeld)
  ctx.verkeerExtra = () => { if (!verkeerBron) return null; try { return verkeerBron(); } catch (e) { return null; } };
  const dom = require('./domeinen')(ctx);
  ctx.DOMEINEN = dom.DOMEINEN; ctx.standVan = dom.standVan; ctx.alerts = dom.alerts;
  const vloot = require('./nodes')(ctx);
  ctx.zorgBasis = vloot.zorgBasis; ctx.simuleer = vloot.simuleer;
  /* De productkant van de Stadsdoos (levenscyclus, paspoort, sleutelrotatie,
     ondertekende updates, kalibratie, sabotage) staat in ./apparaat.js. Hij
     wordt NA nodes gemount omdat de poort daar woont, en nodes gebruikt hem via
     de ctx -- late binding, want de hartslag van een doos komt pas als beide
     delen er allang staan. */
  const app = require('./apparaat')(ctx); ctx.apparaat = app;
  const sce = require('./scenario')(ctx);
  ctx.SCENARIOS = sce.SCENARIOS;
  /* Het live seintje naar een melder ("je melding is opgepakt") hangt nu aan de
     zaakmotor van het weefsel: die weet wanneer een zaak verandert, en bedient
     elk kanaal in plaats van alleen dit scherm. server.js geeft dezelfde
     codenaam->sessie-vertaling daar mee, dus de bewoner ziet hetzelfde. */
  const adv = require('./advies')(ctx);
  const bew = require('./bewoner')(ctx);   // meldingen -> de zaakmotor van het weefsel
  const veld = require('./veldwerk')(ctx); // en de werkorders daarvan komen hier op de lijst

  /* Het stadsbeeld: alles wat de boardroom in een oogopslag nodig heeft.
     De demovloot leeft mee (simuleer): zolang er geen echte hardware hangt,
     schuiven de demowaarden geloofwaardig door. */
  function beeld() {
    vloot.zorgBasis();
    vloot.simuleer();
    const rij = Object.values(nodes()).filter(n => n.actief);
    const online = rij.filter(n => nu() - (n.laatsteContact || 0) < ONLINE_MS).length;
    const r = regie();
    return {
      status: 200,
      scenario: r.scenario,
      scenarios: sce.SCENARIOS.map(s => ({ naam: s.naam, label: s.label, uitleg: s.uitleg })),
      domeinen: dom.DOMEINEN.map(x => {
        const rij = { id: x.id, label: x.label, eenheid: x.eenheid,
          regimes: x.regimes, regime: r.regimes[x.id] || x.regimes[0], ...dom.standVan(x.id) };
        if (x.id === 'verkeer' && verkeerBron) { try { rij.ovOnderweg = Number(verkeerBron().ovOnderweg) || 0; } catch (e) {} }
        return rij;
      }),
      alerts: dom.alerts(),
      zones: zones().slice(),
      nodes: rij.map(n => ({ serial: n.serial, naam: n.naam, zone: n.zone, sensoren: n.sensoren,
        demo: !!n.demo, online: nu() - (n.laatsteContact || 0) < ONLINE_MS,
        laatsteContact: n.laatsteContact || null })),
      vloot: { totaal: rij.length, online, offline: rij.length - online },
      privacy: "de stad meet dingen, geen mensen: tellingen en toestanden per zone, geen camera's of persoonsvolging"
    };
  }

  const api = { stadBeeld: beeld, stadKoppelVerkeer: koppelVerkeer };
  Object.assign(api, vloot.api, app.api, dom.api, sce.api, adv, bew.api, veld.api);
  return { stad: api };
};
