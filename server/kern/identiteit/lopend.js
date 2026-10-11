'use strict';
/* LOPENDE POGINGEN OP EEN EMMER (N39 van de V1-audit).

   DE FOUT: de wachtwoordrem keek vóór de wachtwoordtoets of een emmer dicht
   was, en telde de poging pas erna. Alles wat tegelijk binnenkwam ging dus
   langs elke grens: honderd gelijktijdige gokken op een account gaven honderd
   keer 401 en geen enkele 429, op /api/auth/login en op de werkplekinlog.

   DE REGEL: een poging telt mee vanaf het moment dat ze langs de rem gaat,
   niet pas als de uitslag er is. Een grens van tien betekent dan tien pogingen
   tegelijk of na elkaar, nooit meer. De uitslag (mis of gelukt) geeft de plek
   weer terug; ./wachtwoordrem.js doet dat.

   Dit is staat in het geheugen van dit proces, net als `loginFails` waar hij
   naast staat. Een plek die nooit wordt teruggegeven (een deur die gooit na
   dicht()) vervalt vanzelf na VENSTER_MS, zodat een fout in een deur nooit een
   account blijvend dichtzet. */
const VENSTER_MS = 30000;
const plekken = new Map();

function vers(sleutel) {
  const nu = Date.now();
  const lijst = (plekken.get(sleutel) || []).filter(t => nu - t < VENSTER_MS);
  if (lijst.length) plekken.set(sleutel, lijst); else plekken.delete(sleutel);
  return lijst;
}

module.exports = {
  VENSTER_MS,
  aantal: sleutel => vers(sleutel).length,
  neem(sleutel) { const l = vers(sleutel); l.push(Date.now()); plekken.set(sleutel, l); },
  geef(sleutel) {
    const l = vers(sleutel);
    l.shift();
    if (l.length) plekken.set(sleutel, l); else plekken.delete(sleutel);
  }
};
