/* Universeel leesbeeld over bestaande RTG-zaken.

   Dit is geen derde case-engine. Concierge Case en Servicezaak blijven eigenaar
   van status, inhoud, deelnemers, bevoegdheden en mutaties. Dit bestand maakt
   uitsluitend een kort, positief opgebouwd beeld waarmee Flow, Spatial, Edge
   en Rahul dezelfde bron kunnen aanwijzen. Geen actie hieronder is uitvoerbaar:
   de brondomeinen blijven iedere handeling autoriseren. */
'use strict';

const BUREAU_FASE = Object.freeze({
  genoteerd: 'request', 'in voorbereiding': 'plan', 'wacht op uw akkoord': 'agreement',
  'in uitvoering': 'execute', 'in herstel': 'escalate', geregeld: 'close',
  afgewezen: 'cancel', ingetrokken: 'cancel'
});
const SERVICE_FASE = Object.freeze({
  nieuw: 'request', onderzoek: 'triage', wachtOpMens: 'escalate',
  inBehandeling: 'execute', wachtOpMelder: 'verify', opgelost: 'verify', gesloten: 'close'
});
const EINDE = new Set(['close', 'cancel']);
const tekst = (v, n) => String(v == null ? '' : v).replace(/[<>]/g, '').trim().slice(0, n);

function versie(zaak) {
  const regels = Array.isArray(zaak.tijdlijn) ? zaak.tijdlijn : [];
  const laatst = regels[regels.length - 1] || {};
  return tekst(laatst.at || laatst.op || zaak.at || 'onbekend', 80);
}

function ref(domain, type, id, version) {
  return Object.freeze({ domain: tekst(domain, 60), type: tekst(type, 60),
    id: tekst(id, 160), version: tekst(version, 160) });
}

function verantwoordelijkheid(kind, role, id) {
  return Object.freeze({ kind, role: tekst(role, 80), actor: ref('identity', kind, id || role, '-') });
}

function relatie(kind, source, label, state) {
  return Object.freeze({ kind, source, label: tekst(label, 120), state: tekst(state, 60) });
}

function actie(id, label, capability, visible) {
  if (!visible) return null;
  return Object.freeze({ id, label, capability, executable: false,
    authority: 'source-domain', reason: 'Het brondomein controleert sessie, object en bevoegdheid opnieuw.' });
}

function beeld({ source, kind, title, sourceState, phase, responsibilities, relations, actions, attention }) {
  return Object.freeze({ schemaVersion: 1, id: [source.domain, source.type, source.id].join(':'),
    source, kind, title: tekst(title, 120), phase: Object.freeze({ id: phase, sourceState: tekst(sourceState, 60),
      terminal: EINDE.has(phase) }), responsibilities: Object.freeze(responsibilities),
    relations: Object.freeze(relations), actions: Object.freeze(actions.filter(Boolean)),
    attention: Object.freeze(attention), readOnly: true, ownsSourceData: false });
}

function bureau(zaak) {
  const v = versie(zaak), phase = BUREAU_FASE[zaak.status] || 'triage';
  const responsibilities = [verantwoordelijkheid('requester', 'Opdrachtgever', 'self')];
  if (zaak.eigenaar || (zaak.team || []).length) responsibilities.push(verantwoordelijkheid('coordinator',
    zaak.eigenaar && zaak.eigenaar.rol || 'Lead Rechterhand', 'bureau'));
  for (const lid of (zaak.team || []).slice(0, 12)) {
    const role = tekst(lid && lid.rol, 80); if (role) responsibilities.push(verantwoordelijkheid('provider', role, role));
  }
  const relations = [];
  for (const task of (zaak.deelopdrachten || []).slice(0, 40)) relations.push(relatie('subcase',
    ref('bureau', 'work-item', task.id, v), task.wat, task.magZelf ? 'delegated' : 'approval-required'));
  for (const part of (zaak.onderdelen || []).slice(0, 40)) relations.push(relatie('execution-step',
    ref('bureau', 'execution-step', part.id, v), part.wat, part.stand));
  const hasProposal = !!zaak.voorstel;
  return beeld({ source: ref('bureau', 'concierge-case', zaak.id, v), kind: 'concierge', title: zaak.titel,
    sourceState: zaak.status, phase, responsibilities, relations,
    actions: [
      actie('bureau.case.decide', 'Besluit nemen', 'bureau.case.decide', !!(zaak.beslissing && zaak.beslissing.nodig)),
      actie('bureau.concierge.offer.decide', 'Voorstel beoordelen', 'bureau.concierge.offer.decide', hasProposal),
      actie('bureau.case.withdraw', 'Verzoek intrekken', 'bureau.case.withdraw', !EINDE.has(phase))
    ], attention: { decisionRequired: !!(zaak.beslissing && zaak.beslissing.nodig) || hasProposal,
      recovery: zaak.status === 'in herstel' } });
}

function service(zaak) {
  const v = versie(zaak), phase = SERVICE_FASE[zaak.stand] || 'triage';
  const responsibilities = [verantwoordelijkheid('requester', 'Melder', 'self'),
    verantwoordelijkheid('coordinator', zaak.team || 'RTG Service', zaak.team || 'service')];
  if (zaak.eigenaar) responsibilities.push(verantwoordelijkheid('provider', 'Zaakeigenaar', 'assigned'));
  const relations = [];
  if (zaak.betrokken) relations.push(relatie('subject',
    ref('domain', zaak.betrokken.soort, zaak.betrokken.code, '-'), zaak.betrokken.soort, 'linked'));
  for (const link of (zaak.koppelingenLijst || zaak.koppelingen || []).slice(0, 40)) {
    if (link && link.soort && link.code) relations.push(relatie('related-case',
      ref('domain', link.soort, link.code, '-'), link.soort, 'linked'));
  }
  return beeld({ source: ref('service', 'service-case', zaak.id, v), kind: 'service', title: zaak.titel,
    sourceState: zaak.stand, phase, responsibilities, relations,
    actions: [actie('service.case.reply', 'Reageren', 'service.case.reply', !EINDE.has(phase)),
      actie('service.case.human', 'Vraag een mens', 'service.case.human', !EINDE.has(phase))],
    attention: { decisionRequired: false, recovery: zaak.stand === 'wachtOpMens' } });
}

module.exports = Object.freeze({ bureau, service, ref, phases: Object.freeze({ bureau: BUREAU_FASE, service: SERVICE_FASE }) });
