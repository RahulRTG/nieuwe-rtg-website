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
  const { db, save, crypto, schoon, anthropic, sseToOffice, beveilig, keyVanCodenaam, sseToCustomer } = deps;
  const nu = () => Date.now();
  const d = () => db.data;

  const ONLINE_MS = 10 * 60 * 1000;   // een doos die 10 min niets liet horen is offline
  const MAX_METINGEN = 20000;         // begrensd venster; het beeld leeft op het heden

  function zones() { if (!Array.isArray(d().stadZones)) d().stadZones = []; return d().stadZones; }
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
  const ctx = { db, save, crypto, schoon, anthropic, beveilig, nu, d,
    ONLINE_MS, MAX_METINGEN, zones, nodes, metingen, regie, seintje };

  const dom = require('./domeinen')(ctx);
  ctx.DOMEINEN = dom.DOMEINEN; ctx.standVan = dom.standVan; ctx.alerts = dom.alerts;
  const vloot = require('./nodes')(ctx);
  ctx.zorgBasis = vloot.zorgBasis; ctx.simuleer = vloot.simuleer;
  const sce = require('./scenario')(ctx);
  ctx.SCENARIOS = sce.SCENARIOS;
  // een live seintje naar een bewoner (bijv. "je melding is opgepakt")
  ctx.bewonerSeintje = (codenaam) => {
    try { Promise.resolve(keyVanCodenaam(codenaam)).then(t => { if (t && t.key) sseToCustomer(t.key, 'sync', { scope: 'stad' }); }).catch(() => {}); } catch (e) {}
  };
  const adv = require('./advies')(ctx);
  const bew = require('./bewoner')(ctx);   // zet ctx.meldingKlaar + ctx.openMeldingKlussen
  const veld = require('./veldwerk')(ctx); // en veldwerk neemt die klussen op

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
  Object.assign(api, vloot.api, dom.api, sce.api, adv, bew.api, veld.api);
  return { stad: api };
};
