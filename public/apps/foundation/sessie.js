/* Sessie: het gezin-account en het gekozen profiel, net als bij een
   streamingdienst. Eenmaal ingelogd blijft het hele gezin ingelogd op dit
   toestel; elk profiel weet wie hij is. Bewaard in localStorage, zodat de
   tools (leren, cv) je naam al kennen en de balk bovenin laat zien wie je bent. */
(function (w) {
  var KEY = 'rtf_sessie';
  function lees() { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } }
  function api(p, b) {
    return fetch('/api/foundation' + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b || {}) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok) { var e = new Error(d.error || 'Er ging iets mis.'); e.data = d; e.needCv = !!d.needCv; e.status = r.status; throw e; } return d; }); });
  }
  var Sessie = {
    huidig: lees,
    actief: function () { var s = lees(); return !!(s && s.code && s.token); },
    zet: function (s) { localStorage.setItem(KEY, JSON.stringify(s)); },
    wisProfiel: function () { var s = lees(); if (s) { delete s.token; delete s.profiel; localStorage.setItem(KEY, JSON.stringify(s)); } },
    uitloggen: function () { localStorage.removeItem(KEY); },
    naam: function () { var s = lees(); return (s && s.profiel && s.profiel.naam) || ''; },
    // gebruik boven aan een tool-pagina: geen sessie -> terug naar de inlog
    eisProfiel: function () { if (!Sessie.actief()) { location.href = 'index.html'; return false; } return true; },
    // privezaken van het gezin: gasten (oppas/opa/oma/familie) worden teruggestuurd
    isGast: function () { var s = lees(); return !!(s && s.profiel && s.profiel.gast); },
    eisFamilie: function () { if (!Sessie.actief() || Sessie.isGast()) { location.href = 'index.html'; return false; } return true; },
    isBeheerder: function () { var s = lees(); return !!(s && s.profiel && s.profiel.beheerder); },
    // controleer bij de server of het token nog klopt; geeft { gezin, profiel, profielen, ongelezen } of null
    ophalen: function () {
      var s = lees(); if (!s || !s.code || !s.token) return Promise.resolve(null);
      return fetch('/api/foundation/gezin/' + s.code + '/mij?token=' + encodeURIComponent(s.token))
        .then(function (r) { if (!r.ok) return null; return r.json(); })
        .then(function (d) { if (d && d.profiel) { s.profiel = d.profiel; Sessie.zet(s); } return d; })
        .catch(function () { return null; });
    },
    api: api,
    // herbruikbare AI-coach-chat. opts: { kind, chat, input, knop, wacht }
    coach: function (opts) {
      var s = lees(); if (!s) return;
      var gesprek = [];
      var NM = { vrouw: 'Mila', man: 'Sem', nonbinair: 'Robin' };
      function buddyKeuze() { try { return localStorage.getItem('rtf_buddy') || 'vrouw'; } catch (e) { return 'vrouw'; } }
      // de leeftijdsgroep stuurt taal en niveau van de AI; van het profiel, anders de app-ingang
      function groepVan() { try { return (s.profiel && s.profiel.groep) || document.documentElement.getAttribute('data-rtf-groep') || ''; } catch (e) { return ''; } }
      function esc2(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }
      function verstuur() {
        var t = (opts.input.value || '').trim(); if (!t) return;
        opts.input.value = '';
        opts.chat.insertAdjacentHTML('beforeend', '<div class="b ik">' + esc2(t) + '</div>');
        gesprek.push({ role: 'user', content: t });
        var w = document.createElement('div'); w.className = 'b ai'; w.textContent = (NM[buddyKeuze()] || 'Je buddy') + ' denkt mee...';
        opts.chat.appendChild(w); opts.chat.scrollTop = opts.chat.scrollHeight;
        api('/hulp/ai', { code: s.code, token: s.token, kind: opts.kind, messages: gesprek, buddy: buddyKeuze(), groep: groepVan() })
          .then(function (d) { w.textContent = d.text; gesprek.push({ role: 'assistant', content: d.text }); opts.chat.scrollTop = opts.chat.scrollHeight; })
          .catch(function () { w.textContent = 'Sorry, dat lukte even niet. Probeer het zo nog eens.'; });
      }
      opts.knop.addEventListener('click', verstuur);
      opts.input.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); verstuur(); } });
    },
    // Balk bovenin met "ingelezen als", een belletje voor berichten en (voor de
    // beheerder) een knop naar Gezin beheren. plaats: een element om in te vullen.
    balk: function (el, opties) {
      opties = opties || {};
      var s = lees(); if (!s || !s.profiel) return;
      var p = s.profiel;
      var terug = opties.terug ? '<a class="sb-terug" href="' + opties.terug + '">' + (opties.terugTekst || '← Alle hulp') + '</a>' : '';
      el.innerHTML =
        '<div class="sb-balk">' +
        '<span class="sb-brand">RT<b>Foundation</b></span>' + terug +
        '<button class="sb-bel" id="sbBel" title="Berichten van je gezin" aria-label="Berichten">🔔<span class="sb-tel" id="sbTel" hidden>0</span></button>' +
        '<button class="sb-prof" id="sbProf"><span class="sb-av" style="background:' + (p.kleur || '#C9A24B') + '">' + (p.avatar || '🙂') + '</span><span class="sb-nm">' + esc(p.naam) + '</span></button>' +
        '</div>' +
        '<div class="sb-menu" id="sbMenu" hidden>' +
        (p.beheerder ? '<a href="beheer.html">Gezin beheren</a>' : '') +
        '<a href="index.html#profielen" id="sbWissel">Ander profiel</a>' +
        '<a href="#" id="sbUit">Gezin uitloggen</a>' +
        '</div>' +
        '<div class="sb-berichten" id="sbBerichten" hidden></div>';
      injectCss();
      var menu = el.querySelector('#sbMenu'), ber = el.querySelector('#sbBerichten');
      el.querySelector('#sbProf').onclick = function () { ber.hidden = true; menu.hidden = !menu.hidden; };
      el.querySelector('#sbWissel').onclick = function () { Sessie.wisProfiel(); };
      el.querySelector('#sbUit').onclick = function (e) { e.preventDefault(); if (confirm('Het hele gezin uitloggen op dit toestel?')) { Sessie.uitloggen(); location.href = 'index.html'; } };
      el.querySelector('#sbBel').onclick = function () { menu.hidden = true; ber.hidden = !ber.hidden; if (!ber.hidden) laadBerichten(el); };
      telOngelezen(el);
    }
  };
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }
  function telOngelezen(el) {
    var s = lees(); if (!s) return;
    fetch('/api/foundation/gezin/' + s.code + '/mij?token=' + encodeURIComponent(s.token))
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) { if (!d) return; var t = el.querySelector('#sbTel'); if (d.ongelezen > 0) { t.textContent = d.ongelezen; t.hidden = false; } else t.hidden = true; })
      .catch(function () {});
  }
  function laadBerichten(el) {
    var s = lees(); var box = el.querySelector('#sbBerichten');
    box.innerHTML = '<div class="sb-leeg">Berichten laden...</div>';
    fetch('/api/foundation/gezin/' + s.code + '/berichten?token=' + encodeURIComponent(s.token))
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var lijst = (d.berichten || []);
        if (!lijst.length) { box.innerHTML = '<div class="sb-leeg">Nog geen berichten. Je gezin kan hier iets achterlaten.</div>'; return; }
        box.innerHTML = lijst.map(function (b) {
          var extra = b.soort === 'reis' ? '<a class="sb-reisknop" href="reis.html">✈️ Naar de reis</a>' : '';
          var kop = b.soort === 'hulp' ? '<div class="sb-hulplabel">🆘 Vraagt om hulp</div>' : '';
          var wie = b.vanMij ? 'Jij' : esc(b.vanNaam);
          var aan = b.naar === 'allen' ? '' : '<span class="sb-aan"> aan ' + esc(b.naarNaam) + '</span>';
          return '<div class="sb-b ' + (b.soort || '') + '">' + kop + '<div class="sb-bkop">' + (b.vanAvatar || '') + ' <b>' + wie + '</b>' + aan + '</div><div class="sb-btxt">' + esc(b.tekst) + '</div>' + extra + '</div>';
        }).join('');
        api('/gezin/bericht/gelezen', { code: s.code, token: s.token }).then(function () { var t = el.querySelector('#sbTel'); if (t) t.hidden = true; }).catch(function () {});
      }).catch(function () { box.innerHTML = '<div class="sb-leeg">Kon berichten niet laden.</div>'; });
  }
  var cssGedaan = false;
  function injectCss() {
    if (cssGedaan) return; cssGedaan = true;
    var css = '.sb-balk{display:flex;align-items:center;gap:.6rem;padding:.6rem 1rem;border-bottom:1px solid var(--lijn);position:relative;}' +
      '.sb-brand{font-family:var(--serif);font-weight:500;}.sb-brand b{color:var(--goud);}' +
      '.sb-terug{color:var(--zacht);text-decoration:none;font-size:.85rem;}' +
      '.sb-bel{margin-left:auto;background:transparent;color:var(--txt);font-size:1.15rem;position:relative;line-height:1;padding:.2rem;}' +
      '.sb-tel{position:absolute;top:-4px;right:-6px;background:var(--rood);color:#fff;font-size:.62rem;font-weight:700;border-radius:999px;min-width:1.1rem;height:1.1rem;display:inline-flex;align-items:center;justify-content:center;padding:0 3px;}' +
      '.sb-tel[hidden]{display:none;}' +
      '.sb-prof{display:flex;align-items:center;gap:.45rem;background:transparent;color:var(--txt);}' +
      '.sb-av{width:1.8rem;height:1.8rem;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:1rem;}' +
      '.sb-nm{font-size:.9rem;font-weight:600;max-width:7rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}' +
      '.sb-menu{position:absolute;top:100%;right:1rem;z-index:40;background:var(--paneel);border:1px solid var(--lijn);border-radius:12px;padding:.4rem;display:flex;flex-direction:column;min-width:12rem;box-shadow:0 12px 30px rgba(0,0,0,.5);}' +
      '.sb-menu[hidden],.sb-berichten[hidden]{display:none;}' +
      '.sb-menu a{color:var(--txt);text-decoration:none;padding:.6rem .7rem;border-radius:8px;font-size:.9rem;}.sb-menu a:hover{background:var(--paneel2);color:var(--goud);}' +
      '.sb-berichten{position:absolute;top:100%;right:1rem;z-index:40;background:var(--paneel);border:1px solid var(--lijn);border-radius:12px;padding:.5rem;width:min(92vw,22rem);max-height:70vh;overflow:auto;box-shadow:0 12px 30px rgba(0,0,0,.5);}' +
      '.sb-leeg{color:var(--zacht);font-size:.85rem;padding:.8rem;text-align:center;}' +
      '.sb-b{padding:.6rem .7rem;border-radius:10px;background:var(--paneel2);margin-bottom:.4rem;}' +
      '.sb-b.reis{border:1px solid var(--goud);}' +
      '.sb-b.hulp{border:1px solid var(--rood);background:#2a1512;}' +
      '.sb-hulplabel{color:#e88;font-weight:700;font-size:.78rem;margin-bottom:.25rem;}' +
      '.sb-bkop{font-size:.78rem;color:var(--zacht);margin-bottom:.2rem;}.sb-bkop b{color:var(--txt);}' +
      '.sb-btxt{font-size:.92rem;line-height:1.4;white-space:pre-wrap;}' +
      '.sb-reisknop{display:inline-block;margin-top:.5rem;background:var(--goud);color:#1a1710;font-weight:700;font-size:.82rem;text-decoration:none;padding:.35rem .7rem;border-radius:8px;}';
    var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  }
  w.Sessie = Sessie;
})(window);
