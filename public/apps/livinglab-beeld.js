/* RTF Living Lab, scherm deel 3: het tekenwerk. De filters, de lijst met
   onderzoeken, de vragen uit de buurt, de pijplijn en de impactcijfers.

   ./livinglab-kern.js haalt op en houdt de stand bij; dit bestand zet die stand
   op het scherm. De scheiding is niet cosmetisch: dit is de laag die BESLIST hoe
   een onderzoek er voor een mens uitziet, en die keuze -- een uitdaging met een
   route eronder, geen tabelrij -- is het hele verschil tussen een Living Lab en
   een projectenlijst.

   Afgesplitst uit ./livinglab-kern.js toen die de 10 KB passeerde. */
(function () {
  'use strict';
  var esc, meld, route, soortNaam, herteken, zetFilter, filter;

  var $ = function (s) { return document.querySelector(s); };

  function init(o) {
    esc = o.esc; meld = o.meld; route = o.route;
    soortNaam = o.soortNaam; herteken = o.herteken; zetFilter = o.zetFilter; filter = o.filter;
  }

  function tekenFilters(perSoort) {
    var FILTER = filter();
    $('#filters').innerHTML = '<button class="chip' + (FILTER === '' ? ' aan' : '') + '" data-f="">Alle</button>' +
      (perSoort || []).map(function (s) {
        return '<button class="chip' + (FILTER === s.soort ? ' aan' : '') + '" data-f="' + esc(s.soort) + '">' +
          esc(s.naam) + (s.aantal ? ' (' + s.aantal + ')' : '') + '</button>';
      }).join('');
    Array.prototype.forEach.call(document.querySelectorAll('#filters .chip'), function (b) {
      b.addEventListener('click', function () { zetFilter(b.dataset.f); tekenFilters(perSoort); herteken(); });
    });
  }

  /* De lijst is bewust een UITDAGING per onderzoek en geen tabelrij: dat is wat
     een deelnemer als eerste ziet. De route eronder laat zien hoe ver het is. */
  function tekenLijst(STUDIES, FILTER) {
    var lijst = STUDIES.filter(function (s) { return !FILTER || s.soort === FILTER; });
    $('#lijst').innerHTML = lijst.length ? lijst.map(function (s) {
      return '<div class="kaart" style="margin-bottom:.7rem;" data-s="' + esc(s.id) + '">' +
        '<div class="rij" style="justify-content:space-between;align-items:start;">' +
          '<h2 style="font-size:1.05rem;">' + esc(s.titel) + '</h2>' +
          '<span class="pil' + (s.gescheiden ? ' let' : '') + '">' + esc(s.klasse) + '</span></div>' +
        '<div class="leeg">' + esc(soortNaam(s.soort)) +
          (s.vraagstuk ? ' &middot; ' + esc(s.vraagstuk) : ' &middot; besloten onderzoek') + '</div>' +
        route(s.stap) +
        '<div class="rij"><button class="knop stil" data-open type="button">Open het dossier</button>' +
          (s.besluit ? '<span class="pil ok">besluit: ' + esc(s.besluit.soort) + '</span>' : '') + '</div>' +
        '</div>';
    }).join('') : '<div class="leeg">Nog geen onderzoek in deze soort. Begin bij een vraag die hierboven uit de buurt kwam.</div>';
    Array.prototype.forEach.call(document.querySelectorAll('[data-s]'), function (k) {
      k.querySelector('[data-open]').addEventListener('click', function () {
        window.LivingLabStudie.open(k.dataset.s);
      });
    });
  }

  /* De vragen uit de buurt, op stemmen gesorteerd. Een thema dat al een
     onderzoek heeft, houdt dat zichtbaar: een bewoner hoort te kunnen zien dat
     zijn vraag echt is opgepakt. */
  function tekenThemas(themas) {
    $('#themas').innerHTML = themas.length ? themas.slice(0, 12).map(function (t) {
      return '<div class="log" data-thema="' + esc(t.id) + '">' +
        '<b>' + esc(t.vraag) + '</b><br>' + t.stemmen + ' stem' + (t.stemmen === 1 ? '' : 'men') +
        ' &middot; van ' + esc(t.door) +
        (t.studieId ? ' &middot; <span class="pil ok">wordt onderzocht</span>'
          : ' &middot; <button class="knop stil" data-naar type="button" style="font-size:.72rem;padding:.2rem .55rem;">Maak er onderzoek van</button>') +
        '</div>';
    }).join('') : '<div class="leeg">Nog geen vragen uit de buurt. Bewoners dragen ze aan via de labpas-app.</div>';
    Array.prototype.forEach.call(document.querySelectorAll('[data-naar]'), function (b) {
      b.addEventListener('click', function () {
        var t = themas.filter(function (x) { return x.id === b.closest('[data-thema]').dataset.t; })[0];
        if (!t) return;
        $('#nTitel').value = t.vraag.slice(0, 60);
        $('#nVraag').value = t.vraag;
        if (t.soort) $('#nSoort').value = t.soort;
        $('#nTitel').dataset.thema = t.id;
        $('#nTitel').focus();
        meld('De vraag staat klaar bij "Nieuw onderzoek". Vul hem aan en start.');
      });
    });
  }

  function tekenPijplijn(p) {
    $('#pijplijn').innerHTML = p.totaal ?
      '<div class="rij">' + Object.keys(p.perStatus).map(function (k) {
        return '<span class="pil' + (k === 'uitgevoerd' ? ' ok' : '') + '">' + esc(k) + ': ' + p.perStatus[k] + '</span>';
      }).join('') + '</div>' +
      p.rijen.slice(0, 10).map(function (r) {
        return '<div class="log"><b>' + esc(r.titel) + '</b> &middot; ' + esc(r.uitgang) +
          ' &middot; uit "' + esc(r.studie) + '" <span class="graad">' + esc(r.graad) + '</span>' +
          (r.koppeling ? ' &middot; staat in het Onderzoekslab' : '') + '</div>';
      }).join('')
      : '<div class="leeg">Nog niets doorgezet. Een afgerond onderzoek kan een pilot, werkorder, subsidieaanvraag of beleidsvoorstel worden.</div>';
  }

  /* De impactcijfers, met het voorbehoud van de server eronder. Dat voorbehoud
     staat er niet uit bescheidenheid: deze getallen belanden in rapporten, en
     dan hoort erbij te staan dat een bewijsgraad geldt binnen de studie waarin
     hij is verdiend. */
  function tekenImpact(i) {
    var o = i.onderzoek, m = i.mensen, k = i.kennis, v = i.verandering;
    $('#impact').innerHTML =
      '<div class="kpi">' +
        '<div><b>' + o.totaal + '</b><span>onderzoeken</span></div>' +
        '<div><b>' + o.gestopt + '</b><span>bewust gestopt' + (o.stoppercentage != null ? ' (' + o.stoppercentage + '%)' : '') + '</span></div>' +
        '<div><b>' + m.deelnames + '</b><span>deelnames, ' + m.bewoners + ' bewoners</span></div>' +
        '<div><b>' + k.herzien + '</b><span>conclusies herzien</span></div>' +
        '<div><b>' + k.foutenVastgelegd + '</b><span>fouten vastgelegd</span></div>' +
        '<div><b>' + v.uitgevoerd + '</b><span>uitgevoerd van ' + v.ingediend + ' ingediend</span></div>' +
      '</div><div class="leeg">' + esc(i.voorbehoud) + '</div>';
    $('#kpi').innerHTML =
      '<div><b>' + o.lopend + '</b><span>lopend onderzoek</span></div>' +
      '<div><b>' + k.conclusies + '</b><span>conclusies</span></div>' +
      '<div><b>' + k.nagetrokken + '/' + k.bronnen + '</b><span>bronnen nagetrokken</span></div>';
  }

  window.LivingLabBeeld = { init: init, tekenFilters: tekenFilters, tekenLijst: tekenLijst,
    tekenThemas: tekenThemas, tekenPijplijn: tekenPijplijn, tekenImpact: tekenImpact };
})();
