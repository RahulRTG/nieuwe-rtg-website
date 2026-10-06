/* Vonk heeft meerdere kleine state machines per context. Discovery, een match
   en een afspraak zijn dus niet in een universele trechter geperst. De server
   leidt iedere toestand af uit de bestaande productwaarheid. */
'use strict';

const STATES = Object.freeze({
  DISCOVERY: 'DISCOVERY',
  MATCH: 'MATCH',
  CONVERSATION: 'CONVERSATION',
  MEET_PLANNING: 'MEET_PLANNING',
  MEET_AWAITING_BOTH: 'MEET_AWAITING_BOTH',
  RESERVATION_PENDING: 'RESERVATION_PENDING',
  RESERVATION_UNKNOWN: 'RESERVATION_UNKNOWN',
  RESERVATION_REJECTED: 'RESERVATION_REJECTED',
  DATE_CONFIRMED: 'DATE_CONFIRMED',
  DATE_ACTIVE: 'DATE_ACTIVE',
  POST_DATE: 'POST_DATE'
});

const EVENTS = Object.freeze({
  CHOOSE_CANDIDATE: 'CHOOSE_CANDIDATE',
  SEND_MESSAGE: 'SEND_MESSAGE',
  PLAN_MEET: 'PLAN_MEET',
  CHOOSE_PLACE: 'CHOOSE_PLACE',
  CONFIRM_PAYMENT: 'CONFIRM_PAYMENT',
  BLOCK: 'BLOCK'
});

function root(profile, facts) {
  return { surface: 'VONK_ROOT', state: STATES.DISCOVERY,
    candidates: ['connection.profile.manage', 'connection.discover', 'connection.match.read'],
    fingerprint: { profile: !!profile, active: !!(profile && profile.actief), ...(facts || {}) } };
}

function discovery(profile, facts) {
  return { surface: 'VONK_DISCOVERY', state: STATES.DISCOVERY,
    candidates: ['connection.match.choose', 'connection.safety.block'],
    fingerprint: { profile: !!profile, active: !!(profile && profile.actief), ...(facts || {}) } };
}

function match({ match: m, key, now, communication }) {
  if (!m) return null;
  const today = String(now || new Date().toISOString()).slice(0, 10);
  const date = m.tafel && m.tafel.datum ? String(m.tafel.datum) : '';
  const reservationEvidence = m.reservationEvidence || {};
  const providerConfirmed = reservationEvidence.state === 'CONFIRMED' &&
    !(reservationEvidence.missing || []).includes('provider-confirmation');
  let state = STATES.CONVERSATION;
  let surface = 'VONK_MATCH';
  if (m.status === 'bevestigd' && providerConfirmed) {
    state = !date || date > today ? STATES.DATE_CONFIRMED : date === today ? STATES.DATE_ACTIVE : STATES.POST_DATE;
    /* Vanaf bevestiging is de ontmoeting het product. Dezelfde bewezen Date /
       Safety-projectie blijft actief tot en met de dag zelf; Route blijft door
       implemented:false volledig afwezig. */
    if ([STATES.DATE_CONFIRMED, STATES.DATE_ACTIVE].includes(state)) surface = 'VONK_DATE_ACTIVE';
  } else if (m.status === 'bevestigd') state = STATES.RESERVATION_UNKNOWN;
  else if (m.status === 'reservering-aangevraagd') state = STATES.RESERVATION_PENDING;
  else if (m.status === 'reservering-onbekend') state = STATES.RESERVATION_UNKNOWN;
  else if (m.status === 'reservering-geweigerd') state = STATES.RESERVATION_REJECTED;
  else {
    const keuzes = m.halfweg && m.halfweg.keuzes ? m.halfweg.keuzes : {};
    const aantal = Object.keys(keuzes).length;
    if (aantal === 1) state = STATES.MEET_AWAITING_BOTH;
    else if (aantal >= 2) state = STATES.MEET_PLANNING;
  }
  const basis = ['connection.message', 'connection.media', 'connection.communication.consent', 'connection.safety.block'];
  if (communication && communication.voice) basis.push('connection.voice');
  if (communication && communication.video) basis.push('connection.video');
  if (![STATES.DATE_ACTIVE, STATES.POST_DATE, STATES.RESERVATION_PENDING,
    STATES.RESERVATION_UNKNOWN].includes(state)) {
    basis.push('connection.meet.plan', 'connection.meet.choose');
    if (m.tafel && !(m.betaald && m.betaald[key])) basis.push('connection.payment.confirm');
  }
  if (state === STATES.DATE_ACTIVE) basis.push('connection.meet.plan', 'connection.route');
  return { surface, state, candidates: basis, fingerprint: {
    id: m.id, status: m.status, date, choices: Object.keys((m.halfweg && m.halfweg.keuzes) || {}).sort(),
    ownPaid: !!(m.betaald && m.betaald[key]), otherPaid: !!(m.betaald && m.betaald[m.a === key ? m.b : m.a]),
    reservationEvidence: { state: reservationEvidence.state || null,
      providerConfirmation: providerConfirmed }
  } };
}

const TOEGESTAAN = Object.freeze({
  [EVENTS.CHOOSE_CANDIDATE]: [STATES.DISCOVERY],
  [EVENTS.SEND_MESSAGE]: [STATES.CONVERSATION, STATES.MEET_PLANNING, STATES.MEET_AWAITING_BOTH,
    STATES.RESERVATION_PENDING, STATES.RESERVATION_UNKNOWN, STATES.RESERVATION_REJECTED, STATES.DATE_CONFIRMED],
  [EVENTS.PLAN_MEET]: [STATES.CONVERSATION, STATES.MEET_PLANNING, STATES.MEET_AWAITING_BOTH,
    STATES.RESERVATION_REJECTED, STATES.DATE_CONFIRMED, STATES.DATE_ACTIVE],
  [EVENTS.CHOOSE_PLACE]: [STATES.CONVERSATION, STATES.MEET_PLANNING, STATES.MEET_AWAITING_BOTH,
    STATES.RESERVATION_REJECTED],
  [EVENTS.CONFIRM_PAYMENT]: [STATES.CONVERSATION, STATES.MEET_PLANNING, STATES.MEET_AWAITING_BOTH],
  [EVENTS.BLOCK]: Object.values(STATES)
});

function transition(state, event) {
  if (!(TOEGESTAAN[event] || []).includes(state)) {
    return { ok: false, code: 'INVALID_PRODUCT_TRANSITION', from: state, event };
  }
  return { ok: true, from: state, event };
}

module.exports = { STATES, EVENTS, root, discovery, match, transition };
