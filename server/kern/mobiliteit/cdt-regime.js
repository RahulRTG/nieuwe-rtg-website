/* Mobility OS (deelmodule van ./cdt.js): HET REGIME van een onderneming -- de
   grenzen voor arbeids-, rij- en rusttijd. De standaard staat in ./cdt-tijden;
   een onderneming mag er haar eigen regime (loondienst, zelfstandig, cao) over
   leggen. Uit ./cdt.js gelicht als eigen onderwerp: de dienst van een chauffeur
   is iets anders dan de regels waaraan hij wordt gemeten. */
'use strict';
const { GRENZEN } = require('./cdt-tijden');

module.exports = ({ opslag, save, ensureCdt }) => {
  // de grenzen van deze onderneming: de standaard, tenzij hij zijn eigen regime zette
  const regimeVan = code => Object.assign({}, GRENZEN, (opslag.bak('mobCdtRegime') || {})[code] || {});

  function regimeZet(code, body = {}) {
    ensureCdt();
    const eigen = {};
    for (const [k, v] of Object.entries(body.grenzen || {})) {
      if (!Object.prototype.hasOwnProperty.call(GRENZEN, k)) return { status: 400, error: 'Onbekende grens: ' + k };
      if (!Number.isFinite(v) || v <= 0 || v > 7 * 24 * 60) return { status: 400, error: 'De grens ' + k + ' moet in minuten en zinnig zijn.' };
      eigen[k] = Math.round(v);
    }
    if (!Object.keys(eigen).length) return { status: 400, error: 'Geef minstens een grens op.' };
    opslag.bak('mobCdtRegime')[code] = Object.assign({}, opslag.bak('mobCdtRegime')[code] || {}, eigen);
    save();
    return { ok: true, grenzen: regimeVan(code), standaard: GRENZEN };
  }
  return { regimeVan, regimeZet };
};
