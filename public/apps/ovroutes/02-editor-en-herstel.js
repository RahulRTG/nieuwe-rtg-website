  /* ---- de editor openen, bewaren, verwijderen ---- */
  function eur(c) { return (c / 100).toFixed(2); }
  function openEditor(l) {
    if (!beheer) return;
    huidig = l ? { id: l.id, haltes: l.haltes.map(function (h) { return { naam: h.naam, lat: h.lat, lng: h.lng }; }) } : { haltes: [] };
    $('#editorKop').textContent = l ? l.naam + ' bewerken' : 'Nieuwe lijn';
    $('#fNaam').value = l ? l.naam : '';
    $('#fSoort').value = l ? l.soort : 'bus';
    $('#fFreq').value = l ? l.frequentieMin : 15;
    $('#fBasis').value = l ? eur(l.tarief.basis) : '1.80';
    $('#fKm').value = l ? eur(l.tarief.perKm) : '0.20';
    $('#wegBtn').hidden = !l;
    $('#editor').hidden = false;
    R.schermtype('taak');
    teken(); halteLijst();
    $('#editor').scrollIntoView({ block: 'start' });
  }
  function sluitEditor() { $('#editor').hidden = true; huidig = null; R.schermtype('collectie'); }
  function toonLijnen() {
    var wrap = $('#lijnLijst'); R.leeg(wrap);
    beheer.lijnen.forEach(function (l) {
      var li = maak('li');
      var b = maak('button', 'ds-keuze'); b.type = 'button';
      b.appendChild(maak('span', 'ds-lijst__titel', (ICOON[l.soort] || '') + ' ' + l.naam));
      b.appendChild(maak('span', 'ds-meta', l.haltes.length + ' haltes · om de ' + l.frequentieMin + ' min · ' +
        R.eur(l.tarief.basis) + ' + ' + R.eur(l.tarief.perKm) + '/km'));
      b.addEventListener('click', function () { openEditor(l); });
      li.appendChild(b); wrap.appendChild(li);
    });
    if (!beheer.lijnen.length) wrap.appendChild(maak('li', 'ds-meta', 'Nog geen lijnen; begin met een nieuwe lijn.'));
    $('#kopBadge').textContent = beheer.lijnen.length + (beheer.lijnen.length === 1 ? ' lijn' : ' lijnen');
  }
  function voegToe(x, y) {
    if (!huidig || huidig.haltes.length >= 20) return;
    var p = naarLatLng(grenzen(), x, y);
    huidig.haltes.push({ naam: '', lat: p.lat, lng: p.lng });
    teken(); halteLijst();
  }
  $('#tekenvlak').addEventListener('click', function (e) {
    var r = $('#tekenvlak').getBoundingClientRect();
    voegToe((e.clientX - r.left) / r.width * B.w, (e.clientY - r.top) / r.height * B.h);
  });
  $('#midBtn').addEventListener('click', function () { voegToe(B.w / 2, B.h / 2); });
  $('#leegBtn').addEventListener('click', function () { if (huidig) { huidig.haltes = []; teken(); halteLijst(); } });
  $('#nieuwBtn').addEventListener('click', function () { openEditor(null); });
  $('#bewaarBtn').addEventListener('click', function () {
    if (!huidig) return;
    api('lijn/zet', { id: huidig.id, naam: $('#fNaam').value, soort: $('#fSoort').value,
      frequentieMin: Number($('#fFreq').value),
      tarief: { basis: Math.round(Number($('#fBasis').value) * 100), perKm: Math.round(Number($('#fKm').value) * 100) },
      haltes: huidig.haltes }).then(function (r) {
      if (r.body.error) return zeg(r.body.error);
      zeg('Lijn bewaard; leden zien hem meteen in de OV-app.');
      sluitEditor(); laad();
    });
  });
  $('#wegBtn').addEventListener('click', function () {
    if (!huidig || !huidig.id) return;
    api('lijn/zet', { id: huidig.id, weg: true }).then(function (r) {
      if (r.body.error) return zeg(r.body.error);
      zeg('Lijn verwijderd.');
      sluitEditor(); laad();
    });
  });

  /* Meenemen: het lijnenregister van deze zaak, met de velden die er ook op
     het scherm staan (haltes, frequentie, tarief). */
  if (w.RTGUitvoer) w.RTGUitvoer.bron(function () {
    if (!beheer || !beheer.lijnen) return null;
    return { naam: 'ov-lijnen',
      kolommen: ['lijn', 'soort', 'haltes', 'frequentie_min', 'basistarief_eur', 'per_km_eur'],
      rijen: beheer.lijnen.map(function (l) { return [l.naam || '', l.soort || '', l.haltes.length, l.frequentieMin, eur(l.tarief.basis), eur(l.tarief.perKm)]; }) };
  });

  var herstel = maak('button', 'ds-knop', 'Opnieuw proberen');
  herstel.id = 'ovHerstel'; herstel.type = 'button'; herstel.hidden = true;
  herstel.addEventListener('click', laad); $('#vPoort').appendChild(herstel);
  function onbeschikbaar() {
    beheer = null; $('#nieuwBtn').disabled = true; $('#editor').hidden = true;
    $('#vBeheer').hidden = true; $('#vPoort').hidden = false;
    var reden = $('#poortReden');
    if (!reden) { reden=maak('p', 'ds-status__tekst'); reden.id='poortReden'; $('#poortDeur').appendChild(reden); }
    reden.textContent = 'De routegegevens zijn niet beschikbaar. Probeer opnieuw; de actuele toestand is niet bevestigd.';
    herstel.hidden = false; R.schermtype('status');
  }
  function geldigBeheer(b) {
    return b && Array.isArray(b.soorten) && b.soorten.every(function(s){ return typeof s === 'string'; }) &&
      Array.isArray(b.ijkpunten) && b.ijkpunten.every(function(p){ return p && Number.isFinite(p.lat) && Number.isFinite(p.lng); }) &&
      Array.isArray(b.lijnen) && b.lijnen.every(function(l){ return l && typeof l.naam === 'string' &&
        Array.isArray(l.haltes) && l.haltes.every(function(h){return h && Number.isFinite(h.lat) && Number.isFinite(h.lng);}) &&
        l.tarief && Number.isFinite(l.tarief.basis) && Number.isFinite(l.tarief.perKm) && Number.isFinite(l.frequentieMin); });
  }
  function laad() {
    $('#nieuwBtn').disabled = true;
    if (!token) { $('#vPoort').hidden = false; R.schermtype('status'); return; }
    api('lijnen').then(function (r) {
      if (r.status !== 200) {
        if (r.status !== 401 && r.status !== 403) { onbeschikbaar(); return; }
        beheer=null; $('#editor').hidden=true; herstel.hidden=true;
        R.deur($('#poortDeur'), '/apps/personeel.html');
        $('#vPoort').hidden = false; $('#vBeheer').hidden = true; R.schermtype('status'); return;
      }
      if (!geldigBeheer(r.body)) { onbeschikbaar(); return; }
      beheer = r.body;
      herstel.hidden = true; $('#nieuwBtn').disabled = false;
      var sel = $('#fSoort');
      if (!sel.options.length) beheer.soorten.forEach(function (s) { var o = maak('option', '', (ICOON[s] || '') + ' ' + s); o.value = s; sel.appendChild(o); });
      $('#vPoort').hidden = true; $('#vBeheer').hidden = false;
      toonLijnen();
      if (huidig) teken();
    }).catch(onbeschikbaar);
  }
  laad();
}(window, document));
