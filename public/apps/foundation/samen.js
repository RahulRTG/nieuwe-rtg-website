/* Rustig samenkijken voor gezin en bevestigde vrienden. Een deelcode opent
   alleen de eerste toetreding; daarna bewaart de browser een kamer-id. */
(function () {
  if (window.__rtfSamen) return; window.__rtfSamen = true;
  if (!window.Sessie || !Sessie.actief()) return;
  var s = Sessie.huidig();
  if (!s || !s.token) return;
  document.body.classList.add('ds-samen-host');
  var esc = function (t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); };

  /* De vorm komt uitsluitend uit public/ds/componenten/samen.css. */
  var maakEl = function (h) { var d = document.createElement('div'); d.innerHTML = h; var el = d.firstChild; vorm(el); return el; };
  /* De gezins-Samen gebruikt dezelfde DS-bouwstenen, niet het ledentransport. */
  function vorm(root) {
    var klassen = { 'rsm-knop': 'ds-samen-secundair', 'rsm-rahul': 'ds-samen-doe',
      'rsm-sheet': 'ds-samen-venster ds-samen-venster--foundation', 'rsm-rsheet': 'ds-samen-venster ds-samen-venster--foundation',
      'rsm-kop': 'ds-samen-kop ds-samen-kop--vast', 'rsm-x': 'ds-samen-sluit',
      'rsm-uit': 'ds-samen-uitleg', 'rsm-ruit': 'ds-samen-uitleg', 'rsm-rij': 'ds-samen-rij',
      'rsm-go': 'ds-samen-doe', 'rsm-stil': 'ds-samen-secundair', 'rsm-chat': 'ds-samen-chat',
      'rsm-code': 'ds-samen-code', 'rsm-banner': 'ds-samen-banner' };
    Object.keys(klassen).forEach(function (naam) {
      var nodes = Array.from(root.querySelectorAll('.' + naam));
      if (root.classList.contains(naam)) nodes.unshift(root);
      nodes.forEach(function (n) { klassen[naam].split(' ').forEach(function (k) { n.classList.add(k); }); });
    });
    root.querySelectorAll('[data-start]').forEach(function (n) { n.classList.add('ds-samen-doe--breed'); n.removeAttribute('style'); });
    root.querySelectorAll('[data-mee] input').forEach(function (n) { n.classList.add('ds-samen-codeinvoer'); n.removeAttribute('style'); });
  }
  function sluitPaneel(paneel, ingang) {
    paneel.hidden = true; ingang.hidden = false;
    if (ingang.isConnected) ingang.focus();
  }
  function paneelToets(paneel, ingang) {
    paneel.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      e.preventDefault(); e.stopPropagation();
      if (paneel === sheet) deelCode = null;
      sluitPaneel(paneel, ingang);
    });
  }
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
/* De Samen-meldingen en de rustige poller voor pagina- en chatupdates. */
  var bannerEl = null;
  function veiligSamenPad(waarde) {
    var p = String(waarde || '');
    if (!p || p.length > 200 || p !== p.trim() || /[?#\\\u0000-\u001f]/.test(p)) return '';
    if (!/^\/(?:apps|site)\//.test(p) || /(?:^|\/)\.{1,2}(?:\/|$)/.test(p)) return '';
    return p;
  }
  function banner(tekst, pad) {
    pad = veiligSamenPad(pad);
    if (bannerEl) bannerEl.remove();
    bannerEl = maakEl('<div class="rsm-banner"><span>' + esc(tekst) + '</span>' +
      (pad ? '<button class="rsm-go" type="button">Ga mee →</button>' : '') +
      '<button class="rsm-x" type="button" aria-label="Sluiten">✕</button></div>');
    document.body.appendChild(bannerEl);
    if (pad) bannerEl.querySelector('.rsm-go').addEventListener('click',
      function () { window.location.assign(pad); });
    bannerEl.querySelector('.rsm-x').addEventListener('click', function () {
      bannerEl.remove(); bannerEl = null;
    });
    setTimeout(function () {
      if (bannerEl) { bannerEl.remove(); bannerEl = null; }
    }, 15000);
  }

  /* Rustige poller, zonder querystring of ander browsergeheim te delen. */
  function kijk() {
    if (!kamer) return;
    api('staat', { id: kamer }).then(function (d) {
      var k = d.kamer;
      if (volg >= 0 && k.volg > volg) {
        if (k.pad && k.pad !== location.pathname)
          banner((k.door || 'Iemand') + ' is bij ' +
            (k.titel || 'een andere pagina'), k.pad);
        else if (k.chat.length) {
          var c = k.chat[k.chat.length - 1];
          banner(c.van + ': ' + c.tekst, null);
        }
        if (!sheet.hidden) teken();
      }
      volg = k.volg;
    }).catch(function (e) { if (e.status === 404) zetKamer(null); });
  }
  if (kamer) meldHier();
  setInterval(kijk, 5000);
  /* ---- Rahul voor het gezin: de kindveilige vraagbaak op elke RTF-pagina.
     Praat op het niveau van je leeftijdsgroep, belooft nooit iets dat geld
     kost (alles hier is gratis) en wijst bij zware onderwerpen liefdevol
     naar een vertrouwde grote. ---- */
  /* Ook Rahul staat in de balk, niet zwevend in de hoek. Zie samen-01.js. */
  /* Rahul gebruikt dezelfde centrale Samen-component als de kamer. */
  var rFab = maakEl('<button class="rsm-rahul" type="button" aria-label="Vraag Rahul" aria-haspopup="dialog" data-stand="rahul-venster">✶ Rahul</button>');
  var rSheet = maakEl('<section class="rsm-rsheet" role="dialog" aria-modal="false" aria-label="Vraag Rahul" hidden>' +
    '<div class="rsm-kop"><span>✶ Vraag het Rahul</span><button class="rsm-x" type="button" aria-label="Sluiten">✕</button></div>' +
    '<div class="rsm-ruit" aria-live="polite"></div>' +
    '<form class="rsm-rij"><input placeholder="Wat wil je weten?" maxlength="300" autocomplete="off" aria-label="Je vraag"><button class="rsm-go" type="submit" aria-label="Versturen" data-contextactie>→</button></form></section>');
  (function dokR() {
    if (window.rtfDok && window.rtfDok(rFab)) return;
    var n = 0, tik = setInterval(function () {
      if ((window.rtfDok && window.rtfDok(rFab)) || ++n > 20) {
        clearInterval(tik);
        if (!rFab.parentNode) { var m = document.querySelector('main, .wrap') || document.body; m.insertBefore(rFab, m.firstChild); }
      }
    }, 150);
  })();
  document.body.appendChild(rSheet);
  var rUit = rSheet.querySelector('.rsm-ruit'), rForm = rSheet.querySelector('form'), rInp = rForm.querySelector('input');
  var rBezig = false, rStuur = rForm.querySelector('button');
  function rZelfdeProfiel() { var nu = Sessie.huidig(); return !!(nu && nu.code === s.code && nu.token === s.token &&
    (nu.profiel && nu.profiel.id) === (s.profiel && s.profiel.id)); }
  rFab.addEventListener('click', function () {
    rSheet.hidden = false; rFab.hidden = true; rInp.focus();
    if (!rUit.textContent) rUit.textContent = 'Hoi! Vraag me wat je wilt: over de apps, over leren, of gewoon iets dat je bezighoudt. Alles hier is gratis en veilig.';
  });
  rSheet.querySelector('.rsm-x').addEventListener('click', function () { sluitPaneel(rSheet, rFab); });
  paneelToets(rSheet, rFab);
  rForm.addEventListener('submit', function (ev) {
    ev.preventDefault(); var q = rInp.value.trim(); if (!q || rBezig || !rZelfdeProfiel()) return; rInp.value = '';
    rBezig = true; rStuur.disabled = true;
    rUit.textContent = 'Rahul denkt na…';
    fetch('/api/rtf/rahul', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: s.code, token: s.token, q: q }) })
      .then(function (r) { return r.json().then(function (d) {
        if (!r.ok || !d || d.error || d.ok === false || typeof d.antwoord !== 'string' || !d.antwoord.trim()) throw new Error(d && d.error || 'Geen antwoord');
        return d;
      }); })
      .then(function (d) {
        if (!rZelfdeProfiel()) { rUit.textContent = 'Je profiel is gewijzigd. Open deze ruimte opnieuw.'; return; }
        rUit.textContent = (d && (d.antwoord || d.error)) || 'Ik kwam er even niet uit; probeer het nog eens.'; })
      .catch(function () {
        if (!rZelfdeProfiel()) { rUit.textContent = 'Je profiel is gewijzigd. Open deze ruimte opnieuw.'; return; }
        rUit.textContent = 'Even geen verbinding; probeer het zo nog een keer.';
        if (!rInp.value) rInp.value = q;
      }).finally(function () { rBezig = false; rStuur.disabled = false; });
  });
})();
