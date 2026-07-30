/* RTG Gereedschap, de stopwatch en de wereldklok. De stopwatch loopt
   lokaal (milliseconden zijn van het toestel), met rondetijden. De
   wereldklok rekent met de tijdzones die de browser zelf kent
   (Intl.DateTimeFormat) -- geen externe bron nodig, en zomertijd klopt
   vanzelf. Gekozen steden onthoudt het toestel. */
(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };
  var esc = function (t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  /* ---- de stopwatch ---- */
  var t0 = 0, opgeteld = 0, loopt = false, tikker = null, rondes = [];
  function nuMs() { return opgeteld + (loopt ? Date.now() - t0 : 0); }
  function tekst(ms) {
    var t = Math.floor(ms / 100), tienden = t % 10, s = Math.floor(t / 10);
    var m = Math.floor(s / 60); s = s % 60;
    return m + ':' + String(s).padStart(2, '0') + ',' + tienden;
  }
  function tekenSw() { $('#swTijd').textContent = tekst(nuMs()); }
  $('#swStart').addEventListener('click', function () {
    if (loopt) {
      opgeteld = nuMs(); loopt = false;
      clearInterval(tikker);
      this.textContent = 'Start';
      this.classList.add('vol');
    } else {
      t0 = Date.now(); loopt = true;
      tikker = setInterval(tekenSw, 100);
      this.textContent = 'Pauze';
    }
  });
  $('#swRonde').addEventListener('click', function () {
    if (!loopt && !opgeteld) return;
    var totaal = nuMs();
    var vorige = rondes.length ? rondes[rondes.length - 1].totaal : 0;
    rondes.push({ n: rondes.length + 1, ronde: totaal - vorige, totaal: totaal });
    $('#swRondes').innerHTML = rondes.slice().reverse().map(function (r) {
      return '<div class="ronde"><span>Ronde ' + r.n + '</span><span>' + tekst(r.ronde) +
        '</span><span>' + tekst(r.totaal) + '</span></div>';
    }).join('');
  });
  $('#swReset').addEventListener('click', function () {
    loopt = false; opgeteld = 0; rondes = [];
    clearInterval(tikker);
    $('#swStart').textContent = 'Start';
    $('#swRondes').innerHTML = '';
    tekenSw();
  });

  /* ---- de wereldklok: browser-tijdzones, dus zomertijd klopt vanzelf ---- */
  var STEDEN = [
    ['Amsterdam', 'Europe/Amsterdam'], ['Ibiza', 'Europe/Madrid'], ['Londen', 'Europe/London'],
    ['Parijs', 'Europe/Paris'], ['Zurich', 'Europe/Zurich'], ['Istanbul', 'Europe/Istanbul'],
    ['Dubai', 'Asia/Dubai'], ['Mumbai', 'Asia/Kolkata'], ['Singapore', 'Asia/Singapore'],
    ['Hongkong', 'Asia/Hong_Kong'], ['Tokio', 'Asia/Tokyo'], ['Sydney', 'Australia/Sydney'],
    ['New York', 'America/New_York'], ['Miami', 'America/New_York'], ['Los Angeles', 'America/Los_Angeles'],
    ['Sao Paulo', 'America/Sao_Paulo'], ['Kaapstad', 'Africa/Johannesburg'], ['Marrakesh', 'Africa/Casablanca']
  ];
  var gekozen = ['Amsterdam', 'Ibiza', 'Dubai', 'New York'];
  try {
    var b = JSON.parse(localStorage.getItem('rtg_wereldklok') || 'null');
    if (Array.isArray(b) && b.length) gekozen = b;
  } catch (e) {}
  function bewaar() { try { localStorage.setItem('rtg_wereldklok', JSON.stringify(gekozen)); } catch (e) {} }

  $('#wkStad').innerHTML = STEDEN.map(function (s) {
    return '<option value="' + s[0] + '">' + s[0] + '</option>';
  }).join('');
  function zone(naam) {
    var s = STEDEN.find(function (x) { return x[0] === naam; });
    return s ? s[1] : null;
  }
  function tijdIn(tz) {
    try {
      return new Intl.DateTimeFormat('nl-NL', { timeZone: tz, hour: '2-digit', minute: '2-digit' }).format(new Date());
    } catch (e) { return '--:--'; }
  }
  function verschil(tz) {
    try {
      var hier = new Date().getHours();
      var daar = +new Intl.DateTimeFormat('nl-NL', { timeZone: tz, hour: 'numeric', hourCycle: 'h23' }).format(new Date());
      var d = daar - hier;
      if (d > 12) d -= 24; if (d < -12) d += 24;
      return d === 0 ? 'zelfde tijd' : (d > 0 ? '+' : '') + d + ' uur';
    } catch (e) { return ''; }
  }
  function tekenKlokken() {
    $('#klokken').innerHTML = gekozen.map(function (naam) {
      var tz = zone(naam);
      if (!tz) return '';
      return '<div class="kaart"><span class="tijd">' + tijdIn(tz) + '</span>' +
        '<span class="wat">' + esc(naam) + ' · ' + verschil(tz) + '</span>' +
        '<button class="knop" data-stadweg="' + esc(naam) + '" type="button">Weg</button></div>';
    }).join('');
    Array.prototype.forEach.call(document.querySelectorAll('[data-stadweg]'), function (el) {
      el.addEventListener('click', function () {
        gekozen = gekozen.filter(function (n) { return n !== el.dataset.stadweg; });
        bewaar(); tekenKlokken();
      });
    });
  }
  $('#wkErbij').addEventListener('click', function () {
    var naam = $('#wkStad').value;
    if (!gekozen.includes(naam)) { gekozen.push(naam); bewaar(); }
    tekenKlokken();
  });
  tekenKlokken();
  setInterval(tekenKlokken, 30000);
})();
