/* DE TOESTELMETING -- feiten, geen klasse. TOESTEL.md par. 3.2, 9.4 en 9.6.

   Er komt geen NONE/LIGHT/STANDARD/POWER: een toestel van 2029 wordt vanzelf
   beter benut omdat de poorten een gemeten FEIT vergelijken met een eis.

   Wat een browser niet laat zien, meten we niet en schatten we ook niet:
     - warmte: er is geen API. Wat wel te zien is, is de VERTRAGING die er het
       gevolg van is -- wordt dezelfde taak binnen een sessie trager, dan
       `vertraagd` en stopt zwaar werk (./poorten.js);
     - batterij: alleen in Chromium (getBattery). Elders `null`, en dan geldt de
       strengste aanname;
     - energie: onbekend, met die reden.

   WAT HIER BLIJFT, EN WAT NIET. De volledige waarneming (welke uitvoerder, hoe
   snel, op deze browser en deze hardware) is een vingerafdruk. Ze blijft op
   dit toestel, in localStorage, en de planner van DIT toestel leert ervan.
   Deze module stuurt niets naar RTG; grove tellers zonder toestel-id zijn een
   latere stap (TOE-07) en komen niet uit deze functie.
   In de browser window.RTGToestelMeting. */
(function (root) {
  'use strict';
  var SLEUTEL = 'rtg-toestel-waarneming', MAX = 40;
  /* Een piepkleine module die alleen geldig is als de browser WASM-SIMD kent
     (v128). Valideren, niet uitvoeren. */
  var SIMD = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0,
    65, 0, 253, 15, 253, 98, 11]);

  async function gpu() {
    try { return !!(navigator.gpu && await navigator.gpu.requestAdapter()); } catch (e) { return false; }
  }
  async function batterij() {
    try {
      if (!navigator.getBattery) return null;
      var b = await navigator.getBattery();
      return { laadt: !!b.charging, niveau: typeof b.level === 'number' ? b.level : null };
    } catch (e) { return null; }
  }
  async function opslag() {
    try { var s = await navigator.storage.estimate(); return { vrijBytes: (s.quota || 0) - (s.usage || 0) }; }
    catch (e) { return null; }
  }

  async function feiten() {
    var wasm = typeof WebAssembly === 'object';
    return {
      webgpu: await gpu(),
      wasm: wasm,
      wasmSimd: wasm && WebAssembly.validate(SIMD),
      wasmThreads: !!(root.crossOriginIsolated && typeof SharedArrayBuffer === 'function'),
      webnn: !!(navigator.ml && navigator.ml.createContext),
      geheugenGb: typeof navigator.deviceMemory === 'number' ? navigator.deviceMemory : null,
      opslag: await opslag(),
      batterij: await batterij(),
      energie: null,
      energieReden: 'een browser heeft geen betrouwbare meter voor energie of warmte'
    };
  }

  function lees() { try { return JSON.parse(localStorage.getItem(SLEUTEL) || '[]'); } catch (e) { return []; } }
  function noteer(w) {
    var l = lees().concat([{ taak: w.taak, uitvoerder: w.uitvoerder, rekenMs: w.rekenMs, op: Date.now() }]).slice(-MAX);
    try { localStorage.setItem(SLEUTEL, JSON.stringify(l)); } catch (e) { /* vol of dicht: dan leert de planner niets */ }
  }

  /* Trager bij herhaling: de laatste drie keer gemiddeld meer dan anderhalf
     keer zo traag als de eerste drie, voor dezelfde taak en uitvoerder. Te
     weinig waarnemingen is geen "niet vertraagd" maar "niet te zeggen". */
  function vertraagd(taak, uitvoerder) {
    var l = lees().filter(function (w) { return w.taak === taak && w.uitvoerder === uitvoerder; });
    if (l.length < 6) return null;
    var gem = function (a) { return a.reduce(function (s, w) { return s + w.rekenMs; }, 0) / a.length; };
    return gem(l.slice(-3)) > 1.5 * gem(l.slice(0, 3));
  }

  root.RTGToestelMeting = Object.freeze({ feiten: feiten, noteer: noteer, vertraagd: vertraagd, waarnemingen: lees });
}(typeof globalThis !== 'undefined' ? globalThis : this));
