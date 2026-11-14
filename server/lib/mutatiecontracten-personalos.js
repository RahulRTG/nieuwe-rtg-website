/* PersonalOS: vier lezers en één idempotente voorkeurenmutatie. De compositie
   verleent geen bevoegdheid en schrijft geen gebruiksgeschiedenis. */
'use strict';
const OP = '2026-11-10';
const AF = { door: 'Codex, handler en ketentests gelezen en gedraaid; niet onafhankelijk door een mens afgetekend', op: OP };
const OPEN = { klasse: 'PUBLIC', waarom: 'contract en preview horen bij de openbare progressieve kennismaking; de preview claimt uitdrukkelijk geen bevoegdheid' };
const EIGEN = { klasse: 'AUTHENTICATED', deur: 'auth + eigenAccount' };
const lees = (id, toegang, bewijs) => ({ mutatieId: id, herkomst: 'mens',
  semantiek: { klasse: 'idempotent' }, toegang, stand: 'NOT_APPLICABLE',
  bewijs: { gemeten: bewijs, op: OP }, nagekeken: 'handler leest of berekent en roept geen opslagschrijver aan', afgetekend: AF });

const CONTRACTEN = {
  'POST /api/personalos/contract': lees('personalos.contract', OPEN,
    'pure contractprojectie; geen account of opslag geraadpleegd'),
  'POST /api/personalos/preview': lees('personalos.preview', OPEN,
    'test/personalos.test.js: herhaalde invoer geeft dezelfde compositionVersion en authorizationClaim=false'),
  'POST /api/personalos/preferences': lees('personalos.preferences', EIGEN,
    'test/personalos.test.js: canonieke voorkeuren van uitsluitend het eigen account'),
  'POST /api/personalos/composition': lees('personalos.composition', EIGEN,
    'test/personalos.test.js: twee accounts blijven gescheiden en clientcontext wordt genegeerd'),
  'POST /api/personalos/complete': {
    mutatieId: 'personalos.complete', herkomst: 'mens', semantiek: { klasse: 'idempotent' },
    toegang: EIGEN, stand: 'PROTECTED',
    bewijs: { gemeten: 'test/personalos.test.js: dezelfde invoer tweemaal laat revisie gelijk en antwoordt changed=false', op: OP },
    afgetekend: AF
  }
};
module.exports = { CONTRACTEN };
