/* De kantoor-inlog als gesprek met Rahul, in plaats van een codeveld.

   Waarom dit een eigen module is en geen veld op drie schermen: een inlog die op
   drie plekken los is nagebouwd, raakt op twee van die plekken achter. Precies
   dat was hier gebeurd -- toen de backoffice een tweede factor kreeg, kreeg
   alleen de werk-app een veld ervoor, en de andere drie schermen liepen vast op
   een vraag die ze niet konden stellen. Eén module, één gesprek, overal gelijk.

   Twee dingen die anders zijn dan bij een gewone chat, en allebei met opzet:

   - VRAAGT RAHUL OM EEN CODE, DAN WORDT DE INVOER GEMASKEERD. De server zet
     `verborgen` op de vraag; dit scherm maakt er dan een wachtwoordveld van. Een
     chatvenster toont normaal wat je typt, en een kantoorcode hoort niet leesbaar
     in beeld te staan waar iemand overheen kan kijken.

   - WAT JE TYPT BLIJFT NERGENS STAAN. Het gaat naar de server en verdwijnt uit
     het veld; er komt geen bellenrij met je code erin, en de browser krijgt
     autocomplete="off" zodat hij hem niet onthoudt.

   - DE SLEUTELBOS GAAT VOOR DE CODE. Hangt de kantoorsleutel al aan het
     RTG-account waarmee dit toestel is ingelogd (kern/eenaccount.js; bij de
     eigenaar is die AFGELEID en koppelt hij niets), dan probeert dit gesprek
     eerst /api/account/start en vraagt het pas iets als dat niet gaat.

     Dat was een gat en geen gemak: officeAuth liet de eigenaar met zijn eigen
     lid-token allang door (server/kern/kantoor/index.js) terwijl vier schermen
     hem om een kantoorcode vroegen en vier andere doodliepen op "Geen
     backoffice-sessie". Een inlogvraag die niet nodig is, leert mensen hun
     code intypen waar dat niet hoeft. De algemene pin blijft gelden: zegt de
     server pinNodig, dan vraagt Rahul die hier, gemaskeerd, in hetzelfde
     gesprek. Het ene account is geen achterdeur (kern/eenaccount/starten.js).

   Gebruik:  RTGKantoorGesprek.toon(element, function (token, state) { ... })  */
(function (w) {
  'use strict';
  if (w.RTGKantoorGesprek) return;

  var esc = function (t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); };

  var CSS =
    '.kg{max-width:26rem;margin:3rem auto;padding:0 1.2rem;font-family:Inter,system-ui,sans-serif;}' +
    '.kg h2{font-family:"Bodoni Moda",Georgia,serif;font-weight:600;font-size:1.35rem;margin:0 0 1.2rem;}' +
    '.kg h2[hidden]{display:none;}' +
    '.kg-zegt{font-size:.95rem;line-height:1.55;margin:0 0 1rem;min-height:3rem;}' +
    /* De tokens van de kantoorschermen zelf, niet die van mij: daar is de
       hoofdknop goud met zwarte letters, en de randen volgen --line. Zo buigt
       dit mee met de dagkleur en het seizoen, net als de rest van de pagina.
       Met een eigen bordeaux knop stond hier een vreemde in het scherm. */
    '.kg-in{width:100%;background:var(--card2,var(--bg,#0C0C0B));border:1px solid var(--line,rgba(255,255,255,.18));' +
    'border-radius:0;color:var(--txt,#F4F1EC);font:inherit;font-size:.95rem;padding:.7rem .8rem;}' +
    '.kg-in:focus{outline:none;border-color:var(--gold,#D0AC57);}' +
    '.kg-rij{display:flex;gap:.6rem;margin-top:.8rem;}' +
    '.kg-rij button{flex:1;border:none;cursor:pointer;font:inherit;font-weight:700;font-size:.95rem;' +
    'border-radius:0;padding:.7rem 1rem;background:var(--gold,#D0AC57);color:#000;}' +
    '.kg-rij button:disabled{opacity:.45;cursor:default;}' +
    '.kg-fout{font-size:.86rem;line-height:1.5;color:var(--burgundy-on-dark,#C23A5E);margin:.8rem 0 0;min-height:1.2rem;}';

  /* EEN STILLE SLEUTEL PROBEER JE EEN KEER PER PAGINA. De deur kan twee keer
     opengaan: als er geen sleutel is, en nog eens als een verzoek alsnog 401
     geeft. Zou de sleutelbos dan opnieuw stil munten, dan draaien scherm en
     deur rond -- de lus die backoffice.js eerder in vier seconden tweeenveertig
     keer liet herladen. Een sleutel die niet hielp, helpt de tweede keer ook
     niet; dan is de code aan de beurt, met de reden erbij. */
  var sleutelGebruikt = false;

  var stijlGezet = false;
  function stijl() {
    if (stijlGezet) return;
    stijlGezet = true;
    var s = document.createElement('style'); s.textContent = CSS;
    (document.head || document.documentElement).appendChild(s);
  }

  function post(pad, lijf) {
    return fetch('/api/kantoor/gesprek/' + pad, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(lijf || {})
    }).then(function (r) { return r.json().catch(function () { return {}; }); });
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
    var id = null;
    doel.innerHTML =
      '<div class="kg"><h2>Kantoor-inlog</h2>' +
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
      // de server bepaalt of dit gemaskeerd hoort: een code wel, een gewone vraag niet
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

    /* WAT "VERDER" NU DOET. Het gesprek heeft twee standen -- de code van het
       kantoor, en de algemene pin bij het ene account -- en die verschillen
       alleen in waar het antwoord heen gaat. Een vlag zou hier twee keer
       moeten worden uitgelezen; een verwijzing naar de ontvanger maar een keer
       worden gezet. */
    var ontvanger = zegCode;

    function stuur() {
      var tekst = veld.value;
      if (!tekst) return;
      veld.value = '';                       // meteen uit beeld
      veld.disabled = true; knop.disabled = true;
      fout.textContent = '';
      ontvanger(tekst);
    }

    function zegCode(tekst) {
      if (!id) { melden(''); return; }
      post('zeg', { id: id, tekst: tekst }).then(function (d) {
        if (d.token) { zegt.textContent = d.tekst || 'U bent binnen.'; return klaar(d.token, d.state); }
        if (d.gestopt) { zegt.textContent = d.tekst || 'Goed.'; veld.disabled = true; knop.disabled = true; return; }
        if (d.error) { melden(d.error); if (!d.veld) codeGesprek(); return; }
        if (d.id) id = d.id;
        vraag(d);
      }).catch(function () { melden('Dat lukte even niet. Probeer het opnieuw.'); });
    }

    function codeGesprek() {
      ontvanger = zegCode;
      post('start', {}).then(function (d) {
        if (d.error) { zegt.textContent = d.error; veld.disabled = true; knop.disabled = true; return; }
        id = d.id;
        vraag(d);
      }).catch(function () { zegt.textContent = 'Het kantoor is even niet bereikbaar.'; });
    }

    /* DE SLEUTELBOS EERST: /api/account/start munt dezelfde sessie als de code
       zou doen (kern/eenaccount/starten.js), met dezelfde logregel. Lukt dat
       niet, dan valt het gesprek terug op de code -- en NIET stil: de reden van
       de server komt in het foutvak. Een terugval zonder reden laat iemand een
       code intypen zonder te weten waarom zijn eigen account niet volstond. */
    function viaAccount() {
      var lt = lidToken();
      if (!lt) return codeGesprek();
      if (sleutelGebruikt) {
        codeGesprek();
        fout.textContent = 'Uw RTG-account opende deze deur al eerder en het was niet genoeg. Daarom nu de kantoorcode.';
        return;
      }
      zegt.textContent = 'Een moment, ik kijk of uw eigen RTG-account hier al toegang heeft...';
      accountPost('rollen', {}, lt).then(function (d) {
        var heeft = (d.rollen || []).some(function (r) { return r && r.rol === 'kantoor'; });
        if (!heeft) return codeGesprek();
        start(null);
      }).catch(function () { codeGesprek(); });

      function start(pin) {
        accountPost('start', pin ? { rol: 'kantoor', pin: pin } : { rol: 'kantoor' }, lt).then(function (s) {
          if (s.token) {
            sleutelGebruikt = true;
            zegt.textContent = 'Welkom terug. U bent binnen met uw eigen RTG-account.';
            return klaar(s.token, s.state);
          }
          if (s.pinNodig) return vraagPin();
          // geen sleutel (meer), of iets anders mis: de code, met de reden erbij
          codeGesprek();
          fout.textContent = s.error || '';
        }).catch(function () { codeGesprek(); });
      }

      function vraagPin() {
        ontvanger = function (tekst) { start(tekst); };
        vraag({ tekst: 'Uw algemene pin, dan zet ik de kantoordeur open.', verborgen: true });
      }
    }

    knop.addEventListener('click', stuur);
    veld.addEventListener('keydown', function (e) { if (e.key === 'Enter') stuur(); });
    viaAccount();
  }

  w.RTGKantoorGesprek = { toon: toon };
})(window);
