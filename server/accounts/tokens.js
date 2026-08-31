/* Accounts, deel "tokens": de staatloze ondertekende sessie- en actie-tokens,
   de e-mailbevestiging en het wachtwoord-herstel. Afgesplitst uit ./users.js;
   dat deel geeft getUserById mee en exporteert deze functies gewoon door, dus
   aanroepers blijven require('./users') (of accounts.js) gebruiken. */
const crypto = require('crypto');
const S = require('./state');
const kluis = require('./kluis');
const { veiligGelijk } = require('../kern/util');
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
  /* Het token draagt nu ook WANNEER het is uitgegeven. Dat is de enige manier om
     bij een staatloos token later te kunnen zeggen "alles van voor dit moment
     telt niet meer" -- en dat is precies wat een wachtwoordwijziging hoort te
     doen. Een oud token zonder dat derde deel geldt als uitgegeven op moment 0
     en valt dus af zodra er ooit een grens is gezet; dat is de juiste kant om
     naar te falen. */
  /* HET VIERDE DEEL: een sessie-identiteit (sid).

     Tot hier had een lid-sessie geen identiteit. Een lid komt namelijk NIET
     door kern/sessies.js binnen maar via verifyToken, en resolveSession bouwt
     daar bij ELK verzoek een vers sessie-object uit (opzet/diensten2.js r125).
     Er werd dus nergens een sessie bewaard -- en daarmee was "toon mijn actieve
     sessies" niet een ontbrekend scherm maar een onbeantwoordbare vraag.

     De sid verandert daar het minimum aan: hij maakt de sessie AANWIJSBAAR,
     zodat context (toestel, authenticator, contextbinding) ernaast kan worden
     bewaard in plaats van in het token. Het token blijft staatloos en draagt
     geen persoonsgegeven; wat erbij hoort staat in het register.

     TERUGWAARTS VEILIG: een oud token heeft drie delen, dit er vier. body.split
     geeft de vierde eenvoudig niet terug bij oude tokens, en sessieVan() zegt
     dan null -- "deze sessie heeft geen identiteit", wat waar is. Geen migratie,
     geen uitlog. */
  function issueToken(userId, days = 30) {
    const sid = crypto.randomBytes(9).toString('base64url');
    const body = userId + '.' + (Date.now() + days * 86400000) + '.' + Date.now() + '.' + sid;
    return Buffer.from(body).toString('base64url') + '.' + kluis.sign(body);
  }

  /* De sid uit een token lezen. Doet NIET aan geldigheid: dat is verifyToken.
     Wie de context van een sessie ophaalt, hoort eerst te weten dat de sessie
     geldig is en pas daarna welke het is. Twee vragen, twee functies. */
  function sessieVan(token) {
    token = strikt(token);
    if (!token) return null;
    try {
      const b64 = String(token).split('.')[0];
      const sid = Buffer.from(b64, 'base64url').toString().split('.')[3];
      return sid && /^[A-Za-z0-9_-]{12}$/.test(sid) ? sid : null;
    } catch (e) { return null; }
  }
  /* De intreklijst (welke uitgegeven tokens niet meer gelden) staat in
     ./intreklijst.js: dat deel schrijft als enige naar de database, de rest van
     dit bestand is pure cryptografie. Hij krijgt de strikte vorm mee, zodat er
     maar EEN opvatting bestaat van wat een token is. */
  const { trekIn, trekInActie, isIngetrokken, trekInSessie, sessieIngetrokken } = require('./intreklijst')(strikt);

  function verifyToken(token) {
    token = strikt(token);
    if (!token) return null;
    try {
      const [b64, sig] = String(token).split('.');
      if (!b64 || !sig) return null;
      const body = Buffer.from(b64, 'base64url').toString();
      /* veiligGelijk en geen !==: een gewone stringvergelijking stopt bij het
         eerste verschillende teken, dus de tijd verraadt hoeveel er klopte.
         Die redenering stond al bij de clustersleutel in server.js -- en
         uitgerekend deze deur, waar elk verzoek langskomt, stond nog op de
         kale vergelijking. */
      if (!veiligGelijk(kluis.sign(body), sig)) return null;
      const [id, exp, uitgegeven, sid] = body.split('.');
      if (Number(exp) < Date.now()) return null;
      if (isIngetrokken(token)) return null; // uitgelogd: de handtekening klopt, wij niet meer
      /* En de sessie zelf. Dit is de tweede deur, en hij bestaat omdat de eerste
         het token nodig heeft -- dat heeft alleen de houder. Zonder deze regel
         is "sluit die andere sessie" een knop die niets doet. */
      if (sid && sessieIngetrokken(sid)) return null;
      const u = getUserById(Number(id));
      /* De grens per account: alles wat voor sessies_vanaf is uitgegeven, geldt
         niet meer. Een wachtwoordwijziging zet die grens (zie setPassword), en
         daarmee vliegt elke lopende sessie eruit -- ook de sessie van iemand die
         het wachtwoord kende en er niet meer bij hoort. Dat was de hele reden
         voor de wijziging. */
      if (u && Number(u.sessies_vanaf || 0) > Number(uitgegeven || 0)) return null;
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
      if (!b64 || !sig) return null;
      // zelfde reden als bij verifyToken: ook dit is een geheim
      if (!veiligGelijk(kluis.sign(Buffer.from(b64, 'base64url').toString()), sig)) return null;
      const [id, p, exp] = Buffer.from(b64, 'base64url').toString().split('.');
      if (p !== purpose || Number(exp) < Date.now()) return null;
      /* Zonder deze regel is trekInActie een gebaar: het token staat dan wel op
         de lijst, maar niemand kijkt ernaar. Dat was hierboven bij het uitloggen
         precies het gat (aanvalsronde 2, punt 14) -- niet nog een keer. */
      if (isIngetrokken(token)) return null;
      return getUserById(Number(id));
    } catch (e) { return null; }
  }

  /* E-mailbevestiging en wachtwoord-herstel staan in ./herstel.js. Een
     herstelcode is geen sessietoken: hij wordt gehasht bewaard in plaats van
     ondertekend, en hij geeft geen toegang maar het recht om een wachtwoord
     te zetten. Twee soorten geheim in een bestand is hoe je ze door elkaar
     gaat halen. Ze reizen hieronder wel gewoon mee naar buiten, zodat de
     aanroepers niets merken van de knip. */
  const herstel = require('./herstel').maakHerstel(getUserById);

  return { issueToken, verifyToken, sessieVan, trekIn, trekInActie, isIngetrokken, trekInSessie, issueActionToken, verifyActionToken,
    setEmailVerified: herstel.setEmailVerified, createReset: herstel.createReset,
    findByReset: herstel.findByReset, setPassword: herstel.setPassword };
}

module.exports = { maakTokens };
