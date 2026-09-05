    /* Lege-toestand-nudge: elke plek met data-rahul-leeg="opdracht" opent Rahul
       met die opdracht al ingevuld. Geen auto-verstuur -- de gebruiker leest mee
       en stuurt zelf, zodat de rust en de geld-drempel bij de gebruiker blijven.
       Via event-delegatie, dus het werkt ook op later bijgeladen schermen. */
    window.RTGRahul = window.RTGRahul || {};
    // het antwoordvenster openen; beide wegen lopen via dezelfde functie, zodat
    // de balk en het venster nooit tegelijk in beeld staan
    window.RTGRahul.open = function () { opengaan(null); };
    window.RTGRahul.vraag = function (tekst) { opengaan(tekst || ''); };
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
  var KAMERKEY = 'rtg_samen_kamer';
  var kamerId = null, deelCode = null;
  try { kamerId = localStorage.getItem(KAMERKEY); } catch (e) {}
  /* id.js staat parserblokkerend voor deze bundel. Toch ook hier fail-closed:
     als het bestand onderweg ontbreekt of door de browser is geweigerd, gaat
     er geen lege idempotentiesleutel naar een muterende Samen-route. */
  var veiligeIdem = function (voor) {
    if (typeof window.RTGIdem !== 'function') {
      throw new Error('Veilige browser-id ontbreekt; de Samen-actie is niet verstuurd.');
    }
    return window.RTGIdem(voor);
  };
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

  function zetKamer(id) {
    kamerId = id;
    try { id ? localStorage.setItem(KAMERKEY, id) : localStorage.removeItem(KAMERKEY); } catch (e) {}
  }
  function meldHier() {
    if (!kamerId) return;
    api('zet', { id: kamerId, pad: location.pathname, titel: document.title }).catch(function (e) {
      if (/bestaat niet|niet \(meer\)/.test(e.message)) zetKamer(null);
    });
  }
  function teken(chatOnder) {
    if (!kamerId) {
      vak.innerHTML = '<div class="mgz-uit">Kijk en doe samen: start een sessie en deel de code, of doe mee met de code van een vriend. Wie ergens heen gaat, kan de rest met een tik laten meegaan.</div>' +
        '<button class="mgz-go" data-start type="button" style="width:100%;">Start een samen-sessie</button>' +
        '<form class="mgz-rij" data-mee><input placeholder="Code van een vriend" maxlength="48" style="text-transform:uppercase;" aria-label="Samen-code"><button class="mgz-go" type="submit">Doe mee</button></form>';
      vak.querySelector('[data-start]').addEventListener('click', function () {
        api('maak', { idem: veiligeIdem('samen-maak') })
          .then(function (d) { zetKamer(d.kamer.id); deelCode = d.code; meldHier(); teken(); })
          .catch(function (e) { alert(e.message); });
      });
      vak.querySelector('[data-mee]').addEventListener('submit', function (ev) {
        ev.preventDefault();
        var c = ev.target.querySelector('input').value.trim().toUpperCase(); if (!c) return;
        api('mee', { code: c }).then(function (d) {
          zetKamer(d.kamer.id); deelCode = null; teken();
          if (d.kamer.pad && d.kamer.pad !== location.pathname) banner('De kamer is bij ' + (d.kamer.titel || 'een andere pagina'), d.kamer.pad);
        }).catch(function (e) { alert(e.message); });
      });
      return;
    }
    api('staat', { id: kamerId }).then(function (d) {
      var k = d.kamer;
      var toegang = deelCode
        ? 'Deelcode, alleen nu: <span class="mgz-code">' + esc(deelCode) + '</span>'
        : 'Samen-kamer actief. De deelcode wordt niet opnieuw getoond.';
      vak.innerHTML = '<div class="mgz-uit">' + toegang + '<br>In de kamer: ' + k.leden.map(esc).join(', ') + '</div>' +
        '<div class="mgz-chat" data-chat>' + k.chat.map(function (c) { return '<div><b>' + esc(c.van) + ':</b> ' + esc(c.tekst) + '</div>'; }).join('') + '</div>' +
        '<form class="mgz-rij" data-zeg><input placeholder="Zeg iets tegen de kamer" maxlength="300" aria-label="Chatbericht"><button class="mgz-go" type="submit">→</button></form>' +
        '<div class="mgz-rij"><button class="mgz-stil" data-hier type="button" style="flex:1;">Kom hierheen</button>' +
        (k.benGastheer ? '<button class="mgz-stil" data-code type="button">Nieuwe deelcode</button><button class="mgz-stil" data-sluit type="button">Sluit</button>' : '') +
        '<button class="mgz-stil" data-weg type="button">Verlaat</button></div>';
      var chatEl = vak.querySelector('[data-chat]'); chatEl.scrollTop = chatEl.scrollHeight;
      vak.querySelector('[data-zeg]').addEventListener('submit', function (ev) {
        ev.preventDefault(); var inp2 = ev.target.querySelector('input'); var t = inp2.value.trim(); if (!t) return; inp2.value = '';
        api('chat', { id: kamerId, tekst: t }).then(function () { teken(true); }).catch(function (e) { alert(e.message); });
      });
      vak.querySelector('[data-hier]').addEventListener('click', function () { meldHier(); });
      var vernieuw = vak.querySelector('[data-code]');
      if (vernieuw) vernieuw.addEventListener('click', function () {
        api('code', { id: kamerId, idem: veiligeIdem('samen-code') })
          .then(function (r) { deelCode = r.code; teken(); }).catch(function (e) { alert(e.message); });
      });
      var sluit = vak.querySelector('[data-sluit]');
      if (sluit) sluit.addEventListener('click', function () {
        api('sluit', { id: kamerId }).then(function () {
          deelCode = null; zetKamer(null); teken();
        }).catch(function (e) { alert(e.message); });
      });
      vak.querySelector('[data-weg]').addEventListener('click', function () {
        api('weg', { id: kamerId }).catch(function () {}); deelCode = null; zetKamer(null); teken();
      });
      if (chatOnder) chatEl.scrollTop = chatEl.scrollHeight;
    }).catch(function () { zetKamer(null); teken(); });
  }
