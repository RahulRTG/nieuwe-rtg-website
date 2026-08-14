
  /* ---------- tekstdocument ---------- */
  function toonTekst(inhoud) {
    $('#tekst').style.display = '';
    $('#tekst').innerHTML = (inhoud && inhoud.tekst) || '';
    $('#tekst').contentEditable = magBewerken ? 'true' : 'false';
    if (magBewerken) {
      $('#tekstTools').style.display = 'flex';
      RTGOfficeTekst.bouwBalk($('#tekstTools'), $('#tekst'), markeer);
    }
    telBij();
  }
  $('#tekst').addEventListener('input', function () { markeer(); telBij(); });
  function telBij() {
    if (!open || open.soort !== 'tekst') return;
    $('#voetbalk').textContent = RTGOfficeTekst.tel($('#tekst')).regel;
  }

  /* ---------- rekenblad ---------- */
  function toonBlad(inhoud) {
    $('#bladWrap').style.display = '';
    if (!blad) blad = RTGOfficeBlad.maak({ tabel: $('#blad'), refVak: $('#celRef'), invoer: $('#celInvoer'),
      voet: $('#voetbalk'), onWijzig: markeer });
    blad.laad(inhoud, magBewerken);
    if (magBewerken) { $('#bladTools').style.display = 'flex'; blad.bouwBalk($('#bladTools')); }
  }

  /* ---------- formulier en schets ---------- */
  function toonFormulier(inhoud) {
    $('#formWrap').style.display = '';
    if (!formulier) formulier = RTGOfficeFormulier.maak({ wrap: $('#formWrap'), api: api, onWijzig: markeer, meld: zeg });
    formulier.laad(inhoud, magBewerken, open.id);
    var n = ((inhoud && inhoud.vragen) || []).length;
    $('#voetbalk').textContent = n + (n === 1 ? ' vraag' : ' vragen');
  }
  function toonSchets(inhoud) {
    $('#schetsWrap').style.display = '';
    if (!schets) schets = RTGOfficeSchets.maak({ wrap: $('#schetsWrap'), onWijzig: markeer, meld: zeg, voet: $('#voetbalk') });
    schets.laad(inhoud, magBewerken);
  }
  function toonBord(inhoud) {
    $('#bordWrap').style.display = '';
    if (!bord) bord = RTGOfficeBord.maak({ wortel: $('#bordWrap'), onWijzig: markeer, meld: zeg });
    bord.laad(inhoud, magBewerken);
    var n = ((inhoud && inhoud.lijsten) || []).reduce(function (a, l) { return a + ((l.kaarten || []).length); }, 0);
    $('#voetbalk').textContent = n + (n === 1 ? ' kaart' : ' kaarten');
  }

  /* ---------- presentatie ---------- */
  function toonPres(inhoud) {
    $('#presWrap').style.display = 'grid';
    if (!pres) pres = RTGOfficePres.maak({ rail: $('#diaRail'), vlak: $('#diaVlak'), onWijzig: markeer, meld: zeg });
    pres.laad(inhoud, magBewerken);
    $('#voetbalk').textContent = pres.dias().length + ' dia\'s';
  }
  $('#presBtn').addEventListener('click', function () {
    if (!pres) return;
    meldAanwezig('presenteert');
    presLoop = RTGOfficePres.presenteer({ doos: $('#toonDia'), titel: $('#tdTitel'), tekst: $('#tdTekst'),
      notitie: $('#tdNotitie'), teller: $('#tdTeller'), dias: pres.dias() });
    if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(function () {});
  });
  $('#tdVorige').addEventListener('click', function () { presLoop && presLoop.stap(-1); });
  $('#tdVolgende').addEventListener('click', function () { presLoop && presLoop.stap(1); });
  $('#tdNotitieBtn').addEventListener('click', function () { presLoop && presLoop.notitie(); });
  $('#tdDicht').addEventListener('click', function () {
    $('#toonDia').className = ''; presLoop = null;
    meldAanwezig(magBewerken ? 'bewerkt' : 'bekijkt');
    if (document.exitFullscreen) document.exitFullscreen().catch(function () {});
  });
  document.addEventListener('keydown', function (e) {
    if (!$('#toonDia').classList.contains('aan') || !presLoop) return;
    if (e.key === 'ArrowRight' || e.key === ' ') presLoop.stap(1);
    else if (e.key === 'ArrowLeft') presLoop.stap(-1);
    else if (e.key === 'n' || e.key === 'N') presLoop.notitie();
    else if (e.key === 'Escape') $('#tdDicht').click();
  });

  /* ---------- autosave ---------- */
  function markeer() {
    vuil = true; $('#staat').textContent = 'Opslaan…';
    meldTypen();
    clearTimeout(bewaarT); bewaarT = setTimeout(bewaarNu, 900);
  }
  function inhoudNu() {
    return open.soort === 'blad' ? blad.inhoud()
      : open.soort === 'presentatie' ? pres.inhoud()
      : open.soort === 'formulier' ? formulier.inhoud()
      : open.soort === 'schets' ? schets.inhoud()
      : open.soort === 'bord' ? bord.inhoud()
      : { tekst: $('#tekst').innerHTML.slice(0, 500000) };
  }
  function bewaarNu() {
    if (!open || !magBewerken || !vuil) return Promise.resolve(true);
    // Het document vastpakken vóór de rondreis: wie tijdens het bewaren
    // teruggaat naar de lijst (open wordt dan null) of een ander document
    // opent, mag niet door het late antwoord worden ingehaald.
    var doc = open, inhoud = inhoudNu();
    return api('bewaar', { id: doc.id, titel: $('#titel').value, inhoud: inhoud,
      verwachtGewijzigd: doc.gewijzigd }).then(function (r) {
      if (r.status === 409 && r.body.code === 'VERSIECONFLICT') {
        conflict = { id: doc.id, soort: doc.soort, titel: $('#titel').value,
          inhoud: JSON.parse(JSON.stringify(inhoud)), laatstDoor: r.body.laatstDoor };
        $('#staat').textContent = 'Nieuwere versie gevonden';
        $('#conflictUitleg').textContent = 'Uw wijzigingen zijn niet overschreven. ' +
          (r.body.laatstDoor ? r.body.laatstDoor + ' bewerkte intussen de nieuwste versie. ' : '') +
          'Bewaar uw werk als aparte kopie of open bewust de nieuwste versie.';
        $('#conflictScrim').classList.add('open');
        return false;
      }
      if (r.body.error) { $('#staat').textContent = ''; zeg(r.body.error); return false; }
      doc.gewijzigd = r.body.gewijzigd; doc.inhoud = inhoud;
      if (doc.werkstroom) doc.werkstroom.fase = r.body.fase || 'concept';
      if (open === doc) {
        vuil = false;
        open.titel = $('#titel').value;
        zetTab(open); tekenFase();
        meldAanwezig('bewerkt');
        $('#staat').textContent = 'Bewaard ' + new Date().toLocaleTimeString('nl-NL').slice(0, 5);
      }
      return true;
    });
  }
  $('#titel').addEventListener('input', markeer);
  setInterval(function () { if (vuil) bewaarNu(); }, 8000);
  window.addEventListener('beforeunload', function () { if (vuil) bewaarNu(); });

  $('#conflictKopie').addEventListener('click', function () {
    if (!conflict) return;
    var lokaal = conflict;
    var kopieTitel = String(lokaal.titel || 'Document').slice(0, 102) + ' (kopie)';
    api('maak', { soort: lokaal.soort, titel: kopieTitel }).then(function (m) {
      if (m.status !== 200) throw new Error(m.body.error || 'Kon geen kopie maken.');
      return api('bewaar', { id: m.body.id, titel: kopieTitel, inhoud: lokaal.inhoud }).then(function (b) {
        if (b.status !== 200) throw new Error(b.body.error || 'Kon de kopie niet bewaren.');
        return m.body.id;
      });
    }).then(function (id) {
      conflict = null; vuil = false; $('#conflictScrim').classList.remove('open');
      zeg('Uw werk staat veilig in een aparte kopie.'); openen(id, true); laadLijst();
    }).catch(function (e) { zeg(e.message || 'Kon de kopie niet bewaren.'); });
  });
  $('#conflictNieuwste').addEventListener('click', function () {
    if (!conflict) return;
    var id = conflict.id; conflict = null; vuil = false;
    $('#conflictScrim').classList.remove('open'); openen(id, true);
  });
