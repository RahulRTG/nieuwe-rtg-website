/* Payroll OS: DE GRONDSLAGEN EN DE TARIEFTOEPASSING.

   Afgesplitst van ./motor.js, dat over de 10 KB ging toen de loonheffingstabel
   en de valuta erbij kwamen. Twee kleine functies met een grote rol, en ze
   horen bij elkaar: allebei zetten ze een REGEL uit het pakket om in een bedrag
   en houden ze bij waar dat bedrag vandaan kwam.

   Zonder die herkomst is een loonstrook een bewering. Met die herkomst kan elk
   bedrag antwoord geven op vraag 1 en 2 van de vier: waarom is dit berekend, en
   welke regel en versie zijn gebruikt. */
'use strict';

const rondCenten = (x) => Math.round(x);

/* De grondslag: de som van alle brutocomponenten die voor DEZE grondslag
   meetellen. Niet "alles wat belast is" -- zie componenten.js: een component
   kan wel voor de loonheffing tellen en niet voor de premies. */
function grondslagVan(regels, componenten, welke, alleen) {
  let som = 0;
  for (const r of regels) {
    const c = componenten[r.component];
    if (!c || c.soort !== 'bruto') continue;
    if (alleen && !alleen(c)) continue;
    if ((c.grondslagen || []).includes(welke)) som += r.centen;
  }
  return som;
}

/* Een percentage uit het regelpakket toepassen, met de herkomst erbij. Het
   pakket levert het getal; de motor levert alleen de vermenigvuldiging. Zo is
   bij elk bedrag terug te zien welke regel eraan ten grondslag lag. */
function pas(regelpakket, pad, grondslag) {
  const deel = pad.split('.').reduce((o, k) => (o == null ? o : o[k]), regelpakket.regels);
  if (typeof deel !== 'number' || !Number.isFinite(deel)) return null;
  return { centen: rondCenten(grondslag * deel), tarief: deel, regel: pad,
    versie: regelpakket.versie, grondslag };
}

module.exports = { grondslagVan, pas, rondCenten };
