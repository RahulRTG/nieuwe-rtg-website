/* HET DOSSIER -- wat er per as gebeurde, en wat er nog open staat.

   AFGESPLITST VAN ../geldketen.js: dit is de LEESKANT van de baan en dus een ander
   onderwerp dan de baan zelf.

   DE REGEL DIE DIT BESTAND DRAAGT staat in `publiek`: een as heet gehaald bij graad
   `gemeten` of `bewezen`, en `vermoed` of `onbekend` tellen NIET mee. Dat is het
   verschil tussen een as die gelopen is en een as die aanwezig lijkt -- precies de
   verwarring die scripts/machinedekking.js twee keer over zichzelf ontdekte. En
   even groot als de gehaalde assen staat `open` in het antwoord: een dossier dat
   alleen zijn overwinningen toont, leest als een keten die rond is.
*/
'use strict';

const { KLASSEN } = require('./klassen');

function maakDossierlaag({ dossiers, vindDossier }) {
  /* ------------------------------------------------------------------------
     HET DOSSIER. Per as: wat er gebeurde, met welke graad en waarom. En even
     groot: welke VERPLICHTE as van deze klasse nog open staat -- een dossier dat
     alleen de gehaalde assen toont, leest als een keten die rond is.
     ---------------------------------------------------------------------- */
  function publiek(d) {
    const eis = KLASSEN[d.klasse] ? KLASSEN[d.klasse].verplicht : [];
    const gehaald = d.assen.filter(a => a.graad === 'gemeten' || a.graad === 'bewezen').map(a => a.as);
    const open = eis.filter(as => !gehaald.includes(as));
    return {
      voornemen: d.voornemen, klasse: d.klasse, handeling: d.handeling, doel: d.doel, pad: d.pad,
      door: d.door, at: d.at, envelop: d.envelop, correlatie: d.correlatie, keten: d.keten,
      assen: d.assen.slice().sort((a, b) => a.as.localeCompare(b.as)),
      verplicht: eis, open,
      rond: open.length === 0,
      waaromNiet: KLASSEN[d.klasse] ? KLASSEN[d.klasse].waaromNiet : {},
      grens: 'Een as heet gehaald bij graad `gemeten` of `bewezen`. `vermoed` en `onbekend` tellen ' +
        'NIET mee -- dat is het verschil tussen een as die gelopen is en een as die aanwezig lijkt.'
    };
  }

  function dossier(id) {
    const d = vindDossier(id);
    if (!d) return { status: 404, error: 'Er is geen geldketen met dit voornemen.' };
    return { status: 200, ok: true, dossier: publiek(d) };
  }

  function lijst({ limit = 20 } = {}) {
    const n = Math.min(100, Math.max(1, Number(limit) || 20));
    return { status: 200, ok: true, aantal: dossiers().length,
      dossiers: dossiers().slice(0, n).map(publiek),
      /* Het getal dat ertoe doet: hoeveel van deze banen zijn ROND gelopen. */
      rond: dossiers().filter(d => publiek(d).rond).length };
  }

  /* De top van de hashketen: het ene getal dat naar buiten moet om het journaal
     onherschrijfbaar te maken. Verifieren gaat over de hele keten. */

  return { publiek, dossier, lijst };
}

module.exports = { maakDossierlaag };
