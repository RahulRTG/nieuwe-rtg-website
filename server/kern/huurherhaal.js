/* De herhaalsleutel van een autohuur (routes/member/voertuigen/huur.js).
   Het scherm stuurt bij boeken een sleutel (RTGIdem); die staat bij de huur,
   zodat een dubbeltik, een afgebroken verzoek of een herstart dezelfde huur
   teruggeeft en niet "al verhuurd" -- door de eigen, nog onbetaalde boeking.
   Een andere boeking (zaak, auto of periode) onder dezelfde sleutel is een 409.
   Geeft null als er niets te herhalen is. */
'use strict';

function huurHerhaling(boekingen, key, idem, wil) {
  if (!idem) return null;
  const b = (boekingen || []).find(x => x.kind === 'huur' && x.customerKey === key && x.idem === idem);
  if (!b) return null;
  if (b.supplierCode !== wil.supplierCode || b.autoId !== wil.autoId || b.van !== wil.van || b.tot !== wil.tot)
    return { status: 409, error: 'Deze tik hoort bij een andere boeking. Probeer het opnieuw.' };
  return { status: 200, huur: b };
}

module.exports = { huurHerhaling };
