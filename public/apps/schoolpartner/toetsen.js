/* RTG School Partner, deel twee: de toetsenlijst met uitslagen per leerling,
   het cijfer met een tik (voorstel blijft advies) en het MO-gesprek waarin
   de leraar de vragen met antwoorden ziet en afvinkt. Draait op het gedeelde
   SPart-object uit app.js; dit bestand laadt EERST zodat app.js hem kent. */
window.SPart = window.SPart || {};
window.SPart.toetslijst = function () {
  var P = window.SPart, kl = P.kl, esc = P.esc, meld = P.meld;
  var $ = function (s) { return document.querySelector(s); };
    kl('/school/toets/lijst').then(function (r) {
      $('#tLijst').innerHTML = (r.body.toetsen || []).map(function (t) {
        var rijen = t.leerlingen.map(function (l) {
          var st = l.becijferd ? '<span class="tag aan">becijferd</span>'
            : l.uitslag ? '<button class="knop p" data-cijfer="' + esc(t.id) + '|' + esc(l.sleutel) + '">Cijfer (voorstel ' + l.uitslag.voorstel + ')</button>'
            : t.soort === 'mo' ? '<button class="knop" data-mo="' + esc(t.id) + '|' + esc(l.sleutel) + '">MO afnemen</button>'
            : '<span class="tag">' + (l.bezig ? 'bezig' : 'nog niet gemaakt') + '</span>';
          return '<div class="item"><span>' + esc(l.naam) + (l.uitslag ? ' <span class="stil">' + l.uitslag.goed + '/' + l.uitslag.totaal + '</span>' : '') + '</span>' + st + '</div>';
        }).join('');
        return '<div style="margin-bottom:.7rem;"><div class="rij"><b>' + esc(t.naam) + '</b><span class="tag">' + esc(t.soort.toUpperCase()) + '</span>' +
          (t.status === 'open' ? '<button class="knop" data-sluit="' + esc(t.id) + '">Sluit de toets</button>' : '<span class="tag">gesloten</span>') +
          '<span class="stil">' + t.doelen.map(function (d) { return esc(d.naam); }).join(' · ') + '</span></div>' + rijen + '</div>';
      }).join('') || '<p class="stil">Nog geen toetsen. Vink hierboven leerdoelen aan en zet er een klaar.</p>';
      Array.prototype.forEach.call(document.querySelectorAll('[data-sluit]'), function (b) {
        b.addEventListener('click', function () {
          /* Sluiten is definitief voor wie nog niet begonnen is; daarom eerst
             de vraag, en niet stilletjes op de eerste tik. */
          if (!window.confirm('De toets sluiten? Wie nog niet begonnen is, kan hem daarna niet meer maken.')) return;
          kl('/school/toets/sluit', { toetsId: b.dataset.sluit })
            .then(function (r2) { meld(r2.body.error || 'De toets is gesloten.'); P.toetslijst(); });
        });
      });
      Array.prototype.forEach.call(document.querySelectorAll('[data-cijfer]'), function (b) {
        b.addEventListener('click', function () {
          var d = b.dataset.cijfer.split('|');
          kl('/school/toets/cijfer', { toetsId: d[0], leerling: d[1] })
            .then(function (r2) { meld(r2.body.error || 'Cijfer ' + r2.body.cijfer.cijfer + ' staat in het boek.'); P.werkbank(); });
        });
      });
      Array.prototype.forEach.call(document.querySelectorAll('[data-mo]'), function (b) {
        b.addEventListener('click', function () {
          var d = b.dataset.mo.split('|');
          kl('/school/toets/mo', { toetsId: d[0], leerling: d[1] }).then(function (r2) {
            if (r2.body.error) return meld(r2.body.error);
            var tekst = r2.body.vragen.map(function (v, i) { return (i + 1) + '. ' + v.v + '\n   antwoord: ' + v.a; }).join('\n');
            var goed = window.prompt('Mondeling met ' + r2.body.naam + ':\n\n' + tekst + '\n\nHoeveel had ' + r2.body.naam + ' er goed (0-' + r2.body.vragen.length + ')?');
            if (goed == null) return;
            kl('/school/toets/mo-invoer', { toetsId: d[0], leerling: d[1], goed: Number(goed) })
              .then(function (r3) { meld(r3.body.error || 'Uitslag vastgelegd; voorstel ' + r3.body.uitslag.voorstel + '.'); P.toetslijst(); });
          });
        });
      });
    });
};
