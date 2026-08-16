'use strict';

/* Eén antwoordsvorm voor vaste workflowacties van de leveranciersassistent.
   Mutaties blijven voorstellen totdat de mens het exacte servervoorstel via
   het afzonderlijke bevestigingsendpoint uitvoert. */
module.exports = async (kern, req, wereld, antwoord, pad, body, klaar) => {
  const uit = await kern.stuurRoep(req, pad, body, { wereld });
  if (uit && uit.goedkeuring) return antwoord(
    klaar + ' Controleer het exacte voorstel en bevestig het zelf.', false, {
      stuur: [{ pad, status: uit.status, goedkeuring: uit.goedkeuring }],
      goedkeuringen: [uit.goedkeuring],
      goedkeuringWereld: wereld
    });
  const fout = uit && (uit.error || (uit.antwoord && uit.antwoord.error));
  return antwoord(fout || klaar, !!(uit && uit.status < 400), {
    stuur: [{ pad, status: uit && uit.status }]
  });
};
