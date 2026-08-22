/* RTG Atelier premium: het Collectieboek -- alle ontwerpen (of een gefilterde
   selectie) als drukklaar boek in een nieuw tabblad: swatches in de echte
   ontwerpkleuren, silhouet en materialen, het verhaal, het tech pack en de
   blik van de creatief directeur. Zelfde blob-patroon als de andere exports. */
(function () {
  'use strict';
  var esc = function (t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); };

  var swatches = function (kleuren) {
    return '<div class="swrij">' + (kleuren || []).map(function (k) {
      return '<div class="sw"><span style="background:' + esc(k.hex) + '"></span><em>' + esc(k.naam) + '</em><b>' + esc(k.hex) + '</b></div>';
    }).join('') + '</div>';
  };

  function open(ontwerpen, kop) {
    if (!ontwerpen || !ontwerpen.length) return;
    var secties = ontwerpen.map(function (o, i) {
      var c = o.concept, tp = o.techpack;
      return '<article>' +
        '<header><span class="nr">' + String(i + 1).padStart(2, '0') + '</span>' +
        '<div><h2>' + esc(o.naam) + '</h2>' +
        '<div class="meta">' + esc(o.categorieLabel || o.categorie) + (o.huis ? ' &middot; ' + esc(o.huis) : '') +
        (o.collectie ? ' &middot; ' + esc(o.collectie) : '') + ' &middot; ' + esc(o.status) + '</div></div></header>' +
        (o.brief ? '<p class="brief">&ldquo;' + esc(o.brief) + '&rdquo;</p>' : '') +
        (c ? swatches(c.kleuren) +
          '<p class="lead"><b>' + esc(c.silhouet) + '</b> in ' + esc((c.materialen || []).join(', ')) + '</p>' +
          '<p class="mat">' + esc((c.details || []).join(' · ')) + (c.afwerking ? ' &middot; ' + esc(c.afwerking) : '') + '</p>' +
          (c.verhaal ? '<p class="verhaal">' + esc(c.verhaal) + '</p>' : '')
          : '<p class="mat">Nog geen concept uitgetekend.</p>') +
        (tp ? '<div class="spec"><div class="spectitel">Tech pack</div>' +
          (tp.onderdelen || []).map(function (d) {
            return '<div class="specrij"><b>' + esc(d.naam) + '</b><span>' + esc(d.materiaal) + ' &middot; ' + esc(d.spec) + '</span></div>';
          }).join('') +
          '<div class="specfoot">' + esc(tp.constructie) + ' &middot; ' + esc(tp.maten) +
          ((tp.controle || []).length ? ' &middot; controle: ' + esc(tp.controle.join(', ')) : '') + '</div></div>' : '') +
        (o.kritiek ? '<p class="kritiek"><b>Creatief directeur:</b> ' + esc(o.kritiek) + '</p>' : '') +
        '</article>';
    }).join('');
    var html = '<!doctype html><html lang="nl"><head><meta charset="utf-8">' +
      '<meta name="viewport" content="width=device-width, initial-scale=1">' +
      '<title>Collectieboek ' + esc(kop || 'RTG Atelier') + '</title><style>' +
      ':root{--bg:#0C0C0B;--ink:#F4F1EC;--muted:rgba(244,241,236,.62);--soft:rgba(244,241,236,.4);--gold:#A98F1C;--line:rgba(244,241,236,.14);}' +
      '*{box-sizing:border-box;margin:0;}body{background:var(--bg);color:var(--ink);font-family:"Inter",system-ui,sans-serif;line-height:1.6;padding:3rem 1.4rem 5rem;}' +
      'h1,h2{font-family:"Bodoni Moda",Georgia,serif;font-weight:500;letter-spacing:-.01em;}' +
      '.wrap{max-width:820px;margin:0 auto;}' +
      '.cover{border-bottom:1px solid var(--line);padding-bottom:1.6rem;margin-bottom:2.4rem;}' +
      '.cover .ey{font-size:.66rem;letter-spacing:.24em;text-transform:uppercase;color:var(--rtg-leesgoud,var(--gold));}' +
      '.cover h1{font-size:2.4rem;margin:.5rem 0 .3rem;}.cover .sub{color:var(--muted);font-size:.9rem;}' +
      'article{border-top:1px solid var(--line);padding:2rem 0;page-break-inside:avoid;}article:first-of-type{border-top:none;}' +
      'article header{display:flex;gap:1rem;align-items:flex-start;margin-bottom:1rem;}' +
      '.nr{font-family:"Bodoni Moda",serif;font-size:1.6rem;color:var(--soft);min-width:2.4rem;}' +
      'article h2{font-size:1.4rem;}.meta{font-size:.76rem;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;margin-top:.2rem;}' +
      '.brief{color:var(--muted);font-size:.9rem;margin-bottom:.8rem;}' +
      '.swrij{display:flex;flex-wrap:wrap;gap:1rem;margin:.4rem 0 1rem;}' +
      '.sw{display:flex;flex-direction:column;align-items:center;gap:.25rem;font-size:.62rem;}' +
      '.sw span{width:3.2rem;height:3.2rem;border-radius:0;border:1px solid var(--line);display:block;}' +
      '.sw em{color:var(--muted);font-style:normal;}.sw b{color:var(--soft);font-weight:400;}' +
      '.lead{font-size:1.05rem;margin-bottom:.3rem;}.mat{color:var(--muted);font-size:.9rem;}' +
      '.verhaal{font-style:italic;margin-top:.8rem;font-size:.96rem;}' +
      '.kritiek{margin-top:1rem;border-left:2px solid var(--gold);padding-left:.8rem;font-size:.9rem;color:var(--muted);}' +
      '.kritiek b{color:var(--rtg-leesgoud,var(--gold));font-weight:600;}' +
      '.spec{border:1px solid var(--line);border-radius:0;padding:.9rem 1rem;margin-top:1.1rem;}' +
      '.spectitel{font-size:.64rem;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);margin-bottom:.5rem;}' +
      '.specrij{display:flex;justify-content:space-between;gap:1rem;font-size:.86rem;padding:.15rem 0;}' +
      '.specrij span{color:var(--muted);text-align:right;}.specfoot{font-size:.78rem;color:var(--soft);margin-top:.5rem;}' +
      '.balk{position:fixed;top:0;left:0;right:0;background:#000;border-bottom:1px solid var(--gold);padding:.5rem 1rem;display:flex;justify-content:space-between;align-items:center;font-size:.8rem;}' +
      '.balk button{background:var(--ink);color:#000;border:none;border-radius:0;padding:.4rem .9rem;font:inherit;font-weight:600;cursor:pointer;}' +
      '@media print{.balk{display:none;}body{background:#fff;color:#111;padding-top:2rem;}.cover .sub,.meta,.mat,.brief,.kritiek,.sw em{color:#555;}.sw b,.specfoot,.nr{color:#999;}.verhaal,.specrij span,.lead{color:#111;}.sw span{-webkit-print-color-adjust:exact;print-color-adjust:exact;}article,.cover,.spec{border-color:#ddd;}}' +
      '</style></head><body>' +
      '<div class="balk"><span>Collectieboek &middot; ' + esc(kop || 'RTG Atelier') + '</span><button id="pbtn" type="button">Print / PDF</button></div>' +
      '<div class="wrap"><div class="cover"><div class="ey">RTG Atelier &middot; Collectieboek</div>' +
      '<h1>' + esc(kop || 'Het atelier') + '</h1>' +
      '<div class="sub">' + ontwerpen.length + ' ontwerp(en), in de eigen ontwerpkleuren</div></div>' +
      secties + '</div>' +
      '<script>document.getElementById("pbtn").addEventListener("click",function(){window.print();});<\/script>' +
      '</body></html>';
    var blob = new Blob([html], { type: 'text/html' });
    var url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
  }

  window.Collectieboek = { open: open };
})();
