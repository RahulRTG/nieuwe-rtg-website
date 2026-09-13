/* DE STAND PER CAPABILITY -- de LEESKANT van ../gevolgcontract.js.

   AFGESPLITST omdat het bestand over de 10 kB ging en de keuringsregel gelijk had:
   keuren (mag deze verklaring bestaan) en tellen (hoe volledig is zij) zijn twee
   onderwerpen. Zelfde naad als kern/kantoor/geldketen/dossier.js.

   Drie standen en met opzet GEEN percentage erboven: BEWIJSMACHINE.md verbiedt het
   enkele getal boven een scorecard, en een samengesteld cijfer verbergt precies
   welke van de drie bewoog. */
'use strict';

const gevolg = require('../gevolg');
const SOORTEN = Object.freeze(['direct', 'afgeleid', 'buiten', 'mislukking']);

const STANDEN = Object.freeze({
  VOLLEDIG: 'elk gemeten gevolg is verklaard EN er staat iets over afgeleid, buiten en mislukking',
  GEDEELTELIJK: 'er is een contract, maar het dekt de meting niet of laat een soort leeg',
  ONBEKEND: 'geen contract; wat deze handeling veroorzaakt is niet verklaard'
});

function stand(c, pad) {
  if (!c) return { stand: 'ONBEKEND', open: SOORTEN.slice(), reden: STANDEN.ONBEKEND };
  const g = Array.isArray(c.gevolgen) ? c.gevolgen : [];
  const soorten = new Set(g.map(x => x && x.soort));
  const open = SOORTEN.filter(s => !soorten.has(s));

  /* Dekt het contract wat de meting zag? Elke gemeten collectie hoort in een
     direct gevolg terug te komen; wat het contract mist, staat met naam in
     `nietVerklaard`. */
  const m = gevolg.gevolgVan(pad || c.capability);
  const verklaard = new Set(g.filter(x => x && x.soort === 'direct').map(x => x && x.collectie));
  const nietVerklaard = (m.collecties || []).filter(k => !verklaard.has(k));

  const rond = !open.length && !nietVerklaard.length;
  return { stand: rond ? 'VOLLEDIG' : 'GEDEELTELIJK', open, nietVerklaard,
    meting: { graad: m.graad, collecties: m.collecties },
    reden: rond ? STANDEN.VOLLEDIG : STANDEN.GEDEELTELIJK };
}

module.exports = { stand, STANDEN };
