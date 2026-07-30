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

   Gebruik:  RTGKantoorGesprek.toon(element, function (token, state) { ... })  */
(function (w) {
  'use strict';
  if (w.RTGKantoorGesprek) return;

  var esc = function (t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); };

  var CSS =
    '.kg{max-width:26rem;margin:3rem auto;padding:0 1.2rem;font-family:Inter,system-ui,sans-serif;}' +
    '.kg h2{font-family:"Bodoni Moda",Georgia,serif;font-weight:600;font-size:1.35rem;margin:0 0 1.2rem;}' +
    '.kg-zegt{font-size:.95rem;line-height:1.55;margin:0 0 1rem;min-height:3rem;}' +
    '.kg-in{width:100%;background:#0C0C0B;border:1px solid rgba(255,255,255,.18);border-radius:12px;' +
    'color:#F4F1EC;font:inherit;font-size:.95rem;padding:.7rem .8rem;}' +
    '.kg-in:focus{outline:none;border-color:var(--burgundy-on-dark,#C23A5E);}' +
    '.kg-rij{display:flex;gap:.6rem;margin-top:.8rem;}' +
    '.kg-rij button{flex:1;border:none;cursor:pointer;font:inherit;font-weight:600;font-size:.9rem;' +
    'border-radius:12px;padding:.7rem 1rem;background:var(--burgundy,#7F1634);color:#fff;}' +
    '.kg-rij button:hover{background:var(--burgundy-bright,#9E1C40);}' +
    '.kg-rij button:disabled{background:#2a2724;color:#6b6862;cursor:not-allowed;}' +
    '.kg-fout{font-size:.86rem;line-height:1.5;color:var(--burgundy-on-dark,#C23A5E);margin:.8rem 0 0;min-height:1.2rem;}';

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

    function stuur() {
      var tekst = veld.value;
      if (!tekst || !id) return;
      veld.value = '';                       // meteen uit beeld
      veld.disabled = true; knop.disabled = true;
      fout.textContent = '';
      post('zeg', { id: id, tekst: tekst }).then(function (d) {
        if (d.token) { zegt.textContent = d.tekst || 'U bent binnen.'; return klaar(d.token, d.state); }
        if (d.gestopt) { zegt.textContent = d.tekst || 'Goed.'; veld.disabled = true; knop.disabled = true; return; }
        if (d.error) { melden(d.error); if (!d.veld) begin(); return; }
        if (d.id) id = d.id;
        vraag(d);
      }).catch(function () { melden('Dat lukte even niet. Probeer het opnieuw.'); });
    }

    function begin() {
      post('start', {}).then(function (d) {
        if (d.error) { zegt.textContent = d.error; veld.disabled = true; knop.disabled = true; return; }
        id = d.id;
        vraag(d);
      }).catch(function () { zegt.textContent = 'Het kantoor is even niet bereikbaar.'; });
    }

    knop.addEventListener('click', stuur);
    veld.addEventListener('keydown', function (e) { if (e.key === 'Enter') stuur(); });
    begin();
  }

  w.RTGKantoorGesprek = { toon: toon };
})(window);
