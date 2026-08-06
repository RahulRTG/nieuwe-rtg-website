/* RTG Scanner, het scherm: documenten vastleggen met de camera (of foto's
   kiezen), de documentmodus maakt ze vlak en leesbaar, en bewaren gaat als
   losse foto's of als een PDF -- allemaal gewone bestanden in de RTG
   Bestanden-kluis (map Scans). Alle beeldbewerking en de PDF-bouw gebeuren
   op het toestel; er gaat niets naar een andere server dan je eigen kluis. */
(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };
  var token = null;
  try { token = localStorage.getItem('rtg_member_token'); } catch (e) {}
  var api = function (pad, body) {
    return fetch(pad, { method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify(body || {})
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (b) { return { status: r.status, body: b }; });
    });
  };
  var meldT; var meld = function (t) {
    var m = $('#melding'); m.textContent = t; m.classList.add('zie');
    clearTimeout(meldT); meldT = setTimeout(function () { m.classList.remove('zie'); }, 3200);
  };

  var mapId = null;
  function zoekMap() {
    return api('/api/bestanden/mijn').then(function (r) {
      if (r.body.error) throw new Error(r.body.error);
      var m = (r.body.mappen || []).find(function (x) { return x.naam === 'Scans'; });
      if (m) { mapId = m.id; return; }
      return api('/api/bestanden/map', { naam: 'Scans' }).then(function (n) { mapId = n.body.id; });
    });
  }

  /* ---- pagina's: elk een JPEG op het toestel tot je bewaart ---- */
  var paginas = [];   // { b64, w, h }
  function teken() {
    $('#strook').innerHTML = paginas.map(function (p, i) {
      return '<span class="pag"><img src="data:image/jpeg;base64,' + p.b64 + '" alt="pagina ' + (i + 1) + '">' +
        '<button class="weg" data-weg="' + i + '" type="button" aria-label="Pagina ' + (i + 1) + ' weghalen">&#10005;</button></span>';
    }).join('');
    $('#bewaarRij').style.display = paginas.length ? '' : 'none';
    $('#leegTip').style.display = paginas.length ? 'none' : '';
    Array.prototype.forEach.call(document.querySelectorAll('[data-weg]'), function (el) {
      el.addEventListener('click', function () { paginas.splice(Number(el.dataset.weg), 1); teken(); });
    });
  }

  // een beeldbron (video of Image) naar een nette document-JPEG
  function naarPagina(bron, w, h) {
    var MAX = 1600, schaal = Math.min(1, MAX / Math.max(w, h));
    var c = document.createElement('canvas');
    c.width = Math.round(w * schaal); c.height = Math.round(h * schaal);
    var ctx = c.getContext('2d');
    if ($('#docmodus').checked) ctx.filter = 'grayscale(1) contrast(1.55) brightness(1.08)';
    ctx.drawImage(bron, 0, 0, c.width, c.height);
    paginas.push({ b64: c.toDataURL('image/jpeg', 0.85).split(',')[1], w: c.width, h: c.height });
    teken();
  }

  /* ---- de camera ---- */
  var stream = null;
  $('#cameraKnop').addEventListener('click', function () {
    if (stream) {
      naarPagina($('#beeld'), $('#beeld').videoWidth, $('#beeld').videoHeight);
      return;
    }
    // shared/media.js noemt de oorzaak; foto's kiezen blijft altijd een uitweg
    window.RTGMedia.camera({ achter: true, video: { width: { ideal: 1920 } }, stil: true })
      .then(function (s) {
        stream = s;
        $('#beeld').srcObject = s; $('#beeld').play();
        $('#beeldWrap').style.display = '';
        $('#cameraKnop').textContent = 'Leg deze pagina vast';
        $('#cameraStop').style.display = '';
      })
      .catch(function (e) {
        meld(((e.rtg && (e.rtg.kort + '. ' + e.rtg.uitleg)) || 'Geen toegang tot de camera') +
          ' Kies gerust foto\'s hieronder.');
      });
  });
  $('#cameraStop').addEventListener('click', function () {
    if (stream) { stream.getTracks().forEach(function (t) { t.stop(); }); stream = null; }
    $('#beeldWrap').style.display = 'none';
    $('#cameraKnop').textContent = 'Open de camera';
    $('#cameraStop').style.display = 'none';
  });

  /* ---- foto's kiezen (werkt ook zonder camera) ---- */
  $('#kies').addEventListener('change', function () {
    Array.prototype.forEach.call($('#kies').files, function (f) {
      var img = new Image();
      img.onload = function () { naarPagina(img, img.naturalWidth, img.naturalHeight); URL.revokeObjectURL(img.src); };
      img.src = URL.createObjectURL(f);
    });
    $('#kies').value = '';
  });

  /* ---- bewaren in de kluis ---- */
  function stempel() {
    var d = new Date();
    return d.toISOString().slice(0, 10) + '-' + String(d.getHours()).padStart(2, '0') + String(d.getMinutes()).padStart(2, '0');
  }
  $('#bewaarPdf').addEventListener('click', function () {
    if (!paginas.length) return;
    try {
      var b64 = RTGPdf.maak(paginas);
      api('/api/bestanden/upload', { naam: 'scan-' + stempel() + '.pdf', map: mapId,
        dataUrl: 'data:application/pdf;base64,' + b64 }).then(function (r) {
        if (r.body.error) return meld(r.body.error);
        meld('PDF met ' + paginas.length + ' pagina\'s bewaard in je kluis (map Scans).');
        paginas = []; teken();
      });
    } catch (e) { meld(e.message); }
  });
  $('#bewaarFotos').addEventListener('click', function () {
    if (!paginas.length) return;
    var basis = 'scan-' + stempel(), klaar = 0, fouten = 0;
    paginas.forEach(function (p, i) {
      api('/api/bestanden/upload', { naam: basis + '-' + (i + 1) + '.jpg', map: mapId,
        dataUrl: 'data:image/jpeg;base64,' + p.b64 }).then(function (r) {
        if (r.body.error) fouten++;
        if (++klaar === paginas.length) {
          meld(fouten ? 'Bewaard, maar ' + fouten + ' pagina(\'s) lukten niet.' : klaar + ' foto\'s bewaard in je kluis (map Scans).');
          if (!fouten) { paginas = []; teken(); }
        }
      });
    });
  });

  if (!token) { meld('Log eerst in op de leden-app.'); return; }
  zoekMap().then(teken).catch(function (e) { meld(e.message); });
})();
