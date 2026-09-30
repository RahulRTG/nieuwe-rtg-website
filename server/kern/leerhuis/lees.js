/* ============================================================================
   HET LEERHUIS -- de leeskant, per vraag op een verse projectie van EEN
   organisatie. Uit ./index.js geknipt op de waarschuwband van keuringsregel 13;
   hier staat niets dat schrijft.
   ========================================================================== */
'use strict';

const zicht = require('./zicht');
const uitleg = require('./uitleg');
const gereedheid = require('./gereedheid');
const { geschiktheid } = require('./brug');
const { certStand } = require('./oordeel');
const { stappen } = require('./startpakket');
const werk = require('./werk');
const autoriteit = require('./werk-autoriteit');

module.exports = (stand, klok) => {
  const t = () => klok();
  return {
    mijn: (org, p) => zicht.mijn(stand(org), p, t()),
    vakstaat: (org, p) => zicht.vakstaat(stand(org), p, t()),
    trainerCockpit: (org, p) => zicht.trainerCockpit(stand(org), p),
    managerCockpit: (org, p) => zicht.managerCockpit(stand(org), p, t()),
    assessorWerk: (org, p) => werk.assessorWerk(stand(org), p),
    kennisWerk: (org, p) => werk.kennisWerk(stand(org), p),
    curriculumWerk: (org, p) => werk.curriculumWerk(stand(org), p),
    eigenaarWerk: (org, p) => werk.eigenaarWerk(stand(org), p),
    certificaatWerk: (org, p) => autoriteit.certificaatWerk(stand(org), p, t()),
    trainerWerk: (org, p) => autoriteit.trainerWerk(stand(org), p, t()),
    kwaliteitWerk: (org, p) => autoriteit.kwaliteitWerk(stand(org), p),
    geschiktheid: (org, p, h) => geschiktheid(stand(org), p, h, t()),
    gereedheid: (org, eisen) => gereedheid.teamGereed(stand(org), eisen, t()),
    eenheid: (org) => gereedheid.eenheid(stand(org), t()),
    loopbaan: (org, p, rol) => gereedheid.loopbaan(stand(org), p, rol, t()),
    waaromLeren: (org, p, c) => uitleg.waaromLeren(stand(org), p, c),
    waaromNietGereed: (org, p, rol) => uitleg.waaromNietGereed(stand(org), p, rol, t()),
    waaromVerversen: (org, p) => uitleg.waaromVerversen(stand(org), p, t()),
    waaromTrainer: (org, p, c) => uitleg.waaromTrainer(stand(org), p, c),
    wieGeraakt: (org, k, klasse) => uitleg.wieGeraakt(stand(org), k, klasse),
    reconstrueer: (org, c) => uitleg.reconstrueer(stand(org), c, t()),
    grond: (org, vraag) => uitleg.grond(stand(org), vraag),
    certStand: (org, c) => { const st = stand(org); return st.certificaten[c] ? certStand(st, st.certificaten[c], t()) : null; },
    /* Wat een startpakket zou klaarzetten, voordat iemand het laadt (besluit B7). */
    startpakket: (org) => { const s = stand(org).org.soort; return { soort: s, stappen: stappen(s) }; }
  };
};
