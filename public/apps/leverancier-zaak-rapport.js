/* Het drukklare Weekrapport van de zaak: de hele backoffice als document
   in de huisstijl, geopend in een eigen tabblad met een Print/PDF-knop
   (zelfde blob-patroon als de lookbooks van de kantoren). Wordt gestart
   vanuit leverancier-zaak.js met de context van de app. */
(function(){
  'use strict';
  function open(ctx){
    const T = (k, nl) => (ctx && ctx.T) ? ctx.T(k, nl) : nl;
    const esc = s => (ctx && ctx.esc) ? ctx.esc(s) : String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const eur = c => (ctx && ctx.eur) ? ctx.eur(c) : '€ ' + (Number(c || 0) / 100).toFixed(2);
    const b3 = ctx && ctx.boData;
    if (!b3 || b3.error){ if (ctx && ctx.toast) ctx.toast(T('z3.geen', 'De backoffice is nog aan het laden.')); return; }
    const S2 = ctx.S, vw = ctx.vwData;
    const naam3 = esc((S2 && (S2.name || S2.naam)) || (S2 && S2.code) || 'Mijn zaak');
    const en3 = !!(ctx.lang && ctx.lang() === 'en');
    const vandaag3 = new Date().toLocaleDateString(en3 ? 'en-GB' : 'nl-NL', { day: 'numeric', month: 'long', year: 'numeric' });
    const kpi3 = [[T('bz.today','Omzet vandaag'), eur(b3.stats.omzetVandaag)], [T('bz.trans','Transacties'), b3.stats.transactiesVandaag],
      [T('bz.week','Weekomzet'), eur(b3.stats.omzetWeek)], [T('bz.binnen','Nu ingeklokt'), b3.stats.binnenNu], [T('bz.acties','Open acties'), b3.stats.openActies]];
    const maxW = Math.max.apply(null, b3.week.map(d => d.omzet).concat([1]));
    const m3 = vw && vw.ok && vw.morgen;
    const html3 = '<!doctype html><html lang="' + (en3 ? 'en' : 'nl') + '"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
      '<title>' + T('z3.rapport','Weekrapport') + ' ' + naam3 + '</title><style>' +
      ':root{--bg:#0C0C0B;--ink:#F4F1EC;--muted:rgba(244,241,236,.62);--soft:rgba(244,241,236,.4);--gold:#A98F1C;--line:rgba(244,241,236,.14);}' +
      '*{box-sizing:border-box;margin:0;}body{background:var(--bg);color:var(--ink);font-family:"Inter",system-ui,sans-serif;line-height:1.6;padding:3rem 1.4rem 5rem;}' +
      'h1,h2{font-family:"Bodoni Moda",Georgia,serif;font-weight:500;}' +
      '.wrap{max-width:820px;margin:0 auto;}.cover{border-bottom:1px solid var(--line);padding-bottom:1.4rem;margin-bottom:1.8rem;}' +
      '.cover .ey{font-size:.66rem;letter-spacing:.24em;text-transform:uppercase;color:var(--gold);}.cover h1{font-size:2.1rem;margin:.4rem 0 .2rem;}.cover .sub{color:var(--muted);font-size:.9rem;}' +
      '.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(8.5rem,1fr));gap:.6rem;margin:1rem 0;}' +
      '.kpi{border:1px solid var(--line);border-radius:12px;padding:.7rem .85rem;}.kpi b{display:block;font-family:"Bodoni Moda",serif;font-weight:500;font-size:1.3rem;color:var(--gold);}' +
      '.kpi span{font-size:.6rem;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);}' +
      'section{border-top:1px solid var(--line);padding:1.3rem 0;page-break-inside:avoid;}section h2{font-size:1.1rem;margin-bottom:.6rem;}' +
      '.staaf{display:flex;align-items:flex-end;gap:.5rem;height:110px;}.staaf>div{flex:1;text-align:center;font-size:.62rem;color:var(--muted);display:flex;flex-direction:column;justify-content:flex-end;gap:.2rem;height:100%;}' +
      '.staaf i{display:block;width:100%;max-width:36px;margin:0 auto;background:var(--gold);border-radius:4px 4px 2px 2px;-webkit-print-color-adjust:exact;print-color-adjust:exact;}' +
      '.staaf>div:last-child i{background:#7F1634;}' +
      '.rij3{display:flex;justify-content:space-between;gap:1rem;font-size:.88rem;padding:.25rem 0;border-bottom:1px solid var(--line);}.rij3:last-child{border-bottom:none;}.rij3 span{color:var(--muted);}' +
      '.blok3{border-left:2px solid var(--gold);padding-left:.8rem;font-size:.88rem;color:var(--muted);line-height:1.65;}' +
      '.balk{position:fixed;top:0;left:0;right:0;background:#000;border-bottom:1px solid var(--gold);padding:.5rem 1rem;display:flex;justify-content:space-between;align-items:center;font-size:.8rem;}' +
      '.balk button{background:var(--ink);color:#000;border:none;border-radius:8px;padding:.4rem .9rem;font:inherit;font-weight:600;cursor:pointer;}' +
      '@media print{.balk{display:none;}body{background:#fff;color:#111;padding-top:2rem;}.cover .sub,.kpi span,.rij3 span,.blok3,.staaf>div{color:#555;}section,.cover,.kpi,.rij3{border-color:#ddd;}.kpi b{color:#7F1634;}}' +
      '</style></head><body>' +
      '<div class="balk"><span>' + T('z3.rapport','Weekrapport') + ' &middot; ' + naam3 + '</span><button id="pbtn" type="button">Print / PDF</button></div>' +
      '<div class="wrap"><div class="cover"><div class="ey">RTG Partner &middot; ' + T('z3.rapport','Weekrapport') + '</div><h1>' + naam3 + '</h1>' +
      '<div class="sub">' + vandaag3 + ' &middot; ' + T('bz.nulcom','RTG rekent 0% commissie: deze omzet is volledig van u.') + '</div>' +
      '<div class="kpis">' + kpi3.map(x => '<div class="kpi"><b>' + x[1] + '</b><span>' + x[0] + '</span></div>').join('') + '</div></div>' +
      '<section><h2>' + T('bz.weekh','Omzet per dag') + '</h2><div class="staaf">' +
      b3.week.map(d => '<div><span>' + (d.omzet ? eur(d.omzet) : '&middot;') + '</span><i style="height:' + Math.max(2, Math.round(d.omzet / maxW * 70)) + '%"></i><span>' + esc(d.label) + '</span></div>').join('') + '</div></section>' +
      '<section><h2>' + T('bz.top','Toppers') + '</h2>' +
      ((b3.toppers || []).map(t3 => '<div class="rij3"><b>' + esc(t3.naam) + '</b><span>' + t3.aantal + 'x &middot; ' + eur(t3.omzet) + '</span></div>').join('') ||
        '<p class="blok3">' + T('bz.geentop','Nog geen verkopen. Zodra er via de app of de kassa verkocht wordt, staan de toppers hier.') + '</p>') + '</section>' +
      '<section><h2>' + T('bz.actie','Actiecentrum van de zaak') + '</h2>' +
      ((b3.alerts || []).map(a3 => '<div class="rij3"><span>' + esc(a3.text) + '</span></div>').join('') ||
        '<p class="blok3">' + T('bz.niks','Alles loopt. Vastgelopen bestellingen, wachtende gasten en open personeelszaken verschijnen hier vanzelf.') + '</p>') + '</section>' +
      (b3.briefing ? '<section><h2>' + T('bz.brief','Dagbriefing') + '</h2><p class="blok3">' + esc(b3.briefing) + '</p></section>' : '') +
      (m3 ? '<section><h2>' + T('vw.h','Verwachting voor morgen') + '</h2><p class="blok3">' +
        m3.verwachtTransacties + ' ' + T('vw.trans','transacties') + ' &middot; ' + eur(m3.verwachtCenten) + ' ' + T('vw.omzet','omzet') + ' (' + esc(m3.dagNaam) + ').' +
        (m3.drukUren && m3.drukUren.length ? ' ' + T('vw.druk','Drukste uren') + ': ' + m3.drukUren.map(u => u.uur + ':00').join(', ') + '.' : '') +
        (m3.advies ? '<br>' + esc(m3.advies) : '') + '</p></section>' : '') +
      '</div><script>document.getElementById("pbtn").addEventListener("click",function(){window.print();});<\/script></body></html>';
    const blob3 = new Blob([html3], { type: 'text/html' });
    const url3 = URL.createObjectURL(blob3);
    window.open(url3, '_blank');
    setTimeout(() => URL.revokeObjectURL(url3), 60000);
    if (ctx && ctx.toast) ctx.toast(T('z3.open','Weekrapport geopend in een nieuw tabblad.'));
  }
  window.RTGZaakRapport = { open: open };
})();
