/* Leesprojectie: concrete termijnen gaan vóór een vooruitberekening. Een
   opzegvoorbeeld begrenst alleen nog niet gestarte toekomstige termijnen;
   betaalhistorie wordt hier nooit opnieuw geprijsd. */
'use strict';
module.exports = ({ rij, contract: c, contracten, op, eindigtOp }) => {
  if (!rij || !c) return [];
  const bewaard = rij.termijnen || [];
  if (!c.automatischAbonnement) return bewaard
    .filter(t => t.status !== 'voldaan' && Date.parse(t.vervalt) >= op)
    .sort((a, b) => Date.parse(a.vervalt) - Date.parse(b.vervalt));
  const { plusMaanden } = require('../commercie/contract');
  const gelezen = eindigtOp ? { ...c, eindigtOp } : c;
  const grens = gelezen.eindigtOp || (Date.parse(c.prijsVastTot) > op ? c.prijsVastTot : plusMaanden(new Date(op).toISOString(), 1));
  const verwacht = contracten.termijnenTussen(gelezen, new Date(op).toISOString(), grens)
    .filter(t => !bewaard.some(b => b.nr === t.nr));
  const open = bewaard.filter(t => !['voldaan', 'vervallen'].includes(t.status));
  return [...open, ...verwacht].sort((a, b) => Date.parse(a.vervalt) - Date.parse(b.vervalt));
};
