/* De Ontsmetter: de definitielijst.

   Dit is bewust DATA en geen code: nieuwe handtekeningen toevoegen kan zonder
   iets aan de scanner te veranderen. Dat is precies hoe een echte
   virusscanner werkt, en het houdt de scanlogica klein en toetsbaar.

   ernst: 'besmet' (hard weigeren) of 'verdacht' (zacht, wel melden).
   type:  'bytes' (hex, meestal aan het begin) of 'tekst' (ascii, overal). */

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
// Extensies die we nooit als "gewone upload" willen zien binnenkomen.
const GEVAARLIJKE_EXT = new Set(['exe', 'dll', 'scr', 'bat', 'cmd', 'com', 'js', 'jar', 'vbs', 'ps1', 'sh', 'php', 'phtml', 'msi', 'apk']);

module.exports = { standaardDefinities, BEELD_MAGIE, GEVAARLIJKE_EXT };
