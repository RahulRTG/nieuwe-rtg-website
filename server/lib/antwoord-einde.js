'use strict';
/* Een antwoord heeft veel onafhankelijke naverwerkers: log, meting, audit,
   idempotentie en beleid. Elk daarvan rechtstreeks op `finish` aansluiten
   overschrijdt Node's listenergrens en maakt een echte leak onzichtbaar tussen
   waarschuwingen die alleen door onze eigen middlewarestapel ontstaan.

   Deze poort bewaart de onafhankelijke callbacks, maar hangt per antwoord
   precies een fysieke listener aan. De registratievolgorde blijft behouden. */
const RIJ = Symbol('rtg.antwoordEinde');

function naAntwoord(res, taak) {
  if (!res || (typeof res.once !== 'function' && typeof res.on !== 'function') ||
      typeof taak !== 'function') return false;
  let rij = res[RIJ];
  if (!rij) {
    rij = [];
    Object.defineProperty(res, RIJ, { value: rij, configurable: true });
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
  rij.push(taak);
  return true;
}

module.exports = { naAntwoord };
