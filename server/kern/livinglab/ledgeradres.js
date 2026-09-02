/* ============================================================================
   HET ADRES VAN EEN LAB IN DE KOSTENMETER -- welke drager hoort bij welk lab en
   welke studie.

   Afgesplitst van ./ledger.js toen die over de 10 KB-keuringsgrens ging, en langs
   een echte naad: hier staat hoe een lab HEET in de boekhouding, daar staat wat
   die boekhouding zegt. Dat eerste wordt op drie plekken gebruikt -- het
   grootboek, de poort van de routes en de toets -- en het tweede maar op een.

   Waarom dat een aparte vraag is: deze vier functies kennen geen kosten, geen
   firewall en geen studie-inhoud. Ze zetten een lab-id en een studie-id om in een
   tekenreeks en terug. Zou dat verspreid raken, dan bouwt de tweede plek op een
   dag een net iets andere sleutel -- en dan telt het grootboek een deel van het
   verbruik niet mee, zonder dat er iets stukgaat.
   ========================================================================== */
'use strict';

const kostenhaak = require('../kosten/haak');

/* De drager van een lab, en van een studie binnen dat lab. Eén plek, want een
   tweede die deze tekenreeks bouwt, maakt op een dag een andere -- en dan telt
   het grootboek een deel van het verbruik niet mee. */
const dragerVanLab = (labId) => kostenhaak.drager('lab', String(labId || ''));
const dragerVanStudie = (labId, studieId) =>
  kostenhaak.drager('lab', String(labId || '') + '/' + String(studieId || ''));

/* Hoort deze drager bij dit lab? `lab:L1` en `lab:L1/S2` allebei; `lab:L12` niet
   -- een prefixvergelijking zonder deze grens telt het verbruik van het ene lab
   bij het andere op. */
function hoortBij(drager, labId) {
  const w = kostenhaak.ontleed(drager);
  if (w.soort !== 'lab') return false;
  const id = String(labId || '');
  return w.id === id || w.id.startsWith(id + '/');
}

const studieVanDrager = (drager) => {
  const w = kostenhaak.ontleed(drager);
  const k = String(w.id).indexOf('/');
  return w.soort === 'lab' && k > 0 ? String(w.id).slice(k + 1) : null;
};

/* LET OP DE VORM VAN DEZE AANROEP: er wordt NIET gedestructureerd. De kosten- en
   economielaag bestaan pas in een latere opzetlaag (opzet/kernlaag4.js) dan het
   Living Lab (kernlaag2), dus ze komen als late binding binnen. Een destructuring
   in de parameterlijst leest ze op het moment dat dit grootboek wordt GEBOUWD --
   en dat is precies het moment waarop ze nog `undefined` zijn. Dat merkte niemand
   tot een lab zijn rekening opvroeg, en toen was het een 500 en geen fout die
   zichzelf uitlegt. */

module.exports = { dragerVanLab, dragerVanStudie, hoortBij, studieVanDrager };
