/* HET MODELMANIFEST ALS GRENDEL -- TOESTEL.md par. 9.3.

   Een artefact (een model of een uitvoerder, zoals de ONNX-runtime) is pas
   uitvoerbaar als zijn manifestregel alle vijf stappen haalt, in deze volgorde,
   en elke stap weigert:

     1. sleutel       de sleutel-id staat in de vertrouwde lijst en is niet ingetrokken
     2. handtekening  Ed25519 over RTG:MODEL:v1 + de canonieke regel klopt
     3. hash          de bytes hebben de sha256 en de grootte uit de regel
     4. licentie      de licentie staat in ./licenties.js
     5. contract      de regel is toegelaten voor het gevraagde taakcontract

   DRIE SLEUTELSTANDEN, en ze zijn met opzet niet twee:
     actief        controleert, en er mag mee worden getekend
     uitgefaseerd  controleert nog, er wordt niet meer mee getekend
     ingetrokken   controleert NIETS meer

   Waarom intrekken alles raakt wat onder de sleutel viel en niet "wat na datum
   X getekend is": een handtekening draagt geen betrouwbaar tijdstip. Wie de
   private sleutel heeft, zet er elke datum op. Een ingetrokken sleutel maakt
   dus al zijn artefacten onlaadbaar tot ze opnieuw zijn ondertekend.

   EEN EIGEN VERTROUWENSDOMEIN. Het voorvoegsel RTG:MODEL:v1 volgt de vorm van
   server/config/release-trust.js (RTG:BUILD:v1, RTG:EXTERNAL-EVIDENCE:v1,
   RTG:PROMOTION:v1), zodat een handtekening uit een andere rol hier nooit geldt
   -- en deze sleutel staat daar met opzet NIET als vierde rol.

   WAT DIT NIET BESCHERMT. Een aangetaste RTG-origin die ook deze code levert,
   kan deze controle vervangen. De handtekening beschermt tegen een
   gemanipuleerde opslag of spiegel, niet tegen een gecompromitteerde server.

   Controle gebeurt met WebCrypto Ed25519. Kan de omgeving dat niet, dan is het
   antwoord nee -- nooit "vertrouw de hash dan maar".
   Puur. In de browser window.RTGToestelManifest, in Node via require. */
(function (root, fabriek) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = fabriek(require('./licenties.js'));
  else root.RTGToestelManifest = fabriek(root.RTGToestelLicenties);
}(typeof globalThis !== 'undefined' ? globalThis : this, function (Licenties) {
  'use strict';

  var DOMEIN = 'RTG:MODEL:v1';
  var STANDEN = Object.freeze(['actief', 'uitgefaseerd', 'ingetrokken']);
  /* De velden die de handtekening dekt. Een veld dat hier niet staat, telt
     niet mee -- en wordt daarom ook nooit gelezen als iets dat vaststaat. */
  var GETEKEND = Object.freeze(['id', 'versie', 'soort', 'sha256', 'grootte', 'licentie', 'bron',
    'naamsvermelding', 'contracten', 'kwaliteit', 'sleutel']);

  function subtle() { var c = typeof globalThis !== 'undefined' && globalThis.crypto; return c && c.subtle || null; }

  /* Canoniek: gesorteerde sleutels, geen witruimte. Twee kanten moeten exact
     dezelfde bytes tekenen en controleren. */
  function canoniek(w) {
    if (Array.isArray(w)) return '[' + w.map(canoniek).join(',') + ']';
    if (w && typeof w === 'object') return '{' + Object.keys(w).sort().map(function (k) {
      return JSON.stringify(k) + ':' + canoniek(w[k]); }).join(',') + '}';
    return JSON.stringify(w === undefined ? null : w);
  }
  function tekst(regel) {
    var o = {};
    GETEKEND.forEach(function (k) { if (regel && regel[k] !== undefined) o[k] = regel[k]; });
    return DOMEIN + '\u0000' + canoniek(o);
  }
  function bytes(s) { return new TextEncoder().encode(s); }
  function vanBase64(b) {
    var s = atob(String(b || '')), u = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
    return u;
  }
  function hex(buf) {
    return Array.prototype.map.call(new Uint8Array(buf), function (x) { return ('0' + x.toString(16)).slice(-2); }).join('');
  }
  async function sha256(data) { return hex(await subtle().digest('SHA-256', data)); }

  function weiger(stap, reden) { return { ok: false, stap: stap, reden: reden }; }

  async function controleer(regel, opts) {
    var o = opts || {}, s = subtle();
    if (!s) return weiger('sleutel', 'deze omgeving heeft geen WebCrypto; dan wordt niets geladen');
    if (!regel || typeof regel !== 'object') return weiger('sleutel', 'geen manifestregel');
    /* 1. sleutel */
    var sleutel = (o.sleutels || []).filter(function (k) { return k && k.id === regel.sleutel; })[0];
    if (!sleutel) return weiger('sleutel', 'de sleutel ' + regel.sleutel + ' staat niet in de vertrouwde lijst');
    if (STANDEN.indexOf(sleutel.stand) < 0) return weiger('sleutel', 'de sleutel heeft geen geldige stand');
    if (sleutel.stand === 'ingetrokken')
      return weiger('sleutel', 'de sleutel is ingetrokken; alles wat eronder viel moet opnieuw ondertekend worden');
    /* 2. handtekening */
    var goed = false;
    try {
      var pub = await s.importKey('raw', vanBase64(sleutel.publiek), { name: 'Ed25519' }, false, ['verify']);
      goed = await s.verify({ name: 'Ed25519' }, pub, vanBase64(regel.handtekening), bytes(tekst(regel)));
    } catch (e) { return weiger('handtekening', 'Ed25519 is hier niet te controleren; dan wordt niets geladen'); }
    if (!goed) return weiger('handtekening', 'de handtekening klopt niet met de regel');
    /* 3. hash (alleen als de bytes er zijn; zonder bytes is de regel alleen
       als belofte gecontroleerd, en dat zegt de uitslag) */
    if (o.bytes !== undefined) {
      var n = o.bytes.byteLength;
      if (n !== regel.grootte) return weiger('hash', 'de grootte is ' + n + ' en niet ' + regel.grootte);
      if (await sha256(o.bytes) !== regel.sha256) return weiger('hash', 'de inhoud heeft niet de sha256 uit het manifest');
    }
    /* 4. licentie */
    var l = Licenties.keur(regel.licentie);
    if (!l.mag) return weiger('licentie', l.reden);
    /* 5. contract */
    if (o.contract && (regel.contracten || []).indexOf(o.contract) < 0)
      return weiger('contract', 'dit artefact is niet toegelaten voor ' + o.contract);
    return { ok: true, bytesGecontroleerd: o.bytes !== undefined, eisen: l.eisen,
      naamsvermelding: regel.naamsvermelding || null, sleutelStand: sleutel.stand };
  }

  /* Met welke sleutel mag een NIEUWE regel worden getekend? Alleen actief. */
  function magTekenen(sleutel) { return !!sleutel && sleutel.stand === 'actief'; }

  return Object.freeze({ DOMEIN: DOMEIN, STANDEN: STANDEN, GETEKEND: GETEKEND,
    tekst: tekst, sha256: sha256, controleer: controleer, magTekenen: magTekenen });
}));
