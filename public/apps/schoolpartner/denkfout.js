/* RTG School Partner: het klasbeeld van de Misconception Graph.

   Wat hier staat is geen cijfer maar een les: dit denkpatroon is deze week
   elf keer langsgekomen bij dit leerdoel. Daar hoort een klassikale
   mini-uitleg bij -- en die maakt u beter, in plaats van u te vervangen.

   Twee dingen die dit scherm met opzet NIET kan. Het toont niet WIE, want dat
   wordt nergens vastgelegd: er staat een aantal en een datum in de klas, en
   verder niets. En het rekent niets uit over een kind -- er komt geen lijstje
   leerlingen uit, ook niet als u erom vraagt, omdat het er niet is.

   "Besproken" is geen opruimknop maar de werkwijze: een signaal dat u hebt
   behandeld hoort weg, anders staat er over een maand een berg die niets meer
   betekent.

   Zelfde SPart-patroon als de andere delen; app.js roept SPart.denkfout() aan. */
window.SPart = window.SPart || {};
window.SPart.denkfout = function () {
  var P = window.SPart, kl = P.kl, esc = P.esc, meld = P.meld;
  var vak = document.querySelector('#denkfoutVorm');
  if (!vak) return;

  function toon() {
    kl('/school/denkfout/klas').then(function (r) {
      if (r.body.error) { vak.innerHTML = '<p class="stil">' + esc(r.body.error) + '</p>'; return; }
      var p = r.body.patronen || [];
      vak.innerHTML = !p.length
        ? '<p class="stil">Er staat op dit moment geen denkpatroon open in deze klas. Dit vult zich vanzelf terwijl er geoefend wordt.</p>'
        : p.map(function (x) {
            return '<div class="item h-boven"><span><b>' + esc(x.naam) + '</b>' +
              ' <span class="stil">bij ' + esc(x.doelNaam) + '</span><br><span class="stil">' + esc(x.uitleg) + '</span></span>' +
              '<span class="rij"><span class="stil">' + x.aantal + 'x</span>' +
              '<button class="knop mini" data-doel="' + esc(x.doel) + '" data-df="' + esc(x.id) + '" type="button">Besproken</button></span></div>';
          }).join('') + '<p class="stil">' + esc(r.body.uitleg) + '</p>';
      vak.querySelectorAll('[data-df]').forEach(function (b) {
        b.addEventListener('click', function () {
          kl('/school/denkfout/besproken', { doel: b.dataset.doel, denkfout: b.dataset.df }).then(function (r2) {
            if (r2.body.error) return meld(r2.body.error);
            meld(r2.body.uitleg);
            toon();
          });
        });
      });
    });
  }
  toon();
};
