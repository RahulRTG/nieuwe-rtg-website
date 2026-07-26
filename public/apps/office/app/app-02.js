  /* ---------- openen ---------- */
  function openen(id) {
    api('open', { id: id }).then(function (r) {
      if (r.status !== 200) return zeg(r.body.error || 'Kon niet openen.');
      open = r.body; magBewerken = !!r.body.magBewerken; vuil = false;
      $('#titel').value = r.body.titel; $('#titel').disabled = !r.body.eigenaar;
      $('#staat').textContent = magBewerken ? (r.body.eigenaar ? '' : 'meeschrijven · van ' + r.body.door)
        : 'alleen lezen · van ' + r.body.door;
      $('#deelBtn').style.display = r.body.eigenaar ? '' : 'none';
      $('#aiBtn').style.display = magBewerken ? '' : 'none';
      $('#presBtn').style.display = r.body.soort === 'presentatie' ? '' : 'none';
      $('#formBalk').style.display = r.body.soort === 'blad' ? '' : 'none';
      $('#tekstTools').style.display = 'none'; $('#bladTools').style.display = 'none';
      $('#tekst').style.display = 'none'; $('#bladWrap').style.display = 'none'; $('#presWrap').style.display = 'none';
      if (r.body.soort === 'blad') toonBlad(r.body.inhoud);
      else if (r.body.soort === 'presentatie') toonPres(r.body.inhoud);
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
        open.gewijzigd = v.body.gewijzigd; open.inhoud = v.body.inhoud;
        if (document.activeElement && document.activeElement.id === 'tekst') return;
        if (open.soort === 'blad') blad.laad(v.body.inhoud, magBewerken);
        else if (open.soort === 'presentatie') pres.laad(v.body.inhoud, magBewerken);
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
      : { tekst: $('#tekst').innerHTML.slice(0, 500000) };
  }
  function bewaarNu() {
    if (!open || !magBewerken || !vuil) return Promise.resolve();
    var inhoud = inhoudNu();
    return api('bewaar', { id: open.id, titel: $('#titel').value, inhoud: inhoud }).then(function (r) {
      if (r.body.error) { $('#staat').textContent = ''; return zeg(r.body.error); }
      vuil = false; open.gewijzigd = r.body.gewijzigd; open.inhoud = inhoud;
      $('#staat').textContent = 'Bewaard ' + new Date().toLocaleTimeString('nl-NL').slice(0, 5);
    });
  }
  $('#titel').addEventListener('input', markeer);
  setInterval(function () { if (vuil) bewaarNu(); }, 8000);
  window.addEventListener('beforeunload', function () { if (vuil) bewaarNu(); });

  /* ---------- delen ---------- */
  $('#deelBtn').addEventListener('click', function () { if (!open) return; toonDeel(); $('#deelScrim').classList.add('open'); });
  $('#deelDicht').addEventListener('click', function () { $('#deelScrim').classList.remove('open'); });
  if (WERK === 'rtf') {
    $('#deelForm').style.display = 'none'; $('#gezinBlok').style.display = '';
    $('#deelKop').textContent = 'Delen met je gezin';
    $('#deelUitleg').textContent = 'Een document blijft van jou; je kunt je gezin laten meelezen of er samen in schrijven. Buiten het gezin deelt RTF niets.';
  }
  function toonDeel() {
    api('open', { id: open.id }).then(function (r) {
      if (WERK === 'rtf') {
        var s = (r.body && r.body.kringDeel) || 'uit';
        $('#gezinRechten').value = s || 'uit';
        $('#deelLijst').textContent = s === 'bewerken' ? 'Jullie schrijven hier samen in.'
          : s === 'lezen' ? 'Je gezin leest mee.' : 'Alleen jij ziet dit document.';
        return;
      }
      var lees = (r.body && r.body.gedeeldMet) || [], schrijf = (r.body && r.body.bewerkers) || [];
      $('#deelLijst').innerHTML = (lees.length || schrijf.length)
        ? (schrijf.length ? 'Meeschrijvers: ' + schrijf.map(esc).join(', ') + '<br>' : '') +
          (lees.length ? 'Meelezers: ' + lees.map(esc).join(', ') : '')
        : 'Nog met niemand gedeeld.';
    });
  }
  $('#gezinZet').addEventListener('click', function () {
    api('gezin', { id: open.id, rechten: $('#gezinRechten').value }).then(function (r) {
      if (r.body.error) return zeg(r.body.error);
      zeg('Bewaard.'); toonDeel();
    });
  });
  $('#deelForm').addEventListener('submit', function (e) {
    e.preventDefault();
    api('deel', { id: open.id, codenaam: $('#deelCode').value, aan: true, rechten: $('#deelRechten').value })
      .then(function (r) {
        if (r.body.error) return zeg(r.body.error);
        $('#deelCode').value = ''; zeg('Gedeeld.'); toonDeel();
      });
  });

  /* ---------- versiegeschiedenis ---------- */
  $('#versiesBtn').addEventListener('click', function () {
    if (!open) return;
    api('versies', { id: open.id }).then(function (r) {
      if (r.body.error) return zeg(r.body.error);
      $('#versieLijst').innerHTML = (r.body.versies || []).length ? r.body.versies.map(function (v) {
        return '<div class="vitem"><span class="rek">' + new Date(v.om).toLocaleString('nl-NL') + ' · ' + esc(v.door || '') + '</span>' +
          (open.eigenaar ? '<button class="knop" data-terug="' + v.nr + '">Zet terug</button>' : '') + '</div>';
      }).join('') : '<p class="stil">Nog geen eerdere versies.</p>';
      $('#versieScrim').classList.add('open');
      Array.prototype.forEach.call($('#versieLijst').querySelectorAll('[data-terug]'), function (b) {
        b.addEventListener('click', function () {
          api('terug', { id: open.id, nr: b.dataset.terug }).then(function (t) {
            if (t.body.error) return zeg(t.body.error);
            open.gewijzigd = t.body.gewijzigd; open.inhoud = t.body.inhoud; vuil = false;
            if (open.soort === 'blad') blad.laad(t.body.inhoud, magBewerken);
            else if (open.soort === 'presentatie') pres.laad(t.body.inhoud, magBewerken);
            else { $('#tekst').innerHTML = (t.body.inhoud && t.body.inhoud.tekst) || ''; telBij(); }
            $('#versieScrim').classList.remove('open'); zeg('Versie teruggezet.');
          });
        });
      });
    });
  });
  $('#versieDicht').addEventListener('click', function () { $('#versieScrim').classList.remove('open'); });

