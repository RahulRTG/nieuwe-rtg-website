/* HERBEVESTIGEN VANAF HET SCHERM -- "bent u het nog?" met uw wachtwoord of uw
   passkey, voordat een handeling iets blijvends aan uw account hangt.

   De server beslist wanneer dat nodig is (server/kern/identiteit/
   herbevestiging.js): een passkey toevoegen, of dit toestel bevestigen in een
   sessie die langer dan tien minuten open staat. Hij antwoordt dan met
   `herbevestigingNodig` en de `wegen` die hij aanneemt. Dit bestand vraagt de
   mens om een van die wegen en geeft de velden terug die de handeling
   meestuurt -- het oordeel zelf velt het niet.

   vraag({ wegen, actie, optiesPad, token, uitleg })
     -> Promise<{ huidig } | { ceremonie, antwoord } | { fout } | null>
   null betekent: de mens brak af. Een passkey gaat voor als die weg openstaat
   en het account er een heeft (`passkey`); anders het wachtwoord. Voor de
   passkey moet /shared/passkey.js op de pagina staan. */
(function (global) {
  'use strict';

  function wachtwoord(uitleg) {
    return new Promise(function (klaar) {
      var d = document.createElement('dialog');
      d.className = 'kaart';
      d.setAttribute('aria-labelledby', 'rtgHbTitel');
      var f = document.createElement('form');
      f.method = 'dialog';
      var h = document.createElement('h2'); h.id = 'rtgHbTitel'; h.textContent = 'Bevestig dat u het bent';
      var p = document.createElement('p'); p.className = 'stil';
      p.textContent = uitleg || 'Vul uw huidige wachtwoord in.';
      var l = document.createElement('label'); l.htmlFor = 'rtgHbWw'; l.textContent = 'Huidig wachtwoord';
      var i = document.createElement('input');
      i.id = 'rtgHbWw'; i.type = 'password'; i.autocomplete = 'current-password'; i.required = true;
      var rij = document.createElement('div'); rij.className = 'rij';
      var ok = document.createElement('button'); ok.className = 'knop vol'; ok.type = 'submit'; ok.value = 'ok'; ok.textContent = 'Bevestig';
      var nee = document.createElement('button'); nee.className = 'knop'; nee.type = 'button'; nee.textContent = 'Annuleer';
      nee.addEventListener('click', function () { d.close('nee'); });
      rij.appendChild(ok); rij.appendChild(nee);
      f.appendChild(h); f.appendChild(p); f.appendChild(l); f.appendChild(i); f.appendChild(rij);
      d.appendChild(f);
      d.addEventListener('close', function () {
        var waarde = d.returnValue === 'ok' ? i.value : null;
        i.value = '';
        d.remove();
        klaar(waarde ? { huidig: waarde } : null);
      });
      document.body.appendChild(d);
      d.showModal();
      i.focus();
    });
  }

  function passkey(actie, optiesPad, token) {
    if (!global.RTGPasskey || !global.RTGPasskey.bevestig) {
      return Promise.resolve({ fout: 'Deze pagina kan de passkey niet starten.' });
    }
    return global.RTGPasskey.bevestig(function () {
      return fetch(optiesPad || '/api/webauthn/bevestig/opties', { method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (token || '') },
        body: JSON.stringify({ actie: actie }) }).then(function (r) { return r.json().catch(function () { return {}; }); });
    });
  }

  function vraag(o) {
    o = o || {};
    var wegen = o.wegen || ['wachtwoord'];
    if (wegen.indexOf('passkey') >= 0 && (o.passkey || wegen.indexOf('wachtwoord') < 0)) {
      return passkey(o.actie, o.optiesPad, o.token);
    }
    return wachtwoord(o.uitleg);
  }

  global.RTGHerbevestig = { vraag: vraag };
})(typeof window !== 'undefined' ? window : this);
