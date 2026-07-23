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

  function stijl() {
    if (document.getElementById('pscanCss')) return;
    var st = document.createElement('style'); st.id = 'pscanCss';
    st.textContent =
      '.pscan{position:fixed;inset:0;z-index:200;background:#0C0C0B;display:flex;flex-direction:column;' +
        'align-items:center;justify-content:center;padding:calc(env(safe-area-inset-top,0px) + 1rem) 1rem calc(env(safe-area-inset-bottom,0px) + 1.2rem);}' +
      '.pscan-podium{position:relative;width:min(560px,94vw);aspect-ratio:1.42/1;border-radius:16px;overflow:hidden;background:#000;box-shadow:0 30px 90px rgba(0,0,0,.7);}' +
      '.pscan-podium video,.pscan-podium img{width:100%;height:100%;object-fit:cover;display:block;}' +
      '.pscan-kader{position:absolute;inset:7% 5%;border:2px solid rgba(201,162,75,.9);border-radius:12px;box-shadow:0 0 0 100vmax rgba(0,0,0,.32);pointer-events:none;}' +
      '.pscan-hoek{position:absolute;width:22px;height:22px;border:3px solid var(--gold,#C9A24B);}' +
      '.pscan-hoek.lb{left:-2px;top:-2px;border-right:none;border-bottom:none;border-radius:10px 0 0 0;}' +
      '.pscan-hoek.rb{right:-2px;top:-2px;border-left:none;border-bottom:none;border-radius:0 10px 0 0;}' +
      '.pscan-hoek.lo{left:-2px;bottom:-2px;border-right:none;border-top:none;border-radius:0 0 0 10px;}' +
      '.pscan-hoek.ro{right:-2px;bottom:-2px;border-left:none;border-top:none;border-radius:0 0 10px 0;}' +
      '.pscan-mrz{position:absolute;left:6%;right:6%;bottom:9%;height:15%;border:1px dashed rgba(237,231,218,.55);border-radius:5px;}' +
      '.pscan-zin{color:var(--txt,#F4F1EC);font-family:"Bodoni Moda",serif;font-size:1.05rem;text-align:center;margin:1.1rem 0 .2rem;text-wrap:balance;}' +
      '.pscan-sub{color:var(--soft,#8A8680);font-size:.78rem;text-align:center;margin-bottom:1rem;min-height:1rem;}' +
      '.pscan-knoppen{display:flex;gap:.7rem;align-items:center;justify-content:center;flex-wrap:wrap;}' +
      '.pscan-knoppen button{font-family:inherit;cursor:pointer;border-radius:999px;font-size:.85rem;padding:.7rem 1.3rem;border:1px solid var(--line,rgba(255,255,255,.16));background:none;color:var(--txt,#F4F1EC);}' +
      '.pscan-knoppen button.prim{background:var(--gold,#C9A24B);border-color:var(--gold,#C9A24B);color:#0C0C0B;font-weight:700;}' +
      '.pscan-sluiter{width:66px;height:66px;border-radius:50%;padding:0!important;border:3px solid var(--gold,#C9A24B)!important;background:rgba(201,162,75,.15)!important;position:relative;}' +
      '.pscan-sluiter::after{content:"";position:absolute;inset:7px;border-radius:50%;background:var(--gold,#C9A24B);}';
    document.head.appendChild(st);
  }

  function tekst(k, nl) { return (root.RTGi18n ? root.RTGi18n.t(k, nl) : nl); }

  function open(opts) {
    opts = opts || {};
    stijl();
    var ov = document.createElement('div'); ov.className = 'pscan';
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
        '<span style="width:66px;"></span>' +
      '</div>';
    document.body.appendChild(ov);

    var vid = ov.querySelector('#pscanVid');
    var stream = null, dataURL = null;

    function sluit() {
      if (stream) { stream.getTracks().forEach(function (t) { t.stop(); }); stream = null; }
      if (ov.parentNode) ov.parentNode.removeChild(ov);
    }
    function afbreken() { sluit(); if (opts.onAf) opts.onAf(); }

    ov.querySelector('#pscanAf').addEventListener('click', afbreken);
    document.addEventListener('keydown', function esc(e) { if (e.key === 'Escape') { document.removeEventListener('keydown', esc); afbreken(); } });

    if (!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) {
      ov.querySelector('#pscanSub').textContent = tekst('scan.geen', 'Dit toestel heeft geen camera-toegang. Kies dan een foto.');
      ov.querySelector('#pscanMaak').style.display = 'none';
      return;
    }
    navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 } }, audio: false })
      .then(function (s) { stream = s; vid.srcObject = s; })
      .catch(function () {
        ov.querySelector('#pscanSub').textContent = tekst('scan.geenrecht', 'Geen toegang tot de camera. Kies anders een foto.');
        ov.querySelector('#pscanMaak').style.display = 'none';
      });

    function toonKnoppenLive() {
      ov.querySelector('#pscanKnoppen').innerHTML =
        '<button type="button" id="pscanAf">' + tekst('scan.af', 'Sluiten') + '</button>' +
        '<button type="button" class="pscan-sluiter" id="pscanMaak" aria-label="' + tekst('scan.maak', 'Maak de scan') + '"></button>' +
        '<span style="width:66px;"></span>';
      ov.querySelector('#pscanAf').addEventListener('click', afbreken);
      ov.querySelector('#pscanMaak').addEventListener('click', maak);
    }

    function maak() {
      var w = vid.videoWidth, h = vid.videoHeight; if (!w || !h) return;
      var max = 1500, sc = Math.min(1, max / Math.max(w, h));
      var cv = document.createElement('canvas'); cv.width = Math.round(w * sc); cv.height = Math.round(h * sc);
      cv.getContext('2d').drawImage(vid, 0, 0, cv.width, cv.height);
      dataURL = cv.toDataURL('image/jpeg', 0.82);
      // bevrore beeld tonen ter controle
      var pod = ov.querySelector('#pscanPodium');
      pod.querySelector('video').style.display = 'none';
      var img = document.createElement('img'); img.src = dataURL; pod.insertBefore(img, pod.firstChild);
      ov.querySelector('#pscanZin').textContent = tekst('scan.check', 'Goed leesbaar? Alle vier de hoeken in beeld?');
      ov.querySelector('#pscanSub').textContent = '';
      ov.querySelector('#pscanKnoppen').innerHTML =
        '<button type="button" id="pscanNog">' + tekst('scan.opnieuw', 'Opnieuw') + '</button>' +
        '<button type="button" class="prim" id="pscanOk">' + tekst('scan.ok', 'Gebruik deze scan') + '</button>';
      ov.querySelector('#pscanNog').addEventListener('click', function () {
        if (img.parentNode) img.parentNode.removeChild(img);
        pod.querySelector('video').style.display = '';
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
