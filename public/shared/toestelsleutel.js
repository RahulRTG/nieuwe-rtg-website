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

  function beschikbaar() {
    return typeof indexedDB !== 'undefined' && !!(global.crypto && global.crypto.subtle);
  }

  global.RTGToestel = { bewijs: bewijs, vergeet: vergeet, beschikbaar: beschikbaar };
})(window);
