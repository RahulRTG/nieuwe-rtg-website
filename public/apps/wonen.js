(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };
  var esc = function (t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  }); };
  var token = null; try { token = localStorage.getItem('rtg_member_token'); } catch (e) {}
  var view = document.body.dataset.wonenView;
  var model = { huis: null, onderhoud: [], bestanden: null };
  var api = function (pad, body) { return fetch(pad, { method: 'POST', headers: {
    'Content-Type': 'application/json', Authorization: 'Bearer ' + token
  }, body: JSON.stringify(body || {}) }).then(function (r) { return r.json().catch(function () { return {}; })
    .then(function (d) { if (!r.ok) throw new Error(d.error || 'Er ging iets mis.'); return d; }); }); };
  var datum = function (v) { try { return new Date(v).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' }); } catch (e) { return ''; } };
  var login = function (doel) { doel.innerHTML = '<div class="home-empty"><b>Log eerst in op LivingOS.</b><br>Uw woning opent alleen met uw RTG-account. <a href="/apps/app.html">Naar de app &#8594;</a></div>'; };
  var mapVan = function (b) { return (b && b.mappen || []).find(function (m) { return String(m.naam).toLowerCase() === 'woningdossier'; }); };
  var documentenVan = function (b) { var m = mapVan(b); return m ? (b.items || []).filter(function (x) { return !x.weg && x.map === m.id; }) : []; };
  var alleApparaten = function () { return (model.huis && model.huis.kamers || []).reduce(function (a, k) { return a.concat(k.apparaten || []); }, []); };

  if (window.RTGUitvoer) RTGUitvoer.bron(function () {
    if (view === 'onderhoud') return model.onderhoud.length ? { naam: 'woningonderhoud',
      kolommen: ['melding', 'plek', 'urgentie', 'status', 'gemeld'], rijen: model.onderhoud.map(function (m) { return [m.titel, m.plek, m.urgentie, m.status, m.gemaaktAt]; }) } : null;
    if (view === 'dossier') { var docs = documentenVan(model.bestanden); return docs.length ? { naam: 'woningdossier',
      kolommen: ['document', 'type', 'gewijzigd'], rijen: docs.map(function (d) { return [d.naam, d.mime, d.gewijzigd]; }) } : null; }
    var apparaten = alleApparaten(); return apparaten.length ? { naam: 'mijn-thuis', kolommen: ['kamer', 'apparaat', 'soort', 'staat'],
      rijen: (model.huis.kamers || []).reduce(function (r, k) { return r.concat((k.apparaten || []).map(function (a) { return [k.kamer, a.naam, a.soort, JSON.stringify(a.stand)]; })); }, []) } : null;
  });

  function laadThuis() {
    var stand = $('#thuisStand'), vandaag = $('#thuisVandaag');
    if (!token) { login(stand); login(vandaag); return; }
    Promise.all([api('/api/home'), api('/api/home/onderhoud'), api('/api/bestanden/mijn')]).then(function (r) {
      model.huis = r[0]; model.onderhoud = r[1].meldingen || []; model.bestanden = r[2];
      var apparaten = alleApparaten();
      var thermostaat = apparaten.find(function (a) { return a.id === 'thermostaat'; });
      var sloten = apparaten.filter(function (a) { return a.soort === 'slot'; });
      var open = model.onderhoud.filter(function (m) { return m.status !== 'opgelost' && m.status !== 'geannuleerd'; });
      var docs = documentenVan(model.bestanden);
      var kaarten = [
        [String(apparaten.length), 'apparaten verbonden'],
        [thermostaat && thermostaat.stand ? thermostaat.stand.temp + '°' : 'Niet gemeten', 'temperatuur thuis'],
        [sloten.length ? (sloten.every(function (s) { return s.stand.opSlot; }) ? 'Op slot' : 'Open') : 'Niet gekoppeld', 'deuren in Home Kit'],
        [open.length ? String(open.length) : 'Geen', open.length === 1 ? 'open melding' : 'open meldingen']
      ];
      stand.innerHTML = kaarten.map(function (k) { return '<div class="home-status"><b>' + esc(k[0]) + '</b><span>' + esc(k[1]) + '</span></div>'; }).join('');
      var regels = open.slice(0, 4).map(function (m) { return '<a class="home-row" href="/apps/onderhoud.html"><span>' + esc(datum(m.gemaaktAt)) + '</span><span><b>' + esc(m.titel) + '</b><small>' + esc(m.plek) + ' · ' + esc(m.status) + '</small></span><em>&#8594;</em></a>'; });
      regels.push('<a class="home-row" href="/apps/woningdossier.html"><span>Kluis</span><span><b>' + docs.length + (docs.length === 1 ? ' woningdocument' : ' woningdocumenten') + '</b><small>Versleuteld bewaard</small></span><em>&#8594;</em></a>');
      regels.push('<a class="home-row" href="/apps/home.html"><span>Kit</span><span><b>Uw apparaten en scènes</b><small>Alleen wat verbonden is</small></span><em>&#8594;</em></a>');
      vandaag.innerHTML = '<div class="home-list">' + regels.join('') + '</div>';
    }).catch(function (e) { stand.innerHTML = '<div class="home-empty">' + esc(e.message) + '</div>'; vandaag.innerHTML = ''; });
  }

  function tekenOnderhoud() {
    var doel = $('#onderhoudLijst');
    var open = model.onderhoud.filter(function (m) { return m.status !== 'opgelost' && m.status !== 'geannuleerd'; });
    doel.innerHTML = open.length ? open.map(function (m) { return '<article class="home-card"><div class="home-card-head"><div><div class="home-ey">' + esc(m.plek) + '</div><h2>' + esc(m.titel) + '</h2></div><span class="home-tag">' + esc(m.status) + '</span></div><p class="home-meta">Gemeld op ' + esc(datum(m.gemaaktAt)) + ' · ' + esc(m.urgentie) + (m.notitie ? '<br>' + esc(m.notitie) : '') + '</p><div class="home-actions"><a class="home-button alt" href="/apps/mall.html">Vind een vakman</a><button class="home-button alt" type="button" data-annuleer="' + esc(m.id) + '">Intrekken</button></div></article>'; }).join('')
      : '<div class="home-empty"><b>Geen open onderhoudsmeldingen.</b><br>We tonen geen voorbeeldstoring als echte afspraak.</div>';
    doel.querySelectorAll('[data-annuleer]').forEach(function (b) { b.addEventListener('click', function () {
      if (!confirm('Deze onderhoudsmelding intrekken?')) return;
      api('/api/home/onderhoud/annuleer', { id: b.dataset.annuleer }).then(laadOnderhoud).catch(function (e) { alert(e.message); });
    }); });
  }
  function laadOnderhoud() {
    if (!token) { login($('#onderhoudLijst')); $('#nieuwMelding').disabled = true; return; }
    api('/api/home/onderhoud').then(function (r) { model.onderhoud = r.meldingen || []; tekenOnderhoud(); })
      .catch(function (e) { $('#onderhoudLijst').innerHTML = '<div class="home-empty">' + esc(e.message) + '</div>'; });
  }
  function bindOnderhoud() {
    var dialoog = $('#meldingDialoog'), form = $('#meldingForm');
    $('#nieuwMelding').addEventListener('click', function () { dialoog.showModal(); });
    $('#meldingSluit').addEventListener('click', function () { dialoog.close(); });
    form.addEventListener('submit', function (e) { e.preventDefault(); $('#meldingFout').textContent = ''; $('#meldingBewaar').disabled = true;
      api('/api/home/onderhoud/meld', { titel: $('#meldingTitel').value, plek: $('#meldingPlek').value,
        urgentie: $('#meldingUrgentie').value, notitie: $('#meldingNotitie').value }).then(function () {
        form.reset(); dialoog.close(); return laadOnderhoud();
      }).catch(function (f) { $('#meldingFout').textContent = f.message; }).finally(function () { $('#meldingBewaar').disabled = false; });
    });
  }

  function tekenDossier() {
    var q = $('#dossierZoek').value.trim().toLowerCase();
    var docs = documentenVan(model.bestanden).filter(function (d) { return !q || d.naam.toLowerCase().indexOf(q) >= 0; });
    $('#dossierLijst').innerHTML = docs.length ? docs.map(function (d) { return '<a class="home-doc" href="/apps/bestanden.html"><b>' + esc(d.naam) + '</b><small>' + esc(d.mime || 'document') + ' · ' + esc(datum(d.gewijzigd)) + '</small></a>'; }).join('')
      : '<div class="home-empty">' + (q ? 'Geen woningdocument met deze naam.' : 'Nog geen documenten. Voeg een contract, garantie of handleiding toe.') + '</div>';
    var apparaten = alleApparaten().slice(0, 8);
    $('#dossierApparaten').innerHTML = apparaten.length ? apparaten.map(function (a) { return '<a class="home-row" href="/apps/home.html"><span>' + esc(a.kamer.slice(0, 3)) + '</span><span><b>' + esc(a.naam) + '</b><small>' + esc(a.soort) + ' · gegevens uit Home Kit</small></span><em>&#8594;</em></a>'; }).join('') : '<div class="home-empty">Nog geen apparaten verbonden.</div>';
  }
  function laadDossier() {
    if (!token) { login($('#dossierLijst')); login($('#dossierApparaten')); $('#dossierToevoegen').disabled = true; return; }
    Promise.all([api('/api/bestanden/mijn'), api('/api/home')]).then(function (r) { model.bestanden = r[0]; model.huis = r[1]; tekenDossier(); })
      .catch(function (e) { $('#dossierFout').textContent = e.message; });
  }
  function leesBestand(file) { return new Promise(function (resolve, reject) { var r = new FileReader(); r.onload = function () { resolve(String(r.result || '')); }; r.onerror = function () { reject(new Error('Dit document kon niet worden gelezen.')); }; r.readAsDataURL(file); }); }
  function bindDossier() {
    $('#dossierZoek').addEventListener('input', tekenDossier);
    $('#dossierToevoegen').addEventListener('click', function () { $('#dossierBestand').click(); });
    $('#dossierBestand').addEventListener('change', function () { var file = this.files && this.files[0]; this.value = ''; if (!file) return;
      $('#dossierFout').textContent = ''; if (file.size > 4 * 1024 * 1024) { $('#dossierFout').innerHTML = 'Gebruik voor documenten boven 4 MB de <a href="/apps/bestanden.html">volledige kluis</a>.'; return; }
      var map = mapVan(model.bestanden); var mapKlaar = map ? Promise.resolve(map.id) : api('/api/bestanden/map', { naam: 'Woningdossier' }).then(function (m) { return m.id; });
      Promise.all([mapKlaar, leesBestand(file)]).then(function (r) { return api('/api/bestanden/upload', { naam: file.name, map: r[0], dataUrl: r[1] }); })
        .then(laadDossier).catch(function (e) { $('#dossierFout').textContent = e.message; });
    });
  }

  if (view === 'thuis') laadThuis();
  if (view === 'onderhoud') { bindOnderhoud(); laadOnderhoud(); }
  if (view === 'dossier') { bindDossier(); laadDossier(); }
})();
