/* Eén pure zaakplanning voor de administratieve en bewezen betaalde ingang.
   De aanroeper bewaakt bewijs, eigenaar en opslag; geen toegang of opslag hier. */
'use strict';
module.exports = function plan(a, suppliers, at) {
  const b = a.bedrijf;
  const basis = String(b.naam).toUpperCase().replace(/[^A-Z]/g, '').slice(0, 10) || 'ZAAK';
  let code = basis, n = 2;
  while (suppliers.some(s => s.code === code)) code = basis + n++;
  return { code, supplier: { code, name: b.naam, type: b.type, city: b.plaats || '',
    loc: null, rate: 0, menu: [], photos: [], online: false },
    wensen: (b.behoeften || []).map(wens => ({ wens, status: 'open', at })) };
};
