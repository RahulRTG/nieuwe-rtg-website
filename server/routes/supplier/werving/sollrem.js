'use strict';
/* EEN EIGEN REM OP DE ANONIEME SOLLICITATIE (ARBEID.md par. 4 punt 8). Deze
   route heeft geen inlog, en de lijst van een zaak bewaart er 100: wie dat
   aantal volduwde, drukte echte sollicitaties -- ook die van leden en
   gezinsleden -- er stil uit. Geteld worden alleen OPGESLAGEN sollicitaties,
   per afzender en per zaak: een fout formulier kost niets, en een zaak kan niet
   door een ander op slot worden gezet. */
const SOLL_PER_UUR = 10;
const sollTeller = new Map(); // ip|zaak -> { vanaf, n }
function sollRem(ip, code) {
  const k = String(ip) + '|' + code, nu = Date.now();
  let b = sollTeller.get(k);
  if (!b || nu - b.vanaf > 3600000) { b = { vanaf: nu, n: 0 }; sollTeller.set(k, b); }
  if (sollTeller.size > 5000) for (const [kk, bb] of sollTeller) if (nu - bb.vanaf > 3600000) sollTeller.delete(kk);
  return b;
}
/* Remt en antwoordt: true = tegengehouden (429 is al verstuurd), anders is
   deze sollicitatie geteld. */
function sollGeremd(res, ip, code) {
  const b = sollRem(ip, code);
  if (b.n >= SOLL_PER_UUR) {
    res.status(429).json({ error: 'U hebt hier het afgelopen uur al veel sollicitaties ingestuurd. Probeer het later opnieuw, of bel de zaak.' });
    return true;
  }
  b.n += 1;
  return false;
}
module.exports = { sollRem, sollGeremd, SOLL_PER_UUR };
