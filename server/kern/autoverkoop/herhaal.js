/* Autoverkoop (deelmodule): de herhaalsleutel van een proefrit of koop.
   Het scherm stuurt een sleutel (RTGIdem); die staat bij de deal, zodat een
   dubbeltik, een afgebroken verzoek of een herstart dezelfde aanvraag geeft.
   Een andere aanvraag (soort, zaak of auto) onder dezelfde sleutel is een 409.
   Geeft null als er niets te herhalen is, anders { deal } of { status, error }. */
'use strict';

function herhaling(deals, key, idem, soort, code, autoId) {
  if (!idem) return null;
  const d = deals.find(x => x.key === key && x.idem === idem);
  if (!d) return null;
  if (d.soort !== soort || d.supplierCode !== code || d.autoId !== autoId)
    return { status: 409, error: 'Deze tik hoort bij een andere aanvraag. Probeer het opnieuw.' };
  return { deal: d };
}

module.exports = { herhaling };
