/* De body van een SESSIEtoken: `<id>.<exp>.<uitgegeven>[.<sid>[.<apparaat>]]`.
   Een actietoken (`<id>.<doel>.<exp>.<nonce>`) is met dezelfde sleutel getekend
   en paste vroeger in verifyToken: zijn doel landde in het exp-slot en
   `NaN < Date.now()` is false, dus de vervalcontrole sloeg nooit aan en elk
   actietoken -- ook het 2FA-bewijs -- gold als sessie (audit B-1, P0).
   Id, exp en uitgegeven zijn daarom cijfers, of het is geen sessietoken.
   Een oud token zonder uitgegeven blijft geldig. Fail-closed: null. */
'use strict';
const CIJFERS = /^\d+$/;

function sessieDelen(body) {
  const d = String(body).split('.');
  if (!CIJFERS.test(d[0]) || !CIJFERS.test(d[1] || '')) return null;
  if (d[2] !== undefined && !CIJFERS.test(d[2])) return null;
  return d;
}

/* Het DOEL van een actietoken staat op de plek waar een sessietoken zijn exp
   heeft. Een doel dat zelf een getal is (of een punt bevat) zou daar voor een
   tijdveld kunnen doorgaan: dus nooit uitgeven. Kleine letters, cijfers en
   streepjes, beginnend met een letter. */
const DOEL = /^[a-z][a-z0-9-]{0,39}$/;
const doelGeldig = (doel) => typeof doel === 'string' && DOEL.test(doel);

module.exports = { sessieDelen, doelGeldig };
