/* WebAuthn, deel "stap op": een HANDELING bevestigen met een passkey die al aan
   dit account hangt.

   Afgesplitst uit ./webauthn.js toen dat door de 10 KB van keuringsregel 13
   ging. De naad zit hier goed: registreren en inloggen gaan over WIE iemand is,
   dit gaat over of iemand DIT wil. Dat verschil zit in een veld -- de ceremonie
   draagt een DOEL -- en dat veld is precies wat dit deel bewaakt.

   ZONDER DIE BINDING BEWIJST DE BIOMETRIE NIETS OVER DE HANDELING. Een assertie
   die bij de ene bevestiging hoort zou dan op een andere te hergebruiken zijn,
   en dan toont een vinger op een toestel alleen aan dat er ooit een vinger op
   een toestel lag -- niet dat iemand akkoord ging met wat er nu gebeurt.

   Er zit een tweede binding naast: de ceremonie is van DIT account. Die vangt
   het geval dat iemand anders, zelf ingelogd en met zijn eigen sleutel, de
   ceremonie van een ander probeert af te maken.

   De gedeelde helpers (de credentials van een account, de ceremonie-opslag)
   komen via het context-object binnen, zodat er maar een lijst met passkeys en
   een challenge-opslag bestaat. */

'use strict';
const klok = require('../lib/klok');

const crypto = require('crypto');

module.exports = (ctx) => {
  const { credsVan, zetChallenge, pakChallenge, vanB64, save,
    generateAuthenticationOptions, verifyAuthenticationResponse } = ctx;

  /* ---- stap op: een HANDELING bevestigen met een passkey die al aan dit
     account hangt.

     Inloggen bewijst wie u bent; dit bewijst dat u DIT wilt. Het verschil zit
     in een veld: de ceremonie draagt een DOEL en de verificatie eist dat het
     doel klopt. Zonder die binding zou een assertie die bij de ene handeling
     hoort op een andere te hergebruiken zijn -- en dan bewijst de biometrie
     alleen nog dat er ooit een vinger op een toestel lag, niet dat iemand
     akkoord ging met wat er nu gebeurt.

     Er is geen anti-enumeratie-vulling zoals bij loginOpties: hier is de
     aanvrager al ingelogd, dus zijn eigen sleutel-ids zijn geen geheim voor
     hem. Wat er WEL is: geen passkey levert een eigen antwoord, want de
     aanroeper moet het verschil kunnen zien tussen "dit ging mis" en "u heeft
     er nog geen, maak er een". */
  async function stapOpOpties(user, hostnaam, doel) {
    /* EEN LEEG DOEL IS GEEN DOEL, en dat was hier een echte rand. `doel` gaat
       hieronder door `String(doel || '')` en wordt bij het verifieren met
       diezelfde uitdrukking vergeleken -- dus twee aanroepers die allebei
       vergeten een doel mee te geven, krijgen ELKAARS ceremonie. De hele waarde
       van deze weg zit in die binding: zonder doel bewijst een vinger op een
       toestel alleen dat er ooit een vinger op een toestel lag.

       Er is geen aanroeper die een leeg doel nodig heeft, dus dit breekt niets
       -- maar er WAS er een die er per ongeluk een kon produceren
       (routes/rtgid.js met een verzoek zonder koppelId). Die krijgt nu een
       weigering in plaats van een ceremonie die overal op past. */
    const merk = String(doel == null ? '' : doel);
    if (!merk) return { status: 400,
      error: 'Deze bevestiging heeft geen doel; een passkey bevestigt altijd een concrete handeling.' };
    const creds = credsVan(user.id);
    if (!creds.length) return { status: 409, geenPasskey: true,
      error: 'Voor deze bevestiging is een passkey nodig en aan dit account hangt er nog geen.' };
    const opties = await generateAuthenticationOptions({
      rpID: hostnaam, userVerification: 'required',
      allowCredentials: creds.map(c => ({ id: c.id, transports: c.transports }))
    });
    const ceremonie = crypto.randomBytes(24).toString('base64url');
    zetChallenge('stapop:' + ceremonie, opties.challenge, { userId: String(user.id), doel: merk });
    return { status: 200, opties, ceremonie };
  }
  async function stapOpMaak(user, ceremonie, antwoord, origin, hostnaam, doel) {
    const id = String(ceremonie || '');
    const aanvraag = /^[A-Za-z0-9_-]{32}$/.test(id) ? pakChallenge('stapop:' + id) : null;
    if (!aanvraag) return { status: 401, error: 'De bevestiging is verlopen; probeer het opnieuw.' };
    /* Twee bindingen, en ze vangen verschillende dingen. De eerste: deze
       ceremonie is van dit account, dus een assertie van A bevestigt niets van
       B. De tweede: deze ceremonie hoort bij deze handeling. */
    if (aanvraag.userId !== String(user.id)) return { status: 401, error: 'Deze bevestiging hoort bij een ander account.' };
    if (aanvraag.doel !== String(doel || '')) return { status: 401, error: 'Deze bevestiging hoort bij een andere handeling.' };
    const cred = credsVan(user.id).find(c => c.id === (antwoord && antwoord.id));
    if (!cred) return { status: 401, error: 'Onbekende passkey voor dit account.' };
    let uit;
    try {
      uit = await verifyAuthenticationResponse({ response: antwoord, expectedChallenge: aanvraag.challenge,
        expectedOrigin: origin, expectedRPID: hostnaam,
        credential: { id: cred.id, publicKey: vanB64(cred.publicKey), counter: cred.counter || 0, transports: cred.transports },
        requireUserVerification: true });
    } catch (e) { return { status: 401, error: 'De passkey kon niet worden geverifieerd.' }; }
    if (!uit.verified) return { status: 401, error: 'De passkey kon niet worden geverifieerd.' };
    cred.counter = uit.authenticationInfo.newCounter;
    cred.laatstGebruikt = klok.datum().toISOString();
    save();
    /* WELKE sleutel tekende, gaat mee terug. Niet omdat deze module er iets mee
       doet, maar omdat een spoor dat alleen "er is bevestigd" zegt, na een
       incident niet te lezen is: met twee passkeys op een account is de vraag
       altijd welke. De bestaande aanroeper (kern/rtgid-bevestigen.js) leest
       alleen `.error` en spreidt dit antwoord niet uit, dus het veld erbij
       verandert daar niets. */
    return { status: 200, ok: true, credentialId: cred.id };
  }

  return { stapOpOpties, stapOpMaak };
};
