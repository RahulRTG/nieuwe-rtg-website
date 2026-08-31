/* SUDOKU in de RTG Store.

   WAT ER ANDERS IS DAN BIJ DE SUDOKU VAN HET HUIS, en het hoort hier te staan
   omdat het een echte concessie is. De Sudoku van RTG zelf (kern/spellen/sudoku.js)
   maakt de puzzel op de SERVER, houdt de oplossing voor zichzelf en klokt de tijd
   op zijn eigen klok -- juist zodat een score geen bewering is. Dat kan hier niet:
   een cel heeft geen netwerk, dus de puzzel wordt hier gemaakt en de tijd hier
   geklokt.

   Gevolg: de tijd die naar de arena gaat, is een bewering van deze app. Dat is te
   dragen omdat het bord van een app apart staat en nooit dat van het huis raakt
   (kern/appstore/arena.js, grens 1). Wie een narekenbare score wil, hoort de
   RTG-versie te spelen -- en dat is precies waarom die versie blijft bestaan.

   De generator: een gevulde oplossing via backtracking op een geschudde volgorde,
   daarna gaten erin. Er wordt niet gecontroleerd of de puzzel maar EEN oplossing
   heeft; dat kost op een telefoon meer dan het oplevert, en een tweede oplossing
   maakt hem hooguit makkelijker. Ook dat is een keuze en geen vergetelheid. */
(function () {
  'use strict';
  var $ = function (s) { return document.getElementById(s); };

/* HET BORD, EN WAAROM HET NOOIT EEN FOUT TOONT DIE HET NIET IS.
  
     `arena.zet` heeft drie uitkomsten en maar een ervan is een storing. Bewaard,
     niet bewaard (de speler haalt de 18+-poort van RTG niet -- en dan speelt het
     spel gewoon door), of de machtiging is er niet. Alleen dat laatste is iets
     wat de speler kan veranderen, en dus is dat het enige waar deze app iets over
     zegt. Een spel dat "er ging iets mis" toont omdat een kind speelt, straft het
     kind voor onze regel. */
  var ARENA = { periode: 'altijd', laatste: null };
  function stuurScore(punten, klaar) {
    if (!window.RTG) return klaar && klaar(null);
    window.RTG.roep('arena.zet', { score: punten }).then(function (r) {
      ARENA.laatste = r;
      tekenBord();
      if (klaar) klaar(r);
    }).catch(function (e) {
      ARENA.laatste = { bewaard: false, ranglijst: false, reden: e.code === 'RTG_MACHTIGING_NIET_VERLEEND'
        ? 'Je hebt de ranglijst uitgezet voor deze app. Het spel telt gewoon door; zet hem aan in de App Store als je weer mee wilt doen.'
        : e.message };
      tekenBord();
      if (klaar) klaar(null);
    });
  }
  function tekenBord() {
    var vak = document.getElementById('bord');
    if (!vak || !window.RTG) return;
    window.RTG.roep('arena.bord', { periode: ARENA.periode }).then(function (b) {
      var uit = '<h2>Arena van dit spel</h2>';
      uit += '<div class="tabs">'
        + '<button type="button" data-p="altijd"' + (ARENA.periode === 'altijd' ? ' class="aan"' : '') + '>Altijd</button>'
        + '<button type="button" data-p="week"' + (ARENA.periode === 'week' ? ' class="aan"' : '') + '>Deze week</button></div>';
      if (!b.ranglijst) {
        uit += '<p class="melding">' + tekst(b.reden) + '</p>';
      } else if (!b.bord.length) {
        uit += '<p class="melding">Nog geen scores. De eerste die iets neerzet, staat bovenaan.</p>';
      } else {
        uit += b.bord.map(function (r) {
          return '<div class="bordrij' + (r.ik ? ' ik' : '') + '"><span class="pl">' + r.plaats + '</span>'
            + '<span class="nm">' + tekst(r.codenaam) + '</span>'
            + '<span class="sc">' + r.score + ' ' + tekst(b.vorm.eenheid) + '</span></div>';
        }).join('');
        if (b.ik && b.ik.buitenBord) {
          uit += '<div class="bordrij ik"><span class="pl">' + b.ik.plaats + '</span><span class="nm">jij</span>'
            + '<span class="sc">' + b.ik.score + ' ' + tekst(b.vorm.eenheid) + '</span></div>';
        }
        uit += '<p class="melding">' + b.deelnemers + ' spelers op dit bord. Alleen van deze app: RTG houdt het bord van elke app apart.</p>';
      }
      vak.innerHTML = uit;
      var kn = vak.querySelectorAll('[data-p]');
      for (var i = 0; i < kn.length; i++) {
        kn[i].addEventListener('click', function () { ARENA.periode = this.getAttribute('data-p'); tekenBord(); });
      }
    }).catch(function (e) {
      vak.innerHTML = '<h2>Arena van dit spel</h2><p class="melding">' + tekst(
        e.code === 'RTG_MACHTIGING_NIET_VERLEEND'
          ? 'De ranglijst staat uit voor deze app. Je speelt gewoon door.'
          : e.message) + '</p>';
    });
  }
  function tekst(t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  var GATEN = { makkelijk: 40, normaal: 50, moeilijk: 56 };
  var S = { opgave: [], oplossing: [], nu: [], gekozen: null, niveau: 'normaal', begin: 0, klok: null, klaar: false };

  function mag(bord, i, w) {
    var r = Math.floor(i / 9), k = i % 9, br = Math.floor(r / 3) * 3, bk = Math.floor(k / 3) * 3, j;
    for (j = 0; j < 9; j++) {
      if (bord[r * 9 + j] === w && r * 9 + j !== i) return false;
      if (bord[j * 9 + k] === w && j * 9 + k !== i) return false;
    }
    for (var a = 0; a < 3; a++) for (var b = 0; b < 3; b++) {
      var p = (br + a) * 9 + bk + b;
      if (bord[p] === w && p !== i) return false;
    }
    return true;
  }
  function schud(a) {
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function vul(bord, i) {
    if (i === 81) return true;
    var kandidaten = schud([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    for (var n = 0; n < 9; n++) {
      if (mag(bord, i, kandidaten[n])) {
        bord[i] = kandidaten[n];
        if (vul(bord, i + 1)) return true;
        bord[i] = 0;
      }
    }
    return false;
  }
  function nieuw() {
    var bord = new Array(81).fill(0);
    vul(bord, 0);
    S.oplossing = bord.slice();
    var plaatsen = schud(Array.from({ length: 81 }, function (_, i) { return i; })).slice(0, GATEN[S.niveau]);
    S.opgave = bord.slice();
    plaatsen.forEach(function (i) { S.opgave[i] = 0; });
    S.nu = S.opgave.slice();
    S.gekozen = null; S.klaar = false;
    S.begin = Date.now();
    clearInterval(S.klok);
    S.klok = setInterval(tik, 1000);
    tik(); teken();
    $('uitleg').textContent = 'Kies een vakje en daarna een cijfer. De klok loopt.';
  }
  function tik() {
    var s = Math.floor((Date.now() - S.begin) / 1000);
    $('klok').textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }
  function teken() {
    var el = $('rooster');
    el.innerHTML = S.nu.map(function (w, i) {
      var k = i % 9, r = Math.floor(i / 9), kl = [];
      if (S.opgave[i]) kl.push('vast');
      if (S.gekozen === i) kl.push('aan');
      if (w && !S.opgave[i] && !mag(S.nu, i, w)) kl.push('fout');
      if (k === 2 || k === 5) kl.push('blokr');
      if (r === 2 || r === 5) kl.push('bloko');
      return '<button type="button" class="' + kl.join(' ') + '" data-i="' + i + '"'
        + (S.opgave[i] ? ' disabled' : '') + '>' + (w || '') + '</button>';
    }).join('');
    var kn = el.querySelectorAll('[data-i]');
    for (var i = 0; i < kn.length; i++) {
      kn[i].addEventListener('click', function () { S.gekozen = Number(this.getAttribute('data-i')); teken(); });
    }
  }
  function zetCijfer(w) {
    if (S.gekozen == null || S.klaar) return;
    S.nu[S.gekozen] = w;
    teken();
    if (S.nu.every(function (x, i) { return x === S.oplossing[i]; })) af();
  }
  function af() {
    S.klaar = true;
    clearInterval(S.klok);
    var seconden = Math.max(1, Math.round((Date.now() - S.begin) / 1000));
    bewaarBeste(seconden);
    stuurScore(seconden, function (r) {
      $('uitleg').textContent = 'Opgelost in ' + seconden + ' seconden.'
        + (r && r.bewaard ? (r.persoonlijkRecord ? ' Persoonlijk record!' : '') : (r && r.reden ? ' ' + r.reden : ''));
    });
  }
  function bewaarBeste(seconden) {
    if (!window.RTG) return;
    window.RTG.roep('opslag.lees', { sleutel: 'beste-' + S.niveau }).then(function (r) {
      var oud = Number(r && r.waarde) || 0;
      if (!oud || seconden < oud) {
        $('beste').textContent = seconden + 's';
        return window.RTG.roep('opslag.zet', { sleutel: 'beste-' + S.niveau, waarde: String(seconden) });
      }
    }).catch(function () {});
  }
  function toonBeste() {
    if (!window.RTG) return;
    window.RTG.roep('opslag.lees', { sleutel: 'beste-' + S.niveau })
      .then(function (r) { $('beste').textContent = r && r.waarde ? r.waarde + 's' : '–'; })
      .catch(function () {});
  }

  $('cijfers').innerHTML = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(function (n) {
    return '<button type="button" data-w="' + n + '">' + n + '</button>';
  }).join('') + '<button type="button" data-w="0" aria-label="Wissen">&#9003;</button>';
  var cij = $('cijfers').querySelectorAll('[data-w]');
  for (var i = 0; i < cij.length; i++) {
    cij[i].addEventListener('click', function () { zetCijfer(Number(this.getAttribute('data-w'))); });
  }
  var niv = document.querySelectorAll('[data-n]');
  for (var j = 0; j < niv.length; j++) {
    niv[j].addEventListener('click', function () {
      S.niveau = this.getAttribute('data-n');
      for (var k = 0; k < niv.length; k++) niv[k].classList.toggle('aan', niv[k] === this);
      $('niveauNaam').textContent = S.niveau;
      if (window.RTG) window.RTG.roep('opslag.zet', { sleutel: 'niveau', waarde: S.niveau }).catch(function () {});
      toonBeste();
      nieuw();
    });
  }
  document.addEventListener('keydown', function (e) {
    if (/^[1-9]$/.test(e.key)) { e.preventDefault(); zetCijfer(Number(e.key)); }
    if (e.key === 'Backspace' || e.key === 'Delete') { e.preventDefault(); zetCijfer(0); }
  });

  if (window.RTG) {
    window.RTG.roep('opslag.lees', { sleutel: 'niveau' }).then(function (r) {
      if (r && r.waarde && GATEN[r.waarde]) {
        S.niveau = r.waarde;
        $('niveauNaam').textContent = S.niveau;
        for (var k = 0; k < niv.length; k++) niv[k].classList.toggle('aan', niv[k].getAttribute('data-n') === S.niveau);
      }
      toonBeste();
      nieuw();
    }).catch(function () { nieuw(); });
  } else {
    nieuw();
  }
  tekenBord();
})();
