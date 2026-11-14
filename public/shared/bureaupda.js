/* DE BUREAU-PDA -- één scherm voor de drie ontwerpbureaus van de kantoren.

   WAT HIER IS SAMENGEVOEGD EN WAAROM. Er stonden drie apps: studio-pda (198
   regels), hardware-pda (199) en architect-pda (184). Na het normaliseren van
   de bureaunaam verschilden ze onderling 54 tot 73 regels -- en dat waren geen
   drie ontwerpen maar één ontwerp dat drie keer was gekopieerd en daarna uit
   elkaar gelopen:

     - de studio kreeg de nieuwe deelmenu-stijl voor de disciplinerij, de
       architect bleef op de oude pillen staan;
     - de studio nam elf kolommen mee bij het uitvoeren, de hardware zeven en
       de architect acht -- met verschillende namen voor hetzelfde;
     - de architect laadde /shared/deur.js in de kop, de andere twee in de body.

   Dat is precies wat LAT.md regel 4 beschrijft: dezelfde waarheid op drie
   plekken loopt uiteen, zeker en meestal zonder dat iets klaagt. Wie een van de
   drie verbeterde, verbeterde de andere twee niet.

   WAT WÉL PER BUREAU VERSCHILT staat hieronder als GEGEVEN, niet als code: de
   naam, de brief-hint, de twee velden die het concept samenvatten, en de
   kolommen van het register. Een vierde bureau is een regel in deze tabel.

   DE DRIE PADEN BLIJVEN BESTAAN. /apps/studio-pda.html en de andere twee zijn
   nog steeds echte apps met een eigen gids-ingang en een eigen deur; ze zijn
   alleen dun geworden. Er waren links naar (kantoren.html wijst er drie keer
   heen) en er staat een toets op hun deur (test/kantoordeuren.e2e.js), dus ze
   vervangen door een doorverwijzing zou werk kapotmaken om iets op te ruimen
   wat niemand stoorde. */
(function (w) {
  'use strict';
  if (w.RTGBureauPDA) return;

  /* De drie bureaus. `velden` zijn de twee eigenschappen waarmee dit vak een
     concept samenvat -- bij een voertuig zegt het silhouet en de aandrijving
     wat het is, bij een gebouw de typologie en de constructie. */
  var BUREAUS = {
    studio: {
      pad: 'studio', ey: 'RTG Ontwerpstudio', titel: 'Studio PDA',
      brief: 'Brief: sfeer, gebruik, aandrijving',
      velden: ['silhouet', 'aandrijving'],
      kolommen: ['naam', 'discipline', 'status', 'huis', 'collectie', 'silhouet', 'aandrijving', 'kleuren', 'kritiek', 'aangemaakt', 'bijgewerkt'],
      rij: function (o, c) {
        return [o.naam || '', o.disciplineLabel || o.discipline || '', o.status || '', o.huis || '', o.collectie || '',
          c.silhouet || '', c.aandrijving || '', (c.kleuren || []).map(function (k) { return k.naam; }).join(', '),
          o.kritiek || '', String(o.at || '').slice(0, 10), String(o.updatedAt || '').slice(0, 10)];
      }
    },
    hardware: {
      pad: 'hardware', ey: 'RTG Hardwarelab', titel: 'Hardware PDA',
      brief: 'Brief: gebruik, formaat, aansluitingen',
      velden: ['behuizing', 'chip'],
      kolommen: ['datum', 'naam', 'discipline', 'status', 'huis', 'behuizing', 'chip'],
      rij: function (o, c) {
        return [String(o.at || '').slice(0, 10), o.naam || '', o.disciplineLabel || o.discipline || '',
          o.status || '', o.huis || '', c.behuizing || '', c.chip || ''];
      }
    },
    architect: {
      pad: 'architect', ey: 'RTG Architectenbureau', titel: 'Architect PDA',
      brief: 'Brief: ligging, sfeer, gebruik',
      velden: ['typologie', 'constructie'],
      kolommen: ['naam', 'discipline', 'project', 'huis', 'status', 'typologie', 'constructie', 'aangemaakt'],
      rij: function (o, c) {
        return [o.naam || '', o.disciplineLabel || o.discipline || '', o.collectie || '', o.huis || '',
          o.status || '', c.typologie || '', c.constructie || '', String(o.at || '').slice(0, 10)];
      }
    }
  };

  var esc = function (t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  };

  w.RTGBureauPDA = { BUREAUS: BUREAUS, esc: esc };
})(window);
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
      m.textContent = t; m.classList.add('toon');
      clearTimeout(m._t); m._t = setTimeout(function () { m.classList.remove('toon'); }, 2400);
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
      }).catch(function (e) { $('#pLijst').innerHTML = '<div class="ds-meta">' + esc(e.message) + '</div>'; });
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
      return '<span class="ds-meta">' + esc(s) + '</span>';
    }
    function volgende(s) {
      var i = DATA.statussen.indexOf(s);
      return (i >= 0 && i < DATA.statussen.length - 1) ? DATA.statussen[i + 1] : null;
    }

    function render() {
      $('#pFilters').innerHTML = '<button class="chip ds-chip' + (filter === '' ? ' aan' : '') + '" aria-pressed="' + (filter === '' ? 'true' : 'false') + '" data-f="">Alle</button>' +
        DATA.disciplines.map(function (c) {
          return '<button class="chip ds-chip' + (filter === c.id ? ' aan' : '') + '" aria-pressed="' + (filter === c.id ? 'true' : 'false') + '" data-f="' + esc(c.id) + '">' +
            glyf(c.icon) + ' ' + esc(c.label) + (c.aantal ? ' (' + c.aantal + ')' : '') + '</button>';
        }).join('');
      $('#pFilters').querySelectorAll('.chip').forEach(function (b) {
        b.addEventListener('click', function () { filter = b.dataset.f; render(); });
      });

      var lijst = DATA.ontwerpen.filter(function (o) { return !filter || o.discipline === filter; });
      $('#pLijst').innerHTML = lijst.length ? lijst.map(function (o) {
        var c = o.concept, nx = volgende(o.status);
        return '<div class="ds-sectie">' +
          '<div class="ds-handelingen">' +
            '<h2 class="ds-titel ds-titel--scherm">' + glyf(o.icon) + ' ' + esc(o.naam) + '</h2>' + statusPil(o.status) + '</div>' +
          '<div class="ds-meta">' +
            esc(o.disciplineLabel) + (o.huis ? ' · ' + esc(o.huis) : '') + '</div>' +
          (c
            ? (c.kleuren && c.kleuren.length ? '<div class="ds-handelingen">' +
                c.kleuren.map(function (k) { return '<svg width="16" height="16" viewBox="0 0 16 16" role="img" aria-label="' + esc(k.naam) + '"><title>' + esc(k.naam) + '</title><circle cx="8" cy="8" r="7" fill="' + esc(k.hex) + '"/></svg>'; }).join('') + '</div>' : '') +
              '<div class="ds-meta"><b>' + esc(c[B.velden[0]]) + '</b> · ' + esc(c[B.velden[1]]) + '</div>'
            : '<div class="ds-meta">Nog geen concept.</div>') +
          (o.kritiek ? '<div class="ds-sectie ds-sectie--open">' + esc(o.kritiek) + '</div>' : '') +
          '<div class="ds-handelingen">' +
            '<button class="ds-knop ds-knop--stil" data-concept="' + esc(o.id) + '">' + (c ? 'Herteken' : 'Teken') + '</button>' +
            '<button class="ds-knop ds-knop--stil" data-kritiek="' + esc(o.id) + '">Kritiek</button>' +
            (nx ? '<button class="ds-knop" data-next="' + esc(o.id) + '" data-s="' + esc(nx) + '">→ ' + esc(nx) + '</button>' : '') +
          '</div></div>';
      }).join('') : '<div class="ds-meta">Geen concepten in deze discipline.</div>';
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
