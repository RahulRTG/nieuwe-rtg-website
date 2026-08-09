/* RTG Command, deel 12: de uitrol (canary) en de zandbak.

   TWEE SCHERMEN DIE ALLEBEI OVER RISICO GAAN, en die het risico dus moeten
   TONEN in plaats van wegpoetsen. Bij de canary is dat de stand van de
   terugroldrempel en het aantal antwoorden waarop die rust; bij de zandbak is
   dat wat een zandbak NIET is. Een knop "ronde draaien" zonder die zinnen
   eromheen nodigt uit tot vertrouwen dat er niet is. */
(function () {
  'use strict';
  var C = window.RTGCommand, esc = C.esc, api = C.api, S = C.S;

  var KLEUR = { 'binnen de drempel': 'ok', 'over de drempel': 'mis',
    'onvoldoende gemeten': 'onbekend', 'niet te wegen': 'onbekend' };

  C.TEKENAARS.canary = function (el) {
    el.innerHTML = '<h2 class="ckop">Uitrol</h2>' +
      '<p class="lead">Een functie stap voor stap openzetten, met een drempel die hem automatisch ' +
      'terugdraait. De verdeling is vast per persoon en verschilt per functie; anoniem verkeer valt ' +
      'er nooit in, dus op paden die vooral zonder inlog worden gebruikt bereikt en meet een canary ' +
      'bijna niets.</p><div id="caUit"><div class="leeg">Ophalen…</div></div>';
    teken();

    function teken() {
      api('canary').then(function (d) {
        var u = '<div class="rooster">' +
          tegel('Lopend', d.tel.lopend, d.tel.lopend ? 'gold' : '', 'uitrollen die nu gewogen worden') +
          tegel('Teruggerold', d.tel.teruggerold, d.tel.teruggerold ? 'acc' : '', 'over de drempel gegaan') +
          '</div>';

        u += '<div class="kaart"><h3>Nieuwe uitrol</h3>' +
          '<div class="crij"><input class="veld" id="caId" placeholder="functie-id (bv. command-zien)" style="width:16rem;">' +
          '<input class="veld" id="caDeel" value="0.1" style="width:5rem;" aria-label="deel">' +
          '<button class="knop vol" id="caGa">Starten</button></div>' +
          '<p class="meta">Een canary verdeelt een OPEN functie over de mensen; hij opent geen dichte. ' +
          'Standaard: ' + Math.round(d.standaard.drempel * 1000) / 10 + '% serverfouten is de drempel, ' +
          'vanaf ' + d.standaard.minimum + ' antwoorden.</p></div>';

        if (!d.canaries.length) u += '<div class="kaart"><p>Er loopt geen enkele uitrol.</p></div>';
        for (var i = 0; i < d.canaries.length; i++) u += kaartVan(d.canaries[i]);
        u += '<p class="meta">' + esc(d.uitleg) + '</p>';
        document.querySelector('#caUit').innerHTML = u;

        document.querySelector('#caGa').onclick = function () {
          api('canary/start', { id: document.querySelector('#caId').value,
            deel: Number(document.querySelector('#caDeel').value || 0.1) })
            .then(function () { teken(); }).catch(function (e) { if (!e.stil) C.meld(e.message); });
        };
        Array.prototype.forEach.call(document.querySelectorAll('[data-ca]'), function (b) {
          b.onclick = function () {
            api('canary/' + b.getAttribute('data-ca'), { id: b.getAttribute('data-id'),
              deel: Number(b.getAttribute('data-deel') || 0) })
              .then(function () { teken(); }).catch(function (e) { if (!e.stil) C.meld(e.message); });
          };
        });
      }).catch(function (e) {
        if (!e.stil) document.querySelector('#caUit').innerHTML = '<div class="leeg">' + esc(e.message) + '</div>';
      });
    }

    function kaartVan(k) {
      var m = k.meting;
      var u = '<div class="kaart"><h3>' + esc(k.naam) + ' <span class="meta">' + esc(k.id) + '</span></h3>' +
        '<div class="crij"><span class="cniveau ' + (KLEUR[k.oordeel] || '') + '">' + esc(k.oordeel) + '</span>' +
        '<span class="meta">' + Math.round(k.deel * 100) + '% van de mensen · ' + esc(k.stand) + '</span></div>' +
        '<div class="rooster">' +
        tegel('Antwoorden', m.kwijt ? '-' : m.antwoorden, '', 'sinds de nulmeting') +
        tegel('Serverfouten', m.kwijt ? '-' : m.fouten, m.fouten ? 'acc' : '', 'in dezelfde periode') +
        tegel('Drempel', Math.round(k.drempel * 1000) / 10 + '%', '', 'vanaf ' + k.minimum + ' antwoorden') +
        '</div>';
      if (m.kwijt) u += '<p class="meta">' + esc(m.uitleg) + '</p>';
      if (k.reden) u += '<p class="meta">Teruggerold: ' + esc(k.reden) + '</p>';
      if (k.let) u += '<p class="meta">' + esc(k.let) + '</p>';
      u += '<div class="crij">' +
        knop(k.id, 'breder', 'Naar 50%', 0.5) + knop(k.id, 'breder', 'Naar 100%', 1) +
        knop(k.id, 'terug', 'Terugdraaien', 0) + knop(k.id, 'af', 'Afronden', 0) +
        '</div><p class="meta">Afronden is iets anders dan honderd procent: zolang er een canary hangt, ' +
        'loopt er een uitrol die gewogen wordt.</p></div>';
      return u;
    }
    function knop(id, actie, tekst, deel) {
      return '<button class="knop" data-ca="' + actie + '" data-id="' + esc(id) + '" data-deel="' + deel + '">' +
        esc(tekst) + '</button>';
    }
  };

  C.TEKENAARS.zandbak = function (el) {
    el.innerHTML = '<h2 class="ckop">Zandbak</h2>' +
      '<p class="lead">Een proces proeven zonder ook maar één productierij aan te raken. De inhoud komt ' +
      'uit de zaaiset en nooit uit de echte gegevens; de motoren zien een venster op het vak van deze ' +
      'zandbak, dus er is geen pad naar een productiecollectie.</p>' +
      '<div id="zaUit"><div class="leeg">Ophalen…</div></div>';
    teken();

    function teken() {
      api('zandbak').then(function (d) {
        var u = '<div class="kaart"><h3>Wat een zandbak niet is</h3><p>' + esc(d.let) + '</p></div>';
        u += '<div class="kaart"><h3>Nieuwe zandbak</h3><div class="crij">' +
          '<input class="veld" id="zaN" placeholder="naam" style="width:12rem;">' +
          '<input class="veld" id="zaW" placeholder="waarvoor (optioneel)" style="width:18rem;">' +
          '<button class="knop vol" id="zaGa">Maken</button></div>' +
          '<p class="meta">' + d.zandbakken.length + ' van maximaal ' + d.max + '; standaard ' +
          d.standaardDagen + ' dagen houdbaar. ' + esc(d.uitleg) + '</p></div>';

        for (var i = 0; i < d.zandbakken.length; i++) {
          var z = d.zandbakken[i];
          u += '<div class="kaart"><h3>' + esc(z.naam) + ' <span class="meta">' + z.objecten + ' objecten</span></h3>' +
            '<p class="meta">Gemaakt ' + esc(z.gemaakt) + ' door ' + esc(z.door) + ', vervalt ' + esc(z.vervalt) + '.' +
            (z.waarvoor ? ' ' + esc(z.waarvoor) : '') + '</p>' +
            (z.let ? '<p class="meta">' + esc(z.let) + '</p>' : '') +
            '<div class="crij"><input class="veld" data-zoek="' + esc(z.naam) + '" placeholder="zoek in deze zandbak" style="width:14rem;">' +
            '<button class="knop" data-zzoek="' + esc(z.naam) + '">Zoeken</button>' +
            '<button class="knop" data-zkwal="' + esc(z.naam) + '">Kwaliteit meten</button>' +
            '<button class="knop" data-zweg="' + esc(z.naam) + '">Opruimen</button></div>' +
            '<div id="zu-' + esc(z.naam) + '"></div></div>';
        }
        document.querySelector('#zaUit').innerHTML = u;

        document.querySelector('#zaGa').onclick = function () {
          api('zandbak/maak', { naam: document.querySelector('#zaN').value,
            waarvoor: document.querySelector('#zaW').value })
            .then(function () { teken(); }).catch(function (e) { if (!e.stil) C.meld(e.message); });
        };
        hang('data-zweg', function (n) { return api('zandbak/weg', { naam: n }).then(teken); });
        hang('data-zzoek', function (n) {
          var v = document.querySelector('[data-zoek="' + n + '"]').value;
          return api('zandbak/zoek', { naam: n, q: v }).then(function (r) {
            document.querySelector('#zu-' + n).innerHTML = '<p class="meta">' + r.totaal +
              ' treffers in de zandbak: ' + esc((r.treffers || []).map(function (t) { return t.titel; }).join(' · ')) + '</p>';
          });
        });
        hang('data-zkwal', function (n) {
          return api('zandbak/kwaliteit', { naam: n }).then(function (r) {
            document.querySelector('#zu-' + n).innerHTML = '<p class="meta">' + r.tel.defecten +
              ' defecten over ' + r.gemeten.objecten + ' objecten in de zandbak.</p>';
          });
        });
      }).catch(function (e) {
        if (!e.stil) document.querySelector('#zaUit').innerHTML = '<div class="leeg">' + esc(e.message) + '</div>';
      });
    }
    function hang(attr, doe) {
      Array.prototype.forEach.call(document.querySelectorAll('[' + attr + ']'), function (b) {
        b.onclick = function () { doe(b.getAttribute(attr)).catch(function (e) { if (!e.stil) C.meld(e.message); }); };
      });
    }
  };

  function tegel(l, v, k, u) {
    return '<div class="tegel"><div class="l">' + esc(l) + '</div><div class="v ' + (k || '') + '">' + esc(v) + '</div>' +
      (u ? '<div class="u">' + esc(u) + '</div>' : '') + '</div>';
  }

  C.WERKPLEKKEN.push(
    { id: 'canary', naam: 'Uitrol', sec: 'Besturen',
      teller: function (s) { return s.start && s.start.canary ? s.start.canary.lopend : 0; } },
    { id: 'zandbak', naam: 'Zandbak', sec: 'Besturen' });
  void S;
})();
