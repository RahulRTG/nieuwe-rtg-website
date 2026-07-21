/* RTG Scanner (camera-bediening): opent de camera, pakt frames en leest er codes
   uit -- QR en, waar de browser dat kan, ook streepjescodes (EAN/Code128 e.d.).
   Eerst de ingebouwde BarcodeDetector; heeft de browser die niet, dan valt hij
   terug op onze eigen QR-beeld-decoder (public/shared/qrscan.js). Geen externe
   pakketten en geen beeld verlaat het toestel: elk frame wordt lokaal ontleed.

   Gebruik (in de app):
     const s = new RTGScanner.Scanner({ video: el, onCode: c => ... });
     await s.start();   // vraagt cameratoegang
     s.stop();          // camera vrijgeven
   De pure helpers (grijs, leesGrijs) zijn los te toetsen zonder camera. */
(function (root) {
  'use strict';
  // qrscan lui ophalen: in Node via require, in de browser via de globale die
  // qrscan.js zet -- zo maakt de laadvolgorde van de scripts niet uit.
  function codec() {
    if (typeof require !== 'undefined') { try { return require('./qrscan'); } catch (e) {} }
    return root.RTGQRScan || null;
  }
  function heeftNativeDetector() { return typeof root.BarcodeDetector !== 'undefined'; }
  function ondersteundeFormaten() {
    if (!heeftNativeDetector()) return Promise.resolve([]);
    try { return root.BarcodeDetector.getSupportedFormats().catch(function () { return []; }); }
    catch (e) { return Promise.resolve([]); }
  }

  // RGBA-ImageData -> grijswaarden (Rec.601-luma, geheeltallig voor snelheid)
  function grijs(imgData) {
    var d = imgData.data, n = imgData.width * imgData.height, g = new Uint8Array(n);
    for (var i = 0, j = 0; i < n; i++, j += 4) g[i] = (d[j] * 77 + d[j + 1] * 150 + d[j + 2] * 29) >> 8;
    return g;
  }
  // een grijswaardebeeld door onze eigen QR-decoder halen (tekst of null)
  function leesGrijs(gray, w, h) {
    var c = codec();
    if (!c) return null;
    try { var uit = c.decodeImage(gray, w, h); return uit && uit.tekst ? uit.tekst : null; } catch (e) { return null; }
  }

  function Scanner(opties) {
    opties = opties || {};
    this.video = opties.video || (typeof document !== 'undefined' ? document.createElement('video') : null);
    this.onCode = opties.onCode || function () {};
    this.onFout = opties.onFout || function () {};
    // welke codesoorten de native detector mag zoeken (streepjescodes + QR)
    this.formaten = opties.formaten || ['qr_code', 'ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e', 'itf'];
    this.interval = opties.interval || 220;   // ms tussen scans: zuinig, geen oneindige haast
    this.maxBreedte = opties.maxBreedte || 640; // frame omlaag schalen voor de eigen decoder
    this.herhaalMs = opties.herhaalMs || 1500;  // dezelfde code niet vaker dan dit melden
    this.canvas = (typeof document !== 'undefined') ? document.createElement('canvas') : null;
    this.ctx = this.canvas ? this.canvas.getContext('2d', { willReadFrequently: true }) : null;
    this.stream = null; this.detector = null; this.actief = false;
    this._laatste = null; this._laatsteTijd = 0; this._timer = null;
  }

  Scanner.prototype.start = function () {
    var self = this;
    if (this.actief) return Promise.resolve();
    if (!navigator || !navigator.mediaDevices) return Promise.reject(new Error('camera niet beschikbaar'));
    return navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 } }, audio: false })
      .then(function (stream) {
        self.stream = stream; self.video.srcObject = stream;
        self.video.setAttribute('playsinline', ''); self.video.muted = true;
        return self.video.play();
      })
      .then(function () {
        if (heeftNativeDetector()) {
          try { self.detector = new root.BarcodeDetector({ formats: self.formaten }); }
          catch (e) { self.detector = null; } // formaat niet gesteund -> eigen decoder
        }
        self.actief = true; self._lus();
      });
  };

  Scanner.prototype.stop = function () {
    this.actief = false;
    if (this._timer) { clearTimeout(this._timer); this._timer = null; }
    if (this.stream) { this.stream.getTracks().forEach(function (t) { t.stop(); }); this.stream = null; }
    if (this.video) this.video.srcObject = null;
  };

  Scanner.prototype._treffer = function (tekst, formaat) {
    var nu = Date.now();
    if (tekst === this._laatste && nu - this._laatsteTijd < this.herhaalMs) return; // ontdubbelen
    this._laatste = tekst; this._laatsteTijd = nu;
    try { this.onCode({ tekst: tekst, formaat: formaat || 'qr_code' }); } catch (e) {}
  };

  Scanner.prototype._lus = function () {
    var self = this;
    if (!this.actief) return;
    var klaar = function () { if (self.actief) self._timer = setTimeout(function () { self._lus(); }, self.interval); };
    var vw = this.video ? this.video.videoWidth : 0, vh = this.video ? this.video.videoHeight : 0;
    if (!vw || !vh) { klaar(); return; }
    if (this.detector) {
      this.detector.detect(this.video).then(function (codes) {
        if (codes && codes.length) self._treffer(codes[0].rawValue, codes[0].format);
      }).catch(function (e) { self.onFout(e); }).then(klaar);
      return;
    }
    // eigen weg: frame naar canvas, omlaag schalen, grijs, decoderen
    try {
      var schaal = Math.min(1, this.maxBreedte / vw);
      var w = Math.round(vw * schaal), h = Math.round(vh * schaal);
      this.canvas.width = w; this.canvas.height = h;
      this.ctx.drawImage(this.video, 0, 0, w, h);
      var tekst = leesGrijs(grijs(this.ctx.getImageData(0, 0, w, h)), w, h);
      if (tekst) this._treffer(tekst, 'qr_code');
    } catch (e) { this.onFout(e); }
    klaar();
  };

  var api = { Scanner: Scanner, heeftNativeDetector: heeftNativeDetector, ondersteundeFormaten: ondersteundeFormaten, grijs: grijs, leesGrijs: leesGrijs };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RTGScanner = api;
})(typeof self !== 'undefined' ? self : this);
