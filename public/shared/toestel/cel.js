/* DE TOESTELCEL -- hier wordt gerekend, en verder niets. TOESTEL.md par. 3.3.

   Deze code draait in /toestel/cel, als <iframe sandbox="allow-scripts">: een
   ondoorzichtige origin, zonder netwerk (connect-src 'none'), zonder toegang tot
   de ouder, OPFS of cookies. Alles wat de cel nodig heeft komt als BYTES binnen
   via postMessage, en alles wat eruit gaat is de uitkomst.

   De cel CONTROLEERT NIETS: dat heeft de ouder gedaan (./manifest.js) voordat
   hij de bytes stuurde. Zou de cel het nog eens doen, dan heeft zij de sleutels
   nodig -- en dan is de cel een tweede plek waar vertrouwen woont.

   Drie uitvoerders, en ze zijn met opzet klein en uitwisselbaar:
     wasm-proef  een eigen WebAssembly-module; bewijst de keten zonder runtime
     onnx        ONNX Runtime Web, zelf binnengekomen als ondertekend artefact
                 (runtime-JS als blob-module, de wasm als bytes: dit huis heeft
                 nul afhankelijkheden, en een runtime is ook rekentechnologie)
     whisper     spraak naar token-id's op diezelfde runtime (TOESTEL.md par. 11) */
(function () {
  'use strict';

  /* HET REKENEN GEBEURT IN EEN WORKER. De sandbox-cel deelt in de praktijk de
     thread met de pagina van het lid: een uitvoerder die bleef rekenen bevroor
     de hele pagina, en de klok van het plafond (rekenaar.js) ging nooit af
     (TOESTEL.md par. 10.1). In een worker gaat de klok af, en met de cel gaat
     haar worker. Hij komt als blob uit DEZE functie en erft de CSP van de cel,
     dus ook connect-src 'none'. */
  function werker() {
  /* De runtime komt als ondertekend artefact binnen: JS als blob-module, de
     wasm als bytes. Threads vragen crossOriginIsolated (een apart besluit), en
     een proxyworker is niet nodig: dit IS al een worker. */
  async function laadOrt(a) {
    var url = URL.createObjectURL(new Blob([a.runtime], { type: 'text/javascript' }));
    var ort;
    try { ort = await import(url); } finally { URL.revokeObjectURL(url); }
    ort.env.wasm.wasmBinary = a.runtimeWasm;
    ort.env.wasm.numThreads = 1;
    ort.env.wasm.proxy = false;
    return ort;
  }

  /* Een model dat in een lus schiet ("een beetje een beetje een beetje ...")
     rekent anders door tot het plafond, en levert een tekst die er vol uitziet.
     Herhaalt het staartstuk van n tokens (n = 1..12) zich VIER keer achter
     elkaar, dan stopt het decoderen: er blijft een exemplaar staan en de uitslag
     draagt `herhaling`, zodat een scherm kan zeggen dat de herkenning vastliep.
     Nooit stil afknippen. Gemeten aanleiding: TOESTEL.md par. 13. */
  var HERHAAL = 4;
  function herhaalt(t) {
    for (var n = 1; n <= 12 && n * HERHAAL <= t.length; n++) {
      var ok = true;
      for (var k = 1; k < HERHAAL && ok; k++) {
        for (var i = 0; i < n; i++) if (t[t.length - 1 - i] !== t[t.length - 1 - i - k * n]) { ok = false; break; }
      }
      if (ok) return n;
    }
    return 0;
  }

  var UITVOERDERS = {
    'wasm-proef': async function (a, invoer) {
      var m = await WebAssembly.instantiate(a.module);
      var f = m.instance.exports.maal;
      if (typeof f !== 'function') throw new Error('de module heeft geen export maal');
      return { waarde: f(Number(invoer.a), Number(invoer.b)) };
    },
    /* `feeds` is een run; `reeks` is een lijst runs in DEZELFDE sessie, elk
       apart. Een reeks is geen batch: een gekwantiseerd model rekent zijn
       schaal over de hele invoer, dus in een batch hangt de uitkomst van een
       tekst af van zijn buren (TOESTEL.md par. 12). */
    onnx: async function (a, invoer) {
      var ort = await laadOrt(a);
      var sessie = await ort.InferenceSession.create(new Uint8Array(a.model), { executionProviders: ['wasm'] });
      async function run(fs) {
        var feeds = {};
        Object.keys(fs || {}).forEach(function (n) { feeds[n] = new ort.Tensor(fs[n].type, fs[n].data, fs[n].dims); });
        var r = await sessie.run(feeds), uit = {};
        Object.keys(r).forEach(function (n) {
          uit[n] = { type: r[n].type, dims: r[n].dims.slice(), data: Array.from(r[n].data) };
        });
        return uit;
      }
      if (!Array.isArray(invoer.reeks)) return { tensors: await run(invoer.feeds) };
      var reeks = [];
      for (var i = 0; i < invoer.reeks.length; i++) reeks.push(await run(invoer.reeks[i]));
      return { reeks: reeks };
    },
    /* Whisper: encoder een keer, daarna de decoder token voor token met zijn
       eigen geheugen (past_key_values). Er gaat een spectrogram in en er komen
       token-id's uit; tekst maken doet de ouder (./spraak.js). Hebzuchtig
       decoderen, met de onderdrukte tokens uit de generatie-instelling van
       het model zelf. */
    whisper: async function (a, invoer) {
      var ort = await laadOrt(a), opt = { executionProviders: ['wasm'] };
      var enc = await ort.InferenceSession.create(new Uint8Array(a.encoder), opt);
      var dec = await ort.InferenceSession.create(new Uint8Array(a.decoder), opt);
      var v = invoer.vorm, max = Math.min(invoer.maxTokens || 128, 224);
      var h = (await enc.run({ input_features: new ort.Tensor('float32', invoer.mel, [1, 80, 3000]) })).last_hidden_state;
      var leeg = function () { return new ort.Tensor('float32', new Float32Array(0), [1, v.koppen, 0, v.dim]); };
      var past = {};
      for (var l = 0; l < v.lagen; l++) ['decoder', 'encoder'].forEach(function (s) {
        past['past_key_values.' + l + '.' + s + '.key'] = leeg(); past['past_key_values.' + l + '.' + s + '.value'] = leeg();
      });
      var weg = {}; (invoer.onderdruk || []).forEach(function (t) { weg[t] = true; });
      var begin = {}; (invoer.onderdrukBegin || []).forEach(function (t) { begin[t] = true; });
      var ids = invoer.prompt.slice(), uit = [];
      for (var stap = 0; stap < max; stap++) {
        var nieuw = stap === 0 ? ids : [ids[ids.length - 1]];
        var feeds = Object.assign({
          input_ids: new ort.Tensor('int64', BigInt64Array.from(nieuw.map(BigInt)), [1, nieuw.length]),
          encoder_hidden_states: h,
          use_cache_branch: new ort.Tensor('bool', [stap > 0], [1])
        }, past);
        var r = await dec.run(feeds), lg = r.logits, n = lg.dims[2], o = (lg.dims[1] - 1) * n, beste = -1, top = -Infinity;
        for (var t = 0; t < n; t++) {
          if (weg[t] || (stap === 0 && begin[t])) continue;
          if (lg.data[o + t] > top) { top = lg.data[o + t]; beste = t; }
        }
        for (l = 0; l < v.lagen; l++) ['key', 'value'].forEach(function (k) {
          past['past_key_values.' + l + '.decoder.' + k] = r['present.' + l + '.decoder.' + k];
          if (stap === 0) past['past_key_values.' + l + '.encoder.' + k] = r['present.' + l + '.encoder.' + k];
        });
        if (beste === invoer.eot) break;
        ids.push(beste); uit.push(beste);
        var lus = herhaalt(uit);
        if (lus) { uit.length -= lus * (HERHAAL - 1); return { tokens: uit, afgekapt: false, herhaling: true }; }
      }
      return { tokens: uit, afgekapt: uit.length >= max, herhaling: false };
    }
  };

  /* In de worker: een opdracht in, een uitkomst uit. Buiten een worker (de
     cel zelf, of de toets in een vm) wordt alleen de lusdetector teruggegeven. */
  if (typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope) {
    addEventListener('message', async function (e) {
      var d = e.data || {}, antwoord = {};
      var f = Object.prototype.hasOwnProperty.call(UITVOERDERS, d.uitvoerder) ? UITVOERDERS[d.uitvoerder] : null;
      if (!f) { antwoord.ok = false; antwoord.reden = 'deze cel kent de uitvoerder ' + d.uitvoerder + ' niet'; return postMessage(antwoord); }
      var t0 = performance.now();
      try {
        antwoord.uitkomst = await f(d.artefacten || {}, d.invoer || {});
        antwoord.ok = true;
      } catch (x) {
        antwoord.ok = false; antwoord.reden = 'de uitvoerder faalde: ' + String(x && x.message || x).slice(0, 200);
      }
      antwoord.rekenMs = Math.round(performance.now() - t0);
      postMessage(antwoord);
    });
  }
  return { herhaalt: herhaalt };
}

  self.RTGCelHerhaalt = werker().herhaalt; // alleen zichtbaar binnen de cel zelf, en voor de toets
  var WERKER_BRON = '(' + werker.toString() + ')();';

  /* Een verse worker per opdracht: er blijft niets van een vorige hangen. */
  function inWorker(d) {
    return new Promise(function (klaar) {
      var url = URL.createObjectURL(new Blob([WERKER_BRON], { type: 'text/javascript' }));
      var w;
      try { w = new Worker(url); } catch (x) {
        URL.revokeObjectURL(url);
        return klaar({ ok: false, reden: 'de cel kon geen worker starten: ' + String(x && x.message || x).slice(0, 200) });
      }
      URL.revokeObjectURL(url);
      function klaarMet(a) { w.terminate(); klaar(a); }
      w.onmessage = function (e) { klaarMet(e.data || { ok: false, reden: 'de worker gaf niets terug' }); };
      w.onerror = function (e) { e.preventDefault(); klaarMet({ ok: false, reden: 'de worker faalde: ' + String(e.message || 'onbekend').slice(0, 200) }); };
      var overdracht = Object.keys(d.artefacten || {}).map(function (r) { return d.artefacten[r]; })
        .filter(function (b) { return b instanceof ArrayBuffer; });
      w.postMessage({ uitvoerder: d.uitvoerder, artefacten: d.artefacten || {}, invoer: d.invoer || {} }, overdracht);
    });
  }

  addEventListener('message', async function (e) {
    if (e.source !== parent) return; // alleen de eigen ouder
    var d = e.data || {};
    if (d.soort !== 'reken') return;
    var antwoord = Object.assign({ soort: 'uitkomst', id: d.id, uitvoerder: d.uitvoerder }, await inWorker(d));
    antwoord.soort = 'uitkomst'; antwoord.id = d.id; antwoord.uitvoerder = d.uitvoerder;
    /* '*' omdat de ouder vanuit een ondoorzichtige origin niet bij naam te
       noemen is. Wat hier uitgaat is alleen de uitkomst; de ouder toetst dat
       het bericht van ZIJN cel komt (e.source). */
    parent.postMessage(antwoord, '*');
  });

  parent.postMessage({ soort: 'klaar' }, '*');
}());
