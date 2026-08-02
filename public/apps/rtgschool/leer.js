/* RTG School (leden), deel 1: het leerpaspoort op de officiële ladder, de
   leerlijn per groep of fase, de les in gewone taal en de oefensessie van
   vijf opgaven. Antwoorden blijven op de server; hier staat alleen de stroom.
   Bewust geen scores buiten de sessie, geen reeksen, geen ranglijsten. */
(function () {
  /* Bij een uitgelogde bezoeker heeft de pagina #main al vervangen door de
     inlog-uitnodiging, terwijl dit bestand onvoorwaardelijk geladen wordt. Binden
     op een verdwenen element gooit een TypeError die de rest afbreekt. */
  function bindId(id, soort, fn) { var el = document.getElementById(id); if (el) el.addEventListener(soort, fn); }
  'use strict';
  var LADDER = null, MIJN = null;

  function kpi() {
    var el = document.getElementById('schoolKpi');
    if (!el || !MIJN) return;
    var doelen = Object.keys(MIJN.doelen || {}).length;
    el.innerHTML =
      '<div class="kpi"><b>' + (MIJN.fase ? esc(MIJN.fase.naam) : 'nog geen') + '</b><span>Mijn fase</span></div>' +
      '<div class="kpi"><b>' + (MIJN.fase ? 'jaar ' + MIJN.jaar : '-') + '</b><span>Leerjaar</span></div>' +
      '<div class="kpi"><b>' + doelen + '</b><span>Leerdoelen behaald</span></div>' +
      '<div class="kpi"><b>' + (MIJN.historie || []).length + '</b><span>Stappen op de ladder</span></div>';
  }

  function toonPaspoort() {
    var el = document.getElementById('paspoort');
    if (!MIJN.fase) {
      el.innerHTML = 'Je staat nog niet op de ladder. Kies hieronder je fase; elke fase mag het begin zijn, en een stap terug is soms de beste stap.';
    } else {
      var verder = MIJN.verder || {};
      el.innerHTML = 'Je bent ingeschreven op <b>' + esc(MIJN.fase.naam) + '</b>, leerjaar ' + MIJN.jaar +
        (verder.volgende ? '. De normale trede hierna: ' + esc(verder.volgende) + '.' : '.') +
        ((verder.doorstroom || []).length ? ' Vanuit hier kun je door naar: ' + verder.doorstroom.map(esc).join(', ') + '.' : '');
    }
    document.getElementById('jaarKnop').hidden = !(MIJN.fase && MIJN.fase.jaren > MIJN.jaar);
    document.getElementById('eerlijk').textContent = MIJN.eerlijk || '';
    kpi();
  }

  function vulKiezers() {
    var fasen = (LADDER.fasen || []);
    var opties = '<option value="">Kies een fase...</option>' +
      fasen.map(function (f) { return '<option value="' + esc(f.id) + '">' + esc(f.naam) + '</option>'; }).join('');
    document.getElementById('ladderKies').innerHTML = opties;
    document.getElementById('leerFase').innerHTML = '<option value="">Of een fase van de ladder...</option>' +
      fasen.filter(function (f) { return f.trap !== 'po'; }).map(function (f) { return '<option value="' + esc(f.id) + '">' + esc(f.naam) + '</option>'; }).join('');
    document.getElementById('examenKies').innerHTML = '<option value="">Kies je fase...</option>' +
      fasen.filter(function (f) { return f.trap !== 'po'; }).map(function (f) { return '<option value="' + esc(f.id) + '">' + esc(f.naam) + '</option>'; }).join('');
    var g = document.getElementById('leerGroep');
    var gs = '<option value="">Groep (1 t/m 8)...</option>';
    for (var i = 1; i <= 8; i++) gs += '<option value="' + i + '">Groep ' + i + '</option>';
    g.innerHTML = gs;
  }

  /* ---- de leerlijn: vakken en doelen, met wat je al behaald hebt ---- */
  async function toonVakken(vraag) {
    var el = document.getElementById('vakken');
    el.innerHTML = '<div class="leeg">De leerlijn wordt gehaald...</div>';
    try {
      var d = await api('/api/leerstof/vakken', vraag);
      el.innerHTML = (d.vakken || []).map(function (v) {
        return '<div class="vakkop">' + esc(v.vak) + '</div>' + v.doelen.map(function (doel) {
          return '<div class="doel"><span>' + (doel.behaald ? '<span class="pil ok">behaald</span> ' : '') + esc(doel.naam) +
            (doel.ref ? ' <span style="color:var(--soft);font-size:.72rem;">(' + esc(doel.ref) + ')</span>' : '') + '</span>' +
            '<span class="rij"><button class="knop stil" data-les="' + esc(doel.id) + '" style="padding:.3rem .6rem;font-size:.76rem;">Les</button>' +
            '<button class="knop" data-oefen="' + esc(doel.id) + '" style="padding:.3rem .6rem;font-size:.76rem;">Oefenen</button></span></div>';
        }).join('');
      }).join('') || '<div class="leeg">Voor deze keuze staat er nog geen leerlijn klaar.</div>';
      el.querySelectorAll('[data-les]').forEach(function (b) { b.addEventListener('click', function () { toonLes(b.dataset.les); }); });
      el.querySelectorAll('[data-oefen]').forEach(function (b) { b.addEventListener('click', function () { oefenStart(b.dataset.oefen); }); });
    } catch (e) { el.innerHTML = '<div class="leeg">' + esc(e.message) + '</div>'; }
  }

  async function toonLes(doelId) {
    try {
      var d = await api('/api/leerstof/les', { doel: doelId });
      var k = document.getElementById('lesKaart');
      k.hidden = false;
      document.getElementById('lesInhoud').innerHTML = '<b>' + esc(d.doel.naam) + '</b> (' + esc(d.doel.vak) + ')' +
        '<p style="margin-top:.4rem;line-height:1.7;">' + esc(d.doel.les) + '</p>';
      k.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch (e) { meld(e.message); }
  }

  /* ---- oefenen: vijf opgaven, een tegelijk ---- */
  function vraagToon(kaartId, vraag, opties, standId, stand) {
    document.getElementById(standId).textContent = stand;
    document.getElementById(kaartId === 'oefenKaart' ? 'oefenVraag' : 'examenVraag').textContent = vraag;
    var oEl = document.getElementById(kaartId === 'oefenKaart' ? 'oefenOpties' : 'examenOpties');
    var inEl = document.getElementById(kaartId === 'oefenKaart' ? 'oefenIn' : 'examenIn');
    oEl.innerHTML = '';
    inEl.value = '';
    if (opties && opties.length) {
      inEl.parentElement.hidden = true;
      oEl.innerHTML = opties.map(function (o) { return '<button class="knop stil" data-antw="' + esc(o) + '" type="button">' + esc(o) + '</button>'; }).join('');
    } else {
      inEl.parentElement.hidden = false;
      inEl.focus();
    }
  }

  async function oefenStart(doelId) {
    try {
      var d = await api('/api/leerstof/oefen', { doel: doelId });
      var k = document.getElementById('oefenKaart');
      k.hidden = false;
      document.getElementById('oefenUit').textContent = '';
      vraagToon('oefenKaart', d.vraag, d.opties, 'oefenStand', d.nr + '/' + d.totaal + ' · ' + d.naam);
      k.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch (e) { meld(e.message); }
  }

  async function oefenAntwoord(antw) {
    try {
      var d = await api('/api/leerstof/antwoord', { antwoord: antw });
      var uit = document.getElementById('oefenUit');
      var regel = d.goed ? 'Goed zo.' : 'Bijna: het juiste antwoord was "' + esc(d.juisteAntwoord) + '". Een fout is gewoon de volgende stap in de les.';
      if (d.klaar) {
        document.getElementById('oefenOpties').innerHTML = '';
        document.getElementById('oefenIn').parentElement.hidden = true;
        uit.innerHTML = regel + '<br><b>' + d.aantalGoed + ' van de ' + d.totaal + ' goed.</b> ' +
          (d.behaald ? 'Dit leerdoel staat nu in je leerpaspoort.' : esc(d.advies || ''));
        laadPaspoort();
      } else {
        uit.innerHTML = regel;
        vraagToon('oefenKaart', d.vraag, d.opties, 'oefenStand', d.nr + 1 + '/' + d.totaal);
      }
    } catch (e) { meld(e.message); }
  }

  // de opties worden per vraag opnieuw getekend; een luisteraar op de
  // container vangt ze allemaal, zonder per knop opnieuw te binden
  bindId('oefenOpties', 'click', function (e) {
    var b = e.target.closest('[data-antw]');
    if (b) oefenAntwoord(b.dataset.antw);
  });

  async function laadPaspoort() {
    MIJN = await api('/api/onderwijs/mijn');
    toonPaspoort();
  }

  async function start() {
    try {
      LADDER = await api('/api/onderwijs/ladder');
      vulKiezers();
      await laadPaspoort();
    } catch (e) { meld(e.message); }
    bindId('inschrijfKnop', 'click', async function () {
      var f = document.getElementById('ladderKies').value;
      if (!f) { meld('Kies eerst een fase op de ladder.'); return; }
      try { await api('/api/onderwijs/inschrijf', { fase: f }); meld('Ingeschreven; je paspoort loopt vanaf hier mee.'); laadPaspoort(); }
      catch (e) { meld(e.message); }
    });
    bindId('jaarKnop', 'click', async function () {
      try { await api('/api/onderwijs/jaar-over', {}); meld('Een leerjaar erbij.'); laadPaspoort(); }
      catch (e) { meld(e.message); }
    });
    bindId('leerGroep', 'change', function () {
      if (this.value) { document.getElementById('leerFase').value = ''; toonVakken({ groep: this.value }); }
    });
    bindId('leerFase', 'change', function () {
      if (this.value) { document.getElementById('leerGroep').value = ''; toonVakken({ fase: this.value }); }
    });
    bindId('oefenStuur', 'click', function () { oefenAntwoord(document.getElementById('oefenIn').value); });
    bindId('oefenIn', 'keydown', function (e) { if (e.key === 'Enter') oefenAntwoord(this.value); });
    if (window.RTGSchoolMeer) RTGSchoolMeer.start();
  }

  window.RTGSchool = { start: start, laadPaspoort: laadPaspoort, oefenAntwoord: oefenAntwoord };
})();
