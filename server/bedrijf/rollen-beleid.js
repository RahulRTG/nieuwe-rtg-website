'use strict';

const { ROLLEN } = require('./rollen-register');

function rollenVan(lid, dag) {
  const vandaag = String(dag || new Date().toISOString().slice(0,10));
  return (lid && lid.rollen || [])
    .filter(rol => (!rol.van || rol.van <= vandaag) && (!rol.tot || rol.tot >= vandaag))
    .map(rol => rol.id);
}

function rechtenVan(lid, dag) {
  const rechten = new Set();
  for (const id of rollenVan(lid,dag)) {
    const rol = ROLLEN.find(row=>row.id===id);
    for (const recht of rol ? rol.rechten : []) rechten.add(recht);
  }
  return [...rechten];
}

const mag = (lid,recht,dag) => rechtenVan(lid,dag).includes(recht);
const leest = (lid,dag) => rollenVan(lid,dag).some(id=>(ROLLEN.find(row=>row.id===id)||{}).alleenLezen);

module.exports = { rollenVan, rechtenVan, mag, leest };
