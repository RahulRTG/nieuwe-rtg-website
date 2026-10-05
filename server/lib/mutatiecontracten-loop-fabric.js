'use strict';

const AFGETEKEND={door:'Codex, implementatie en adversarial tests op verzoek; geen productievrijgave',op:'2026-10-04'};
const BEWIJS={gemeten:'test/loop-fabric.test.js en test/loop-fabric.pg.test.js: payloadgebonden replay, bronoutbox-herstel, multi-instance race, antwoordverlies en herstart.',op:'2026-10-04'};
const CONTRACTEN={};

for (const [route,id,toegang] of [
  ['POST /api/loop/observation/inbox','loop.observation.inbox',{klasse:'AUTHENTICATED'}],
  ['POST /api/loop/proof','loop.proof',{klasse:'AUTHENTICATED'}]
]) CONTRACTEN[route]={mutatieId:id,herkomst:'mens',semantiek:{klasse:'idempotent'},toegang,stand:'PROTECTED',
  waarom:'De leesuitkomst synchroniseert eerst bronoutboxes. Bron-event-ID, payloadvingerafdruk en duurzaam consumercheckpoint maken die verborgen overdracht replayveilig.',
  afgetekend:AFGETEKEND,bewijs:BEWIJS};

for (const [route,id,toegang] of [
  ['POST /api/loop/recall/present','loop.recall.present',{klasse:'AUTHENTICATED'}],
  ['POST /api/loop/recall/disposition','loop.recall.disposition',{klasse:'AUTHENTICATED'}],
  ['POST /api/bedrijf/loop/procedure/change','bedrijf.loop.procedure.change',{klasse:'OBJECT_SCOPED',objectVeld:'werkruimte'}],
  ['POST /api/bedrijf/loop/runbook/change','bedrijf.loop.runbook.change',{klasse:'OBJECT_SCOPED',objectVeld:'werkruimte'}],
  ['POST /api/bedrijf/loop/incident/observe','bedrijf.loop.incident.observe',{klasse:'OBJECT_SCOPED',objectVeld:'werkruimte'}]
]) CONTRACTEN[route]={mutatieId:id,herkomst:'mens',semantiek:{klasse:'sleutelVereist'},toegang,stand:'PROTECTED',
  waarom:'De server bindt de operatie-ID aan actor en payload, commit state, audit en resultaat atomair, retourneert replay en weigert gewijzigde replay.',
  afgetekend:AFGETEKEND,bewijs:BEWIJS};

module.exports={CONTRACTEN};
