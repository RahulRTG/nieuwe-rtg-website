'use strict';

function pastBijSloSelectie(kies, reeks) {
  if (!kies) return false;
  if (Array.isArray(kies.methoden) && !kies.methoden.includes(reeks.methode)) return false;
  if (kies.routeBegintMet) return String(reeks.route).startsWith(kies.routeBegintMet);
  if (kies.route && kies.route !== '*') return reeks.route === kies.route;
  return true;
}

function berekenKwantielgrens(emmers, opgeteld, aantal, q) {
  if (!aantal) return null;
  const doel = aantal * q;
  for (let i = 0; i < emmers.length; i++) if (opgeteld[i] >= doel) return emmers[i];
  return null;
}

module.exports = { pastBijSloSelectie, berekenKwantielgrens };
