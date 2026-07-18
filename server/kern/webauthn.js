/* Kern-module "webauthn": passkeys. Leden loggen in met vingerafdruk, gezicht
   of hardwaresleutel in plaats van een wachtwoord: phishingbestendig, en er
   valt serverzijdig niets te stelen (wij bewaren alleen PUBLIEKE sleutels).

   Bewust op @simplewebauthn/server gebouwd: de cryptografische kant van
   WebAuthn (CBOR/COSE, attestatie- en handtekeningverificatie) hoort niet
   zelfgeschreven te zijn. Challenges leven kort en alleen in RAM; de
   credentials (publieke sleutel + teller) staan per account in de database,
   zonder enige echte naam erbij.

   maakWebauthn(state) volgt het vaste kern-patroon. */

const { generateRegistrationOptions, verifyRegistrationResponse,
  generateAuthenticationOptions, verifyAuthenticationResponse } = require('@simplewebauthn/server');

const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const SLEUTELS_MAX = 8;                 // passkeys per account
const RP_NAAM = 'Rahul Travel Group';

function maakWebauthn({ db, save, accounts, schoon }) {
  const challenges = new Map();         // sleutel -> { challenge, tot }
  const b64 = buf => Buffer.from(buf).toString('base64url');
  const vanB64 = s => new Uint8Array(Buffer.from(String(s), 'base64url'));

  function lijsten() {
    if (!db.data.webauthn) db.data.webauthn = {};   // userId -> [credentials]
    return db.data.webauthn;
  }
  const credsVan = userId => lijsten()[userId] || [];
  function zetChallenge(sleutel, challenge) {
    challenges.set(sleutel, { challenge, tot: Date.now() + CHALLENGE_TTL_MS });
    if (challenges.size > 5000) for (const [k, v] of challenges) if (v.tot < Date.now()) challenges.delete(k);
  }
  function pakChallenge(sleutel) {
    const c = challenges.get(sleutel); challenges.delete(sleutel);
    return c && c.tot > Date.now() ? c.challenge : null;
  }

  /* ---- registreren: een nieuwe passkey aan het eigen account hangen ---- */
  async function regOpties(user, hostnaam) {
    const opties = await generateRegistrationOptions({
      rpName: RP_NAAM, rpID: hostnaam,
      userID: new TextEncoder().encode('rtg-' + user.id),
      userName: user.codename || ('lid-' + user.id),       // nooit de echte naam in de authenticator
      attestationType: 'none',
      excludeCredentials: credsVan(user.id).map(c => ({ id: c.id, transports: c.transports })),
      authenticatorSelection: { residentKey: 'preferred', userVerification: 'preferred' }
    });
    zetChallenge('reg:' + user.id, opties.challenge);
    return { status: 200, opties };
  }
  async function regMaak(user, antwoord, naam, origin, hostnaam) {
    const challenge = pakChallenge('reg:' + user.id);
    if (!challenge) return { status: 400, error: 'De aanvraag is verlopen; probeer het opnieuw.' };
    if (credsVan(user.id).length >= SLEUTELS_MAX) return { status: 409, error: 'Tot ' + SLEUTELS_MAX + ' passkeys per account.' };
    let uit;
    try {
      uit = await verifyRegistrationResponse({ response: antwoord, expectedChallenge: challenge,
        expectedOrigin: origin, expectedRPID: hostnaam });
    } catch (e) { return { status: 400, error: 'Geen geldige passkey: ' + e.message }; }
    if (!uit.verified) return { status: 400, error: 'De passkey kon niet worden geverifieerd.' };
    const c = uit.registrationInfo.credential;
    const rij = lijsten()[user.id] = lijsten()[user.id] || [];
    if (rij.some(x => x.id === c.id)) return { status: 409, error: 'Deze passkey staat er al.' };
    rij.push({ id: c.id, publicKey: b64(c.publicKey), counter: c.counter || 0,
      transports: c.transports || [], apparaat: uit.registrationInfo.credentialDeviceType,
      naam: schoon(naam, 40) || 'Passkey', at: new Date().toISOString() });
    save();
    return { status: 200, ok: true, sleutels: publiekeLijst(user) };
  }

  /* ---- inloggen met een passkey ---- */
  async function loginOpties(login, hostnaam) {
    const user = accounts.findByLogin(String(login || ''));
    const creds = user ? credsVan(user.id) : [];
    // anti-enumeratie: onbekende logins krijgen hetzelfde soort antwoord
    const opties = await generateAuthenticationOptions({
      rpID: hostnaam, userVerification: 'preferred',
      allowCredentials: creds.map(c => ({ id: c.id, transports: c.transports }))
    });
    zetChallenge('login:' + String(login || '').toLowerCase(), opties.challenge);
    return { status: 200, opties };
  }
  async function loginMaak(login, antwoord, origin, hostnaam) {
    const challenge = pakChallenge('login:' + String(login || '').toLowerCase());
    if (!challenge) return { status: 400, error: 'De aanvraag is verlopen; probeer het opnieuw.' };
    const user = accounts.findByLogin(String(login || ''));
    const cred = user ? credsVan(user.id).find(c => c.id === (antwoord && antwoord.id)) : null;
    if (!cred) return { status: 401, error: 'Onbekende passkey voor dit account.' };
    let uit;
    try {
      uit = await verifyAuthenticationResponse({ response: antwoord, expectedChallenge: challenge,
        expectedOrigin: origin, expectedRPID: hostnaam,
        credential: { id: cred.id, publicKey: vanB64(cred.publicKey), counter: cred.counter || 0, transports: cred.transports } });
    } catch (e) { return { status: 401, error: 'De passkey kon niet worden geverifieerd.' }; }
    if (!uit.verified) return { status: 401, error: 'De passkey kon niet worden geverifieerd.' };
    cred.counter = uit.authenticationInfo.newCounter;
    cred.laatstGebruikt = new Date().toISOString();
    save();
    return { status: 200, ok: true, user };
  }

  /* ---- beheer ---- */
  function publiekeLijst(user) {
    return credsVan(user.id).map(c => ({ id: c.id, naam: c.naam, apparaat: c.apparaat || null,
      at: c.at, laatstGebruikt: c.laatstGebruikt || null }));
  }
  function weg(user, id) {
    const rij = credsVan(user.id);
    if (!rij.some(c => c.id === id)) return { status: 404, error: 'Passkey niet gevonden.' };
    lijsten()[user.id] = rij.filter(c => c.id !== id);
    save();
    return { status: 200, ok: true, sleutels: publiekeLijst(user) };
  }

  return { webauthnRegOpties: regOpties, webauthnRegMaak: regMaak, webauthnLoginOpties: loginOpties,
    webauthnLoginMaak: loginMaak, webauthnLijst: user => ({ status: 200, sleutels: publiekeLijst(user) }),
    webauthnWeg: weg };
}

module.exports = { maakWebauthn };
