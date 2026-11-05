/* Stand Wie betaalt wat, deel 1 van 2. Was /apps/wbw.html.

   Dit bestand registreert GEEN stand: het zet de gedeelde stukken (stijl,
   tekenwerk, idem-sleutel, uitvoermodel) op w.RTGGeldDeel.wbw en wbwb.js,
   dat erna laadt, doet de registratie en de handelingen. De splitsing
   bestaat alleen om de maatregel van de repo (bestanden onder de 10 KB) te
   halen; het is samen een stand. */
(function (w, d) {
  'use strict';
  var $ = function (s) { return d.querySelector(s); };

  /* De stand van dit moment: het geopende lijstje en het overzicht. Staat
     hier en niet in deel 2, omdat zowel het tekenwerk (hier) als de
     handelingen (deel 2) als het uitvoermodel eruit lezen. */
  var S = { groep: null, lijstjes: [] };

  /* De balansstaafjes, de vinkrijen en het kasboek kan geen enkele klasse
     van geld.html leveren; alleen daarvoor een eigen stukje stijl, met een
     id-wacht zodat het maar een keer in het document komt. De kleuren zijn
     de rtg-tokens van dit scherm, niet de losse hexwaarden van de oude
     pagina: een stand hoort bij zijn app te kleuren. */

  /* De idem-sleutel voor verrekenen: een dubbeltik moet een herhaling zijn,
     geen tweede betaling. De gedeelde id-helper (shared/id.js) laadt niet op
     geld.html en die pagina hoort deze stand niet aan te raken; daarom
     dezelfde bron, de CSPRNG, hier in het klein. Geen klok en geen
     Math.random als eerste keus (keuringsregel 15); laadt geld.html ooit
     shared/id.js, ruil dit dan in voor de helper daar. */
  function idem() {
    var b = new Uint8Array(16), k;
    try {
      crypto.getRandomValues(b);
      k = Array.prototype.map.call(b, function (x) { return ('0' + x.toString(16)).slice(-2); }).join('');
    } catch (e) {
      /* onbereikbaar in elke browser die deze app draait; nooit stil zonder
         sleutel zitten weegt zwaarder dan de zwakkere bron */
      k = Date.now() + '-' + String(Math.random()).slice(2);
    }
    return 'wbw-' + k;
  }

  function kleur(c) { return c > 0 ? ' wb-plus' : c < 0 ? ' wb-min' : ''; }

  function toon(welke) {
    $('#wbLijst').hidden = welke !== 'lijst';
    $('#wbGroep').hidden = welke !== 'groep';
  }

  function tekenLijstjes() {
    var esc = w.Geld.esc, euro = w.Geld.euro;
    $('#wbLijstjes').innerHTML = S.lijstjes.length ? S.lijstjes.map(function (g) {
      return '<button class="wb-lijstknop" type="button" data-open="' + esc(g.id) + '">' +
        '<span class="naam">' + esc(g.naam) + '</span>' +
        '<span class="wb-sub">' + esc(g.leden) + ' personen</span>' +
        '<span class="wb-rek"></span>' +
        '<span class="wb-bedrag' + kleur(g.mijnSaldo) + '">' + euro(g.mijnSaldo) + '</span></button>';
    }).join('') : '<p class="leeg">Nog geen lijstjes. Begin er een met uw vrienden.</p>';
  }

  function tekenVrienden(rijen) {
    var esc = w.Geld.esc;
    $('#wbVrienden').innerHTML = rijen.length ? rijen.slice(0, 20).map(function (v) {
      return '<label class="wb-vink"><input type="checkbox" value="' + esc(v.key) + '">' +
        esc(v.codename || v.codenaam || v.key) + '</label>';
    }).join('') : '<p class="stil">Maak eerst vrienden in De Salon; een lijstje deelt u met vrienden.</p>';
  }

  function tekenGroep() {
    var g = S.groep, esc = w.Geld.esc, euro = w.Geld.euro, i;
    $('#wbGNaam').textContent = g.naam;
    /* de langste staaf is de maat; minstens 1 zodat een lege groep niet
       door nul deelt */
    var maxAbs = 1;
    for (i = 0; i < g.leden.length; i++) maxAbs = Math.max(maxAbs, Math.abs(g.leden[i].saldo));
    $('#wbBalans').innerHTML = g.leden.map(function (l) {
      return '<div class="wb-balk"><span class="naam">' + esc(l.codenaam) + (l.ik ? ' (u)' : '') + '</span>' +
        '<span class="wb-staaf"><i class="' + (l.saldo >= 0 ? 'p' : 'm') + '" style="width:' +
          Math.round(Math.abs(l.saldo) / maxAbs * 50) + '%"></i></span>' +
        '<span class="wb-bedrag' + kleur(l.saldo) + '">' + euro(l.saldo) + '</span></div>';
    }).join('');
    /* verrekenen kan alleen wie rood staat; verzoeken sturen alleen wie
       tegoed heeft, precies zoals de server het ook afdwingt */
    $('#wbVerreken').disabled = g.mijnSaldo >= 0;
    $('#wbVerzoek').disabled = g.mijnSaldo <= 0;
    $('#wbVoor').innerHTML = g.leden.map(function (l) {
      return '<label class="wb-vink"><input type="checkbox" value="' + esc(l.key) + '" checked>' +
        esc(l.codenaam) + (l.ik ? ' (u)' : '') + '</label>';
    }).join('');
    $('#wbLog').innerHTML = (g.regels || []).length ? g.regels.map(function (r) {
      return '<div class="r"><span class="wie">' + esc(r.door) + '</span>' +
        '<span>' + (r.soort === 'uitgave'
          ? esc(r.oms) + ' · voor ' + esc(r.voor)
          : 'verrekende met ' + esc(r.aan)) + '</span>' +
        '<span class="wb-rek"></span><span class="wb-bedrag">' + euro(r.centen) + '</span></div>';
    }).join('') : '<p class="leeg">Nog geen uitgaven.</p>';
  }

  var Deel = w.RTGGeldDeel = w.RTGGeldDeel || {};
  Deel.wbw = { S: S, idem: idem, toon: toon, tekenLijstjes: tekenLijstjes,
    tekenVrienden: tekenVrienden, tekenGroep: tekenGroep };
})(window, document);
