/* DE ARTEFACTOPSLAG OP HET TOESTEL -- TOESTEL.md par. 3.4 en besluit 5.

   Modellen en uitvoerders staan in de prive-opslag van de browser (OPFS), in
   een eigen map naast de Toestelkluis en niet erin: daar staan de papieren van
   het lid. Het adres is de sha256, dus een bestand kan niet stil van inhoud
   wisselen onder dezelfde naam.

   NIETS ZONDER DE MENS (besluit 5, 25 september 2026). `haal()` downloadt
   alleen met een toestemming die bij een TIK hoort (`doorLid: true`), en op een
   mobiele verbinding -- of een verbinding die de browser niet laat zien, want
   dan is de strengste aanname mobiel -- alleen als het lid dat nog eens heeft
   bevestigd (`mobielBevestigd: true`). Het scherm dat de tik vraagt, toont
   vooraf wat het doet, hoe groot het is en wat er daarna op het toestel blijft.

   HERVATTEN. Een onderbroken download blijft staan als <sha>.deel en gaat
   verder met een Range-verzoek. Pas als de sha256 klopt, wordt hij <sha>;
   klopt hij niet, dan gaat het deel weg en is de uitslag nee. Een half bestand
   wordt nooit geladen.
   In de browser window.RTGToestelOpslag. */
(function (root) {
  'use strict';
  var MAP = 'toestel-artefacten';
  var GEBRUIK = 'rtg-toestel-gebruik'; // laatst gebruikt per sha, voor opruimen

  function kan() { return !!(root.navigator && navigator.storage && navigator.storage.getDirectory); }
  async function map() {
    var w = await navigator.storage.getDirectory();
    try { await navigator.storage.persist(); } catch (e) { /* zonder persistentie werkt het ook, alleen minder vast */ }
    return w.getDirectoryHandle(MAP, { create: true });
  }
  function verbinding() {
    var c = root.navigator && navigator.connection;
    if (!c || !c.type) return 'onbekend';
    return c.type === 'cellular' ? 'mobiel' : c.type === 'wifi' || c.type === 'ethernet' ? 'vast' : 'onbekend';
  }
  function merk(sha) {
    try { var m = JSON.parse(localStorage.getItem(GEBRUIK) || '{}'); m[sha] = Date.now();
      localStorage.setItem(GEBRUIK, JSON.stringify(m)); } catch (e) { /* alleen de volgorde van opruimen */ }
  }
  async function bestand(d, naam) {
    try { return await (await d.getFileHandle(naam)).getFile(); } catch (e) { return null; }
  }

  /* De bytes als ze er al zijn en de grootte klopt, anders null. De hash
     controleert de grendel (./manifest.js) bij het laden, niet deze functie. */
  async function heb(regel) {
    if (!kan() || !regel) return null;
    var f = await bestand(await map(), regel.sha256);
    if (!f || f.size !== regel.grootte) return null;
    merk(regel.sha256);
    return f.arrayBuffer();
  }

  async function haal(regel, toestemming, opts) {
    var o = opts || {}, t = toestemming || {};
    if (!kan()) return { ok: false, reden: 'deze browser heeft geen prive-opslag (OPFS); er kan niets op het toestel staan' };
    if (!regel || !/^[0-9a-f]{64}$/.test(regel.sha256 || '')) return { ok: false, reden: 'geen geldige manifestregel' };
    var al = await heb(regel);
    if (al) return { ok: true, bytes: al, gedownload: false };
    if (t.doorLid !== true) return { ok: false, reden: 'downloaden gebeurt alleen na een tik van het lid', vraag: 'toestemming' };
    var v = verbinding();
    if (v !== 'vast' && t.mobielBevestigd !== true)
      return { ok: false, vraag: 'mobiel', verbinding: v, reden: v === 'mobiel'
        ? 'u bent mobiel verbonden; bevestig nog eens dat u ' + regel.grootte + ' bytes wilt downloaden'
        : 'deze browser laat niet zien of u mobiel verbonden bent; bevestig nog eens dat u ' + regel.grootte + ' bytes wilt downloaden' };
    var d = await map(), deelNaam = regel.sha256 + '.deel';
    var deel = await bestand(d, deelNaam), start = deel ? deel.size : 0;
    var r = await fetch((o.basis || '') + '/toestel/artefact/' + regel.sha256,
      { headers: start ? { Range: 'bytes=' + start + '-' } : {} });
    if (start && r.status !== 206) start = 0; // geen hervatting: dan opnieuw vanaf het begin
    else if (!r.ok) return { ok: false, reden: 'de server gaf ' + r.status + ' voor dit artefact' };
    var h = await d.getFileHandle(deelNaam, { create: true });
    var w = await h.createWritable({ keepExistingData: start > 0 });
    if (start) await w.seek(start);
    await r.body.pipeTo(w);
    var heel = await (await h.getFile()).arrayBuffer();
    var sha = root.RTGToestelManifest ? await root.RTGToestelManifest.sha256(heel) : null;
    await d.removeEntry(deelNaam);
    if (heel.byteLength !== regel.grootte || sha !== regel.sha256)
      return { ok: false, reden: 'de download klopt niet met het manifest (grootte of sha256); hij is weggegooid' };
    var def = await (await d.getFileHandle(regel.sha256, { create: true })).createWritable();
    await def.write(heel); await def.close();
    merk(regel.sha256);
    return { ok: true, bytes: heel, gedownload: true, hervat: start > 0 };
  }

  /* Wat er staat, zodat het lid het ziet en zelf kan wissen. */
  async function lijst() {
    if (!kan()) return [];
    var d = await map(), uit = [];
    for await (var paar of d.entries()) {
      if (paar[1].kind !== 'file') continue;
      var f = await paar[1].getFile();
      uit.push({ naam: paar[0], grootte: f.size, deel: /\.deel$/.test(paar[0]) });
    }
    return uit;
  }
  async function wis(sha) {
    if (!kan()) return false;
    var d = await map();
    try { await d.removeEntry(sha); } catch (e) { return false; }
    return true;
  }

  root.RTGToestelOpslag = Object.freeze({ heb: heb, haal: haal, lijst: lijst, wis: wis, verbinding: verbinding });
}(typeof globalThis !== 'undefined' ? globalThis : this));
