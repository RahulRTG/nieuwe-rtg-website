'use strict';

function metersVan(kosten, maak) {
  if (!kosten.meters || typeof kosten.meters !== 'object') {
    if (!maak) return {};
    kosten.meters = {};
  }
  return kosten.meters;
}

function pasBatchToe(kosten, batch, alleenPeriode) {
  const meters = metersVan(kosten, true);
  for (const [sleutel, tel] of batch) {
    const scheiding = sleutel.indexOf('\u0000');
    const periode = sleutel.slice(0, scheiding);
    if (alleenPeriode && periode !== alleenPeriode) continue;
    const vak = meters[periode] || (meters[periode] = {});
    const drager = sleutel.slice(scheiding + 1);
    const rij = vak[drager] || (vak[drager] = { laatst: null });
    for (const id of Object.keys(tel.per)) {
      rij[id] = Math.round(((rij[id] || 0) + tel.per[id]) * 1000) / 1000;
    }
    if (!rij.laatst || Date.parse(tel.laatst) >= Date.parse(rij.laatst)) rij.laatst = tel.laatst;
    if (tel.pas && (!rij.pasGezien || Date.parse(tel.laatst) >= Date.parse(rij.pasGezien))) {
      rij.pas = tel.pas;
      rij.pasGezien = tel.laatst;
    }
  }
}

function voegTerug(wacht, batch) {
  for (const [sleutel, tel] of batch) {
    const huidig = wacht.get(sleutel);
    if (!huidig) {
      wacht.set(sleutel, tel);
      continue;
    }
    for (const id of Object.keys(tel.per)) huidig.per[id] = (huidig.per[id] || 0) + tel.per[id];
    if (!huidig.laatst || tel.laatst > huidig.laatst) {
      huidig.laatst = tel.laatst;
      if (tel.pas) huidig.pas = tel.pas;
    }
  }
}

module.exports = { metersVan, pasBatchToe, voegTerug };
