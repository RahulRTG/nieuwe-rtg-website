/* DE MAKERSSTUDIO -- fragmenten aanwijzen op een tijdlijn.

   Dit is het stuk waar UITVOEREND.md par. 5 over zegt dat het formaat er op
   staat of valt. Niet op de runtime: die draait. Op het AUTEURSCHAP -- een maker
   die honderd fragmenten moet aanwijzen, doet dat niet twee keer als het
   gereedschap tegenvalt. Tot nu toe moest hij een fragment-id typen
   ("fragment:track:u91c0@0-60"), en dat is geen gereedschap maar een formulier.

   DE GETALLEN ZIJN DE WAARHEID, DE BALK IS DE AFFORDANCE. Begin en eind staan in
   twee gewone invoervelden: die werken met een toetsenbord, met een schermlezer
   en met dikke vingers. De balk eronder stuurt diezelfde velden aan. Andersom -- de balk als bron en de getallen als weergave -- zou betekenen dat wie niet kan
   slepen, niet kan monteren.

   EN WAAR RTG DE LENGTE NIET KENT, KOMT ER GEEN TIJDLIJN. Een balk over een stuk
   waarvan de duur onbekend is, zou een bereik beloven dat niemand kan nagaan.
   Zo'n stuk staat er wel, met de reden erbij. */
(function () {
  'use strict';
  if (!document.getElementById('vlakStudio')) return;
  var $ = function (s) { return document.querySelector(s); };
  var TOKEN = null;
  try { TOKEN = localStorage.getItem('rtg_member_token'); } catch (e) { TOKEN = null; }

  function api(pad, lijf) {
    var h = { 'Content-Type': 'application/json' };
    if (TOKEN) h.Authorization = 'Bearer ' + TOKEN;
    return fetch(pad, { method: 'POST', headers: h, body: JSON.stringify(lijf || {}) })
      .then(function (r) { return r.json().then(function (b) { return { status: r.status, body: b }; })
        .catch(function () { return { status: r.status, body: {} }; }); });
  }
  function zeg(t) {
    var m = $('#melding'); m.textContent = t; m.classList.add('zien');
    setTimeout(function () { m.classList.remove('zien'); }, 3600);
  }
  var el = function (tag, klas, tekst) {
    var n = document.createElement(tag);
    if (klas) n.className = klas;
    if (tekst != null) n.textContent = tekst;
    return n;
  };
  var sec = function (n) { return Math.round(Number(n) || 0) + 's'; };

  var gekozenStuk = null;     // { stukId, titel, duurS }
  var stukken = [];

  /* ---- de tijdlijn ---- */
  function grens(n, laag, hoog) { return Math.max(laag, Math.min(hoog, n)); }
  function leesVan() { return grens(Math.round(Number($('#fragVan').value) || 0), 0, gekozenStuk.duurS - 1); }
  function leesTot() { return grens(Math.round(Number($('#fragTot').value) || 0), 1, gekozenStuk.duurS); }

  function tekenBalk() {
    if (!gekozenStuk) return;
    var van = leesVan(), tot = Math.max(leesTot(), van + 1);
    var d = gekozenStuk.duurS;
    var vlak = $('#balkVlak');
    vlak.style.left = (van / d * 100) + '%';
    vlak.style.width = ((tot - van) / d * 100) + '%';
    $('#balkTekst').textContent = sec(van) + ' tot ' + sec(tot) + ' (' + sec(tot - van) + ' van ' + sec(d) + ')';
    /* De balk is ook voor een schermlezer te volgen: hij vertelt wat er gekozen
       is, in dezelfde woorden als eronder staan. */
    $('#balk').setAttribute('aria-valuetext', $('#balkTekst').textContent);
  }

  function zetVelden(van, tot) {
    $('#fragVan').value = String(Math.round(van));
    $('#fragTot').value = String(Math.round(tot));
    tekenBalk();
  }

  /* Slepen op de balk. De dichtstbijzijnde kant beweegt mee -- dat is wat een
     mens verwacht als hij ergens op een balk begint te slepen, en het scheelt
     twee piepkleine handvatten die op een telefoon toch niet te raken zijn. */
  function sleep(ev) {
    if (!gekozenStuk) return;
    var balk = $('#balk'), r = balk.getBoundingClientRect();
    var x = (ev.touches ? ev.touches[0].clientX : ev.clientX) - r.left;
    var t = grens(Math.round(x / r.width * gekozenStuk.duurS), 0, gekozenStuk.duurS);
    var van = leesVan(), tot = leesTot();
    if (Math.abs(t - van) <= Math.abs(t - tot)) zetVelden(Math.min(t, tot - 1), tot);
    else zetVelden(van, Math.max(t, van + 1));
  }
  var sleept = false;
  function start(ev) { sleept = true; sleep(ev); ev.preventDefault(); }
  function beweeg(ev) { if (sleept) sleep(ev); }
  function stop() { sleept = false; }

  /* ---- het eigen werk ---- */
  function laadWerk() {
    return api('/api/uitvoering/eigenwerk').then(function (r) {
      stukken = (r.body && r.body.stukken) || [];
      var v = $('#werkLijst'); v.innerHTML = '';
      if (!stukken.length) {
        v.appendChild(el('p', 'stil', (r.body && r.body.uitleg) || 'Er is nog geen eigen werk.'));
        return;
      }
      stukken.forEach(function (s) {
        var b = el('button', 'knop werkknop', s.titel + ' · ' + s.vormNaam +
          (s.duurS ? ' · ' + sec(s.duurS) : ''));
        b.type = 'button';
        if (!s.duurS) {
          /* Geen tijdlijn zonder lengte, en de reden staat erbij in plaats van
             dat de knop stil niets doet. */
          b.disabled = true;
          b.title = s.reden;
          b.appendChild(el('span', 'stil', ' -- ' + s.reden));
        } else {
          b.onclick = function () { kiesStuk(s); };
        }
        v.appendChild(b);
      });
    });
  }

  function kiesStuk(s) {
    gekozenStuk = s;
    $('#knipVlak').hidden = false;
    $('#knipTitel').textContent = s.titel;
    $('#fragVan').max = String(s.duurS - 1);
    $('#fragTot').max = String(s.duurS);
    $('#balk').setAttribute('aria-valuemin', '0');
    $('#balk').setAttribute('aria-valuemax', String(s.duurS));
    zetVelden(0, Math.min(30, s.duurS));
    $('#fragNaam').value = s.titel;
  }

  /* ---- toevoegen aan de partituur ---- */
  function laadPartituren() {
    return api('/api/uitvoering/partituren').then(function (r) {
      var lijst = (r.body && r.body.partituren) || [];
      var k = $('#studioP'); k.innerHTML = '';
      if (!lijst.length) { k.appendChild(new Option(' -- maak eerst een partituur -- ', '')); return; }
      lijst.forEach(function (p) { k.appendChild(new Option(p.naam, p.id)); });
    });
  }

  $('#zetFragment').onclick = function () {
    if (!gekozenStuk) { zeg('Kies eerst een stuk uit uw eigen werk.'); return; }
    var pid = $('#studioP').value;
    if (!pid) { zeg('Kies eerst een partituur.'); return; }
    var van = leesVan(), tot = Math.max(leesTot(), van + 1);
    /* Het fragment-id wordt HIER samengesteld en niet door de maker getypt.
       Dat is het hele punt van dit scherm. De server leest hem opnieuw en
       weigert wat niet klopt -- dit is gemak, geen vertrouwen. */
    var fid = 'fragment:' + gekozenStuk.stukId + '@' + van + '-' + tot;
    var soort = $('#fragHandeling').value, doel = $('#fragDoel').value;
    api('/api/uitvoering/partituur/onderdeel', { id: pid, fragmentId: fid,
      rol: $('#fragRol').value, diepte: Number($('#fragDiepte').value),
      naam: $('#fragNaam').value.trim() || gekozenStuk.titel,
      handeling: soort && doel ? { soort: soort, doel: doel } : undefined })
      .then(function (r) {
        if (r.body && r.body.error) { zeg(r.body.error); return; }
        zeg('Toegevoegd: ' + sec(van) + ' tot ' + sec(tot) + '.');
        if (window.RTGUitvoeringHerlaad) window.RTGUitvoeringHerlaad();
      });
  };

  $('#fragVan').addEventListener('input', tekenBalk);
  $('#fragTot').addEventListener('input', tekenBalk);
  var balk = $('#balk');
  balk.addEventListener('pointerdown', start);
  window.addEventListener('pointermove', beweeg);
  window.addEventListener('pointerup', stop);
  /* Met het toetsenbord: de balk zelf is bedienbaar met de pijltjes, zodat wie
     niet sleept toch een bereik kan verschuiven zonder in de velden te hoeven. */
  balk.addEventListener('keydown', function (ev) {
    if (!gekozenStuk) return;
    var stap = ev.shiftKey ? 10 : 1, van = leesVan(), tot = leesTot();
    if (ev.key === 'ArrowLeft') { zetVelden(Math.max(0, van - stap), tot); ev.preventDefault(); }
    else if (ev.key === 'ArrowRight') { zetVelden(Math.min(tot - 1, van + stap), tot); ev.preventDefault(); }
    else if (ev.key === 'ArrowUp') { zetVelden(van, Math.min(gekozenStuk.duurS, tot + stap)); ev.preventDefault(); }
    else if (ev.key === 'ArrowDown') { zetVelden(van, Math.max(van + 1, tot - stap)); ev.preventDefault(); }
  });

  window.RTGStudioLaad = function () { laadWerk(); laadPartituren(); };
})();
