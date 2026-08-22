/* Personeel uitnodigen vanuit School Partner. De server levert de rollenkaart;
   dit scherm houdt dus geen tweede lijst met bevoegdheden bij. Een uitnodiging
   toont nooit zijn geheime link aan de directie: die gaat rechtstreeks naar
   het persoonlijke schoolmailadres. */
(function () {
  'use strict';
  var A, S, esc, meld, wortel;
  var sleutels = function (extra) {
    var b = { schoolCode:S.code, beheerToken:S.token }, k;
    for (k in (extra || {})) if (Object.prototype.hasOwnProperty.call(extra, k)) b[k]=extra[k];
    return b;
  };
  function bind(api, sessie, escape, melder) {
    A=api; S=sessie; esc=escape; meld=melder; wortel=document.getElementById('dUitnodigen');
    if (wortel) teken();
  }
  function teken() {
    Promise.all([A('/school/rollen', sleutels()), A('/school/personeel/uitnodigingen', sleutels())])
      .then(function (r) {
        var kaart=r[0].body, lijst=r[1].body;
        if (kaart.error || lijst.error) { wortel.innerHTML=''; return; }
        var rollen=(kaart.rollen || []).filter(function (x) { return x.id !== 'directie'; });
        var open=(lijst.uitnodigingen || []).filter(function (x) { return x.status === 'open'; });
        var actief=(kaart.personeel || []).filter(function (x) { return x.status === 'actief'; });
        wortel.innerHTML='<div class="deel">Personeel persoonlijk toelaten</div><div class="kaart">' +
          '<div class="kop">Nieuwe medewerker uitnodigen</div>' +
          '<p class="stil">Gebruik het persoonlijke schoolmailadres. De medewerker krijgt een eenmalige link van 48 uur en alleen de gekozen beginrol.</p>' +
          '<div class="rij"><input class="veld" id="piNaam" maxlength="60" placeholder="Naam medewerker" aria-label="Naam medewerker">' +
          '<input class="veld" id="piEmail" type="email" maxlength="254" placeholder="naam@school.nl" autocomplete="off" aria-label="Schoolmail medewerker">' +
          '<select class="veld" id="piRol" aria-label="Beginrol">' + rollen.map(function (x) {
            return '<option value="' + esc(x.id) + '">' + esc(x.naam) + '</option>';
          }).join('') + '</select><button class="knop p" id="piStuur" type="button">Nodig persoonlijk uit</button></div></div>' +
          (open.length ? '<div class="kaart"><div class="kop">Open uitnodigingen</div>' + open.map(function (x) {
            return '<div class="item"><span>' + esc(x.naam) + ' <span class="stil">· ' + esc(x.email) + ' · tot ' + esc(String(x.verlooptAt).slice(0,16).replace('T',' ')) + '</span></span>' +
              '<button class="knop" type="button" data-intrek="' + esc(x.id) + '">Intrekken</button></div>';
          }).join('') + '</div>' : '') +
          (actief.length ? '<div class="kaart"><div class="kop">Actieve toegang intrekken</div><p class="stil">Intrekken maakt ook reeds geopende personeelssleutels onmiddellijk ongeldig.</p>' + actief.map(function (p) {
            return '<div class="item"><span>' + esc(p.naam) + ' <span class="stil">· ' + (p.rollen || []).map(esc).join(', ') + '</span></span>' +
              '<button class="knop" type="button" data-toegang-weg="' + esc(p.id) + '">Trek toegang in</button></div>';
          }).join('') + '</div>' : '');
        document.getElementById('piStuur').addEventListener('click', function () {
          A('/school/personeel/uitnodig', sleutels({ naam:document.getElementById('piNaam').value,
            email:document.getElementById('piEmail').value, rollen:[document.getElementById('piRol').value] }))
            .then(function (uit) { meld(uit.body.error || 'Persoonlijke uitnodiging verstuurd.'); if (!uit.body.error) teken(); });
        });
        Array.prototype.forEach.call(wortel.querySelectorAll('[data-intrek]'), function (b) {
          b.addEventListener('click', function () {
            A('/school/personeel/uitnodiging/intrek', sleutels({ uitnodigingId:b.dataset.intrek }))
              .then(function (uit) { meld(uit.body.error || 'Uitnodiging ingetrokken.'); teken(); });
          });
        });
        Array.prototype.forEach.call(wortel.querySelectorAll('[data-toegang-weg]'), function (b) {
          b.addEventListener('click', function () {
            if (!confirm('Deze medewerker verliest onmiddellijk alle schooltoegang. Doorgaan?')) return;
            A('/school/personeel/toegang/intrek', sleutels({ personeelId:b.dataset.toegangWeg }))
              .then(function (uit) { meld(uit.body.error || 'Personeelstoegang ingetrokken.'); teken(); });
          });
        });
      });
  }
  window.RTGSchoolPersoneelsbeheer={ bind:bind };
})();
