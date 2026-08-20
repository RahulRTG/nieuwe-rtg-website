/* RTG Festival, het scherm: HET BLAD "POORT".

   Dit is het instrument van de mens bij het hek. Drie ontwerpregels, en ze
   komen alle drie uit FESTIVAL.md en ONTWERP.md:

   1. HET VELD HEEFT ALTIJD DE FOCUS. Een handscanner is een toetsenbord: hij
      typt de code en drukt op Enter. Wie de focus kwijtraakt, scant in het
      niets. Na elke uitslag springt hij terug -- maar alleen zolang dit blad
      open staat, want anders vecht hij met de andere bladen.

   2. DE UITSLAG DRAAGT EEN WOORD EN EEN TEKEN, en kleur is de derde laag
      (ONTWERP.md par. 5). Bij nacht, met een kapot scherm of met kleurenblind-
      heid moet GROEN nog steeds te lezen zijn.

   3. OFFLINE WORDT NIET WEGGEPOETST. Zonder verbinding kan dit scherm NIET
      beoordelen of een pas geldig is -- de rechten, het venster en de
      beslotenheid wonen op de server. Doen alsof (een groen vlak tonen en
      hopen) is precies de leugen waar dit huis niet aan doet. Dus: de scan gaat
      in een wachtrij met zijn eigen tijd, het scherm zegt ONBEVESTIGD in plaats
      van GROEN, en zodra de verbinding terug is stuurt hij de bundel -- die de
      server reconcilieert en waarvan hij de dubbele terugmeldt. */
(function () {
  'use strict';
  var F = window.RTGFestival;
  if (!F) return;

  var WACHTRIJ = 'rtg_festival_wachtrij';
  var LAATSTE_PLEK = 'rtg_festival_plek';
  var $ = function (s) { return document.querySelector(s); };
  var vak = $('#uitslag'), woord = $('#uitslagWoord'), zin = $('#uitslagZin'), bij = $('#uitslagBij');
  var veld = $('#code'), kiesPlek = $('#kiesPlek'), kiesRichting = $('#kiesRichting');
  var binnenUit = $('#binnen'), wachtrijUit = $('#wachtrij'), syncKnop = $('#synchroniseer');

  /* De vier standen van het vlak. `teken` staat in de INHOUD (data-teken wordt
     door de ::after gelezen), zodat de betekenis niet aan kleur hangt. */
  var STANDEN = {
    groen:   { sig: 'gezond',   woord: 'GROEN',       teken: '✓' },
    oranje:  { sig: 'aandacht', woord: 'ORANJE',      teken: '!' },
    rood:    { sig: 'incident', woord: 'ROOD',        teken: '×' },
    offline: { sig: 'aandacht', woord: 'ONBEVESTIGD', teken: '◷' },
    stil:    { sig: 'stil',     woord: 'GEREED',      teken: '' }
  };

  var poortOpen = function () { var p = document.getElementById('bladPoort'); return p && !p.hidden; };

  function toon(stand, tekst, extra) {
    var s = STANDEN[stand] || STANDEN.stil;
    vak.setAttribute('data-sig', s.sig);
    woord.textContent = s.woord;
    woord.setAttribute('data-teken', s.teken);
    zin.textContent = tekst || '';
    bij.textContent = extra || '';
    veld.value = '';
    if (poortOpen()) veld.focus();
  }

  /* ---------- de wachtrij ---------- */
  function rij() {
    try { return JSON.parse(localStorage.getItem(WACHTRIJ) || '[]'); } catch (e) { return []; }
  }
  function zetRij(lijst) {
    try { localStorage.setItem(WACHTRIJ, JSON.stringify(lijst)); } catch (e) {}
    wachtrijUit.textContent = lijst.length ? lijst.length + ' scan(s) in de wachtrij' : '';
    syncKnop.hidden = lijst.length === 0;
  }

  function stuurWachtrij() {
    var lijst = rij();
    if (!lijst.length) return;
    syncKnop.disabled = true;
    F.api('/api/festival/scan/bundel', { festival: F.staat.fid, editie: F.staat.eid, scans: lijst })
      .then(function (r) {
        syncKnop.disabled = false;
        if (r.status !== 200 || !r.body.ok) { toon('oranje', 'De wachtrij kon nog niet weg.', r.body.error || ''); return; }
        zetRij([]);
        var d = r.body.dubbel || [], g = r.body.geweigerd || [];
        /* Wat er MIS was gaat voor, want daar moet iemand iets mee. Een bundel
           die alleen "12 verwerkt" meldt, verstopt precies de twee codes waar
           de beveiliging naar wil kijken. */
        if (d.length || g.length) {
          toon('oranje', d.length + ' dubbel, ' + g.length + ' geweigerd van ' + r.body.aangeboden + '.',
            d.map(function (x) { return x.code + ' bij ' + x.poort; }).join(' · '));
        } else {
          toon('groen', r.body.verwerkt + ' scans verwerkt.', 'Wachtrij leeg.');
        }
      })
      .catch(function () { syncKnop.disabled = false; toon('oranje', 'Nog geen verbinding.', 'De wachtrij blijft staan.'); });
  }

  /* ---------- scannen ---------- */
  function scan(code) {
    var plek = kiesPlek.value, richting = kiesRichting.value;
    if (!code) return;
    if (!plek) { toon('rood', 'Kies eerst de poort waar u staat.'); return; }
    var poortNaam = kiesPlek.options[kiesPlek.selectedIndex].textContent;

    F.api('/api/festival/scan', { festival: F.staat.fid, editie: F.staat.eid, code: code,
      plek: plek, richting: richting, poort: poortNaam })
      .then(function (r) {
        var b = r.body || {};
        if (!b.stand) { toon('rood', b.error || 'Onbekend antwoord van de server.'); return; }
        toon(b.stand, b.zin, b.stand === 'groen' ? ((b.pas || {}).drager || '') : '');
        if (b.scan && b.scan.dag) { F.staat.dagId = b.scan.dag; telling(); F.zetStand(); }
      })
      .catch(function () {
        /* GEEN VERBINDING. Niet doen alsof; opslaan met de eigen tijd en
           eerlijk melden dat er niets is beoordeeld. */
        var nu = new Date(), lijst = rij();
        lijst.push({ code: code, plek: plek, richting: richting, poort: poortNaam,
          datum: nu.toISOString().slice(0, 10), tijd: nu.toISOString().slice(11, 16) });
        zetRij(lijst);
        toon('offline', 'Geen verbinding: opgeslagen, niet gecontroleerd.',
          'Laat door zolang u dat verantwoord vindt. De server kijkt na.');
      });
  }

  function telling() {
    if (!F.staat.dagId) return;
    F.api('/api/festival/bezetting', { festival: F.staat.fid, editie: F.staat.eid, dag: F.staat.dagId })
      .then(function (r) {
        var p = ((r.body || {}).plekken || [])[0];
        if (!p) { binnenUit.textContent = ''; return; }
        binnenUit.textContent = '';
        var sterk = document.createElement('b');
        sterk.textContent = p.aanwezig;
        binnenUit.appendChild(sterk);
        binnenUit.appendChild(document.createTextNode(' van ' + p.veiligeCapaciteit + ' in ' + p.naam));
      }).catch(function () {});
  }

  /* ---------- het blad vullen ---------- */
  F.opBlad('poort', function () {
    /* De teller staat er vanaf het openen, en niet pas na de eerste scan: de
       schil kent de lopende dag al van de server (/api/festival/dag/nu). Wie
       om drie uur 's nachts de poort opent, hoort niet eerst iemand te moeten
       binnenlaten voordat er een getal staat. */
    telling();
    if (kiesPlek.options.length) { if (poortOpen()) veld.focus(); return; }
    var poorten = F.staat.plekken.filter(function (p) { return p.rol && p.rol.poort; });
    /* Zonder poort in het terrein is er niets te scannen. Dat zeggen is beter
       dan een lege keuzelijst waar iemand naar staat te kijken. */
    if (!poorten.length) { toon('rood', 'Dit terrein heeft nog geen poort.', 'Zet een ingang in het terrein.'); return; }
    var vorige = null;
    try { vorige = localStorage.getItem(LAATSTE_PLEK); } catch (e) {}
    poorten.forEach(function (p) {
      var o = document.createElement('option');
      o.value = p.id; o.textContent = p.naam;
      if (p.id === vorige) o.selected = true;
      kiesPlek.appendChild(o);
    });
    toon('stil', 'Scan een pas of typ de code.');
  });

  kiesPlek.addEventListener('change', function () {
    try { localStorage.setItem(LAATSTE_PLEK, kiesPlek.value); } catch (e) {}
    veld.focus();
  });
  $('#scanForm').addEventListener('submit', function (ev) {
    ev.preventDefault();
    scan(veld.value.trim().toUpperCase());
  });
  syncKnop.addEventListener('click', stuurWachtrij);
  /* Terug online: meteen proberen. De mens hoeft daar niet aan te denken. */
  window.addEventListener('online', stuurWachtrij);
  /* Waar er ook geklikt wordt, het veld houdt de focus -- zie regel 1 boven.
     Alleen op dit blad, en niet op de bank of een keuzelijst. */
  document.addEventListener('click', function (ev) {
    if (!poortOpen()) return;
    if (ev.target.closest('select, button, .rv-bank, a')) return;
    veld.focus();
  });

  zetRij(rij());
})();
