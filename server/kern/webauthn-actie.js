/* WebAuthn: opnieuw bewijzen voor een gevoelige, benoemde handeling.

   Een geldige sessie is niet genoeg om een noodslot op te heffen of een
   duurzaam gedeeld adres te vernieuwen: een gestolen open browser zou dat
   anders zonder de eigenaar kunnen doen. Deze ceremonie bindt de passkey aan
   een vaste actienaam plus serverbinding. Er komt geen algemeen "recent 2FA"
   vinkje uit dat later voor iets anders kan worden hergebruikt; iedere actie
   krijgt zijn eigen challenge en is eenmalig. Accounts die nog geen passkey
   hebben blijven tijdens de migratie werken, maar het antwoord zegt dat
   expliciet (`nodig:false`) zodat het veiligheidsscherm hen kan laten
   upgraden. */
'use strict';
const klok = require('../lib/klok');

module.exports = (ctx) => {
  const { crypto, generateAuthenticationOptions, verifyAuthenticationResponse,
    credsVan, zetChallenge, pakChallenge, vanB64, save } = ctx;
  const ACTIES = new Set(['rtg-pin-vernieuw', 'rtg-pin-noodslot-uit', 'rtg-pin-vast-aan']);
  const actieSchoon = actie => ACTIES.has(String(actie || '')) ? String(actie) : null;
  const bindingSchoon = binding => String(binding || '').slice(0, 120);
  function nodig(user) { return !!(user && credsVan(user.id).length); }

  async function opties(user, actie, binding, hostnaam) {
    const a = actieSchoon(actie), b = bindingSchoon(binding);
    if (!user || !a || !b) return { status: 400, error: 'Ongeldige beveiligingshandeling.' };
    const creds = credsVan(user.id);
    if (!creds.length) return { status: 200, nodig: false, advies: 'Voeg een passkey toe voor extra bevestiging van gevoelige handelingen.' };
    const webOpties = await generateAuthenticationOptions({ rpID: hostnaam, userVerification: 'required',
      allowCredentials: creds.map(c => ({ id: c.id, transports: c.transports || [] })) });
    const ceremonie = crypto.randomBytes(24).toString('base64url');
    zetChallenge('actie:' + user.id + ':' + ceremonie, webOpties.challenge, { actie: a, binding: b });
    return { status: 200, nodig: true, opties: webOpties, ceremonie };
  }

  async function maak(user, actie, binding, ceremonie, antwoord, origin, hostnaam) {
    const a = actieSchoon(actie), b = bindingSchoon(binding);
    if (!user || !a || !b) return { status: 400, error: 'Ongeldige beveiligingshandeling.' };
    if (!nodig(user)) return { status: 200, ok: true, nodig: false };
    const id = String(ceremonie || '');
    const aanvraag = /^[A-Za-z0-9_-]{32}$/.test(id) ? pakChallenge('actie:' + user.id + ':' + id) : null;
    if (!aanvraag || aanvraag.actie !== a || aanvraag.binding !== b)
      return { status: 400, error: 'De beveiligingsbevestiging is verlopen; probeer opnieuw.' };
    const cred = credsVan(user.id).find(c => c.id === (antwoord && antwoord.id));
    if (!cred) return { status: 401, error: 'Onbekende passkey voor dit account.' };
    let uit;
    try {
      uit = await verifyAuthenticationResponse({ response: antwoord, expectedChallenge: aanvraag.challenge,
        expectedOrigin: origin, expectedRPID: hostnaam,
        credential: { id: cred.id, publicKey: vanB64(cred.publicKey), counter: cred.counter || 0, transports: cred.transports },
        requireUserVerification: true });
    } catch (e) { return { status: 401, error: 'De passkey kon deze handeling niet bevestigen.' }; }
    if (!uit.verified) return { status: 401, error: 'De passkey kon deze handeling niet bevestigen.' };
    cred.counter = uit.authenticationInfo.newCounter;
    cred.laatstGebruikt = klok.datum().toISOString();
    save();
    return { status: 200, ok: true, nodig: true };
  }

  return { webauthnActieNodig: nodig, webauthnActieOpties: opties,
    webauthnActieMaak: maak };
};
