'use strict';

const begrens = (waarde, min, max, terug) => {
  const getal = Number(waarde);
  return Number.isFinite(getal) ? Math.max(min, Math.min(max, getal)) : terug;
};

function kanaalMix(kanaal, uit) {
  uit.solo = !!(kanaal && kanaal.solo);
  uit.eqLaag = begrens(kanaal && kanaal.eqLaag, -12, 12, 0);
  uit.eqMidden = begrens(kanaal && kanaal.eqMidden, -12, 12, 0);
  uit.eqHoog = begrens(kanaal && kanaal.eqHoog, -12, 12, 0);
  uit.reverb = begrens(kanaal && kanaal.reverb, 0, 1, 0);
  uit.delay = begrens(kanaal && kanaal.delay, 0, 1, 0);
  return uit;
}

function trackMix(invoer, basis) {
  const v = invoer || {};
  return {
    swing: begrens(v.swing, 0, 0.75, basis.swing || 0),
    masterGain: begrens(v.masterGain, 0.25, 1.5,
      basis.masterGain != null ? basis.masterGain : 0.8),
    masterLaag: begrens(v.masterLaag, -9, 9, basis.masterLaag || 0),
    masterMidden: begrens(v.masterMidden, -9, 9, basis.masterMidden || 0),
    masterHoog: begrens(v.masterHoog, -9, 9, basis.masterHoog || 0),
    masterDrive: begrens(v.masterDrive, 0, 1, basis.masterDrive || 0.35)
  };
}

function publiekeMix(track) {
  return {
    swing: track.swing || 0,
    masterGain: track.masterGain != null ? track.masterGain : 0.8,
    masterLaag: track.masterLaag || 0,
    masterMidden: track.masterMidden || 0,
    masterHoog: track.masterHoog || 0,
    masterDrive: track.masterDrive != null ? track.masterDrive : 0.35
  };
}

module.exports = { kanaalMix, trackMix, publiekeMix };
