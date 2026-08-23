  /* RTG Eten: gedeelde toestand en de rolgerichte orderkaart. */
  let etenWerk = null, etenBezig = false, etenRol = 'keuken', etenZoek = '', etenFilters = [], etenZoekTimer = null;
  try { etenRol = localStorage.getItem('rtg_eten_rol') || etenRol; } catch(e){}

  function etenLabel(s){ return ({ keuken:'Keuken', expeditie:'Expeditie', frontoffice:'Frontoffice', management:'Management',
    geaccepteerd:'Accepteren', 'in-bereiding':'Start bereiding', klaar:'Markeer klaar', overgedragen:'Overdragen',
    onderweg:'Onderweg', geleverd:'Geleverd' })[s] || s; }
  function etenBedrag(c){ return '€ ' + ((Number(c)||0)/100).toFixed(2).replace('.', ','); }
  function etenOpties(p){ return (p.opties || []).map(o => o.naam || o.id).filter(Boolean).join(' · '); }

  function etenOrderHtml(o){
    const vertraagd = o.eta && o.eta.minuten > 45;
    const producten = (o.producten || []).map(p => '<div class="eten-product"><span><b>'+esc(p.aantal+' × '+p.naam)+'</b>'+
      (etenOpties(p)?'<small>'+esc(etenOpties(p))+'</small>':'')+
      (etenRol==='keuken' && p.station?'<small>Station '+esc(p.station)+(p.notitie?' · '+esc(p.notitie):'')+'</small>':'')+
      '</span><span>'+etenBedrag(p.centen*p.aantal)+'</span></div>').join('');
    const allergenen = [...new Set((o.producten || []).flatMap(p => p.allergenen || []))];
    const roltekst = etenRol==='expeditie' ? 'Verpakking, code en overdracht tegelijk controleren.'
      : etenRol==='frontoffice' ? (o.kanaal==='afhaal' ? 'Afhaalcode en gastvraag staan voorop.' : 'Klantvragen en uitzonderingen blijven zichtbaar.')
        : etenRol==='management' ? 'Prijs, betaling, SLA en audit zijn één orderbeeld.' : 'Gerechten, modifiers, timing en station.';
    return '<article class="eten-order'+(vertraagd?' vertraagd':'')+'"><div class="eten-orderkop"><div><h4>'+esc(o.klant && o.klant.codenaam || 'Gast')+'</h4><p>'+esc(o.rekeningId || o.ref || o.id)+' · '+esc(o.kanaal)+'</p></div><span class="eten-fase">'+esc(o.status.label)+'</span></div>'+producten+
      (o.allergieControle || allergenen.length ? '<div class="eten-alert"><b>Allergiecontrole</b>'+(allergenen.length?' · '+esc(allergenen.join(', ')):' · persoonlijke controle vereist')+'</div>' : '')+
      '<div class="eten-meta"><span>ETA '+(o.eta?esc(o.eta.minuten)+' min':'niet bekend')+'</span>'+(o.code?'<span>Code '+esc(o.code)+'</span>':'')+'<span>'+esc(o.statussen.betaling)+'</span></div><p class="eten-perfect"><b>Perfect Arrival</b> · '+esc(o.perfectArrival && o.perfectArrival.advies || roltekst)+'</p><div class="eten-actie"><strong>'+etenBedrag(o.prijs && o.prijs.totaal)+'</strong>'+(o.volgende?'<button class="obtn primary" data-eten-status="'+esc(o.volgende)+'" data-eten-rekening="'+esc(o.rekeningId)+'">'+esc(etenLabel(o.volgende))+'</button>':'<span class="soft-xs">'+esc(roltekst)+'</span>')+'</div></article>';
  }
