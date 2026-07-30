/* RTG Galerij, de kijker: een beeld groot, bladeren met de pijlen (ook op
   het toetsenbord), favoriet, in een album zetten en de diavoorstelling.
   De diavoorstelling stopt bij elke eigen handeling: de kijker is de baas,
   niet de klok. Praat via window.RTGGalerij (app.js). */
(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };
  var G = function () { return window.RTGGalerij; };
  var lijst = [], plek = -1, dia = null;
  var MAANDEN = ['januari', 'februari', 'maart', 'april', 'mei', 'juni',
    'juli', 'augustus', 'september', 'oktober', 'november', 'december'];

  function huidig() { return lijst[plek] || null; }
  function datumTekst(op) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(op || ''));
    return m ? +m[3] + ' ' + MAANDEN[+m[2] - 1] + ' ' + m[1] : '';
  }
  function toon() {
    var b = huidig();
    if (!b) return dicht();
    var img = $('#kkBeeld');
    img.alt = b.naam || (b.uit === 'De Salon' ? 'Beeld uit De Salon' : 'Beeld');
    if (b.src) img.src = b.src;
    else {
      var klaar = G().thumbData(b.id);
      if (klaar) img.src = klaar;
      else {
        img.removeAttribute('src');
        G().api('bestanden/haal', { id: b.id }).then(function (r) {
          if (!r.body.error && huidig() === b) img.src = r.body.dataUrl;
        });
      }
    }
    $('#kkMeta').textContent = (b.naam ? b.naam + ' · ' : '') + b.uit +
      (b.op ? ' · ' + datumTekst(b.op) : '') + ' · ' + (plek + 1) + ' van ' + lijst.length;
    $('#kkFav').textContent = b.favoriet ? 'Favoriet eraf' : 'Favoriet';
    var albums = (G().stand().albums || []);
    $('#kkAlbum').innerHTML = albums.length
      ? albums.map(function (a) { return '<option value="' + a.id + '">' + a.naam.replace(/</g, '&lt;') + '</option>'; }).join('')
      : '<option value="">(nog geen albums)</option>';
  }
  function open(sleutel, beelden) {
    lijst = beelden || [];
    plek = lijst.findIndex(function (b) { return b.bron + ':' + b.id === sleutel; });
    if (plek < 0) return;
    $('#kkScrim').classList.add('open');
    toon();
  }
  function dicht() {
    stopDia();
    $('#kkScrim').classList.remove('open');
    lijst = []; plek = -1;
  }
  function stap(d) {
    if (!lijst.length) return;
    plek = (plek + d + lijst.length) % lijst.length;
    toon();
  }

  /* ---- de diavoorstelling: rustig tempo, stopt bij elke eigen handeling ---- */
  function startDia() {
    stopDia();
    dia = setInterval(function () { stap(1); }, 4000);
    $('#kkDia').classList.add('aan');
    $('#kkDia').textContent = 'Stop';
  }
  function stopDia() {
    if (dia) clearInterval(dia);
    dia = null;
    $('#kkDia').classList.remove('aan');
    $('#kkDia').textContent = 'Diavoorstelling';
  }

  $('#kkDicht').addEventListener('click', dicht);
  $('#kkVorige').addEventListener('click', function () { stopDia(); stap(-1); });
  $('#kkVolgende').addEventListener('click', function () { stopDia(); stap(1); });
  $('#kkDia').addEventListener('click', function () { dia ? stopDia() : startDia(); });
  $('#kkFav').addEventListener('click', function () {
    var b = huidig(); if (!b) return;
    stopDia();
    G().api('galerij/favoriet', { item: { bron: b.bron, id: b.id }, aan: !b.favoriet }).then(function (r) {
      if (r.body.error) return G().meld(r.body.error);
      b.favoriet = !b.favoriet;
      toon();
      G().laad();
    });
  });
  $('#kkZet').addEventListener('click', function () {
    var b = huidig(), album = $('#kkAlbum').value;
    if (!b || !album) return G().meld('Maak eerst een album (+ Album).');
    stopDia();
    G().api('galerij/zet', { album: album, item: { bron: b.bron, id: b.id } }).then(function (r) {
      if (r.body.error) return G().meld(r.body.error);
      G().meld('In het album gezet; het beeld blijft gewoon waar het is.');
      G().laad();
    });
  });
  document.addEventListener('keydown', function (e) {
    if (!$('#kkScrim').classList.contains('open')) return;
    if (e.key === 'Escape') dicht();
    if (e.key === 'ArrowLeft') { stopDia(); stap(-1); }
    if (e.key === 'ArrowRight') { stopDia(); stap(1); }
  });

  window.RTGGalerijKijker = { open: open };
})();
