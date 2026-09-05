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
const { nu: klokNu } = require('../lib/klok');

function maakHerstel(getUserById) {

  function setEmailVerified(userId) {
    S.zin('UPDATE users SET email_verified = 1 WHERE id = ?').run(userId);
    mirror.markUser(userId);
    return getUserById(userId);
  }

  function createReset(userId, ttlMs = 3600000) {
    const token = crypto.randomBytes(24).toString('hex');
    const hash = crypto.createHash('sha256').update(token).digest('hex');
    S.zin('UPDATE users SET reset_hash = ?, reset_expires = ? WHERE id = ?').run(hash, klokNu() + ttlMs, userId);
    mirror.markUser(userId);
    return token;
  }

  function findByReset(token) {
    const hash = crypto.createHash('sha256').update(String(token || '')).digest('hex');
    const u = S.zin('SELECT * FROM users WHERE reset_hash = ?').get(hash);
    if (!u || !u.reset_expires || u.reset_expires < klokNu()) return null;
    return u;
  }

  /* EEN HERSTELTOKEN WORDT IN DEZELFDE UPDATE VERBRUIKT ALS HET NIEUWE
     WACHTWOORD WORDT GEZET. Eerst alleen `findByReset()` doen en daarna op id
     schrijven laat twee gelijktijdige verzoeken allebei door: het wachtwoord
     van de laatste schrijver wint dan. De hash en vervaltijd horen daarom in
     de WHERE-clausule. Exact een verzoek krijgt `changes === 1`; ieder ander
     ziet dat de geloofsbrief al is gebruikt. */
  async function consumeReset(token, password) {
    const hash = crypto.createHash('sha256').update(String(token || '')).digest('hex');
    const kandidaat = S.zin('SELECT id, reset_expires FROM users WHERE reset_hash = ?').get(hash);
    if (!kandidaat || !kandidaat.reset_expires || kandidaat.reset_expires < klokNu()) return null;
    const nieuw = await kluis.hashPassword(password);
    const tijd = klokNu();
    const info = S.zin(`UPDATE users
      SET password_hash = ?, reset_hash = NULL, reset_expires = NULL, sessies_vanaf = ?
      WHERE id = ? AND reset_hash = ? AND reset_expires >= ?`)
      .run(nieuw, tijd, kandidaat.id, hash, tijd);
    if (!info.changes) return null;
    mirror.markUser(kandidaat.id);
    return getUserById(kandidaat.id);
  }

  /* Het wachtwoord zetten ruimt de herstelcode meteen op (reset_hash en
     reset_expires op NULL): een code die na gebruik blijft staan, is een tweede
     sleutel die niemand meer in de gaten houdt. En `sessies_vanaf` gaat op nu --
     zie de kop hierboven. */
  async function setPassword(userId, password) {
    S.zin('UPDATE users SET password_hash = ?, reset_hash = NULL, reset_expires = NULL, sessies_vanaf = ? WHERE id = ?')
      .run(await kluis.hashPassword(password), klokNu(), userId);
    mirror.markUser(userId);
    return getUserById(userId);
  }

  return { setEmailVerified, createReset, findByReset, consumeReset, setPassword };
}

module.exports = { maakHerstel };
