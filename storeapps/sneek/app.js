/* SNEEK in de RTG Store.

   Zelfde afweging als bij Tetris: de regels draaien in de client, dus de score
   is een bewering van deze app. Het bord van een app staat apart, dus een
   verzonnen score raakt nooit de ranglijsten van het huis
   (kern/appstore/arena.js, grens 1). In een cel kan het niet anders -- daar is
   geen netwerk en dus geen server die meekijkt. */
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

  var SN = { n: 17, slang: [], richting: [1, 0], eten: null, timer: null, score: 0, dood: true };
  var RICHTING = { op: [0, -1], neer: [0, 1], links: [-1, 0], rechts: [1, 0] };

  function teken() {
    var cv = $('bord2d'), c = cv.getContext('2d'), cel = cv.width / SN.n;
    c.clearRect(0, 0, cv.width, cv.height);
    if (SN.eten) {
      c.fillStyle = '#E0B24A'; c.beginPath();
      c.arc(SN.eten[0] * cel + cel / 2, SN.eten[1] * cel + cel / 2, cel * 0.38, 0, 7); c.fill();
    }
    SN.slang.forEach(function (s, i) {
      c.fillStyle = i === 0 ? '#5FA56A' : 'rgba(95,165,106,.75)';
      c.fillRect(s[0] * cel + 1, s[1] * cel + 1, cel - 2, cel - 2);
    });
    $('score').textContent = SN.score; $('lengte').textContent = SN.slang.length;
  }
  function nieuwEten() {
    do {
      SN.eten = [Math.floor(Math.random() * SN.n), Math.floor(Math.random() * SN.n)];
    } while (SN.slang.some(function (s) { return s[0] === SN.eten[0] && s[1] === SN.eten[1]; }));
  }
  function stap() {
    var kop = [SN.slang[0][0] + SN.richting[0], SN.slang[0][1] + SN.richting[1]];
    if (kop[0] < 0 || kop[0] >= SN.n || kop[1] < 0 || kop[1] >= SN.n
      || SN.slang.some(function (s) { return s[0] === kop[0] && s[1] === kop[1]; })) return dood();
    SN.slang.unshift(kop);
    if (SN.eten && kop[0] === SN.eten[0] && kop[1] === SN.eten[1]) { SN.score += 10; nieuwEten(); }
    else SN.slang.pop();
    teken();
  }
  function dood() {
    clearInterval(SN.timer); SN.dood = true;
    $('start').textContent = 'Opnieuw';
    var punten = SN.score;
    bewaarBeste(punten);
    /* EEN NUL GAAT NIET NAAR HET BORD. Wie meteen af is, heeft niets neergezet;
       een ranglijst die met nullen volloopt, zegt niets over spelen. */
    if (!punten) { $('uitleg').textContent = 'Nul punten -- die gaat niet naar de arena. Probeer het nog eens.'; return; }
    stuurScore(punten, function (r) {
      $('uitleg').textContent = r && r.bewaard
        ? (r.persoonlijkRecord ? 'Persoonlijk record: ' + punten + ' punten.' : 'Af. ' + punten + ' punten.')
        : (r && r.reden ? 'Af. ' + punten + ' punten. ' + r.reden : 'Af. ' + punten + ' punten.');
    });
  }
  function draaiNaar(r) {
    if (SN.dood || !r) return;
    if (!(r[0] === -SN.richting[0] && r[1] === -SN.richting[1])) SN.richting = r;
  }
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
    SN.slang = [[8, 8], [7, 8], [6, 8]]; SN.richting = [1, 0]; SN.score = 0; SN.dood = false;
    this.textContent = 'Opnieuw';
    $('uitleg').textContent = 'Veel plezier. Je score gaat naar de arena zodra je af bent.';
    nieuwEten(); teken();
    clearInterval(SN.timer); SN.timer = setInterval(stap, 130);
  });
  var knoppen = document.querySelectorAll('[data-r]');
  for (var i = 0; i < knoppen.length; i++) {
    knoppen[i].addEventListener('click', function () { draaiNaar(RICHTING[this.getAttribute('data-r')]); });
  }
  document.addEventListener('keydown', function (e) {
    var r = { ArrowUp: RICHTING.op, ArrowDown: RICHTING.neer, ArrowLeft: RICHTING.links, ArrowRight: RICHTING.rechts }[e.key];
    if (r) { e.preventDefault(); draaiNaar(r); }
  });
  var veeg = null;
  $('bord2d').addEventListener('pointerdown', function (e) { veeg = [e.clientX, e.clientY]; });
  $('bord2d').addEventListener('pointerup', function (e) {
    if (!veeg || SN.dood) return;
    var dx = e.clientX - veeg[0], dy = e.clientY - veeg[1];
    veeg = null;
    draaiNaar(Math.abs(dx) > Math.abs(dy) ? [dx > 0 ? 1 : -1, 0] : [0, dy > 0 ? 1 : -1]);
  });

  if (window.RTG) {
    window.RTG.roep('opslag.lees', { sleutel: 'beste' })
      .then(function (r) { if (r && r.waarde) $('beste').textContent = r.waarde; })
      .catch(function () {});
  }
  SN.slang = [[8, 8], [7, 8], [6, 8]];
  teken();
  tekenBord();
})();
