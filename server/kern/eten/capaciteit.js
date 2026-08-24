/* Eén navertelbare capaciteitsstand voor ontdekking, ETA en partnerwerkblad. */
'use strict';
const { openWerk } = require('../horeca/keukenlaag');

function bereken(h) {
  h = h || {};
  const c = h.etenCapaciteit || {};
  const werk = openWerk(h);
  const limiet = Math.max(10, Number(c.limietMinuten) || 35);
  const druk = werk.wachttijd >= limiet, vol = werk.wachttijd >= limiet * 1.5;
  const ingesteld = Math.max(0, Number(c.extraMinuten) || 0);
  const automatisch = druk ? Math.min(45, Math.max(0, Math.ceil(werk.wachttijd / 5) * 5 - 10)) : 0;
  return { open:c.open !== false, auto:c.auto !== false, stand:vol ? 'vol' : druk ? 'druk' : 'rustig',
    extraMinuten:c.auto === false ? ingesteld : Math.max(ingesteld, automatisch),
    ingesteldeExtraMinuten:ingesteld, limietMinuten:limiet,
    afhalenPromoten:!!c.afhalenPromoten || vol,
    gepauzeerdeItems:(c.gepauzeerdeItems || []).slice(0, 100),
    kokken:werk.kokken, openMinuten:werk.openMinuten, openRegels:werk.regels,
    wachttijd:werk.wachttijd, perStation:werk.perStation, rekensom:werk.rekensom };
}

module.exports = { bereken };
