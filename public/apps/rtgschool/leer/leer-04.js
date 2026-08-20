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
    toonDag();
    if (window.RTGSchoolMeer) RTGSchoolMeer.start();
  }

  window.RTGSchool = { start: start, laadPaspoort: laadPaspoort, oefenAntwoord: oefenAntwoord };
})();
