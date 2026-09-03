/* DE PASSKEY-CEREMONIE IN DE BROWSER -- de binaire vertaling op een plek.

   WebAuthn praat in ArrayBuffers en de server in base64url-tekst. Die vertaling
   is klein, saai en makkelijk half fout: vergeet je `allowCredentials` om te
   zetten, dan werkt het op de ene browser en niet op de andere, en dat merk je
   pas bij een mens die zijn beveiliging niet meer uit krijgt.

   WAAROM DIT BESTAND ER IS. De vertaling stond in apps/rtgid.html, in
   apps/passkeys.html en in app-main -- drie kopieen. Een vierde erbij zetten voor
   de ontsluitceremonie zou LAT.md regel 4 nog een keer overtreden. Dit is de
   plek; nieuwe aanroepers gebruiken hem.

   WAT HIER NIET IN ZIT, met de reden: het REGISTREREN van een passkey. Dat is
   een andere ceremonie (navigator.credentials.create, een ander lijf, een andere
   route) en hij hoort bij het beheer van sleutels, niet bij het bevestigen van
   een handeling. Ze samen in een module zetten omdat ze allebei "passkey" heten,
   is precies de naamsbotsing die SEMANTIEK.json in dit huis 94 keer heeft
   gevonden.

   DE AANROEPER LEVERT DE ROUTES. Deze module weet niet welke ceremonie hij
   tekent -- dat is het punt: het DOEL zit in de ceremonie die de server uitgeeft,
   en een module die zelf een route kiest, kiest daarmee een doel. */
(function (global) {
  'use strict';

  var naarBuf = function (s) {
    return Uint8Array.from(atob(String(s).replace(/-/g, '+').replace(/_/g, '/')),
      function (c) { return c.charCodeAt(0); });
  };
  var naarB64 = function (buf) {
    var b = new Uint8Array(buf), t = '';
    for (var i = 0; i < b.length; i++) t += String.fromCharCode(b[i]);
    return btoa(t).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };

  /* De opties van de server bruikbaar maken voor de browser. */
  function leesOpties(opties) {
    var pub = Object.assign({}, opties);
    pub.challenge = naarBuf(pub.challenge);
    pub.allowCredentials = (pub.allowCredentials || []).map(function (c) {
      return Object.assign({}, c, { id: naarBuf(c.id) });
    });
    return pub;
  }

  /* Het antwoord van de browser bruikbaar maken voor de server. */
  function schrijfAntwoord(cred) {
    return {
      id: cred.id, rawId: naarB64(cred.rawId), type: cred.type,
      clientExtensionResults: cred.getClientExtensionResults(),
      response: {
        authenticatorData: naarB64(cred.response.authenticatorData),
        clientDataJSON: naarB64(cred.response.clientDataJSON),
        signature: naarB64(cred.response.signature),
        userHandle: cred.response.userHandle ? naarB64(cred.response.userHandle) : null
      }
    };
  }

  /* EEN HANDELING BEVESTIGEN, in twee slagen.

     `vraagOpties` haalt de ceremonie op (de aanroeper weet welke route dat is),
     de browser tekent, en wat eruit komt gaat terug naar de aanroeper. Deze
     module STUURT het niet zelf in: wie tekent en wie inlevert horen twee
     stappen te zijn, zodat de aanroeper er nog iets tussen kan doen.

     Geeft altijd een object met OF `{ ceremonie, antwoord }` OF `{ fout }` --
     nooit een uitzondering, want een mens die zijn vinger weghaalt heeft niets
     fout gedaan en hoort geen foutscherm te zien. */
  function bevestig(vraagOpties) {
    if (!global.navigator || !('credentials' in global.navigator)) {
      return Promise.resolve({ fout: 'Deze browser kent geen passkeys.' });
    }
    return Promise.resolve(vraagOpties()).then(function (o) {
      if (!o || !o.opties) return { fout: (o && o.error) || 'De bevestiging kon niet worden gestart.',
        geenPasskey: !!(o && o.geenPasskey) };
      return global.navigator.credentials.get({ publicKey: leesOpties(o.opties) })
        .then(function (cred) { return { ceremonie: o.ceremonie, antwoord: schrijfAntwoord(cred) }; })
        .catch(function (e) { return { fout: 'Afgebroken: ' + (e && e.message ? e.message : 'onbekend') }; });
    });
  }

  global.RTGPasskey = { naarBuf: naarBuf, naarB64: naarB64,
    leesOpties: leesOpties, schrijfAntwoord: schrijfAntwoord, bevestig: bevestig };
})(typeof window !== 'undefined' ? window : this);
