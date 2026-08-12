/* Accounts (deelbestand): E-MAILBEVESTIGING EN WACHTWOORD-HERSTEL.

   Dit stond in ./tokens.js, en daar ging het over iets anders: de ene vorm van
   een sessietoken, het ondertekenen ervan en de intreklijst. Een herstelcode is
   geen sessietoken -- hij wordt niet ondertekend maar GEHASHT bewaard, hij
   verloopt op een tijdstip in de database in plaats van in zijn eigen inhoud,
   en hij geeft geen toegang maar het recht om een wachtwoord te zetten. Twee
   soorten geheim in een bestand is precies hoe je ze door elkaar gaat halen.

   WAT ER GEHASHT LIGT EN WAT NIET. Van de herstelcode bewaren we alleen de
   sha256; de code zelf gaat een keer per mail de deur uit en staat nergens.
   Wie de database leest, kan er dus geen account mee overnemen.

   EEN NIEUW WACHTWOORD BEEINDIGT ELKE LOPENDE SESSIE, en dat is de regel die
   hier het zwaarst weegt. Dat gebeurde niet: wie eenmaal binnen was bleef
   dertig dagen binnen, ook na een volledig herstel. Juist bij een herstel is
   dat verkeerd om -- iemand herstelt zijn wachtwoord meestal OMDAT er iets mis
   is, en dan hoort de ander eruit te vliegen, niet te blijven zitten. Het token
   is staatloos, dus er valt niets weg te gooien; wat wel kan is een grens per
   account (`sessies_vanaf`): alles wat voor dit moment is uitgegeven telt niet
   meer. Zie verifyToken in ./tokens.js, dat die grens leest. */
'use strict';

const crypto = require('crypto');
const S = require('./state');
const kluis = require('./kluis');
const mirror = require('./mirror');

function maakHerstel(getUserById) {

  function setEmailVerified(userId) {
    S.zin('UPDATE users SET email_verified = 1 WHERE id = ?').run(userId);
    mirror.markUser(userId);
    return getUserById(userId);
  }

  function createReset(userId, ttlMs = 3600000) {
    const token = crypto.randomBytes(24).toString('hex');
    const hash = crypto.createHash('sha256').update(token).digest('hex');
    S.zin('UPDATE users SET reset_hash = ?, reset_expires = ? WHERE id = ?').run(hash, Date.now() + ttlMs, userId);
    mirror.markUser(userId);
    return token;
  }

  function findByReset(token) {
    const hash = crypto.createHash('sha256').update(String(token || '')).digest('hex');
    const u = S.zin('SELECT * FROM users WHERE reset_hash = ?').get(hash);
    if (!u || !u.reset_expires || u.reset_expires < Date.now()) return null;
    return u;
  }

  /* Het wachtwoord zetten ruimt de herstelcode meteen op (reset_hash en
     reset_expires op NULL): een code die na gebruik blijft staan, is een tweede
     sleutel die niemand meer in de gaten houdt. En `sessies_vanaf` gaat op nu --
     zie de kop hierboven. */
  async function setPassword(userId, password) {
    S.zin('UPDATE users SET password_hash = ?, reset_hash = NULL, reset_expires = NULL, sessies_vanaf = ? WHERE id = ?')
      .run(await kluis.hashPassword(password), Date.now(), userId);
    mirror.markUser(userId);
    return getUserById(userId);
  }

  return { setEmailVerified, createReset, findByReset, setPassword };
}

module.exports = { maakHerstel };
