/* Het bestaande gezins-PIN-contract: willekeurig zout en scrypt32 als hex.
   Het accounts-wachtwoordformaat heeft eigen versie/kosten en vervangt dit
   opgeslagen profielcontract niet. Crypto blijft de geïnjecteerde provider. */
'use strict';
module.exports = ({ crypto }) => {
const scryptAsync = (pin, salt, len) => new Promise((resolve, reject) =>
  crypto.scrypt(String(pin), salt, len, (err, key) => err ? reject(err) : resolve(key)));
async function hashPin(pin) {
  const salt = crypto.randomBytes(16).toString('hex');
  return { salt, hash: (await scryptAsync(pin, salt, 32)).toString('hex') };
}
async function checkPin(rec, pin) {
  if (!rec || !rec.hash) return false;
  let h; try { h = await scryptAsync(pin, rec.salt, 32); } catch (e) { return false; }
  const b = Buffer.from(rec.hash, 'hex');
  return h.length === b.length && crypto.timingSafeEqual(h, b);
}
const geldigePin = p => /^\d{4,6}$/.test(String(p || ''));
  return { hashPin, checkPin, geldigePin };
};
