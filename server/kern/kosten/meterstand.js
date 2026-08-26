/* EEN STAND PEILEN IN PLAATS VAN OPTELLEN.

   Afgesplitst van ./meter.js, en de naad ligt op een echt verschil in
   MECHANISME. Die module telt op wat er langskomt: tokens, verzoeken, berichten,
   transacties. Dat zijn stromen. Opslag is een stand -- er STAAT op enig moment
   zoveel -- en die tel je niet op maar meet je.

   Wie een stand als stroom telt, rekent een lid dat een maand lang niets doet bij
   elke peiling opnieuw zijn hele kluis aan, en dan groeit de rekening van wie
   niets doet het hardst.

   HET GEMIDDELDE EN NIET DE LAATSTE. Een GB-maand is een oppervlakte en geen
   momentopname: wie op de dertigste alles weggooit, heeft die maand wel degelijk
   opslag gebruikt. Het aantal peilingen gaat mee, zodat het overzicht kan zeggen
   hoe hard dat gemiddelde is.

   Deelt de opslag van ./meter.js (pak, spoel, snoei) en schrijft rechtstreeks:
   een peiling is zeldzaam -- hooguit een paar per uur -- en het gemiddelde moet
   de vorige stand kennen, dus de schrijfbuffer van de stromen helpt hier niet. */
'use strict';

const { soort } = require('./soorten');

module.exports = ({ pak, spoel, snoei, save, nu, periodeVan, MAX_AANTAL }) => {
  /* Zie de kop van dit bestand voor waarom dit peilen is en geen optellen. */
  function peil({ drager, soort: soortId, waarde, tijd }) {
    const s = soort(soortId);
    if (!s || s.aard !== 'stand') return false;
    const v = Number(waarde);
    if (!Number.isFinite(v) || v < 0 || v > MAX_AANTAL) return false;
    spoel();
    const rij = pak(periodeVan(tijd), drager);
    const p = rij.peilingen || (rij.peilingen = {});
    const n = (p[s.id] || 0) + 1;
    const oud = rij[s.id] || 0;
    p[s.id] = n;
    /* NEGEN DECIMALEN EN NIET DRIE, en dat is geen vormkwestie. Een stand staat
       in gigabytes; drie decimalen is een megabyte, en dan is een lid met een
       paar bestanden in zijn kluis exact nul. Nul betekent in deze laag "geen
       opslag", en dat is een andere bewering dan "weinig opslag". Negen
       decimalen is byte-nauwkeurig in GB, en dat is precies genoeg. */
    rij[s.id] = Math.round((oud + (v - oud) / n) * 1e9) / 1e9;   // lopend gemiddelde
    rij.laatst = nu();
    snoei();
    try { save(); } catch (e) {}
    return true;
  }

  return { peil };
};
