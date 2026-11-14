/* Stand Lab-fonds, deel 1 van 2. Was /apps/labfonds.html.

   Leden zamelen per locatie in voor het RTF Onderzoekslab en beslissen samen,
   met de AI-scheidsrechter, wat de pot van een plek in de omgeving doet.

   Dit bestand registreert GEEN stand: het zet de gedeelde stukken (stijl,
   tekenwerk, euro-omzetting, uitvoermodel) op w.RTGGeldDeel.labfonds en
   labfondsb.js, dat erna laadt, doet de registratie en de handelingen. De
   splitsing bestaat alleen om de maatregel van de repo (bestanden onder de
   10 KB) te halen; het is samen een stand. */
(function (w, d) {
  'use strict';
  var $ = function (s) { return d.querySelector(s); };

  /* Wat het overzicht teruggaf: het tekenwerk (hier), de handelingen (deel 2)
     en het uitvoermodel lezen er allemaal uit. */
  var S = { locs: [] };

  /* Dit fonds praat in EURO'S: de kern rekent in centen maar de routes geven
     eur() terug. Geld.euro wil centen, dus hier een keer maal honderd -- op
     precies een plek, zodat er geen tweede afrondlaag ontstaat. */
  function eu(e) { return w.Geld.euro(Math.round((Number(e) || 0) * 100)); }
  /* Komma of punt, allebei goed; de server maakt er zelf centen van. */
  function getal(t) { return Number(String(t || '').replace(',', '.')); }

  /* De somtegels, de scheidsrechterbalk en de aan-staat van de stemknoppen
     kan geen klasse van geld.html leveren; alleen daarvoor eigen stijl, met
     een id-wacht zodat het maar een keer in het document komt. Kleuren zijn
     de rtg-tokens van dit scherm, niet het pastelblauw van de oude pagina:
     een stand hoort bij zijn app te kleuren. */

  function tekenLocs(locs) {
    var esc = w.Geld.esc;
    $('#lfLocs').innerHTML = locs.length ? locs.map(function (l) {
      return '<div class="kaart">' +
        '<div class="lf-kopr"><h3>' + esc(l.naam) + '</h3><span class="lf-loch">' + esc(l.land || '') + '</span></div>' +
        '<p>In de pot: <b class="bedrag">' + eu(l.pot) + '</b> · opgehaald ' + eu(l.opgehaald) + '</p>' +
        (l.uitgekeerd ? '<p class="stil">Uitgekeerd aan de omgeving: ' + eu(l.uitgekeerd) + '</p>' : '') +
        '<p class="stil">Mijn bijdrage hier: ' + eu(l.mijnBijdrage) + ' · ' + (l.open || 0) +
          ' open voorstel' + (l.open === 1 ? '' : 'len') + '</p>' +
        '<div class="lf-rij"><input inputmode="decimal" placeholder="Bedrag €"' +
          ' aria-label="Bedrag in euro voor ' + esc(l.naam) + '" data-b="' + esc(l.id) + '">' +
        '<button class="knop hoofd" type="button" data-doneer="' + esc(l.id) + '">Zamel in</button></div>' +
      '</div>';
    }).join('') : '<p class="leeg">Nog geen locaties.</p>';
  }

  /* Welk onderzoek dit voorstel financiert. Staat er geen, dan staat er niets:
     "geen onderzoek" is geen gebrek maar een gewoon buurtvoorstel. Is het
     onderzoek uit het lab verdwenen, dan staat de reden er -- het nummer blijft,
     want dat verandert nooit. */
  function onderzoekRegel(o, esc) {
    if (!o) return '';
    return '<p class="lf-onderzoek">Financiert onderzoek <b>' + esc(o.nummer || '') + '</b>' +
      (o.titel ? ' · ' + esc(o.titel) : '') +
      (o.nietTeZeggen ? ' <span class="stil">(' + esc(o.nietTeZeggen) + ')</span>' : '') + '</p>';
  }

  var WOORD = { steun: 'Steunt', twijfel: 'Twijfelt', afraden: 'Raadt af' };
  function tekenVoorstellen(vs) {
    var esc = w.Geld.esc;
    $('#lfVoorstellen').innerHTML = vs.length ? vs.map(function (v) {
      var sc = v.scheids || {};
      var o = sc.oordeel === 'afraden' ? 'afraden' : sc.oordeel === 'twijfel' ? 'twijfel' : 'steun';
      return '<div class="kaart">' +
        '<div class="lf-kopr"><h3>' + esc(v.titel) + '</h3><span class="bedrag">' + eu(v.bedrag) + '</span></div>' +
        '<div class="lf-loch">' + esc(v.locId) + '</div>' +
        '<p>' + esc(v.doel) + '</p>' +
        '<p class="stil">Voorgesteld door ' + esc(v.door) + '</p>' +
        onderzoekRegel(v.onderzoek, esc) +
        (sc.reden ? '<div class="lf-scheids ' + o + '"><b>Scheidsrechter ' + WOORD[o] + '</b> · ' + esc(sc.reden) + '</div>' : '') +
        '<div class="lf-stem">' +
          '<button class="knop lf-voor" type="button" aria-pressed="' + (v.mijnStem === 'voor') + '"' +
            ' data-stem="voor" data-id="' + esc(v.id) + '">Voor</button>' +
          '<button class="knop lf-tegen" type="button" aria-pressed="' + (v.mijnStem === 'tegen') + '"' +
            ' data-stem="tegen" data-id="' + esc(v.id) + '">Tegen</button>' +
          '<button class="knop" type="button" data-beslis="' + esc(v.id) + '">Nu beslissen</button>' +
          '<span class="telling">' + (v.voor || 0) + ' voor · ' + (v.tegen || 0) + ' tegen</span>' +
        '</div>' +
      '</div>';
    }).join('') : '<p class="leeg">Nog geen open voorstellen. Doe hieronder het eerste voorstel.</p>';
  }

  /* Meenemen (shared/uitvoer.js), zoals de oude pagina: de potten per
     locatie. Zelfde kolommen en dezelfde rauwe eurobedragen als toen. */
  function model() {
    if (!d.getElementById('lfWrap') || !S.locs.length) return null;
    return { naam: 'labfonds-locaties',
      kolommen: ['locatie', 'land', 'in de pot', 'opgehaald', 'uitgekeerd', 'mijn bijdrage', 'open voorstellen'],
      rijen: S.locs.map(function (l) {
        return [l.naam, l.land || '', l.pot, l.opgehaald, l.uitgekeerd || 0, l.mijnBijdrage, l.open];
      }) };
  }

  var Deel = w.RTGGeldDeel = w.RTGGeldDeel || {};
  Deel.labfonds = { S: S, eu: eu, getal: getal, tekenLocs: tekenLocs, tekenVoorstellen: tekenVoorstellen, model: model };
})(window, document);
