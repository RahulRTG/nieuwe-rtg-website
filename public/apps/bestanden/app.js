/* Documents presentation and transport; lifecycle meaning belongs to the server. */
(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };
  var esc = function (t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  var token = null;
  try { token = localStorage.getItem('rtg_member_token'); } catch (e) {}
  var api = function (pad, body) {
    if ((pad === 'weg' || pad === 'herstel') && stand) {
      var file = (stand.items || []).find(function (it) { return it.id === (body || {}).id; });
      if (file) return window.RTGDocumentCapability(api, pad === 'weg' ? 'documents.trash' : 'documents.restore', file);
    }
    if (pad === 'wijzig' && stand) {
      var editing = (stand.items || []).find(function (it) { return it.id === (body || {}).id; });
      if (editing) body = Object.assign({}, body, { expectedVersion: editing.documentVersion });
    }
    return window.RTGOperation.requestJson(window.fetch.bind(window), '/api/bestanden/' + pad, { method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify(body || {})
    });
  };
  var meldT; var meld = function (t) {
    var m = $('#melding'); m.textContent = t; m.classList.add('zie');
    clearTimeout(meldT); meldT = setTimeout(function () { m.classList.remove('zie'); }, 3200);
  };
  var maat = function (b) {
    if (b == null) return '';
    if (b < 1024) return b + ' B';
    if (b < 1048576) return (b / 1024).toFixed(b < 10240 ? 1 : 0).replace('.', ',') + ' kB';
    return (b / 1048576).toFixed(1).replace('.', ',') + ' MB';
  };
  var extVan = function (n, mime) {
    var m = /\.([A-Za-z0-9]{1,5})$/.exec(String(n || ''));
    if (m) return m[1];
    return (String(mime || '').split('/')[1] || 'blad').slice(0, 4);
  };

  var stand = null, hier = null, bak = false;
  window.RTGBestandenContext(function () { return { stand: stand, hier: hier, bak: bak }; }, function (next) {
    hier = next.hier; bak = next.bak; teken();
  });

  var readSequence = 0;
  function laad() {
    var sequence = ++readSequence;
    return api('mijn').then(function (r) {
      if (sequence !== readSequence) return;
      if (r.status !== 200) { window.RTGDaily.render('bestanden', 'error', { retry: laad }); return meld(r.body.error || window.RTGDailyCopy.value('failed')); }
      stand = r.body;
      window.RTGRouteMemory.ready('bestanden');
      teken();
    });
  }
  function pad() {
    var stap = [], m = (stand.mappen || []).find(function (x) { return x.id === hier; });
    while (m) { stap.unshift(m); m = (stand.mappen || []).find(function (x) { return x.id === m.ouder; }); }
    var h = '<button type="button" data-ga="">Kluis</button>';
    stap.forEach(function (s, i) {
      h += ' <span aria-hidden="true">/</span> ' + (i === stap.length - 1
        ? '<span class="hier">' + esc(s.naam) + '</span>'
        : '<button type="button" data-ga="' + s.id + '">' + esc(s.naam) + '</button>');
    });
    $('#pad').innerHTML = h;
    Array.prototype.forEach.call($('#pad').querySelectorAll('[data-ga]'), function (el) {
      el.addEventListener('click', function () { hier = el.dataset.ga || null; teken(); });
    });
  }
  function rijtje(it) {
    var meta = [maat(it.bytes)];
    if (it.gewijzigd) meta.push('<span translate="no">' + esc(window.RTGDailyCopy.date(it.gewijzigd)) + '</span>');
    if (it.ster) meta.push('<span class="goud">ster</span>');
    if (it.versies) meta.push(it.versies + (it.versies === 1 ? ' versie' : ' versies'));
    if ((it.gedeeldMet || []).length) meta.push('gedeeld met ' + it.gedeeldMet.length);
    if (!it.vanMij) meta.push('gedeeld met u');
    if (it.weg) meta.push('<span class="goud">in de prullenbak</span>');
    return '<div class="item' + (it.weg ? ' weg' : '') + '" data-open="' + it.id + '" role="button" tabindex="0">' +
      '<span class="ext" aria-hidden="true">' + esc(extVan(it.naam, it.mime)) + '</span>' +
      '<span class="wat"><b data-user-content>' + esc(it.naam) + '</b><span>' + meta.join(' · ') + '</span></span></div>';
  }
  function teken() {
    if (!stand) return;
    pad();
    var q = $('#zoek').value.trim().toLowerCase();
    var sorteer = $('#sorteer').value;
    var zeef = function (it) {
      if (!!it.weg !== bak) return false;
      if (q) return it.naam.toLowerCase().indexOf(q) >= 0;   // zoeken kijkt overal
      return bak || q ? true : (it.map || null) === (hier || null);
    };
    var orde = function (a, b) {
      if (a.ster !== b.ster) return a.ster ? -1 : 1;
      if (sorteer === 'naam') return a.naam.localeCompare(b.naam);
      if (sorteer === 'groot') return (b.bytes || 0) - (a.bytes || 0);
      return String(b.gewijzigd).localeCompare(String(a.gewijzigd));
    };
    var mappen = bak || q ? [] : (stand.mappen || []).filter(function (m) { return (m.ouder || null) === (hier || null); });
    $('#dailyFolders').hidden = !mappen.length;
    $('#mappen').innerHTML = mappen.map(function (m) {
      return '<span class="mapkaart" data-map="' + m.id + '" role="button" tabindex="0">' +
        '<span class="mp" aria-hidden="true"></span><span data-user-content>' + esc(m.naam) + '</span>' + '</span>';
    }).join('');
    Array.prototype.forEach.call(document.querySelectorAll('[data-map]'), function (el) {
      el.addEventListener('click', function () { hier = el.dataset.map; teken(); });
    });
    var eigen = (stand.items || []).filter(zeef).sort(orde);
    $('#lijst').innerHTML = eigen.map(rijtje).join('') || '<p class="stil">' +
      (bak ? 'De prullenbak is leeg.' : window.RTGDailyCopy.text(q ? 'noResults' : 'noFiles')) + '</p>';
    if (bak && eigen.length) {
      $('#lijst').innerHTML += '<div class="rij h-mt50">' +
        '<button class="knop" id="leegAlles" type="button">Prullenbak leegmaken</button></div>';
      var la = $('#leegAlles');
      if (la) la.addEventListener('click', function () {
        if (!confirm('Alles in de prullenbak voorgoed weggooien?')) return;
        api('leeg').then(function (r) { if (r.status !== 200 || r.body.error) return meld(r.body.error || 'Niet bevestigd.'); meld('De la is leeg.'); laad(); });
      });
    }
    var gedeeld = bak ? [] : (stand.gedeeld || []).filter(function (it) { return !q || it.naam.toLowerCase().indexOf(q) >= 0; });
    $('#gedeeldKop').style.display = gedeeld.length ? '' : 'none';
    $('#gedeeldLijst').innerHTML = gedeeld.map(rijtje).join('');
    var office = bak ? [] : (stand.office || []).filter(function (it) { return !q || (it.titel || '').toLowerCase().indexOf(q) >= 0; });
    var first = !bak && !hier && !q && !(stand.items || []).length && !(stand.mappen || []).length && !(stand.gedeeld || []).length && !(stand.office || []).length;
    window.RTGDaily.render('bestanden', first ? 'empty' : 'ready', { retry: laad });
    $('#officeKop').style.display = office.length ? '' : 'none';
    $('#officeLijst').innerHTML = office.map(function (d) {
      return '<a class="item" href="/apps/office.html" style="text-decoration:none;color:inherit;">' +
        '<span class="ext" aria-hidden="true">' + esc(d.soort) + '</span>' +
        '<span class="wat"><b data-user-content>' + esc(d.titel) + '</b><span>RTG Office · ' + esc(String(d.gewijzigd || '').slice(0, 10)) + '</span></span></a>';
    }).join('');
    $('#quotumTekst').textContent = maat(stand.gebruik) + ' van ' + maat(stand.quotum) + ' gebruikt';
    $('#quotumBalk').style.width = Math.min(100, 100 * stand.gebruik / stand.quotum) + '%';
    Array.prototype.forEach.call(document.querySelectorAll('[data-open]'), function (el) {
      el.addEventListener('click', function () { window.RTGBestandenPaneel.open(el.dataset.open); });
    });
  }

  /* ---- uploaden: kiezen of slepen; groot gaat in stukken ---- */
  function stuur(file, bid) {
    return window.RTGBestandUpload(file, api, { id: bid, map: hier });
  }
  function uploadAlles(files) {
    var lijst = Array.prototype.slice.call(files || []);
    if (!lijst.length) return;
    meld(lijst.length === 1 ? 'Bezig met uploaden.' : 'Bezig met ' + lijst.length + ' bestanden.');
    var ket = Promise.resolve();
    lijst.forEach(function (f) {
      ket = ket.then(function () { return stuur(f).then(function (r) { if (r.body.error) meld(r.body.error); }); });
    });
    ket.then(function () { laad(); }).catch(function (e) { meld(e.message); });
  }
  $('#kies').addEventListener('click', function () { $('#bestandkiezer').click(); });
  $('#bestandkiezer').addEventListener('change', function () { uploadAlles(this.files); this.value = ''; });
  document.addEventListener('dragover', function (e) { e.preventDefault(); document.body.classList.add('sleept'); });
  document.addEventListener('dragleave', function (e) { if (!e.relatedTarget) document.body.classList.remove('sleept'); });
  document.addEventListener('drop', function (e) {
    e.preventDefault(); document.body.classList.remove('sleept');
    if (e.dataTransfer && e.dataTransfer.files) uploadAlles(e.dataTransfer.files);
  });

  $('#nieuwMap').addEventListener('click', function () {
    var naam = prompt('Hoe heet de nieuwe map?');
    if (!naam || !naam.trim()) return;
    api('map', { naam: naam.trim(), ouder: hier }).then(function (r) {
      if (r.body.error) return meld(r.body.error);
      laad();
    });
  });
  $('#toonBak').addEventListener('click', function () {
    bak = !bak;
    this.classList.toggle('aan', bak);
    this.textContent = bak ? 'Terug naar de kluis' : 'Prullenbak';
    teken();
  });
  $('#zoek').addEventListener('input', teken);
  $('#sorteer').addEventListener('change', teken);

  window.RTGBestanden = { api: api, meld: meld, laad: laad, maat: maat, stuur: stuur,
    stand: function () { return stand; }, bak: function () { return bak; } };
  window.addEventListener('rtglang', teken);
  ['focus', 'online'].forEach(function (event) { window.addEventListener(event, function () { if (token) laad(); }); });
  if (!token) window.RTGDaily.render('bestanden', 'guest'); else laad();
})();
