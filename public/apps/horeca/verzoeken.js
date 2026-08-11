/* RTG Horeca (scherm): de verzoeken van gasten, op het dienstscherm.

   Dit staat BOVEN de open rekeningen en niet eronder, en dat is de hele
   ontwerpkeuze: een gast die iets vraagt wacht, en wachten is het enige op dit
   scherm waar tijd doorheen loopt. Een rekening loopt niet weg.

   DRIE DINGEN DIE DE LIJST EERLIJK HOUDEN

   1. HET GETAL STAAT ER ALTIJD. Elk verzoek draagt hoeveel minuten het open
      staat. De klasse `laat` volgt uit dat getal en uit de soort; wie het
      accent niet ziet, leest de minuten. Dezelfde regel als op het
      keukenscherm: tijd is een feit, geen kleurtje.
   2. TWEE KNOPPEN EN NIET EEN. "Ik ga" en "gedaan" zijn verschillende dingen.
      Zonder die tussenstand lopen er op een drukke avond twee mensen naar
      dezelfde tafel, of geen.
   3. ER STAAT NERGENS EEN BELOOFDE TIJD. Niet in de kop, niet bij een regel.
      Wat we niet weten zeggen we niet. */
(function () {
  'use strict';
  var K = window.RTGHoreca;
  function $(id) { return document.getElementById(id); }
  var esc = K.esc;

  function teken(d) {
    $('vzAantal').textContent = d.aantal;
    $('vzOud').textContent = d.oud;
    $('vzOudVak').hidden = !d.oud;
    $('vzLijst').innerHTML = (d.verzoeken || []).map(function (v) {
      var knoppen = v.stand === 'open'
        ? K.knop('Ik ga', { vzop: v.id }, true) + ' ' + K.knop('Gedaan', { vzklaar: v.id })
        : K.knop('Gedaan', { vzklaar: v.id }, true);
      return '<div class="item' + (v.oud ? ' laat' : '') + '">' +
        '<span><b>' + esc(v.naam) + '</b> <span class="stil">· ' + esc(v.tafel || 'zonder tafel') +
        ' · ' + esc(v.door) + '</span>' +
        (v.tekst ? '<div class="stil">' + esc(v.tekst) + '</div>' : '') +
        '<div class="stil">' + v.minuten + ' min' +
        (v.stand === 'opgepakt' ? ' · opgepakt door ' + esc(v.opgepaktDoor || 'een collega') : '') +
        '</div></span><span>' + knoppen + '</span></div>';
    }).join('') || '<p class="stil">Geen openstaande verzoeken.</p>';

    K.bind($('vzLijst'), 'vzop', function (b) { zet(b.getAttribute('data-vzop'), 'opgepakt'); });
    K.bind($('vzLijst'), 'vzklaar', function (b) { zet(b.getAttribute('data-vzklaar'), 'klaar'); });
  }

  function laad() {
    K.api('/verzoeken', {}).then(function (r) {
      if (r.body.error) return K.meld(r.body.error);
      teken(r.body);
    });
  }

  function zet(id, stand) {
    K.api('/verzoeken/zet', { verzoek: id, stand: stand }).then(function (r) {
      if (r.body.error) return K.meld(r.body.error);
      laad();
    });
  }

  window.RTGHorecaVerzoeken = { laad: laad };
  if ($('vzLijst') && K.poort()) laad();
})();
