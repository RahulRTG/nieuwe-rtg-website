/* TEKST NAAR VECTOR, DE OUDERKANT -- het taakcontract tekst.vector.
   TOESTEL.md par. 12.

   Zelfde vorm als ./spraakvoer.js, en met opzet GEEN eigen uitvoerder: de cel
   draait dit model met de algemene uitvoerder `onnx`, in een reeks runs.

     1. de tokenizer (tokenizer.json) langs DEZELFDE grendel als het model;
     2. per tekst een run maken (./vector.js), hier en niet op de server;
     3. de cel laten rekenen (./rekenaar.js), die runtime en model zelf door
        de grendel haalt;
     4. per tekst middelen en normaliseren.

   Uit komt { ok, vectoren, afgekapt, vingerafdruk, herkomst }. De
   VINGERAFDRUK is de sha256 van runtime, model en tokenizer samen, en hij is
   er omdat het gemeten nodig is: hetzelfde model met dezelfde tokens gaf in de
   browser en in Python een cosinus van 0,993 tot 1,000. Een index mag dus
   alleen vectoren met DEZELFDE vingerafdruk naast elkaar leggen; een vector van
   een ander toestel of een andere runtime wordt opnieuw berekend, niet
   vergeleken. Er gaat niets naar RTG.
   In de browser window.RTGToestelVectorVoer. */
(function (root) {
  'use strict';
  var CONTRACT = 'tekst.vector';
  var MODEL = ['runtime', 'runtimeWasm', 'model'];

  function weiger(stap, reden) { return { ok: false, stap: stap, reden: reden }; }

  async function sha(tekst) {
    var h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(tekst));
    return Array.from(new Uint8Array(h)).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
  }

  async function naarVectoren(o) {
    var M = root.RTGToestelManifest, V = root.RTGToestelVector, R = root.RTGToestelRekenaar;
    if (!M || !V || !R) return weiger('grendel', 'de vectorlaag is niet volledig geladen; dan wordt niets uitgevoerd');
    var teksten = o.teksten || [];
    if (!teksten.length) return weiger('invoer', 'er is geen tekst om een vector van te maken');
    var art = o.artefacten || {}, sleutels = o.sleutels || root.RTGToestelSleutels || [];
    var t = art.tokenizer;
    var u = await M.controleer(t && t.regel, { sleutels: sleutels, bytes: t && t.bytes, contract: CONTRACT });
    if (!u.ok) return weiger(u.stap, 'tokenizer: ' + u.reden);
    var vocab;
    try { vocab = JSON.parse(new TextDecoder('utf-8').decode(new Uint8Array(t.bytes))).model.vocab; }
    catch (e) { vocab = null; }
    if (!vocab || vocab['[CLS]'] === undefined) return weiger('gegevens', 'de tokenizer heeft geen WordPiece-vocabulaire');
    var inv = V.invoer(teksten, vocab, o.maxTokens);
    var model = {};
    MODEL.forEach(function (r) { if (art[r]) model[r] = art[r]; });
    var uit = await R.voer({ contract: o.contract || { taak: CONTRACT, last: { rekenMaxMs: 60000 } },
      kandidaat: o.kandidaat, artefacten: model, sleutels: sleutels, invoer: { reeks: inv.reeks } });
    if (!uit.ok) return uit;
    var herkomst = uit.herkomst;
    herkomst.artefacten = herkomst.artefacten.concat([{ rol: 'tokenizer', id: t.regel.id, versie: t.regel.versie, sha256: t.regel.sha256 }]);
    var vingerafdruk = await sha(herkomst.artefacten.map(function (a) { return a.rol + '=' + a.sha256; }).sort().join('\n'));
    return { ok: true, vectoren: uit.uitkomst.reeks.map(function (r) { return V.pool(r.last_hidden_state); }),
      afgekapt: inv.afgekapt, vingerafdruk: vingerafdruk, herkomst: herkomst };
  }

  root.RTGToestelVectorVoer = Object.freeze({ CONTRACT: CONTRACT, naarVectoren: naarVectoren });
}(typeof globalThis !== 'undefined' ? globalThis : this));
