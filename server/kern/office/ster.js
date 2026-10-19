/* RTG Office: een document markeren. Afgesplitst uit ./docs.js (19 oktober
   2026), dat over de 10 KB-maat ging toen de herhaalbescherming erbij kwam
   (./herhaling.js); markeren is de enige handeling daar die niets met het
   maken of schrijven van een document te maken heeft. */
'use strict';

module.exports = ({ save }, basis) => {
  const { docMet } = basis;
  /* ---- een document markeren: het staat dan bovenaan in de drive ---- */
  function ster(key, did, aan) {
    const d = docMet(did);
    if (!d) return { status: 404, error: 'Document niet gevonden.' };
    if (d.key !== key) return { status: 403, error: 'Alleen de eigenaar markeert een document.' };
    d.ster = aan !== false;
    save();
    return { status: 200, ok: true, ster: d.ster };
  }

  return { officeSter: ster };
};
