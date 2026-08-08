/* RTF Living Lab, scherm deel 9: van resultaat naar echte verandering.

   Zeven uitgangen -- pilot, werkorder, subsidie, beleid, startup, onderwijs,
   nieuw onderzoek -- elk met een bewijs-ondergrens die in het keuzemenu staat.
   Dat die ondergrens ZICHTBAAR is, is het punt: je ziet vóór het kiezen dat een
   beleidsvoorstel minstens een indicatie vraagt en een nieuw onderzoek niet.

   Zonder dit blok eindigde elk afgerond onderzoek alsnog als PDF -- precies wat
   dit lab niet wilde zijn. Afgesplitst uit ./livinglab-bewijs.js op de 10 KB. */
(function () {
  'use strict';
  var api, KADER, esc, meld;

  function init(o) { api = o.api; KADER = o.kader; esc = o.esc; meld = o.meld; }

  /* ---------- van resultaat naar verandering ---------- */
  function uitgangBlok(s) {
    var cs = s.conclusies || [], us = s.uitgangen || [];
    if (s.stap !== 'besluit' && s.stap !== 'vervolg') return '';
    return '<div class="kaart"><div class="sec">Van onderzoek naar verandering</div>' +
      (us.length ? us.map(function (x) {
        return '<div class="log" data-uit="' + esc(x.id) + '"><b>' + esc(x.titel) + '</b> &middot; ' + esc(x.uitgang) +
          ' &middot; <span class="pil' + (x.status === 'uitgevoerd' ? ' ok' : '') + '">' + esc(x.status) + '</span>' +
          (x.koppeling ? ' &middot; staat in het Onderzoekslab' : '') +
          '<div class="rij" style="margin-top:.3rem;">' +
            '<select class="veld" data-ustatus aria-label="Status" style="font-size:.78rem;">' +
              KADER.uitgangstatus.map(function (st) { return '<option value="' + esc(st) + '">' + esc(st) + '</option>'; }).join('') +
            '</select>' +
            '<input class="veld" data-unotitie placeholder="Waaraan is dat te zien? (verplicht bij uitgevoerd)" style="font-size:.78rem;">' +
            '<button class="knop stil" data-uzet type="button" style="font-size:.72rem;padding:.2rem .55rem;">Zet status</button>' +
            (x.uitgang === 'pilot' && !x.koppeling
              ? '<button class="knop stil" data-unaarlab type="button" style="font-size:.72rem;padding:.2rem .55rem;">Naar het Onderzoekslab</button>' : '') +
          '</div></div>';
      }).join('') : '<div class="leeg">Nog niets doorgezet. Een resultaat kan een pilot, werkorder, subsidieaanvraag, ' +
        'beleidsvoorstel, startupconcept, onderwijsproject of nieuw onderzoek worden.</div>') +
      (cs.length
        ? '<div class="rij" style="margin-top:.5rem;">' +
            '<select class="veld" data-unieuw aria-label="Uitgang">' +
              KADER.uitgangen.map(function (u) {
                var eis = KADER.uitgangeis[u.uitgang];
                var nodig = KADER.bewijs.filter(function (b) { return b.rang === eis; })[0] || {};
                return '<option value="' + esc(u.uitgang) + '">' + esc(u.naam) + ' (vanaf ' + esc(nodig.naam || '?') + ')</option>';
              }).join('') + '</select>' +
            '<select class="veld" data-uconc aria-label="Uit welke conclusie">' +
              cs.map(function (c) { return '<option value="' + esc(c.id) + '">' + esc(c.tekst).slice(0, 50) + ' [' + esc(c.graad) + ']</option>'; }).join('') +
            '</select></div>' +
          '<input class="veld" data-utitel placeholder="Titel van het voorstel" maxlength="150" style="margin-top:.35rem;">' +
          '<input class="veld" data-uoms placeholder="Waar gaat het om?" maxlength="600" style="margin-top:.35rem;">' +
          '<button class="knop" data-umaak type="button" style="margin-top:.35rem;">Zet dit door</button>'
        : '<div class="leeg">Er is nog geen conclusie om iets uit voort te laten komen.</div>') +
      '<div class="sec" style="margin-top:.9rem;">Vervolgonderzoek</div>' +
      '<div class="leeg">De keten van onderzoek naar onderzoek is wat een Living Lab onderscheidt van ' +
        'een reeks losse projecten: op het nieuwe dossier blijft staan waar de vraag vandaan kwam.</div>' +
      '<div class="rij"><input class="veld" data-vvtitel placeholder="Titel van het vervolgonderzoek" maxlength="120">' +
        '<button class="knop stil" data-vvmaak type="button">Start vervolg</button></div>' +
      '<input class="veld" data-vvvraag placeholder="Het nieuwe vraagstuk" maxlength="600" style="margin-top:.35rem;">' +
      '</div>';
  }

  function bind(el, s, doe) {
    var q = function (sel) { return el.querySelector(sel); };
    var w = function (sel) { return q(sel) ? q(sel).value : ''; };

    if (q('[data-umaak]')) q('[data-umaak]').addEventListener('click', function () {
      doe(api('uit/maak', { id: s.id, uitgang: w('[data-unieuw]'), conclusieId: w('[data-uconc]'),
        titel: w('[data-utitel]'), omschrijving: w('[data-uoms]') }));
    });
    if (q('[data-vvmaak]')) q('[data-vvmaak]').addEventListener('click', function () {
      doe(api('uit/vervolg', { id: s.id, titel: w('[data-vvtitel]'), vraagstuk: w('[data-vvvraag]') }));
    });
    Array.prototype.forEach.call(el.querySelectorAll('[data-uzet]'), function (b) {
      b.addEventListener('click', function () {
        var rij = b.closest('[data-uit]');
        doe(api('uit/status', { id: s.id, uitgangId: rij.dataset.uit,
          status: rij.querySelector('[data-ustatus]').value, notitie: rij.querySelector('[data-unotitie]').value }));
      });
    });
    Array.prototype.forEach.call(el.querySelectorAll('[data-unaarlab]'), function (b) {
      b.addEventListener('click', function () {
        var veld = prompt('In welk veld van het RTG Onderzoekslab? (hardware, software, dorp, meta, landbouw, energie, water, zorg, onderwijs)');
        if (!veld) return;
        doe(api('uit/naar-lab', { id: s.id, uitgangId: b.closest('[data-uit]').dataset.uit, veld: veld.trim() }));
      });
    });
  }

  window.LivingLabUitgang = { init: init, uitgangBlok: uitgangBlok, bind: bind };
})();
