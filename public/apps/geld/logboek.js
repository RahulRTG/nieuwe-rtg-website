/* Stand Logboek, deel 1 van 2. Was /apps/logboek.html: het onderhoudsboek
   van uw jacht, jet, oldtimer of ander kostbaar bezit. Per object de
   basisgegevens en daaronder de regels (keuring, service, reparatie,
   verzekering) met kosten en de datum waarop het weer aan de beurt is; wat
   binnenkort verloopt staat bovenaan als aandachtkaart.

   Dit bestand registreert GEEN stand: het zet de gedeelde stukken (stijl,
   tekenwerk, euro-omzetting, uitvoermodel) op w.RTGGeldDeel.logboek en
   logboekb.js, dat erna laadt, doet de registratie en de handelingen. De
   splitsing bestaat alleen om de maatregel van de repo (bestanden onder de
   10 KB) te halen; het is samen een stand. */
(function (w, d) {
  'use strict';
  var $ = function (s) { return d.querySelector(s); };

  /* De kern bewaart kosten in EURO'S (kern/rechterhand/logboek.js), maar
     Geld.euro wil centen: hier een keer maal honderd, op precies een plek,
     zodat er geen tweede afrondlaag ontstaat. */
  function eu(e) { return w.Geld.euro(Math.round((Number(e) || 0) * 100)); }

  /* S.open onthoudt welk object er openstaat. laad() (deel 2) haalt altijd
     vers en tekent daarna pas de juiste laag: na elke handeling klopt het
     scherm dan vanzelf, precies zoals de oude pagina het deed. */
  var S = { data: null, open: null };

  /* Alleen wat geld.html niet levert: de aandachtkaart, de klikbare
     objectkaart, de regelrij met wegknop en de soortchip. Met id-wacht,
     want tien standen delen een document. */

  function opties(lijst) {
    return (lijst || []).map(function (s) {
      return '<option>' + w.Geld.esc(s) + '</option>';
    }).join('');
  }

  /* Het hoofdscherm: aandacht, toevoegen, het register en de vlootbeheerder,
     in de volgorde van de oude pagina. */
  function hoofd(dd) {
    var Geld = w.Geld, esc = Geld.esc, h = '';
    if ((dd.attenties || []).length) {
      h += '<h2>Aandacht</h2><div class="kaart lb-attn">' +
        dd.attenties.map(function (a) {
          return '<p><b>' + esc(a.object) + '</b> · ' + esc(a.wat) + ' · ' +
            (a.verlopen ? 'verlopen' : 'vóór') + ' ' + Geld.datum(a.volgende) + '</p>';
        }).join('') + '</div>';
    }
    h += '<h2>Object toevoegen</h2><div class="kaart">' +
      '<div class="lb-rij"><input id="lbON" maxlength="80" placeholder="Naam" aria-label="Naam">' +
      '<select id="lbOS" aria-label="Soort">' + opties(dd.soorten) + '</select></div>' +
      '<div class="lb-rij"><input id="lbOM" maxlength="60" placeholder="Merk" aria-label="Merk">' +
      '<input id="lbOB" type="number" placeholder="Bouwjaar" aria-label="Bouwjaar">' +
      '<input id="lbOR" maxlength="40" placeholder="Registratie" aria-label="Registratie"></div>' +
      '<div class="lb-knoppen"><button class="knop hoofd" id="lbOAdd" type="button">Object toevoegen</button></div></div>';
    h += '<h2>Objecten</h2>';
    h += (dd.objecten || []).length ? dd.objecten.map(function (o) {
      return '<div class="kaart lb-obj" data-open="' + esc(o.id) + '" role="button" tabindex="0">' +
        '<div class="nm">' + esc(o.naam) + '</div>' +
        '<div class="lb-meta">' +
          [esc(o.soort), esc(o.merk), o.bouwjaar, (o.regelAantal || 0) + ' regels', eu(o.kosten)]
            .filter(Boolean).join(' · ') + '</div></div>';
    }).join('') : '<div class="kaart"><p class="leeg">Nog geen objecten in het logboek.</p></div>';
    h += '<h2>Vraag de vlootbeheerder</h2><div class="kaart">' +
      '<form class="lb-rij" id="lbAiForm">' +
      '<input id="lbAiIn" placeholder="Bijv. wat staat er dit kwartaal op de planning?" ' +
        'aria-label="Uw vraag aan de vlootbeheerder" autocomplete="off">' +
      '<button class="knop hoofd" type="submit">Vraag</button></form>' +
      '<div id="lbAiUit" class="stil h-mt60" aria-live="polite"></div></div>';
    $('#lbVak').innerHTML = h;
  }

  /* De detaillaag van een object: kop, regel toevoegen, historie. */
  function detail(dd, o) {
    var Geld = w.Geld, esc = Geld.esc;
    var regels = (dd.regels || []).filter(function (r) { return r.objectId === o.id; });
    var h = '<div class="kaart">' +
      '<div class="lb-naam">' + esc(o.naam) + '</div>' +
      '<div class="lb-meta">' + [esc(o.soort), esc(o.merk), o.bouwjaar, esc(o.registratie)]
        .filter(Boolean).join(' · ') + '</div>' +
      '<div class="lb-knoppen"><button class="knop" id="lbTerug" type="button">&larr; alle objecten</button>' +
      '<button class="knop lb-rood" id="lbOWeg" type="button">Verwijderen</button></div></div>';
    h += '<h2>Regel toevoegen</h2><div class="kaart">' +
      '<div class="lb-rij"><input id="lbRW" maxlength="100" placeholder="Wat (bijv. grote beurt)" aria-label="Wat">' +
      '<select id="lbRS" aria-label="Soort regel">' + opties(dd.regelsoorten) + '</select></div>' +
      '<div class="lb-rij"><input id="lbRD" type="date" title="Gedaan op" aria-label="Gedaan op">' +
      '<input id="lbRV" type="date" title="Volgende keer" aria-label="Volgende keer">' +
      '<input id="lbRK" type="number" placeholder="Kosten €" aria-label="Kosten in euro"></div>' +
      '<div class="lb-knoppen"><button class="knop hoofd" id="lbRAdd" type="button">Regel toevoegen</button></div>' +
      '<p class="lb-hint">Eerste datum: wanneer gedaan. Tweede datum: wanneer weer aan de beurt.</p></div>';
    h += '<h2>Historie</h2><div class="kaart">' +
      (regels.length ? regels.map(function (r) {
        return '<div class="lb-item"><div class="b"><b>' + esc(r.wat) + '</b> ' +
          '<span class="lb-soort">' + esc(r.soort) + '</span><br>' +
          '<small class="stil">' + [r.datum ? Geld.datum(r.datum) : '',
            r.volgende ? 'volgende: ' + Geld.datum(r.volgende) : '',
            r.kosten ? eu(r.kosten) : ''].filter(Boolean).join(' · ') + '</small></div>' +
          '<button class="knop lb-weg" data-regel="' + esc(r.id) + '" type="button" ' +
            'aria-label="Regel verwijderen">&times;</button></div>';
      }).join('') : '<p class="leeg">Nog geen regels.</p>') + '</div>';
    $('#lbVak').innerHTML = h;
  }

  /* Meenemen (shared/uitvoer.js), zoals de oude pagina: het register van
     objecten met dezelfde kolommen en dezelfde rauwe eurobedragen. */
  function model() {
    if (!d.getElementById('lbWrap') || !S.data || !(S.data.objecten || []).length) return null;
    return { naam: 'objecten',
      kolommen: ['naam', 'soort', 'merk', 'bouwjaar', 'registratie', 'regels', 'kosten'],
      rijen: S.data.objecten.map(function (o) {
        return [o.naam, o.soort || '', o.merk || '', o.bouwjaar || '',
          o.registratie || '', o.regelAantal || 0, o.kosten || 0];
      }) };
  }

  var Deel = w.RTGGeldDeel = w.RTGGeldDeel || {};
  Deel.logboek = { S: S, hoofd: hoofd, detail: detail, model: model };
})(window, document);
