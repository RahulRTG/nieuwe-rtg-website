/* ============================================================================
   DE BANKHAAK -- het afschrift van de simulatiebank, en een crash op het
   juiste moment. Hoort bij ./betaalpaden.js.

   Een meetserver start met `node --require scripts/lib/betaalhaak.js` en de
   omgeving RTG_BETAALHAAK=<map>. De haak wikkelt de fabriek van
   server/betaal/synthetisch.js in en doet drie dingen, alle drie AAN DE
   KANT VAN DE BANK en geen ervan in de kern:

     afschrift   elke maak en haal komt als regel in <map>/afschrift.jsonl:
                 { soort, sleutel, id, status }. Dat is wat de BANK deed, los
                 van wat RTG daarvan denkt -- en daarmee telt
                 betaalpaden.afschrijvingen() of er twee keer is afgeschreven.
     hang        staat <map>/hang er, dan bevriest het proces direct NA het
                 bankantwoord en VOOR RTG het verwerkt (het bestand gaat eerst
                 weg, en <map>/gevraagd verschijnt). De proef ziet dat en doodt
                 de server: precies de crash tussen verzoek en bevestiging.
                 Bevriezen en niet gooien: een uitzondering is een fout die RTG
                 netjes afhandelt, een stilstaand proces is een stroomstoring.
     bevestig    een id in <map>/bevestig laat haal() van een trage betaling
                 alsnog 'betaald' zeggen: de bank bevestigt later. Zo is "een
                 latere bevestiging wordt verwerkt" te meten zonder een uur te
                 wachten (VERLOOP_MS) -- en zonder de bank zelf te veranderen.

   INERT, BEHALVE OP EEN TESTSERVER MET DE SIMULATIEBANK: NODE_ENV=test,
   RTG_SIMULATIEBANK=1 en RTG_BETAALHAAK gezet. Anders doet hij niets, ook
   als hij per ongeluk wordt voorgeladen. De drie grendels van de bank zelf
   gelden onverkort; deze haak zit erbuiten en opent er geen.
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');

const DOEL = path.join(__dirname, '..', '..', 'server', 'betaal', 'synthetisch.js');

function actief(env) {
  const e = env || process.env;
  return e.NODE_ENV === 'test' && e.RTG_SIMULATIEBANK === '1' && !!e.RTG_BETAALHAAK;
}

function zet(map, naam, regel) {
  if (naam === 'bevestig') fs.appendFileSync(path.join(map, naam), String(regel) + '\n');
  else fs.writeFileSync(path.join(map, naam), String(regel || ''));
}

function afschrift(map) {
  let t = '';
  try { t = fs.readFileSync(path.join(map, 'afschrift.jsonl'), 'utf8'); } catch (e) { return []; }
  return t.split('\n').filter(Boolean).map((r) => JSON.parse(r));
}

/* Bevriezen: het hele proces staat stil, geen timer en geen verzoek loopt nog. */
function bevriesStandaard() { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0); }

function omwikkel(fabriek, { map, bevries = bevriesStandaard } = {}) {
  function bankMetHaak(...args) {
    const bank = fabriek(...args);
    const sleutelVan = new Map(afschrift(map).filter((r) => r.soort === 'maak').map((r) => [r.id, r.sleutel]));
    const noteer = (r) => fs.appendFileSync(path.join(map, 'afschrift.jsonl'), JSON.stringify(r) + '\n');
    const bevestigd = (id) => { try { return fs.readFileSync(path.join(map, 'bevestig'), 'utf8').split('\n').includes(String(id)); } catch (e) { return false; } };
    function maak(opdracht) {
      const res = bank.maak(opdracht);
      const sleutel = (opdracht && opdracht.idempotentieSleutel) || null;
      sleutelVan.set(res.id, sleutel);
      noteer({ soort: 'maak', sleutel, id: res.id, status: res.status });
      const hang = path.join(map, 'hang');
      if (fs.existsSync(hang)) {
        fs.unlinkSync(hang);
        fs.writeFileSync(path.join(map, 'gevraagd'), JSON.stringify({ sleutel, id: res.id, status: res.status }));
        bevries();
      }
      return res;
    }
    function haal(id) {
      let res = bank.haal(id);
      if (res && res.status === 'open' && bevestigd(id)) res = Object.assign({}, res, { status: 'betaald' });
      noteer({ soort: 'haal', sleutel: sleutelVan.get(String(id)) || null, id: String(id), status: res && res.status });
      return res;
    }
    return Object.assign({}, bank, { maak, haal });
  }
  return Object.assign(bankMetHaak, fabriek);
}

/* Voorgeladen: de fabriek inwikkelen zodra de server hem laadt. */
function installeer(env) {
  const Module = require('module');
  const map = env.RTG_BETAALHAAK;
  fs.mkdirSync(map, { recursive: true });
  const oud = Module._load;
  let ingewikkeld = null;
  Module._load = function (verzoek, ouder) {
    const m = oud.apply(this, arguments);
    if (!/synthetisch$|synthetisch\.js$/.test(String(verzoek))) return m;
    let pad;
    try { pad = Module._resolveFilename(verzoek, ouder); } catch (e) { return m; }
    if (pad !== DOEL) return m;
    return ingewikkeld || (ingewikkeld = omwikkel(m, { map }));
  };
}

/* Alleen als hij met --require is voorgeladen; een gewone require (de toets)
   installeert niets. */
const voorgeladen = process.execArgv.some((a, i, l) => (a === '--require' || a === '-r') && l[i + 1] && path.resolve(l[i + 1]) === __filename);
if (voorgeladen && actief(process.env)) installeer(process.env);

module.exports = { actief, zet, afschrift, omwikkel, installeer, DOEL };
