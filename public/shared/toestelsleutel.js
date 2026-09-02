/* ============================================================================
   DE TOESTELSLEUTEL -- het geheim dat dit toestel niet kan verlaten.

   Deze laag maakt een ECDSA P-256-sleutelpaar met `extractable: false` en legt
   het in IndexedDB. Dat laatste is de kern van de zaak: een CryptoKey met
   extractable false is ook voor DEZE pagina niet meer uit te lezen. Er is dus
   geen script -- van ons of van een ander -- dat de private helft kan kopieren
   naar een tweede toestel. Precies daarom mag de server op een geldige
   handtekening `bewezen` schrijven (server/kern/identiteit/toestellen.js).

   Waarom niet in localStorage: daar kan alleen tekst in, dus je zou de sleutel
   moeten exporteren om hem te bewaren -- en dan is hij per definitie
   exporteerbaar en bewijst hij niets meer over dit toestel.

   WAT DIT NIET IS. Geen vingerafdruk: er wordt niets aan de browser gemeten en
   niemand wordt passief herkend. De sleutel ontstaat pas als een mens erom
   vraagt, staat in zijn overzicht, en verdwijnt als hij hem intrekt of zijn
   browsergegevens wist. Wissen betekent dat dit toestel opnieuw bevestigd moet
   worden, en dat is de juiste kant om naar te falen.
   ========================================================================== */
(function (global) {
  'use strict';
  var DB = 'rtg-toestel', WINKEL = 'sleutels', ID = 'toestel-v1';

  function open() {
    return new Promise(function (klaar, stuk) {
      var v = indexedDB.open(DB, 1);
      v.onupgradeneeded = function () { v.result.createObjectStore(WINKEL); };
      v.onsuccess = function () { klaar(v.result); };
      v.onerror = function () { stuk(v.error); };
    });
  }
  function doe(modus, fn) {
    return open().then(function (db) {
      return new Promise(function (klaar, stuk) {
        var t = db.transaction(WINKEL, modus), r = fn(t.objectStore(WINKEL));
        r.onsuccess = function () { klaar(r.result); };
        r.onerror = function () { stuk(r.error); };
      });
    });
  }

  /* De sleutel ophalen, of hem maken als hij er niet is. `false` bij
     generateKey is het hele punt en mag nooit `true` worden: met true is de
     sleutel te exporteren en bewijst een handtekening alleen nog dat iemand
     ooit een kopie had. */
  function sleutel() {
    return doe('readonly', function (w) { return w.get(ID); }).then(function (paar) {
      if (paar && paar.privateKey) return paar;
      return crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify'])
        .then(function (nieuw) {
          return doe('readwrite', function (w) { return w.put(nieuw, ID); }).then(function () { return nieuw; });
        });
    });
  }

  /* Een uitdaging ondertekenen. Geeft de publieke sleutel mee, want de server
     kent hem bij een eerste binding nog niet -- en bij een volgende leidt hij
     de toestelId er sowieso uit af, zodat een toestel zijn id niet kan kiezen. */
  function bewijs(nonce) {
    return sleutel().then(function (paar) {
      return Promise.all([
        crypto.subtle.exportKey('jwk', paar.publicKey),
        crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, paar.privateKey,
          new TextEncoder().encode(String(nonce)))
      ]).then(function (uit) {
        var jwk = uit[0], ruw = new Uint8Array(uit[1]), s = '';
        for (var i = 0; i < ruw.length; i++) s += String.fromCharCode(ruw[i]);
        return {
          jwk: { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y },
          handtekening: btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
        };
      });
    });
  }

  /* De sleutel van dit toestel weggooien. Hoort bij "trek dit toestel in":
     zonder dit blijft er een sleutel liggen die niets meer opent maar er nog
     wel is, en dat is precies het soort restje waar niemand meer naar kijkt. */
  function vergeet() {
    return doe('readwrite', function (w) { return w.delete(ID); }).then(function () { return true; })
      .catch(function () { return false; });
  }

  /* ---- HET BEZITSBEWIJS ----
     Bewijzen dat DIT toestel dit ENE verzoek doet. De handeling zit in de
     handtekening (methode en pad), anders zou een bewijs voor het lezen van een
     saldo ook een overboeking dekken -- en dan bewijst het alleen nog dat het
     toestel er ooit was. Server: server/kern/identiteit/bezitsbewijs.js. */
  function bewijsVoor(methode, pad) {
    var lading = {
      jti: btoa(String.fromCharCode.apply(null, crypto.getRandomValues(new Uint8Array(18))))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
      tijd: Date.now(), methode: String(methode || 'POST').toUpperCase(), pad: String(pad || '')
    };
    var kop = btoa(JSON.stringify(lading)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    return sleutel().then(function (paar) {
      return crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, paar.privateKey,
        new TextEncoder().encode(kop)).then(function (sig) {
          var ruw = new Uint8Array(sig), t = '';
          for (var i = 0; i < ruw.length; i++) t += String.fromCharCode(ruw[i]);
          return kop + '.' + btoa(t).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
        });
    });
  }

  /* De paden waarbij dit huis een bewijs vraagt. Deze lijst is een KOPIE van de
     server (kern/identiteit/bezitsbewijs.js) en dat is bewust: de client
     bepaalt niets, hij weet alleen wanneer het zin heeft te tekenen. Loopt hij
     achter, dan weigert de server -- de verkeerde kant om te falen is dat de
     CLIENT zou beslissen dat iets niet zwaar is. */
  var ZWAAR = ['/api/pay/', '/api/betaal/', '/api/wallet/', '/api/bank/', '/api/auth/password',
    '/api/webauthn/registreer', '/api/webauthn/weg', '/api/mijn/toestel/introk',
    '/api/privacy/delete', '/api/rtgid/machtig', '/api/mijn/sessies/sluit',
    '/api/privacy/export', '/api/privacy/inzage', '/api/gegevens/', '/api/onboarding/inricht'];
  function zwaar(pad) {
    for (var i = 0; i < ZWAAR.length; i++) if (String(pad).indexOf(ZWAAR[i]) === 0) return true;
    return false;
  }

  /* EEN PLEK WAAR DE KOP MEEGAAT. Zonder dit zou elk scherm apart moeten weten
     wanneer het moet tekenen, en dan is het over een half jaar op een scherm
     vergeten -- precies het scherm waar geld beweegt. Dit haakt op fetch en
     laat alles wat niet zwaar is ongemoeid.

     Faalt het tekenen (geen sleutel op dit toestel, een browser zonder
     WebCrypto), dan gaat het verzoek gewoon zonder kop de deur uit: de server
     beslist of dat mag. De client hoort geen handeling tegen te houden op grond
     van iets dat hij zelf niet kon leveren. */
  function haakAan() {
    if (!beschikbaar() || global.__rtgBewijsHaak) return false;
    global.__rtgBewijsHaak = true;
    var origineel = global.fetch;
    global.fetch = function (invoer, opties) {
      var url = typeof invoer === 'string' ? invoer : (invoer && invoer.url) || '';
      var pad = String(url).replace(/^https?:\/\/[^/]+/, '').split('?')[0];
      var methode = ((opties && opties.method) || (invoer && invoer.method) || 'GET').toUpperCase();
      if (!zwaar(pad)) return origineel.apply(this, arguments);
      var eigen = opties || {};
      return bewijsVoor(methode, pad).then(function (bewijs) {
        var koppen = new Headers(eigen.headers || (typeof invoer === 'object' && invoer.headers) || {});
        koppen.set('RTG-Bezitsbewijs', bewijs);
        return origineel.call(global, invoer, Object.assign({}, eigen, { headers: koppen }));
      }).catch(function () { return origineel.call(global, invoer, eigen); });
    };
    return true;
  }

  function beschikbaar() {
    return typeof indexedDB !== 'undefined' && !!(global.crypto && global.crypto.subtle);
  }

  global.RTGToestel = { bewijs: bewijs, bewijsVoor: bewijsVoor, vergeet: vergeet,
    beschikbaar: beschikbaar, zwaar: zwaar, haakAan: haakAan };
  /* Meteen aanhaken. Wie dit bestand laadt, wil de bescherming -- een tweede
     regel die iemand moet onthouden is een regel die vergeten wordt. */
  haakAan();
})(window);
