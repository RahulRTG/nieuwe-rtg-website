/* ============================================================================
   DE AFLOOP VAN DE SIMULATIEBANK VASTLEGGEN -- geen muntworp in een meting.

   De simulatiebank (server/betaal/synthetisch.js) kiest, zonder expliciet
   scenario, de afloop UIT DE HERHAALSLEUTEL: 85 betaald, 7 geweigerd, 5 traag,
   3 terugboeking. Dat is goed voor een spreiding over duizend boekingen en fout
   voor een proef: een sleutel die van een per run andere ref afhangt (een rit,
   een bestelling) maakt de uitslag van die proef een loterij. RITPROEF.json gaf
   zo op 19 oktober 2026 zes schakels stuk (BEWIJSMACHINE.md par. 6a: een
   geldige uitslag van het verkeerde experiment).

   Wat dit bestand levert:
     afloopVan(codenaam, idem)  wat de bank zegt over een oplading of bijlading
                                met die herhaalsleutel (dezelfde afleiding als
                                scripts/lib/voltooizorggeld.js, die hij leest)
     kiesRef(maak, wil, opties) een proef die geen sleutel kiest maar een ref
                                krijgt (een rit), vraagt net zo lang een nieuwe
                                tot de bank de gewenste afloop geeft -- dan ligt
                                de afloop vast in plaats van in het lot
     vraag(afloop, waarvoor) +  wat de proef vroeg, voor het stempel
     bankAan()
     stempelDeel(env)           het veld `simulatiebank` van het stempel:
                                undefined zonder bank, anders { aan, afloop }
                                -- en `afloop` zegt "niet vastgelegd" als de
                                proef niets vroeg
     raaktRail / legtAfloopVast / RAILROUTES / ROEPT_RAIL
                                de herkenning voor test/simulatieafloop.test.js
   ========================================================================== */
'use strict';

/* Routes die de bankrail raken: een oplading, of een betaling die bijlaadt als
   de wallet tekortschiet. Een ONDERGRENS; zie de kop van de toets. */
const RAILROUTES = ['/api/pay/oplaad', '/api/ride/pay', '/api/order/pay', '/api/booking/pay',
  '/api/care/betaal', '/api/care/pakket/betaal', '/api/vonk/betaal', '/api/reisbureau/betaal', '/api/asset/aanvraag/betaal'];
/* Een routeblok dat zichtbaar een van deze aanroept, betaalt. */
const ROEPT_RAIL = /\b(rekenAf|betaalZaak|betaalRit\w*|laadOp|autolaad\w*|boekAsync|betaalOrder\w*|betaalBoeking\w*|betaalBestelling\w*)\s*\(/;

function zonderCommentaar(t) {
  try { return require('./bron').zonderCommentaar(t); } catch (e) { return t; }
}
function raaktRail(tekst) {
  const t = zonderCommentaar(String(tekst || ''));
  return RAILROUTES.filter((p) => new RegExp('[\'"`]' + p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[\'"`]').test(t));
}
function legtAfloopVast(tekst) {
  const t = zonderCommentaar(String(tekst || ''));
  /* Een AANROEP, geen import: een require die niets gebruikt legt niets vast. */
  return /\b(betaaldeSleutel|kiesRef|ritVoor|vulWallet|autolaadAfloop|afloopVan|afloop)\s*\(|\bsimulatie\s*:\s*['"`]\w+['"`]/.test(t);
}

/* De afloop volgens de bank, zonder de bank te vragen: dezelfde afleiding. */
function afloopVan(codenaam, idem) { return require('./voltooizorggeld').afloop(codenaam, idem); }

/* `maak` vraagt een nieuwe ref aan en geeft { antwoord, codenaam, idem } terug
   (idem: de herhaalsleutel waarmee de route straks bijlaadt). Geeft het
   antwoord terug waarvan de afloop `wil` is, met hoeveel pogingen. */
async function kiesRef(maak, wil, { pogingen = 60 } = {}) {
  let laatste = null;
  for (let i = 1; i <= pogingen; i++) {
    const r = await maak();
    laatste = r;
    if (!r || !r.codenaam || !r.idem) return { gevonden: false, poging: i, antwoord: r && r.antwoord, reden: 'de aanvraag gaf geen ref' };
    const afloop = afloopVan(r.codenaam, r.idem);
    if (afloop === wil) { vraag(wil, r.idem); return { gevonden: true, poging: i, antwoord: r.antwoord, afloop }; }
  }
  return { gevonden: false, poging: pogingen, antwoord: laatste && laatste.antwoord, reden: 'in ' + pogingen + ' pogingen gaf de bank geen "' + wil + '"' };
}

let aan = false;
const gevraagd = [];
function bankAan() { aan = true; }
function vraag(afloop, waarvoor) { gevraagd.push({ afloop: String(afloop), waarvoor: String(waarvoor || '').slice(0, 120) }); }
function stempelDeel(env) {
  const e = env || process.env;
  if (!aan && e.RTG_SIMULATIEBANK !== '1') return undefined;
  return { aan: true, afloop: gevraagd.length ? gevraagd.slice() : 'niet vastgelegd: de bank koos per herhaalsleutel (85 betaald, 7 geweigerd, 5 traag, 3 terugboeking)' };
}
function _herstel() { aan = false; gevraagd.length = 0; }

module.exports = { RAILROUTES, ROEPT_RAIL, raaktRail, legtAfloopVast, afloopVan, kiesRef, bankAan, vraag, stempelDeel, _herstel };
