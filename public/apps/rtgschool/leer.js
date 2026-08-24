/* RTG School (leden), deel 1: het leerpaspoort op de officiële ladder, de
   leerlijn per groep of fase, de les in gewone taal en de oefensessie van
   vijf opgaven. Antwoorden blijven op de server; hier staat alleen de stroom.
   Bewust geen scores buiten de sessie, geen reeksen, geen ranglijsten. */
(function () {
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

  /* De namen horen bij de ladder, niet bij de schermen: een fase-id is een
     verwijzing voor machines, geen tekst voor mensen. */
  function faseNaam(id) {
    var f = (LADDER.fasen || []).find(function (x) { return x.id === id; });
    return f ? f.naam : id;
  }
  function trapNaam(t) { return (LADDER.trappen && LADDER.trappen[t] && LADDER.trappen[t].naam) || t; }

  function toonPaspoort() {
    var el = document.getElementById('paspoort');
    if (!MIJN.fase) {
      el.innerHTML = 'Je staat nog niet op de ladder. Kies hieronder je fase; elke fase mag het begin zijn, en een stap terug is soms de beste stap.';
    } else {
      var verder = MIJN.verder || {};
      el.innerHTML = 'Je bent ingeschreven op <b>' + esc(MIJN.fase.naam) + '</b> (' + esc(trapNaam(MIJN.fase.trap)) + '), leerjaar ' + MIJN.jaar +
        (verder.volgende ? '. De normale trede hierna: ' + esc(faseNaam(verder.volgende)) + '.' : '.') +
        ((verder.doorstroom || []).length ? ' Vanuit hier kun je door naar: ' + verder.doorstroom.map(function (id) { return esc(faseNaam(id)); }).join(', ') + '.' : '');
    }
    document.getElementById('jaarKnop').hidden = !(MIJN.fase && MIJN.fase.jaren > MIJN.jaar);
    document.getElementById('eerlijk').textContent = MIJN.eerlijk || '';
    kpi();
  }

  /* Een fasekiezer is altijd per trap geordend: eerst de schoolsoort
     (Basisschool, Voortgezet onderwijs, Mbo, ...), daarbinnen de fasen.
     Hier stond een platte lijst van alle zesentwintig fasen -- Groep 1 naast
     Vwo naast Promotie -- en dat leest als een hoop, niet als een ladder.
     De trap-indeling bestond al in de data (fase.trap + LADDER.trappen);
     alleen het scherm gooide hem weg. */
  function faseOpties(eersteRegel, filter) {
    var perTrap = {};
    (LADDER.fasen || []).filter(filter || function () { return true; }).forEach(function (f) {
      (perTrap[f.trap] = perTrap[f.trap] || []).push(f);
    });
    return '<option value="">' + esc(eersteRegel) + '</option>' + Object.keys(perTrap)
      .sort(function (a, b) {
        return ((LADDER.trappen[a] || {}).volgorde || 99) - ((LADDER.trappen[b] || {}).volgorde || 99);
      })
      .map(function (t) {
        return '<optgroup label="' + esc(trapNaam(t)) + '">' +
          perTrap[t].map(function (f) {
            return '<option value="' + esc(f.id) + '">' + esc(f.naam) +
              (f.leeftijd ? ' · ' + esc(f.leeftijd) + ' jaar' : (f.jaren ? ' · ' + f.jaren + ' jaar' : '')) + '</option>';
          }).join('') + '</optgroup>';
      }).join('');
  }

  function vulKiezers() {
    document.getElementById('ladderKies').innerHTML = faseOpties('Kies je fase...');
    // een kiezer voor de leerlijn: de basisschoolfasen sturen de groep-leerlijn
    // aan, de rest de fase-leerlijn -- dat onderscheid is techniek en hoort
    // niet als twee losse lijsten op het scherm
    document.getElementById('leerKies').innerHTML = faseOpties('Kies je fase...');
    document.getElementById('examenKies').innerHTML =
      faseOpties('Kies je fase...', function (f) { return f.trap !== 'po' && f.trap !== 'leven'; });
  }

  /* ---- de leerlijn: vakken en doelen, met wat je al behaald hebt ---- */
  /* Het paspoort bewaart per behaald leerdoel alleen een id; de naam en het vak
     staan in de leerlijn. Wat de app opvraagt, onthoudt hij hier -- alleen dat,
     zodat de uitvoer leesbare namen kan geven zonder er iets bij te verzinnen. */
  var DOELINFO = {};
  async function toonVakken(vraag) {
    var el = document.getElementById('vakken');
    el.innerHTML = '<div class="leeg">De leerlijn wordt gehaald...</div>';
    try {
      var d = await api('/api/leerstof/vakken', vraag);
      (d.vakken || []).forEach(function (v) {
        (v.doelen || []).forEach(function (doel) { DOELINFO[doel.id] = { naam: doel.naam, vak: v.vak }; });
      });
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
        '<p style="margin-top:0.5rem;line-height:1.7;">' + esc(d.doel.les) + '</p>';
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


  async function laadPaspoort() {
    MIJN = await api('/api/onderwijs/mijn');
    toonPaspoort();
  }

  /* Meenemen: het leerpaspoort is van de leerling en gaat een leven lang mee,
     dus hoort het ook het huis uit te kunnen. De app kent zijn eigen model, dus
     geeft hij dat door in plaats van de gedeelde laag het scherm te laten
     raden: per behaald leerdoel de naam, het vak, de fase en de dag. Geen
     scores en geen rangorde -- die houdt deze app bewust ook niet bij. */
  if (window.RTGUitvoer) RTGUitvoer.bron(function () {
    var ids = MIJN && MIJN.doelen ? Object.keys(MIJN.doelen) : [];
    if (!ids.length) return null;
    return {
      naam: 'leerpaspoort',
      kolommen: ['leerdoel', 'vak', 'fase', 'datum'],
      rijen: ids.map(function (id) {
        var w = MIJN.doelen[id] || {}, i = DOELINFO[id] || {};
        return [i.naam || id, i.vak || '',
          w.fase ? (LADDER ? faseNaam(w.fase) : w.fase) : '', String(w.op || '').slice(0, 10)];
      })
    };
  });

  async function start() {
    try {
      LADDER = await api('/api/onderwijs/ladder');
      vulKiezers();
      await laadPaspoort();
    } catch (e) { meld(e.message); }
    /* De opties worden per vraag opnieuw getekend; een luisteraar op de
       container vangt ze allemaal, zonder per knop opnieuw te binden.

       Hij stond hierboven, BUITEN start(), en dat was de fout waar de
       paginascan al een ronde over klaagde. Uitgelogd vervangt het scherm
       zijn hele #main door de inlogkaart -- #oefenOpties bestaat dan niet
       meer, en een getElementById op niets kreeg alsnog een addEventListener.
       Dat is geen fout van start(): die draaide helemaal niet. Alles wat aan
       de DOM hangt hoort binnen start(), zoals in examen.js en bijles.js. */
    document.getElementById('oefenOpties').addEventListener('click', function (e) {
      var b = e.target.closest('[data-antw]');
      if (b) oefenAntwoord(b.dataset.antw);
    });
    document.getElementById('inschrijfKnop').addEventListener('click', async function () {
      var f = document.getElementById('ladderKies').value;
      if (!f) { meld('Kies eerst een fase op de ladder.'); return; }
      try { await api('/api/onderwijs/inschrijf', { fase: f }); meld('Ingeschreven; je paspoort loopt vanaf hier mee.'); laadPaspoort(); }
      catch (e) { meld(e.message); }
    });
    document.getElementById('jaarKnop').addEventListener('click', async function () {
      try { await api('/api/onderwijs/jaar-over', {}); meld('Een leerjaar erbij.'); laadPaspoort(); }
      catch (e) { meld(e.message); }
    });
    document.getElementById('leerKies').addEventListener('change', function () {
      if (!this.value) return;
      // de basisschool-leerlijn hangt aan de groep (po-g3 -> groep 3), de
      // rest aan de fase; de server kent beide vormen met hetzelfde antwoord
      var po = /^po-g(\d)$/.exec(this.value);
      toonVakken(po ? { groep: po[1] } : { fase: this.value });
    });
    document.getElementById('oefenStuur').addEventListener('click', function () { oefenAntwoord(document.getElementById('oefenIn').value); });
    document.getElementById('oefenIn').addEventListener('keydown', function (e) { if (e.key === 'Enter') oefenAntwoord(this.value); });
    if (window.RTGSchoolMeer) RTGSchoolMeer.start();
  }

  window.RTGSchool = { start: start, laadPaspoort: laadPaspoort, oefenAntwoord: oefenAntwoord };
})();
