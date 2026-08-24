/* RTG Command, deel 1: de schil.

   ÉÉN APP, TWAALF WERKPLEKKEN, ÉÉN OBJECTMODEL. Dit deel doet de inlog (via het
   gedeelde kantoorgesprek, niet een eigen codeveld), de rail, het schakelen
   tussen werkplekken en de gedeelde hulpjes die de andere delen gebruiken.

   DE WERKPLEKKEN ZIJN GEEN APPS. Ze delen dezelfde staat, dezelfde zoekbalk en
   hetzelfde journaal; wat je in de ene doet, zie je in de andere terug zonder
   te herladen. Dat is het verschil tussen één app en tien schermen achter één
   menu -- en het is precies waarom de puls na elke ingreep opnieuw wordt
   opgehaald in plaats van dat elk scherm zijn eigen kopie bijhoudt. */
(function () {
  'use strict';

  var $ = function (s) { return document.querySelector(s); };
  var esc = function (t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  };
  var TOKEN = null;
  try { TOKEN = localStorage.getItem('rtg_office_token'); } catch (e) {}

  function meld(t) {
    var m = $('#melding'); m.textContent = t; m.style.opacity = '1';
    clearTimeout(m._t); m._t = setTimeout(function () { m.style.opacity = '0'; }, 3200);
  }

  /* Eén api-functie voor de hele app. Een 401 is geen fout maar een
     toestand: de sessie is weg, dus terug naar het gesprek. */
  function api(pad, body) {
    return fetch('/api/command/' + pad, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + TOKEN },
      body: JSON.stringify(body || {})
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) {
        if (r.status === 401) { TOKEN = null; inlog(); var e0 = new Error('sessie'); e0.stil = true; throw e0; }
        if (!r.ok) { var e = new Error(d.error || 'Er ging iets mis.'); e.status = r.status; e.data = d; throw e; }
        return d;
      });
    });
  }

  /* De gedeelde staat. Eén object, want tien werkplekken die elk hun eigen
     kopie van de puls bijhouden, lopen binnen een dag uiteen. */
  var S = { puls: null, start: null, werkplek: 'puls', zoekterm: '', zoek: null, object: null, plan: null };

  var NIVEAUNAAM = { auto: 'autonoom', assist: 'assisted', hand: 'handmatig' };
  function niveau(n) {
    return '<span class="cniveau ' + esc(n) + '">' + esc(NIVEAUNAAM[n] || n) + '</span>';
  }
  var MND = ['', 'jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
  function tijd(s) {
    if (!s) return '';
    var d = new Date(s);
    if (isNaN(d)) return String(s).slice(0, 16);
    return d.getDate() + ' ' + MND[d.getMonth() + 1] + ' ' + d.getHours() + ':' + String(d.getMinutes()).padStart(2, '0');
  }
  function getal(n) { return (n == null ? '-' : String(n)); }
  function euro(centen) { return '€ ' + (Number(centen || 0) / 100).toLocaleString('nl-NL'); }

  /* De werkplekken. De volgorde is de volgorde van een werkdag: eerst zien wat
     er is, dan zoeken, dan vragen, dan afhandelen, dan herstellen, en pas
     daarna besturen. De laatste twee (werk, journaal) zijn de spiegels. */
  var WERKPLEKKEN = [
    { id: 'puls', naam: 'Command Center', sec: 'Zien', teller: function (s) { return s.puls ? s.puls.domeinen.filter(function (d) { return d.stand !== 'in orde' && d.stand !== 'leeg'; }).length : 0; } },
    /* De teller telt storingen EN wat opnieuw moet worden vastgesteld, en niet
       wat "niet vast te stellen" is. Dat laatste is op een verse installatie
       bijna alles, en een rail die dan permanent op elf staat, wordt genegeerd
       -- terwijl vervallen bewijs juist iets is dat iemand kan wegwerken. */
    { id: 'gezondheid', naam: 'Gezondheid', sec: 'Zien', teller: function (s) {
      var g = s.start && s.start.gezondheid; if (!g || !g.tel) return 0;
      return g.tel.storing + g.tel.moetOpnieuw; } },
    { id: 'zoek', naam: 'Zoek alles', sec: 'Zien' },
    { id: 'operator', naam: 'Operator', sec: 'Doen' },
    { id: 'zaken', naam: 'Uitzonderingen', sec: 'Doen', teller: function (s) { return s.puls ? s.puls.zaken.open : 0; } },
    { id: 'herstel', naam: 'Herstel', sec: 'Doen', teller: function (s) { return s.puls ? s.puls.herstel.kandidaten : 0; } },
    { id: 'beleid', naam: 'Beleid', sec: 'Besturen', teller: function (s) { return s.puls ? s.puls.beleid.voorstellenOpen : 0; } },
    { id: 'simulatie', naam: 'Simulatie', sec: 'Besturen' },
    { id: 'toezicht', naam: 'Toezicht', sec: 'Besturen', teller: function (s) { return s.puls ? s.puls.agents.gestopt : 0; } },
    { id: 'werk', naam: 'Werkbesparing', sec: 'Spiegel' },
    { id: 'journaal', naam: 'Journaal', sec: 'Spiegel' },
    { id: 'werkplek', naam: 'De werkplek', sec: 'Spiegel' }
  ];

  var TEKENAARS = {};   // de delen hierna hangen hun tekenfunctie hier op

  function railTeken() {
    var uit = '', sec = '';
    for (var i = 0; i < WERKPLEKKEN.length; i++) {
      var w = WERKPLEKKEN[i];
      if (w.sec !== sec) { sec = w.sec; uit += '<div class="csec">' + esc(sec) + '</div>'; }
      var t = w.teller ? w.teller(S) : 0;
      uit += '<button data-w="' + esc(w.id) + '"' + (S.werkplek === w.id ? ' aria-current="page"' : '') + '>' +
        esc(w.naam) + (t ? '<span class="tel' + (w.id === 'puls' || w.id === 'zaken' ? ' op' : '') + '">' + t + '</span>' : '') +
        '</button>';
    }
    $('#rail').innerHTML = uit;
    $('#rail').querySelectorAll('[data-w]').forEach(function (b) {
      b.onclick = function () { ga(b.dataset.w); };
    });
  }

  function standTeken() {
    var el = $('#stand');
    if (!S.puls) { el.className = 'stand'; el.innerHTML = '<i></i><span>laden…</span>'; return; }
    var k = S.puls.stand === 'storing' ? 'storing' : S.puls.stand === 'let op' ? 'let' : S.puls.stand === 'leeg' ? 'leeg' : '';
    el.className = 'stand ' + k;
    el.innerHTML = '<i></i><span>' + esc(S.puls.stand) + ' · ' + S.puls.zaken.open + ' open</span>';
  }

  function ga(id) {
    S.werkplek = id;
    try { history.replaceState(null, '', '#' + id); } catch (e) {}
    railTeken();
    teken();
  }

  function teken() {
    var f = TEKENAARS[S.werkplek];
    if (!f) { $('#main').innerHTML = '<div class="leeg">Die werkplek bestaat niet.</div>'; return; }
    try { f($('#main')); }
    catch (e) { $('#main').innerHTML = '<div class="leeg">Deze werkplek kon niet worden getekend: ' + esc(e.message) + '</div>'; }
  }

  /* Na elke ingreep: de puls opnieuw, want een teller in de rail die niet
     meebeweegt met wat je net deed, is een teller die je niet gelooft. */
  function ververs() {
    return api('start').then(function (d) {
      S.start = d; S.puls = d.puls;
      standTeken(); railTeken();
      return d;
    });
  }

  function inlog() {
    $('#rail').innerHTML = '';
    $('#main').innerHTML = '<div id="lGesprek"></div>';
    window.RTGKantoorGesprek.toon($('#lGesprek'), function (token) {
      TOKEN = token;
      try { localStorage.setItem('rtg_office_token', TOKEN); } catch (e) {}
      begin();
    });
  }

  function begin() {
    var hash = (location.hash || '').replace('#', '');
    if (hash && WERKPLEKKEN.some(function (w) { return w.id === hash; })) S.werkplek = hash;
    ververs().then(function () { railTeken(); teken(); }).catch(function (e) {
      if (e && e.stil) return;
      $('#main').innerHTML = '<div class="leeg">Command kon niet laden: ' + esc(e.message) + '</div>';
    });
  }

  /* De zoekbalk staat in de kop en werkt vanuit elke werkplek: typen en enter
     brengt je naar de zoekwerkplek. Dat is de belofte "één zoekbalk voor
     letterlijk alles" -- hij hoort dus niet in één scherm te wonen. */
  $('#q').addEventListener('keydown', function (e) {
    if (e.key !== 'Enter') return;
    S.zoekterm = $('#q').value;
    if (S.werkplek !== 'zoek') ga('zoek'); else teken();
  });

  window.RTGCommand = { $: $, esc: esc, api: api, meld: meld, S: S, ga: ga, teken: teken,
    ververs: ververs, niveau: niveau, tijd: tijd, getal: getal, euro: euro,
    TEKENAARS: TEKENAARS, WERKPLEKKEN: WERKPLEKKEN, railTeken: railTeken };

  window.addEventListener('DOMContentLoaded', function () {
    if (TOKEN) begin(); else inlog();
  });
})();
