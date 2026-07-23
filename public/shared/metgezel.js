/* De metgezel: Rahul + Samen, op elke app-pagina. Een klein script dat
   zichzelf inricht naar wie er is ingelogd:
   - een RTG-lid krijgt de Rahul-knop (vraagt en doet, via /api/fluister) en
     de Samen-knop: een sessie starten of meedoen met een code, samen door
     het OS lopen ("ga mee"-seintjes via SSE) en een kamer-chat
   - een zaak (leverancier-token) krijgt de Rahul-knop via de zaak-AI
   - is er al een eigen Rahul-knop op de pagina (#rahulFab), dan laten we
     die met rust en voegen we alleen Samen toe
   - zonder inlog doet het script niets (geen knoppen, geen verkeer) */
(function () {
  if (window.__metgezel) return; window.__metgezel = true;
  var memTok = null, supTok = null;
  try { memTok = localStorage.getItem('rtg_member_token'); } catch (e) {}
  try { supTok = localStorage.getItem('rtg_sup_token'); } catch (e) {}
  if (!memTok && !supTok) return;
  var esc = function (t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); };

  var css = '.mgz-knop{position:fixed;right:1rem;z-index:35;border:none;border-radius:999px;padding:.65rem 1rem;font-family:Inter,system-ui,sans-serif;font-weight:600;font-size:.83rem;cursor:pointer;box-shadow:0 6px 20px rgba(0,0,0,.4);}' +
    '.mgz-rahul{bottom:1rem;background:var(--gold,#857007);color:#000;}' +
    '.mgz-samen{bottom:3.6rem;background:#151312;color:#eee;border:1px solid var(--gold,#857007);}' +
    '.mgz-sheet{position:fixed;right:1rem;bottom:1rem;z-index:36;width:min(360px,92vw);background:#151312;border:1px solid var(--gold,#857007);border-radius:16px;padding:.9rem;display:flex;flex-direction:column;gap:.6rem;box-shadow:0 10px 30px rgba(0,0,0,.5);color:#eee;font-family:Inter,system-ui,sans-serif;}' +
    '.mgz-sheet[hidden]{display:none;}.mgz-kop{display:flex;align-items:center;justify-content:space-between;font-weight:600;}' +
    '.mgz-x{background:transparent;border:1px solid #333;border-radius:8px;color:#eee;padding:.15rem .5rem;cursor:pointer;}' +
    '.mgz-uit{font-size:.84rem;color:#bbb;line-height:1.55;max-height:40vh;overflow-y:auto;white-space:pre-wrap;}' +
    '.mgz-rij{display:flex;gap:.4rem;}.mgz-rij input{flex:1;background:#0C0C0B;border:1px solid #333;border-radius:10px;color:#eee;font:inherit;font-size:.85rem;padding:.5rem .7rem;}' +
    '.mgz-go{background:var(--gold,#857007);color:#000;border:none;border-radius:10px;padding:.5rem .9rem;font-weight:700;cursor:pointer;}' +
    '.mgz-stil{background:transparent;color:#eee;border:1px solid #444;border-radius:10px;padding:.5rem .8rem;font:inherit;font-size:.83rem;cursor:pointer;}' +
    '.mgz-banner{position:fixed;left:50%;transform:translateX(-50%);bottom:6.4rem;z-index:37;background:#0C0C0B;border:1px solid var(--gold,#857007);border-radius:12px;padding:.6rem .9rem;font-family:Inter,system-ui,sans-serif;font-size:.84rem;color:#eee;display:flex;gap:.6rem;align-items:center;box-shadow:0 8px 24px rgba(0,0,0,.5);max-width:92vw;}' +
    '.mgz-code{font-family:ui-monospace,monospace;letter-spacing:.2em;color:var(--gold,#857007);font-weight:700;}' +
    '.mgz-chat{font-size:.82rem;color:#bbb;max-height:26vh;overflow-y:auto;line-height:1.5;}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  var maakEl = function (html) { var d = document.createElement('div'); d.innerHTML = html; return d.firstChild; };

  /* ---------- Rahul: vraagt en doet, met de inlog die er is ---------- */
  // de grote apps (leden-OS, leverancier, PDA, backoffice) hebben Rahul al
  // diep ingebouwd; daar voegen we alleen Samen toe, geen tweede knop
  var eigenRahul = /\/apps\/(app|leverancier|personeel|backoffice)\.html$/.test(location.pathname);
  if (!eigenRahul && !document.getElementById('rahulFab')) {
    var pad = memTok ? '/api/fluister' : '/api/supplier/ai';
    var tok = memTok || supTok;
    var fab = maakEl('<button class="mgz-knop mgz-rahul" type="button" aria-label="Vraag Rahul">Rahul</button>');
    /* De signatuurmond als HET gezicht van Rahul: dezelfde lippen als op de
       voorpagina, klein op de knop, altijd in de buurt. De mond-tekenlaag
       (shared/mond.js) laden we er zelf bij; lukt dat niet, dan blijft de
       tekstknop gewoon staan. */
    var mond = { praat: function () {} };
    (function () {
      var zet = function () { if (window.RTGMond) { fab.style.padding = '.3rem .55rem'; fab.style.background = '#0C0C0B'; fab.style.border = '1px solid var(--gold,#857007)'; mond = RTGMond.fab(fab); } };
      if (window.RTGMond) return zet();
      var s = document.createElement('script'); s.src = '/shared/mond.js'; s.onload = zet; document.head.appendChild(s);
    })();
    var sheet = maakEl('<section class="mgz-sheet" aria-label="Vraag Rahul" hidden>' +
      '<div class="mgz-kop"><span>Vraag het Rahul</span><button class="mgz-x" type="button" aria-label="Sluiten">✕</button></div>' +
      '<div class="mgz-uit" aria-live="polite"></div>' +
      '<form class="mgz-rij"><input placeholder="Vraag of opdracht" maxlength="300" autocomplete="off" aria-label="Vraag of opdracht"><button class="mgz-go" type="submit" aria-label="Versturen">→</button></form></section>');
    document.body.appendChild(fab); document.body.appendChild(sheet);
    var uit = sheet.querySelector('.mgz-uit'), form = sheet.querySelector('form'), inp = form.querySelector('input');
    fab.addEventListener('click', function () { sheet.hidden = false; fab.hidden = true; inp.focus();
      if (!uit.textContent) uit.textContent = memTok ? 'Zeg wat je wilt. Ik zoek, reserveer, boek en bestel, alles met jouw eigen inlog.' : 'Vraag me alles over je zaak: cijfers, rooster, voorraad, en ik voer uit waar dat kan.'; });
    sheet.querySelector('.mgz-x').addEventListener('click', function () { sheet.hidden = true; fab.hidden = false; });
    form.addEventListener('submit', function (ev) {
      ev.preventDefault(); var q = inp.value.trim(); if (!q) return; inp.value = '';
      uit.textContent = 'Rahul denkt na...';
      fetch(pad, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok }, body: JSON.stringify({ q: q }) })
        .then(function (r) { return r.json(); })
        .then(function (d) { uit.textContent = (d && (d.antwoord || d.reply || d.error)) || 'Ik kwam er niet uit.'; mond.praat(1400); })
        .catch(function () { uit.textContent = 'Even geen verbinding; probeer het zo weer.'; });
    });
  }

  /* ---------- Samen: meekijken en samen doen (alleen leden) ---------- */
  if (!memTok) return;
  var CODEKEY = 'rtg_samen_code';
  var kamerCode = null; try { kamerCode = localStorage.getItem(CODEKEY); } catch (e) {}
  var api = function (p, b) {
    return fetch('/api/samen/' + p, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + memTok }, body: JSON.stringify(b || {}) })
      .then(function (r) { return r.json().then(function (d) { if (!r.ok) throw new Error(d.error || 'Er ging iets mis.'); return d; }); });
  };
  var sKnop = maakEl('<button class="mgz-knop mgz-samen" type="button" aria-label="Samen kijken en doen">Samen</button>');
  var sSheet = maakEl('<section class="mgz-sheet" aria-label="Samen" hidden style="bottom:3.6rem;">' +
    '<div class="mgz-kop"><span>Samen</span><button class="mgz-x" type="button" aria-label="Sluiten">✕</button></div>' +
    '<div class="mgz-vak"></div></section>');
  // Op het leden-OS (app.html) hoort Samen in het bedieningspaneel, niet als
  // zwevende knop; daar opent Instellingen het via window.RTGMetgezel.samen().
  var samenInPaneel = /\/apps\/app\.html$/.test(location.pathname);
  if (!samenInPaneel) document.body.appendChild(sKnop);
  document.body.appendChild(sSheet);
  var vak = sSheet.querySelector('.mgz-vak');
  function toonSamen() { sSheet.hidden = false; sKnop.hidden = true; teken(); }
  sKnop.addEventListener('click', toonSamen);
  sSheet.querySelector('.mgz-x').addEventListener('click', function () { sSheet.hidden = true; sKnop.hidden = false; });
  window.RTGMetgezel = window.RTGMetgezel || {}; window.RTGMetgezel.samen = toonSamen;

  function zetKamer(code) { kamerCode = code; try { code ? localStorage.setItem(CODEKEY, code) : localStorage.removeItem(CODEKEY); } catch (e) {} }
  function meldHier() {
    if (!kamerCode) return;
    api('zet', { code: kamerCode, pad: location.pathname + location.search, titel: document.title }).catch(function (e) {
      if (/bestaat niet|niet \(meer\)/.test(e.message)) zetKamer(null);
    });
  }
  function teken(chatOnder) {
    if (!kamerCode) {
      vak.innerHTML = '<div class="mgz-uit">Kijk en doe samen: start een sessie en deel de code, of doe mee met de code van een vriend. Wie ergens heen gaat, kan de rest met een tik laten meegaan.</div>' +
        '<button class="mgz-go" data-start type="button" style="width:100%;">Start een samen-sessie</button>' +
        '<form class="mgz-rij" data-mee><input placeholder="Code van een vriend" maxlength="8" style="text-transform:uppercase;" aria-label="Samen-code"><button class="mgz-go" type="submit">Doe mee</button></form>';
      vak.querySelector('[data-start]').addEventListener('click', function () {
        api('maak').then(function (d) { zetKamer(d.kamer.code); meldHier(); teken(); }).catch(function (e) { alert(e.message); });
      });
      vak.querySelector('[data-mee]').addEventListener('submit', function (ev) {
        ev.preventDefault();
        var c = ev.target.querySelector('input').value.trim().toUpperCase(); if (!c) return;
        api('mee', { code: c }).then(function (d) {
          zetKamer(d.kamer.code); teken();
          if (d.kamer.pad && d.kamer.pad !== location.pathname + location.search) banner('De kamer is bij ' + (d.kamer.titel || 'een andere pagina'), d.kamer.pad);
        }).catch(function (e) { alert(e.message); });
      });
      return;
    }
    api('staat', { code: kamerCode }).then(function (d) {
      var k = d.kamer;
      vak.innerHTML = '<div class="mgz-uit">Samen-code: <span class="mgz-code">' + esc(k.code) + '</span><br>In de kamer: ' + k.leden.map(esc).join(', ') + '</div>' +
        '<div class="mgz-chat" data-chat>' + k.chat.map(function (c) { return '<div><b>' + esc(c.van) + ':</b> ' + esc(c.tekst) + '</div>'; }).join('') + '</div>' +
        '<form class="mgz-rij" data-zeg><input placeholder="Zeg iets tegen de kamer" maxlength="300" aria-label="Chatbericht"><button class="mgz-go" type="submit">→</button></form>' +
        '<div class="mgz-rij"><button class="mgz-stil" data-hier type="button" style="flex:1;">Kom hierheen</button><button class="mgz-stil" data-weg type="button">Verlaat</button></div>';
      var chatEl = vak.querySelector('[data-chat]'); chatEl.scrollTop = chatEl.scrollHeight;
      vak.querySelector('[data-zeg]').addEventListener('submit', function (ev) {
        ev.preventDefault(); var inp2 = ev.target.querySelector('input'); var t = inp2.value.trim(); if (!t) return; inp2.value = '';
        api('chat', { code: kamerCode, tekst: t }).then(function () { teken(true); }).catch(function (e) { alert(e.message); });
      });
      vak.querySelector('[data-hier]').addEventListener('click', function () { meldHier(); });
      vak.querySelector('[data-weg]').addEventListener('click', function () {
        api('weg', { code: kamerCode }).catch(function () {}); zetKamer(null); teken();
      });
      if (chatOnder) chatEl.scrollTop = chatEl.scrollHeight;
    }).catch(function () { zetKamer(null); teken(); });
  }

  var bannerEl = null;
  function banner(tekst, pad) {
    if (bannerEl) bannerEl.remove();
    bannerEl = maakEl('<div class="mgz-banner"><span>' + esc(tekst) + '</span>' +
      (pad ? '<button class="mgz-go" type="button">Ga mee →</button>' : '') +
      '<button class="mgz-x" type="button" aria-label="Sluiten">✕</button></div>');
    document.body.appendChild(bannerEl);
    if (pad) bannerEl.querySelector('.mgz-go').addEventListener('click', function () { location.href = pad; });
    bannerEl.querySelector('.mgz-x').addEventListener('click', function () { bannerEl.remove(); bannerEl = null; });
    setTimeout(function () { if (bannerEl) { bannerEl.remove(); bannerEl = null; } }, 15000);
  }

  // live meeluisteren: een eigen, zuinige SSE-verbinding alleen voor 'samen'
  if (kamerCode && window.EventSource) {
    try {
      var bron = new EventSource('/api/stream?token=' + encodeURIComponent(memTok));
      bron.addEventListener('samen', function (e) {
        var d = {}; try { d = JSON.parse(e.data); } catch (x) {}
        if (d.code !== kamerCode) return;
        if (d.kind === 'kijk' && d.pad && d.pad !== location.pathname + location.search) banner(esc(d.door) + ' is bij ' + (d.titel || 'een andere pagina'), d.pad);
        else if (d.kind === 'chat') { banner(d.van + ': ' + d.tekst, null); if (!sSheet.hidden) teken(true); }
        else if (d.kind === 'erbij') banner(d.codenaam + ' doet mee', null);
        else if (d.kind === 'weg') banner(d.codenaam + ' is weg', null);
      });
      window.addEventListener('beforeunload', function () { try { bron.close(); } catch (e) {} });
    } catch (e) {}
  }
  // bij het openen van een pagina: laat de kamer weten waar je bent
  if (kamerCode) meldHier();
})();
