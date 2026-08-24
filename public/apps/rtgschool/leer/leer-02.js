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
