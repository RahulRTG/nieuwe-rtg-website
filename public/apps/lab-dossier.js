/* Onderzoekslab premium: het Onderzoeksdossier -- een project als drukklaar
   dossier (fase-keten, veiligheids- en ethiektoets, logboek, bevindingen) in
   een nieuw tabblad, met een Print/PDF-knop. Zelfde patroon als het lookbook
   in de kantoren: een blob-URL, geen server nodig, alles in eigen huis. */
(function () {
  'use strict';
  var esc = function (t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); };
  var dag = function (iso) { return String(iso || '').slice(0, 10); };

  // de fase-keten als strook: gepasseerde stappen goud, de huidige uitgelicht
  function keten(fasen, huidig) {
    var ix = fasen.indexOf(huidig);
    return '<div class="keten">' + fasen.map(function (f, i) {
      var kl = i < ix ? 'was' : (i === ix ? 'nu' : 'nog');
      return '<span class="stap ' + kl + '">' + esc(f) + '</span>';
    }).join('<span class="pijl">&rarr;</span>') + '</div>';
  }

  function open(p, fasen, bevindingen) {
    if (!p) return;
    fasen = fasen || [];
    var eigen = (bevindingen || []).filter(function (b) { return b.project === p.titel; });
    var v = p.veiligheid || {};
    var toetsKlasse = v.status === 'akkoord' ? 'ok' : 'wacht';
    var html = '<!doctype html><html lang="nl"><head><meta charset="utf-8">' +
      '<meta name="viewport" content="width=device-width, initial-scale=1">' +
      '<title>Onderzoeksdossier ' + esc(p.titel) + '</title><style>' +
      ':root{--bg:#0C0C0B;--ink:#F4F1EC;--muted:rgba(244,241,236,.62);--soft:rgba(244,241,236,.4);--gold:#A98F1C;--groen:#4C9A75;--line:rgba(244,241,236,.14);}' +
      '*{box-sizing:border-box;margin:0;}body{background:var(--bg);color:var(--ink);font-family:"Inter",system-ui,sans-serif;line-height:1.6;padding:3rem 1.4rem 5rem;}' +
      'h1,h2{font-family:"Bodoni Moda",Georgia,serif;font-weight:500;letter-spacing:-.01em;}' +
      '.wrap{max-width:820px;margin:0 auto;}' +
      '.cover{border-bottom:1px solid var(--line);padding-bottom:1.6rem;margin-bottom:2rem;}' +
      '.cover .ey{font-size:.66rem;letter-spacing:.24em;text-transform:uppercase;color:var(--gold);}' +
      '.cover h1{font-size:2.2rem;margin:.5rem 0 .3rem;}.cover .sub{color:var(--muted);font-size:.9rem;}' +
      '.keten{display:flex;flex-wrap:wrap;align-items:center;gap:.45rem;margin:1.2rem 0;}' +
      '.stap{font-size:.7rem;letter-spacing:.1em;text-transform:uppercase;border:1px solid var(--line);border-radius:0;padding:.25rem .7rem;color:var(--soft);}' +
      '.stap.was{color:var(--gold);border-color:var(--gold);}' +
      '.stap.nu{background:var(--gold);color:#000;border-color:var(--gold);font-weight:600;}' +
      '.pijl{color:var(--soft);font-size:.8rem;}' +
      'section{border-top:1px solid var(--line);padding:1.4rem 0;page-break-inside:avoid;}' +
      'section h2{font-size:1.15rem;margin-bottom:.6rem;}' +
      '.toets{border:1px solid var(--line);border-radius:0;padding:.9rem 1rem;}' +
      '.toets .st{font-size:.66rem;letter-spacing:.14em;text-transform:uppercase;}' +
      '.toets.ok .st{color:var(--groen);}.toets.wacht .st{color:var(--gold);}' +
      '.toets p{font-size:.88rem;color:var(--muted);margin-top:.3rem;}' +
      '.log{font-size:.88rem;padding:.3rem 0;border-bottom:1px solid var(--line);display:flex;gap:.9rem;}' +
      '.log:last-child{border-bottom:none;}.log .d{color:var(--soft);white-space:nowrap;font-size:.78rem;padding-top:.15rem;}' +
      '.bev{padding:.5rem 0;border-bottom:1px solid var(--line);}.bev:last-child{border-bottom:none;}' +
      '.bev b{display:block;}.bev span{font-size:.86rem;color:var(--muted);}' +
      '.leeg{color:var(--soft);font-size:.86rem;}' +
      '.balk{position:fixed;top:0;left:0;right:0;background:#000;border-bottom:1px solid var(--gold);padding:.5rem 1rem;display:flex;justify-content:space-between;align-items:center;font-size:.8rem;}' +
      '.balk button{background:var(--ink);color:#000;border:none;border-radius:0;padding:.4rem .9rem;font:inherit;font-weight:600;cursor:pointer;}' +
      '@media print{.balk{display:none;}body{background:#fff;color:#111;padding-top:2rem;}.cover .sub,.toets p,.bev span,.log{color:#444;}.log .d,.leeg{color:#999;}.stap.nu{-webkit-print-color-adjust:exact;print-color-adjust:exact;}section,.cover,.toets,.log,.bev{border-color:#ddd;}}' +
      '</style></head><body>' +
      '<div class="balk"><span>Onderzoeksdossier &middot; ' + esc(p.titel) + '</span><button id="pbtn" type="button">Print / PDF</button></div>' +
      '<div class="wrap"><div class="cover"><div class="ey">RTG + RTFoundation &middot; Onderzoekslab</div>' +
      '<h1>' + esc(p.titel) + '</h1>' +
      '<div class="sub">' + esc(p.veldNaam || p.veld) + ' &middot; voor ' + esc(p.voorWie) +
      (p.doel ? ' &middot; ' + esc(p.doel) : '') + '</div>' +
      keten(fasen, p.fase) + '</div>' +
      '<section><h2>Veiligheids- en ethiektoets</h2><div class="toets ' + toetsKlasse + '">' +
      '<span class="st">' + esc(v.status || 'open') + (v.door ? ' &middot; getekend door ' + esc(v.door) : ' &middot; wacht op een mens') + '</span>' +
      (v.notitie ? '<p>' + esc(v.notitie) + '</p>' : '') +
      '<p>Voor proef en uitrol tekent altijd een mens; de AI adviseert alleen.</p></div></section>' +
      '<section><h2>Logboek (' + (p.logboek || []).length + ')</h2>' +
      ((p.logboek || []).map(function (l) {
        return '<div class="log"><span class="d">' + esc(dag(l.at)) + '</span><span>' + esc(l.tekst) + '</span></div>';
      }).join('') || '<p class="leeg">Nog geen logboek-regels.</p>') + '</section>' +
      '<section><h2>Bevindingen (' + eigen.length + ')</h2>' +
      (eigen.map(function (b) {
        return '<div class="bev"><b>' + esc(b.titel) + '</b>' + (b.tekst ? '<span>' + esc(b.tekst) + '</span>' : '') + '</div>';
      }).join('') || '<p class="leeg">Nog geen bevindingen; de kennisbank wacht op de eerste.</p>') + '</section>' +
      '</div><script>document.getElementById("pbtn").addEventListener("click",function(){window.print();});<\/script>' +
      '</body></html>';
    var blob = new Blob([html], { type: 'text/html' });
    var url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
  }

  window.LabDossier = { open: open };
})();
