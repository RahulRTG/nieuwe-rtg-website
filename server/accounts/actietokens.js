/* Accounts, deel "actietokens": de DOEL-GEBONDEN tokens (2FA-bewijs 'inlog2',
   e-mailbevestiging 'verify-email', 'mailwissel', 'sso-overdracht'). Afgesplitst
   uit ./tokens.js -- niet alleen voor de modulegrootte, maar omdat een actietoken
   een andere KLASSE is dan een sessietoken en dat verschil nu ook in de
   bestandsindeling staat (RTG-V1-RELEASE blocker 1).

   DOMEINSCHEIDING: een actietoken tekent met een per-DOEL afgeleide sleutel
   (kluis.sleutelVoor('actie:'+purpose)), niet met de sessiesleutel
   (kluis.sign = S.SECRET). Zo accepteert de sessieverifier (./tokens.js
   verifyToken, op S.SECRET) een actietoken nooit, en verifyActionToken voor doel
   A nooit een token voor doel B. De factory krijgt van ./tokens de gedeelde
   onderdelen (getUserById, de strikte tokenvorm, de intrekkingslijst), zodat er
   maar EEN opvatting bestaat van wat een token is en wanneer het is ingetrokken. */
'use strict';
const crypto = require('crypto');
const kluis = require('./kluis');
const { veiligGelijk } = require('../kern/util');

function maakActieTokens({ getUserById, strikt, isIngetrokken }) {
  function actieSleutel(purpose) { return kluis.sleutelVoor('actie:' + String(purpose || '')); }

  function issueActionToken(userId, purpose, ttlMs) {
    /* De nonce maakt twee uitgiftes in dezelfde ms afzonderlijk intrekbaar. */
    const body = userId + '.' + purpose + '.' + (Date.now() + ttlMs) + '.' +
      crypto.randomBytes(16).toString('base64url');
    const sig = kluis.signMet(actieSleutel(purpose), body);
    if (!sig) throw new Error('issueActionToken: geen afgeleide sleutel');
    return Buffer.from(body).toString('base64url') + '.' + sig;
  }

  function verifyActionToken(token, purpose) {
    token = strikt(token);   // zelfde strikte vorm als een sessietoken
    if (!token) return null;
    try {
      const [b64, sig] = String(token).split('.');
      if (!b64 || !sig) return null;
      const body = Buffer.from(b64, 'base64url').toString();
      // controleer met de per-doel sleutel: een sessie- of ander-doel-token valt af
      const verwacht = kluis.signMet(actieSleutel(purpose), body);
      if (!verwacht || !veiligGelijk(verwacht, sig)) return null;
      const [id, p, exp] = body.split('.');
      if (p !== purpose || !Number.isFinite(Number(exp)) || Number(exp) < Date.now()) return null;
      /* trekInActie is anders een gebaar: het token staat dan wel op de lijst,
         maar niemand kijkt ernaar (aanvalsronde 2, punt 14). */
      if (isIngetrokken(token)) return null;
      return getUserById(Number(id));
    } catch (e) { return null; }
  }

  return { issueActionToken, verifyActionToken };
}

module.exports = { maakActieTokens };
