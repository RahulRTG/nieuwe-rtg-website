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

  /* De stijl die de studio al had en de andere twee misten: de disciplinerij
     als rustige balk met een gouden streep onder de actieve, in plaats van
     pillen. De `.chips >`-voorvoegsels zijn nodig omdat de gedeelde pilrij in
     rtg-ui.css als `body.rtg-stijl .chips > button` staat en dus zwaarder
     weegt dan een kale `.chip` -- zonder dat voorvoegsel stond deze regel er
     wel maar deed hij niets. Gemeten in de browser, niet gehoopt. */
  var CSS =
    'body.rtg-stijl .chips{display:flex;gap:.15rem;overflow-x:auto;margin:0 0 .2rem;padding:0 0 .1rem;' +
      'border-bottom:1px solid var(--line);scrollbar-width:none;}' +
    'body.rtg-stijl .chips::-webkit-scrollbar{display:none;}' +
    'body.rtg-stijl .chips > .chip{white-space:nowrap;background:none;border:0;border-bottom:2px solid transparent;' +
      'border-radius:0;margin-bottom:-1px;padding:.55rem .8rem .6rem;font-family:\'Inter\',system-ui,sans-serif;' +
      'font-size:.72rem;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);cursor:pointer;}' +
    'body.rtg-stijl .chips > .chip:hover{color:var(--txt);border-bottom-color:transparent;}' +
    'body.rtg-stijl .chips > .chip.aan{background:none;color:var(--txt);border-bottom-color:var(--gold);}' +
    '.bp-swatch{width:1rem;height:1rem;border-radius:50%;border:1px solid var(--line);display:inline-block;}';

  w.RTGBureauPDA = { BUREAUS: BUREAUS, esc: esc, CSS: CSS };
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
          '<div class="rij" style="margin-top:.6rem;">' +
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
