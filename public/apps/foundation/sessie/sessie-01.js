/* WELKE LETTER PAST OP DEZE CIRKEL. De avatar krijgt de kleur die het lid
   zelf koos, en de letter stond vast op de tekstkleur van het huis -- wit.
   Wit op het standaardgoud #C9A24B haalt 2,2:1, en dat is geen initiaal maar
   een vlek; over de zeventig Foundation-schermen was dit in zijn eentje goed
   voor 43 contrastovertredingen. Een VASTE letterkleur is hier per definitie
   soms fout, want de achtergrond is van de gebruiker. Dus rekent hij het uit:
   wit of bijna zwart, wat van de twee het verst van deze kleur af staat. Zo
   klopt hij ook voor een kleur die vandaag nog niet bestaat. */
function opKleur(hex) {
  var h = String(hex == null ? '' : hex).trim().replace(/^#/, '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return '#0C0C0B';
  function k(v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
  var L = 0.2126 * k(parseInt(h.slice(0, 2), 16)) +
          0.7152 * k(parseInt(h.slice(2, 4), 16)) +
          0.0722 * k(parseInt(h.slice(4, 6), 16));
  return (1.05 / (L + 0.05)) >= ((L + 0.05) / 0.05) ? '#FFFFFF' : '#0C0C0B';
}

/* de sessie van de hulppas: lezen, actief en bewaren */
  var Sessie = {
    huidig: lees,
    actief: function () { var s = lees(); return !!(s && s.code && s.token); },
    zet: function (s) { localStorage.setItem(KEY, JSON.stringify(s)); },
    wisProfiel: function () { var s = lees(); if (s) { delete s.token; delete s.profiel; localStorage.setItem(KEY, JSON.stringify(s)); } },
    uitloggen: function () { localStorage.removeItem(KEY); },
    naam: function () { var s = lees(); return (s && s.profiel && s.profiel.naam) || ''; },
    /* De deur van de RTFoundation.

       Hier stond `location.href = 'index.html'`: wie zonder gezinssessie een
       app opende, werd zonder een woord naar de voorpagina gegooid. Dat is
       erger dan een dichte deur -- je verliest ook waar je heen wilde, en
       veertig apps voelden daardoor leeg. Nu blijft u staan waar u was en
       vertelt de gedeelde deur (shared/deur.js) wat deze app is, wat u er
       straks doet (uit de app-gids die de pagina al heeft) en hoe u
       binnenkomt. De weg terug staat in de deur zelf, dus niemand raakt
       opgesloten.

       De pagina's roepen dit aan als `if (!Sessie.eisProfiel()) throw ...`;
       die worp blijft staan en stopt de rest van de pagina zoals altijd. */
    deur: function (soort) {
      var doel = document.querySelector('main') || document.querySelector('[role="main"]') || document.body;
      function toon() {
        try { window.RTGDeur.toon(doel, { soort: soort || 'gezin' }); } catch (e) { location.href = 'index.html'; }
      }
      if (window.RTGDeur) return toon();
      // de deur wordt zelden gebruikt, dus pas laden als hij nodig is
      var s = document.createElement('script');
      s.src = '/shared/deur.js';
      s.onload = toon;
      s.onerror = function () { location.href = 'index.html'; };
      document.head.appendChild(s);
    },
    // gebruik boven aan een tool-pagina: geen sessie -> de deur, met de weg erin
    eisProfiel: function () {
      if (!Sessie.actief()) { Sessie.deur('gezin'); return false; }
      var s = lees();
      if (s && s.profiel && s.profiel.rol === 'kind' && s.profiel.leeftijdBevestigd === false) {
        toegangSlot('Een beheerder vult eerst je geboortedatum in. Daarna krijg je automatisch de juiste leeftijdspas.', false); return false;
      }
      return true;
    },
    // privezaken van het gezin: gasten (oppas/opa/oma/familie) zien de deur
    isGast: function () { var s = lees(); return !!(s && s.profiel && s.profiel.gast); },
    eisFamilie: function () { if (!Sessie.actief() || Sessie.isGast()) { Sessie.deur('gezin'); return false; } return true; },
    isBeheerder: function () { var s = lees(); return !!(s && s.profiel && s.profiel.beheerder); },
    // controleer bij de server of het token nog klopt; geeft { gezin, profiel, profielen, ongelezen } of null
    ophalen: function () {
      var s = lees(); if (!s || !s.code || !s.token) return Promise.resolve(null);
      return fetch('/api/foundation/gezin/' + s.code + '/mij', { headers: { Authorization: 'Bearer ' + s.token } })
        .then(function (r) { if (!r.ok) return null; return r.json(); })
        .then(function (d) { if (d && d.profiel) { s.profiel = d.profiel; Sessie.zet(s); } return d; })
        .catch(function () { return null; });
    },
    api: api,
    toegang: controleerToegang,
    // herbruikbare AI-coach-chat. opts: { kind, chat, input, knop, wacht }
    coach: function (opts) {
      var s = lees(); if (!s) return;
      var gesprek = [];
      var NM = { vrouw: 'Rahul', man: 'Rahul', nonbinair: 'Rahul' };
      function buddyKeuze() { try { return localStorage.getItem('rtf_buddy') || 'vrouw'; } catch (e) { return 'vrouw'; } }
      // de leeftijdsgroep stuurt taal en niveau van de AI; van het profiel, anders de app-ingang
      function groepVan() { try { return (s.profiel && s.profiel.groep) || document.documentElement.getAttribute('data-rtf-groep') || ''; } catch (e) { return ''; } }
      function esc2(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }
      function verstuur() {
        var t = (opts.input.value || '').trim(); if (!t) return;
        opts.input.value = '';
        opts.chat.insertAdjacentHTML('beforeend', '<div class="b ik">' + esc2(t) + '</div>');
        gesprek.push({ role: 'user', content: t });
        var w = document.createElement('div'); w.className = 'b ai'; w.textContent = opts.wacht || ((NM[buddyKeuze()] || 'Rahul') + ' denkt mee...');
        opts.chat.appendChild(w); opts.chat.scrollTop = opts.chat.scrollHeight;
        api('/hulp/ai', { code: s.code, token: s.token, kind: opts.kind, messages: gesprek, buddy: buddyKeuze(), groep: groepVan() })
          .then(function (d) { w.textContent = d.text; gesprek.push({ role: 'assistant', content: d.text }); opts.chat.scrollTop = opts.chat.scrollHeight; })
          .catch(function () { w.textContent = 'Sorry, dat lukte even niet. Probeer het zo nog eens.'; });
      }
      opts.knop.addEventListener('click', verstuur);
      opts.input.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); verstuur(); } });
    },
    // Balk bovenin met "ingelezen als", een belletje voor berichten en (voor de
    // beheerder) een knop naar Gezin beheren. plaats: een element om in te vullen.
    balk: function (el, opties) {
      opties = opties || {};
      var s = lees(); if (!s || !s.profiel) return;
      var p = s.profiel;
      var terug = opties.terug ? '<a class="sb-terug" href="' + opties.terug + '">' + (opties.terugTekst || '← Foundation') + '</a>' : '';
      el.innerHTML =
        '<div class="sb-balk">' +
        '<span class="sb-brand">Rahul Travel <b>Foundation</b></span>' + terug +
        '<span class="sb-safe"><i aria-hidden="true"></i>Veilig</span>' +
        '<button class="sb-bel" id="sbBel" title="Berichten van je gezin" aria-label="Berichten"><span data-glyf="berichten" aria-hidden="true"></span><span class="sb-tel" id="sbTel" hidden>0</span></button>' +
        '<button class="sb-prof" id="sbProf"><span class="sb-av" style="background:' + (p.kleur || '#164A98') + ';color:' + opKleur(p.kleur || '#164A98') + '">' + esc(String(p.naam || '?').slice(0, 1).toUpperCase()) + '</span><span class="sb-nm">' + esc(p.naam) + '</span></button>' +
        '</div>' +
        '<div class="sb-menu" id="sbMenu" hidden>' +
        (p.beheerder ? '<a href="beheer.html">Gezin beheren</a>' : '') +
        '<a href="index.html#profielen" id="sbWissel">Ander profiel</a>' +
        '<a href="#" id="sbUit">Gezin uitloggen</a>' +
        '</div>' +
        '<div class="sb-berichten" id="sbBerichten" hidden></div>';
      injectCss();
      /* De balk wordt NA het laden getekend, dus de vuller van glyf.js is al
         langsgeweest. Hier nog een keer, alleen over dit stukje DOM. */
      try { if (window.RTGGlyf) RTGGlyf.vul(el); } catch (e) {}
      var menu = el.querySelector('#sbMenu'), ber = el.querySelector('#sbBerichten');
      el.querySelector('#sbProf').onclick = function () { ber.hidden = true; menu.hidden = !menu.hidden; };
      el.querySelector('#sbWissel').onclick = function () { Sessie.wisProfiel(); };
      el.querySelector('#sbUit').onclick = function (e) { e.preventDefault(); if (confirm('Het hele gezin uitloggen op dit toestel?')) { Sessie.uitloggen(); location.href = 'index.html'; } };
      el.querySelector('#sbBel').onclick = function () { menu.hidden = true; ber.hidden = !ber.hidden; if (!ber.hidden) laadBerichten(el); };
