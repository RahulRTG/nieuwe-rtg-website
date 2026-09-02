/* Eén opslagcontract voor de persoonlijke Agenda en Agenda Pro. Beide
   engines bezitten gedrag; alleen deze deur bezit de gedeelde collectie. */
'use strict';

module.exports = function maakAgendaOpslag({ db }) {
  function agendaWortel() {
    if (!db.data.agendas || typeof db.data.agendas !== 'object' || Array.isArray(db.data.agendas))
      db.data.agendas = {};
    return db.data.agendas;
  }
  function agendaItems(ownerKey) {
    const r = agendaWortel();
    if (!Array.isArray(r[ownerKey])) r[ownerKey] = [];
    return r[ownerKey];
  }
  return { agendaWortel, agendaItems };
};
