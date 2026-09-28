/* TEKST NAAR VECTOR OP HET TOESTEL -- het tweede echte taakcontract.
   TOESTEL.md par. 12.

   Net als ./spraak.js rekent deze module NIET met een model: dat doet de cel,
   met de algemene uitvoerder `onnx` die er al was. Een tweede contract zonder
   nieuwe uitvoerder is precies wat par. 0 belooft: een model is geen
   infrastructuur, het taakcontract wel. Hier staat alleen wat vóór en na het
   model zeker moet zijn:

     normaliseer()  BertNormalizer: stuurtekens weg, witruimte gelijk, CJK los,
                    kleine letters en accenten weg (strip_accents volgt lowercase)
     tokens()       BertPreTokenizer + WordPiece: grootste passende stuk eerst,
                    `##` voor een vervolg, [UNK] als een woord niet te knippen is
     invoer()       per tekst een eigen run: [CLS] ... [SEP] met masker en
                    segment-id's als BigInt64; nooit een batch (zie invoer)
     pool()         het gemiddelde over de tokens, daarna lengte 1 -- zoals
                    sentence-transformers het traint
     cosinus()      op genormaliseerde vectoren gewoon het inproduct

   Afkappen gebeurt NOOIT stil: wie meer tokens heeft dan het model draagt,
   krijgt `afgekapt: true` terug bij die tekst. Een vector over de eerste helft
   van een brief is een andere vector dan over de brief, en wie zoekt hoort dat
   te weten.
   Puur. In de browser window.RTGToestelVector, in Node via require. */
(function (root, fabriek) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = fabriek();
  else root.RTGToestelVector = fabriek();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function isCjk(c) {
    return (c >= 0x4E00 && c <= 0x9FFF) || (c >= 0x3400 && c <= 0x4DBF) || (c >= 0x20000 && c <= 0x2A6DF) ||
      (c >= 0x2A700 && c <= 0x2B73F) || (c >= 0x2B740 && c <= 0x2B81F) || (c >= 0x2B820 && c <= 0x2CEAF) ||
      (c >= 0xF900 && c <= 0xFAFF) || (c >= 0x2F800 && c <= 0x2FA1F);
  }
  /* Zoals BERT het ziet: ASCII-leestekens tellen altijd, ook $ + < = > ^ ` | ~,
     die Unicode geen leesteken noemt. */
  function isLeesteken(ch) {
    var c = ch.codePointAt(0);
    if ((c >= 33 && c <= 47) || (c >= 58 && c <= 64) || (c >= 91 && c <= 96) || (c >= 123 && c <= 126)) return true;
    return /\p{P}/u.test(ch);
  }
  function isWit(ch) { return ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r' || /\p{Zs}/u.test(ch); }
  function isStuur(ch) {
    if (ch === '\t' || ch === '\n' || ch === '\r') return false;
    return /\p{Cc}|\p{Cf}/u.test(ch);
  }

  function normaliseer(tekst) {
    var uit = '';
    for (var ch of String(tekst)) {
      var c = ch.codePointAt(0);
      if (c === 0 || c === 0xFFFD || isStuur(ch)) continue;
      if (isWit(ch)) { uit += ' '; continue; }
      uit += isCjk(c) ? ' ' + ch + ' ' : ch;
    }
    return uit.toLowerCase().normalize('NFD').replace(/\p{Mn}/gu, '');
  }

  function voorknip(tekst) {
    var stukken = [], huidig = '';
    for (var ch of tekst) {
      if (ch === ' ') { if (huidig) stukken.push(huidig); huidig = ''; continue; }
      if (isLeesteken(ch)) { if (huidig) stukken.push(huidig); stukken.push(ch); huidig = ''; continue; }
      huidig += ch;
    }
    if (huidig) stukken.push(huidig);
    return stukken;
  }

  function woordStukken(woord, vocab) {
    var tekens = Array.from(woord);
    if (tekens.length > 100) return ['[UNK]'];
    var uit = [], begin = 0;
    while (begin < tekens.length) {
      var eind = tekens.length, gevonden = null;
      while (begin < eind) {
        var stuk = (begin > 0 ? '##' : '') + tekens.slice(begin, eind).join('');
        if (Object.prototype.hasOwnProperty.call(vocab, stuk)) { gevonden = stuk; break; }
        eind--;
      }
      if (gevonden === null) return ['[UNK]']; // het HELE woord, niet een stuk ervan
      uit.push(gevonden);
      begin = eind;
    }
    return uit;
  }

  function tokens(tekst, vocab) {
    var uit = [];
    voorknip(normaliseer(tekst)).forEach(function (w) { uit.push.apply(uit, woordStukken(w, vocab)); });
    return uit;
  }

  /* Uit: een REEKS runs voor de uitvoerder `onnx`, een per tekst, plus per
     tekst of hij is afgekapt. Geen batch: in een batch krijgt dezelfde zin een
     andere vector naast een andere buur (cos 0,993 gemeten, par. 12). */
  function invoer(teksten, vocab, maxTokens) {
    var max = maxTokens || 256, reeks = [], afgekapt = [];
    teksten.forEach(function (t) {
      var ids = tokens(t, vocab).map(function (w) { return vocab[w]; });
      afgekapt.push(ids.length > max - 2);
      var r = [vocab['[CLS]']].concat(ids.slice(0, max - 2), [vocab['[SEP]']]), L = r.length;
      var id = new BigInt64Array(L), masker = new BigInt64Array(L), segment = new BigInt64Array(L);
      for (var j = 0; j < L; j++) { id[j] = BigInt(r[j]); masker[j] = 1n; }
      reeks.push({
        input_ids: { type: 'int64', data: id, dims: [1, L] },
        attention_mask: { type: 'int64', data: masker, dims: [1, L] },
        token_type_ids: { type: 'int64', data: segment, dims: [1, L] }
      });
    });
    return { reeks: reeks, afgekapt: afgekapt };
  }

  /* last_hidden_state [1, L, d] -> een vector van lengte 1: het gemiddelde over
     de tokens, zoals sentence-transformers het traint. */
  function pool(tensor) {
    var L = tensor.dims[1], d = tensor.dims[2], v = new Float32Array(d), som = 0, k;
    for (var j = 0; j < L; j++) for (k = 0; k < d; k++) v[k] += tensor.data[j * d + k];
    for (k = 0; k < d; k++) { v[k] /= L; som += v[k] * v[k]; }
    var norm = Math.max(Math.sqrt(som), 1e-12);
    for (k = 0; k < d; k++) v[k] /= norm;
    return v;
  }

  function cosinus(a, b) {
    var s = 0;
    for (var i = 0; i < a.length; i++) s += a[i] * b[i];
    return s;
  }

  return Object.freeze({ normaliseer: normaliseer, voorknip: voorknip, tokens: tokens, invoer: invoer,
    pool: pool, cosinus: cosinus });
}));
