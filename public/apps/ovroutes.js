/* De routetekenaar op het RTG Design System (TRAVELOS-MIGRATIE.md par. 1b).
   Dezelfde kern als ervoor: /api/staff/ov/lijnen en /lijn/zet met het
   PDA-token; alleen de manager van een OV-zaak mag bewaren (de server). Het
   tekenvlak kleurt met de klassen van het Canvas-schermtype: bekende plekken
   en andere lijnen in de zachte inkt, de lijn in de maak in het accent. */
(function (w, d) {
  'use strict';
  var R = w.RTGWerk, $ = R.$, esc = R.esc, maak = R.maak, zeg = R.zeg;
  var token = (function () { try { return localStorage.getItem('rtg_pda_token'); } catch (e) { return null; } })();
  var api = function (pad, body) {
    return fetch('/api/staff/ov/' + pad, { method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify(body || {}) }).then(function (r) { return r.json().catch(function () { return {}; }).then(function (b) { return { status: r.status, body: b }; }); });
  };
  var ICOON = { bus: '', trein: '', metro: '', veerboot: '', tram: '' };
  var beheer = null;       // {soorten, lijnen, ijkpunten}
  var huidig = null;       // de lijn in de editor: {id?, haltes:[{naam,lat,lng}]}

  /* ---- de projectie: alle bekende punten in beeld, met wat lucht ---- */
  var B = { w: 480, h: 340, r: 26 };
  function grenzen() {
    var pts = [];
    beheer.ijkpunten.forEach(function (p) { pts.push(p); });
    beheer.lijnen.forEach(function (l) { l.haltes.forEach(function (h) { pts.push(h); }); });
    if (huidig) huidig.haltes.forEach(function (h) { pts.push(h); });
    if (!pts.length) pts.push({ lat: 38.908, lng: 1.432 });
    var laMin = Infinity, laMax = -Infinity, loMin = Infinity, loMax = -Infinity;
    pts.forEach(function (p) { laMin = Math.min(laMin, p.lat); laMax = Math.max(laMax, p.lat); loMin = Math.min(loMin, p.lng); loMax = Math.max(loMax, p.lng); });
    var laPad = Math.max((laMax - laMin) * 0.18, 0.004), loPad = Math.max((loMax - loMin) * 0.18, 0.006);
    return { laMin: laMin - laPad, laMax: laMax + laPad, loMin: loMin - loPad, loMax: loMax + loPad };
  }
  function naarXY(g, p) {
    return { x: B.r + (p.lng - g.loMin) / (g.loMax - g.loMin) * (B.w - 2 * B.r),
      y: B.h - B.r - (p.lat - g.laMin) / (g.laMax - g.laMin) * (B.h - 2 * B.r) };
  }
  function naarLatLng(g, x, y) {
    return { lng: g.loMin + (x - B.r) / (B.w - 2 * B.r) * (g.loMax - g.loMin),
      lat: g.laMin + (B.h - B.r - y) / (B.h - 2 * B.r) * (g.laMax - g.laMin) };
  }
  function punten(g, haltes) { return haltes.map(function (h) { var c = naarXY(g, h); return c.x.toFixed(1) + ',' + c.y.toFixed(1); }).join(' '); }

  /* ---- tekenen: ijkpunten zacht, andere lijnen gedempt, deze lijn in het accent ---- */
  function teken() {
    var g = grenzen(), s = '<g class="ds-canvas__vlak" fill="currentColor" font-family="Inter,sans-serif" font-size="8">';
    beheer.ijkpunten.forEach(function (p) {
      var c = naarXY(g, p);
      s += '<circle cx="' + c.x.toFixed(1) + '" cy="' + c.y.toFixed(1) + '" r="3" fill-opacity=".5"/>' +
        '<text x="' + (c.x + 6).toFixed(1) + '" y="' + (c.y + 3).toFixed(1) + '" fill-opacity=".8">' + esc(p.naam) + '</text>';
    });
    beheer.lijnen.forEach(function (l) {
      if (huidig && huidig.id === l.id) return;
      s += '<polyline points="' + punten(g, l.haltes) + '" fill="none" stroke="currentColor" stroke-opacity=".4" stroke-width="2"/>';
    });
    s += '</g>';
    if (huidig && huidig.haltes.length) {
      s += '<g class="ds-canvas__speld" fill="currentColor" font-family="Inter,sans-serif" font-size="9" font-weight="700">';
      if (huidig.haltes.length > 1) s += '<polyline points="' + punten(g, huidig.haltes) + '" fill="none" stroke="currentColor" stroke-width="2.5"/>';
      huidig.haltes.forEach(function (h, i) {
        var c = naarXY(g, h);
        s += '<circle cx="' + c.x.toFixed(1) + '" cy="' + c.y.toFixed(1) + '" r="6"/>' +
          '<text x="' + (c.x + 9).toFixed(1) + '" y="' + (c.y - 7).toFixed(1) + '">' + (i + 1) + '</text>';
      });
      s += '</g>';
    }
    $('#tekenvlak').innerHTML = s;
  }
  function halteLijst() {
    var wrap = $('#halteLijst'); R.leeg(wrap);
    huidig.haltes.forEach(function (h, i) {
      var rij = maak('li', 'ds-lijst__rij');
      rij.appendChild(maak('span', 'ds-lijst__titel', (i + 1) + '.'));
      var inp = maak('input', 'ds-invoer'); inp.value = h.naam || ''; inp.maxLength = 40;
      inp.placeholder = 'Halte ' + (i + 1); inp.setAttribute('aria-label', 'Naam van halte ' + (i + 1));
      inp.addEventListener('input', function () { h.naam = inp.value; });
      rij.appendChild(inp);
      var weg = maak('button', 'ds-knop ds-knop--stil ds-knop--klein', 'weg'); weg.type = 'button';
      weg.setAttribute('aria-label', 'Verwijder halte ' + (i + 1));
      weg.addEventListener('click', function () { huidig.haltes.splice(i, 1); teken(); halteLijst(); });
      rij.appendChild(weg);
      wrap.appendChild(rij);
    });
  }

  /* ---- de editor openen, bewaren, verwijderen ---- */
  function eur(c) { return (c / 100).toFixed(2); }
  function openEditor(l) {
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

  function laad() {
    if (!token) { $('#vPoort').hidden = false; R.schermtype('status'); return; }
    api('lijnen').then(function (r) {
      if (r.status !== 200) {
        R.deur($('#poortDeur'), '/apps/personeel.html');
        $('#vPoort').hidden = false; $('#vBeheer').hidden = true; R.schermtype('status'); return;
      }
      beheer = r.body;
      var sel = $('#fSoort');
      if (!sel.options.length) beheer.soorten.forEach(function (s) { var o = maak('option', '', (ICOON[s] || '') + ' ' + s); o.value = s; sel.appendChild(o); });
      $('#vPoort').hidden = true; $('#vBeheer').hidden = false;
      toonLijnen();
      if (huidig) teken();
    });
  }
  laad();
}(window, document));
