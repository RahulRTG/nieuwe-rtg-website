/* Sessie: het gezin-account en het gekozen profiel, net als bij een
   streamingdienst. Eenmaal ingelogd blijft het hele gezin ingelogd op dit
   toestel; elk profiel weet wie hij is. Bewaard in localStorage, zodat de
   tools (leren, cv) je naam al kennen en de balk bovenin laat zien wie je bent. */
(function (w) {
  var KEY = 'rtf_sessie';
  // de gedeelde verbindingslaag (offline-banner + satellietmodus) laadt op
  // elke RTF-pagina mee; sessie.js zit overal, dus dit is de ene plek
  try {
    if (!document.querySelector('script[src="/shared/verbinding.js"]')) {
      var vscript = document.createElement('script');
      vscript.src = '/shared/verbinding.js';
      (document.head || document.documentElement).appendChild(vscript);
    }
  } catch (e) {}
  function lees() { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } }
  function api(p, b) {
    return fetch('/api/foundation' + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b || {}) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok) { var e = new Error(d.error || 'Er ging iets mis.'); e.data = d; e.needCv = !!d.needCv; e.status = r.status; throw e; } return d; }); });
  }
  /* Bestandsnamen en catalogussleutels zijn bewust gelijk. Alleen deze
     leerling- en gezinsruimtes krijgen de centrale serverdeur; de openbare
     inlog, privacy-uitleg en professionele RTF-kantoren houden hun eigen deur. */
  var BESCHERMDE_APPS = ('leren overhoren school schrift projecten toetsen studie presenteren klas schrijven tellen kleuren memorie verhaaltje liedjes babyboek magazine dromen bord speelhal agenda ochtend klusjes keuken verjaardagen reis vrienden markt opvoeden club gevoel rust pesten kompas steun hulpwijzer zakgeld geld cv werk budget rechten veilig gezondheid privacy mijnbanden mediawijs schoolbieb beroepen geloofbieb leerpaspoort').split(' ');
  function paginaSleutel() {
    var m = /\/([^/?#]+)\.html$/.exec(location.pathname);
    return m ? m[1].toLowerCase() : '';
  }
  function toegangSlot(reden, laden) {
    var id = 'rtf-toegang-slot', el = document.getElementById(id);
    document.documentElement.classList.add('rtf-toegang-dicht');
    if (!document.getElementById('rtf-toegang-stijl')) {
      var stijl = document.createElement('style'); stijl.id = 'rtf-toegang-stijl';
      stijl.textContent = 'html.rtf-toegang-dicht body>*:not(#rtf-toegang-slot){visibility:hidden!important}html.rtf-toegang-dicht #rtf-toegang-slot{visibility:visible!important}';
      (document.head || document.documentElement).appendChild(stijl);
    }
    if (!el) {
      el = document.createElement('dialog'); el.id = id; el.setAttribute('role', 'alertdialog'); el.setAttribute('aria-modal', 'true');
      el.style.cssText = 'position:fixed;inset:0;z-index:2147483000;width:100%;height:100%;max-width:none;max-height:none;margin:0;border:0;display:grid;place-items:center;padding:1rem;background:#0c0c0b;color:#f6f1e7;font-family:Inter,system-ui,sans-serif';
      (document.body || document.documentElement).appendChild(el);
    }
    var s = lees(), beheer = !!(s && s.profiel && s.profiel.beheerder);
    el.innerHTML = '<div style="width:min(92vw,34rem);padding:1.35rem;border:1px solid #3a3730;border-radius:18px;background:#151513;box-shadow:0 24px 80px rgba(0,0,0,.55)">' +
      '<div style="font:600 .68rem/1 Inter;letter-spacing:.17em;text-transform:uppercase;color:#c9a24b">RTF veilige toegang</div>' +
      '<h1 style="font:500 1.75rem/1.15 Georgia,serif;margin:.55rem 0">' + (laden ? 'Jouw passen worden gecontroleerd…' : 'Deze ruimte blijft nog dicht') + '</h1>' +
      '<p style="color:#bdb8ad;line-height:1.55;margin:0 0 1rem">' + esc(reden || 'De server controleert je leeftijd en passen voordat dit scherm opengaat.') + '</p>' +
      (laden ? '<div style="height:3px;border-radius:9px;background:linear-gradient(90deg,#c23a5e,#c9a24b,#69b891)"></div>' :
        '<div style="display:flex;gap:.5rem;flex-wrap:wrap"><a data-rtf-wissel href="index.html#profielen" style="padding:.65rem .85rem;border-radius:10px;background:#f6f1e7;color:#111;text-decoration:none;font-weight:700">Kies een profiel</a>' +
        (beheer ? '<a href="beheer.html" style="padding:.65rem .85rem;border:1px solid #4a463d;border-radius:10px;color:#f6f1e7;text-decoration:none">Leeftijd instellen</a>' : '') + '</div>') + '</div>';
    var wissel = el.querySelector('[data-rtf-wissel]');
    if (wissel) wissel.onclick = function () {
      var ss = lees(); if (ss) { delete ss.token; delete ss.profiel; localStorage.setItem(KEY, JSON.stringify(ss)); }
    };
    try { if (!el.open) el.showModal(); } catch (e) {}
    return el;
  }
  function controleerToegang(gedwongen) {
    var sleutel = typeof gedwongen === 'string' && gedwongen ? gedwongen : paginaSleutel();
    var campus = sleutel === 'campus';
    if (!campus && BESCHERMDE_APPS.indexOf(sleutel) < 0) return Promise.resolve(null);
    var s = lees();
    if (!s || !s.code || !s.token) { toegangSlot('Kies eerst jouw eigen profiel. Zonder geldige Foundation-pas opent geen leerlingenscherm.', false); return Promise.resolve(null); }
    toegangSlot('De server controleert je Foundation-pas, leeftijdspas en Schoolpas.', true);
    return fetch('/api/rtf/toegang', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: s.code, token: s.token, appId: campus ? null : 'rtf-' + sleutel, scherm: campus ? 'campus' : 'app' }) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { d.httpOk = r.ok; return d; }); })
      .then(function (d) {
        if (!d.httpOk || !d.toegestaan) { toegangSlot(d.reden || 'Deze ruimte hoort niet bij jouw leeftijd of pas.', false); return d; }
        var el = document.getElementById('rtf-toegang-slot'); if (el) { try { el.close(); } catch (e) {} el.remove(); }
        document.documentElement.classList.remove('rtf-toegang-dicht');
        document.documentElement.setAttribute('data-rtf-groep', d.groep || 'kind');
        try { window.dispatchEvent(new CustomEvent('rtf-toegang', { detail: d })); } catch (e) {}
        return d;
      }).catch(function () { toegangSlot('De toegangscontrole is nu niet bereikbaar. Uit veiligheid blijft deze ruimte dicht; probeer het zo opnieuw.', false); return null; });
  }
  var Sessie = {
    huidig: lees,
    actief: function () { var s = lees(); return !!(s && s.code && s.token); },
    zet: function (s) { localStorage.setItem(KEY, JSON.stringify(s)); },
    wisProfiel: function () { var s = lees(); if (s) { delete s.token; delete s.profiel; localStorage.setItem(KEY, JSON.stringify(s)); } },
    uitloggen: function () { localStorage.removeItem(KEY); },
    naam: function () { var s = lees(); return (s && s.profiel && s.profiel.naam) || ''; },
    /* De deur van de RTFoundation.

       Hier stond `location.href = 'index.html'`: wie zonder gezinssessie een
       app opende, werd zonder een woord naar de voorpagina gegooid. Dat is
       erger dan een dichte deur -- je verliest ook waar je heen wilde, en
       veertig apps voelden daardoor leeg. Nu blijft u staan waar u was en
       vertelt de gedeelde deur (shared/deur.js) wat deze app is, wat u er
       straks doet (uit de app-gids die de pagina al heeft) en hoe u
       binnenkomt. De weg terug staat in de deur zelf, dus niemand raakt
       opgesloten.

       De pagina's roepen dit aan als `if (!Sessie.eisProfiel()) throw ...`;
       die worp blijft staan en stopt de rest van de pagina zoals altijd. */
    deur: function (soort) {
      var doel = document.querySelector('main') || document.querySelector('[role="main"]') || document.body;
      function toon() {
        try { window.RTGDeur.toon(doel, { soort: soort || 'gezin' }); } catch (e) { location.href = 'index.html'; }
      }
      if (window.RTGDeur) return toon();
      // de deur wordt zelden gebruikt, dus pas laden als hij nodig is
      var s = document.createElement('script');
      s.src = '/shared/deur.js';
      s.onload = toon;
      s.onerror = function () { location.href = 'index.html'; };
      document.head.appendChild(s);
    },
    // gebruik boven aan een tool-pagina: geen sessie -> de deur, met de weg erin
    eisProfiel: function () {
      if (!Sessie.actief()) { Sessie.deur('gezin'); return false; }
      var s = lees();
      if (s && s.profiel && s.profiel.rol === 'kind' && s.profiel.leeftijdBevestigd === false) {
        toegangSlot('Een beheerder vult eerst je geboortedatum in. Daarna krijg je automatisch de juiste leeftijdspas.', false); return false;
      }
      return true;
    },
    // privezaken van het gezin: gasten (oppas/opa/oma/familie) zien de deur
    isGast: function () { var s = lees(); return !!(s && s.profiel && s.profiel.gast); },
    eisFamilie: function () { if (!Sessie.actief() || Sessie.isGast()) { Sessie.deur('gezin'); return false; } return true; },
    isBeheerder: function () { var s = lees(); return !!(s && s.profiel && s.profiel.beheerder); },
    // controleer bij de server of het token nog klopt; geeft { gezin, profiel, profielen, ongelezen } of null
    ophalen: function () {
      var s = lees(); if (!s || !s.code || !s.token) return Promise.resolve(null);
      return fetch('/api/foundation/gezin/' + s.code + '/mij', { headers: { Authorization: 'Bearer ' + s.token } })
        .then(function (r) { if (!r.ok) return null; return r.json(); })
        .then(function (d) { if (d && d.profiel) { s.profiel = d.profiel; Sessie.zet(s); } return d; })
        .catch(function () { return null; });
    },
    api: api,
    toegang: controleerToegang,
    // herbruikbare AI-coach-chat. opts: { kind, chat, input, knop, wacht }
    coach: function (opts) {
      var s = lees(); if (!s) return;
      var gesprek = [];
      var NM = { vrouw: 'Rahul', man: 'Rahul', nonbinair: 'Rahul' };
      function buddyKeuze() { try { return localStorage.getItem('rtf_buddy') || 'vrouw'; } catch (e) { return 'vrouw'; } }
      // de leeftijdsgroep stuurt taal en niveau van de AI; van het profiel, anders de app-ingang
      function groepVan() { try { return (s.profiel && s.profiel.groep) || document.documentElement.getAttribute('data-rtf-groep') || ''; } catch (e) { return ''; } }
      function esc2(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }
      function verstuur() {
        var t = (opts.input.value || '').trim(); if (!t) return;
        opts.input.value = '';
        opts.chat.insertAdjacentHTML('beforeend', '<div class="b ik">' + esc2(t) + '</div>');
        gesprek.push({ role: 'user', content: t });
        var w = document.createElement('div'); w.className = 'b ai'; w.textContent = opts.wacht || ((NM[buddyKeuze()] || 'Rahul') + ' denkt mee...');
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
        '<button class="sb-bel" id="sbBel" title="Berichten van je gezin" aria-label="Berichten"><span class="sb-tel" id="sbTel" hidden>0</span></button>' +
        '<button class="sb-prof" id="sbProf"><span class="sb-av" style="background:' + (p.kleur || '#C9A24B') + '">' + esc(String(p.naam || '?').slice(0, 1).toUpperCase()) + '</span><span class="sb-nm">' + esc(p.naam) + '</span></button>' +
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
    fetch('/api/foundation/gezin/' + s.code + '/mij', { headers: { Authorization: 'Bearer ' + s.token } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) { if (!d) return; var t = el.querySelector('#sbTel'); if (d.ongelezen > 0) { t.textContent = d.ongelezen; t.hidden = false; } else t.hidden = true; })
      .catch(function () {});
  }
  function laadBerichten(el) {
    var s = lees(); var box = el.querySelector('#sbBerichten');
    box.innerHTML = '<div class="sb-leeg">Berichten laden...</div>';
    fetch('/api/foundation/gezin/' + s.code + '/berichten', { headers: { Authorization: 'Bearer ' + s.token } })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var lijst = (d.berichten || []);
        if (!lijst.length) { box.innerHTML = '<div class="sb-leeg">Nog geen berichten. Je gezin kan hier iets achterlaten.</div>'; return; }
        box.innerHTML = lijst.map(function (b) {
          var extra = b.soort === 'reis' ? '<a class="sb-reisknop" href="reis.html">Naar de reis</a>' : '';
          var kop = b.soort === 'hulp' ? '<div class="sb-hulplabel">SOS Vraagt om hulp</div>' : '';
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
      '.sb-brand{font-family:var(--serif);font-weight:500;background:#7F1634;color:#fff;padding:.18rem .6rem .22rem;border-radius:4px;}.sb-brand b{color:#F4E9C8;}' +
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
  /* Draait meteen wanneer sessie.js wordt gelezen, dus nog voordat de pagina
     bruikbaar wordt. De server beslist; bij storing blijft de deur dicht. */
  controleerToegang();
})(window);
