/* Accounts, deel "tokens": de staatloze ondertekende sessie- en actie-tokens,
   de e-mailbevestiging en het wachtwoord-herstel. Afgesplitst uit ./users.js;
   dat deel geeft getUserById mee en exporteert deze functies gewoon door, dus
   aanroepers blijven require('./users') (of accounts.js) gebruiken. */
const crypto = require('crypto');
const S = require('./state');
const kluis = require('./kluis');
const mirror = require('./mirror');

function maakTokens(getUserById) {
  /* ---------- staatloze ondertekende tokens ---------- */
  function issueToken(userId, days = 30) {
    const body = userId + '.' + (Date.now() + days * 86400000);
    return Buffer.from(body).toString('base64url') + '.' + kluis.sign(body);
  }
  function verifyToken(token) {
    try {
      const [b64, sig] = String(token).split('.');
      if (!b64 || !sig) return null;
      const body = Buffer.from(b64, 'base64url').toString();
      if (kluis.sign(body) !== sig) return null;
      const [id, exp] = body.split('.');
      if (Number(exp) < Date.now()) return null;
      return getUserById(Number(id));
    } catch (e) { return null; }
  }
  /* Doel-gebonden token (bijv. e-mailbevestiging), los van de sessie. */
  function issueActionToken(userId, purpose, ttlMs) {
    const body = userId + '.' + purpose + '.' + (Date.now() + ttlMs);
    return Buffer.from(body).toString('base64url') + '.' + kluis.sign(body);
  }
  function verifyActionToken(token, purpose) {
    try {
      const [b64, sig] = String(token).split('.');
      if (!b64 || !sig || kluis.sign(Buffer.from(b64, 'base64url').toString()) !== sig) return null;
      const [id, p, exp] = Buffer.from(b64, 'base64url').toString().split('.');
      if (p !== purpose || Number(exp) < Date.now()) return null;
      return getUserById(Number(id));
    } catch (e) { return null; }
  }

  /* ---------- e-mailbevestiging & wachtwoord-herstel ---------- */
  function setEmailVerified(userId) {
    S.db.prepare('UPDATE users SET email_verified = 1 WHERE id = ?').run(userId);
    mirror.markUser(userId);
    return getUserById(userId);
  }
  function createReset(userId, ttlMs = 3600000) {
    const token = crypto.randomBytes(24).toString('hex');
    const hash = crypto.createHash('sha256').update(token).digest('hex');
    S.db.prepare('UPDATE users SET reset_hash = ?, reset_expires = ? WHERE id = ?').run(hash, Date.now() + ttlMs, userId);
    mirror.markUser(userId);
    return token;
  }
  function findByReset(token) {
    const hash = crypto.createHash('sha256').update(String(token || '')).digest('hex');
    const u = S.db.prepare('SELECT * FROM users WHERE reset_hash = ?').get(hash);
    if (!u || !u.reset_expires || u.reset_expires < Date.now()) return null;
    return u;
  }
  async function setPassword(userId, password) {
    S.db.prepare('UPDATE users SET password_hash = ?, reset_hash = NULL, reset_expires = NULL WHERE id = ?')
      .run(await kluis.hashPassword(password), userId);
    mirror.markUser(userId);
    return getUserById(userId);
  }

  return { issueToken, verifyToken, issueActionToken, verifyActionToken,
    setEmailVerified, createReset, findByReset, setPassword };
}

module.exports = { maakTokens };
