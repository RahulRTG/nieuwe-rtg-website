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
            else if (open.soort === 'formulier') formulier.laad(t.body.inhoud, magBewerken, open.id);
            else if (open.soort === 'schets') schets.laad(t.body.inhoud, magBewerken);
            else if (open.soort === 'bord') bord.laad(t.body.inhoud, magBewerken);
            else { $('#tekst').innerHTML = (t.body.inhoud && t.body.inhoud.tekst) || ''; telBij(); }
            $('#versieScrim').classList.remove('open'); zeg('Versie teruggezet.');
          });
        });
      });
    });
  });
  $('#versieDicht').addEventListener('click', function () { $('#versieScrim').classList.remove('open'); });

