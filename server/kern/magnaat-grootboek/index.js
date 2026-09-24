/* Magnaat Grootboek -- de boekhoudautoriteit onder elke Magnaat-economie.

   MAGNAAT.md, besluit 4 van ronde A2: het grootboek is een eigen laag. Het
   kent economische primitieven en verder niets:

     rekeningen -> gebeurtenissen -> boekingen -> saldi -> volgnummer -> herhaling

   Geen restaurants, toeristen, missies, marktvraag, dagen of bedrijven. De
   lagen erboven zijn consumenten:

     Magnaat World       -> World-economie                    -> grootboek
     Oefenkantoor-adapter -> economische motor (../magnaat-economische-motor) -> grootboek

   Zo kan er niet per ongeluk een tweede boekhoudwaarheid ontstaan: wie wil
   boeken, komt hier langs.

     maakGrootboek({
       wereld,         vaste id; staat op elke gebeurtenis en scheidt de journalen
       opslag,         het journaal (./opslag.js)
       soorten,        { SOORT: 'SOORT' } -- welke gebeurtenissen deze consument kent
       versies,        { regel, motor } -- staan op elke gebeurtenis (M-019)
       periode,        (projectie) => ({ nummer, datum }) -- de lopende periode
       idVoorvoegsel,  begin van elk gebeurtenis-id (standaard 'MJ')
       venster         hoeveel gebeurtenissen `recent` bewaart (standaard 100)
     })

   De projectie (saldi, laatstToegepast, totalen, recent, vandaag, wachtrij)
   woont in een object van de consument en wordt bij elke aanroep meegegeven:
   het grootboek houdt zelf geen staat vast buiten het journaal. */
'use strict';
const { geheugenJournaal, collectieJournaal } = require('./opslag');

function maakGrootboek({ wereld, opslag, soorten, versies, periode, idVoorvoegsel = 'MJ', venster = 100 }) {
  if (!wereld || typeof wereld !== 'string') throw new Error('Het grootboek vereist een wereld-id.');
  if (!opslag) throw new Error('Het grootboek vereist een journaal.');
  if (!soorten || typeof soorten !== 'object') throw new Error('Het grootboek vereist de lijst gebeurtenissoorten.');
  if (!versies || !versies.regel || !versies.motor) throw new Error('Het grootboek vereist een regel- en een motorversie.');
  if (typeof periode !== 'function') throw new Error('Het grootboek vereist periode().');
  const g = { wereld, opslag, soorten, versies, periode, idVoorvoegsel, venster };
  const b = require('./boeken')(g);
  const h = require('./herstel')(g, b);
  return {
    metOorzaak: b.metOorzaak, rekening: b.rekening, regel: b.regel, boek: b.boek, bevestig: b.bevestig,
    regelVoorScherm: b.regelVoorScherm, herstelProjectie: h.herstelProjectie, gebeurtenissen: h.gebeurtenissen,
    saldiNa: h.saldiNa, verifieer: h.verifieer, neemOver: h.neemOver, zorgVorm: h.zorgVorm
  };
}

module.exports = { maakGrootboek, geheugenJournaal, collectieJournaal };
