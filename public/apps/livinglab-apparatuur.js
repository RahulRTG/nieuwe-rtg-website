/* RTF Living Lab, scherm deel 10: de fysieke onderzoeksomgeving.

   Ruimtes, werkbanken, sensoren, camera's, 3D-printers en laptops, met wie
   erop bevoegd is, wanneer ze zijn gekalibreerd en wat eraan stuk is.

   WAAROM DE KALIBRATIE ZO PROMINENT IN BEELD STAAT: een sensor die een half
   jaar niet is geijkt levert getallen die er precies zo uitzien als goede
   getallen. De server weigert daarom een reservering op een ongekalibreerd
   apparaat, en dit scherm zegt vooraf waarom -- anders leest die weigering als
   een storing in plaats van als de bedoeling.

   Dit bestand is het REGISTER, op labniveau: een sensor is niet van één
   onderzoek. Het reserveren gebeurt vanuit een studie en staat daarom in
   ./livinglab-werkplaats.js, bij de rest van het werk rond een dossier. */
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
        '<div class="rij h-mt50">' +
          '<input class="veld" data-anaam placeholder="Naam (bijv. Regensensor RS-4)" maxlength="100">' +
          '<select class="veld s-jv4uwu" data-asoort aria-label="Soort">' +
            (r.soorten || []).map(function (s) { return '<option value="' + esc(s) + '">' + esc(s) + '</option>'; }).join('') +
          '</select>' +
          '<input class="veld s-1v3dw5a" data-aplek placeholder="Plek" maxlength="100">' +
          '<input class="veld s-jv5hwd" data-ageldig type="number" min="0" placeholder="kalibratie geldig (mnd)">' +
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

      '<div class="rij h-mt30">' +
        '<input class="veld s-1y7zeks" data-abwie placeholder="bevoegd maken: naam">' +
        '<input class="veld s-1doalxl" data-abtot type="date" aria-label="bevoegd tot">' +
        '<button class="knop stil s-1emfcyx" data-abzet type="button">Bevoegd</button>' +
      '</div>' +
      '<div class="rij h-mt30">' +
        '<input class="veld s-956tyo" data-akdoor placeholder="kalibratie door">' +
        '<input class="veld s-956tyo" data-akstand placeholder="gemeten afwijking">' +
        '<button class="knop stil s-1emfcyx" data-akzet type="button">Gekalibreerd</button>' +
        (storing.length
          ? '<button class="knop stil s-1emfcyx" data-aopzet type="button">Storing opgelost</button>'
          : '<input class="veld s-1y7zeks" data-astoring placeholder="storing melden">' +
            '<button class="knop stil s-1emfcyx" data-aszet type="button">Meld storing</button>') +
      '</div>' +
      /* Uitgifte staat los van reserveren: een gereserveerde laptop die nog in
         de kast ligt is iets anders dan een laptop die iemand meenam. */
      '<div class="rij h-mt30">' +
        (x.uit
          ? '<button class="knop stil s-1emfcyx" data-aterug type="button">Ingenomen</button>'
          : '<input class="veld s-956tyo" data-auitaan placeholder="uitgeven aan">' +
            '<button class="knop stil s-1emfcyx" data-auit type="button">Geef uit</button>') +
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
    perRij('[data-auit]', function (id, r) {
      return api('app/uitgifte', { id: id, aan: r.querySelector('[data-auitaan]').value });
    });
    perRij('[data-aterug]', function (id) {
      return api('app/uitgifte', { id: id, terug: true });
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

  window.LivingLabApparatuur = { init: init, teken: teken };
})();
