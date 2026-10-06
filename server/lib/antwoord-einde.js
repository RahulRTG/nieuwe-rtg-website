'use strict';
/* Een antwoord heeft veel onafhankelijke naverwerkers: log, meting, audit,
   idempotentie en beleid. Elk daarvan rechtstreeks op `finish` aansluiten
   overschrijdt Node's listenergrens en maakt een echte leak onzichtbaar tussen
   waarschuwingen die alleen door onze eigen middlewarestapel ontstaan.

   Deze poort bewaart de onafhankelijke callbacks, maar hangt per antwoord
   precies een fysieke listener aan. De registratievolgorde blijft behouden.

   `vooraan` is er voor EEN soort taak: de eindstatus (./eindstatus.js) moet
   beslissen voordat een andere naverwerker op dezelfde 'finish' opruimt wat
   nog niet bewaard is. Dat stond eerst als eigen prependListener naast deze
   rij; nu staat het in de rij, als eerste. */
const RIJ = Symbol('rtg.antwoordEinde');

function naAntwoord(res, taak, { vooraan = false } = {}) {
  if (!res || (typeof res.once !== 'function' && typeof res.on !== 'function') ||
      typeof taak !== 'function') return false;
  let rij = res[RIJ];
  if (!rij) {
    rij = [];
    Object.defineProperty(res, RIJ, { value: rij, configurable: true });
    /* EEN BEKENDE LUISTERAAR, EN DE GRENS GAAT PRECIES EEN MEE OMHOOG: deze rij
       is per antwoord een luisteraar, dus geen lek, en zonder ophoging gaf een
       antwoord dat er al tien droeg een MaxListenersExceededWarning (herkeuring
       N11). Een grens van 0 is onbegrensd en blijft dat. */
    if (typeof res.getMaxListeners === 'function' && typeof res.setMaxListeners === 'function') {
      const max = res.getMaxListeners();
      if (max > 0 && Number.isFinite(max)) res.setMaxListeners(max + 1);
    }
    const verbind = typeof res.once === 'function' ? res.once.bind(res) : res.on.bind(res);
    let afgerond = false;
    verbind('finish', () => {
      if (afgerond) return;
      afgerond = true;
      const taken = rij.splice(0);
      try { delete res[RIJ]; } catch (e) { /* de response wordt hierna opgeruimd */ }
      for (const doe of taken) doe();
    });
  }
  if (vooraan) rij.unshift(taak); else rij.push(taak);
  return true;
}

module.exports = { naAntwoord };
