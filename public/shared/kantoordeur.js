/* DE KANTOORDEUR OP NAAM -- een plek voor de drie schermen die het kantoor openen.

   Het kantoor opent met het eigen RTG-account en de kantoorrol
   (/api/account/start, kern/eenaccount/starten.js); in productie alleen met
   een verse passkeyceremonie (besluit B10, kern/kantoor/productiedeur.js). Die
   weg stond drie keer in de client: apps/personeel.js, Werk -> Backoffice in
   app-main en shared/kantoorgesprek.js -- en de derde kende de passkey niet,
   zodat hij in productie vastliep op "Bevestig deze handeling met uw passkey."
   Dit bestand is de ene plek; de schermen tekenen alleen hun eigen knoppen.

   DE CEREMONIE HOORT IN DE KLIK. Safari en iOS weigeren
   navigator.credentials.get met NotAllowedError als er tussen de tik en de
   aanroep een fetch zat waarop gewacht werd. Daarom twee wegen:
   - `bereid` haalt de ceremonie VOORAF op (in productie maakt dat geen sessie,
     de server antwoordt 401 met de opties), en `tekenNu` roept daarna get()
     zonder await ervoor aan, in de klik zelf;
   - `binnen` doet alles na elkaar, en vraagt als de browser de ceremonie toch
     weigert om een tweede tik via `vraagTik` -- dan staat get() wel in een klik.

   WAT HIER NIET IN ZIT. Het oordeel. Of de code dicht is, zegt de server
   (/api/health, veld `kantoordeur`); wie de rol mag, zegt de sleutelbos. Is de
   stand onbekend, dan gaat dit bestand uit van DICHT: een codeveld dat ten
   onrechte ontbreekt is een ongemak, een dat ten onrechte openstaat niet.

   Vereist ./passkey.js (RTGPasskey) op de pagina, of laadt hem zelf. */
(function (global) {
  'use strict';

  var PASSKEYS = '/apps/passkeys.html';

  function post(pad, body, token) {
    return fetch(pad, { method: 'POST', body: JSON.stringify(body || {}),
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (token || '') }
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) { return { status: r.status, ok: r.ok, d: d }; });
    });
  }

  function laadPasskey() {
    if (global.RTGPasskey) return Promise.resolve(global.RTGPasskey);
    return new Promise(function (ok) {
      var t = document.createElement('script'); t.src = '/shared/passkey.js';
      t.onload = t.onerror = function () { ok(global.RTGPasskey || null); };
      document.head.appendChild(t);
    });
  }

  /* De stand van de deur, van de server. { codeDicht: true } bij twijfel. */
  var _stand = null;
  function stand() {
    if (_stand) return _stand;
    _stand = fetch('/api/health').then(function (r) { return r.json(); }).then(function (d) {
      var k = d && d.kantoordeur;
      return { codeDicht: !(k && k.code === true), passkey: !!(k && k.passkey === true) };
    }).catch(function () { return { codeDicht: true, passkey: true }; });
    return _stand;
  }

  /* Een uitkomst die een scherm kan tonen. Elke soort heeft een vaste vorm:
     { token, state }          -- binnen
     { pinNodig, error }       -- eerst de algemene pin (vóór de passkey)
     { bevestiging }           -- de ceremonie ligt klaar
     { geenPasskey, error, link } -- dit account heeft nog geen passkey
     { error, watNu }          -- iets anders, met de reden van de server */
  function uitkomst(a) {
    var d = a.d || {};
    if (a.ok && d.token) return { token: d.token, state: d.state, welzijn: d.welzijn };
    if (d.pinNodig) return { pinNodig: true, error: d.error || '' };
    if (a.status === 401 && d.bevestigingNodig && d.bevestiging && d.bevestiging.opties) return { bevestiging: d.bevestiging };
    if (d.watNu === 'passkey-zetten') return { geenPasskey: true, link: PASSKEYS,
      error: d.error || 'Het kantoor opent alleen met een passkey, en dit account heeft er nog geen.' };
    return { error: d.error || 'Het kantoor ging niet open.', watNu: d.watNu || null };
  }

  /* Eén verzoek aan de deur. `passkey: true` vraagt om de ceremonie, ook waar
     de server hem niet afdwingt: wie de passkeyknop indrukt, krijgt een
     passkey en geen stille terugval (productiedeur.startBewijs, `vrijwillig`). */
  function vraag(lt, o) {
    o = o || {};
    var lijf = { rol: 'kantoor' };
    if (o.pin) lijf.pin = o.pin;
    if (o.passkey) lijf.passkey = true;
    if (o.bewijs) { lijf.ceremonie = o.bewijs.ceremonie; lijf.antwoord = o.bewijs.antwoord; }
    return post('/api/account/start', lijf, lt).then(uitkomst);
  }

  /* Haal de ceremonie vooraf op. Geeft een uitkomst; `bevestiging` betekent
     dat `tekenNu` in de volgende klik meteen kan. */
  function bereid(lt, o) {
    return vraag(lt, { pin: o && o.pin, passkey: true });
  }

  /* SYNCHROON aanroepen in een klik: get() start voor er iets awaited wordt. */
  function tekenNu(bevestiging) {
    var P = global.RTGPasskey;
    if (!P || !global.navigator || !global.navigator.credentials) return Promise.resolve({ fout: 'Deze browser kent geen passkeys.' });
    var cred;
    try { cred = global.navigator.credentials.get({ publicKey: P.leesOpties(bevestiging.opties) }); }
    catch (e) { return Promise.resolve({ fout: 'Afgebroken: ' + (e && e.message || 'onbekend'), naam: e && e.name }); }
    return cred.then(function (c) { return { ceremonie: bevestiging.ceremonie, antwoord: P.schrijfAntwoord(c) }; },
      function (e) { return { fout: 'Afgebroken: ' + (e && e.message || 'onbekend'), naam: e && e.name }; });
  }

  /* Lever het getekende antwoord in. */
  function lever(lt, bewijs, o) {
    return vraag(lt, { pin: o && o.pin, bewijs: bewijs });
  }

  /* Alles na elkaar, voor schermen die niet vooraf kunnen ophalen.
     o: { pin, passkey, vraagTik(fn) } -- vraagTik krijgt een functie die het
     scherm SYNCHROON in een klik aanroept; de belofte die hij teruggeeft, is
     het resultaat van die klik. Zonder vraagTik blijft het bij een poging. */
  function binnen(lt, o) {
    o = o || {};
    return stand().then(function (st) {
      return vraag(lt, { pin: o.pin, passkey: o.passkey === undefined ? st.codeDicht : o.passkey });
    }).then(function (u) {
      if (!u.bevestiging) return u;
      return laadPasskey().then(function () {
        return tekenNu(u.bevestiging).then(function (b) {
          if (!b.fout) return lever(lt, b, o);
          if (typeof o.vraagTik !== 'function') return { error: b.fout };
          // de browser wilde de ceremonie niet buiten een klik: vraag er een
          return o.vraagTik(function () { return tekenNu(u.bevestiging); }).then(function (b2) {
            return b2 && !b2.fout ? lever(lt, b2, o) : { error: (b2 && b2.fout) || 'De bevestiging is niet gelukt.' };
          });
        });
      });
    });
  }

  /* Een vraagTik voor schermen zonder eigen knop: een dialoog met EEN knop,
     waarvan de klik de ceremonie zelf start (dezelfde vorm als herbevestig.js). */
  function tikDialoog(uitleg) {
    return function (teken) {
      return new Promise(function (klaar) {
        var d = document.createElement('dialog');
        d.className = 'kaart'; d.id = 'rtgKdTik';
        d.setAttribute('aria-labelledby', 'rtgKdTitel');
        var h = document.createElement('h2'); h.id = 'rtgKdTitel'; h.textContent = 'Kantoor openen met passkey';
        var p = document.createElement('p'); p.className = 'stil';
        p.textContent = uitleg || 'Tik op de knop en bevestig met uw passkey.';
        var rij = document.createElement('div'); rij.className = 'rij';
        var ok = document.createElement('button'); ok.className = 'knop vol'; ok.type = 'button'; ok.id = 'rtgKdTikGo';
        ok.textContent = 'Bevestig met passkey';
        var nee = document.createElement('button'); nee.className = 'knop'; nee.type = 'button'; nee.textContent = 'Annuleer';
        var uit = null;
        // de ceremonie start IN deze klik, voor er iets awaited wordt
        ok.addEventListener('click', function () { uit = teken(); d.close('ok'); });
        nee.addEventListener('click', function () { d.close('nee'); });
        d.addEventListener('close', function () {
          d.remove();
          klaar(uit || { fout: 'Afgebroken.' });
        });
        rij.appendChild(ok); rij.appendChild(nee);
        d.appendChild(h); d.appendChild(p); d.appendChild(rij);
        document.body.appendChild(d);
        d.showModal();
        ok.focus();
      });
    };
  }

  global.RTGKantoorDeur = { tikDialoog: tikDialoog, stand: stand, vraag: vraag, bereid: bereid, tekenNu: tekenNu, lever: lever,
    binnen: binnen, laadPasskey: laadPasskey, PASSKEYS: PASSKEYS };
})(typeof window !== 'undefined' ? window : this);
