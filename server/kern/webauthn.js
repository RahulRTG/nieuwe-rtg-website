/* Kern-module "webauthn": passkeys. Leden loggen in met vingerafdruk, gezicht
   of hardwaresleutel in plaats van een wachtwoord: phishingbestendig, en er
   valt serverzijdig niets te stelen (wij bewaren alleen PUBLIEKE sleutels).

   Draait op de eigen WebAuthn-laag (server/webauthn.js): geen eigen crypto, maar
   de bekende protocolstappen op Node's crypto (SHA-256 + ECDSA/RSA/Ed25519-
   verificatie) plus een kleine CBOR-lezer. Zo verdwijnt @simplewebauthn/server
   als dependency zonder dat er ook maar iets aan crypto zelf geschreven is.
   Challenges leven kort en alleen in RAM; de credentials (publieke sleutel +
   teller) staan per account in de database, zonder enige echte naam erbij.

   maakWebauthn(state) volgt het vaste kern-patroon. */

const { generateRegistrationOptions, verifyRegistrationResponse,
  generateAuthenticationOptions, verifyAuthenticationResponse } = require('../webauthn');
const crypto = require('crypto');

const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const CHALLENGE_MAX = 5000;
const SLEUTELS_MAX = 8;                 // passkeys per account
const RP_NAAM = 'Rahul Travel Group';

/* Eenmalige ceremonies zijn expres vluchtig, maar ook vluchtig geheugen moet
   begrensd zijn. De oude Map ruimde pas boven 5000 op en verwijderde dan alleen
   verlopen regels. Vijfduizend verse aanvragen bleven dus onbeperkt doorgroeien
   en iedere volgende aanvraag liep de hele Map langs: een goedkope geheugen- en
   CPU-aanval. Deze opslag houdt afloopvolgorde, ruimt O(1) aan de voorkant en
   werpt bij drukte de oudste ongebruikte ceremonie af. */
function maakCeremonieOpslag({ max = CHALLENGE_MAX, ttlMs = CHALLENGE_TTL_MS, nu = () => Date.now() } = {}) {
  const waarden = new Map();
  const grens = Math.min(CHALLENGE_MAX, Math.max(1, Math.floor(Number(max) || CHALLENGE_MAX)));
  const eersteWeg = () => {
    const eerste = waarden.keys().next();
    if (!eerste.done) waarden.delete(eerste.value);
  };
  function ruimVerlopen(tijd) {
    for (const [sleutel, waarde] of waarden) {
      if (waarde.tot > tijd) break;
      waarden.delete(sleutel);
    }
  }
  function zet(sleutel, challenge, extra) {
    const tijd = nu();
    ruimVerlopen(tijd);
    // opnieuw uitgeven voor dezelfde sleutel hoort achteraan in de aflooprij
    waarden.delete(sleutel);
    while (waarden.size >= grens) eersteWeg();
    waarden.set(sleutel, { ...(extra || {}), challenge, tot: tijd + ttlMs });
  }
  function pak(sleutel) {
    const tijd = nu();
    ruimVerlopen(tijd);
    const waarde = waarden.get(sleutel);
    waarden.delete(sleutel);             // ook een foute/late poging is eenmalig
    return waarde && waarde.tot > tijd ? waarde : null;
  }
  return { zet, pak, aantal: () => waarden.size };
}

function maakWebauthn({ db, save, accounts, schoon }) {
  const ceremonies = maakCeremonieOpslag();
  let credentialIndex = null;            // credential-id -> userId
  const b64 = buf => Buffer.from(buf).toString('base64url');
  const vanB64 = s => new Uint8Array(Buffer.from(String(s), 'base64url'));

  function lijsten() {
    if (!db.data.webauthn) db.data.webauthn = {};   // userId -> [credentials]
    return db.data.webauthn;
  }
  const credsVan = userId => lijsten()[userId] || [];
  function index() {
    if (credentialIndex) return credentialIndex;
    credentialIndex = new Map();
    for (const [userId, rij] of Object.entries(lijsten()))
      for (const cred of (rij || [])) if (cred && cred.id) credentialIndex.set(cred.id, userId);
    return credentialIndex;
  }
  function zetChallenge(sleutel, challenge, extra) {
    ceremonies.zet(sleutel, challenge, extra);
  }
  function pakChallenge(sleutel) {
    return ceremonies.pak(sleutel);
  }

  /* ---- registreren: een nieuwe passkey aan het eigen account hangen ---- */
  async function regOpties(user, hostnaam) {
    const opties = await generateRegistrationOptions({
      rpName: RP_NAAM, rpID: hostnaam,
      userID: new TextEncoder().encode('rtg-' + user.id),
      userName: user.codename || ('lid-' + user.id),       // nooit de echte naam in de authenticator
      attestationType: 'none',
      excludeCredentials: credsVan(user.id).map(c => ({ id: c.id, transports: c.transports })),
      // `required` maakt dit een vindbare passkey. Daardoor kan het toestel
      // het account aanwijzen en hoeft RTG niet eerst om een e-mailadres te
      // vragen. Biometrie blijft volledig op het toestel.
      authenticatorSelection: { residentKey: 'required', userVerification: 'required' }
    });
    zetChallenge('reg:' + user.id, opties.challenge);
    return { status: 200, opties };
  }
  async function regMaak(user, antwoord, naam, origin, hostnaam) {
    const aanvraag = pakChallenge('reg:' + user.id);
    const challenge = aanvraag && aanvraag.challenge;
    if (!challenge) return { status: 400, error: 'De aanvraag is verlopen; probeer het opnieuw.' };
    if (credsVan(user.id).length >= SLEUTELS_MAX) return { status: 409, error: 'Tot ' + SLEUTELS_MAX + ' passkeys per account.' };
    let uit;
    try {
      uit = await verifyRegistrationResponse({ response: antwoord, expectedChallenge: challenge,
        expectedOrigin: origin, expectedRPID: hostnaam, requireUserVerification: true });
    } catch (e) { return { status: 400, error: 'Geen geldige passkey: ' + e.message }; }
    if (!uit.verified) return { status: 400, error: 'De passkey kon niet worden geverifieerd.' };
    const c = uit.registrationInfo.credential;
    const rij = lijsten()[user.id] = lijsten()[user.id] || [];
    if (index().has(c.id)) return { status: 409, error: 'Deze passkey staat er al.' };
    rij.push({ id: c.id, publicKey: b64(c.publicKey), counter: c.counter || 0,
      transports: c.transports || [], apparaat: uit.registrationInfo.credentialDeviceType,
      naam: schoon(naam, 40) || 'Passkey', at: new Date().toISOString() });
    index().set(c.id, String(user.id));
    save();
    return { status: 200, ok: true, sleutels: publiekeLijst(user) };
  }

  /* ---- inloggen met een passkey ---- */
  const loginNaam = login => String(login || '').trim().toLowerCase();
  function vindCredential(id) {
    const userId = index().get(id);
    const cred = userId == null ? null : credsVan(userId).find(c => c.id === id);
    if (cred) return { user: accounts.getUserById(userId), cred };
    return { user: null, cred: null };
  }
  async function loginOpties(login, hostnaam) {
    const naam = loginNaam(login);
    const user = naam ? accounts.findByLogin(naam) : null;
    const creds = user ? credsVan(user.id) : [];
    // Zonder login blijft allowCredentials leeg: de authenticator kiest dan
    // zelf een vindbare sleutel voor dit domein. Met een login blijft de oude
    // gerichte route beschikbaar voor bestaande, niet-vindbare passkeys.
    let toegestaan = creds.map(c => ({ id: c.id }));
    // De oude, gerichte route geeft altijd exact acht ids terug. Zo verraadt
    // een antwoord niet of het genoemde account bestaat of hoeveel sleutels
    // eraan hangen; alleen de authenticator weet welke id echt van hem is.
    if (naam) while (toegestaan.length < SLEUTELS_MAX)
      toegestaan.push({ id: crypto.randomBytes(32).toString('base64url') });
    const opties = await generateAuthenticationOptions({
      rpID: hostnaam, userVerification: 'required',
      allowCredentials: toegestaan
    });
    const ceremonie = crypto.randomBytes(24).toString('base64url');
    zetChallenge('login:' + ceremonie, opties.challenge, { login: naam });
    return { status: 200, opties, ceremonie };
  }
  async function loginMaak(login, ceremonie, antwoord, origin, hostnaam) {
    const id = String(ceremonie || '');
    const aanvraag = /^[A-Za-z0-9_-]{32}$/.test(id) ? pakChallenge('login:' + id) : null;
    const naam = loginNaam(login);
    if (!aanvraag || aanvraag.login !== naam) return { status: 400, error: 'De aanvraag is verlopen; probeer het opnieuw.' };
    const challenge = aanvraag.challenge;
    const gevonden = naam
      ? { user: accounts.findByLogin(naam), cred: null }
      : vindCredential(antwoord && antwoord.id);
    const user = gevonden.user;
    const cred = naam ? (user ? credsVan(user.id).find(c => c.id === (antwoord && antwoord.id)) : null) : gevonden.cred;
    if (!cred) return { status: 401, error: 'Onbekende passkey voor dit account.' };
    let uit;
    try {
      uit = await verifyAuthenticationResponse({ response: antwoord, expectedChallenge: challenge,
        expectedOrigin: origin, expectedRPID: hostnaam,
        credential: { id: cred.id, publicKey: vanB64(cred.publicKey), counter: cred.counter || 0, transports: cred.transports },
        requireUserVerification: true });
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
    index().delete(id);
    save();
    return { status: 200, ok: true, sleutels: publiekeLijst(user) };
  }

  return { webauthnRegOpties: regOpties, webauthnRegMaak: regMaak, webauthnLoginOpties: loginOpties,
    webauthnLoginMaak: loginMaak, webauthnLijst: user => ({ status: 200, sleutels: publiekeLijst(user) }),
    webauthnWeg: weg };
}

module.exports = { maakWebauthn, maakCeremonieOpslag };
