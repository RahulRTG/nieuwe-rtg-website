/* TETRIS in de RTG Store.

   De spelregels draaien in de client, en dat betekent dat de score een BEWERING
   van deze app is en geen meting van RTG. Dat is te dragen omdat het bord van
   deze app apart staat (kern/appstore/arena.js, grens 1): een verzonnen score
   raakt nooit de ranglijsten van het huis. Wie een spel wil waarvan de score
   narekenbaar is, moet de regels op de server zetten -- en dat kan in een cel
   niet, want een cel heeft geen netwerk. Dat staat hier zodat niemand het later
   voor bewijs aanziet.

   De motor is dezelfde als die van RTG Spelen (public/apps/spelen.html); wat
   verschilt is waar de score heen gaat en dat er hier geen server is. */
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

  var TT = { b: 10, h: 20, veld: [], stuk: null, x: 0, y: 0, rot: 0, score: 0, lijnen: 0, timer: null, dood: true };
  var STUKKEN = [
    [[[0,1],[1,1],[2,1],[3,1]],'#5B8FE0'], [[[0,0],[0,1],[1,1],[2,1]],'#E0B24A'],
    [[[2,0],[0,1],[1,1],[2,1]],'#B07AC0'], [[[1,0],[2,0],[1,1],[2,1]],'#E6C64A'],
    [[[1,0],[2,0],[0,1],[1,1]],'#5FA56A'], [[[1,0],[0,1],[1,1],[2,1]],'#E05B5B'],
    [[[0,0],[1,0],[1,1],[2,1]],'#6AA6C9'] ];

  function draai(blokken, rot) {
    var b = blokken;
    for (var i = 0; i < rot; i++) b = b.map(function (p) { return [3 - p[1] - 1, p[0]]; });
    var minx = Math.min.apply(null, b.map(function (p) { return p[0]; }));
    var miny = Math.min.apply(null, b.map(function (p) { return p[1]; }));
    return b.map(function (p) { return [p[0] - minx, p[1] - miny]; });
  }
  function past(blokken, px, py) {
    return blokken.every(function (p) {
      var nx = px + p[0], ny = py + p[1];
      return nx >= 0 && nx < TT.b && ny < TT.h && (ny < 0 || !TT.veld[ny * TT.b + nx]);
    });
  }
  function nieuwStuk() {
    TT.stuk = STUKKEN[Math.floor(Math.random() * STUKKEN.length)]; TT.rot = 0; TT.x = 3; TT.y = -1;
    if (!past(draai(TT.stuk[0], 0), TT.x, TT.y)) dood();
  }
  function vast() {
    draai(TT.stuk[0], TT.rot).forEach(function (p) {
      var ny = TT.y + p[1]; if (ny >= 0) TT.veld[ny * TT.b + TT.x + p[0]] = TT.stuk[1];
    });
    var vol = 0;
    for (var r = TT.h - 1; r >= 0; r--) {
      var rij = [], k;
      for (k = 0; k < TT.b; k++) rij.push(TT.veld[r * TT.b + k]);
      if (rij.every(Boolean)) {
        TT.veld.splice(r * TT.b, TT.b);
        for (k = 0; k < TT.b; k++) TT.veld.unshift(null);
        vol++; r++;
      }
    }
    if (vol) { TT.lijnen += vol; TT.score += [0, 40, 100, 300, 1200][vol] * (1 + Math.floor(TT.lijnen / 10)); }
    nieuwStuk();
  }
  function stap() { if (past(draai(TT.stuk[0], TT.rot), TT.x, TT.y + 1)) TT.y++; else vast(); teken(); }
  function teken() {
    var cv = $('bord2d'), c = cv.getContext('2d'), cel = cv.width / TT.b;
    c.clearRect(0, 0, cv.width, cv.height);
    TT.veld.forEach(function (kl, i) {
      if (kl) { c.fillStyle = kl; c.fillRect((i % TT.b) * cel + 1, Math.floor(i / TT.b) * cel + 1, cel - 2, cel - 2); }
    });
    if (TT.stuk && !TT.dood) {
      c.fillStyle = TT.stuk[1];
      draai(TT.stuk[0], TT.rot).forEach(function (p) {
        if (TT.y + p[1] >= 0) c.fillRect((TT.x + p[0]) * cel + 1, (TT.y + p[1]) * cel + 1, cel - 2, cel - 2);
      });
    }
    $('score').textContent = TT.score; $('lijnen').textContent = TT.lijnen;
  }
  function dood() {
    clearInterval(TT.timer); TT.dood = true;
    $('start').textContent = 'Opnieuw';
    var punten = TT.score;
    bewaarBeste(punten);
    /* EEN NUL GAAT NIET NAAR HET BORD. Wie meteen af is, heeft niets neergezet;
       een ranglijst die met nullen volloopt, zegt niets over spelen. */
    if (!punten) { $('uitleg').textContent = 'Nul punten -- die gaat niet naar de arena. Probeer het nog eens.'; return; }
    stuurScore(punten, function (r) {
      $('uitleg').textContent = r && r.bewaard
        ? (r.persoonlijkRecord ? 'Persoonlijk record: ' + punten + ' punten.' : 'Klaar: ' + punten + ' punten.')
        : (r && r.reden ? 'Klaar: ' + punten + ' punten. ' + r.reden : 'Klaar: ' + punten + ' punten.');
    });
  }
  function zet(wat) {
    if (TT.dood) return;
    if (wat === 'draai') {
      var nr = (TT.rot + 1) % 4, k = [0, -1, 1];
      for (var i = 0; i < k.length; i++) {
        if (past(draai(TT.stuk[0], nr), TT.x + k[i], TT.y)) { TT.rot = nr; TT.x += k[i]; break; }
      }
    } else if (wat === 'val') {
      while (past(draai(TT.stuk[0], TT.rot), TT.x, TT.y + 1)) TT.y++;
      vast();
    } else {
      var dx = wat === 'links' ? -1 : 1;
      if (past(draai(TT.stuk[0], TT.rot), TT.x + dx, TT.y)) TT.x += dx;
    }
    teken();
  }

  /* De beste score van dit toestel staat in het eigen potje, en dat is iets
     anders dan de arena: het potje is van jou alleen en werkt ook zonder de
     18+-poort. Faalt het -- de machtiging is er niet -- dan gebeurt er niets. */
  function bewaarBeste(punten) {
    if (!window.RTG) return;
    window.RTG.roep('opslag.lees', { sleutel: 'beste' }).then(function (r) {
      var oud = Number(r && r.waarde) || 0;
      if (punten > oud) {
        $('beste').textContent = punten;
        return window.RTG.roep('opslag.zet', { sleutel: 'beste', waarde: String(punten) });
      }
    }).catch(function () {});
  }

  $('start').addEventListener('click', function () {
    TT.veld = []; for (var i = 0; i < TT.b * TT.h; i++) TT.veld.push(null);
    TT.score = 0; TT.lijnen = 0; TT.dood = false; this.textContent = 'Opnieuw';
    $('uitleg').textContent = 'Veel plezier. Je score gaat naar de arena zodra het spel voorbij is.';
    nieuwStuk(); teken();
    clearInterval(TT.timer); TT.timer = setInterval(stap, 620);
  });
  var knoppen = document.querySelectorAll('[data-z]');
  for (var i = 0; i < knoppen.length; i++) {
    knoppen[i].addEventListener('click', function () { zet(this.getAttribute('data-z')); });
  }
  document.addEventListener('keydown', function (e) {
    var k = { ArrowLeft: 'links', ArrowRight: 'rechts', ArrowUp: 'draai', ArrowDown: 'val' }[e.key];
    if (k) { e.preventDefault(); zet(k); }
  });

  if (window.RTG) {
    window.RTG.roep('opslag.lees', { sleutel: 'beste' })
      .then(function (r) { if (r && r.waarde) $('beste').textContent = r.waarde; })
      .catch(function () {});
  }
  teken();
  tekenBord();
})();
