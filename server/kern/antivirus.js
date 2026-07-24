/* Kern-module "De Ontsmetter": de eigen malware-scanner van RTG.

   EERLIJK over wat dit is: dit is GEEN kernel-antivirus die de computer van een
   bezoeker scant -- dat is een ander soort product en dat zouden we niet waar
   kunnen maken. Dit is de best mogelijke afweer voor het PLATFORM zelf: elk
   bestand en elke payload die RTG binnenkomt (paspoortfoto's, selfies, uploads)
   wordt gescand met dezelfde technieken die een echte antivirus gebruikt --
   handtekeningen, heuristiek en entropie -- en besmette of verdachte inhoud
   wordt geweigerd, in quarantaine gezet en op het boardroom-bord gemeld.

   Technieken:
   1. HANDTEKENINGEN (updatebare definities): bekende kwaadaardige byte- en
      tekstpatronen -- de EICAR-testhandtekening (de industriestandaard om een
      scanner te testen), uitvoerbare-bestand-magie (PE/MZ, ELF, Mach-O), scripts
      verstopt in afbeeldingen (<?php, <script), webshell-patronen
      (eval(base64_decode, shell_exec, ...) en gevaarlijke PDF-/macro-tokens.
   2. HEURISTIEK: magie-vs-opgegeven-type (een "png" die in werkelijkheid een
      .exe is), dubbele extensie (foto.jpg.exe), gevaarlijke extensie.
   3. ENTROPIE: Shannon-entropie om verpakte/versleutelde payloads te betrappen
      die zich als iets onschuldigs voordoen.

   De definities zijn DATA (updatebaar): nieuwe handtekeningen toevoegen kan
   zonder codewijziging. Zuiver en testbaar: de kern-scan is een pure functie;
   de fabriek eromheen houdt tellingen bij en meldt op het bord. */
const crypto = require('crypto');

// Magie (begin-bytes) van legitieme beeldformaten -- voor de type-controle.
const BEELD_MAGIE = {
  png: [0x89, 0x50, 0x4e, 0x47],
  jpg: [0xff, 0xd8, 0xff],
  gif: [0x47, 0x49, 0x46, 0x38],
  webp: null // RIFF....WEBP; apart gecontroleerd
};

// De definitielijst (updatebaar). ernst: 'besmet' (hard) of 'verdacht' (zacht).
// type: 'bytes' (hex) of 'tekst' (ascii, overal in het bestand gezocht).
function standaardDefinities() {
  return [
    // --- testhandtekening ---
    { id: 'eicar', naam: 'EICAR-testbestand', ernst: 'besmet', type: 'tekst', patroon: 'EICAR-STANDARD-ANTIVIRUS-TEST-FILE' },
    // --- uitvoerbare bestanden (magie aan het begin) ---
    { id: 'pe', naam: 'Windows-uitvoerbaar (PE/MZ)', ernst: 'besmet', type: 'bytes', waar: 'start', patroon: '4d5a' },
    { id: 'elf', naam: 'Linux-uitvoerbaar (ELF)', ernst: 'besmet', type: 'bytes', waar: 'start', patroon: '7f454c46' },
    { id: 'macho', naam: 'macOS-uitvoerbaar (Mach-O)', ernst: 'besmet', type: 'bytes', waar: 'start', patroon: 'feedface' },
    { id: 'macho64', naam: 'macOS-uitvoerbaar (Mach-O 64)', ernst: 'besmet', type: 'bytes', waar: 'start', patroon: 'feedfacf' },
    { id: 'javaclass', naam: 'Java/uitvoerbaar (CAFEBABE)', ernst: 'besmet', type: 'bytes', waar: 'start', patroon: 'cafebabe' },
    { id: 'dex', naam: 'Android-uitvoerbaar (DEX)', ernst: 'besmet', type: 'bytes', waar: 'start', patroon: '6465780a' },
    { id: 'shebang', naam: 'Shell-script (#!)', ernst: 'verdacht', type: 'bytes', waar: 'start', patroon: '2321' },
    // --- archieven / containers (verdacht als upload; type-mismatch pakt beeld) ---
    { id: 'zip', naam: 'ZIP/JAR/Office-container', ernst: 'verdacht', type: 'bytes', waar: 'start', patroon: '504b0304' },
    { id: 'rar', naam: 'RAR-archief', ernst: 'verdacht', type: 'bytes', waar: 'start', patroon: '526172211a07' },
    { id: '7z', naam: '7-Zip-archief', ernst: 'verdacht', type: 'bytes', waar: 'start', patroon: '377abcaf271c' },
    { id: 'gzip', naam: 'GZIP-archief', ernst: 'verdacht', type: 'bytes', waar: 'start', patroon: '1f8b08' },
    { id: 'ole', naam: 'OLE/Legacy-Office (kan macro dragen)', ernst: 'verdacht', type: 'bytes', waar: 'start', patroon: 'd0cf11e0' },
    // --- scripts verstopt in een bestand (polyglot) ---
    { id: 'php', naam: 'PHP-code in bestand', ernst: 'besmet', type: 'tekst', patroon: '<?php' },
    { id: 'scripttag', naam: 'Script-tag in bestand (polyglot)', ernst: 'besmet', type: 'tekst', patroon: '<script' },
    { id: 'svg-onload', naam: 'SVG/HTML met event-handler (XSS)', ernst: 'besmet', type: 'tekst', patroon: 'onerror=' },
    { id: 'svg-onload2', naam: 'SVG/HTML met onload (XSS)', ernst: 'besmet', type: 'tekst', patroon: 'onload=' },
    { id: 'js-uri', naam: 'javascript:-URI', ernst: 'verdacht', type: 'tekst', patroon: 'javascript:' },
    { id: 'iframe', naam: 'Verborgen iframe', ernst: 'verdacht', type: 'tekst', patroon: '<iframe' },
    // --- PHP-webshells ---
    { id: 'shell-eval', naam: 'Webshell (eval base64)', ernst: 'besmet', type: 'tekst', patroon: 'eval(base64_decode' },
    { id: 'shell-exec', naam: 'Webshell (shell_exec)', ernst: 'besmet', type: 'tekst', patroon: 'shell_exec(' },
    { id: 'shell-system', naam: 'Webshell (system $_)', ernst: 'besmet', type: 'tekst', patroon: 'system($_' },
    { id: 'shell-passthru', naam: 'Webshell (passthru)', ernst: 'besmet', type: 'tekst', patroon: 'passthru(' },
    { id: 'shell-proc', naam: 'Webshell (proc_open)', ernst: 'besmet', type: 'tekst', patroon: 'proc_open(' },
    { id: 'shell-popen', naam: 'Webshell (popen)', ernst: 'besmet', type: 'tekst', patroon: 'popen(' },
    { id: 'shell-assertreq', naam: 'Webshell (assert $_REQUEST)', ernst: 'besmet', type: 'tekst', patroon: 'assert($_REQUEST' },
    { id: 'shell-createfn', naam: 'Webshell (create_function)', ernst: 'besmet', type: 'tekst', patroon: 'create_function(' },
    { id: 'shell-preg-e', naam: 'Webshell (preg_replace /e)', ernst: 'besmet', type: 'tekst', patroon: "preg_replace('/.*/e'" },
    // --- Windows/PowerShell/JS uitvoering ---
    { id: 'ps-enc', naam: 'PowerShell -EncodedCommand', ernst: 'besmet', type: 'tekst', patroon: 'powershell -enc' },
    { id: 'ps-iex', naam: 'PowerShell Invoke-Expression', ernst: 'besmet', type: 'tekst', patroon: 'IEX(' },
    { id: 'ps-frombase64', naam: 'PowerShell FromBase64String', ernst: 'verdacht', type: 'tekst', patroon: 'FromBase64String(' },
    { id: 'wscript', naam: 'WScript.Shell', ernst: 'besmet', type: 'tekst', patroon: 'WScript.Shell' },
    { id: 'cmd-c', naam: 'cmd.exe /c', ernst: 'verdacht', type: 'tekst', patroon: 'cmd.exe /c' },
    { id: 'js-eval-atob', naam: 'JS eval(atob(', ernst: 'besmet', type: 'tekst', patroon: 'eval(atob(' },
    { id: 'js-eval-unescape', naam: 'JS eval(unescape(', ernst: 'besmet', type: 'tekst', patroon: 'eval(unescape(' },
    { id: 'jndi', naam: 'Log4Shell (jndi)', ernst: 'verdacht', type: 'tekst', patroon: '${jndi:' },
    // --- Office-macro's / auto-uitvoering ---
    { id: 'office-vba', naam: 'Office-macro (vbaProject)', ernst: 'verdacht', type: 'tekst', patroon: 'vbaProject.bin' },
    { id: 'macro-autoopen', naam: 'Macro Auto_Open', ernst: 'verdacht', type: 'tekst', patroon: 'Auto_Open' },
    { id: 'macro-docopen', naam: 'Macro Document_Open', ernst: 'verdacht', type: 'tekst', patroon: 'Document_Open' },
    { id: 'macro-wbopen', naam: 'Macro Workbook_Open', ernst: 'verdacht', type: 'tekst', patroon: 'Workbook_Open' },
    // --- PDF-gevaar ---
    { id: 'pdf-js', naam: 'PDF met JavaScript', ernst: 'verdacht', type: 'tekst', patroon: '/JavaScript', mimes: ['application/pdf'] },
    { id: 'pdf-openaction', naam: 'PDF met /OpenAction', ernst: 'verdacht', type: 'tekst', patroon: '/OpenAction', mimes: ['application/pdf'] },
    { id: 'pdf-launch', naam: 'PDF met /Launch-actie', ernst: 'besmet', type: 'tekst', patroon: '/Launch', mimes: ['application/pdf'] },
    { id: 'pdf-embed', naam: 'PDF met ingesloten bestand', ernst: 'verdacht', type: 'tekst', patroon: '/EmbeddedFile', mimes: ['application/pdf'] },
    // --- ransomware-losgeldbriefjes (tekstsignalen) ---
    { id: 'ransom-1', naam: 'Ransomware-notitie (files encrypted)', ernst: 'verdacht', type: 'tekst', patroon: 'YOUR FILES HAVE BEEN ENCRYPTED' },
    { id: 'ransom-2', naam: 'Ransomware-notitie (recover files)', ernst: 'verdacht', type: 'tekst', patroon: 'RECOVER YOUR FILES' },
    { id: 'ransom-3', naam: 'Ransomware-notitie (decrypt readme)', ernst: 'verdacht', type: 'tekst', patroon: 'README_FOR_DECRYPT' }
  ];
}

const GEVAARLIJKE_EXT = new Set(['exe', 'dll', 'scr', 'bat', 'cmd', 'com', 'js', 'jar', 'vbs', 'ps1', 'sh', 'php', 'phtml', 'msi', 'apk']);
const HEX = /^[0-9a-f]+$/i;

function hexNaarBytes(h) {
  const b = [];
  for (let i = 0; i + 1 < h.length; i += 2) b.push(parseInt(h.substr(i, 2), 16));
  return Buffer.from(b);
}

// Shannon-entropie (bits per byte) over een sample.
function entropie(buf) {
  const n = Math.min(buf.length, 65536);
  if (n === 0) return 0;
  const tel = new Array(256).fill(0);
  for (let i = 0; i < n; i++) tel[buf[i]]++;
  let h = 0;
  for (let i = 0; i < 256; i++) {
    if (!tel[i]) continue;
    const p = tel[i] / n;
    h -= p * Math.log2(p);
  }
  return h;
}

function beginMet(buf, bytes) {
  if (buf.length < bytes.length) return false;
  for (let i = 0; i < bytes.length; i++) if (buf[i] !== bytes[i]) return false;
  return true;
}

// Klopt de magie met het opgegeven beeldtype? (alleen voor image/*)
function magieKlopt(buf, mime) {
  const m = /image\/(png|jpe?g|gif|webp)/.exec(String(mime || ''));
  if (!m) return true; // geen beeld: hier niets over zeggen
  const soort = m[1] === 'jpeg' ? 'jpg' : m[1];
  if (soort === 'webp') return buf.length >= 12 && buf.slice(0, 4).toString('latin1') === 'RIFF' && buf.slice(8, 12).toString('latin1') === 'WEBP';
  const magie = BEELD_MAGIE[soort];
  return magie ? beginMet(buf, magie) : true;
}

module.exports = (ctx) => {
  ctx = ctx || {};
  const db = ctx.db || { data: {} };
  const save = ctx.save || function () {};
  const beveilig = ctx.beveilig || null;
  const wacht = ctx.wacht || null; // optioneel: bron in quarantaine voorstellen
  let definities = standaardDefinities();

  function S() {
    if (!db.data.av) db.data.av = { totaal: 0, besmet: 0, verdacht: 0, schoon: 0, laatste: [], versie: 1 };
    return db.data.av;
  }

  /* De pure scan: geef een verdict terug zonder iets te wijzigen.
     verdict: 'schoon' | 'verdacht' | 'besmet'. */
  function scan(buf, meta) {
    meta = meta || {};
    if (!Buffer.isBuffer(buf)) buf = Buffer.from(buf || '');
    const redenen = [];
    let ernst = 'schoon';
    const hef = (e) => { if (e === 'besmet' || (e === 'verdacht' && ernst === 'schoon')) ernst = e; };

    // 1. handtekeningen
    for (const d of definities) {
      if (d.mimes && !d.mimes.includes(String(meta.mime || ''))) continue;
      let raak = false;
      if (d.type === 'tekst') {
        raak = buf.indexOf(Buffer.from(d.patroon, 'latin1')) !== -1;
      } else if (d.type === 'bytes' && HEX.test(d.patroon)) {
        const naald = hexNaarBytes(d.patroon);
        raak = d.waar === 'start' ? beginMet(buf, naald) : buf.indexOf(naald) !== -1;
      }
      if (raak) { redenen.push('handtekening: ' + d.naam); hef(d.ernst); }
    }

    // 2. heuristiek: magie vs opgegeven type. Alleen 'verdacht' (niet hard
    // blokkeren): een echt uitvoerbaar bestand of webshell wordt al door zijn
    // eigen handtekening als 'besmet' gepakt; een enkele type-mismatch mag geen
    // legitieme-maar-ongewone upload tegenhouden.
    if (!magieKlopt(buf, meta.mime)) { redenen.push('type-vervalsing: de inhoud komt niet overeen met het opgegeven ' + meta.mime); hef('verdacht'); }

    // 3. heuristiek: gevaarlijke of dubbele extensie in de bestandsnaam
    const naam = String(meta.naam || '').toLowerCase();
    const delen = naam.split('.').filter(Boolean);
    if (delen.length >= 2 && GEVAARLIJKE_EXT.has(delen[delen.length - 1])) { redenen.push('gevaarlijke extensie: .' + delen[delen.length - 1]); hef('besmet'); }
    if (delen.length >= 3 && GEVAARLIJKE_EXT.has(delen[delen.length - 1])) { redenen.push('dubbele extensie: ' + naam); hef('besmet'); }

    // 4. heuristiek: entropie. Beeldformaten zijn van nature hoog-entropisch
    // (comprimeerd), dus alleen voor NIET-beeld opgegeven typen alarmeren.
    const isBeeld = /image\//.test(String(meta.mime || ''));
    const H = entropie(buf);
    if (!isBeeld && buf.length > 256 && H > 7.5) { redenen.push('hoge entropie (' + H.toFixed(2) + '): mogelijk verpakt/versleuteld'); hef('verdacht'); }

    return {
      verdict: ernst,
      redenen,
      entropie: Number(H.toFixed(2)),
      bytes: buf.length,
      sha256: crypto.createHash('sha256').update(buf).digest('hex')
    };
  }

  /* Scan + verwerk: telt mee, meldt op het bord bij verdacht/besmet, en stelt
     (als De Wacht meedraait) voor om de bron af te snijden bij een echte
     besmetting. Geeft het verdict terug zodat de route kan weigeren. */
  function verwerk(buf, meta) {
    meta = meta || {};
    const r = scan(buf, meta);
    const s = S();
    s.totaal += 1;
    s[r.verdict] = (s[r.verdict] || 0) + 1;
    if (r.verdict !== 'schoon') {
      s.laatste.unshift({ at: new Date().toISOString(), naam: meta.naam || '(upload)', verdict: r.verdict,
        redenen: r.redenen.slice(0, 4), sha256: r.sha256.slice(0, 16), bron: meta.bron || '' });
      if (s.laatste.length > 50) s.laatste.length = 50;
    }
    save();
    if (r.verdict !== 'schoon' && beveilig) {
      beveilig.meld('malware', r.verdict === 'besmet' ? 'kritiek' : 'waarschuwing',
        'De Ontsmetter ' + (r.verdict === 'besmet' ? 'BLOKKEERDE besmette' : 'markeerde verdachte') + ' upload' +
        (meta.bron ? ' van ' + meta.bron : '') + ': ' + r.redenen.join('; ') + '.',
        { bron: 'malware:' + (meta.bron || r.sha256.slice(0, 12)) });
    }
    // bij een harde besmetting: stel voor de bron af te snijden (mens beslist)
    if (r.verdict === 'besmet' && wacht && meta.bron) {
      try {
        wacht.voorstel({ soort: 'afweer', titel: 'Uploader afsnijden: ' + meta.bron,
          uitleg: 'Deze bron uploadde besmette inhoud (' + r.redenen.join('; ') + '). Voorstel: in quarantaine zetten.',
          actie: { soort: 'quarantaine', bron: meta.bron, reden: 'besmette upload' } });
      } catch (e) {}
    }
    return r;
  }

  // Scan een data-URL (base64 image), zoals de uploads binnenkomen.
  function scanDataUrl(s, meta) {
    const m = /^data:([^;]+);base64,([A-Za-z0-9+/=]+)$/.exec(String(s || ''));
    if (!m) return { verdict: 'verdacht', redenen: ['geen geldige data-URL'], bytes: 0, sha256: '', entropie: 0 };
    const buf = Buffer.from(m[2], 'base64');
    return verwerk(buf, Object.assign({ mime: m[1] }, meta || {}));
  }

  // Praktische poort voor de intake-plekken: geef {ok:false, error} terug bij een
  // BESMET bestand (verdacht mag door, maar staat wel op het bord).
  function veiligeFoto(dataUrl, meta) {
    const r = scanDataUrl(dataUrl, meta);
    if (r.verdict === 'besmet') return { ok: false, error: 'Dit bestand is geweigerd door de beveiliging (mogelijke malware).', verdict: r.verdict };
    return { ok: true, verdict: r.verdict };
  }

  /* Loop door een verzoek-body (string/array/object, begrensde diepte) en scan
     elke ingesloten beeld-/PDF-data-URL. Geeft de EERSTE besmette treffer terug
     of null. Zo dekt één middleware alle upload-plekken (snaps, Salon, markt,
     clips, ...) zonder elke route apart te hoeven aanraken. */
  const DATA_URL_RE = /^data:(image\/[a-z0-9.+-]+|application\/pdf);base64,[A-Za-z0-9+/=]+$/i;
  function scanBody(body, meta, diepte) {
    diepte = diepte || 0;
    if (diepte > 6 || body == null) return null;
    if (typeof body === 'string') {
      if (body.length > 64 && DATA_URL_RE.test(body)) {
        const r = scanDataUrl(body, meta);
        if (r.verdict === 'besmet') return r;
      }
      return null;
    }
    if (Array.isArray(body)) {
      for (let i = 0; i < body.length && i < 200; i++) { const t = scanBody(body[i], meta, diepte + 1); if (t) return t; }
      return null;
    }
    if (typeof body === 'object') {
      for (const k of Object.keys(body)) { const t = scanBody(body[k], meta, diepte + 1); if (t) return t; }
    }
    return null;
  }

  function voegSignatuurToe(sig) {
    if (!sig || !sig.id || !sig.patroon) return false;
    if (definities.some(d => d.id === sig.id)) return false;
    definities.push({ id: String(sig.id).slice(0, 40), naam: String(sig.naam || sig.id).slice(0, 80),
      ernst: sig.ernst === 'besmet' ? 'besmet' : 'verdacht', type: sig.type === 'bytes' ? 'bytes' : 'tekst',
      waar: sig.waar === 'start' ? 'start' : 'overal', patroon: String(sig.patroon).slice(0, 200), mimes: sig.mimes || null });
    S().versie = (S().versie || 1) + 1; save();
    return true;
  }

  function stand() {
    const s = S();
    return { totaal: s.totaal, besmet: s.besmet, verdacht: s.verdacht, schoon: s.schoon,
      definities: definities.length, versie: s.versie, laatste: s.laatste.slice(0, 20) };
  }

  return { scan, verwerk, scanDataUrl, veiligeFoto, scanBody, voegSignatuurToe, stand,
    definities: () => definities.map(d => ({ id: d.id, naam: d.naam, ernst: d.ernst })) };
};
