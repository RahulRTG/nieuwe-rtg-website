/* Benoemde serverprojecties: iedere consumer krijgt alleen zijn allowlist. */
'use strict';

const VERSION = 6;
const { rahulOutputGuard } = require('./connection-projection-rahul');

const NAMES = Object.freeze({
  VONK_PROFILE_OWNER: 'VONK_PROFILE_OWNER',
  VONK_PROFILE_MEDIA_OWNER: 'VONK_PROFILE_MEDIA_OWNER',
  VONK_DISCOVERY: 'VONK_DISCOVERY',
  VONK_MATCH: 'VONK_MATCH',
  VONK_CONVERSATION: 'VONK_CONVERSATION',
  VONK_MEET: 'VONK_MEET',
  CONNECTION_COMMUNICATION: 'CONNECTION_COMMUNICATION',
  CONNECTION_CALL: 'CONNECTION_CALL',
  RENDEZVOUS_PROFILE_OWNER: 'RENDEZVOUS_PROFILE_OWNER',
  RENDEZVOUS_MATCH: 'RENDEZVOUS_MATCH',
  RENDEZVOUS_INTRODUCTION: 'RENDEZVOUS_INTRODUCTION',
  RENDEZVOUS_PRESENCE: 'RENDEZVOUS_PRESENCE',
  RENDEZVOUS_ENCOUNTER: 'RENDEZVOUS_ENCOUNTER',
  RENDEZVOUS_TABLE_MEMBER: 'RENDEZVOUS_TABLE_MEMBER',
  RENDEZVOUS_TABLE_OFFICE: 'RENDEZVOUS_TABLE_OFFICE',
  RENDEZVOUS_TOGETHER: 'RENDEZVOUS_TOGETHER',
  RENDEZVOUS_MEET: 'RENDEZVOUS_MEET',
  RENDEZVOUS_CONCIERGE_MEMBER: 'RENDEZVOUS_CONCIERGE_MEMBER',
  RENDEZVOUS_CONCIERGE_OFFICE: 'RENDEZVOUS_CONCIERGE_OFFICE',
  RENDEZVOUS_CIRCLE_MEMBER: 'RENDEZVOUS_CIRCLE_MEMBER',
  RENDEZVOUS_CIRCLE_OFFICE: 'RENDEZVOUS_CIRCLE_OFFICE',
  CONNECTION_PARTNER_OFFICE: 'CONNECTION_PARTNER_OFFICE',
  RAHUL_CONNECTION: 'RAHUL_CONNECTION',
  BACKOFFICE_SAFETY: 'BACKOFFICE_SAFETY',
  VONK_EDGE: 'VONK_EDGE',
  RENDEZVOUS_EDGE: 'RENDEZVOUS_EDGE'
});

const CONTRACTS = Object.freeze({
  [NAMES.VONK_PROFILE_OWNER]: ['codenaam', 'over', 'leeftijd', 'stad', 'interesses', 'betrouwbaarheid', 'kenmerken', 'geslacht', 'zoekt', 'leeftijdMin', 'leeftijdMax', 'maxKm', 'actief', 'afstandActief', 'wensen', 'zicht', 'beschikbaar', 'datewens', 'media'],
  [NAMES.VONK_PROFILE_MEDIA_OWNER]: ['media'],
  [NAMES.VONK_DISCOVERY]: ['codenaam', 'over', 'leeftijd', 'stad', 'interesses', 'betrouwbaarheid', 'kenmerken', 'gemeen', 'waarom', 'media'],
  [NAMES.VONK_MATCH]: ['id', 'met', 'at', 'status', 'betrouwbaarheid', 'tafel', 'reservering', 'ikBetaalde', 'anderBetaalde', 'berichten', 'kenmerken', 'wanneer', 'media'],
  [NAMES.VONK_CONVERSATION]: ['van', 'tekst', 'kind', 'media', 'at'],
  [NAMES.VONK_MEET]: ['supplierCode', 'supplierName', 'plek', 'middenAfstandKm', 'datum', 'tijd', 'prijsPP', 'rtgDeel', 'soort', 'reisminuten', 'waarom'],
  [NAMES.CONNECTION_COMMUNICATION]: ['scope', 'messages', 'consent', 'call'],
  [NAMES.CONNECTION_CALL]: ['id', 'type', 'state', 'incoming', 'revision', 'signals'],
  [NAMES.RENDEZVOUS_PROFILE_OWNER]: ['codenaam', 'rooster', 'profiel'],
  [NAMES.RENDEZVOUS_MATCH]: ['id', 'codenaam', 'gedeeldeLocaties', 'samen', 'wanneer', 'voorstel', 'sinds', 'media'],
  [NAMES.RENDEZVOUS_INTRODUCTION]: ['id', 'codenaam', 'over', 'zoekt', 'wensen', 'locaties', 'gedeeldeLocaties', 'samen', 'likteMij', 'status', 'soort', 'aanleiding', 'ikAntwoordde', 'geopend', 'at', 'media'],
  [NAMES.RENDEZVOUS_PRESENCE]: ['stad', 'van', 'tot'],
  [NAMES.RENDEZVOUS_ENCOUNTER]: ['ok', 'wacht', 'codenaam'],
  [NAMES.RENDEZVOUS_TABLE_MEMBER]: ['id', 'naam', 'stad', 'datum', 'tijd', 'thema', 'plaatsen', 'mijnStatus'],
  [NAMES.RENDEZVOUS_TABLE_OFFICE]: ['id', 'naam', 'stad', 'datum', 'tijd', 'thema', 'plaatsen', 'at', 'genodigden', 'toegezegd', 'aantal', 'supplierCode', 'supplierName'],
  [NAMES.RENDEZVOUS_TOGETHER]: ['samen', 'met', 'ikVerklaarde'],
  [NAMES.RENDEZVOUS_MEET]: ['setting', 'settingLabel', 'stad', 'van', 'tot', 'dagdeel', 'dagdeelLabel', 'ikAkkoord', 'anderAkkoord', 'tekst', 'bijRechterhand', 'fulfilmentState', 'confirmation', 'partnerName'],
  [NAMES.RENDEZVOUS_CONCIERGE_MEMBER]: ['id', 'subject', 'request', 'city', 'window', 'state', 'proposal', 'confirmation', 'partnerName', 'updatedAt'],
  [NAMES.RENDEZVOUS_CONCIERGE_OFFICE]: ['id', 'member', 'subject', 'request', 'city', 'window', 'state', 'proposal', 'confirmation', 'partnerCode', 'partnerName', 'updatedAt'],
  [NAMES.RENDEZVOUS_CIRCLE_MEMBER]: ['id', 'name', 'theme', 'context', 'membership', 'gatherings'],
  [NAMES.RENDEZVOUS_CIRCLE_OFFICE]: ['id', 'name', 'theme', 'members', 'gatherings'],
  [NAMES.CONNECTION_PARTNER_OFFICE]: ['code', 'name', 'city', 'location', 'program', 'services'],
  [NAMES.RAHUL_CONNECTION]: ['matchCodenaam', 'gedeeldeLocaties', 'openLocaties', 'watIkZoek', 'presence', 'gedeeldDagdeel', 'voorkeursStad'],
  [NAMES.BACKOFFICE_SAFETY]: ['id', 'van', 'over', 'reden', 'at', 'status'],
  [NAMES.VONK_EDGE]: ['surface', 'state', 'availableCapabilities', 'actions', 'stateRevision', 'policyVersion', 'projectionVersion', 'stateContractVersion'],
  [NAMES.RENDEZVOUS_EDGE]: ['surface', 'state', 'availableCapabilities', 'actions', 'stateRevision', 'policyVersion', 'projectionVersion', 'stateContractVersion']
});

/* `null` mag betekenis hebben (bijvoorbeeld: het lid heeft nog niet
   geantwoord). Alleen een niet-geselecteerd veld blijft volledig afwezig. */
const aanwezig = v => v !== undefined;
const kopie = v => Array.isArray(v) ? v.map(kopie)
  : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, kopie(x)])) : v;

function alleen(source, velden) {
  const uit = {};
  const s = source && typeof source === 'object' ? source : {};
  for (const veld of velden) if (aanwezig(s[veld])) uit[veld] = kopie(s[veld]);
  return uit;
}

function presence(v) {
  return alleen(v, CONTRACTS[NAMES.RENDEZVOUS_PRESENCE]);
}

function connectionProject(name, source) {
  if (!CONTRACTS[name]) throw new Error('Onbekende Connection-projectie: ' + name);
  const s = source && typeof source === 'object' ? source : {};
  const uit = alleen(s, CONTRACTS[name]);

  if ([NAMES.VONK_PROFILE_OWNER, NAMES.VONK_PROFILE_MEDIA_OWNER, NAMES.VONK_DISCOVERY, NAMES.VONK_MATCH].includes(name)
      && aanwezig(s.media)) {
    /* Een opslagref, owner-key of lifecycle-log kan via een objectspread nooit
       meeliften. Ook geneste media hebben hun eigen vaste contract. */
    uit.media = (Array.isArray(s.media) ? s.media : []).map(m => alleen(m,
      ['id', 'purpose', 'visibility', 'processingState', 'publicationState', 'moderationState',
        'verificationState', 'width', 'height', 'mime', 'position', 'version', 'alt', 'src', 'expiresAt']));
  }

  if (name === NAMES.VONK_MATCH) {
    if (aanwezig(s.tafel)) uit.tafel = connectionProject(NAMES.VONK_MEET, s.tafel);
    if (aanwezig(s.reservering)) uit.reservering = alleen(s.reservering,
      ['reference', 'state', 'finality', 'missing']);
    if (aanwezig(s.berichten)) uit.berichten = s.berichten.map(x => connectionProject(NAMES.VONK_CONVERSATION, x));
  }
  if (name === NAMES.VONK_CONVERSATION && aanwezig(s.media) && s.media) {
    uit.media = alleen(s.media, ['purpose', 'mime', 'src']);
  }
  if (name === NAMES.CONNECTION_COMMUNICATION) {
    if (aanwezig(s.messages)) uit.messages = s.messages.map(m => alleen(m, ['id', 'kind', 'mine', 'text', 'at', 'media']));
    for (const m of uit.messages || []) if (m.media) m.media = alleen(m.media, ['purpose', 'mime', 'src', 'transcript']);
    if (aanwezig(s.consent)) uit.consent = alleen(s.consent, ['voice', 'video']);
    if (aanwezig(s.call) && s.call) uit.call = connectionProject(NAMES.CONNECTION_CALL, s.call);
  }
  if (name === NAMES.RENDEZVOUS_MATCH || name === NAMES.RENDEZVOUS_INTRODUCTION) {
    if (aanwezig(s.samen)) uit.samen = s.samen.map(presence);
    if (aanwezig(s.media)) uit.media = (Array.isArray(s.media) ? s.media : []).map(m => alleen(m,
      ['id', 'purpose', 'visibility', 'processingState', 'publicationState', 'moderationState',
        'verificationState', 'width', 'height', 'mime', 'position', 'version', 'alt', 'src', 'expiresAt']));
  }
  if (name === NAMES.RENDEZVOUS_PROFILE_OWNER && aanwezig(s.profiel)) {
    uit.profiel = alleen(s.profiel, ['aan', 'over', 'zoekt', 'wensen', 'locaties', 'thuis', 'aanwezig', 'beschikbaar', 'media']);
    if (aanwezig(s.profiel.aanwezig)) uit.profiel.aanwezig = s.profiel.aanwezig.map(presence);
    if (aanwezig(s.profiel.media)) uit.profiel.media = s.profiel.media.map(m => alleen(m,
      ['id', 'purpose', 'visibility', 'processingState', 'publicationState', 'moderationState',
        'verificationState', 'width', 'height', 'mime', 'position', 'version', 'alt', 'src', 'expiresAt']));
  }
  if (name === NAMES.RENDEZVOUS_TABLE_OFFICE && aanwezig(s.genodigden)) {
    uit.genodigden = s.genodigden.map(g => alleen(g, ['codenaam', 'status']));
  }
  if (name === NAMES.RAHUL_CONNECTION) {
    if (aanwezig(s.presence)) uit.presence = s.presence.map(presence);
  }
  if ((name === NAMES.VONK_EDGE || name === NAMES.RENDEZVOUS_EDGE) && aanwezig(s.actions)) {
    uit.actions = s.actions.map(a => alleen(a, ['id', 'labelKey', 'capability', 'intent']));
  }
  return uit;
}

function projectList(name, rows) {
  return (Array.isArray(rows) ? rows : []).map(row => connectionProject(name, row));
}

module.exports = { VERSION, NAMES, CONTRACTS, project: connectionProject, projectList, rahulOutputGuard };
