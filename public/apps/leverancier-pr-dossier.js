/* Het drukklare Persdossier van de zaak: profiel, kerncijfers, foto's en
   het laatste bereik als een document in de huisstijl, geopend in een
   eigen tabblad met een Print/PDF-knop (zelfde blob-patroon als het
   Weekrapport). Wordt gestart vanuit leverancier-pr.js met de context
   en de verse PR-data. */
(function(){
  'use strict';
  function open(ctx, data){
    const T = (k, nl) => (ctx && ctx.T) ? ctx.T(k, nl) : nl;
    const esc = s => (ctx && ctx.esc) ? ctx.esc(s) : String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const S2 = ctx && ctx.S;
    const naam = esc((S2 && (S2.name || S2.naam)) || (S2 && S2.code) || 'Mijn zaak');
    const stad = esc((S2 && (S2.city || S2.stad)) || '');
    const mk = (ctx && ctx.mktData && !ctx.mktData.error) ? ctx.mktData : null;
    const fotos = ((ctx && ctx.fotos) || []).slice(0, 6).map(p => location.origin + p);
    const bereik = (data && data.bereik) || [];
    const vandaag = new Date().toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' });
    const kpis = mk ? [[T('mk.volgers','Volgers'), mk.volgers], [T('mk.posts','Berichten'), mk.posts], ['Likes', mk.likes], [T('mk.reacties','Reacties'), mk.reacties]] : [];
    const html = '<!doctype html><html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
      '<title>' + T('pr2.dossier','Persdossier') + ' ' + naam + '</title><style>' +
      ':root{--bg:#0C0C0B;--ink:#F4F1EC;--muted:rgba(244,241,236,.62);--gold:#A98F1C;--line:rgba(244,241,236,.14);}' +
      '*{box-sizing:border-box;margin:0;}body{background:var(--bg);color:var(--ink);font-family:"Inter",system-ui,sans-serif;line-height:1.6;padding:3rem 1.4rem 5rem;}' +
      'h1,h2{font-family:"Bodoni Moda",Georgia,serif;font-weight:500;}' +
      '.wrap{max-width:820px;margin:0 auto;}.cover{border-bottom:1px solid var(--line);padding-bottom:1.4rem;margin-bottom:1.8rem;}' +
      '.cover .ey{font-size:.66rem;letter-spacing:.24em;text-transform:uppercase;color:var(--rtg-leesgoud,var(--gold));}.cover h1{font-size:2.1rem;margin:.4rem 0 .2rem;}.cover .sub{color:var(--muted);font-size:.9rem;}' +
      '.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(8.5rem,1fr));gap:.6rem;margin:1rem 0;}' +
      '.kpi{border:1px solid var(--line);border-radius:0;padding:.7rem .85rem;}.kpi b{display:block;font-family:"Bodoni Moda",serif;font-weight:500;font-size:1.3rem;color:var(--rtg-leesgoud,var(--gold));}' +
      '.kpi span{font-size:.6rem;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);}' +
      'section{border-top:1px solid var(--line);padding:1.3rem 0;page-break-inside:avoid;}section h2{font-size:1.1rem;margin-bottom:.6rem;}' +
      '.fgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:.6rem;}.fgrid img{width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:0;border:1px solid var(--line);}' +
      '.rij{display:flex;justify-content:space-between;gap:1rem;font-size:.88rem;padding:.25rem 0;border-bottom:1px solid var(--line);}.rij:last-child{border-bottom:none;}.rij span{color:var(--muted);}' +
      '.blok{border-left:2px solid var(--gold);padding-left:.8rem;font-size:.88rem;color:var(--muted);line-height:1.65;}' +
      '.balk{position:fixed;top:0;left:0;right:0;background:#000;border-bottom:1px solid var(--gold);padding:.5rem 1rem;display:flex;justify-content:space-between;align-items:center;font-size:.8rem;}' +
      '.balk button{background:var(--ink);color:#000;border:none;border-radius:0;padding:.4rem .9rem;font:inherit;font-weight:600;cursor:pointer;}' +
      '@media print{.balk{display:none;}body{background:#fff;color:#111;padding-top:2rem;}.cover .sub,.kpi span,.rij span,.blok{color:#555;}section,.cover,.kpi,.rij{border-color:#ddd;}.kpi b{color:#7F1634;}}' +
      '</style></head><body>' +
      '<div class="balk"><span>' + T('pr2.dossier','Persdossier') + ' &middot; ' + naam + '</span><button id="pbtn" type="button">Print / PDF</button></div>' +
      '<div class="wrap"><div class="cover"><div class="ey">RTG Partner &middot; ' + T('pr2.dossier','Persdossier') + '</div><h1>' + naam + '</h1>' +
      '<div class="sub">' + (stad ? stad + ' &middot; ' : '') + vandaag + '</div>' +
      (kpis.length ? '<div class="kpis">' + kpis.map(x => '<div class="kpi"><b>' + x[1] + '</b><span>' + x[0] + '</span></div>').join('') + '</div>' : '') + '</div>' +
      (mk && mk.bio ? '<section><h2>' + T('pr2.overons','Over de zaak') + '</h2><p class="blok">' + esc(mk.bio) + '</p></section>' : '') +
      (fotos.length ? '<section><h2>' + T('pr2.beeld','Beeld') + '</h2><div class="fgrid">' + fotos.map(f => '<img src="' + esc(f) + '" alt="">').join('') + '</div></section>' : '') +
      (bereik.length ? '<section><h2>' + T('pr2.bereik','Bereik per bericht') + '</h2>' +
        bereik.slice(0, 8).map(p => '<div class="rij"><span>' + esc(p.tekst) + '</span><span>&hearts; ' + p.likes + ' &middot; ' + p.reacties + '</span></div>').join('') + '</section>' : '') +
      '<section><h2>' + T('pr2.contact','Boeken en contact') + '</h2><p class="blok">' + T('pr2.contact.s','Leden boeken rechtstreeks in de RTG-app; RTG rekent 0% commissie. Volg de zaak op De Salon voor aanbiedingen en nieuws.') + '</p></section>' +
      '</div><script>document.getElementById("pbtn").addEventListener("click",function(){window.print();});<\/script></body></html>';
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    if (ctx && ctx.toast) ctx.toast(T('pr2.open','Persdossier geopend in een nieuw tabblad.'));
  }
  window.RTGPersdossier = { open: open };
})();
