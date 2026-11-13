/* De kantoor-inlog via het gewone RTG-account.

   Een eigen module en geen veld op drie schermen: een inlog die op drie plekken
   los is nagebouwd, raakt op twee ervan achter (dat gebeurde bij de tweede
   factor). Eén module, één gesprek, overal gelijk.

   Twee dingen die anders zijn dan bij een gewone chat, en allebei met opzet:

   Hangt de kantoorsleutel aan het
     RTG-account waarmee dit toestel is ingelogd (kern/eenaccount.js; bij de
     eigenaar is die AFGELEID en koppelt hij niets), dan gebruikt dit gesprek
     /api/account/start. Een gedeelde kantoorcode is geen terugvalroute meer.

     De algemene pin en (in productie) de passkey blijven gelden;
     het ene account is geen achterdeur (kern/eenaccount/starten.js).

   Gebruik:  RTGKantoorGesprek.toon(element, function (token, state) { ... })  */
(function (w) {
  'use strict';
  if (w.RTGKantoorGesprek) return;

  var esc = function (t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); };

  /* EEN STILLE SLEUTEL PROBEER JE EEN KEER PER PAGINA: anders draaien scherm en
     deur rond (backoffice.js herlaadde eens 42 keer in vier seconden). Een
     sleutel die niet hielp, helpt de tweede keer ook niet. */
  var sleutelGebruikt = false;

  var stijlGezet = false;
  function laadKantoorGesprekStijl(pad) {
    if (document.documentElement.hasAttribute('data-ds')) return;
    var kantoorGesprekStijl = document.createElement('link');
    kantoorGesprekStijl.rel = 'stylesheet';
    kantoorGesprekStijl.href = pad;
    document.head.appendChild(kantoorGesprekStijl);
  }
  function stijl() {
    if (stijlGezet) return;
    stijlGezet = true;
    laadKantoorGesprekStijl('/ds/componenten/kantoorgesprek.css');
  }

  // de kantoordeur op naam (/shared/kantoordeur.js); passkey pas bij een ceremonie
  function kantoordeur() {
    var klaar = function () { return w.RTGKantoorDeur || null; };
    if (w.RTGKantoorDeur) return Promise.resolve(klaar());
    return new Promise(function (ok) {
      laadKantoorGesprekScript('/shared/kantoordeur.js', function () { ok(klaar()); });
    });
  }

  function laadKantoorGesprekScript(pad, klaar) {
    var kantoorGesprekScript = document.createElement('script');
    kantoorGesprekScript.src = pad;
    kantoorGesprekScript.onload = kantoorGesprekScript.onerror = klaar;
    document.head.appendChild(kantoorGesprekScript);
  }

  // het lid-token van dit toestel; null als er niemand als lid is ingelogd
  function lidToken() {
    try { return localStorage.getItem('rtg_member_token') || null; } catch (e) { return null; }
  }

  // de sleutelbos-kant (kern/eenaccount.js), met het lid-token als bewijs
  function accountPost(pad, lijf, token) {
    return fetch('/api/account/' + pad, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify(lijf || {})
    }).then(function (r) { return r.json().catch(function () { return {}; }); });
  }

  function toon(doel, klaar) {
    stijl();
    doel.innerHTML =
      '<div class="kg ds-kantoorgesprek"><h2>Kantoor-inlog</h2>' +
      '<p class="kg-zegt" aria-live="polite">Een moment...</p>' +
      '<input class="kg-in" type="password" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Antwoord">' +
      '<div class="kg-rij"><button type="button">Verder</button></div>' +
      '<p class="kg-fout" role="alert"></p></div>';
    var zegt = doel.querySelector('.kg-zegt');
    var veld = doel.querySelector('.kg-in');
    var knop = doel.querySelector('.kg-rij button');
    var fout = doel.querySelector('.kg-fout');

    function vraag(d) {
      zegt.textContent = d.tekst || '';
      // de kantoordeur bepaalt of de algemene pin gemaskeerd hoort
      veld.type = d.verborgen ? 'password' : 'text';
      veld.value = '';                       // nooit laten staan
      veld.disabled = false; knop.disabled = false;
      veld.focus();
    }

    function melden(tekst) {
      fout.textContent = tekst || '';
      veld.value = '';
      veld.disabled = false; knop.disabled = false;
      veld.focus();
    }

    var ontvanger = function () {};

    function stuur() {
      var tekst = veld.value;
      if (!tekst) return melden('Typ uw antwoord.');
      veld.value = '';                       // meteen uit beeld
      veld.disabled = true; knop.disabled = true;
      fout.textContent = '';
      ontvanger(tekst);
    }

    function geenToegang(tekst) {
      zegt.textContent = tekst || 'Dit RTG-account heeft geen kantoorzetel.';
      fout.textContent = 'Vraag de eigenaar om de juiste werkrol aan uw gewone RTG-account te koppelen.';
      veld.value = ''; veld.disabled = true; knop.disabled = true;
    }

    /* DE SLEUTELBOS IS DE ENIGE INGANG (/api/account/start). */
    function viaAccount() {
      var lt = lidToken();
      if (!lt) return geenToegang('Meld u eerst aan met uw gewone RTG-account.');
      if (sleutelGebruikt) {
        return geenToegang('Uw RTG-account heeft deze deur niet geopend.');
      }
      zegt.textContent = 'Een moment, ik kijk of uw eigen RTG-account hier al toegang heeft...';
      // tegelijk met de rollenvraag: geen extra stap
      var deurLaadt = kantoordeur();
      accountPost('rollen', {}, lt).then(function (d) {
        var heeft = (d.rollen || []).some(function (r) { return r && r.rol === 'kantoor'; });
        if (!heeft) return geenToegang('Dit RTG-account heeft geen kantoorrol.');
        start(null);
      }).catch(function () { geenToegang('Uw RTG-account kon niet worden gecontroleerd.'); });

      // de ene kantoordeur: pin voor passkey; weigert Safari buiten een tik, dan een knop
      function start(pin) {
        deurLaadt.then(function (D) {
          if (!D) { geenToegang('De kantoordeur kon hier niet laden.'); return; }
          return D.binnen(lt, { pin: pin, vraagTik: D.tikDialoog('Bevestig met uw passkey, dan zet ik het kantoor open.') }).then(function (s) {
            if (s.token) {
              sleutelGebruikt = true;
              zegt.textContent = 'Welkom terug. U bent binnen met uw eigen RTG-account.';
              return klaar(s.token, s.state);
            }
            /* `pinNodig` is de vraag EN de afwijzing (eenaccount/starten.js);
               alleen de afwijzing draagt een reden. Zie test/kantoordeur.e2e.js. */
            if (s.pinNodig) return vraagPin(pin ? (s.error || 'Die pincode klopt niet.') : '');
            if (s.geenPasskey) {
              zegt.innerHTML = esc(s.error) + ' <a href="' + esc(s.link) + '">Een passkey toevoegen</a>';
              veld.disabled = true; knop.disabled = true;
              return;
            }
            geenToegang(s.error || 'Dit RTG-account heeft geen toegang tot het kantoor.');
          });
        }).catch(function () { geenToegang('De kantoordeur kon niet worden geopend.'); });
      }

      function vraagPin(reden) {
        ontvanger = function (tekst) { start(tekst); };
        vraag({ tekst: 'Uw algemene pin, dan zet ik de kantoordeur open.', verborgen: true });
        fout.textContent = reden || '';
      }
    }

    knop.addEventListener('click', stuur);
    veld.addEventListener('keydown', function (e) { if (e.key === 'Enter') stuur(); });
    viaAccount();
  }

  w.RTGKantoorGesprek = { toon: toon };
})(window);
