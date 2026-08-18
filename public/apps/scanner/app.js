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

  /* DE MAP SCANS WORDT BIJ HET OPENEN GEZOCHT, EN DAT DUURT TWEE VERZOEKEN.
     Wie sneller klikt dan die twee, bewaarde tot nu toe met `map: null`: het
     bestand landde dan naast de map terwijl de melding wel "bewaard in je
     kluis (map Scans)" zei. Niemand die het merkte -- de melding kwam, de
     upload lukte, alleen de map klopte niet. Een belofte in tekst is een
     belofte in code, dus wachten de bewaarknoppen nu op DEZE belofte in plaats
     van op een variabele die er misschien al staat.

     Bij een mislukking vervalt de belofte weer. Anders zou een hapering bij
     het openen het bewaren voorgoed op null vastzetten, en dat is precies de
     stille fout die we hier weghalen. */
  var mapId = null, mapBelofte = null;
  function zoekMap() {
    if (!mapBelofte) mapBelofte = api('/api/bestanden/mijn').then(function (r) {
      if (r.body.error) throw new Error(r.body.error);
      var m = (r.body.mappen || []).find(function (x) { return x.naam === 'Scans'; });
      if (m) { mapId = m.id; return mapId; }
      return api('/api/bestanden/map', { naam: 'Scans' }).then(function (n) {
        if (n.body.error) throw new Error(n.body.error);
        mapId = n.body.id; return mapId;
      });
    }).catch(function (e) { mapBelofte = null; throw e; });
    return mapBelofte;
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
  /* De PDF wordt op het toestel gebouwd VOOR we op de map wachten: mislukt dat,
     dan hoort de mens dat meteen en niet pas na een rondje naar de server. */
  $('#bewaarPdf').addEventListener('click', function () {
    if (!paginas.length) return;
    var aantal = paginas.length, b64;
    try { b64 = RTGPdf.maak(paginas); } catch (e) { return meld(e.message); }
    zoekMap().then(function (map) {
      return api('/api/bestanden/upload', { naam: 'scan-' + stempel() + '.pdf', map: map,
        dataUrl: 'data:application/pdf;base64,' + b64 }).then(function (r) {
        if (r.body.error) return meld(r.body.error);
        meld('PDF met ' + aantal + ' pagina\'s bewaard in je kluis (map Scans).');
        paginas = []; teken();
      });
    }).catch(function (e) { meld(e.message); });
  });
  $('#bewaarFotos').addEventListener('click', function () {
    if (!paginas.length) return;
    /* Tellen tegen een MOMENTOPNAME. `paginas` kan tijdens het uploaden nog
       veranderen, en dan valt de laatste melding nooit of te vroeg. */
    var basis = 'scan-' + stempel(), lijst = paginas.slice();
    zoekMap().then(function (map) {
      var klaar = 0, fouten = 0;
      lijst.forEach(function (p, i) {
        api('/api/bestanden/upload', { naam: basis + '-' + (i + 1) + '.jpg', map: map,
          dataUrl: 'data:image/jpeg;base64,' + p.b64 }).then(function (r) {
          if (r.body.error) fouten++;
          if (++klaar === lijst.length) {
            meld(fouten ? 'Bewaard, maar ' + fouten + ' pagina(\'s) lukten niet.' : klaar + ' foto\'s bewaard in je kluis (map Scans).');
            if (!fouten) { paginas = []; teken(); }
          }
        });
      });
    }).catch(function (e) { meld(e.message); });
  });

  if (!token) { meld('Log eerst in op de leden-app.'); return; }
  /* Het scherm komt op zonder op de kluis te wachten; de map wordt intussen
     gezocht. Wie klikt voordat dat rond is, wacht in zoekMap() en niet op een
     lege variabele. */
  teken();
  zoekMap().catch(function (e) { meld(e.message); });
})();
