'use strict';

/* De publieke projectie van een aanwezigheid. Deze woorden beschrijven wat een
   lid na volgen ontvangt; ze verlenen de drager geen bevoegdheid. */
const WOORD = {
  muziek: 'muziek', video: "video's", flow: 'korte video', live: 'live',
  optreden: 'optredens', kaartverkoop: 'kaartverkoop', wedstrijd: 'wedstrijden',
  uitgelicht: 'uitgelicht werk'
};

function beeld(a) {
  return a && ({
    id: a.id,
    naam: a.naam,
    drager: a.drager.soort,
    soorten: a.soorten,
    watUKrijgt: a.soorten.map(s => WOORD[s] || s)
  });
}

module.exports = { beeld, WOORD };
