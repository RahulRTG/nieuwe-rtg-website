/* Ownerpoort vóór EN na provider-I/O. Alleen de response draagt de secret;
   de duurzame waarheid of publieke stand krijgt deze niet. */
'use strict';
module.exports = ({ vanActor, anker, betaal }) => async function herstel(id, actor) {
  const leeg = l => l == null || Array.isArray(l) && l.length === 0;
  const eis = r => {
    if (!r || r.actor !== actor || !/^acc:[1-9]\d*$/.test(actor) ||
        !['GEWEIGERD', 'WACHT_OP_KLANT'].includes(r.status) || r.provider !== 'stripe' ||
        !/^pi_/.test(r.providerId || '') || r.start?.terugkerend?.modus !== 'innen' ||
        r.soort !== 'factuur' || r.context?.own !== true ||
        actor !== 'acc:' + r.context.accountId || !r.context.contractId ||
        r.context.invoiceId !== r.bronRef || !Number.isSafeInteger(r.context.termijn) || r.context.termijn < 2 ||
        r.terugbetaaldCenten !== 0 || !leeg(r.terugbetalingen) || !leeg(r.terugbetaalOpdrachten))
      throw Error('Deze eigen termijnbetaling heeft geen toegestane klantactie.');
  };
  const r = vanActor(id, actor); eis(r);
  const actueel = anker(r);
  const uit = await betaal.haalKlantactie({ aanbieder: r.provider, providerId: r.providerId,
    referentie: r.id, bedrag: r.centen, valuta: r.valuta, terugkerend: r.start.terugkerend });
  eis(actueel());
  return uit;
};
