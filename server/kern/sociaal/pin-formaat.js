/* RTG PIN: het ene formaatcontract voor bezit, routes en clusterremmen.

   Een tweede regex aan de HTTP-rand zou vroeg of laat anders lezen dan de
   kern: juist de tekens die bij voorlezen op elkaar lijken (O/0, I/L/1 en
   U/V) maken dat gevaarlijk. Daarom delen alle lagen deze pure lezer. */
'use strict';

const ALFABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const NIEUWE_LENGTE = 10;
const OUDE_LENGTE = 8;

function normaliseer(ruw) {
  const s = String(ruw == null ? '' : ruw).toUpperCase().replace(/[^0-9A-Z]/g, '')
    .replace(/O/g, '0').replace(/[IL]/g, '1').replace(/U/g, 'V');
  if (s.length !== OUDE_LENGTE && s.length !== NIEUWE_LENGTE) return null;
  for (const teken of s) if (!ALFABET.includes(teken)) return null;
  return s;
}

// v1 blijft 4-4; de nieuwe v2-pin leest als twee even grote groepen van vijf.
const toonbaar = pin => pin ? (pin.length === OUDE_LENGTE
  ? pin.slice(0, 4) + '-' + pin.slice(4)
  : pin.slice(0, 5) + '-' + pin.slice(5)) : null;

module.exports = { ALFABET, NIEUWE_LENGTE, OUDE_LENGTE, normaliseer, toonbaar };
