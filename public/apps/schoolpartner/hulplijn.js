/* RTG School Partner, golf 5: de hulplijn voor de mentor. Acuut staat altijd
   bovenaan; oppakken gebeurt met een menselijke notitie ("morgen even samen
   zitten"), en het kind ziet die status terug. Vertrouwelijke meldingen zijn
   hier gewoon zichtbaar (de mentor is de vertrouwenspersoon), maar het label
   herinnert eraan dat de ouders deze NIET zien. Zelfde SPart-patroon als
   toetsen.js; app.js roept SPart.hulplijn() aan in de werkbank. */
window.SPart = window.SPart || {};
window.SPart.hulplijn = function () {
  var P = window.SPart, kl = P.kl, esc = P.esc, meld = P.meld;
  var $ = function (s) { return document.querySelector(s); };
  kl('/school/hulplijn/klas').then(function (r) {
    var m = (r.body && r.body.meldingen) || [];
    $('#hulpLijst').innerHTML = m.map(function (x) {
      var labels = (x.acuut ? '<span class="tag aan">acuut</span> ' : '') +
        (x.vertrouwelijk ? '<span class="tag">vertrouwelijk: ouders zien dit niet</span> ' : '') +
        '<span class="tag">' + esc(x.status) + '</span>';
      return '<div class="item"><span><b>' + esc(x.naam) + '</b> <span class="stil">' + esc(String(x.at).slice(0, 10)) + '</span><br>' +
        esc(x.tekst) + (x.notitie ? '<br><span class="stil">jouw notitie: ' + esc(x.notitie) + '</span>' : '') + '</span>' +
        '<span>' + labels + (x.status === 'open' ? ' <button class="knop p" data-hulp-op="' + esc(x.id) + '">Oppakken</button>' : '') + '</span></div>';
    }).join('') || '<p class="stil">Geen meldingen. De knop staat altijd op het scherm van elk kind; jij ziet het hier meteen.</p>';
    Array.prototype.forEach.call(document.querySelectorAll('[data-hulp-op]'), function (b) {
      b.addEventListener('click', function () {
        var notitie = window.prompt('Wat spreek je af of doe je nu? Het kind ziet dat het gezien is (niet je notitie).');
        if (notitie == null) return;
        kl('/school/hulplijn/oppakken', { id: b.dataset.hulpOp, notitie: notitie })
          .then(function (r2) { meld(r2.body.error || 'Opgepakt; het kind ziet dat je het gezien hebt.'); P.hulplijn(); });
      });
    });
  });
};
