/* RTF Living Lab, scherm deel 1: de app-kern. De labkeuze, de vragen uit de
   buurt, de lijst met onderzoeken, de pijplijn en de impactcijfers.

   HET KADER KOMT VAN DE SERVER (/api/lab2/kader) en wordt hier nergens
   nagebouwd. De cyclus, de soorten, de methoden en de bewijsgraden staan in
   server/kern/livinglab/kader.js, en dit scherm bouwt zijn keuzelijsten daaruit.
   Zou het scherm zijn eigen lijstje hebben, dan biedt het vroeg of laat een stap
   of een methode aan die de server weigert -- en dat is regel 4 van de lat, in
   de vorm waarin hij het vervelendst is: de gebruiker krijgt de schuld.

   Deel 2 (livinglab-studie.js) tekent het dossier van één onderzoek. */
(function () {
  'use strict';
  var TOKEN = null, KADER = null, LAB = null, LABS = [], FILTER = '', STUDIES = [];

  var $ = function (s) { return document.querySelector(s); };
  var B = null;   // het tekenwerk (livinglab-beeld.js), gezet bij het starten
  var esc = function (t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  function uitgelogd() {
    var naar = '/apps/personeel.html?kantoor=1&terug=' + encodeURIComponent(location.pathname);
    if (!window.RTGDeur) { location.replace(naar); return; }
    setTimeout(function () {
      RTGDeur.toon(document.getElementById('main') || document.body, { soort: 'personeel', naar: naar });
    }, 0);
  }

  /* Eén weg naar de server, met één foutafhandeling. De melding van de server
     wordt ONGEWIJZIGD doorgegeven: die is met zorg geschreven (hij zegt wat er
     ontbreekt en waarom), en er een eigen "er ging iets mis" overheen leggen
     gooit precies de uitleg weg waar een onderzoeker iets aan heeft. */
  function api(pad, body) {
    return fetch('/api/lab2/' + pad, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + TOKEN },
      body: JSON.stringify(body || {})
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) {
        if (!r.ok) { if (r.status === 401) uitgelogd(); throw new Error(d.error || 'Er ging iets mis.'); }
        return d;
      });
    });
  }

  var meld = function (t) { if (window.RTGWauw && RTGWauw.melding) RTGWauw.melding(t); else alert(t); };

  /* ---------- de onderzoeksroute ----------
     De tien stappen als pad. `stap` is waar de studie nu staat; alles ervoor is
     afgelegd. Dit is dezelfde volgorde als de server hanteert, want hij komt
     uit hetzelfde kader. */
  function route(huidig) {
    var ix = KADER.cyclus.map(function (c) { return c.stap; }).indexOf(huidig);
    return '<div class="route">' + KADER.cyclus.map(function (c, i) {
      var kl = i < ix ? ' af' : (i === ix ? ' nu' : '');
      return '<div class="stap' + kl + '">' +
        '<span class="bol">' + (i < ix ? '&#10003;' : (i + 1)) + '</span>' +
        '<span class="nm">' + esc(c.naam) + '</span>' +
        (i < KADER.cyclus.length - 1 ? '<span class="lijn"></span>' : '') + '</div>';
    }).join('') + '</div>';
  }

  // het lab zoals het nu gekozen is; de ethiek- en beheerschermen lezen hier
  // de tekenbevoegden uit, want zonder die lijst kan er niets ondertekend worden
  function huidigLab() { return LABS.filter(function (l) { return l.id === LAB; })[0] || null; }

  function soortNaam(s) {
    var x = KADER.soorten.filter(function (y) { return y.soort === s; })[0];
    return x ? x.naam : s;
  }

  /* ---------- laden ---------- */
  function laadLabs() {
    return api('labs').then(function (d) {
      LABS = d.labs || [];
      $('#labKies').innerHTML = LABS.map(function (l) {
        return '<option value="' + esc(l.id) + '">' + esc(l.stad) + ' &middot; ' + esc(l.naam) + '</option>';
      }).join('') || '<option value="">nog geen lab</option>';
      if (!LAB || !LABS.filter(function (l) { return l.id === LAB; }).length) LAB = LABS.length ? LABS[0].id : null;
      if (LAB) $('#labKies').value = LAB;
    });
  }

  function laad() {
    if (!LAB) {
      $('#lijst').innerHTML = '<div class="leeg">Er is nog geen Living Lab. Maak er een aan voor de stad waar u begint.</div>';
      $('#kpi').innerHTML = ''; $('#themas').innerHTML = ''; $('#pijplijn').innerHTML = ''; $('#impact').innerHTML = '';
      $('#beheer').innerHTML = '<div class="leeg">Kies of maak eerst een lab.</div>';
      $('#apparatuur').innerHTML = ''; $('#agenda').innerHTML = '';
      return Promise.resolve();
    }
    return Promise.all([
      api('overzicht', { id: LAB }),
      api('themas', { id: LAB }),
      api('uit/pijplijn', { id: LAB }),
      api('impact', { id: LAB })
    ]).then(function (r) {
      STUDIES = r[0].studies || [];
      B.tekenFilters(r[0].perSoort);
      B.tekenLijst(STUDIES, FILTER);
      B.tekenThemas(r[1].themas || []);
      B.tekenPijplijn(r[2]);
      B.tekenImpact(r[3]);
      window.LivingLabBeheer.teken($('#beheer'));
      window.LivingLabApparatuur.teken($('#apparatuur'));
      window.LivingLabWerkplaats.agenda($('#agenda'), LAB);
    }).catch(function (e) { $('#lijst').innerHTML = '<div class="leeg">' + esc(e.message) + '</div>'; });
  }

  /* ---------- starten ---------- */
  function start(token) {
    TOKEN = token;
    api('kader').then(function (k) {
      KADER = k;
      $('#nSoort').innerHTML = KADER.soorten.map(function (s) {
        return '<option value="' + esc(s.soort) + '">' + esc(s.naam) + '</option>';
      }).join('');
      $('#nUitleg').textContent = 'De keten: ' + KADER.cyclus.map(function (c) { return c.naam.toLowerCase(); }).join(' → ') +
        '. Elke stap heeft een poort; het systeem zegt per stap wat er nog ontbreekt.';
      B = window.LivingLabBeeld;
      B.init({ api: api, kader: KADER, esc: esc, meld: meld, route: route,
        soortNaam: soortNaam, herteken: function () { B.tekenLijst(STUDIES, FILTER); },
        zetFilter: function (f) { FILTER = f; }, filter: function () { return FILTER; } });
      window.LivingLabStudie.init({ api: api, kader: KADER, esc: esc, meld: meld, route: route,
        herlaad: laad, huidigLab: huidigLab });
      window.LivingLabBeheer.init({ api: api, kader: KADER, esc: esc, meld: meld,
        huidigLab: huidigLab, herlaad: laadLabs });
      window.LivingLabApparatuur.init({ api: api, kader: KADER, esc: esc, meld: meld,
        huidigLab: huidigLab, herlaad: laadLabs });
      window.LivingLabWerkplaats.init({ api: api, esc: esc, meld: meld });
      return laadLabs();
    }).then(laad).catch(function (e) {
      $('#lijst').innerHTML = '<div class="leeg">' + esc(e.message) + '</div>';
    });

    $('#labKies').addEventListener('change', function () { LAB = $('#labKies').value; laad(); });
    $('#labNieuw').addEventListener('click', function () {
      var stad = prompt('In welke stad komt dit Living Lab?');
      if (!stad) return;
      api('lab/maak', { stad: stad, naam: 'Living Lab ' + stad })
        .then(function (r) { LAB = r.lab.id; meld('Lab aangemaakt.'); return laadLabs(); })
        .then(laad).catch(function (e) { meld(e.message); });
    });
    $('#nMaak').addEventListener('click', function () {
      var thema = $('#nTitel').dataset.thema || '';
      api('studie/maak', { labId: LAB, titel: $('#nTitel').value, soort: $('#nSoort').value, vraagstuk: $('#nVraag').value })
        .then(function (r) {
          if (thema) return api('thema/koppel', { themaId: thema, studieId: r.studie.id }).then(function () { return r; });
          return r;
        })
        .then(function (r) {
          $('#nTitel').value = ''; $('#nVraag').value = ''; delete $('#nTitel').dataset.thema;
          meld('Het onderzoek staat bij de eerste stap: het vraagstuk.');
          laad().then(function () { window.LivingLabStudie.open(r.studie.id); });
        }).catch(function (e) { meld(e.message); });
    });
  }

  window.LivingLab = { start: start };
})();
