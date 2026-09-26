/* DE TOESTELCEL -- hier wordt gerekend, en verder niets. TOESTEL.md par. 3.3.

   Deze code draait in /toestel/cel, als <iframe sandbox="allow-scripts">: een
   ondoorzichtige origin, zonder netwerk (connect-src 'none'), zonder toegang tot
   de ouder, OPFS of cookies. Alles wat de cel nodig heeft komt als BYTES binnen
   via postMessage, en alles wat eruit gaat is de uitkomst.

   De cel CONTROLEERT NIETS: dat heeft de ouder gedaan (./manifest.js) voordat
   hij de bytes stuurde. Zou de cel het nog eens doen, dan heeft zij de sleutels
   nodig -- en dan is de cel een tweede plek waar vertrouwen woont.

   Twee uitvoerders, en ze zijn met opzet klein en uitwisselbaar:
     wasm-proef  een eigen WebAssembly-module; bewijst de keten zonder runtime
     onnx        ONNX Runtime Web, zelf binnengekomen als ondertekend artefact
                 (runtime-JS als blob-module, de wasm als bytes: dit huis heeft
                 nul afhankelijkheden, en een runtime is ook rekentechnologie) */
(function () {
  'use strict';

  var UITVOERDERS = {
    'wasm-proef': async function (a, invoer) {
      var m = await WebAssembly.instantiate(a.module);
      var f = m.instance.exports.maal;
      if (typeof f !== 'function') throw new Error('de module heeft geen export maal');
      return { waarde: f(Number(invoer.a), Number(invoer.b)) };
    },
    onnx: async function (a, invoer) {
      var url = URL.createObjectURL(new Blob([a.runtime], { type: 'text/javascript' }));
      var ort;
      try { ort = await import(url); } finally { URL.revokeObjectURL(url); }
      ort.env.wasm.wasmBinary = a.runtimeWasm;
      ort.env.wasm.numThreads = 1; // threads vragen crossOriginIsolated; dat is een apart besluit
      ort.env.wasm.proxy = false;  // geen worker: worker-src staat op 'none'
      var sessie = await ort.InferenceSession.create(new Uint8Array(a.model), { executionProviders: ['wasm'] });
      var feeds = {};
      Object.keys(invoer.feeds || {}).forEach(function (n) {
        var t = invoer.feeds[n];
        feeds[n] = new ort.Tensor(t.type, t.data, t.dims);
      });
      var r = await sessie.run(feeds), uit = {};
      Object.keys(r).forEach(function (n) {
        uit[n] = { type: r[n].type, dims: r[n].dims.slice(), data: Array.from(r[n].data) };
      });
      return { tensors: uit };
    }
  };

  addEventListener('message', async function (e) {
    if (e.source !== parent) return; // alleen de eigen ouder
    var d = e.data || {};
    if (d.soort !== 'reken') return;
    var antwoord = { soort: 'uitkomst', id: d.id, uitvoerder: d.uitvoerder };
    var f = Object.prototype.hasOwnProperty.call(UITVOERDERS, d.uitvoerder) ? UITVOERDERS[d.uitvoerder] : null;
    if (!f) {
      antwoord.ok = false; antwoord.reden = 'deze cel kent de uitvoerder ' + d.uitvoerder + ' niet';
      return parent.postMessage(antwoord, '*');
    }
    var t0 = performance.now();
    try {
      antwoord.uitkomst = await f(d.artefacten || {}, d.invoer || {});
      antwoord.ok = true;
    } catch (x) {
      antwoord.ok = false; antwoord.reden = 'de uitvoerder faalde: ' + String(x && x.message || x).slice(0, 200);
    }
    antwoord.rekenMs = Math.round(performance.now() - t0);
    /* '*' omdat de ouder vanuit een ondoorzichtige origin niet bij naam te
       noemen is. Wat hier uitgaat is alleen de uitkomst; de ouder toetst dat
       het bericht van ZIJN cel komt (e.source). */
    parent.postMessage(antwoord, '*');
  });

  parent.postMessage({ soort: 'klaar' }, '*');
}());
