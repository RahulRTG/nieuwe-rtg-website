/* ============================================================================
   RTG VERTEGENWOORDIGING -- een mens die handelt namens een mens.

   CARRIERE.md par. 6 nummer 5, en volgens twee onafhankelijke metingen het
   enige stuk van deze laag zonder concurrent. Het opent een relatie die in de
   sport en de muziek werkelijk misgaat: een talent van zeventien tekent iets
   wat hij niet leest, en komt er op zijn vijfentwintigste achter wat hij heeft
   weggegeven.

   DE REGELS STAAN IN ./machtiging.js EN NIET HIER. Dit bestand is de opslag en
   de keten: voorstellen, aanvaarden, intrekken, handelen en het spoor. Dat is
   met opzet gescheiden -- zo is het BESLUIT te beproeven zonder een server op
   te starten (dezelfde vorm als kern/economie/firewall.js).

   VIER DINGEN DIE HIER IN CODE STAAN EN NIET IN EEN AFSPRAAK:

   1. AANVAARDEN DOET DE CLIENT, EN NIEMAND ANDERS. Er is geen pad waarlangs een
      vertegenwoordiger zijn eigen machtiging aanzet -- ook niet als hij er al
      een heeft. `aanvaard()` leest de sessiesleutel van de cliënt en vergelijkt
      die met de machtiging; een tweede weg bestaat niet.

   2. DE CLIENT HEEFT EEN EIGEN PLAFOND. `grensZet()` laat een lid zeggen: deze
      bevoegdheid geef ik aan niemand, ooit. Daar versmalt elke machtiging
      tegen, ook een die al loopt -- want een grens die alleen voor NIEUWE
      machtigingen geldt, beschermt precies de mens niet die er al een heeft.

   3. HET SPOOR GROEIT AAN EN WORDT NOOIT HERSCHREVEN. Wat er namens u is
      gedaan, blijft staan als de machtiging is ingetrokken; anders verdwijnt
      het bewijs samen met de bevoegdheid. Intrekken stopt de toekomst, niet het
      verleden.

   4. EEN MINDERJARIGE CLIENT WORDT GEWEIGERD, MET DE REDEN. Het jeugdbestuur
      (CARRIERE.md par. 6 nummer 7) bestaat nog niet, en half bouwen is hier de
      slechtste optie: dan tekent een vijftienjarige alsnog, alleen met een
      scherm ertussen dat zegt dat het goed zit. De poort is `volwassen()` uit
      kern/volwassen.js -- dezelfde die de progressiegrens gebruikt. */
'use strict';

const { BEVOEGDHEDEN, NOOIT, HOEDANIGHEDEN, SLEUTELS, bestaat } = require('./bevoegdheden');
const M = require('./machtiging');
const { simuleer } = require('./simulatie');

const MAX_PER_LID = 40, MAX_LOG = 500;

function maakVertegenwoordiging(state) {
  const { db, save, bijeen, inBundel, crypto, schoon, keyVanCodenaam, codenaamVan, volwassen } = state;

  const vastleggen = require('../../lib/duurzaam')({ bijeen, save, inBundel, bron: 'vertegenwoordiging' });
  const eigen = require('../eigencollectie')({ db, domein: 'kern/vertegenwoordiging',
    bezit: { vertegenwoordigingen: 'kaart' } });

  const nu = () => new Date().toISOString();
  const scho = schoon || ((v, n) => String(v == null ? '' : v).trim().slice(0, n || 200));
  const naam = (k) => (codenaamVan && codenaamVan(k)) || 'een lid';
  const volw = (k) => (typeof volwassen === 'function' ? !!volwassen(k) : false);

  const bak = () => eigen.bak('vertegenwoordigingen');
  const kijk = () => eigen.kijk('vertegenwoordigingen');
  /* OPZOEKEN DOET kijk(), SCHRIJVEN DOET bak() -- zie de kop van
     kern/eigencollectie.js: een verzoek dat op 403 of 404 eindigt, hoort geen
     lege rij achter te laten. */
  const dossiersRuw = () => kijk() || {};
  const dossierKijk = (key) => (kijk() || {})['lid:' + key] || { machtigingen: [], log: [], grens: null };
  function dossier(key) {
    const s = bak();
    const k = 'lid:' + key;
    if (!s[k] || typeof s[k] !== 'object') s[k] = { machtigingen: [], log: [], grens: null };
    const d = s[k];
    if (!Array.isArray(d.machtigingen)) d.machtigingen = [];
    if (!Array.isArray(d.log)) d.log = [];
    return d;
  }

  /* WAT DE CLIENT ZELF HEEFT. Standaard alles wat er is: dit zijn handelingen
     die een mens over zijn eigen leven hoe dan ook mag. Zijn eigen grens
     versmalt dat, en die grens is het enige wat hier vandaag beperkt -- dat
     staat er eerlijk bij in plaats van dat er een lijst wordt gesuggereerd die
     niet bestaat. */
  function bevoegdhedenVan(key) {
    const g = dossierKijk(key).grens;
    if (!Array.isArray(g)) return SLEUTELS.slice();
    return SLEUTELS.filter(k => !g.includes(k));
  }

  const vind = (key, id) => dossierKijk(key).machtigingen.find(m => m.id === String(id || ''));

  function publiek(m, kijkerIsClient) {
    const st = M.stand(m);
    return {
      id: m.id, hoedanigheid: m.hoedanigheid,
      wie: kijkerIsClient ? naam(m.vertegenwoordiger) : naam(m.client),
      rol: kijkerIsClient ? 'vertegenwoordiger' : 'client',
      bevoegdheden: (m.bevoegdheden || []).map(k => Object.assign({ sleutel: k }, BEVOEGDHEDEN[k])),
      plafondCenten: m.plafondCenten, van: m.van, tot: m.tot, stand: st,
      voorgesteldDoor: naam(m.voorgesteldDoor), aanvaard: m.aanvaard || null,
      ingetrokken: m.ingetrokken || null
    };
  }

  /* ---------- lezen ---------- */

  function lijst() {
    return { status: 200, bevoegdheden: SLEUTELS.map(k => Object.assign({ sleutel: k }, BEVOEGDHEDEN[k])),
      nooit: NOOIT.slice(), hoedanigheden: HOEDANIGHEDEN.slice(), maxMaanden: M.MAX_MAANDEN };
  }

  /* HET TEAM OM MIJ HEEN. Beide kanten in een antwoord: wie staat er naast mij,
     en voor wie sta ik. Dat is een LEESweg en hij maakt dus niets aan. */
  function mijn(key) {
    const d = dossierKijk(key);
    const vanMij = d.machtigingen.map(m => publiek(m, true));
    const voorAnderen = [];
    for (const [sleutel, doss] of Object.entries(dossiersRuw())) {
      if (sleutel === 'lid:' + key) continue;
      for (const m of (doss && doss.machtigingen) || []) {
        if (m.vertegenwoordiger === key) voorAnderen.push(publiek(m, false));
      }
    }
    const orde = (a, b) => String(b.van).localeCompare(String(a.van));
    return { status: 200, team: vanMij.sort(orde), ikSta: voorAnderen.sort(orde),
      grens: d.grens || [], volwassen: volw(key),
      log: d.log.slice(0, 100) };
  }

  /* DE SIMULATIE. Hij leest en schrijft niets; ./simulatie.js kent geen db. */
  function simulatie(key, id) {
    const m = vind(key, id);
    if (!m) return { status: 404, error: 'Deze machtiging staat niet in uw dossier.' };
    const huidig = dossierKijk(key).machtigingen
      .find(x => x.id !== m.id && x.vertegenwoordiger === m.vertegenwoordiger && M.stand(x) === 'actief');
    const r = simuleer({ voorstel: m, huidig, magClient: bevoegdhedenVan(key) });
    return Object.assign({ status: 200, id: m.id, wie: naam(m.vertegenwoordiger) }, r);
  }

  return Object.assign({ lijst, mijn, simulatie, bevoegdhedenVan },
    require('./acties')({ dossier, dossierKijk, dossiersRuw, vind, publiek, bevoegdhedenVan,
      vastleggen, nu, scho, crypto, keyVanCodenaam, naam, volw, MAX_PER_LID, MAX_LOG }));
}

module.exports = { maakVertegenwoordiging };
