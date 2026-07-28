/* Muisvrij bedienen, deel 2: de balk.

   Een vaste strook onderaan met een veld, en daarboven het gesprek. Dit is de
   ENE ingang: typen of praten, en er gebeurt iets. De zinsontleding zit in
   shared/handenvrij.js, het gesprek in handenvrij-chat.js en het luisteren en
   terugpraten in handenvrij-mond.js. Die twee haalt dit bestand erbij; ze krijgen
   een gedeelde kamer mee (doe/zeg/vak) en vullen er hun eigen kant in.

   Twee dingen die hier bewust zo staan:
   - de plekken op de pagina worden bij ELKE opdracht opnieuw opgehaald, niet een
     keer bij het laden. In dit OS wisselen schermen en tabs voortdurend; een
     lijst van een minuut oud wijst naar knoppen die er niet meer zijn.
   - een letter tikken waar dan ook belandt in de balk. Zonder dat blijf je toch
     eerst met de muis naar het veld gaan, en dan is de hele opzet zinloos. */
(function (root) {
  'use strict';
  if (root.__handenvrijBalk) return; root.__handenvrijBalk = true;
  var api = root.Handenvrij;
  if (!api || !api.versta) return;                 // deel 1 hoort er te zijn

  var memTok = null, supTok = null;
  try { memTok = localStorage.getItem('rtg_member_token'); } catch (e) {}
  try { supTok = localStorage.getItem('rtg_sup_token'); } catch (e) {}
  if (!memTok && !supTok) return;
  var pad = memTok ? '/api/fluister' : '/api/supplier/ai';
  var tok = memTok || supTok;

  var STEM = 'rtg_handenvrij_stem';
  var lezen = function (k, standaard) { try { var v = localStorage.getItem(k); return v == null ? standaard : v === '1'; } catch (e) { return standaard; } };
  var zetten = function (k, v) { try { localStorage.setItem(k, v ? '1' : '0'); } catch (e) {} };
  var stemAan = lezen(STEM, true);

  var css = '.hv-balk{position:fixed;left:0;right:0;bottom:0;z-index:38;display:flex;gap:.5rem;align-items:center;' +
    'padding:.55rem .7rem calc(.55rem + env(safe-area-inset-bottom,0px));background:rgba(12,12,11,.94);' +
    'border-top:1px solid var(--gold,#857007);font-family:Inter,system-ui,sans-serif;backdrop-filter:blur(6px);}' +
    '.hv-balk form{display:flex;gap:.5rem;flex:1;align-items:center;margin:0;}' +
    '.hv-balk input{flex:1;min-width:0;background:#0C0C0B;border:1px solid #333;border-radius:10px;color:#eee;' +
    'font:inherit;font-size:.88rem;padding:.5rem .7rem;}' +
    '.hv-balk input:focus-visible,.hv-k:focus-visible{outline:2px solid var(--gold,#857007);outline-offset:2px;}' +
    /* De knoppen moeten op een telefoon van 390px naast het veld passen; met
       drie woorden erin liep de rij het beeld uit. Vandaar een pijl voor sturen
       (zoals in de metgezel) en korte woorden voor de twee schakelaars. */
    '.hv-k{background:transparent;border:1px solid #444;border-radius:10px;color:#eee;font:inherit;font-size:.78rem;' +
    'padding:.45rem .5rem;cursor:pointer;white-space:nowrap;flex:0 0 auto;}' +
    '.hv-go{font-size:1rem;line-height:1;padding:.4rem .6rem;}' +
    '.hv-k[aria-pressed="true"]{background:var(--gold,#857007);color:#0C0C0B;border-color:var(--gold,#857007);font-weight:700;}' +
    '.hv-k.hv-hoort{background:#9E1C40;color:#fff;border-color:#9E1C40;}' +
    /* Weggelegd tot je hem oproept. Deze strook stond op ELK scherm onderaan,
       altijd, en was daarmee de grootste vaste knoppenrij van het huis --
       terwijl hij hetzelfde doet als Rahul: zeggen of typen wat er moet
       gebeuren. Je haalt hem nu van de onderrand omhoog (shared/randen.js),
       net als het bedieningspaneel van de bovenrand. Escape legt hem weg.
       Zolang hij weg is neemt hij ook geen ruimte meer in (hv-ruimte). */
    '.hv-balk.hv-weg,.hv-werk.hv-weg,.hv-chat.hv-weg{display:none;}' +
    'body.hv-ruimte{padding-bottom:3.6rem;}' +
    'body.hv-opgeruimd{padding-bottom:0;}' +
    '@media (prefers-reduced-motion: reduce){.hv-balk{backdrop-filter:none;}}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  var balk = document.createElement('div');
  balk.className = 'hv-balk hv-weg';
  balk.innerHTML = '<form><input type="text" maxlength="300" autocomplete="off" spellcheck="false"' +
    ' aria-label="Zeg of typ wat er moet gebeuren" placeholder="Zeg of typ het">' +
    '<button class="hv-k hv-go" type="submit" aria-label="Versturen">→</button></form>' +
    '<button class="hv-k" type="button" data-mond aria-pressed="false" hidden>Mond</button>' +
    '<button class="hv-k" type="button" data-stem aria-pressed="true">Stem</button>';
  var chat = document.createElement('div');
  chat.className = 'hv-chat'; chat.hidden = true;
  chat.setAttribute('role', 'log'); chat.setAttribute('aria-live', 'polite');
  chat.setAttribute('aria-label', 'Gesprek met Rahul');

  var form = balk.querySelector('form'), inp = balk.querySelector('input');
  var knMond = balk.querySelector('[data-mond]'), knStem = balk.querySelector('[data-stem]');

  /* Let op: als de pagina al geladen is, draait klaar() HIER, tijdens het inlezen
     van dit bestand. Alles wat verderop met var/function wordt neergezet bestaat
     dan nog niet. Een aanroep naar de gedeelde kamer hoort hier dus niet: die
     wierp een TypeError, waarna de rest van de module (inclusief de toets-luister)
     nooit meer werd opgezet. Het gesprek laadt zichzelf, in handenvrij-chat.js. */
  /* Oproepen en wegleggen. De onderrand (shared/randen.js) zoekt hiernaar via
     window.RTGRahul.open; is er op deze pagina al een andere Rahul-balk, dan
     laat die zijn eigen open() staan en blijft deze weg. Zo staat er nooit
     meer dan een. */
  function haalOp() {
    balk.classList.remove('hv-weg');
    var w = document.querySelector('.hv-werk'); if (w) w.classList.remove('hv-weg');
    document.body.classList.remove('hv-opgeruimd');
    if (inp) inp.focus();
  }
  function legWeg() {
    balk.classList.add('hv-weg'); chat.classList.add('hv-weg');
    var w = document.querySelector('.hv-werk'); if (w) w.classList.add('hv-weg');
    document.body.classList.add('hv-opgeruimd');
  }

  function klaar() {
    if (balk.parentNode || !document.body) return;
    document.body.appendChild(chat); document.body.appendChild(balk);
    document.body.classList.add('hv-ruimte', 'hv-opgeruimd');
    knStem.setAttribute('aria-pressed', String(stemAan));
    root.RTGRahul = root.RTGRahul || {};
    if (!root.RTGRahul.open) { root.RTGRahul.open = haalOp; root.RTGRahul.sluit = legWeg; }
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') legWeg(); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', klaar);
  else klaar();

  /* ---------- antwoorden ----------
     Een antwoord is een beurt in het gesprek, geen regel die de vorige wist.
     Het tekenen zit in handenvrij-chat.js; hier alleen de bedoeling. */
  function zeg(tekst, hardop) {
    if (kamer.beurt) kamer.beurt('rahul', tekst);
    if (hardop && stemAan && kamer.spreek) kamer.spreek(tekst);
  }

  /* ---------- de plekken op deze pagina ----------
     Wat een pagina zelf aanmeldt met Handenvrij.plek() gaat voor. Daarnaast rapen
     we op wat er toch al staat: alles met data-plek, de tabs en de navigatielinks.
     Zo werkt spraaknavigatie ook op de 150+ pagina's die hier niets van weten. */
  var eigen = [];
  function plekken() {
    var lijst = eigen.slice(), gezien = {};
    eigen.forEach(function (p) { gezien[api.kaal(p.naam)] = 1; });
    var kies = '[data-plek],[role="tab"],.tab,.tabbtn,nav a[href],[data-tab]';
    [].forEach.call(document.querySelectorAll(kies), function (el) {
      if (el.hidden || el.getAttribute('aria-hidden') === 'true') return;
      var naam = el.getAttribute('data-plek') || (el.textContent || '').trim();
      var k = api.kaal(naam);
      if (!k || k.length > 40 || gezien[k]) return;
      gezien[k] = 1;
      lijst.push({ naam: naam, doen: function () { el.click(); el.scrollIntoView({ block: 'nearest' }); } });
    });
    return lijst;
  }

  /* ---------- een bedoeling uitvoeren ----------
     hardop=true betekent: dit kwam van de MOND. Dat is niet alleen "praat het
     antwoord terug", het bepaalt ook of de geldpoort ingrijpt. */
  function doe(zin, hardop) {
    // staat er een geld-bevestiging open, dan is "ja"/"nee" daar het antwoord op
    if (hardop && kamer.geldAntwoord && kamer.geldAntwoord(zin)) return;
    var b = api.versta(zin, plekken());
    switch (b.soort) {
      case 'niets': return;
      case 'ga': zeg(b.plek.naam, hardop); try { b.plek.doen(); } catch (e) { zeg('Dat lukte niet.', hardop); } return;
      case 'terug': history.back(); return;
      case 'vooruit': history.forward(); return;
      case 'sluit': dicht(); inp.value = ''; inp.blur(); return;
      case 'omhoog': root.scrollBy({ top: -Math.round(innerHeight * 0.8), behavior: 'smooth' }); return;
      case 'omlaag': root.scrollBy({ top: Math.round(innerHeight * 0.8), behavior: 'smooth' }); return;
      case 'begin': root.scrollTo({ top: 0, behavior: 'smooth' }); return;
      case 'eind': root.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }); return;
      case 'stil': stelStem(false); zeg('Goed, ik hou het bij tekst.', false); return;
      case 'luid': stelStem(true); zeg('Ik praat weer mee.', true); return;
      case 'lijst': zeg(lijstTekst(), hardop); return;
      default: vraagRahul(b.zin, hardop);
    }
  }
  function lijstTekst() {
    var namen = plekken().slice(0, 14).map(function (p) { return p.naam; });
    return namen.length
      ? 'Hier kun je naartoe: ' + namen.join(', ') + '. En verder: terug, omhoog, omlaag, sluit, stil. Al het andere doe ik zelf. ' + geldRegel()
      : 'Op deze pagina vind ik geen vaste plekken. Zeg gewoon wat er moet gebeuren. ' + geldRegel();
  }
  function geldRegel() {
    return (kamer.geldAan && kamer.geldAan())
      ? 'Geld en boekingen mogen met de mond, met een bevestiging per opdracht.'
      : 'Geld en boekingen typ je; dat doe ik niet op je woord alleen.';
  }
  function stelStem(aan) {
    stemAan = !!aan; zetten(STEM, stemAan);
    knStem.setAttribute('aria-pressed', String(stemAan));
    if (!stemAan && kamer.zwijg) kamer.zwijg();
  }

  /* Alles wat geen navigatie is, gaat hiernaartoe: onveranderd naar Rahul, met
     de eigen inlog. Daar zitten de geld-drempel en de bevestiging, en die willen
     we niet dubbel (en dus niet half) in de browser nabouwen. */
  function vraagRahul(vraag, hardop) {
    /* De geldpoort staat VOOR het versturen. Kwam dit van de mond en gaat het
       over geld of een boeking, dan houdt hij het tegen (typen) of zet hij er
       eerst een bevestiging voor. Getypte tekst gaat gewoon door: dat is de
       weg die we juist willen. */
    if (kamer.geldPoort && kamer.geldPoort(vraag, !!hardop, function (z) { stuurRahul(z, hardop); })) return;
    stuurRahul(vraag, hardop);
  }
  function stuurRahul(vraag, hardop) {
    if (kamer.tikt) kamer.tikt(true);              // drie puntjes: hij is bezig
    fetch(pad, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok }, body: JSON.stringify({ q: vraag, lang: taal() }) })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (kamer.tikt) kamer.tikt(false);
        zeg((d && (d.antwoord || d.reply || d.error)) || 'Ik kwam er niet uit.', hardop);
      })
      .catch(function () {
        if (kamer.tikt) kamer.tikt(false);
        zeg('Even geen verbinding; probeer het zo weer.', hardop);
      });
  }
  function taal() { try { return localStorage.getItem('rtg_lang') || document.documentElement.lang || 'nl'; } catch (e) { return 'nl'; } }

  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    var q = inp.value.trim(); if (!q) return;
    inp.value = ''; mijnBeurt(q); doe(q, false);
  });

  /* Wat JIJ zegt hoort meteen in het gesprek te staan, ook als het navigatie
     blijkt. Anders zie je je eigen woorden pas terug als er een antwoord komt,
     en dat voelt niet als chatten maar als een formulier. */
  function mijnBeurt(tekst) { if (kamer.beurt) kamer.beurt('member', tekst); }
  /* Dichtdoen loopt via de standen-laag (handenvrij-scherm.js) als die er is;
     die haalt dan ook de pin eraf, zodat hij daarna weer vanzelf meebeweegt. */
  function dicht() { if (root.RTGChatScherm) root.RTGChatScherm.zet('min'); else chat.hidden = true; }
  knStem.addEventListener('click', function () { stelStem(!stemAan); });

  /* ---------- beginnen met typen, waar je ook bent ----------
     Een losse letter hoort in de balk te belanden, niet in het niets. We blijven
     van echte velden en van sneltoetsen (ctrl/cmd/alt) af, en van Escape binnen
     de balk maken we "laat maar". */
  document.addEventListener('keydown', function (ev) {
    if (ev.defaultPrevented || ev.ctrlKey || ev.metaKey || ev.altKey) return;
    var t = ev.target;
    if (t === inp) { if (ev.key === 'Escape') { inp.value = ''; inp.blur(); dicht(); } return; }
    var tag = (t && t.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select' || (t && t.isContentEditable)) return;
    if (ev.key === '/' || (ev.key && ev.key.length === 1 && /[\wÀ-ɏ]/.test(ev.key))) {
      ev.preventDefault(); inp.focus();
      if (ev.key !== '/') inp.value += ev.key;
    }
  });

  /* ---------- de mond erbij ----------
     Een gedeelde, muteerbare kamer: handenvrij-mond.js vult spreek/zwijg in en
     leest doe/zeg/knop. Zo kennen de twee delen elkaar zonder laadvolgorde-gedoe;
     hetzelfde late-binding-patroon als in de kern op de server. */
  var kamer = {
    doe: doe, zeg: zeg, knop: knMond, vak: chat, tok: tok, taal: taal,
    zetVeld: function (t) { inp.value = String(t || '').slice(0, 300); try { inp.focus(); } catch (e) {} },
    geldDoorgaan: function (z) { stuurRahul(z, true); },
    spreek: null, zwijg: null,          // vult handenvrij-mond.js in
    beurt: null, tikt: null, laadGesprek: null,  // vult handenvrij-chat.js in
    geldPoort: null, geldAntwoord: null, geldAan: null, // vult handenvrij-geld.js in
    naStand: null, camera: null         // vult handenvrij-scherm.js / -oog.js in
  };
  root.__handenvrijKamer = kamer;
  ['/shared/handenvrij-chat.js', '/shared/handenvrij-geld.js', '/shared/handenvrij-mond.js',
    '/shared/handenvrij-scherm.js', '/shared/handenvrij-oog.js',
    '/shared/handenvrij-bureau.js'].forEach(function (src) {
    var el = document.createElement('script');
    el.src = src; el.defer = true;
    document.head.appendChild(el);
  });

  // wat een pagina zelf aanmeldt, gaat voor op wat we uit de DOM oprapen
  api.plek = function (naam, doen) { if (naam && typeof doen === 'function') eigen.push({ naam: String(naam), doen: doen }); };
  api.zeg = function (t) { doe(String(t || ''), false); };
  api.balk = function () { inp.focus(); };
  api.plekken = plekken;
})(typeof self !== 'undefined' ? self : this);
