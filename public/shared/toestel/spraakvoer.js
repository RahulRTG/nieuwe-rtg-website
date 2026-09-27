/* SPRAAK NAAR TEKST, DE OUDERKANT -- het taakcontract spraak.naartekst.
   TOESTEL.md par. 11.

   Deze module kiest niets en vertrouwt niets zelf. Ze krijgt de artefacten
   (bytes plus manifestregel, uit ./opslag.js) en doet dan:

     1. de vier gegevensbestanden van het model (vocabulaire, speciale tokens,
        configuratie, generatie-instelling) langs DEZELFDE grendel als het
        model (./manifest.js): een tokenizer die niet klopt, maakt van een goed
        model een leugenaar;
     2. het spectrogram maken (./spraak.js), hier en niet op de server;
     3. de cel laten rekenen (./rekenaar.js, uitvoerder `whisper`), met
        runtime, encoder en decoder, die de rekenaar zelf door de grendel haalt;
     4. de token-id's terugvertalen naar tekst.

   Uit komt { ok, tekst, herkomst } of een weigering met de stap erbij. De
   herkomst is die van de rekenaar plus de gegevensbestanden, zodat onder de
   tekst kan staan welke bytes hem maakten. Er gaat niets naar RTG.
   In de browser window.RTGToestelSpraakVoer. */
(function (root) {
  'use strict';
  var CONTRACT = 'spraak.naartekst';
  var GEGEVENS = ['vocab', 'speciaal', 'config', 'generatie'];
  var MODEL = ['runtime', 'runtimeWasm', 'encoder', 'decoder'];

  function weiger(stap, reden) { return { ok: false, stap: stap, reden: reden }; }

  async function naarTekst(o) {
    var M = root.RTGToestelManifest, S = root.RTGToestelSpraak, R = root.RTGToestelRekenaar;
    if (!M || !S || !R) return weiger('grendel', 'de spraaklaag is niet volledig geladen; dan wordt niets uitgevoerd');
    var art = o.artefacten || {}, sleutels = o.sleutels || root.RTGToestelSleutels || [], json = {}, herkomst = [];
    for (var i = 0; i < GEGEVENS.length; i++) {
      var rol = GEGEVENS[i], a = art[rol];
      var u = await M.controleer(a && a.regel, { sleutels: sleutels, bytes: a && a.bytes, contract: CONTRACT });
      if (!u.ok) return weiger(u.stap, rol + ': ' + u.reden);
      try { json[rol] = JSON.parse(new TextDecoder('utf-8').decode(new Uint8Array(a.bytes))); }
      catch (e) { return weiger('gegevens', rol + ' is geen geldige JSON'); }
      herkomst.push({ rol: rol, id: a.regel.id, versie: a.regel.versie, sha256: a.regel.sha256 });
    }
    var prompt;
    try { prompt = S.prompt(json.speciaal, o.taal || 'nl'); } catch (e) { return weiger('taal', e.message); }
    var c = json.config, g = json.generatie;
    var mel = S.logMel(S.herbemonster(o.monsters, o.hz || S.HZ));
    var model = {};
    MODEL.forEach(function (r) { if (art[r]) model[r] = art[r]; });
    var uit = await R.voer({ contract: o.contract || { taak: CONTRACT, last: { rekenMaxMs: 120000 } },
      kandidaat: o.kandidaat, artefacten: model, sleutels: sleutels,
      invoer: { mel: mel, prompt: prompt, eot: S.EOT, maxTokens: o.maxTokens,
        onderdruk: g.suppress_tokens || [], onderdrukBegin: g.begin_suppress_tokens || [],
        vorm: { lagen: c.decoder_layers, koppen: c.decoder_attention_heads, dim: c.d_model / c.decoder_attention_heads } } });
    if (!uit.ok) return uit;
    uit.herkomst.artefacten = uit.herkomst.artefacten.concat(herkomst);
    return { ok: true, tekst: S.tekst(uit.uitkomst.tokens, json.vocab), afgekapt: !!uit.uitkomst.afgekapt,
      herkomst: uit.herkomst };
  }

  root.RTGToestelSpraakVoer = Object.freeze({ CONTRACT: CONTRACT, GEGEVENS: GEGEVENS, MODEL: MODEL, naarTekst: naarTekst });
}(typeof globalThis !== 'undefined' ? globalThis : this));
