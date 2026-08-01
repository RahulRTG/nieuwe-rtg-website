/* Accounts, deel "tokens": de staatloze ondertekende sessie- en actie-tokens,
   de e-mailbevestiging en het wachtwoord-herstel. Afgesplitst uit ./users.js;
   dat deel geeft getUserById mee en exporteert deze functies gewoon door, dus
   aanroepers blijven require('./users') (of accounts.js) gebruiken. */
const crypto = require('crypto');
const S = require('./state');
const kluis = require('./kluis');
const mirror = require('./mirror');

/* DE ENE VORM VAN EEN TOKEN.

   Een token dat wij uitgeven is `<base64url>.<32 hex>`, en niets anders. Dat
   klonk als een detail tot deze trad naar buiten kwam:

     Buffer.from(x, 'base64url') NEGEERT elk teken dat niet in het alfabet zit.
     ' <b64>' decodeert dus naar precies hetzelfde als '<b64>', en de handtekening
     klopt gewoon. Maar de INTREKLIJST hieronder bewaart kluis.sign(<de rauwe
     string>), en die is wel byte-exact. Uitloggen, en daarna hetzelfde token met
     een spatie ervoor opsturen: de lijst herkent hem niet meer en verifyToken
     zegt "prima". Uitloggen was dus met een enkel teken te omzeilen -- precies
     de fout die de intreklijst hierboven kwam repareren, een laag dieper.

   De oplossing is niet nog een normalisatie erbij (dan blijven er vormen over
   die de een wel en de ander niet ziet), maar EEN strikte vorm: wat er niet
   exact uitziet zoals wij hem uitgeven, is geen token. Fail-closed, en iedereen
   -- verifieren, intrekken, opzoeken -- kijkt naar dezelfde bytes. */
const TOKENVORM = /^[A-Za-z0-9_-]+\.[a-f0-9]{32}$/;
const strikt = (t) => (typeof t === 'string' && TOKENVORM.test(t) ? t : null);

function maakTokens(getUserById) {
  /* ---------- staatloze ondertekende tokens ---------- */
  function issueToken(userId, days = 30) {
    const body = userId + '.' + (Date.now() + days * 86400000);
    return Buffer.from(body).toString('base64url') + '.' + kluis.sign(body);
  }
  /* DE INTREKLIJST -- waarom een staatloos token er toch een nodig heeft.

     Een sessietoken is hier staatloos: alles staat erin, ondertekend met HMAC.
     Dat is snel en het schaalt, maar het heeft één gevolg dat lang onopgemerkt
     bleef: er is server-side niets om weg te gooien, dus UITLOGGEN KON NIETS
     INTREKKEN. /api/logout antwoordde { ok: true } en het token bleef daarna
     gewoon werken -- tot de vervaldatum, dertig dagen later. Op een geleende
     of gedeelde computer is dat precies het moment waarop iemand denkt veilig
     te zijn. Gevonden in aanvalsronde 2 (scripts/aanval.js, punt 14).

     De lijst blijft klein en heeft geen opruimtaak nodig: een ingetrokken
     token hoeft maar te worden onthouden tot het moment waarop het toch al zou
     verlopen. Daarna mag het weg -- verifyToken wijst het dan af op de datum.
     We ruimen luk-raak op tijdens het intrekken zelf, zodat er geen timer bij
     hoeft. */
  function trekIn(token) {
    token = strikt(token);
    if (!token) return false;
    let exp = 0;
    try {
      const body = Buffer.from(String(token).split('.')[0], 'base64url').toString();
      exp = Number(body.split('.')[1]) || 0;
    } catch (e) { return false; }
    if (!exp || exp < Date.now()) return true; // al verlopen: niets te onthouden
    try {
      // meteen opruimen wat toch al verlopen was: geen aparte taak nodig
      S.zin('DELETE FROM ingetrokken_tokens WHERE verloopt < ?').run(Date.now());
      S.zin('INSERT OR REPLACE INTO ingetrokken_tokens (hash, verloopt) VALUES (?, ?)')
        .run(kluis.sign(String(token)), exp);
      return true;
    } catch (e) { return false; }
  }
  /* Een DOELGEBONDEN token intrekken (e-mailbevestiging, SSO-overdracht).

     trekIn() hierboven werkt niet voor deze vorm: een sessietoken heeft de body
     `id.exp`, een actie-token `id.doel.exp`. trekIn leest daardoor het DOEL waar
     hij de vervaldatum verwacht, krijgt NaN, en concludeert "al verlopen, niets
     te onthouden" -- hij geeft netjes true terug en doet niets. Stil falen, en
     precies bij het soort token dat je eenmalig wilt kunnen maken.

     Nodig geworden bij de SSO-overdracht: die geeft de bezoeker een bewijs van
     zestig seconden mee dat hij bij ons inruilt voor een echt sessietoken.
     Zonder intrekken zou dat bewijs die hele minuut opnieuw te gebruiken zijn --
     en het staat in een URL, dus het staat ook in de browsergeschiedenis. */
  function trekInActie(token, doel) {
    token = strikt(token);
    if (!token) return false;
    let exp = 0;
    try {
      const body = Buffer.from(String(token).split('.')[0], 'base64url').toString();
      const delen = body.split('.');
      if (doel !== undefined && delen[1] !== String(doel)) return false; // ander doel: niet aan zitten
      exp = Number(delen[2]) || 0;
    } catch (e) { return false; }
    if (!exp || exp < Date.now()) return true; // al verlopen: niets te onthouden
    try {
      S.zin('DELETE FROM ingetrokken_tokens WHERE verloopt < ?').run(Date.now());
      S.zin('INSERT OR REPLACE INTO ingetrokken_tokens (hash, verloopt) VALUES (?, ?)')
        .run(kluis.sign(String(token)), exp);
      return true;
    } catch (e) { return false; }
  }
  function isIngetrokken(token) {
    token = strikt(token);
    if (!token) return true; // geen geldige vorm: behandel als ongeldig
    try {
      const r = S.zin('SELECT verloopt FROM ingetrokken_tokens WHERE hash = ?')
        .get(kluis.sign(String(token)));
      return !!r && Number(r.verloopt) >= Date.now();
    } catch (e) { return false; }
  }

  function verifyToken(token) {
    token = strikt(token);
    if (!token) return null;
    try {
      const [b64, sig] = String(token).split('.');
      if (!b64 || !sig) return null;
      const body = Buffer.from(b64, 'base64url').toString();
      if (kluis.sign(body) !== sig) return null;
      const [id, exp] = body.split('.');
      if (Number(exp) < Date.now()) return null;
      if (isIngetrokken(token)) return null; // uitgelogd: de handtekening klopt, wij niet meer
      const u = getUserById(Number(id));
      /* De ene plek waar een uitgezet account eruit valt. Zie de toelichting bij
         de kolom in accounts/index.js: staatloze tokens zijn niet allemaal
         terug te halen, een vlag op het account wel. */
      if (u && u.actief === 0) return null;
      return u;
    } catch (e) { return null; }
  }
  /* Doel-gebonden token (bijv. e-mailbevestiging), los van de sessie. */
  function issueActionToken(userId, purpose, ttlMs) {
    const body = userId + '.' + purpose + '.' + (Date.now() + ttlMs);
    return Buffer.from(body).toString('base64url') + '.' + kluis.sign(body);
  }
  function verifyActionToken(token, purpose) {
    token = strikt(token);   // zelfde strikte vorm als een sessietoken
    if (!token) return null;
    try {
      const [b64, sig] = String(token).split('.');
      if (!b64 || !sig || kluis.sign(Buffer.from(b64, 'base64url').toString()) !== sig) return null;
      const [id, p, exp] = Buffer.from(b64, 'base64url').toString().split('.');
      if (p !== purpose || Number(exp) < Date.now()) return null;
      /* Zonder deze regel is trekInActie een gebaar: het token staat dan wel op
         de lijst, maar niemand kijkt ernaar. Dat was hierboven bij het uitloggen
         precies het gat (aanvalsronde 2, punt 14) -- niet nog een keer. */
      if (isIngetrokken(token)) return null;
      return getUserById(Number(id));
    } catch (e) { return null; }
  }

  /* ---------- e-mailbevestiging & wachtwoord-herstel ---------- */
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
  async function setPassword(userId, password) {
    S.zin('UPDATE users SET password_hash = ?, reset_hash = NULL, reset_expires = NULL WHERE id = ?')
      .run(await kluis.hashPassword(password), userId);
    mirror.markUser(userId);
    return getUserById(userId);
  }

  return { issueToken, verifyToken, trekIn, trekInActie, isIngetrokken, issueActionToken, verifyActionToken,
    setEmailVerified, createReset, findByReset, setPassword };
}

module.exports = { maakTokens };
