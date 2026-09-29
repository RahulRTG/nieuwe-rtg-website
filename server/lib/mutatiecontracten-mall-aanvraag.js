'use strict';
/* De bronversie is verplicht. Herhalen van dezelfde laatste opdracht verandert
   niets; een oudere of ontbrekende versie wordt geweigerd. Geen betaalclaim. */
const contract = (id, deur) => ({
  mutatieId: id, herkomst: 'mens', semantiek: { klasse: 'idempotent' },
  toegang: { klasse: 'AUTHENTICATED', deur }, stand: 'PROTECTED',
  bewijs: { op: '2026-09-29', gemeten: 'test/mall-aanvraag-levensloop.test.js meet verplichte bronversies, ' +
    'intrekken, heropenen, wijzigen, teruggeven en herhalen zonder tweede gevolg. ' +
    'test/operationeel-aanvraag.test.js doorloopt de API, herhaalt kiezen/afronden en leest na nette herstart terug. ' +
    'test/operationeel-herstel.test.js meet personeelsintrekking, opslagfalen en SQLite SIGKILL na commit vóór antwoord. ' +
    'PostgreSQL, gezamenlijke policy en globale V1-certificering blijven open.' },
  afgetekend: { door: 'Codex; bron en gerichte proeven nagekeken, niet door een mens afgetekend', op: '2026-09-29' }
});
module.exports.CONTRACTEN = {
  'POST /api/mall/aanvraag/wijzig': contract('mall.aanvraag.wijzig', 'auth'),
  'POST /api/mall/aanvraag/heropen': contract('mall.aanvraag.heropen', 'auth'),
  'POST /api/supplier/mall/aanvraag/behandel': contract('mall.aanvraag.behandel', 'supplierAuth')
};
