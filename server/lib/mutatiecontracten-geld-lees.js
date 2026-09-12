/* ============================================================================
   DE BEDOELING VAN DE WAARDEBEWEGENDE ROUTES -- deel LEZEN.

   Drie routes uit dezelfde ronde als ./mutatiecontracten-geld.js die geen stand
   ZETTEN maar alleen lezen of rekenen. Ze staan apart omdat deel A op 9768 byte
   kwam -- vlak onder de keuringsgrens van 10 kB -- en de norm daar terecht op
   aansloeg: een bestand dat tegen de grens aankruipt draagt een tweede
   onderwerp. Dat was hier ook zo. Een waarde zetten en een waarde opvragen zijn
   niet dezelfde soort handeling, en dat ze allebei `idempotent` heten maakt ze
   niet hetzelfde.

   Zie de kop van deel A voor hoe deze contracten tot stand zijn gekomen en wat
   de aftekening wel en niet betekent.
   ========================================================================== */
'use strict';

const { AFGETEKEND } = require('./mutatiecontracten-geld');

const s = (klasse) => ({ klasse });

const CONTRACTEN = {
  /* ---- lezen of rekenen: geen eigen stand ---- */
  'POST /api/kosten/vooruitblik': {
    mutatieId: 'kosten.vooruitblik', herkomst: 'mens', toegang: { klasse: 'AUTHENTICATED' }, semantiek: s('idempotent'), stand: 'NOT_APPLICABLE', nagekeken: 'Claude (Opus 5) door de handler te lezen, 2026-09-12; geen mens heeft hem nagelezen', afgetekend: AFGETEKEND,
    waarom: 'De route rekent een vooruitblik uit en geeft hem terug; er wordt niets van ' +
      'de gebruiker vastgelegd. Dat de opslagmeting `economie` zag bewegen komt van de ' +
      'kostenmeter die ELK verzoek telt (kern/kosten/haak.js) en niet van deze handeling ' +
      '-- anders zou geen enkele route van dit huis idempotent kunnen heten.',
    bewijs: { gemeten: 'IDEMPROEF.json: beschermd', op: '2026-09-12' }
  },
  'POST /api/supplier/facturen/pdf': {
    mutatieId: 'facturatie.pdf', herkomst: 'mens', toegang: { klasse: 'AUTHENTICATED' }, semantiek: s('idempotent'), stand: 'NOT_APPLICABLE', nagekeken: 'Claude (Opus 5) door de handler te lezen, 2026-09-12; geen mens heeft hem nagelezen', afgetekend: AFGETEKEND,
    waarom: 'De handler zoekt de factuur op, controleert of hij van deze zaak is, en ' +
      'rendert een PDF. Geen schrijfactie.',
    bewijs: { gemeten: 'niet gemeten: BLOCKED_BY_TEST_FIXTURE (geen factuur van deze zaak)', op: '2026-09-12' }
  },
  'POST /api/supplier/oog/overzicht': {
    mutatieId: 'oog.overzicht', herkomst: 'mens', toegang: { klasse: 'AUTHENTICATED' }, semantiek: s('idempotent'), stand: 'NOT_APPLICABLE', nagekeken: 'Claude (Opus 5) door de handler te lezen, 2026-09-12; geen mens heeft hem nagelezen', afgetekend: AFGETEKEND,
    waarom: 'De handler is `res.json(oogOverzicht(req.supplier))` -- puur lezen.',
    bewijs: { gemeten: 'niet gemeten: BLOCKED_BY_TEST_FIXTURE', op: '2026-09-12' }
  }
};

module.exports = { CONTRACTEN };
