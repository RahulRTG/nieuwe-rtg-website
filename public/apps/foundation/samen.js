/* Samen voor de gezinsapps: een rustige meekijk-laag voor gezin en bevestigde
   vrienden. Een profiel start een kamer en deelt de code; wie ergens heen
   gaat drukt "Kom hierheen" en de rest krijgt een vriendelijk balkje om mee
   te gaan, plus een klein kamer-chatje. Geen jaag-gedrag: de widget kijkt
   rustig elke vijf seconden of er iets nieuws is. Werkt alleen met een
   gekozen gezinsprofiel; gasten zien niets. */
(function () {
  if (window.__rtfSamen) return; window.__rtfSamen = true;
  if (!window.Sessie || !Sessie.actief()) return;
  var s = Sessie.huidig();
  if (!s || !s.token) return;
  var esc = function (t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); };

  var css = '.rsm-knop{position:fixed;right:1rem;bottom:1rem;z-index:35;background:var(--paneel,#151312);color:var(--txt,#eee);border:1px solid var(--goud,#857007);border-radius:999px;padding:.6rem 1rem;font:600 .83rem Inter,system-ui,sans-serif;cursor:pointer;box-shadow:0 6px 20px rgba(0,0,0,.4);}' +
    '.rsm-sheet{position:fixed;right:1rem;bottom:1rem;z-index:36;width:min(340px,92vw);background:var(--paneel,#151312);border:1px solid var(--goud,#857007);border-radius:16px;padding:.9rem;display:flex;flex-direction:column;gap:.6rem;color:var(--txt,#eee);font-family:Inter,system-ui,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.5);}' +
    '.rsm-sheet[hidden]{display:none;}.rsm-kop{display:flex;align-items:center;justify-content:space-between;font-weight:600;}' +
    '.rsm-x{background:transparent;border:1px solid #444;border-radius:8px;color:inherit;padding:.15rem .5rem;cursor:pointer;}' +
    '.rsm-uit{font-size:.83rem;color:var(--zacht,#bbb);line-height:1.55;}' +
    '.rsm-rij{display:flex;gap:.4rem;}.rsm-rij input{flex:1;background:var(--paneel2,#0C0C0B);border:1px solid #333;border-radius:10px;color:inherit;font:inherit;font-size:.85rem;padding:.5rem .7rem;}' +
    '.rsm-go{background:var(--goud,#857007);color:#000;border:none;border-radius:10px;padding:.5rem .9rem;font-weight:700;cursor:pointer;}' +
    '.rsm-stil{background:transparent;color:inherit;border:1px solid #444;border-radius:10px;padding:.5rem .8rem;font:inherit;font-size:.82rem;cursor:pointer;}' +
    '.rsm-chat{font-size:.82rem;color:var(--zacht,#bbb);max-height:24vh;overflow-y:auto;line-height:1.5;}' +
    '.rsm-code{font-family:ui-monospace,monospace;letter-spacing:.2em;color:var(--goud2,#c7ab2b);font-weight:700;}' +
    '.rsm-banner{position:fixed;left:50%;transform:translateX(-50%);bottom:4rem;z-index:37;background:var(--paneel2,#0C0C0B);border:1px solid var(--goud,#857007);border-radius:12px;padding:.6rem .9rem;font:400 .84rem Inter,system-ui,sans-serif;color:var(--txt,#eee);display:flex;gap:.6rem;align-items:center;box-shadow:0 8px 24px rgba(0,0,0,.5);max-width:92vw;}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  var maakEl = function (h) { var d = document.createElement('div'); d.innerHTML = h; return d.firstChild; };

  var CODEKEY = 'rtf_samen_code';
  var kamer = null; try { kamer = localStorage.getItem(CODEKEY); } catch (e) {}
  var volg = -1;
  var api = function (p, b) {
    return fetch('/api/rtf/samen/' + p, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.assign({ code: s.code, token: s.token, kamercode: kamer }, b || {})) })
      .then(function (r) { return r.json().then(function (d) { if (!r.ok) { var e = new Error(d.error || 'Er ging iets mis.'); e.status = r.status; throw e; } return d; }); });
  };
  var zetKamer = function (c) { kamer = c; try { c ? localStorage.setItem(CODEKEY, c) : localStorage.removeItem(CODEKEY); } catch (e) {} };

  var knop = maakEl('<button class="rsm-knop" type="button" aria-label="Samen">👥 Samen</button>');
  var sheet = maakEl('<section class="rsm-sheet" aria-label="Samen" hidden><div class="rsm-kop"><span>👥 Samen</span><button class="rsm-x" type="button" aria-label="Sluiten">✕</button></div><div class="rsm-vak"></div></section>');
  document.body.appendChild(knop); document.body.appendChild(sheet);
  var vak = sheet.querySelector('.rsm-vak');
  knop.addEventListener('click', function () { sheet.hidden = false; knop.hidden = true; teken(); });
  sheet.querySelector('.rsm-x').addEventListener('click', function () { sheet.hidden = true; knop.hidden = false; });

  function meldHier() {
    if (!kamer) return;
    api('zet', { pad: location.pathname + location.search, titel: document.title.replace(/^RTFoundation · /, '') })
      .then(function (d) { volg = d.kamer.volg; })
      .catch(function (e) { if (e.status === 404) zetKamer(null); });
  }
  function teken() {
    if (!kamer) {
      vak.innerHTML = '<div class="rsm-uit">Samen kijken en doen met je gezin en je bevestigde vrienden. Start een kamer en deel de code, of doe mee met een code.</div>' +
        '<button class="rsm-go" data-start type="button" style="width:100%;">Start een samen-kamer</button>' +
        '<form class="rsm-rij" data-mee><input placeholder="Code van gezin of vriend" maxlength="8" style="text-transform:uppercase;" aria-label="Samen-code"><button class="rsm-go" type="submit">Doe mee</button></form>';
      vak.querySelector('[data-start]').addEventListener('click', function () {
        api('maak').then(function (d) { zetKamer(d.kamer.code); meldHier(); teken(); }).catch(function (e) { alert(e.message); });
      });
      vak.querySelector('[data-mee]').addEventListener('submit', function (ev) {
        ev.preventDefault();
        var c = ev.target.querySelector('input').value.trim().toUpperCase(); if (!c) return;
        kamer = c;
        api('mee').then(function (d) { zetKamer(d.kamer.code); volg = d.kamer.volg; teken(); })
          .catch(function (e) { kamer = null; alert(e.message); });
      });
      return;
    }
    api('staat').then(function (d) {
      var k = d.kamer; volg = k.volg;
      vak.innerHTML = '<div class="rsm-uit">Kamer-code: <span class="rsm-code">' + esc(k.code) + '</span><br>Hier zijn: ' + k.leden.map(esc).join(', ') + '</div>' +
        '<div class="rsm-chat" data-chat>' + k.chat.map(function (c) { return '<div><b>' + esc(c.van) + ':</b> ' + esc(c.tekst) + '</div>'; }).join('') + '</div>' +
        '<form class="rsm-rij" data-zeg><input placeholder="Zeg iets" maxlength="300" aria-label="Chatbericht"><button class="rsm-go" type="submit">→</button></form>' +
        '<div class="rsm-rij"><button class="rsm-stil" data-hier type="button" style="flex:1;">📍 Kom hierheen</button><button class="rsm-stil" data-weg type="button">Verlaat</button></div>';
      var chatEl = vak.querySelector('[data-chat]'); chatEl.scrollTop = chatEl.scrollHeight;
      vak.querySelector('[data-zeg]').addEventListener('submit', function (ev) {
        ev.preventDefault(); var i2 = ev.target.querySelector('input'); var t = i2.value.trim(); if (!t) return; i2.value = '';
        api('chat', { tekst: t }).then(function () { teken(); }).catch(function (e) { alert(e.message); });
      });
      vak.querySelector('[data-hier]').addEventListener('click', meldHier);
      vak.querySelector('[data-weg]').addEventListener('click', function () {
        api('weg').catch(function () {}); zetKamer(null); teken();
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
    if (pad) bannerEl.querySelector('.rsm-go').addEventListener('click', function () { location.href = pad; });
    bannerEl.querySelector('.rsm-x').addEventListener('click', function () { bannerEl.remove(); bannerEl = null; });
    setTimeout(function () { if (bannerEl) { bannerEl.remove(); bannerEl = null; } }, 15000);
  }

  // de rustige kijker: elke vijf seconden even vragen of er iets nieuws is
  function kijk() {
    if (!kamer) return;
    api('staat').then(function (d) {
      var k = d.kamer;
      if (volg >= 0 && k.volg > volg) {
        if (k.pad && k.pad !== location.pathname + location.search) banner((k.door || 'Iemand') + ' is bij ' + (k.titel || 'een andere pagina'), k.pad);
        else if (k.chat.length) { var c = k.chat[k.chat.length - 1]; banner(c.van + ': ' + c.tekst, null); }
        if (!sheet.hidden) teken();
      }
      volg = k.volg;
    }).catch(function (e) { if (e.status === 404) zetKamer(null); });
  }
  if (kamer) { meldHier(); }
  setInterval(kijk, 5000);
})();
