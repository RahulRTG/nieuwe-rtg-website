/* Een nieuwe organisatie-incasso krijgt vlak voor provider-I/O dezelfde
   actuele eigenaarscontrole als het aanbod. Reeds gestarte opdrachten blijven
   herstelbaar: een gewijzigde binding wist geen echte providerbetaling uit. */
'use strict';
module.exports = function controle(data, c, nu) {
  const organisatie = require('../commercie/organisatieabonnement')({ db: { data }, nu });
  if (c.aanbod.scope.soort === 'zaak') {
    const r = organisatie.controleZaak(c.aanbod.scope.code);
    if (!r.ok) throw Error(r.error);
    return;
  }
  if (c.aanbod.scope.soort !== 'organisatie') return;
  const a = (data.aanmeldingen || []).find(a => a.id === c.aanmeldingId && a.accountId === c.accountId && a.pas === c.pas);
  const b = a?.besluit;
  if (a?.status !== 'geaccepteerd' || b?.besluit !== 'geaccepteerd' ||
      typeof b.door !== 'string' || b.door.trim().length < 2 ||
      /gedeelde code|RTG-personeel|^AI$|getekend en betaald contract/i.test(b.door) ||
      !Number.isFinite(Date.parse(b.at)) || b.organisatie !== c.aanbod.scope.code)
    throw Error('De actuele menselijke toelating voor deze organisatie ontbreekt; geen nieuwe betaalstart.');
  const r = organisatie.controle(c, { voorstel: true });
  if (!r.ok) throw Error(r.error);
};
