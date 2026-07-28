    /* Lege-toestand-nudge: elke plek met data-rahul-leeg="opdracht" opent Rahul
       met die opdracht al ingevuld. Geen auto-verstuur -- de gebruiker leest mee
       en stuurt zelf, zodat de rust en de geld-drempel bij de gebruiker blijven.
       Via event-delegatie, dus het werkt ook op later bijgeladen schermen. */
    window.RTGRahul = window.RTGRahul || {};
    // de chatbalk zonder opdracht openen: zo roept de onderrand hem op
    // (shared/randen.js), zonder dat er ergens een knop hoeft te staan
    window.RTGRahul.open = function () { sheet.hidden = false; fab.hidden = true; doofMelding(); inp.focus(); };
    window.RTGRahul.vraag = function (tekst) {
      sheet.hidden = false; fab.hidden = true; doofMelding();
      inp.value = String(tekst || '').slice(0, 300); inp.focus();
      try { inp.setSelectionRange(inp.value.length, inp.value.length); } catch (e) {}
    };
    if (!window.__rahulLeegBound) {
      window.__rahulLeegBound = true;
      document.addEventListener('click', function (ev) {
        var el = ev.target && ev.target.closest ? ev.target.closest('[data-rahul-leeg]') : null;
        if (!el || !window.RTGRahul || !window.RTGRahul.vraag) return;
        ev.preventDefault(); window.RTGRahul.vraag(el.getAttribute('data-rahul-leeg'));
      });
    }
  }

  /* ---------- Samen: meekijken en samen doen (alleen leden) ---------- */
  if (!memTok) return;
  // Heeft de pagina al haar eigen Samen-knop (bv. de RTF-pagina's met samen.js),
  // dan laten we die met rust en voegen we geen tweede toe. Rahul komt er wel bij.
  if (document.querySelector('script[src="samen.js"], script[src$="/samen.js"]')) return;
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
  // De zwevende Samen-knop is overal weggehaald en verhuisd naar het
  // bedieningspaneel van het leden-OS; daar opent Instellingen hem via
  // window.RTGMetgezel.samen(). We houden alleen het Samen-venster (sSheet) in
  // de DOM; de knop zelf tonen we niet meer.
  document.body.appendChild(sSheet);
  maakSleepbaar(sSheet, 'rtg_samen_sheet_pos', sSheet.querySelector('.mgz-kop'));
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
