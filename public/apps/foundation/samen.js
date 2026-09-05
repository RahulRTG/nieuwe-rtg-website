/* Rustig samenkijken voor gezin en bevestigde vrienden. Een deelcode opent
   alleen de eerste toetreding; daarna bewaart de browser een kamer-id. */
(function () {
  if (window.__rtfSamen) return; window.__rtfSamen = true;
  if (!window.Sessie || !Sessie.actief()) return;
  var s = Sessie.huidig();
  if (!s || !s.token) return;
  var esc = function (t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); };

  /* De knop staat in de bovenbalk en dekt de inhoud niet af. */
  var css = '.rsm-knop{background:var(--paneel,#151312);color:var(--txt,#eee);border:1px solid var(--goud,#857007);border-radius:0;padding:.34rem .8rem;font:600 .74rem Inter,system-ui,sans-serif;cursor:pointer;white-space:nowrap;}' +
    '.rsm-sheet{position:fixed;right:1rem;bottom:1rem;z-index:36;width:min(340px,92vw);background:var(--paneel,#151312);border:1px solid var(--goud,#857007);border-radius:0;padding:.9rem;display:flex;flex-direction:column;gap:.6rem;color:var(--txt,#eee);font-family:Inter,system-ui,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.5);}' +
    '.rsm-sheet[hidden]{display:none;}.rsm-kop{display:flex;align-items:center;justify-content:space-between;font-weight:600;}' +
    // WCAG 2.5.8 als MAAT, niet als uitkomst van padding: zie samen-02.js
    '.rsm-x{background:transparent;border:1px solid #444;border-radius:0;color:inherit;padding:.15rem .5rem;cursor:pointer;min-width:24px;min-height:24px;display:grid;place-items:center;}' +
    '.rsm-uit{font-size:.83rem;color:var(--zacht,#bbb);line-height:1.55;}' +
    '.rsm-rij{display:flex;gap:.4rem;}.rsm-rij input{flex:1;background:var(--paneel2,#0C0C0B);border:1px solid #333;border-radius:0;color:inherit;font:inherit;font-size:.85rem;padding:.5rem .7rem;}' +
    '.rsm-go{background:var(--goud,#857007);color:#000;border:none;border-radius:0;padding:.5rem .9rem;font-weight:700;cursor:pointer;}' +
    '.rsm-stil{background:transparent;color:inherit;border:1px solid #444;border-radius:0;padding:.5rem .8rem;font:inherit;font-size:.82rem;cursor:pointer;}' +
    '.rsm-chat{font-size:.82rem;color:var(--zacht,#bbb);max-height:24vh;overflow-y:auto;line-height:1.5;}' +
    '.rsm-code{font-family:ui-monospace,monospace;letter-spacing:.2em;color:var(--goud2,#c7ab2b);font-weight:700;}' +
    // de balk draagt er nu twee knoppen bij; op een smal scherm mag hij wikkelen
    '.sb-balk{flex-wrap:wrap;row-gap:.4rem;}' +
    '.rsm-banner{position:fixed;left:50%;transform:translateX(-50%);bottom:4rem;z-index:37;background:var(--paneel2,#0C0C0B);border:1px solid var(--goud,#857007);border-radius:0;padding:.6rem .9rem;font:400 .84rem Inter,system-ui,sans-serif;color:var(--txt,#eee);display:flex;gap:.6rem;align-items:center;box-shadow:0 8px 24px rgba(0,0,0,.5);max-width:92vw;}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  var maakEl = function (h) { var d = document.createElement('div'); d.innerHTML = h; return d.firstChild; };

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

  var knop = maakEl('<button class="rsm-knop" type="button" aria-label="Samen">Samen</button>');
  var sheet = maakEl('<section class="rsm-sheet" aria-label="Samen" hidden><div class="rsm-kop"><span>Samen</span><button class="rsm-x" type="button" aria-label="Sluiten">✕</button></div><div class="rsm-vak"></div></section>');
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
  knop.addEventListener('click', function () { sheet.hidden = false; knop.hidden = true; teken(); });
  sheet.querySelector('.rsm-x').addEventListener('click', function () { deelCode = null; sheet.hidden = true; knop.hidden = false; });

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
        '<button class="rsm-go" data-start type="button" style="width:100%;">Start een samen-kamer</button>' +
        '<form class="rsm-rij" data-mee><input placeholder="Code van gezin of vriend" maxlength="48" style="text-transform:uppercase;" aria-label="Samen-code"><button class="rsm-go" type="submit">Doe mee</button></form>';
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
        '<form class="rsm-rij" data-zeg><input placeholder="Zeg iets" maxlength="300" aria-label="Chatbericht"><button class="rsm-go" type="submit">→</button></form>' +
        '<div class="rsm-rij"><button class="rsm-stil h-flex1" data-hier type="button">Kom hierheen</button>' +
        (k.benGastheer ? '<button class="rsm-stil" data-code type="button">Nieuwe deelcode</button><button class="rsm-stil" data-sluit type="button">Sluit</button>' : '') +
        '<button class="rsm-stil" data-weg type="button">Verlaat</button></div>';
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
  var bannerEl = null;
  function banner(tekst, pad) {
    if (bannerEl) bannerEl.remove();
    bannerEl = maakEl('<div class="rsm-banner"><span>' + esc(tekst) + '</span>' +
      (pad ? '<button class="rsm-go" type="button">Ga mee →</button>' : '') +
      '<button class="rsm-x" type="button" aria-label="Sluiten">✕</button></div>');
    document.body.appendChild(bannerEl);
    if (pad) bannerEl.querySelector('.rsm-go').addEventListener('click',
      function () { location.href = pad; });
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
/* De Samen-meldingen en de rustige poller voor pagina- en chatupdates. */
  /* ---- Rahul voor het gezin: de kindveilige vraagbaak op elke RTF-pagina.
     Praat op het niveau van je leeftijdsgroep, belooft nooit iets dat geld
     kost (alles hier is gratis) en wijst bij zware onderwerpen liefdevol
     naar een vertrouwde grote. ---- */
  /* Ook Rahul staat in de balk, niet zwevend in de hoek. Zie samen-01.js. */
  var rCss = '.rsm-rahul{background:var(--goud,#857007);color:#000;border:none;border-radius:0;padding:.34rem .8rem;font:600 .74rem Inter,system-ui,sans-serif;cursor:pointer;white-space:nowrap;}' +
    '.rsm-rsheet{position:fixed;right:1rem;bottom:3.6rem;z-index:37;width:min(340px,92vw);background:var(--paneel,#151312);border:1px solid var(--goud,#857007);border-radius:0;padding:.9rem;display:flex;flex-direction:column;gap:.6rem;color:var(--txt,#eee);font-family:Inter,system-ui,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.5);}' +
    '.rsm-rsheet[hidden]{display:none;}.rsm-ruit{font-size:.84rem;color:var(--zacht,#bbb);line-height:1.55;max-height:38vh;overflow-y:auto;white-space:pre-wrap;}';
  /* HET SLUITKRUISJE DRAAGT ZIJN RAAKVLAK ALS MAAT, en rCss definieert het zelf.

     Twee gebreken in een: `.rsm-x` had geen eigen afmeting -- alleen padding en
     het kruisje, dus de maat kwam uit het lettertype dat toevallig laadde. En
     het Rahul-paneel gebruikt die klasse in zijn EIGEN markup maar liet hem
     definieren door het stijlblok van Samen; een knop die zijn maat leent uit
     een ander blok, is een knop zonder maat zodra dat blok er niet is.

     CI mat hem op 3 september 2026 op 11x15 -- kleiner dan de padding alleen
     (16px horizontaal), dus toen gold de regel niet eens. Nu staat WCAG 2.5.8
     er als min-width/min-height, in BEIDE blokken: dezelfde regel herhaald in
     plaats van geleend, want het is de maat die telt en niet de plek.

     Wat hiermee NIET verklaard is: waarom CI dit op deze tak zag en op main
     niet, terwijl het bestand byte-identiek was. De maat is onvoorwaardelijk
     juist; de trigger is niet gevonden. */
  rCss += '.rsm-x{background:transparent;border:1px solid #444;border-radius:0;color:inherit;padding:.15rem .5rem;cursor:pointer;min-width:24px;min-height:24px;display:grid;place-items:center;}';
  var rSt = document.createElement('style'); rSt.textContent = rCss; document.head.appendChild(rSt);
  var rFab = maakEl('<button class="rsm-rahul" type="button" aria-label="Vraag Rahul">✶ Rahul</button>');
  var rSheet = maakEl('<section class="rsm-rsheet" aria-label="Vraag Rahul" hidden>' +
    '<div class="rsm-kop"><span>✶ Vraag het Rahul</span><button class="rsm-x" type="button" aria-label="Sluiten">✕</button></div>' +
    '<div class="rsm-ruit" aria-live="polite"></div>' +
    '<form class="rsm-rij"><input placeholder="Wat wil je weten?" maxlength="300" autocomplete="off" aria-label="Je vraag"><button class="rsm-go" type="submit" aria-label="Versturen">→</button></form></section>');
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
  rFab.addEventListener('click', function () {
    rSheet.hidden = false; rFab.hidden = true; rInp.focus();
    if (!rUit.textContent) rUit.textContent = 'Hoi! Vraag me wat je wilt: over de apps, over leren, of gewoon iets dat je bezighoudt. Alles hier is gratis en veilig.';
  });
  rSheet.querySelector('.rsm-x').addEventListener('click', function () { rSheet.hidden = true; rFab.hidden = false; });
  rForm.addEventListener('submit', function (ev) {
    ev.preventDefault(); var q = rInp.value.trim(); if (!q) return; rInp.value = '';
    rUit.textContent = 'Rahul denkt na…';
    fetch('/api/rtf/rahul', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: s.code, token: s.token, q: q }) })
      .then(function (r) { return r.json(); })
      .then(function (d) { rUit.textContent = (d && (d.antwoord || d.error)) || 'Ik kwam er even niet uit; probeer het nog eens.'; })
      .catch(function () { rUit.textContent = 'Even geen verbinding; probeer het zo nog een keer.'; });
  });
})();
