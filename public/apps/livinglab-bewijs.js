/* RTF Living Lab, scherm deel 6: het bewijs onder een conclusie.

   Ook dit stond in de server helemaal klaar en was in het scherm onbereikbaar:
   bronnen natrekken, datasets vastleggen, bewijs onder een conclusie hangen en
   de graad laten tekenen. Zonder deze blokken bleef elke conclusie een aanname.
   De uitgangen naar echte verandering staan in ./livinglab-uitgang.js.

   DE GRAAD IS GEEN KEUZELIJST DIE ALLES AANBIEDT. Het scherm vraagt de server
   wat een conclusie op dit moment KAN dragen en toont de rest als wat het is:
   niet haalbaar, met de reden erbij. Een menu waarin "bewezen" altijd
   klikbaar is, leert een onderzoeker dat de graad een mening is. */
(function () {
  'use strict';
  var api, KADER, esc, meld, huidigLab;

  function init(o) { api = o.api; KADER = o.kader; esc = o.esc; meld = o.meld; huidigLab = o.huidigLab; }

  var graadVan = function (g) { return KADER.bewijs.filter(function (b) { return b.graad === g; })[0] || {}; };
  function tekenaarKeuze() {
    var lab = huidigLab() || {};
    if (!(lab.tekenaars || []).length) return null;
    return lab.tekenaars.map(function (t) {
      return '<option value="' + esc(t.naam) + '">' + esc(t.naam) + ' (' + esc(t.rol) + ')</option>';
    }).join('');
  }

  /* ---------- bronnen en datasets ---------- */
  function materiaalBlok(s) {
    var br = s.bronnen || [], ds = s.datasets || [];
    return '<div class="kaart"><div class="sec">Bronnen en datasets</div>' +
      (br.length ? br.map(function (b) {
        return '<div class="log" data-bron="' + esc(b.id) + '"><b>' + esc(b.titel) + '</b>' +
          (b.herkomst ? ' &middot; ' + esc(b.herkomst) : '') + '<br>' +
          (b.nagetrokken
            ? '<span class="pil ok">nagetrokken door ' + esc(b.door || '?') + '</span>'
            : '<span class="pil let">nog niet nagetrokken</span> ' +
              '<input class="veld" data-bndoor placeholder="Uw naam" style="max-width:9rem;font-size:.75rem;padding:.2rem .4rem;">' +
              '<button class="knop stil" data-bnzet type="button" style="font-size:.7rem;padding:.15rem .5rem;">Nagetrokken</button>') +
          '</div>';
      }).join('') : '<div class="leeg">Nog geen bronnen. Een bron die niemand heeft nagetrokken, draagt hier geen conclusie.</div>') +
      '<div class="rij h-mt35">' +
        '<input class="veld" data-brtitel placeholder="Bron: titel" maxlength="200">' +
        '<input class="veld" data-brherkomst placeholder="Herkomst" maxlength="200" style="max-width:11rem;">' +
        '<button class="knop stil" data-brzet type="button">Voeg bron toe</button></div>' +

      '<div class="sec h-mt90">Datasets</div>' +
      (ds.length ? ds.map(function (d) {
        return '<div class="log"><b>' + esc(d.naam) + '</b> &middot; ' + d.rijen + ' rijen' +
          (d.herkomst ? ' &middot; ' + esc(d.herkomst) : '') + '</div>';
      }).join('') : '<div class="leeg">Nog geen datasets.</div>') +
      '<div class="rij h-mt35">' +
        '<input class="veld" data-dsnaam placeholder="Dataset: naam" maxlength="120">' +
        '<input class="veld" data-dsrijen type="number" min="0" placeholder="rijen" style="max-width:7rem;">' +
        '<button class="knop stil" data-dszet type="button">Voeg dataset toe</button></div></div>';
  }

  /* ---------- conclusies: bewijs eronder, en de graad ----------
     De rij draagt `data-crij` en niet `data-conc`: dat laatste is in
     ./livinglab-vormen.js het INVOERVELD waarmee je een conclusie toevoegt.
     Twee betekenissen onder één naam in hetzelfde blad is regel 4 in het klein
     -- het brak niets, maar een selector die het verkeerde element pakt, is een
     fout die pas opvalt als iemand hem toevallig andersom leest. */
  function conclusieBlok(s) {
    var cs = s.conclusies || [];
    if (!cs.length) return '';
    var tek = tekenaarKeuze();
    var opties = function () {
      // alles wat in dit dossier als drager aan te wijzen is
      var uit = '';
      (s.bronnen || []).filter(function (b) { return b.nagetrokken; })
        .forEach(function (b) { uit += '<option value="bron:' + esc(b.id) + '">bron: ' + esc(b.titel).slice(0, 40) + '</option>'; });
      (s.datasets || []).forEach(function (d) { uit += '<option value="dataset:' + esc(d.id) + '">dataset: ' + esc(d.naam).slice(0, 40) + '</option>'; });
      (s.observaties || []).slice(0, 40).forEach(function (o) { uit += '<option value="observatie:' + esc(o.id) + '">observatie: ' + esc(o.wat).slice(0, 40) + '</option>'; });
      return uit;
    };
    return '<div class="kaart"><div class="sec">Conclusies: het bewijs eronder</div>' +
      cs.map(function (c) {
        var g = graadVan(c.graad);
        return '<div class="log" data-crij="' + esc(c.id) + '"><b>' + esc(c.tekst) + '</b><br>' +
          '<span class="graad g' + (g.rang || 0) + '">' + esc(g.naam || c.graad) + '</span> &middot; ' +
          (c.bewijs || []).length + ' drager(s)' +
          (c.tekenaar ? ' &middot; getekend door ' + esc(c.tekenaar.naam) : '') +
          ((c.bewijs || []).length
            ? '<br>' + c.bewijs.map(function (w) { return esc(w.soort) + (w.notitie ? ' (' + esc(w.notitie) + ')' : ''); }).join(', ')
            : '') +
          '<div class="rij h-mt30">' +
            '<select class="veld" data-bsoort aria-label="Bewijs kiezen" style="font-size:.78rem;">' +
              '<option value="">-- kies een drager uit dit dossier --</option>' + opties() +
              '<option value="interview:">interview (beschrijf hieronder)</option>' +
              '<option value="experiment:">experiment (beschrijf hieronder)</option>' +
              '<option value="statistiek:">statistiek (beschrijf hieronder)</option>' +
            '</select>' +
            '<input class="veld" data-bvrij placeholder="omschrijving (bij de laatste drie)" style="font-size:.78rem;">' +
            '<button class="knop stil" data-bkoppel type="button" style="font-size:.72rem;padding:.2rem .55rem;">Hang eronder</button></div>' +
          '<div class="rij h-mt30">' +
            '<select class="veld" data-ggraad aria-label="Bewijsgraad" style="font-size:.78rem;">' +
              KADER.bewijs.map(function (b) {
                return '<option value="' + esc(b.graad) + '">' + esc(b.naam) + '</option>';
              }).join('') + '</select>' +
            (tek ? '<select class="veld" data-gdoor aria-label="Getekend door" style="font-size:.78rem;">' +
              '<option value="">zonder handtekening</option>' + tek + '</select>' : '') +
            '<button class="knop stil" data-gzet type="button" style="font-size:.72rem;padding:.2rem .55rem;">Zet de graad</button></div>' +
          '</div>';
      }).join('') +
      '<div class="leeg">De graad is een uitkomst, geen keuze: hij kan nooit hoger dan wat het bewijs, de methode ' +
      'en de handtekening toelaten. Weigert de server, dan staat de reden in de melding.</div></div>';
  }

  function bind(el, s, doe) {
    var q = function (sel) { return el.querySelector(sel); };
    var w = function (sel) { return q(sel) ? q(sel).value : ''; };

    if (q('[data-brzet]')) q('[data-brzet]').addEventListener('click', function () {
      doe(api('plan/bron', { id: s.id, titel: w('[data-brtitel]'), herkomst: w('[data-brherkomst]') }));
    });
    Array.prototype.forEach.call(el.querySelectorAll('[data-bnzet]'), function (b) {
      b.addEventListener('click', function () {
        var rij = b.closest('[data-bron]');
        doe(api('plan/bron-natrek', { id: s.id, bronId: rij.dataset.bron,
          door: rij.querySelector('[data-bndoor]').value, nagetrokken: true }));
      });
    });
    if (q('[data-dszet]')) q('[data-dszet]').addEventListener('click', function () {
      doe(api('bewijs/dataset', { id: s.id, naam: w('[data-dsnaam]'), rijen: w('[data-dsrijen]') }));
    });

    Array.prototype.forEach.call(el.querySelectorAll('[data-bkoppel]'), function (b) {
      b.addEventListener('click', function () {
        var rij = b.closest('[data-crij]');
        var keuze = rij.querySelector('[data-bsoort]').value;
        if (!keuze) { meld('Kies eerst een drager.'); return; }
        var stuk = keuze.split(':');
        doe(api('bewijs/koppel', { id: s.id, conclusieId: rij.dataset.crij, soort: stuk[0],
          ref: stuk[1] || rij.querySelector('[data-bvrij]').value }));
      });
    });
    Array.prototype.forEach.call(el.querySelectorAll('[data-gzet]'), function (b) {
      b.addEventListener('click', function () {
        var rij = b.closest('[data-crij]');
        doe(api('bewijs/graad', { id: s.id, conclusieId: rij.dataset.crij,
          graad: rij.querySelector('[data-ggraad]').value,
          door: rij.querySelector('[data-gdoor]') ? rij.querySelector('[data-gdoor]').value : '' }));
      });
    });

  }

  window.LivingLabBewijs = { init: init, materiaalBlok: materiaalBlok, conclusieBlok: conclusieBlok, bind: bind };
})();
