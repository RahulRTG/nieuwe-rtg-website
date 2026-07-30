/* De premium-laag voor ELKE kamer van het Kantoor-station (behalve de
   backoffice, die alles al heeft): een drukklaar Kamerrapport -- de
   kaarten van de open kamer als document in de huisstijl, zonder knoppen
   en formulieren -- en een Rahul-advies-knop op de bestaande AI-motor
   (/supplier/ai; geen nieuwe servercode). Losstaand naast de bundel:
   bindKantoor geeft bij elke render de context door. */
(function(){
  'use strict';
  let ctx = null;
  const antwoorden = {};   // laatste Rahul-advies per kamer blijft staan bij her-render
  const T = (k, nl) => (ctx && ctx.T) ? ctx.T(k, nl) : nl;
  const esc = s => (ctx && ctx.esc) ? ctx.esc(s) : String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function schoonKaart(kaart){
    const k = kaart.cloneNode(true);
    k.querySelectorAll('button, input, select, textarea, canvas, .st-form, .compose, [contenteditable], script, .ph.add').forEach(n => n.remove());
    return k.innerHTML;
  }

  function rapport(el){
    const kaarten = Array.from(el.querySelectorAll('.tkc')).map(schoonKaart).filter(h => h.replace(/<[^>]+>/g, '').trim());
    if (!kaarten.length){ if (ctx.toast) ctx.toast(T('km.leeg', 'Deze kamer heeft nog niets om af te drukken.')); return; }
    const S2 = ctx.S;
    const naam = esc((S2 && (S2.name || S2.naam)) || (S2 && S2.code) || '');
    const kamer = esc(ctx.label || '');
    const vandaag = new Date().toLocaleDateString((ctx.lang && ctx.lang() === 'en') ? 'en-GB' : 'nl-NL', { day: 'numeric', month: 'long', year: 'numeric' });
    const html = '<!doctype html><html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
      '<title>' + kamer + ' &middot; ' + naam + '</title><style>' +
      ':root{--bg:#0C0C0B;--ink:#F4F1EC;--muted:rgba(244,241,236,.62);--soft:rgba(244,241,236,.45);--gold:#A98F1C;--line:rgba(244,241,236,.14);--txt:#F4F1EC;}' +
      '*{box-sizing:border-box;margin:0;}body{background:var(--bg);color:var(--ink);font-family:"Inter",system-ui,sans-serif;line-height:1.6;padding:3rem 1.4rem 5rem;}' +
      'h1,h2,h3{font-family:"Bodoni Moda",Georgia,serif;font-weight:500;}' +
      '.wrap{max-width:820px;margin:0 auto;}.cover{border-bottom:1px solid var(--line);padding-bottom:1.4rem;margin-bottom:1.4rem;}' +
      '.cover .ey{font-size:.66rem;letter-spacing:.24em;text-transform:uppercase;color:var(--gold);}.cover h1{font-size:2rem;margin:.4rem 0 .2rem;}.cover .sub2{color:var(--muted);font-size:.9rem;}' +
      'section{border-top:1px solid var(--line);padding:1.1rem 0;page-break-inside:avoid;}section h3{font-size:1.05rem;margin-bottom:.5rem;}' +
      '.st-row{display:flex;justify-content:space-between;gap:1rem;font-size:.88rem;padding:.28rem 0;border-bottom:1px solid var(--line);}' +
      '.st-row:last-child{border-bottom:none;}.st-row .sub,.sub{display:block;color:var(--muted);font-size:.76em;}' +
      '.tkc-who{color:var(--muted);font-size:.85rem;line-height:1.6;margin:.3rem 0;}b{color:var(--ink);}' +
      'img{max-width:110px;border-radius:8px;}.acts{display:none;}' +
      '.balk{position:fixed;top:0;left:0;right:0;background:#000;border-bottom:1px solid var(--gold);padding:.5rem 1rem;display:flex;justify-content:space-between;align-items:center;font-size:.8rem;}' +
      '.balk button{background:var(--ink);color:#000;border:none;border-radius:8px;padding:.4rem .9rem;font:inherit;font-weight:600;cursor:pointer;}' +
      '@media print{.balk{display:none;}body{background:#fff;color:#111;padding-top:2rem;}.cover .sub2,.sub,.tkc-who{color:#555;}section,.cover,.st-row{border-color:#ddd;}b{color:#111;}}' +
      '</style></head><body>' +
      '<div class="balk"><span>' + kamer + ' &middot; ' + naam + '</span><button id="pbtn" type="button">Print / PDF</button></div>' +
      '<div class="wrap"><div class="cover"><div class="ey">RTG Partner &middot; ' + T('km.rapport', 'Kamerrapport') + '</div>' +
      '<h1>' + kamer + '</h1><div class="sub2">' + naam + ' &middot; ' + vandaag + '</div></div>' +
      kaarten.map(k => '<section>' + k + '</section>').join('') +
      '</div><script>document.getElementById("pbtn").addEventListener("click",function(){window.print();});<\/script></body></html>';
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    if (ctx.toast) ctx.toast(T('km.open', 'Kamerrapport geopend in een nieuw tabblad.'));
  }

  async function advies(knop){
    const uit = document.getElementById('kamerRahulUit');
    if (!uit) return;
    knop.disabled = true;
    uit.style.display = 'block';
    uit.textContent = T('km.bezig', 'Rahul kijkt naar deze kamer...');
    const en = ctx.lang && ctx.lang() === 'en';
    const q = en
      ? 'As the owner, give me short advice about the "' + (ctx.label || '') + '" room of my business: what stands out and what is the next sensible action?'
      : 'Geef mij als eigenaar kort advies over de kamer "' + (ctx.label || '') + '" van mijn zaak: wat valt op en wat is de eerstvolgende zinnige actie?';
    try {
      const d = await ctx.api('/supplier/ai', { q });
      antwoorden[ctx.sectie] = d.reply || '';
      uit.textContent = antwoorden[ctx.sectie];
    } catch(e){ uit.textContent = e.message; }
    knop.disabled = false;
  }

  // de sectieknoppen dragen nog oude emoji-glyfen; het rapport en Rahul
  // krijgen alleen de kale kamernaam
  function kaalLabel(s){ return String(s || '').replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, '').trim(); }

  window.RTGZaakKamer = {
    bind: function(el, c){
      ctx = c || ctx;
      if (ctx && ctx.label) ctx.label = kaalLabel(ctx.label);
      const oud = el.querySelector('#kamerToolbar');
      if (ctx.sectie === 'bo'){ if (oud) oud.remove(); return; }
      if (oud) return;
      const t = document.createElement('div');
      t.id = 'kamerToolbar';
      t.style.cssText = 'grid-column:1/-1;display:flex;gap:0.45rem;flex-wrap:wrap;align-items:flex-start;';
      t.innerHTML = '<button class="obtn ghost" id="kamerRapport" type="button">' + T('km.rapport', 'Kamerrapport') + ' (print)</button>' +
        '<button class="obtn ghost" id="kamerRahul" type="button">' + T('km.rahul', 'Rahul-advies') + '</button>' +
        '<div id="kamerRahulUit" style="flex-basis:100%;display:none;border-left:2px solid var(--gold);padding:0.3rem 0 0.3rem 0.8rem;font-size:0.82rem;line-height:1.6;color:var(--soft);white-space:pre-wrap;"></div>';
      // tussen de kamertabs en de eerste kaart in, niet erboven
      const eerste = el.querySelector('.tkc');
      el.insertBefore(t, eerste || el.firstChild);
      t.querySelector('#kamerRapport').addEventListener('click', () => rapport(el));
      t.querySelector('#kamerRahul').addEventListener('click', e => advies(e.currentTarget));
      if (antwoorden[ctx.sectie]){
        const uit = t.querySelector('#kamerRahulUit');
        uit.style.display = 'block';
        uit.textContent = antwoorden[ctx.sectie];
      }
    }
  };
})();
