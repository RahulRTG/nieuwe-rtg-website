/* RTG Vertaler, het scherm: typen of spreken, live vertalen (met een
   rustpauze van een halve seconde), voorlezen, kopieren, reiszinnen per
   situatie, en een geschiedenis plus bewaarde zinnen die op het TOESTEL
   blijven -- de server onthoudt gesprekken niet. */
(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };
  var esc = function (t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  var token = null;
  try { token = localStorage.getItem('rtg_member_token'); } catch (e) {}
  var api = function (pad, body) {
    return fetch('/api/vertaal' + pad, { method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify(body || {})
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (b) { return { status: r.status, body: b }; });
    });
  };
  var meldT; var meld = function (t) {
    var m = $('#melding'); m.textContent = t; m.classList.add('zie');
    clearTimeout(meldT); meldT = setTimeout(function () { m.classList.remove('zie'); }, 3200);
  };

  var laatste = '';   // de laatste vertaling, voor voorlezen/kopieren/bewaren
  function vulTalen(talen) {
    var opts = talen.map(function (t) { return '<option value="' + t[0] + '">' + esc(t[1]) + '</option>'; }).join('');
    $('#taalVan').innerHTML = opts;
    $('#taalNaar').innerHTML = opts;
    $('#taalVan').value = 'nl';
    $('#taalNaar').value = 'en';
  }

  var wacht = null;
  function vertaal() {
    var tekst = $('#invoer').value.trim();
    if (!tekst) {
      $('#uitPaneel').innerHTML = '<span class="leeg">De vertaling verschijnt hier terwijl u typt.</span>';
      laatste = '';
      return;
    }
    api('', { tekst: tekst, naar: $('#taalNaar').value, van: $('#taalVan').value }).then(function (r) {
      if (r.body.error) return meld(r.body.error);
      laatste = r.body.tekst;
      $('#uitPaneel').textContent = r.body.tekst;
      if (!r.body.vertaald && $('#taalNaar').value !== $('#taalVan').value) {
        $('#uitPaneel').textContent += '\n';
        var n = document.createElement('span');
        n.className = 'leeg';
        n.textContent = '(deze taal lukt nu even niet volledig; dit is het eerlijke antwoord van de demo)';
        $('#uitPaneel').appendChild(n);
      }
      histBij(tekst, r.body.tekst);
    });
  }
  $('#invoer').addEventListener('input', function () {
    clearTimeout(wacht);
    wacht = setTimeout(vertaal, 500);
  });
  ['taalVan', 'taalNaar'].forEach(function (id) { $('#' + id).addEventListener('change', vertaal); });
  $('#wissel').addEventListener('click', function () {
    var a = $('#taalVan').value;
    $('#taalVan').value = $('#taalNaar').value;
    $('#taalNaar').value = a;
    if (laatste) { $('#invoer').value = laatste; }
    vertaal();
  });

  /* ---- spreken en voorlezen: wat het toestel zelf kan ---- */
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) $('#spreek').style.display = 'none';
  $('#spreek').addEventListener('click', function () {
    try {
      var r = new SR();
      r.lang = $('#taalVan').value;
      r.onresult = function (e) {
        $('#invoer').value = e.results[0][0].transcript;
        vertaal();
      };
      r.onerror = function () { meld('Spreken lukte niet; typ het gerust.'); };
      r.start();
      meld('Spreek maar.');
    } catch (e) { meld('Spreken kan niet op dit toestel.'); }
  });
  $('#zegOp').addEventListener('click', function () {
    if (!laatste || !window.speechSynthesis) return;
    var u = new SpeechSynthesisUtterance(laatste);
    u.lang = $('#taalNaar').value;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  });
  $('#kopieer').addEventListener('click', function () {
    if (!laatste) return;
    (navigator.clipboard ? navigator.clipboard.writeText(laatste) : Promise.reject())
      .then(function () { meld('Gekopieerd.'); })
      .catch(function () { meld('Kopieren lukte niet; selecteer de tekst gerust zelf.'); });
  });

  /* ---- reiszinnen: per situatie, vertaald op het moment dat u kiest ---- */
  var REIS = {
    'Begroeten': ['Goedemorgen.', 'Dank u wel.', 'Neemt u mij niet kwalijk.', 'Tot ziens.'],
    'Restaurant': ['Een tafel voor twee, alstublieft.', 'De kaart, alstublieft.', 'Ik heb een allergie.', 'De rekening, alstublieft.'],
    'Onderweg': ['Waar is het station?', 'Naar dit adres, alstublieft.', 'Hoe lang duurt het?', 'Mag ik hier pinnen?'],
    'Hulp': ['Kunt u mij helpen?', 'Ik ben de weg kwijt.', 'Ik heb een dokter nodig.', 'Bel alstublieft de politie.']
  };
  var reisTab = 'Begroeten';
  function tekenReis() {
    $('#reisTabs').innerHTML = Object.keys(REIS).map(function (k) {
      return '<button class="knop' + (k === reisTab ? ' aan' : '') + '" data-reistab="' + k + '" type="button">' + k + '</button>';
    }).join('');
    $('#reisZinnen').innerHTML = REIS[reisTab].map(function (z) {
      return '<div class="zin" data-zin="' + esc(z) + '" role="button" tabindex="0"><span class="t">' + esc(z) + '</span><span class="v">vertaal &#8594;</span></div>';
    }).join('');
    Array.prototype.forEach.call(document.querySelectorAll('[data-reistab]'), function (el) {
      el.addEventListener('click', function () { reisTab = el.dataset.reistab; tekenReis(); });
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-zin]'), function (el) {
      el.addEventListener('click', function () {
        $('#taalVan').value = 'nl';
        $('#invoer').value = el.dataset.zin;
        vertaal();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });
  }

  /* ---- geschiedenis en bewaarde zinnen: van het toestel, niet van ons ---- */
  var hist = [], vast = [];
  try { hist = JSON.parse(localStorage.getItem('rtg_vertaal_hist') || '[]'); } catch (e) {}
  try { vast = JSON.parse(localStorage.getItem('rtg_vertaal_vast') || '[]'); } catch (e) {}
  function histBij(van, naar) {
    if (hist.length && hist[0].van === van) return;
    hist.unshift({ van: van, naar: naar });
    hist = hist.slice(0, 20);
    try { localStorage.setItem('rtg_vertaal_hist', JSON.stringify(hist)); } catch (e) {}
    tekenLijsten();
  }
  $('#bewaarZin').addEventListener('click', function () {
    var tekst = $('#invoer').value.trim();
    if (!tekst || !laatste) return;
    vast.unshift({ van: tekst, naar: laatste });
    vast = vast.slice(0, 50);
    try { localStorage.setItem('rtg_vertaal_vast', JSON.stringify(vast)); } catch (e) {}
    meld('Bewaard op dit toestel.');
    tekenLijsten();
  });
  function lijstHtml(items) {
    return items.map(function (h) {
      return '<div class="zin" data-zin="' + esc(h.van) + '" role="button" tabindex="0"><span class="t">' +
        esc(h.van) + '<br><span style="color:var(--soft);">' + esc(h.naar) + '</span></span></div>';
    }).join('');
  }
  function tekenLijsten() {
    $('#bewaardKop').style.display = vast.length ? '' : 'none';
    $('#bewaard').innerHTML = lijstHtml(vast.slice(0, 10));
    $('#histKop').style.display = hist.length ? '' : 'none';
    $('#historie').innerHTML = lijstHtml(hist.slice(0, 10));
    Array.prototype.forEach.call(document.querySelectorAll('#bewaard [data-zin], #historie [data-zin]'), function (el) {
      el.addEventListener('click', function () {
        $('#invoer').value = el.dataset.zin;
        vertaal();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });
  }

  if (!token) { meld('Log eerst in op de leden-app.'); return; }
  api('/talen').then(function (r) {
    vulTalen((r.body && r.body.talen) || [['nl', 'Nederlands'], ['en', 'English']]);
    tekenReis();
    tekenLijsten();
  });
})();
