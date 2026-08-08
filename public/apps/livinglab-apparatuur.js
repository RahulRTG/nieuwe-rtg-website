/* RTF Living Lab, scherm deel 10: de fysieke onderzoeksomgeving.

   Ruimtes, werkbanken, sensoren, camera's, 3D-printers en laptops, met wie
   erop bevoegd is, wanneer ze zijn gekalibreerd en wat eraan stuk is.

   WAAROM DE KALIBRATIE ZO PROMINENT IN BEELD STAAT: een sensor die een half
   jaar niet is geijkt levert getallen die er precies zo uitzien als goede
   getallen. De server weigert daarom een reservering op een ongekalibreerd
   apparaat, en dit scherm zegt vooraf waarom -- anders leest die weigering als
   een storing in plaats van als de bedoeling.

   Reserveren gebeurt vanuit een ONDERZOEK (het apparaat wordt aan een studie
   gekoppeld), dus die knop staat in het dossier; het register staat hier, op
   labniveau, want een sensor is niet van één onderzoek. */
(function () {
  'use strict';
  var api, KADER, esc, meld, huidigLab, herlaad;

  function init(o) {
    api = o.api; KADER = o.kader; esc = o.esc; meld = o.meld;
    huidigLab = o.huidigLab; herlaad = o.herlaad;
  }

  function teken(doel) {
    var lab = huidigLab();
    if (!lab) { doel.innerHTML = '<div class="leeg">Kies eerst een lab.</div>'; return; }
    api('app/lijst', { id: lab.id }).then(function (r) {
      var a = r.apparatuur || [];
      doel.innerHTML = '<div class="sec">Apparatuur en ruimtes (' + a.length + ')</div>' +
        (a.length ? a.map(rij).join('') :
          '<div class="leeg">Nog niets geregistreerd. Zodra dit lab echte ruimtes en apparaten heeft, ' +
          'weet een experiment achteraf ook waarmee en met welke kalibratie het is uitgevoerd.</div>') +
        '<div class="rij" style="margin-top:.5rem;">' +
          '<input class="veld" data-anaam placeholder="Naam (bijv. Regensensor RS-4)" maxlength="100">' +
          '<select class="veld" data-asoort aria-label="Soort" style="max-width:10rem;">' +
            (r.soorten || []).map(function (s) { return '<option value="' + esc(s) + '">' + esc(s) + '</option>'; }).join('') +
          '</select>' +
          '<input class="veld" data-aplek placeholder="Plek" maxlength="100" style="max-width:9rem;">' +
          '<input class="veld" data-ageldig type="number" min="0" placeholder="kalibratie geldig (mnd)" style="max-width:11rem;">' +
          '<button class="knop" data-abij type="button">Registreer</button></div>' +
        '<div class="leeg">Laat de kalibratietermijn op 0 als ijken hier niet van toepassing is ' +
        '(een werkbank kalibreer je niet). Dat is iets anders dan "verlopen".</div>';
      bind(doel, lab);
    }).catch(function (e) { doel.innerHTML = '<div class="leeg">' + esc(e.message) + '</div>'; });
  }

  function rij(x) {
    var k = x.kalibratie || {};
    var storing = (x.onderhoud || []).filter(function (o) { return o.open; });
    return '<div class="log" data-app="' + esc(x.id) + '"><b>' + esc(x.naam) + '</b> &middot; ' + esc(x.soort) +
      (x.plek ? ' &middot; ' + esc(x.plek) : '') +
      (x.actief ? '' : ' &middot; <span class="pil let">uit de roulatie</span>') +
      (x.uit ? ' &middot; <span class="pil wacht">uitgegeven aan ' + esc(x.uit.aan) + '</span>' : '') +
      '<br>' +
      (k.geldigMaanden
        ? (k.op ? 'gekalibreerd ' + esc(k.op) + ' door ' + esc(k.door || '?') + (k.stand ? ' (' + esc(k.stand) + ')' : '')
                : '<span class="pil let">nooit gekalibreerd</span>')
        : 'kalibratie niet van toepassing') +
      ' &middot; ' + (x.bevoegd || []).length + ' bevoegd' +
      (storing.length ? '<br><span class="pil let">storing: ' + esc(storing[0].wat) + '</span>' : '') +

      '<div class="rij" style="margin-top:.3rem;">' +
        '<input class="veld" data-abwie placeholder="bevoegd maken: naam" style="font-size:.75rem;max-width:10rem;">' +
        '<input class="veld" data-abtot type="date" style="font-size:.75rem;max-width:9.5rem;" aria-label="bevoegd tot">' +
        '<button class="knop stil" data-abzet type="button" style="font-size:.7rem;padding:.15rem .5rem;">Bevoegd</button>' +
      '</div>' +
      '<div class="rij" style="margin-top:.3rem;">' +
        '<input class="veld" data-akdoor placeholder="kalibratie door" style="font-size:.75rem;max-width:9rem;">' +
        '<input class="veld" data-akstand placeholder="gemeten afwijking" style="font-size:.75rem;max-width:9rem;">' +
        '<button class="knop stil" data-akzet type="button" style="font-size:.7rem;padding:.15rem .5rem;">Gekalibreerd</button>' +
        (storing.length
          ? '<button class="knop stil" data-aopzet type="button" style="font-size:.7rem;padding:.15rem .5rem;">Storing opgelost</button>'
          : '<input class="veld" data-astoring placeholder="storing melden" style="font-size:.75rem;max-width:10rem;">' +
            '<button class="knop stil" data-aszet type="button" style="font-size:.7rem;padding:.15rem .5rem;">Meld storing</button>') +
      '</div></div>';
  }

  function bind(el, lab) {
    var q = function (s) { return el.querySelector(s); };
    var na = function (belofte) {
      return belofte.then(function () { teken(el); }).catch(function (e) { meld(e.message); });
    };
    q('[data-abij]').addEventListener('click', function () {
      na(api('app/maak', { labId: lab.id, naam: q('[data-anaam]').value, soort: q('[data-asoort]').value,
        plek: q('[data-aplek]').value, geldigMaanden: q('[data-ageldig]').value }));
    });
    var perRij = function (knop, doen) {
      Array.prototype.forEach.call(el.querySelectorAll(knop), function (b) {
        b.addEventListener('click', function () {
          var r = b.closest('[data-app]');
          na(doen(r.dataset.app, r));
        });
      });
    };
    perRij('[data-abzet]', function (id, r) {
      return api('app/bevoegd', { id: id, wie: r.querySelector('[data-abwie]').value, tot: r.querySelector('[data-abtot]').value });
    });
    perRij('[data-akzet]', function (id, r) {
      return api('app/kalibratie', { id: id, door: r.querySelector('[data-akdoor]').value, stand: r.querySelector('[data-akstand]').value });
    });
    perRij('[data-aszet]', function (id, r) {
      return api('app/onderhoud', { id: id, wat: r.querySelector('[data-astoring]').value, soort: 'storing' });
    });
    perRij('[data-aopzet]', function (id) {
      // de open storing van dit apparaat opzoeken en sluiten
      return api('app/lijst', { id: lab.id }).then(function (r) {
        var app = (r.apparatuur || []).filter(function (x) { return x.id === id; })[0] || {};
        var open = (app.onderhoud || []).filter(function (o) { return o.open; })[0];
        if (!open) throw new Error('Er staat geen storing open.');
        return api('app/storing-op', { id: id, meldingId: open.id, hoe: 'Opgelost' });
      });
    });
  }

  /* De reserveringsknop in het dossier van een onderzoek: het apparaat hangt
     aan DEZE studie, en de kalibratiestand van dit moment gaat mee de
     reservering in. */
  function reserveerBlok(s, apparatuur) {
    if (!apparatuur || !apparatuur.length) return '';
    return '<div class="kaart"><div class="sec">Apparatuur voor dit onderzoek</div>' +
      ((s.reserveringen || []).filter(function (r) { return !r.weg; }).length
        ? s.reserveringen.filter(function (r) { return !r.weg; }).map(function (r) {
            return '<div class="log"><b>' + esc(r.apparaat) + '</b> &middot; ' + esc(r.van) + ' t/m ' + esc(r.tot) +
              ' &middot; door ' + esc(r.door) +
              '<br>kalibratie bij gebruik: ' + (r.kalibratie && r.kalibratie.op ? esc(r.kalibratie.op) +
                (r.kalibratie.stand ? ' (' + esc(r.kalibratie.stand) + ')' : '') : 'n.v.t.') + '</div>';
          }).join('')
        : '<div class="leeg">Nog niets gereserveerd.</div>') +
      '<div class="rij" style="margin-top:.35rem;">' +
        '<select class="veld" data-resvapp aria-label="Apparaat">' +
          apparatuur.filter(function (a) { return a.actief; }).map(function (a) {
            return '<option value="' + esc(a.id) + '">' + esc(a.naam) + '</option>';
          }).join('') + '</select>' +
        '<input class="veld" data-resvvan type="date" aria-label="van" style="max-width:9.5rem;">' +
        '<input class="veld" data-resvtot type="date" aria-label="tot" style="max-width:9.5rem;">' +
        '<input class="veld" data-resvdoor placeholder="op naam van" style="max-width:9rem;">' +
        '<button class="knop stil" data-resvzet type="button">Reserveer</button></div></div>';
  }

  /* De reserveringsvelden dragen een EIGEN voorvoegsel (resv). Ze heetten eerst
     data-rzet, en dat is in ./livinglab-vormen.js de knop waarmee je een
     REFLECTIE vastlegt. Beide blokken staan in hetzelfde blad, dus bij de stap
     `reflectie` haakte deze bedrading zich aan die knop: één klik op "Leg vast"
     zocht daarna een apparaat dat er niet was. Zelfde naam, twee betekenissen,
     in één document -- regel 4 van de lat, en hij bijt hier meteen. */
  function bindReservering(el, s, doe) {
    var q = function (x) { return el.querySelector(x); };
    if (!q('[data-resvzet]')) return;
    q('[data-resvzet]').addEventListener('click', function () {
      doe(api('app/reserveer', { id: q('[data-resvapp]').value, studieId: s.id,
        van: q('[data-resvvan]').value, tot: q('[data-resvtot]').value, door: q('[data-resvdoor]').value }));
    });
  }

  window.LivingLabApparatuur = { init: init, teken: teken, reserveerBlok: reserveerBlok, bindReservering: bindReservering };
})();
