'use strict';
const AF = { door: 'Codex, persoonlijke beeldkeuze en accountgrens gelezen en beproefd', op: '2026-09-27' };
const common = { herkomst: 'mens', semantiek: { klasse: 'idempotent' }, toegang: { klasse: 'AUTHENTICATED' }, afgetekend: AF };
const CONTRACTEN = {
  'POST /api/ik/beelden': { ...common, mutatieId: 'ik.beelden.lezen', stand: 'NOT_APPLICABLE',
    waarom: 'Leest uitsluitend de persoonlijke presentatievoorkeur; verandert geen foto, teller of instelling.',
    nagekeken: 'Codex, server/routes/presentatie-beelden.js en server/kern/presentatie-beelden.js, 2026-09-27',
    bewijs: { gemeten: 'test/warm-presentation.e2e.js leest twee accounts en controleert de grens', op: '2026-09-27' } },
  'POST /api/ik/beelden/zet': { ...common, mutatieId: 'ik.beelden.zetten', stand: 'PROTECTED',
    waarom: 'Zet of verwijdert één beeldplek bij het eigen account; dezelfde aanroep laat dezelfde beeldkeuze en uitsneden achter.',
    bewijs: { gemeten: 'test/warm-presentation.e2e.js bewaart, herlaadt en herstelt de beeldkeuze via de echte server', op: '2026-09-27' } }
};
for (const suffix of ['', '/zet', '/mijn', '/haal', '/upload', '/upstart', '/updeel', '/upklaar']) {
  const read = ['', '/mijn', '/haal'].includes(suffix), setting = suffix === '/zet';
  CONTRACTEN['POST /api/foundation/gezin/beelden' + suffix] = {
    ...common, toegang: { klasse: 'OBJECT_SCOPED', objectVeld: 'token' }, mutatieId: 'foundation.gezin.beelden.' + (suffix.slice(1) || 'lezen'),
    semantiek: { klasse: read || setting ? 'idempotent' : 'nietHerhaalbaar' },
    stand: read ? 'NOT_APPLICABLE' : setting ? 'PROTECTED' : 'INTENTIONALLY_NON_IDEMPOTENT',
    waarom: read ? 'Leest uitsluitend het geverifieerde gezinsprofiel en zijn eigen privébestanden.' : setting ? 'Dezelfde beeldkeuze vervangt dezelfde profielvoorkeur.' : 'Een upload of volgend uploadstuk is een bewuste volgende handeling; nooit automatisch herhalen.',
    nagekeken: 'Codex, server/routes/presentatie-gezinsbeelden.js en bestaande bestandenkluis, 2026-09-28',
    bewijs: { gemeten: 'test/warm-presentation.e2e.js controleert upload en scheiding tussen gezinsprofielen', op: '2026-09-28' }
  };
}
module.exports = { CONTRACTEN };
