/* RTG Paspoortscanner: onze eigen scanner voor het identiteitsbewijs. Opent de
   camera van het toestel, legt een paspoort-kader over beeld (met een hint voor
   de twee MRZ-regels onderaan), en maakt op de sluiterknop een scherpe foto die
   je eerst controleert (opnieuw of gebruiken). De foto blijft op het toestel tot
   je zelf op "Gebruik deze scan" tikt; dan geven we hem terug aan de aanroeper
   (die hem versleuteld naar de kluis stuurt). Geen extern beeld, geen upload
   zonder jouw tik.

   Gebruik: RTGPaspoortScan.open({ onKlaar: fn(dataURL), onAf: fn() }); */
(function (root) {
  if (root.RTGPaspoortScan) return;

  function tekst(k, nl) { return (root.RTGi18n ? root.RTGi18n.t(k, nl) : nl); }

  function open(opts) {
    opts = opts || {};
    var ov = document.createElement('div'); ov.className = 'pscan ds-paspoortscan';
    ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true');
    ov.innerHTML =
      '<div class="pscan-podium" id="pscanPodium">' +
        '<video id="pscanVid" playsinline autoplay muted></video>' +
        '<div class="pscan-kader"><span class="pscan-hoek lb"></span><span class="pscan-hoek rb"></span>' +
          '<span class="pscan-hoek lo"></span><span class="pscan-hoek ro"></span><span class="pscan-mrz"></span></div>' +
      '</div>' +
      '<div class="pscan-zin" id="pscanZin">' + tekst('scan.titel', 'Leg je paspoort in het kader') + '</div>' +
      '<div class="pscan-sub" id="pscanSub">' + tekst('scan.hint', 'Houd de onderste twee regels (de << <) goed leesbaar in beeld.') + '</div>' +
      '<div class="pscan-knoppen" id="pscanKnoppen">' +
        '<button type="button" id="pscanAf">' + tekst('scan.af', 'Sluiten') + '</button>' +
        '<button type="button" class="pscan-sluiter" id="pscanMaak" aria-label="' + tekst('scan.maak', 'Maak de scan') + '"></button>' +
        '<span class="pscan-evenwicht" aria-hidden="true"></span>' +
      '</div>';
    document.body.appendChild(ov);

    var vid = ov.querySelector('#pscanVid');
    var stream = null, dataURL = null, mrz = null;

    function sluit() {
      if (stream) { stream.getTracks().forEach(function (t) { t.stop(); }); stream = null; }
      if (ov.parentNode) ov.parentNode.removeChild(ov);
    }
    function afbreken() { sluit(); if (opts.onAf) opts.onAf(); }

    ov.querySelector('#pscanAf').addEventListener('click', afbreken);
    document.addEventListener('keydown', function esc(e) { if (e.key === 'Escape') { document.removeEventListener('keydown', esc); afbreken(); } });

    /* Via shared/media.js. De oude versie had twee meldingen -- "geen
       camera-toegang" en "geen toegang" -- en beide stuurden de gebruiker naar
       een instelling. De echte oorzaak is meestal het adres (http) of het
       venster waarin dit scherm staat; die staat nu in de melding. */
    window.RTGMedia.camera({ achter: true, video: { width: { ideal: 1920 } }, stil: true })
      .then(function (s) { stream = s; vid.srcObject = s; })
      .catch(function (e) {
        var r = e.rtg || {};
        ov.querySelector('#pscanSub').textContent =
          (r.kort ? r.kort + '. ' + r.uitleg + ' ' : tekst('scan.geenrecht', 'Geen toegang tot de camera. ')) +
          tekst('scan.kiesfoto', 'Kies anders een foto.');
        ov.querySelector('#pscanMaak').hidden = true;
      });

    function toonKnoppenLive() {
      ov.querySelector('#pscanKnoppen').innerHTML =
        '<button type="button" id="pscanAf">' + tekst('scan.af', 'Sluiten') + '</button>' +
        '<button type="button" class="pscan-sluiter" id="pscanMaak" aria-label="' + tekst('scan.maak', 'Maak de scan') + '"></button>' +
        '<span class="pscan-evenwicht" aria-hidden="true"></span>';
      ov.querySelector('#pscanAf').addEventListener('click', afbreken);
      ov.querySelector('#pscanMaak').addEventListener('click', maak);
    }

    function maak() {
      var w = vid.videoWidth, h = vid.videoHeight; if (!w || !h) return;
      // Het beeld staat met object-fit:cover in het podium (1.42:1). We snijden
      // het naar diezelfde verhouding en dan naar het gouden kader (inset 7%/5%),
      // zodat we alleen het paspoort overhouden en de MRZ onderaan vast zit.
      var doelR = 1.42, srcR = w / h, cw, ch, cx, cy;
      if (srcR > doelR) { ch = h; cw = h * doelR; } else { cw = w; ch = w / doelR; }
      cx = (w - cw) / 2; cy = (h - ch) / 2;
      // het kader binnen het podium (zelfde inset als .pscan-kader)
      var kx = cx + cw * 0.05, ky = cy + ch * 0.07, kw = cw * 0.90, kh = ch * 0.86;
      var max = 1500, sc = Math.min(1, max / Math.max(kw, kh));
      var cv = document.createElement('canvas'); cv.width = Math.round(kw * sc); cv.height = Math.round(kh * sc);
      cv.getContext('2d').drawImage(vid, kx, ky, kw, kh, 0, 0, cv.width, cv.height);
      mrz = (root.RTGMRZ ? root.RTGMRZ.lees(cv) : null);
      dataURL = cv.toDataURL('image/jpeg', 0.82);
      // bevrore beeld tonen ter controle
      var pod = ov.querySelector('#pscanPodium');
      pod.querySelector('video').hidden = true;
      var img = document.createElement('img'); img.src = dataURL; pod.insertBefore(img, pod.firstChild);
      ov.querySelector('#pscanZin').textContent = tekst('scan.check', 'Goed leesbaar? Alle vier de hoeken in beeld?');
      ov.querySelector('#pscanSub').textContent = '';
      ov.querySelector('#pscanKnoppen').innerHTML =
        '<button type="button" id="pscanNog">' + tekst('scan.opnieuw', 'Opnieuw') + '</button>' +
        '<button type="button" class="prim" id="pscanOk">' + tekst('scan.ok', 'Gebruik deze scan') + '</button>';
      ov.querySelector('#pscanNog').addEventListener('click', function () {
        if (img.parentNode) img.parentNode.removeChild(img);
        pod.querySelector('video').hidden = false;
        ov.querySelector('#pscanZin').textContent = tekst('scan.titel', 'Leg je paspoort in het kader');
        ov.querySelector('#pscanSub').textContent = tekst('scan.hint', 'Houd de onderste twee regels (de << <) goed leesbaar in beeld.');
        dataURL = null; toonKnoppenLive();
      });
      ov.querySelector('#pscanOk').addEventListener('click', function () {
        var d = dataURL; sluit(); if (opts.onKlaar) opts.onKlaar(d);
      });
    }
    ov.querySelector('#pscanMaak').addEventListener('click', maak);
  }

  root.RTGPaspoortScan = { open: open };
})(window);
