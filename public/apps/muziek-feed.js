/* De menselijke laag van RTG Sound: publiceren, de muziek van andere leden
   ontdekken en waardering geven. De bestandsspeler blijft één aparte motor. */
(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };
  var B = window.RTGEigenMuziek, lijstEl = $('#muziekLijst'), kies = $('#muziekKies');
  var invoer = $('#muziekBestand'), vel = $('#muziekDeelvel'), statusEl = $('#muziekStatus');
  if (!B || !lijstEl || !kies || !invoer) return;
  var token = null, nummers = [], gekozen = null;
  try { token = localStorage.getItem('rtg_member_token'); } catch (e) {}

  function status(tekst, fout) { statusEl.textContent = tekst || ''; statusEl.style.color = fout ? '#e09a9a' : ''; }
  async function api(pad, body) {
    var r = await fetch('/api/muziek/' + pad, { method: 'POST', headers: {
      'Content-Type': 'application/json', Authorization: 'Bearer ' + token
    }, body: JSON.stringify(body || {}) });
    var j = await r.json().catch(function () { return {}; });
    if (!r.ok) throw new Error(j.error || 'Dit lukte niet.'); return j;
  }
  function grootte(bytes) {
    var mb = Number(bytes || 0) / 1024 / 1024;
    return mb >= 1 ? mb.toFixed(mb >= 10 ? 0 : 1) + ' MB' : Math.max(1, Math.round(Number(bytes || 0) / 1024)) + ' kB';
  }
  function sluitDelen() {
    gekozen = null; invoer.value = ''; vel.hidden = true;
    $('#muziekTitel').value = ''; $('#muziekBeschrijving').value = ''; $('#muziekEigenwerk').checked = false;
  }
  function knop(klasse, tekst, label) {
    var b = document.createElement('button'); b.type = 'button'; b.className = klasse; b.textContent = tekst;
    if (label) b.setAttribute('aria-label', label); return b;
  }
  function teken() {
    lijstEl.textContent = ''; B.zetNummers(nummers);
    $('#muziekAantal').textContent = nummers.length ? nummers.length + (nummers.length === 1 ? ' gedeeld nummer' : ' gedeelde nummers') : '';
    if (!nummers.length) {
      var leeg = document.createElement('p'); leeg.className = 'muziek-leeg';
      leeg.textContent = 'Hier verschijnt de muziek die mensen zelf delen. U kunt de eerste zijn.'; lijstEl.appendChild(leeg); return;
    }
    nummers.forEach(function (nummer) {
      var rij = document.createElement('article'); rij.className = 'eigen-nummer'; rij.dataset.id = nummer.id; rij.dataset.actief = String(B.actiefId() === nummer.id);
      var speel = knop('eigen-nummer__speel', '', 'Speel ' + nummer.naam + ' van ' + nummer.maker);
      var icoon = document.createElement('span'); icoon.className = 'eigen-nummer__icoon'; icoon.setAttribute('aria-hidden', 'true'); icoon.textContent = '♪';
      var tekst = document.createElement('span'); tekst.className = 'eigen-nummer__tekst';
      var naam = document.createElement('span'); naam.className = 'eigen-nummer__naam'; naam.textContent = nummer.naam;
      var meta = document.createElement('span'); meta.className = 'eigen-nummer__meta';
      var maker = document.createElement('span'); maker.className = 'eigen-nummer__maker'; maker.textContent = nummer.maker;
      meta.appendChild(maker); meta.appendChild(document.createTextNode(' · ' + grootte(nummer.bytes)));
      tekst.appendChild(naam); tekst.appendChild(meta); speel.appendChild(icoon); speel.appendChild(tekst);
      speel.addEventListener('click', function () { B.speelNummer(nummer); });
      var acties = document.createElement('div'); acties.className = 'eigen-nummer__acties';
      var mooi = knop('eigen-nummer__mooi', '♡ ' + (nummer.mooi || 0), 'Vind ' + nummer.naam + ' mooi'); mooi.dataset.aan = String(!!nummer.mooiVanMij);
      if (nummer.mooiVanMij) mooi.textContent = '♥ ' + nummer.mooi;
      mooi.addEventListener('click', async function () {
        try { var r = await api('mooi', { id: nummer.id, aan: !nummer.mooiVanMij }); nummer.mooi = r.mooi; nummer.mooiVanMij = r.mooiVanMij; teken(); }
        catch (e) { status(e.message, true); }
      });
      acties.appendChild(mooi);
      if (nummer.vanMij) {
        var weg = knop('eigen-nummer__weg', '×', 'Verwijder ' + nummer.naam);
        weg.addEventListener('click', async function () {
          if (!confirm('“' + nummer.naam + '” verwijderen uit de muziekfeed?')) return;
          try { await api('bestand-weg', { id: nummer.id }); nummers = nummers.filter(function (n) { return n.id !== nummer.id; }); teken(); status('Het nummer is verwijderd.'); }
          catch (e) { status(e.message, true); }
        }); acties.appendChild(weg);
      }
      rij.appendChild(speel); rij.appendChild(acties);
      if (nummer.beschrijving) { var besch = document.createElement('p'); besch.className = 'eigen-nummer__beschrijving'; besch.textContent = nummer.beschrijving; rij.appendChild(besch); }
      lijstEl.appendChild(rij);
    });
  }

  kies.addEventListener('click', function () { invoer.click(); });
  invoer.addEventListener('change', function () {
    gekozen = invoer.files && invoer.files[0]; if (!gekozen) return;
    vel.hidden = false; $('#muziekBestandsnaam').textContent = gekozen.name;
    $('#muziekTitel').value = gekozen.name.replace(/\.(mp3|m4a|aac|wav|ogg|flac|webm)$/i, '');
    $('#muziekTitel').focus(); status('Geef uw muziek een titel en verhaal voordat u haar deelt.');
  });
  $('#muziekAnnuleer').addEventListener('click', function () { sluitDelen(); status(''); });
  $('#muziekPubliceer').addEventListener('click', async function () {
    if (!gekozen) return status('Kies eerst een muziekbestand.', true);
    if (!$('#muziekEigenwerk').checked) return status('Bevestig dat dit uw eigen muziek is en dat u haar mag delen.', true);
    var titel = $('#muziekTitel').value.trim(); if (!titel) return status('Geef het nummer een titel.', true);
    var publiceer = $('#muziekPubliceer'); publiceer.disabled = true; status('Uw muziek wordt veilig gepubliceerd…');
    try {
      var r = await fetch('/api/muziek/bestand', { method: 'POST', headers: {
        Authorization: 'Bearer ' + token, 'Content-Type': gekozen.type || 'application/octet-stream',
        'Idempotency-Key': RTGIdem('muziek-publiceer'),
        'X-RTG-Bestandsnaam': encodeURIComponent(gekozen.name), 'X-RTG-Titel': encodeURIComponent(titel),
        'X-RTG-Beschrijving': encodeURIComponent($('#muziekBeschrijving').value.trim()), 'X-RTG-Eigenwerk': 'ja'
      }, body: gekozen });
      var j = await r.json().catch(function () { return {}; });
      if (!r.ok) throw new Error(j.error || 'Uw muziek kon niet worden gepubliceerd.');
      nummers.unshift(j.nummer); sluitDelen(); teken(); status('“' + j.nummer.naam + '” staat nu klaar voor andere luisteraars.');
    } catch (e) { status(e.message, true); } finally { publiceer.disabled = false; }
  });

  if (!token) {
    kies.disabled = true; lijstEl.innerHTML = '<p class="muziek-leeg">Log in om muziek van mensen te beluisteren en uw eigen werk te delen.</p>';
    status('De live stations kunt u wel meteen beluisteren.'); return;
  }
  api('feed').then(function (j) { nummers = j.nummers || []; teken(); status(''); })
    .catch(function (e) { status(e.message, true); lijstEl.innerHTML = '<p class="muziek-leeg">De muziekfeed kon niet worden geladen.</p>'; });
})();
