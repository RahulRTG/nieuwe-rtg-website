  /* ---------- openen ---------- */
  function openen(id) {
    api('open', { id: id }).then(function (r) {
      if (r.status !== 200) return zeg(r.body.error || 'Kon niet openen.');
      open = r.body; magBewerken = !!r.body.magBewerken; vuil = false;
      $('#titel').value = r.body.titel; $('#titel').disabled = !r.body.eigenaar;
      $('#staat').textContent = magBewerken ? (r.body.eigenaar ? '' : 'meeschrijven · van ' + r.body.door)
        : 'alleen lezen · van ' + r.body.door;
      $('#deelBtn').style.display = r.body.eigenaar ? '' : 'none';
      // Rahul leest tekst en dia's; op een formulier of schets heeft hij niets te zoeken
      $('#aiBtn').style.display = magBewerken && r.body.soort !== 'formulier' && r.body.soort !== 'schets' && r.body.soort !== 'bord' ? '' : 'none';
      $('#presBtn').style.display = r.body.soort === 'presentatie' ? '' : 'none';
      $('#formBalk').style.display = r.body.soort === 'blad' ? '' : 'none';
      $('#tekstTools').style.display = 'none'; $('#bladTools').style.display = 'none';
      $('#tekst').style.display = 'none'; $('#bladWrap').style.display = 'none'; $('#presWrap').style.display = 'none';
      $('#formWrap').style.display = 'none'; $('#schetsWrap').style.display = 'none';
      $('#bordWrap').style.display = 'none';
      if (r.body.soort === 'blad') toonBlad(r.body.inhoud);
      else if (r.body.soort === 'presentatie') toonPres(r.body.inhoud);
      else if (r.body.soort === 'formulier') toonFormulier(r.body.inhoud);
      else if (r.body.soort === 'schets') toonSchets(r.body.inhoud);
      else if (r.body.soort === 'bord') toonBord(r.body.inhoud);
      else toonTekst(r.body.inhoud);
      $('#lijst').style.display = 'none'; $('#editor').classList.add('aan');
      volgMee();
    });
  }
  function volgMee() {
    clearInterval(leesT);
    leesT = setInterval(function () {
      if (!open || vuil) return;
      api('open', { id: open.id }).then(function (v) {
        if (v.status !== 200 || v.body.gewijzigd === open.gewijzigd) return;
        // wie een formulier aan het invullen is raakt zijn half getypte
        // antwoorden niet kwijt aan een verversing; nieuwe vragen komen
        // vanzelf bij de volgende keer openen
        if (open.soort === 'formulier' && !magBewerken) return;
        open.gewijzigd = v.body.gewijzigd; open.inhoud = v.body.inhoud;
        if (document.activeElement && document.activeElement.id === 'tekst') return;
        if (open.soort === 'blad') blad.laad(v.body.inhoud, magBewerken);
        else if (open.soort === 'presentatie') pres.laad(v.body.inhoud, magBewerken);
        else if (open.soort === 'formulier') formulier.laad(v.body.inhoud, magBewerken, open.id);
        else if (open.soort === 'schets') schets.laad(v.body.inhoud, magBewerken);
        else if (open.soort === 'bord') bord.laad(v.body.inhoud, magBewerken);
        else $('#tekst').innerHTML = (v.body.inhoud && v.body.inhoud.tekst) || '';
        zeg('Bijgewerkt door ' + (v.body.door || 'een ander'));
      });
    }, 5000);
  }
  function sluitEditor() {
    clearInterval(leesT); $('#editor').classList.remove('aan'); $('#lijst').style.display = '';
    open = null; $('#voetbalk').textContent = ''; laadLijst();
  }
  $('#editTerug').addEventListener('click', function () { if (vuil) bewaarNu(); sluitEditor(); });

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
    presLoop = RTGOfficePres.presenteer({ doos: $('#toonDia'), titel: $('#tdTitel'), tekst: $('#tdTekst'),
      notitie: $('#tdNotitie'), teller: $('#tdTeller'), dias: pres.dias() });
    if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(function () {});
  });
  $('#tdVorige').addEventListener('click', function () { presLoop && presLoop.stap(-1); });
  $('#tdVolgende').addEventListener('click', function () { presLoop && presLoop.stap(1); });
  $('#tdNotitieBtn').addEventListener('click', function () { presLoop && presLoop.notitie(); });
  $('#tdDicht').addEventListener('click', function () {
    $('#toonDia').className = ''; presLoop = null;
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
    if (!open || !magBewerken || !vuil) return Promise.resolve();
    // Het document vastpakken vóór de rondreis: wie tijdens het bewaren
    // teruggaat naar de lijst (open wordt dan null) of een ander document
    // opent, mag niet door het late antwoord worden ingehaald.
    var doc = open, inhoud = inhoudNu();
    return api('bewaar', { id: doc.id, titel: $('#titel').value, inhoud: inhoud }).then(function (r) {
      if (r.body.error) { $('#staat').textContent = ''; return zeg(r.body.error); }
      doc.gewijzigd = r.body.gewijzigd; doc.inhoud = inhoud;
      if (open === doc) {
        vuil = false;
        $('#staat').textContent = 'Bewaard ' + new Date().toLocaleTimeString('nl-NL').slice(0, 5);
      }
    });
  }
  $('#titel').addEventListener('input', markeer);
  setInterval(function () { if (vuil) bewaarNu(); }, 8000);
  window.addEventListener('beforeunload', function () { if (vuil) bewaarNu(); });

