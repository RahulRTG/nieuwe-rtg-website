/* Deze duurzame ontvangsten moeten bij iedere retry actuele autorisatie en
   redactie controleren. Geen transportcache mag eerder antwoorden. */
'use strict';
const documentOperatie = require('./document-operatiepad');
const paden = new Set([
  '/api/aanmelding/aanvraag', '/api/member/bureau/zaak/open',
  '/api/office/bank/rekening/open', '/api/werkplek/taak',
  '/api/labfonds/scheidsrechter', '/api/office/magnaat/scan',
  '/api/rtf/onboarding/teken'
]);
module.exports = pad => documentOperatie(pad) || paden.has(String(pad || '').toLowerCase().replace(/\/$/, ''));
