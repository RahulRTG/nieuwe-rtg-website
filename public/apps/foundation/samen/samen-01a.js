/* De bestaande gezinskamer; dezelfde IIFE als samen-01.js. */
  var KAMERKEY = 'rtf_samen_kamer';
  var kamer = null, deelCode = null;
  try { kamer = localStorage.getItem(KAMERKEY); } catch (e) {}
  if (!/^rsk[a-f0-9]{32}$/i.test(kamer || '')) {
    kamer = null; try { localStorage.removeItem(KAMERKEY); localStorage.removeItem('rtf_samen_code'); } catch (e) {}
  }
  var volg = -1;
  var veiligeIdem = function (voor) {
    if (typeof window.RTGIdem !== 'function')
      throw new Error('Veilige browser-id ontbreekt; de Samen-actie is niet verstuurd.');
    return window.RTGIdem(voor);
  };
  var api = function (p, b) {
    return fetch('/api/rtf/samen/' + p, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.assign({ code: s.code, token: s.token }, b || {})) })
      .then(function (r) { return r.json().then(function (d) { if (!r.ok) { var e = new Error(d.error || 'Er ging iets mis.'); e.status = r.status; throw e; } return d; }); });
  };
  var zetKamer = function (id) { kamer = id; try { id ? localStorage.setItem(KAMERKEY, id) : localStorage.removeItem(KAMERKEY); } catch (e) {} };

  var knop = maakEl('<button class="rsm-knop" type="button" aria-label="Samen" aria-haspopup="dialog" data-stand="samen-venster">Samen</button>');
  var sheet = maakEl('<section class="rsm-sheet" role="dialog" aria-modal="false" aria-label="Samen" hidden><div class="rsm-kop"><span>Samen</span><button class="rsm-x" type="button" aria-label="Sluiten">✕</button></div><div class="rsm-vak"></div></section>');
  /* Wacht kort op de sessiebalk; val anders terug naar het begin van main. */
  window.rtfDok = window.rtfDok || function (el) {
    var balk = document.querySelector('.sb-balk');
    if (!balk) return false;
    var bel = balk.querySelector('.sb-bel');
    if (bel) balk.insertBefore(el, bel); else balk.appendChild(el);
    return true;
  };
  (function dok() {
    if (window.rtfDok(knop)) return;
    var n = 0, tik = setInterval(function () {
      if (window.rtfDok(knop) || ++n > 20) {
        clearInterval(tik);
        if (!knop.parentNode) { var m = document.querySelector('main, .wrap') || document.body; m.insertBefore(knop, m.firstChild); }
      }
    }, 150);
  })();
  document.body.appendChild(sheet);
  var vak = sheet.querySelector('.rsm-vak');
  knop.addEventListener('click', function () { sheet.hidden = false; knop.hidden = true; teken(); sheet.querySelector('.rsm-x').focus(); });
  sheet.querySelector('.rsm-x').addEventListener('click', function () { deelCode = null; sluitPaneel(sheet, knop); });

  paneelToets(sheet, knop);

  function meldHier() {
    if (!kamer) return;
    api('zet', { id: kamer, pad: location.pathname,
      titel: document.title.replace(/^RTFoundation · /, ''),
      idem: veiligeIdem('rtf-samen-zet') })
      .then(function (d) { volg = d.kamer.volg; })
      .catch(function (e) { if (e.status === 404) zetKamer(null); });
  }
  function teken() {
    if (!kamer) {
      vak.innerHTML = '<div class="rsm-uit">Samen kijken en doen met je gezin en je bevestigde vrienden. Start een kamer en deel de code, of doe mee met een code.</div>' +
        '<button class="rsm-go" data-start data-stand="samen-actief" type="button" style="width:100%;">Start een samen-kamer</button>' +
        '<form class="rsm-rij" data-mee><input placeholder="Code van gezin of vriend" maxlength="48" style="text-transform:uppercase;" aria-label="Samen-code"><button class="rsm-go" type="submit">Doe mee</button></form>';
      vorm(vak);
      vak.querySelector('[data-start]').addEventListener('click', function () {
        api('maak', { idem: veiligeIdem('rtf-samen-maak') }).then(function (d) {
          zetKamer(d.kamer.id); deelCode = d.deelcode; meldHier(); teken();
        }).catch(function (e) { alert(e.message); });
      });
      vak.querySelector('[data-mee]').addEventListener('submit', function (ev) {
        ev.preventDefault();
        var c = ev.target.querySelector('input').value.trim().toUpperCase(); if (!c) return;
        api('mee', { deelcode: c }).then(function (d) {
          zetKamer(d.kamer.id); deelCode = null; volg = d.kamer.volg; teken();
        }).catch(function (e) { alert(e.message); });
      });
      return;
    }
    api('staat', { id: kamer }).then(function (d) {
      var k = d.kamer; volg = k.volg;
      var toegang = deelCode
        ? 'Deelcode, alleen nu: <span class="rsm-code">' + esc(deelCode) + '</span>'
        : 'Samen-kamer actief. De deelcode wordt niet opnieuw getoond.';
      vak.innerHTML = '<div class="rsm-uit">' + toegang + '<br>Hier zijn: ' + k.leden.map(esc).join(', ') + '</div>' +
        '<div class="rsm-chat" data-chat>' + k.chat.map(function (c) { return '<div><b>' + esc(c.van) + ':</b> ' + esc(c.tekst) + '</div>'; }).join('') + '</div>' +
        '<form class="rsm-rij" data-zeg><input placeholder="Zeg iets" maxlength="300" aria-label="Chatbericht"><button class="rsm-go" type="submit" data-contextactie>→</button></form>' +
        '<div class="rsm-rij"><button class="rsm-stil h-flex1" data-hier type="button" data-contextactie>Kom hierheen</button>' +
        (k.benGastheer ? '<button class="rsm-stil" data-code type="button" data-contextactie>Nieuwe deelcode</button><button class="rsm-stil" data-sluit type="button" data-contextactie>Sluit</button>' : '') +
        '<button class="rsm-stil" data-weg type="button" data-contextactie>Verlaat</button></div>';
      vorm(vak);
      var chatEl = vak.querySelector('[data-chat]'); chatEl.scrollTop = chatEl.scrollHeight;
      vak.querySelector('[data-zeg]').addEventListener('submit', function (ev) {
        ev.preventDefault(); var i2 = ev.target.querySelector('input'); var t = i2.value.trim(); if (!t) return; i2.value = '';
        api('chat', { id: kamer, tekst: t, idem: veiligeIdem('rtf-samen-chat') })
          .then(function () { teken(); }).catch(function (e) { alert(e.message); });
      });
      vak.querySelector('[data-hier]').addEventListener('click', meldHier);
      var vernieuw = vak.querySelector('[data-code]');
      if (vernieuw) vernieuw.addEventListener('click', function () {
        api('code', { id: kamer, idem: veiligeIdem('rtf-samen-code') })
          .then(function (d) { deelCode = d.deelcode; teken(); }).catch(function (e) { alert(e.message); });
      });
      var sluit = vak.querySelector('[data-sluit]');
      if (sluit) sluit.addEventListener('click', function () {
        api('sluit', { id: kamer }).then(function () { deelCode = null; zetKamer(null); teken(); })
          .catch(function (e) { alert(e.message); });
      });
      vak.querySelector('[data-weg]').addEventListener('click', function () {
        api('weg', { id: kamer }).catch(function () {}); deelCode = null; zetKamer(null); teken();
      });
    }).catch(function () { zetKamer(null); teken(); });
  }
