/* DE ZOEKINDEX VAN DE TOESTELKLUIS -- TOESTEL.md par. 14.

   De Toestelkluis (../toestelkluis.js) bewaart de papieren van het lid in de
   prive-opslag van de browser. Deze module legt er een INDEX naast: per document
   een vector (uit ./vectorvoer.js), zodat het lid kan zoeken op wat er staat en
   niet alleen op de bestandsnaam. Er komt geen tweede kluis: de index verwijst
   naar een document op naam en bezit het niet.

   EEN INDEX PER VINGERAFDRUK. Een vector is alleen vergelijkbaar met een vector
   van dezelfde runtime, hetzelfde model en dezelfde tokenizer (par. 12.1:
   cosinus 0,993 tussen twee runtimes op dezelfde bytes). Een vraag met een
   andere vingerafdruk wordt daarom GEWEIGERD met de reden, en nooit tegen een
   index van een ander model gehouden; bijwerken naar een nieuw model is opnieuw
   berekenen, niet vergelijken.

   DE KLUIS IS DE WAARHEID. Een document dat uit de kluis is gewist, valt bij het
   zoeken weg en wordt geteld (`weg`); een document zonder vector wordt ook
   geteld (`zonderVector`). Een zoekuitslag die niet zegt wat hij niet
   doorzocht, laat het lid denken dat iets er niet is.

   EEN VECTOR IS ZO GEVOELIG ALS ZIJN TEKST. Uit een vector valt de tekst voor
   een deel terug te rekenen, dus hij staat onder dezelfde bescherming als het
   document (OPFS van deze origin), verlaat het toestel niet, en gaat weg met
   `vergeet()`. Hij wordt NIET apart versleuteld: de documenten zelf zijn dat
   ook niet, en een sleutel die dezelfde pagina kan gebruiken voegt alleen
   schijn toe.
   In de browser window.RTGToestelKluisIndex. */
(function (root) {
  'use strict';
  var MAP = 'kluis-index';

  function kan() { return !!(root.navigator && navigator.storage && navigator.storage.getDirectory); }
  async function map() { return (await navigator.storage.getDirectory()).getDirectoryHandle(MAP, { create: true }); }
  function geldigeVingerafdruk(v) { return /^[0-9a-f]{64}$/.test(String(v || '')); }
  function b64(f32) {
    var b = new Uint8Array(f32.buffer, f32.byteOffset, f32.byteLength), s = '';
    for (var i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
    return btoa(s);
  }
  function vanB64(t) {
    var s = atob(t), b = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i++) b[i] = s.charCodeAt(i);
    return new Float32Array(b.buffer);
  }

  async function lees(vingerafdruk) {
    try {
      var f = await (await (await map()).getFileHandle(vingerafdruk + '.json')).getFile();
      return JSON.parse(await f.text());
    } catch (e) { return null; }
  }
  async function schrijf(index) {
    var h = await (await map()).getFileHandle(index.vingerafdruk + '.json', { create: true });
    var w = await h.createWritable();
    await w.write(JSON.stringify(index));
    await w.close();
  }

  /* items: [{ naam, vector }]. Een document met dezelfde naam wordt vervangen. */
  async function voegToe(vingerafdruk, items) {
    if (!kan()) return { ok: false, reden: 'deze browser heeft geen prive-opslag (OPFS)' };
    if (!geldigeVingerafdruk(vingerafdruk)) return { ok: false, reden: 'een index zonder geldige vingerafdruk is niet te vergelijken' };
    var index = (await lees(vingerafdruk)) || { vingerafdruk: vingerafdruk, dim: null, items: {} };
    for (var i = 0; i < (items || []).length; i++) {
      var it = items[i], v = it && it.vector;
      if (!it || !it.naam || !(v instanceof Float32Array)) return { ok: false, reden: 'een item heeft een naam en een Float32Array nodig' };
      if (index.dim === null) index.dim = v.length;
      if (v.length !== index.dim) return { ok: false, reden: 'deze index heeft vectoren van ' + index.dim + ' getallen, niet ' + v.length };
    }
    (items || []).forEach(function (it) { index.items[it.naam] = { v: b64(it.vector), at: Date.now() }; });
    await schrijf(index);
    return { ok: true, aantal: Object.keys(index.items).length };
  }

  /* De kluis wordt bij elke zoekvraag gelezen: wat daar niet meer staat, doet
     niet mee en wordt geteld. */
  async function zoek(vingerafdruk, vraag, k) {
    if (!kan()) return { ok: false, reden: 'deze browser heeft geen prive-opslag (OPFS)' };
    var index = geldigeVingerafdruk(vingerafdruk) ? await lees(vingerafdruk) : null;
    if (!index) {
      var andere = (await stand()).map(function (s) { return s.vingerafdruk; });
      return { ok: false, stap: 'vingerafdruk', reden: andere.length
        ? 'er is geen index van dit model; de index op dit toestel is van een ander model en moet opnieuw worden berekend'
        : 'er is nog geen zoekindex op dit toestel', andere: andere };
    }
    if (!(vraag instanceof Float32Array) || vraag.length !== index.dim) return { ok: false, stap: 'vorm', reden: 'de vraag heeft niet de vorm van deze index' };
    var inKluis = new Set(((root.Toestelkluis && await root.Toestelkluis.lijst()) || []).map(function (d) { return d.naam; }));
    var treffers = [], weg = 0;
    Object.keys(index.items).forEach(function (naam) {
      if (!inKluis.has(naam)) { weg++; return; }
      var v = vanB64(index.items[naam].v), s = 0;
      for (var i = 0; i < v.length; i++) s += v[i] * vraag[i];
      treffers.push({ naam: naam, score: s });
    });
    treffers.sort(function (a, b) { return b.score - a.score || (a.naam < b.naam ? -1 : 1); });
    var zonderVector = 0;
    inKluis.forEach(function (naam) { if (!index.items[naam]) zonderVector++; });
    return { ok: true, treffers: treffers.slice(0, k || 5), doorzocht: treffers.length, weg: weg, zonderVector: zonderVector };
  }

  /* Een document uit ELKE index halen: het lid wist iets, en dan gaat zijn
     vector mee, ook die van een oud model. */
  async function vergeet(naam) {
    if (!kan()) return { ok: false };
    var n = 0;
    for (var s of await stand()) {
      var index = await lees(s.vingerafdruk);
      if (index && index.items[naam]) { delete index.items[naam]; await schrijf(index); n++; }
    }
    return { ok: true, indexen: n };
  }

  async function stand() {
    if (!kan()) return [];
    var uit = [];
    for await (var [naam, h] of (await map()).entries()) {
      if (h.kind !== 'file' || !/\.json$/.test(naam)) continue;
      var index = await lees(naam.slice(0, -5));
      if (index) uit.push({ vingerafdruk: index.vingerafdruk, dim: index.dim, aantal: Object.keys(index.items).length });
    }
    return uit;
  }

  async function wis(vingerafdruk) {
    if (!kan()) return { ok: false };
    try { await (await map()).removeEntry(vingerafdruk + '.json'); return { ok: true }; } catch (e) { return { ok: false }; }
  }

  root.RTGToestelKluisIndex = Object.freeze({ voegToe: voegToe, zoek: zoek, vergeet: vergeet, stand: stand, wis: wis });
}(typeof globalThis !== 'undefined' ? globalThis : this));
