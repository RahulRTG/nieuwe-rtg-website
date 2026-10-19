/* DE ACCOUNTDEUR IN HET SCHERM ZELF.

   Eigenaarsbesluit 19 oktober 2026 (AGENTS.md: gebruiken vraagt een account).
   Een klant aan tafel, op een gastlink of bij een vacature gebruikt RTG pas met
   minimaal een gratis account. Hem daarvoor naar /apps/app.html sturen kost hem
   de tafel, de link of de vacature waar hij was; daarom komt de deur naar hem
   toe. Hetzelfde patroon als de inlog van /apps/app.html: inloggen met een
   passkey of met e-mail en wachtwoord, of in een paar velden een gratis account
   maken (tier 'guest'). Daarna staat het token waar elke app het leest
   (localStorage 'rtg_member_token') en gaat het scherm verder waar het was.

   WAT DIT NIET IS: een poort. De server beslist (auth in server/opzet/
   diensten2.js). De code of link van het scherm blijft een EXTRA sleutel bij
   de sessie en vervangt hem nooit.

   Gebruik:
     RTGAccountDeur.token()                 het bewaarde ledentoken, of ''
     RTGAccountDeur.kop(headers)            zet Authorization erbij als er een token is
     RTGAccountDeur.eis(el, { waarom })     Promise<token>: meteen als er een is,
                                            anders na inloggen of aanmelden in `el`
     RTGAccountDeur.vergeet()               na een 401: het token is niets meer waard */
(function (w) {
  'use strict';
  var SLEUTEL = 'rtg_member_token';
  function token() { try { return localStorage.getItem(SLEUTEL) || ''; } catch (e) { return ''; } }
  function bewaar(t) { try { localStorage.setItem(SLEUTEL, t); } catch (e) { /* privévenster: alleen deze pagina */ } w.__rtgAccountToken = t; }
  function huidig() { return token() || w.__rtgAccountToken || ''; }
  function vergeet() { try { localStorage.removeItem(SLEUTEL); } catch (e) {} w.__rtgAccountToken = ''; }
  function kop(h) { var t = huidig(); h = h || {}; if (t) h.Authorization = 'Bearer ' + t; return h; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }
  function post(pad, body) {
    return fetch(pad, { method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) {
        if (!r.ok) { var f = new Error(d.error || 'Dat lukte niet.'); f.status = r.status; throw f; } return d; }); });
  }
  var b2u = function (s) { return Uint8Array.from(atob(String(s).replace(/-/g, '+').replace(/_/g, '/')), function (c) { return c.charCodeAt(0); }); };
  var u2b = function (buf) { return btoa(String.fromCharCode.apply(null, new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
  function passkey() {
    if (!(w.PublicKeyCredential && navigator.credentials && navigator.credentials.get))
      return Promise.reject(new Error('Deze browser ondersteunt hier geen passkey. Log in met e-mail en wachtwoord.'));
    return post('/api/webauthn/opties', {}).then(function (o) {
      var pub = o.opties; pub.challenge = b2u(pub.challenge);
      pub.allowCredentials = (pub.allowCredentials || []).map(function (c) { return Object.assign({}, c, { id: b2u(c.id) }); });
      return navigator.credentials.get({ publicKey: pub }).then(function (cred) {
        return post('/api/webauthn/login', { ceremonie: o.ceremonie, antwoord: { id: cred.id, rawId: u2b(cred.rawId), type: cred.type,
          clientExtensionResults: cred.getClientExtensionResults(),
          response: { authenticatorData: u2b(cred.response.authenticatorData), clientDataJSON: u2b(cred.response.clientDataJSON),
            signature: u2b(cred.response.signature), userHandle: cred.response.userHandle ? u2b(cred.response.userHandle) : null } } });
      });
    });
  }

  var STIJL = '.rtg-ad{font-family:Inter,system-ui,sans-serif;color:var(--grey,#4D4A45);border-top:1px solid var(--line,#DEDBD5);padding:24px 0;max-width:420px}' +
    '.rtg-ad h2{font-family:"Bodoni Moda",Georgia,serif;font-weight:500;color:var(--black,#0C0C0B);margin:0 0 8px}' +
    '.rtg-ad p{margin:0 0 16px;line-height:1.5}.rtg-ad label{display:block;font-size:13px;margin:12px 0 4px;color:var(--black,#0C0C0B)}' +
    '.rtg-ad input{width:100%;box-sizing:border-box;padding:10px;border:1px solid var(--line,#DEDBD5);font:inherit;background:var(--white,#FFFFFF);color:var(--black,#0C0C0B)}' +
    '.rtg-ad button{font:inherit;padding:12px 16px;margin:16px 8px 0 0;border:1px solid var(--burgundy,#7F1634);cursor:pointer;background:var(--white,#FFFFFF);color:var(--burgundy,#7F1634)}' +
    '.rtg-ad button.hoofd{background:var(--burgundy,#7F1634);color:var(--white,#FFFFFF)}.rtg-ad button.hoofd:hover{background:var(--burgundy-bright,#9E1C40)}' +
    '.rtg-ad .wissel{background:none;border:0;padding:0;margin-top:16px;text-decoration:underline;color:var(--grey,#4D4A45)}' +
    '.rtg-ad [role=status]{min-height:1.5em;margin-top:12px;color:var(--burgundy,#7F1634)}';

  function eis(el, opties) {
    opties = opties || {};
    var t = huidig();
    if (t) return Promise.resolve(t);
    return new Promise(function (klaar) {
      if (!document.getElementById('rtgAccountDeurStijl')) {
        var st = document.createElement('style'); st.id = 'rtgAccountDeurStijl'; st.textContent = STIJL; document.head.appendChild(st);
      }
      var stand = 'nieuw';
      function teken() {
        var nieuw = stand === 'nieuw';
        el.innerHTML = '<section class="rtg-ad" aria-labelledby="rtgAdKop">' +
          '<h2 id="rtgAdKop">' + (nieuw ? 'Maak gratis een account' : 'Log in') + '</h2>' +
          '<p>' + esc(opties.waarom || 'Hiervoor heb je een RTG-account nodig. Een gratis account is genoeg.') +
          ' Daarna ga je hier verder waar je was.</p>' +
          '<form novalidate>' +
          (nieuw
            ? '<label for="rtgAdNaam">Naam</label><input id="rtgAdNaam" autocomplete="name" required>' +
              '<label for="rtgAdMail">E-mailadres</label><input id="rtgAdMail" type="email" autocomplete="email" required>' +
              '<label for="rtgAdGeb">Geboortedatum</label><input id="rtgAdGeb" type="date" autocomplete="bday" required>' +
              '<label for="rtgAdWw">Wachtwoord (minstens zes tekens)</label><input id="rtgAdWw" type="password" autocomplete="new-password" minlength="6" required>'
            : '<label for="rtgAdMail">E-mailadres of gebruikersnaam</label><input id="rtgAdMail" autocomplete="username" required>' +
              '<label for="rtgAdWw">Wachtwoord</label><input id="rtgAdWw" type="password" autocomplete="current-password" required>') +
          '<button class="hoofd" type="submit">' + (nieuw ? 'Account maken en doorgaan' : 'Inloggen en doorgaan') + '</button>' +
          (nieuw ? '' : '<button type="button" data-ad="passkey">Inloggen met passkey</button>') +
          '</form>' +
          '<button type="button" class="wissel" data-ad="wissel">' + (nieuw ? 'Ik heb al een account' : 'Nog geen account? Maak er gratis een') + '</button>' +
          '<div role="status" aria-live="polite"></div></section>';
        var status = el.querySelector('[role=status]');
        function gelukt(d) {
          if (d && d.tweedeFactorNodig) { status.innerHTML = 'Dit account vraagt een tweede stap. <a href="/apps/app.html">Log in via de app</a> en kom daarna terug.'; return; }
          if (!d || !d.token) { status.textContent = 'De server bevestigde nog geen sessie. Probeer het opnieuw.'; return; }
          bewaar(d.token); el.innerHTML = ''; klaar(d.token);
        }
        function mis(e) { status.textContent = (e && e.name === 'NotAllowedError') ? 'Het inloggen is geannuleerd.' : (e && e.message) || 'Dat lukte niet.'; }
        el.querySelector('[data-ad=wissel]').addEventListener('click', function () { stand = nieuw ? 'inlog' : 'nieuw'; teken(); });
        var pk = el.querySelector('[data-ad=passkey]');
        if (pk) pk.addEventListener('click', function () { status.textContent = 'Bevestig op je apparaat dat je wilt inloggen.'; passkey().then(gelukt, mis); });
        el.querySelector('form').addEventListener('submit', function (ev) {
          ev.preventDefault();
          var v = function (id) { var i = el.querySelector('#' + id); return i ? i.value.trim() : ''; };
          var ww = el.querySelector('#rtgAdWw').value;
          if (!v('rtgAdMail') || !ww || (nieuw && (!v('rtgAdNaam') || !v('rtgAdGeb') || ww.length < 6))) { status.textContent = 'Vul alle velden in.'; return; }
          status.textContent = 'Een ogenblik.';
          (nieuw
            ? post('/api/auth/register', { name: v('rtgAdNaam'), email: v('rtgAdMail'), geboortedatum: v('rtgAdGeb'), password: ww, tier: 'guest' })
            : post('/api/auth/login', { login: v('rtgAdMail'), password: ww })).then(gelukt, mis);
        });
        var eerste = el.querySelector('input'); if (eerste) eerste.focus();
      }
      teken();
    });
  }

  w.RTGAccountDeur = { token: huidig, kop: kop, eis: eis, vergeet: vergeet };
})(window);
