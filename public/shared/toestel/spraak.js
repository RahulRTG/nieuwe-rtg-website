/* SPRAAK NAAR TEKST OP HET TOESTEL -- het eerste echte taakcontract.
   TOESTEL.md par. 11.

   Deze module REKENT NIET MET EEN MODEL: dat doet de cel (./cel.js, uitvoerder
   `whisper`). Hier staat alleen wat vóór en na het model zeker moet zijn, en
   dat is gewone rekenkunde die in Node te toetsen is:

     wav()        16-bit PCM uit een WAV-bestand, als getallen tussen -1 en 1
     herbemonster lineair naar 16 kHz (de microfoon levert meestal 44,1 of 48)
     logMel()     het log-mel-spectrogram zoals Whisper het verwacht:
                  80 banden x 3000 vensters, Hann 400, stap 160, slaney-schaal
     tekst()      token-id's terug naar tekst (byte-niveau BPE, zoals GPT-2)
     prompt()     de openingstokens: begin, taal, transcriberen, geen tijden

   De stem van het lid verlaat het toestel niet: het spectrogram wordt hier
   gemaakt, gaat als kopie naar een cel zonder netwerk, en terug komt een rij
   getallen. Wat er van die getallen tekst wordt, gebeurt weer hier.

   Waarom de DFT zonder FFT: 400 is geen macht van twee, en een eigen
   gemengde-radix-FFT is meer code om fout te doen dan hij hier oplevert. De
   vensters die volledig in de opvulstilte vallen worden overgeslagen (hun
   vermogen is nul), dus de rekentijd volgt de lengte van de opname en niet de
   dertig seconden van het venster.
   Puur. In de browser window.RTGToestelSpraak, in Node via require. */
(function (root, fabriek) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = fabriek();
  else root.RTGToestelSpraak = fabriek();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var HZ = 16000, NFFT = 400, STAP = 160, BANDEN = 80, VENSTERS = 3000, MONSTERS = 480000;
  var BAKKEN = NFFT / 2 + 1;
  var EOT = 50257;

  function wav(bytes) {
    var v = new DataView(bytes.buffer || bytes, bytes.byteOffset || 0, bytes.byteLength);
    var ascii = function (o) { return String.fromCharCode(v.getUint8(o), v.getUint8(o + 1), v.getUint8(o + 2), v.getUint8(o + 3)); };
    if (ascii(0) !== 'RIFF' || ascii(8) !== 'WAVE') throw new Error('geen WAV-bestand');
    var o = 12, fmt = null;
    while (o + 8 <= v.byteLength) {
      var id = ascii(o), n = v.getUint32(o + 4, true);
      if (id === 'fmt ') fmt = { kanalen: v.getUint16(o + 10, true), hz: v.getUint32(o + 12, true), bits: v.getUint16(o + 22, true) };
      if (id === 'data') {
        if (!fmt || fmt.bits !== 16) throw new Error('alleen 16-bit PCM wordt gelezen');
        var tel = Math.floor(n / 2 / fmt.kanalen), uit = new Float32Array(tel);
        for (var i = 0; i < tel; i++) {
          var s = 0;
          for (var k = 0; k < fmt.kanalen; k++) s += v.getInt16(o + 8 + (i * fmt.kanalen + k) * 2, true);
          uit[i] = s / fmt.kanalen / 32768;
        }
        return { monsters: uit, hz: fmt.hz };
      }
      o += 8 + n + (n & 1);
    }
    throw new Error('het WAV-bestand heeft geen data');
  }

  function herbemonster(monsters, vanHz) {
    if (vanHz === HZ) return Float32Array.from(monsters);
    var r = vanHz / HZ, n = Math.floor(monsters.length / r), uit = new Float32Array(n);
    for (var i = 0; i < n; i++) {
      var p = i * r, a = Math.floor(p), f = p - a;
      uit[i] = monsters[a] * (1 - f) + (a + 1 < monsters.length ? monsters[a + 1] : 0) * f;
    }
    return uit;
  }

  /* Slaney-mel: lineair tot 1000 Hz, daarboven logaritmisch; elke driehoek
     genormaliseerd op zijn breedte. Zo rekent de WhisperFeatureExtractor. */
  function hzNaarMel(f) { return f < 1000 ? 3 * f / 200 : 15 + Math.log(f / 1000) * 27 / Math.log(6.4); }
  function melNaarHz(m) { return m < 15 ? 200 * m / 3 : 1000 * Math.exp((m - 15) * Math.log(6.4) / 27); }
  var filters = null;
  function melFilters() {
    if (filters) return filters;
    var lo = hzNaarMel(0), hi = hzNaarMel(HZ / 2), punten = [];
    for (var i = 0; i < BANDEN + 2; i++) punten.push(melNaarHz(lo + (hi - lo) * i / (BANDEN + 1)));
    filters = new Float64Array(BANDEN * BAKKEN);
    for (var b = 0; b < BANDEN; b++) {
      var norm = 2 / (punten[b + 2] - punten[b]);
      for (var k = 0; k < BAKKEN; k++) {
        var f = k * HZ / NFFT;
        var op = (f - punten[b]) / (punten[b + 1] - punten[b]), af = (punten[b + 2] - f) / (punten[b + 2] - punten[b + 1]);
        filters[b * BAKKEN + k] = Math.max(0, Math.min(op, af)) * norm;
      }
    }
    return filters;
  }

  var cos = null, sin = null, hann = null;
  function tabellen() {
    if (cos) return;
    cos = new Float64Array(BAKKEN * NFFT); sin = new Float64Array(BAKKEN * NFFT); hann = new Float64Array(NFFT);
    for (var n = 0; n < NFFT; n++) hann[n] = 0.5 - 0.5 * Math.cos(2 * Math.PI * n / NFFT); // periodiek
    for (var k = 0; k < BAKKEN; k++) for (n = 0; n < NFFT; n++) {
      cos[k * NFFT + n] = Math.cos(2 * Math.PI * k * n / NFFT); sin[k * NFFT + n] = Math.sin(2 * Math.PI * k * n / NFFT);
    }
  }

  /* Uit: Float32Array van 80 x 3000, per band een rij (vorm [1, 80, 3000]). */
  function logMel(monsters16k) {
    tabellen();
    var F = melFilters(), lengte = Math.min(monsters16k.length, MONSTERS), half = NFFT / 2;
    var x = new Float64Array(MONSTERS + NFFT); // midden-uitgelijnd, gespiegeld aan het begin
    for (var i = 0; i < lengte; i++) x[half + i] = monsters16k[i];
    for (i = 1; i <= half; i++) x[half - i] = lengte > i ? monsters16k[i] : 0;
    var mel = new Float64Array(BANDEN * VENSTERS), macht = new Float64Array(BAKKEN), frame = new Float64Array(NFFT);
    var laatste = Math.min(VENSTERS - 1, Math.ceil((lengte + half) / STAP));
    for (var t = 0; t <= laatste; t++) {
      for (var n = 0; n < NFFT; n++) frame[n] = x[t * STAP + n] * hann[n];
      for (var k = 0; k < BAKKEN; k++) {
        var re = 0, im = 0, o = k * NFFT;
        for (n = 0; n < NFFT; n++) { re += frame[n] * cos[o + n]; im -= frame[n] * sin[o + n]; }
        macht[k] = re * re + im * im;
      }
      for (var b = 0; b < BANDEN; b++) {
        var s = 0, fo = b * BAKKEN;
        for (k = 0; k < BAKKEN; k++) s += F[fo + k] * macht[k];
        mel[b * VENSTERS + t] = s;
      }
    }
    var top = -Infinity;
    for (i = 0; i < mel.length; i++) { mel[i] = Math.log10(Math.max(mel[i], 1e-10)); if (mel[i] > top) top = mel[i]; }
    var uit = new Float32Array(mel.length);
    for (i = 0; i < mel.length; i++) uit[i] = (Math.max(mel[i], top - 8) + 4) / 4;
    return uit;
  }

  /* GPT-2 bytes_to_unicode, omgekeerd: elk teken in de vocabulaire staat voor
     precies een byte. */
  var naarByte = null;
  function byteTabel() {
    if (naarByte) return naarByte;
    naarByte = {};
    var bs = [], i;
    for (i = 33; i <= 126; i++) bs.push(i);
    for (i = 161; i <= 172; i++) bs.push(i);
    for (i = 174; i <= 255; i++) bs.push(i);
    var cs = bs.slice(), n = 0;
    for (i = 0; i < 256; i++) if (bs.indexOf(i) < 0) { bs.push(i); cs.push(256 + n++); }
    bs.forEach(function (b, j) { naarByte[String.fromCharCode(cs[j])] = b; });
    return naarByte;
  }
  function tekst(ids, vocab) {
    var t = byteTabel(), omgekeerd = vocab.__omgekeerd;
    if (!omgekeerd) {
      omgekeerd = [];
      Object.keys(vocab).forEach(function (w) { omgekeerd[vocab[w]] = w; });
      Object.defineProperty(vocab, '__omgekeerd', { value: omgekeerd });
    }
    var bytes = [];
    ids.forEach(function (id) {
      if (id >= EOT) return; // speciale tokens zijn geen tekst
      var w = omgekeerd[id] || '';
      for (var i = 0; i < w.length; i++) if (t[w[i]] !== undefined) bytes.push(t[w[i]]);
    });
    return new TextDecoder('utf-8').decode(new Uint8Array(bytes)).trim();
  }

  /* De taal komt uit het tokenbestand en wordt nooit geraden: een onbekende
     taal is een weigering en geen Engels. */
  function prompt(speciaal, taal) {
    var t = speciaal['<|' + taal + '|>'];
    if (t === undefined) throw new Error('het model kent de taal ' + taal + ' niet');
    return [speciaal['<|startoftranscript|>'], t, speciaal['<|transcribe|>'], speciaal['<|notimestamps|>']];
  }

  return Object.freeze({ HZ: HZ, EOT: EOT, wav: wav, herbemonster: herbemonster, melFilters: melFilters,
    logMel: logMel, tekst: tekst, prompt: prompt });
}));
