/* RTG School Partner: het Attention OS en het afronden van de les.

   Boven aan de werkbank een lijst in drie bakken -- nu, vandaag, kan wachten --
   in plaats van meldingen uit vijf hoeken van hetzelfde systeem. Onderaan de
   ene vraag van Teacher Flow: les afronden? Met een concept dat het systeem al
   heeft opgemaakt uit wat er vandaag gebeurde, en een handeling: bevestigen.

   Drie dingen die dit scherm met opzet NIET doet:
   - het toont niets over een kind. De server stuurt per regel alleen wat er
     wacht en hoeveel; de naam en de tekst van een hulpvraag staan op het scherm
     waar ze horen, achter de knop;
   - het houdt niets bij. Er is geen teller van hoe snel u uw lijst leeg heeft,
     en die kan er ook niet komen: de server bewaart de lijst niet;
   - het rondt niets vanzelf af. Zonder uw bevestiging en uw naam gebeurt er
     niets, net als bij een rapport.

   Zelfde SPart-patroon als de andere delen; app.js roept SPart.aandacht() aan. */
window.SPart = window.SPart || {};
window.SPart.aandacht = function () {
  var P = window.SPart, kl = P.kl, esc = P.esc, meld = P.meld;
  var q = function (id) { return document.getElementById(id); };
  var BAKKEN = [['nu', 'Nu'], ['vandaag', 'Voor het eind van de dag'], ['kanWachten', 'Kan wachten']];

  function lijst() {
    var vak = q('aandachtVorm');
    if (!vak) return;
    kl('/school/aandacht').then(function (r) {
      if (r.body.error) { vak.innerHTML = '<p class="stil">' + esc(r.body.error) + '</p>'; return; }
      var leeg = BAKKEN.every(function (b) { return !(r.body[b[0]] || []).length; });
      vak.innerHTML = (leeg
        ? '<p class="stil">Er staat op dit moment niets open. Dat is geen prestatie en geen reeks; het is gewoon zo.</p>'
        : BAKKEN.map(function (b) {
            var rijen = r.body[b[0]] || [];
            if (!rijen.length) return '';
            return '<div class="kop h-mt60">' + esc(b[1]) + '</div>' +
              rijen.map(function (x) {
                return '<div class="item h-boven"><span><b>' + esc(x.wat) + '</b>' +
                  (x.aantal > 1 ? ' <span class="stil">' + x.aantal + 'x</span>' : '') +
                  '<br><span class="stil">' + esc(x.waarom) + '</span></span></div>';
              }).join('');
          }).join('')) +
        '<p class="stil h-mt50">' + esc(r.body.uitleg) + '</p>';
    });
  }

  function les() {
    var vak = q('lesVorm');
    if (!vak) return;
    kl('/school/les/concept').then(function (r) {
      var d = r.body;
      if (d.error) { vak.innerHTML = '<p class="stil">' + esc(d.error) + '</p>'; return; }
      var standen = Object.keys(d.presentie.telling || {});
      vak.innerHTML =
        '<div class="stil">' + esc(d.datum) + ' &middot; ' +
        (d.presentie.gezet ? standen.map(function (s) { return d.presentie.telling[s] + 'x ' + esc(s); }).join(', ')
          : 'nog geen presentie gezet') + '</div>' +
        '<div class="stil">Aan de orde vandaag: ' + (d.doelen.length ? d.doelen.map(esc).join(', ') : 'niets gevonden') + '</div>' +
        (d.patronen.length ? '<div class="stil">' + d.patronen.length + ' denkpatroon (patronen) langsgekomen</div>' : '') +
        (d.alAfgerond ? '<p class="stil">Deze les is vandaag al afgerond.</p>' : '') +
        '<div class="rij h-mt50">' +
        '<input class="veld" id="lesDoor" maxlength="60" placeholder="Uw naam" aria-label="Uw naam">' +
        '<input class="veld" id="lesWerkte" maxlength="300" placeholder="Wat werkte?" aria-label="Wat werkte">' +
        '<input class="veld" id="lesVast" maxlength="300" placeholder="Waar liep het vast?" aria-label="Waar liep het vast">' +
        '<button class="knop p" id="lesAf" type="button">Les afronden</button></div>' +
        '<p class="stil">Wat u hier noteert komt terug bij dezelfde leerstof, ook als u er dan niet meer bent. Het gaat over de les; wie er was staat in de presentielijst.</p>' +
        '<div id="lesGeheugen"></div>';
      /* Teaching Memory: wat eerdere lessen over deze stof hebben opgeschreven.
         Niet alleen het kind leert; de les leert. Dit staat er VOOR het
         afronden, want dan heeft het nut. */
      if (d.doelen.length) geheugen(d.doelen[0]);
      q('lesAf').addEventListener('click', function () {
        var door = q('lesDoor').value.trim();
        if (!door) return meld('Zet uw naam erbij; een lesverslag zonder eigenaar is van niemand.');
        kl('/school/les/rond-af', { bevestigd: true, door: door, doelen: d.doelen,
          telling: d.presentie.telling, werkte: q('lesWerkte').value, liepVast: q('lesVast').value })
          .then(function (r2) {
            if (r2.body.error) return meld(r2.body.error);
            meld(r2.body.uitleg);
            les(); lijst();
          });
      });
    });
  }

  function geheugen(doel) {
    var vak = q('lesGeheugen');
    if (!vak) return;
    kl('/school/les/geheugen', { doel: doel }).then(function (r) {
      var d = r.body;
      if (d.error) return;
      vak.innerHTML = '<div class="kop h-mt60">Wat we van deze stof weten</div>' +
        (d.eerder.length
          ? d.eerder.map(function (x) {
              return '<div class="item h-boven"><span>' +
                (x.werkte ? '<b>Werkte:</b> ' + esc(x.werkte) + '<br>' : '') +
                (x.liepVast ? '<b>Liep vast:</b> ' + esc(x.liepVast) + '<br>' : '') +
                '<span class="stil">' + esc(x.klas) + ' &middot; ' + esc(x.datum) + ' &middot; ' + esc(x.door) + '</span></span></div>';
            }).join('')
          : '') +
        '<p class="stil">' + esc(d.uitleg) + '</p>';
    });
  }

  lijst();
  les();
};
