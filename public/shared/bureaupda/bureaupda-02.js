/* De bureau-PDA, deel 2: de werking.

   Dit is de code die drie keer bestond. Hij doet vijf dingen, en alle drie de
   bureaus deden ze al identiek: het register laden, de disciplinerij tekenen,
   een concept aanmaken, de AI het laten uittekenen of erop laten schieten, en
   de status een stap verder zetten.

   DE DEUR STAAT OP DE APP ZELF en stuurt niet weg. Wie hier uitgelogd komt,
   verloor met een location.replace() waar hij heen wilde: je landde op de
   personeels-app zonder te zien welke app je had geopend (TAKEN 5.5). En de
   deur tekent op de VOLGENDE tick, want hij vervangt #main terwijl dit script
   daarna nog listeners bindt -- dat gaf eerder een reeks "Cannot read
   properties of null". */
(function (w, d) {
  'use strict';
  var Z = w.RTGBureauPDA;
  if (!Z || Z.start) return;
  var esc = Z.esc;

  Z.start = function (bureauId) {
    var B = Z.BUREAUS[bureauId];
    if (!B) return;
    var st = d.createElement('style'); st.textContent = Z.CSS;
    (d.head || d.documentElement).appendChild(st);

    var $ = function (s) { return d.querySelector(s); };
    var TOKEN = null;
    try { TOKEN = localStorage.getItem('rtg_office_token'); } catch (e) {}

    function uitgelogd() {
      var naar = '/apps/personeel.html?kantoor=1&terug=' + encodeURIComponent(location.pathname);
      if (!w.RTGDeur) { location.replace(naar); return; }
      setTimeout(function () {
        var el = d.getElementById('main') || d.body;
        w.RTGDeur.toon(el, { soort: 'personeel', naar: naar });
      }, 0);
    }
    if (!TOKEN) uitgelogd();

    var api = function (pad, body) {
      return fetch('/api/office/' + pad, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + TOKEN },
        body: JSON.stringify(body || {})
      }).then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (x) {
          if (!r.ok) { if (r.status === 401) uitgelogd(); throw new Error(x.error || 'Er ging iets mis.'); }
          return x;
        });
      });
    };
    function meld(t) {
      var m = $('#melding'); if (!m) return;
      m.textContent = t; m.style.opacity = '1';
      clearTimeout(m._t); m._t = setTimeout(function () { m.style.opacity = '0'; }, 2400);
    }

    var DATA = null, filter = '';
    function glyf(n) { return w.RTGGlyf ? w.RTGGlyf.tekst(n) : ''; }

    function laad() {
      return api(B.pad).then(function (x) {
        DATA = x;
        var sel = $('#pCat');
        if (sel && !sel.options.length) {
          sel.innerHTML = DATA.disciplines.map(function (c) {
            return '<option value="' + esc(c.id) + '">' + esc(c.label) + '</option>';
          }).join('');
        }
        render();
      }).catch(function (e) { $('#pLijst').innerHTML = '<div class="leeg">' + esc(e.message) + '</div>'; });
    }

    /* Meenemen (shared/uitvoer.js): het register uit het eigen model, veld voor
       veld -- niet de kaarttekst van het scherm. De discipline volgt het actieve
       filter, zodat u meeneemt wat u ziet. Welke kolommen dat zijn, staat per
       bureau in de tabel van deel 1. */
    if (w.RTGUitvoer) w.RTGUitvoer.bron(function () {
      if (!DATA || !DATA.ontwerpen) return null;
      var lijst = DATA.ontwerpen.filter(function (o) { return !filter || o.discipline === filter; });
      return { naam: 'ontwerpen', kolommen: B.kolommen,
        rijen: lijst.map(function (o) { return B.rij(o, o.concept || {}); }) };
    });

    function statusPil(s) {
      var g = s === 'productie' ? 'var(--gold)' : (s === 'archief' ? 'var(--muted)' : 'var(--txt)');
      return '<span class="pil" style="color:' + g + ';">' + esc(s) + '</span>';
    }
    function volgende(s) {
      var i = DATA.statussen.indexOf(s);
      return (i >= 0 && i < DATA.statussen.length - 1) ? DATA.statussen[i + 1] : null;
    }

    function render() {
      $('#pFilters').innerHTML = '<button class="chip' + (filter === '' ? ' aan' : '') + '" data-f="">Alle</button>' +
        DATA.disciplines.map(function (c) {
          return '<button class="chip' + (filter === c.id ? ' aan' : '') + '" data-f="' + esc(c.id) + '">' +
            glyf(c.icon) + ' ' + esc(c.label) + (c.aantal ? ' (' + c.aantal + ')' : '') + '</button>';
        }).join('');
      $('#pFilters').querySelectorAll('.chip').forEach(function (b) {
        b.addEventListener('click', function () { filter = b.dataset.f; render(); });
      });

      var lijst = DATA.ontwerpen.filter(function (o) { return !filter || o.discipline === filter; });
      $('#pLijst').innerHTML = lijst.length ? lijst.map(function (o) {
        var c = o.concept, nx = volgende(o.status);
        return '<div class="kaart" style="margin-bottom:.7rem;">' +
          '<div class="rij" style="justify-content:space-between;">' +
            '<h2 style="font-size:1.02rem;">' + glyf(o.icon) + ' ' + esc(o.naam) + '</h2>' + statusPil(o.status) + '</div>' +
          '<div style="font-size:.72rem;color:var(--muted);margin-bottom:.4rem;">' +
            esc(o.disciplineLabel) + (o.huis ? ' · ' + esc(o.huis) : '') + '</div>' +
          (c
            ? (c.kleuren && c.kleuren.length ? '<div class="rij" style="margin-bottom:.4rem;">' +
                c.kleuren.map(function (k) { return '<span class="bp-swatch" title="' + esc(k.naam) + '" style="background:' + esc(k.hex) + ';"></span>'; }).join('') + '</div>' : '') +
              '<div style="font-size:.82rem;line-height:1.55;"><b>' + esc(c[B.velden[0]]) + '</b> · ' + esc(c[B.velden[1]]) + '</div>'
            : '<div class="leeg">Nog geen concept.</div>') +
          (o.kritiek ? '<div style="margin-top:.45rem;border-left:2px solid var(--gold);padding-left:.6rem;font-size:.8rem;line-height:1.5;">' + esc(o.kritiek) + '</div>' : '') +
          '<div class="rij h-mt60">' +
            '<button class="knop stil" data-concept="' + esc(o.id) + '">' + (c ? 'Herteken' : 'Teken') + '</button>' +
            '<button class="knop stil" data-kritiek="' + esc(o.id) + '">Kritiek</button>' +
            (nx ? '<button class="knop" data-next="' + esc(o.id) + '" data-s="' + esc(nx) + '" style="margin-left:auto;">→ ' + esc(nx) + '</button>' : '') +
          '</div></div>';
      }).join('') : '<div class="leeg">Geen concepten in deze discipline.</div>';
      bind();
    }

    function vervang(o) {
      var i = DATA.ontwerpen.findIndex(function (x) { return x.id === o.id; });
      if (i >= 0) DATA.ontwerpen[i] = o;
      render();
    }

    function bind() {
      var doe = function (sel, pad, bezig) {
        d.querySelectorAll(sel).forEach(function (b) {
          b.addEventListener('click', function () {
            var id = b.dataset.concept || b.dataset.kritiek;
            b.disabled = true; b.textContent = bezig;
            api(B.pad + '/' + pad, { id: id })
              .then(function (r) { vervang(r.ontwerp); })
              .catch(function (e) { meld(e.message); b.disabled = false; });
          });
        });
      };
      doe('[data-concept]', 'concept', 'Tekent...');
      doe('[data-kritiek]', 'kritiek', '...');
      d.querySelectorAll('[data-next]').forEach(function (b) {
        b.addEventListener('click', function () {
          api(B.pad + '/zet', { id: b.dataset.next, status: b.dataset.s })
            .then(function (r) { vervang(r.ontwerp); meld('Naar ' + b.dataset.s); })
            .catch(function (e) { meld(e.message); });
        });
      });
    }

    var maak = $('#pMaak');
    if (maak) maak.addEventListener('click', function () {
      var naam = $('#pNaam').value.trim();
      if (!naam) { meld('Geef het concept een naam.'); return; }
      api(B.pad + '/maak', { discipline: $('#pCat').value, naam: naam, brief: $('#pBrief').value.trim() })
        .then(function (r) {
          $('#pNaam').value = ''; $('#pBrief').value = '';
          DATA.ontwerpen.unshift(r.ontwerp);
          meld('Concept aangemaakt; de chef tekent het uit.');
          return api(B.pad + '/concept', { id: r.ontwerp.id })
            .then(function (x) { vervang(x.ontwerp); }, function () { render(); });
        })
        .catch(function (e) { meld(e.message); });
    });

    /* Zonder kantoorsessie staat de deur er al; doorstarten levert alleen
       401-en op die de poort weer zouden overschrijven. */
    if (TOKEN) laad();
  };
})(window, document);
