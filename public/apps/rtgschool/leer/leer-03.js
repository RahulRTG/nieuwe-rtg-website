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

  /* ---- de Memory Engine: wat komt er terug ----

     Drie dingen die dit scherm met opzet NIET doet. Er staat niet bij hoe lang
     iets geleden is (de server stuurt dat niet eens mee bij wat openstaat), er
     komt geen merkteken bij dat zegt "dit had je moeten weten", en de vragen
     zelf lopen door precies dezelfde kaart en dezelfde functies als een gewone
     oefensessie -- een herhaalvraag hoort er hetzelfde uit te zien als een
     nieuwe vraag. */
  async function toonHerhalingen() {
    var el = document.getElementById('herhaalLijst');
    if (!el) return;
    try {
      var d = await api('/api/leerstof/herhalen');
      el.innerHTML = d.open.length
        ? d.open.slice(0, 12).map(function (o) {
            return '<div class="doel"><span>' + esc(o.naam) + ' <span style="color:var(--soft);font-size:.72rem;">(' + esc(o.vak) + ')</span></span>' +
              '<span class="rij"><button class="knop" data-herhaal="' + esc(o.doel) + '" style="padding:.3rem .6rem;font-size:.76rem;">' + d.vragen + ' vragen</button></span></div>';
          }).join('')
        : '<div class="leeg">Er staat vandaag niets klaar om terug te halen.' +
          (d.later.length ? ' Het eerstvolgende komt op ' + esc(String(d.later[0].volgende).slice(0, 10)) + '.' : '') + '</div>';
      el.querySelectorAll('[data-herhaal]').forEach(function (b) {
        b.addEventListener('click', function () { herhaalStart(b.dataset.herhaal); });
      });
    } catch (e) { el.innerHTML = '<div class="leeg">' + esc(e.message) + '</div>'; }
  }

  /* Zelfde kaart, zelfde vraagweergave, zelfde antwoordknop als hierboven:
     alleen het STARTEN gaat langs een andere route, en het aantal vragen is
     kleiner. Vanaf de eerste vraag is er geen verschil meer. */
  async function herhaalStart(doelId) {
    try {
      var d = await api('/api/leerstof/herhaal', { doel: doelId });
      var k = document.getElementById('oefenKaart');
      k.hidden = false;
      document.getElementById('oefenUit').textContent = '';
      vraagToon('oefenKaart', d.vraag, d.opties, 'oefenStand', d.nr + '/' + d.totaal + ' \u00b7 ' + d.naam);
      k.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch (e) { meld(e.message); }
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
      /* De Misconception Graph: als de server heeft kunnen narekenen WAT er
         gedacht is, staat dat hier -- met daaronder dezelfde stof op een
         andere manier uitgelegd. Komt de server er niet uit, dan staat er
         niets extra's: een verzonnen duiding stuurt je de verkeerde kant op. */
      if (d.denkfout) regel += '<div style="margin-top:.4rem;"><b>' + esc(d.denkfout.naam) + '.</b> ' + esc(d.denkfout.uitleg) + '</div>';
      if (d.anders) regel += '<div style="margin-top:.35rem;opacity:.9;"><i>Anders uitgelegd (' + esc(d.anders.soort) + '):</i> ' + esc(d.anders.tekst) + '</div>';
      if (d.klaar) {
        document.getElementById('oefenOpties').innerHTML = '';
        document.getElementById('oefenIn').parentElement.hidden = true;
        /* Een herhaling eindigt anders dan een oefensessie: er valt niets bij
           te schrijven, want het doel stond er al. Het slotwoord komt van de
           server, zodat er hier geen tweede versie van diezelfde toon ontstaat. */
        uit.innerHTML = regel + '<br><b>' + d.aantalGoed + ' van de ' + d.totaal + ' goed.</b> ' +
          (d.slot ? esc(d.slot) : (d.behaald ? 'Dit leerdoel staat nu in je leerpaspoort.' : esc(d.advies || '')));
        laadPaspoort();
        toonHerhalingen();
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
    toonHerhalingen();
    if (window.RTGSchoolMeer) RTGSchoolMeer.start();
  }

  window.RTGSchool = { start: start, laadPaspoort: laadPaspoort, oefenAntwoord: oefenAntwoord };
})();
