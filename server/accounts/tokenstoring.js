/* KON DIT TOKEN ALLEEN DOOR EEN STORING NIET GECONTROLEERD WORDEN? (X1,
   integrator 19 oktober 2026)

   verifyToken (./tokens.js) zegt dan null, fail-closed, en dat blijft zo. Deze
   vraag komt pas daarna, op het weigerpad van `auth`: is het token wel echt
   ondertekend en niet verlopen, en gooide de opslag (intreklijst, kluis)? Dan
   is het antwoord een storing (503) en geen uitlog (401), zodat de client het
   token niet weggooit en het lid niet naar de inlog stuurt. Een rommeltoken of
   een vervalste handtekening is gewoon ongeldig: false. */
'use strict';
const kluis = require('./kluis');
const { veiligGelijk } = require('../kern/util');

module.exports = ({ strikt, isIngetrokken, sessieIngetrokken, getUserById }) => function identiteitOnbepaald(token) {
  token = strikt(token);
  if (!token) return false;
  let delen;
  try {
    const [b64, sig] = String(token).split('.');
    if (!b64 || !sig) return false;
    const body = Buffer.from(b64, 'base64url').toString();
    if (!veiligGelijk(kluis.sign(body), sig)) return false;
    delen = require('./tokenvorm').sessieDelen(body) || [];
    if (!delen[0] || !Number.isFinite(Number(delen[1])) || Number(delen[1]) < Date.now()) return false;
  } catch (e) { return false; }
  try {
    isIngetrokken(token);
    if (delen[3]) sessieIngetrokken(delen[3]);
    getUserById(Number(delen[0]));
    return false;
  } catch (e) { return true; }
};
