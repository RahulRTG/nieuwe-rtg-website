/* WEBAUTHN: REGISTREREN -- een nieuwe passkey aan het eigen account hangen.

   Afgesplitst van ./webauthn.js (dat ging over de 10 KB toen de doelbinding van
   P1-2 erbij kwam). Inloggen en de stap-op-ceremonie blijven daar; dit bestand
   kent alleen de twee stappen van een registratie. */
'use strict';

module.exports = ({ generateRegistrationOptions, verifyRegistrationResponse, credsVan, zetChallenge, pakChallenge,
  lijsten, index, b64, save, schoon, SLEUTELS_MAX, RP_NAAM, publiekeLijst }) => {
  /* ---- registreren: een nieuwe passkey aan het eigen account hangen ----

     HET DOEL IS VERPLICHT (P1-2). Een passkey is een blijvende sleutel tot het
     account; de route die hem uitgeeft moet eerst hebben vastgesteld dat de
     mens er is (wachtwoord of een verse vinger, kern/identiteit/
     herbevestiging.js), of dat het herstelvenster van de eigenaar openstaat.
     Dat oordeel valt in de route en niet hier -- maar hier wordt het
     VASTGELEGD: de uitdaging draagt het doel waarvoor zij is uitgegeven, en
     regMaak neemt alleen een antwoord aan op een uitdaging met HETZELFDE doel.
     Zo kan een andere sessie, of een aanroeper die de bevestiging oversloeg,
     de registratie niet afmaken op een uitdaging die iemand anders verdiende.
     Zonder doel geen uitdaging: een nieuwe aanroeper die het vergeet, valt om
     in plaats van stil door te laten. */
  const geldigDoel = d => typeof d === 'string' && d.length >= 8 && d.length <= 120;
  async function regOpties(user, hostnaam, doel) {
    if (!geldigDoel(doel)) return { status: 500, error: 'Deze registratie is niet goed ingericht. Meld het bij RTG.' };
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
    zetChallenge('reg:' + user.id, opties.challenge, { doel });
    return { status: 200, opties };
  }
  async function regMaak(user, antwoord, naam, origin, hostnaam, doel) {
    const aanvraag = pakChallenge('reg:' + user.id);
    const challenge = aanvraag && aanvraag.challenge;
    if (!challenge) return { status: 400, error: 'De aanvraag is verlopen; probeer het opnieuw.' };
    if (!geldigDoel(doel) || aanvraag.doel !== doel)
      return { status: 403, error: 'Deze registratie hoort bij een andere bevestiging. Begin opnieuw.' };
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


  return { regOpties, regMaak };
};
