/* Rendez-vous houdt Today, Introduction, Arrange It, The Table en Together als
   afzonderlijke contexten. Ze delen wetten, niet automatisch elkaars states. */
'use strict';

const Consent = require('./connection-consent');

const STATES = Object.freeze({
  TODAY: 'TODAY',
  INTRODUCTION_PENDING: 'INTRODUCTION_PENDING',
  INTRODUCTION_OPEN: 'INTRODUCTION_OPEN',
  ARRANGE_DRAFT: 'ARRANGE_DRAFT',
  ARRANGE_AWAITING_BOTH: 'ARRANGE_AWAITING_BOTH',
  ARRANGE_APPROVED: 'ARRANGE_APPROVED',
  HANDED_TO_RECHTERHAND: 'HANDED_TO_RECHTERHAND',
  TOGETHER: 'TOGETHER',
  TABLE_INVITED: 'TABLE_INVITED',
  TABLE_ACCEPTED: 'TABLE_ACCEPTED',
  TABLE_DECLINED: 'TABLE_DECLINED',
  ENCOUNTER_AWAITING_RECIPROCAL: 'ENCOUNTER_AWAITING_RECIPROCAL'
});

const EVENTS = Object.freeze({
  CHOOSE_CANDIDATE: 'CHOOSE_CANDIDATE',
  ANSWER_INTRODUCTION: 'ANSWER_INTRODUCTION',
  OPEN_INTRODUCTION: 'OPEN_INTRODUCTION',
  PLAN_ARRANGE: 'PLAN_ARRANGE',
  ACCEPT_ARRANGE: 'ACCEPT_ARRANGE',
  RESPOND_TABLE: 'RESPOND_TABLE',
  DECLARE_TOGETHER: 'DECLARE_TOGETHER',
  CONFIRM_ENCOUNTER: 'CONFIRM_ENCOUNTER',
  BLOCK: 'BLOCK'
});

function arrangeBinding(v, actor, counterpart) {
  return { actor, counterpart, purpose: 'rendezvous.arrange', capability: 'connection.meet.accept',
    scope: v.id + ':' + v.setting, version: 1 };
}

function consentVoor(v, actor, counterpart, now) {
  const ledger = v && v.toestemming && typeof v.toestemming === 'object' ? v.toestemming : {};
  const binding = arrangeBinding(v, actor, counterpart);
  const state = Consent.toestand(ledger, binding, now);
  if (state === Consent.STATES.ABSENT && v.akkoord && v.akkoord[actor]) return Consent.STATES.ACTIVE;
  return state;
}

function root(profile) {
  return { surface: 'RENDEZVOUS_ROOT', state: STATES.TODAY,
    candidates: ['connection.profile.read', 'connection.profile.manage', 'connection.discover',
      'connection.table.read', 'connection.concierge.request'],
    fingerprint: { profile: !!profile, active: !!(profile && profile.aan) } };
}

function candidate(profile, facts) {
  return { surface: 'RENDEZVOUS_INTRODUCTION', state: STATES.INTRODUCTION_PENDING,
    candidates: ['connection.match.choose', 'connection.safety.block'],
    fingerprint: { active: !!(profile && profile.aan), ...(facts || {}) } };
}

function match({ proposal, key, targetKey, together, now, communication }) {
  if (together) return { surface: 'RENDEZVOUS_TOGETHER', state: STATES.TOGETHER,
    candidates: ['connection.relationship.declare', 'connection.safety.block'], fingerprint: { together: true } };
  if (!proposal) return { surface: 'RENDEZVOUS_ARRANGE', state: STATES.ARRANGE_DRAFT,
    candidates: ['connection.meet.plan', 'connection.relationship.declare', 'connection.safety.block'],
    fingerprint: { proposal: false } };
  const own = consentVoor(proposal, key, targetKey, now);
  const other = consentVoor(proposal, targetKey, key, now);
  const mutual = own === Consent.STATES.ACTIVE && other === Consent.STATES.ACTIVE;
  const state = proposal.bijRechterhand ? STATES.HANDED_TO_RECHTERHAND
    : mutual ? STATES.ARRANGE_APPROVED : STATES.ARRANGE_AWAITING_BOTH;
  const candidates = ['connection.relationship.declare', 'connection.safety.block', 'connection.message',
    'connection.media', 'connection.communication.consent'];
  if (communication && communication.voice) candidates.push('connection.voice');
  if (communication && communication.video) candidates.push('connection.video');
  if (state === STATES.ARRANGE_AWAITING_BOTH) candidates.push('connection.meet.plan', 'connection.meet.accept');
  return { surface: 'RENDEZVOUS_ARRANGE', state, candidates, fingerprint: {
    id: proposal.id, setting: proposal.setting, ownConsent: own, otherConsent: other,
    handed: !!proposal.bijRechterhand
  } };
}

function introduction(intro, key, communication) {
  if (!intro) return null;
  return { surface: 'RENDEZVOUS_INTRODUCTION',
    state: intro.geopend ? STATES.INTRODUCTION_OPEN : STATES.INTRODUCTION_PENDING,
    candidates: intro.geopend ? ['connection.message', 'connection.media', 'connection.communication.consent',
      ...(communication && communication.voice ? ['connection.voice'] : []),
      ...(communication && communication.video ? ['connection.video'] : []), 'connection.safety.block']
      : ['connection.introduction.answer', 'connection.safety.block'],
    fingerprint: { id: intro.id, opened: !!intro.geopend, ownAnswer: intro.ja && intro.ja[key] } };
}

function table(table, key) {
  if (!table || !table.genodigden || !table.genodigden[key]) return null;
  const status = table.genodigden[key].status;
  const state = status === 'ja' ? STATES.TABLE_ACCEPTED : status === 'nee' ? STATES.TABLE_DECLINED : STATES.TABLE_INVITED;
  return { surface: 'RENDEZVOUS_TABLE', state,
    candidates: state === STATES.TABLE_INVITED ? ['connection.table.accept'] : ['connection.table.read'],
    fingerprint: { id: table.id, ownStatus: status } };
}

function encounter(reciprocal) {
  return { surface: 'RENDEZVOUS_ENCOUNTER', state: STATES.ENCOUNTER_AWAITING_RECIPROCAL,
    candidates: ['connection.encounter.confirm'], fingerprint: { reciprocal: !!reciprocal } };
}

function together(ownDeclaration) {
  return { surface: 'RENDEZVOUS_TOGETHER', state: STATES.TOGETHER,
    candidates: ['connection.relationship.declare', 'connection.safety.block'],
    fingerprint: { ownDeclaration: ownDeclaration || null } };
}

function relationship(profile) {
  return { surface: 'RENDEZVOUS_TOGETHER', state: STATES.INTRODUCTION_PENDING,
    candidates: ['connection.relationship.declare', 'connection.safety.block'],
    fingerprint: { targetActive: !!(profile && profile.aan) } };
}

const TOEGESTAAN = Object.freeze({
  [EVENTS.CHOOSE_CANDIDATE]: [STATES.INTRODUCTION_PENDING],
  [EVENTS.ANSWER_INTRODUCTION]: [STATES.INTRODUCTION_PENDING],
  [EVENTS.PLAN_ARRANGE]: [STATES.ARRANGE_DRAFT, STATES.ARRANGE_AWAITING_BOTH],
  [EVENTS.ACCEPT_ARRANGE]: [STATES.ARRANGE_AWAITING_BOTH],
  [EVENTS.RESPOND_TABLE]: [STATES.TABLE_INVITED],
  [EVENTS.DECLARE_TOGETHER]: [STATES.INTRODUCTION_PENDING, STATES.ARRANGE_DRAFT, STATES.ARRANGE_AWAITING_BOTH,
    STATES.ARRANGE_APPROVED, STATES.HANDED_TO_RECHTERHAND, STATES.TOGETHER],
  [EVENTS.CONFIRM_ENCOUNTER]: [STATES.ENCOUNTER_AWAITING_RECIPROCAL],
  [EVENTS.BLOCK]: Object.values(STATES)
});

function transition(state, event, facts) {
  if (event === EVENTS.OPEN_INTRODUCTION && !(facts && facts.mutual)) {
    return { ok: false, code: 'MUTUAL_CONSENT_REQUIRED', from: state, event };
  }
  if (event === EVENTS.OPEN_INTRODUCTION && state === STATES.INTRODUCTION_PENDING) {
    return { ok: true, from: state, event, to: STATES.INTRODUCTION_OPEN };
  }
  if (!(TOEGESTAAN[event] || []).includes(state)) {
    return { ok: false, code: 'INVALID_PRODUCT_TRANSITION', from: state, event };
  }
  return { ok: true, from: state, event };
}

module.exports = { STATES, EVENTS, arrangeBinding, consentVoor, root, candidate, match, introduction, table, encounter, together, relationship, transition };
