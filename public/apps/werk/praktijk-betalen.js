(function () {
  'use strict';
  const e = window.RTGWerk.esc;
  function formulier(x,rechten) {
    const b = x.betaling; if (!b) return '';
    let s = '<details><summary>Klantbetaling</summary><p>'+e(b.uitleg)+'</p>';
    if (b.ontvanger) s += '<p>Geldontvanger: <b>'+e(b.ontvanger)+'</b></p>';
    if (b.stand) s += '<p>'+e(b.stand.label)+' · '+e(b.stand.id)+'</p><p>'+e(b.stand.volgende || '')+'</p>';
    else if (b.beschikbaar && ['bevestigd','ingepland','uitgevoerd'].includes(x.stand) &&
        ['werkruimte','project','klant','geld','geld.goedkeuren'].every(r=>(rechten||[]).includes(r)))
      s += '<form data-pr="betaalverzoek" data-project="'+e(x.id)+'"><input type="hidden" name="aan" value="'+(!b.aangezet)+'">'+
        '<p>De klant betaalt het volledige afgesproken bedrag via de klantlink. U deelt die link zelf.</p>'+
        '<button class="knop" type="submit">'+(b.aangezet?'Betaalverzoek uitzetten':'Betalen via klantlink aanzetten')+'</button></form>';
    return s+'</details>';
  }
  function gast(b) {
    if (!b) return '';
    return '<section aria-label="Betaling"><h2>Betaling</h2><p>'+e(b.uitleg)+'</p>'+
      (b.ontvanger?'<p>Geldontvanger: <b>'+e(b.ontvanger)+'</b></p>':'')+
      (b.stand?'<p>'+e(b.stand.label)+'</p><p>'+e(b.stand.volgende||'')+'</p>':'')+
      (b.magStarten?'<button class="knop p" data-betalen>Doorgaan naar betalen</button>':'')+
      '<button class="knop" data-betaalstatus>Betaalstatus vernieuwen</button><div data-betaaluit role="status"></div></section>';
  }
  function bind(el,d,api,laad) {
    el.querySelector('[data-betaalstatus]')?.addEventListener('click',async ev=>{
      ev.target.disabled=true;
      try { await api('betaling/status');await laad(); }
      catch(err){el.querySelector('[data-betaaluit]').textContent=err.message;ev.target.disabled=false;}
    });
    el.querySelector('[data-betalen]')?.addEventListener('click',async ev=>{
      ev.target.disabled=true;const uit=el.querySelector('[data-betaaluit]');
      try {
        const r=await api('betaling/start',{versie:d.versie,akkoord:true});
        uit.textContent=r.betaling.label;
        if(r.actie?.soort==='doorsturen') {
          const u=new URL(r.actie.url);if(u.protocol!=='https:')throw new Error('De betaalpagina vraagt controle.');
          const a=document.createElement('a');a.href=u.href;a.target='_blank';a.rel='noopener noreferrer';a.className='knop p';
          a.textContent='Open beveiligde betaalpagina';uit.append(document.createElement('br'),a);
        }
      } catch(err){uit.textContent=err.message;ev.target.disabled=false;}
    });
  }
  window.RTGPraktijkBetalen={formulier,gast,bind};
  if(location.hash==='#betaling-terug') {
    document.body.classList.add('pr-gast');const el=document.createElement('main');el.id='praktijkGast';el.className='praktijk';
    el.innerHTML='<h1>Terug van de betaalpagina</h1><p>Open uw oorspronkelijke afspraaklink en kies “Betaalstatus vernieuwen”. Alleen de bevestiging van de betaalprovider bepaalt de betaalstatus.</p>';
    document.body.append(el);
  }
})();
