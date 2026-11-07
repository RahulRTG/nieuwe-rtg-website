/* Sessie: het gezin-account en het gekozen profiel, net als bij een
   streamingdienst. Eenmaal ingelogd blijft het hele gezin ingelogd op dit
   toestel; elk profiel weet wie hij is. Bewaard in localStorage, zodat de
   tools (leren, cv) je naam al kennen en de balk bovenin laat zien wie je bent. */
(function (w) {
  const dsBijStart = document.documentElement.hasAttribute('data-ds');
  var KEY = 'rtf_sessie';
  function laadSessiePresentatie(pad) {
    if (document.documentElement.hasAttribute('data-ds')) return;
    if (document.getElementById('rtgDsRuntimeCss')) return;
    var presentatie = document.createElement('link');
    presentatie.id = 'rtgDsRuntimeCss';
    presentatie.rel = 'stylesheet';
    presentatie.href = pad;
    document.head.appendChild(presentatie);
  }
  // de gedeelde verbindingslaag (offline-banner + satellietmodus) laadt op
  // elke RTF-pagina mee; sessie.js zit overal, dus dit is de ene plek
  try {
    if (!document.querySelector('script[src="/shared/verbinding.js"]')) {
      var vscript = document.createElement('script');
      vscript.src = '/shared/verbinding.js';
      (document.head || document.documentElement).appendChild(vscript);
    }
    /* De balk hieronder draagt pictogrammen (data-glyf). Dit bestand zit op elk
       Foundation-scherm en shared/glyf.js op vier; zonder deze regel zou de
       berichtenknop op zevenenzestig schermen een leeg vakje zijn -- precies de
       fout die op de hub al zesenvijftig keer stond. Zelfde patroon als de
       verbindingslaag hierboven: de component brengt mee wat hij nodig heeft. */
    if (!document.querySelector('script[src="/shared/glyf.js"]')) {
      var gscript = document.createElement('script');
      gscript.src = '/shared/glyf.js';
      (document.head || document.documentElement).appendChild(gscript);
    }
  } catch (e) {}
  function lees() { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } }
  /* Afmelden gebeurt OOK op de server: de gezinssessie is een 128-bit token dat
     alleen als hash bestaat (server/foundation/gezinstoken.js), en wie hem hier
     weggooit zonder hem in te trekken laat een geldige sessie achter. Stil en
     zonder te wachten: een mislukte intrekking verloopt vanzelf. */
  /* Afmelden sluit de sessie op de server. Een bewaarde WISSEL-sessie (zie
     wissel() hieronder) gaat mee: die is ook een sessie van dit apparaat. */
  function afmelden(s) {
    if (!s || !s.code) return;
    [s.token, s.wissel].forEach(function (t) {
      if (!t) return;
      try { fetch('/api/foundation/gezin/sessie/intrek', { method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: s.code, token: t }) }).catch(function () {}); } catch (e) {}
    });
  }
  /* Profiel WISSELEN (B18): de lopende sessie blijft als `wissel` bewaard tot het
     volgende profiel met zijn eigen pincode binnen is; zo hoeft niemand de lange
     gezinscode opnieuw over te typen. De nieuwe sessie eindigt waar deze eindigt
     (de server verlengt bij wisselen niets), en daarna meldt index.html de
     bewaarde af. */
  function wissel(ss) {
    if (!ss) return;
    if (ss.token && !ss.wissel) ss.wissel = ss.token;
    delete ss.token; delete ss.profiel;
  }
  function api(p, b) {
    return fetch('/api/foundation' + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b || {}) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok) { var e = new Error(d.error || 'Er ging iets mis.'); e.data = d; e.needCv = !!d.needCv; e.status = r.status; throw e; } return d; }); });
  }
  /* Bestandsnamen en catalogussleutels zijn bewust gelijk. Alleen deze
     leerling- en gezinsruimtes krijgen de centrale serverdeur; de openbare
     inlog, privacy-uitleg en professionele RTF-kantoren houden hun eigen deur. */
  var BESCHERMDE_APPS = ('mail leren samen-thuis geld-later gezondheid-welzijn veilig-vertrouwd meedoen-ontdekken overhoren school schrift projecten toetsen studie presenteren klas schrijven tellen kleuren memorie verhaaltje liedjes babyboek magazine dromen bord speelhal agenda ochtend klusjes keuken verjaardagen reis vrienden markt opvoeden club gevoel rust pesten kompas steun hulpwijzer zakgeld geld cv werk budget rechten veilig gezondheid privacy mijnbanden mediawijs schoolbieb beroepen geloofbieb leerpaspoort').split(' ');
  function paginaSleutel() {
    var m = /\/([^/?#]+)\.html$/.exec(location.pathname);
    return m ? m[1].toLowerCase() : '';
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
        herstelToegangAchtergrond();
        document.documentElement.classList.remove('rtf-toegang-dicht', 'ds-foundation-dicht');
        document.documentElement.setAttribute('data-rtf-groep', d.groep || 'kind');
        try { window.dispatchEvent(new CustomEvent('rtf-toegang', { detail: d })); } catch (e) {}
        return d;
      }).catch(function () { toegangSlot('De toegangscontrole is nu niet bereikbaar. Uit veiligheid blijft deze ruimte dicht; probeer het zo opnieuw.', false); return null; });
  }
  /* EEN GEZIN ZONDER EIGENAAR-ACCOUNT (eigenaarsbesluit 19 oktober 2026: gebruiken
     vraagt een account). Buiten de demo antwoordt de server op een gezinstoken
     van een anoniem gezin met 401 en `accountNodig`. Dan is de bewaarde sessie
     niets meer waard: hij gaat weg, en de gezinsdeur wijst de weg naar een gezin
     aan het account van een ouder. Eén plek, omdat elk Foundation-scherm zijn
     eigen fetch heeft; de server blijft de poort, dit is alleen de weg terug. */
  if (w.fetch && !w.__rtfAccountNodig) {
    w.__rtfAccountNodig = true;
    var kaleFetch = w.fetch;
    w.fetch = function () {
      return kaleFetch.apply(this, arguments).then(function (r) {
        if (r && r.status === 401 && /\/api\/(rtf|foundation)\//.test(String(r.url || ''))) {
          r.clone().json().then(function (d) {
            if (d && d.accountNodig && Sessie.actief()) { schrijf(null); Sessie.deur('gezin'); }
          }).catch(function () {});
        }
        return r;
      });
    };
  }
/* Presentatie van dezelfde serverdeur. Tokens, profielwissel en de beslissing
   blijven in sessie-00; deze functie blijft in dezelfde bestaande bundel-IIFE. */
  var toegangAchtergrond = [];
  function verbergToegangAchtergrond(slot) {
    if (toegangAchtergrond.length || !document.body) return;
    Array.prototype.forEach.call(document.body.children, function (node) {
      if (node === slot) return;
      toegangAchtergrond.push({ node: node, hidden: node.hasAttribute('hidden'),
        inert: node.hasAttribute('inert'), aria: node.getAttribute('aria-hidden') });
      node.hidden = true; node.setAttribute('inert', ''); node.setAttribute('aria-hidden', 'true');
    });
  }
  function herstelToegangAchtergrond() {
    toegangAchtergrond.splice(0).forEach(function (staat) {
      if (!staat.node || !staat.node.isConnected) return;
      staat.node.hidden = staat.hidden;
      if (!staat.inert) staat.node.removeAttribute('inert');
      if (staat.aria == null) staat.node.removeAttribute('aria-hidden'); else staat.node.setAttribute('aria-hidden', staat.aria);
    });
  }
  function toegangBeeld(reden, laden, beheer) {
    return '<div class="ds-foundation-slot"><p class="ds-label">RTF · veilige toegang</p>' +
      '<h1 class="ds-titel ds-titel--scherm">' + (laden ? 'Jouw veilige wereld wacht op je' : 'Deze ruimte blijft nog dicht') + '</h1>' +
      '<p role="status">' + esc(reden || 'De server controleert je leeftijd en passen voordat dit scherm opengaat.') + '</p>' +
      (laden ? '<progress class="ds-foundation-laden" aria-label="Toegang controleren"></progress>' :
        '<div class="ds-foundation-acties"><a class="ds-knop ds-knop--primair" data-rtf-wissel href="index.html#profielen">Kies een profiel →</a>' +
        '<a class="ds-knop" data-rtf-uitweg href="/apps/app.html">Naar RTG OS</a>' +
        (beheer ? '<a class="ds-knop" href="beheer.html">Leeftijd instellen</a>' : '') + '</div>') + '</div>';
  }
  function toegangSlot(reden, laden) {
    var id = 'rtf-toegang-slot', el = document.getElementById(id);
    document.documentElement.classList.add('rtf-toegang-dicht', 'ds-foundation-dicht');
    laadSessiePresentatie('/ds/rtg-ds.css');
    if (!el) {
      el = document.createElement('dialog'); el.id = id; el.setAttribute('role', 'alertdialog'); el.setAttribute('aria-modal', 'true');
      el.className = 'ds-dialoog ds-foundation-toegang';
      (document.body || document.documentElement).appendChild(el);
    }
    verbergToegangAchtergrond(el);
    var s = lees(), beheer = !!(s && s.profiel && s.profiel.beheerder);
    el.innerHTML = toegangBeeld(reden, laden, beheer);
    var wisselKnop = el.querySelector('[data-rtf-wissel]');
    if (wisselKnop) wisselKnop.onclick = function () {
      var ss = lees(); if (ss) { wissel(ss); localStorage.setItem(KEY, JSON.stringify(ss)); }
    };
    try { if (!el.open) el.showModal(); } catch (e) {}
    return el;
  }
/* Dezelfde coach-owner, in dezelfde sessiebundel. Geen eigen sessie of transport. */
  function coach(opts) {
      var s = lees(); if (!s) return;
      var gesprek = [], bezig = false;
      function zelfdeProfiel() { var nu = lees(); return !!(nu && nu.code === s.code && nu.token === s.token &&
        (nu.profiel && nu.profiel.id) === (s.profiel && s.profiel.id)); }
      var NM = { vrouw: 'Rahul', man: 'Rahul', nonbinair: 'Rahul' };
      function buddyKeuze() { try { return localStorage.getItem('rtf_buddy') || 'vrouw'; } catch (e) { return 'vrouw'; } }
      // de leeftijdsgroep stuurt taal en niveau van de AI; van het profiel, anders de app-ingang
      function groepVan() { try { return (s.profiel && s.profiel.groep) || document.documentElement.getAttribute('data-rtf-groep') || ''; } catch (e) { return ''; } }
      function esc2(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }
      function verstuur() {
        var t = (opts.input.value || '').trim(); if (!t || (dsBijStart && (bezig || !zelfdeProfiel()))) return;
        if (dsBijStart) { bezig = true; opts.knop.disabled = true; }
        opts.input.value = '';
        opts.chat.insertAdjacentHTML('beforeend', '<div class="b ik' + (dsBijStart ? ' ds-gesprek__bericht ds-gesprek__bericht--eigen' : '') + '">' + esc2(t) + '</div>');
        gesprek.push({ role: 'user', content: t });
        var w = document.createElement('div'); w.className = 'b ai' + (dsBijStart ? ' ds-gesprek__bericht' : ''); w.textContent = opts.wacht || ((NM[buddyKeuze()] || 'Rahul') + ' denkt mee...');
        opts.chat.appendChild(w); opts.chat.scrollTop = opts.chat.scrollHeight;
        api('/hulp/ai', { code: s.code, token: s.token, kind: opts.kind, messages: gesprek, buddy: buddyKeuze(), groep: groepVan() })
          .then(function (d) {
            if (dsBijStart && !zelfdeProfiel()) { w.textContent = 'Je profiel is gewijzigd. Open deze ruimte opnieuw.'; return; }
            if (dsBijStart && (!d || d.error || d.ok === false || typeof d.text !== 'string' || !d.text.trim())) throw new Error('Geen coachantwoord');
            w.textContent = d.text; gesprek.push({ role: 'assistant', content: d.text }); opts.chat.scrollTop = opts.chat.scrollHeight;
          })
          .catch(function () {
            if (dsBijStart && !zelfdeProfiel()) { w.textContent = 'Je profiel is gewijzigd. Open deze ruimte opnieuw.'; return; }
            w.textContent = 'Sorry, dat lukte even niet. Probeer het zo nog eens.';
            if (dsBijStart) { gesprek.pop(); if (!opts.input.value) opts.input.value = t; }
          }).finally(function () { if (dsBijStart) { bezig = false; opts.knop.disabled = false; } });
      }
      opts.knop.addEventListener('click', verstuur);
      opts.input.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); verstuur(); } });
    }
/* WELKE LETTER PAST OP DEZE CIRKEL. De avatar krijgt de kleur die het lid
   zelf koos, en de letter stond vast op de tekstkleur van het huis -- wit.
   Wit op het standaardgoud #C9A24B haalt 2,2:1, en dat is geen initiaal maar
   een vlek; over de zeventig Foundation-schermen was dit in zijn eentje goed
   voor 43 contrastovertredingen. Een VASTE letterkleur is hier per definitie
   soms fout, want de achtergrond is van de gebruiker. Dus rekent hij het uit:
   wit of bijna zwart, wat van de twee het verst van deze kleur af staat. Zo
   klopt hij ook voor een kleur die vandaag nog niet bestaat. */
function opKleur(hex) {
  var h = String(hex == null ? '' : hex).trim().replace(/^#/, '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return '#0C0C0B';
  function k(v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
  var L = 0.2126 * k(parseInt(h.slice(0, 2), 16)) +
          0.7152 * k(parseInt(h.slice(2, 4), 16)) +
          0.0722 * k(parseInt(h.slice(4, 6), 16));
  return (1.05 / (L + 0.05)) >= ((L + 0.05) / 0.05) ? '#FFFFFF' : '#0C0C0B';
}

/* De deur blijft lazy, maar de loader heeft één vaste browserverantwoordelijkheid
   en alleen lokale letterlijke callsites. */
function laadFoundationDeur(pad, klaar, fout) {
  var script = document.createElement('script');
  script.onload = klaar; script.onerror = fout; script.src = pad;
  document.head.appendChild(script);
}

/* de sessie van de hulppas: lezen, actief en bewaren */
  function schrijf(s) {
    var old = lees();
    if (s) localStorage.setItem(KEY, JSON.stringify(s)); else localStorage.removeItem(KEY);
    if ((old && old.token || '') !== (s && s.token || '') ||
      (old && old.profiel && old.profiel.id || '') !== (s && s.profiel && s.profiel.id || ''))
      w.dispatchEvent(new Event('rtf-session-changed'));
  }
  var Sessie = {
    huidig: lees,
    actief: function () { var s = lees(); return !!(s && s.code && s.token); },
    zet: schrijf,
    wisProfiel: function () { var s = lees(); if (s) { wissel(s); schrijf(s); } },
    /* na een geslaagde wissel: de bewaarde sessie afmelden en vergeten */
    wisselKlaar: function () { var s = lees(); if (s && s.wissel) { afmelden({ code: s.code, token: s.wissel }); delete s.wissel; schrijf(s); } },
    uitloggen: function () { afmelden(lees()); schrijf(null); },
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

       Elke tool initialiseert binnen zijn eigen functie. Als eisProfiel()
       weigert, stopt een vroege return de initialisatie zonder paginafout.
       De toegangsdeur en de servercontrole blijven volledig van kracht. */
    deur: function (soort) {
      var doel = document.querySelector('main') || document.querySelector('[role="main"]') || document.body;
      function toon() {
        try { window.RTGDeur.toon(doel, { soort: soort || 'gezin' }); } catch (e) { location.href = 'index.html'; }
      }
      if (window.RTGDeur) return toon();
      // de deur wordt zelden gebruikt, dus pas laden als hij nodig is
      laadFoundationDeur('/shared/deur.js', toon, function () { location.href = 'index.html'; });
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
    coach: coach,
    // Balk bovenin met "ingelezen als", een belletje voor berichten en (voor de
    // beheerder) een knop naar Gezin beheren. plaats: een element om in te vullen.
    balk: function (el, opties) {
      opties = opties || {};
      var s = lees(); if (!s || !s.profiel) return;
      var p = s.profiel;
      var terug = opties.terug ? '<a class="sb-terug" href="' + opties.terug + '">' + (opties.terugTekst || '← Foundation') + '</a>' : '';
      el.innerHTML =
        '<div class="sb-balk">' +
        '<span class="sb-brand">Rahul Travel <b>Foundation</b></span>' + terug +
        '<span class="sb-safe"><i aria-hidden="true"></i>Veilig</span>' +
        '<button class="sb-bel" id="sbBel" title="Berichten van je gezin" aria-label="Berichten"><span data-glyf="berichten" aria-hidden="true"></span><span class="sb-tel" id="sbTel" hidden>0</span></button>' +
        '<button class="sb-prof" id="sbProf"><span class="sb-av" style="background:' + (p.kleur || '#164A98') + ';color:' + opKleur(p.kleur || '#164A98') + '">' + esc(String(p.naam || '?').slice(0, 1).toUpperCase()) + '</span><span class="sb-nm">' + esc(p.naam) + '</span></button>' +
        '</div>' +
        '<div class="sb-menu" id="sbMenu" hidden>' +
        (p.beheerder ? '<a href="beheer.html">Gezin beheren</a>' : '') +
        '<a href="index.html#profielen" id="sbWissel">Ander profiel</a>' +
        '<a href="#" id="sbUit">Gezin uitloggen</a>' +
        '</div>' +
        '<div class="sb-berichten" id="sbBerichten" hidden></div>';
      sessieVorm(el);
      injectCss();
      /* De balk wordt NA het laden getekend, dus de vuller van glyf.js is al
         langsgeweest. Hier nog een keer, alleen over dit stukje DOM. */
      try { if (window.RTGGlyf) RTGGlyf.vul(el); } catch (e) {}
      var menu = el.querySelector('#sbMenu'), ber = el.querySelector('#sbBerichten');
      el.querySelector('#sbProf').onclick = function () { ber.hidden = true; menu.hidden = !menu.hidden; };
      el.querySelector('#sbWissel').onclick = function () { Sessie.wisProfiel(); };
      el.querySelector('#sbUit').onclick = function (e) { e.preventDefault(); if (confirm('Het hele gezin uitloggen op dit toestel?')) { Sessie.uitloggen(); location.href = 'index.html'; } };
      el.querySelector('#sbBel').onclick = function () { menu.hidden = true; ber.hidden = !ber.hidden; if (!ber.hidden) laadBerichten(el); };
/* de ongelezen-teller */
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
  /* Dezelfde balk met DS-vorm; oorspronkelijke ids blijven gedragshaken. */
  function sessieVorm(el) {
    el.classList.add('ds-foundation-balk');
    var klassen = { 'sb-balk': 'ds-foundation-sessierij', 'sb-brand': 'ds-foundation-merk',
      'sb-terug': 'ds-knop ds-knop--klein', 'sb-safe': 'ds-meta',
      'sb-bel': 'ds-knop ds-knop--klein', 'sb-prof': 'ds-knop ds-knop--klein',
      'sb-tel': 'ds-foundation-teller', 'sb-av': 'ds-foundation-avatar',
      'sb-menu': 'ds-foundation-menu', 'sb-berichten': 'ds-foundation-berichten' };
    Object.keys(klassen).forEach(function (naam) {
      el.querySelectorAll('.' + naam).forEach(function (node) { klassen[naam].split(' ').forEach(function (k) { node.classList.add(k); }); });
    });
    el.querySelectorAll('.sb-menu a').forEach(function (a) { a.classList.add('ds-knop', 'ds-knop--stil'); });
    var prof = el.querySelector('#sbProf'), bel = el.querySelector('#sbBel');
    prof.setAttribute('aria-controls', 'sbMenu'); bel.setAttribute('aria-controls', 'sbBerichten');
    prof.setAttribute('aria-expanded', 'false'); bel.setAttribute('aria-expanded', 'false');
    el.addEventListener('click', function () {
      prof.setAttribute('aria-expanded', String(!el.querySelector('#sbMenu').hidden));
      bel.setAttribute('aria-expanded', String(!el.querySelector('#sbBerichten').hidden));
    });
    el.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      var menu = el.querySelector('#sbMenu'), berichten = el.querySelector('#sbBerichten');
      var bron = !menu.hidden ? prof : !berichten.hidden ? bel : null;
      if (!bron) return;
      e.preventDefault(); e.stopPropagation(); menu.hidden = true; berichten.hidden = true;
      prof.setAttribute('aria-expanded', 'false'); bel.setAttribute('aria-expanded', 'false');
      bron.focus();
    });
  }
  function injectCss() {
    laadSessiePresentatie('/ds/rtg-ds.css');
  }
  w.Sessie = Sessie;
  /* Draait meteen wanneer sessie.js wordt gelezen, dus nog voordat de pagina
     bruikbaar wordt. De server beslist; bij storing blijft de deur dicht. */
  controleerToegang();
})(window);
/* De wereldschil van de RTFoundation: welke bestemmingen er zijn, en welk
   scherm onder welke valt.

   WAAROM DIT HIER STAAT EN NIET IN 59 BESTANDEN. shared/wereldschil.js kent
   geen enkele wereld -- het is een naam, een pictogram, een adres en een lijst
   schermen. De invulling hoort bij de wereld, en deze bundel (sessie.js) zit
   al op elk gezinsscherm van de Foundation. Dat maakt dit de ene plek waar de
   kaart staat; zou elk scherm zijn eigen balk krijgen, dan zijn het over drie
   maanden 59 balken die net iets van elkaar verschillen.

   DE ZES BESTEMMINGEN ZIJN NIET BEDACHT. Het zijn de secties die de hub zelf
   al had ("Voor de kleinsten", "Leren en groeien", "Elke dag", "Ook hier voor
   je"), samengevat tot zes koppen. Elk van de 56 tegels op de hub viel al
   onder precies een ervan, dus er is niets verplaatst en niets verzonnen --
   alleen wat een lange lijst met koppen was, is nu een vaste balk.

   WAT ER BEWUST NIET IN ZIT. De professionele en bestuurlijke schermen van de
   Foundation (os-bestuur, os-donateur, os-vrijwilliger, kantoor, partner,
   clubswerk) dragen deze bundel niet en krijgen dus geen gezinsbalk. Dat is
   geen omissie: een bestuurder in het donateursportaal heeft niets aan een tab
   "Elke dag" met de gezinsagenda erachter. PLATFORM.md noemt die drie niveaus
   -- individu, professional, organisatie -- en dit is het eerste.

   EEN SCHERM DAT HIER NIET STAAT licht nergens op. Dat is met opzet: dan zie je
   dat het ontbreekt, terwijl een verkeerde tab die oplicht je de verkeerde kant
   op stuurt zonder dat iemand het merkt. */
(function (w, d) {
  'use strict';
  if (w.RTGWereld) return;

  var KAART = {
    sleutel: 'rtf',
    naam: 'RTFoundation',
    bestemmingen: [
      { id: 'thuis', naam: 'Thuis', href: 'index.html', glyf: 'rtf',
        schermen: ['index'] },

      { id: 'campus', naam: 'Campus', href: 'campus.html', glyf: 'diploma',
        schermen: ['campus', 'school', 'klas', 'leren', 'overhoren', 'schrijven',
          'schrift', 'projecten', 'toetsen', 'presenteren', 'studie', 'cv', 'werk',
          'beroepen', 'leerpaspoort', 'schoolbieb', 'bieb', 'geloofbieb', 'magazine',
          'bord', 'tellen', 'kleuren', 'memorie', 'verhaaltje', 'liedjes',
          'speeltuin', 'speelhal', 'arena', 'societeit'] },

      { id: 'dag', naam: 'Elke dag', href: 'agenda.html', glyf: 'agenda',
        schermen: ['agenda', 'keuken', 'ochtend', 'verjaardagen', 'klusjes',
          'gezondheid', 'babyboek', 'oppasinfo', 'reis', 'zakgeld', 'budget', 'geld'] },

      { id: 'samen', naam: 'Samen', href: 'vrienden.html', glyf: 'vrienden',
        schermen: ['vrienden', 'markt', 'contact', 'dromen', 'mijnbanden'] },

      { id: 'steun', naam: 'Steun', href: 'kompas.html', glyf: 'hart',
        schermen: ['kompas', 'rust', 'gevoel', 'veilig', 'pesten', 'steun',
          'hulpwijzer', 'opvoeden', 'rechten', 'mediawijs'] },

      { id: 'beheer', naam: 'Beheer', href: 'beheer.html', glyf: 'gear',
        schermen: ['beheer'] }
    ]
  };

  /* EEN WERELD CLAIMT ALLEEN ZIJN EIGEN SCHERMEN.

     Deze bundel zit op elk scherm in de Foundation-map dat een gezinssessie
     draagt -- en dat zijn er een paar die geen gezinsscherm ZIJN. Het
     Clubportaal is het duidelijkste geval: het vraagt om een clubcode, spreekt
     de bezoeker met u aan, en hoort bij de kantoorset in schil-os.js. Zonder
     deze controle zette dit bestand daar toch de gezinswereld neer, en omdat
     schil-os.js netjes afhaakt zodra er al een wereld staat, won de verkeerde
     van de twee -- met zes tabs die niet over zijn werk gaan en geen enkele
     die oplicht.

     De regel is dus dezelfde als in schil-os.js: staat dit scherm niet in mijn
     eigen kaart, dan is het niet van mij, en laat ik het aan de volgende. Een
     scherm dat in geen enkele kaart staat krijgt geen balk, en dat is eerlijker
     dan de verkeerde. */
  var m = /\/([^\/?#]+)\.html?$/.exec(w.location.pathname);
  var nu = m ? m[1].toLowerCase() : '';
  var vanMij = KAART.bestemmingen.some(function (b) {
    return (b.schermen || []).indexOf(nu) >= 0;
  });
  if (!vanMij) return;
  w.RTGWereld = KAART;

  /* Het blad en het gedrag erbij halen. Zelfde patroon als de verbindingslaag
     en de glyfen in sessie-00: de component brengt mee wat hij nodig heeft,
     zodat een scherm er niets voor hoeft te doen. De volgorde luistert niet --
     een script dat hier wordt ingehangen draait pas nadat deze bundel klaar is,
     en dan staat RTGWereld er dus al. */
  try {
    if (!document.documentElement.hasAttribute('data-ds') && !d.querySelector('link[href="/shared/wereldschil.css"]')) {
      var blad = d.createElement('link');
      blad.rel = 'stylesheet';
      blad.href = '/shared/wereldschil.css';
      (d.head || d.documentElement).appendChild(blad);
    }
    if (!d.querySelector('script[src="/shared/wereldschil.js"]')) {
      var foundationWereldschilScriptNode = document.createElement('script');
      foundationWereldschilScriptNode.src = '/shared/wereldschil.js';
      document.head.appendChild(foundationWereldschilScriptNode);
    }
  } catch (e) {}
})(window, document);
