/* de meldingenlijst van de zaak */
    $('#notifList').innerHTML = notifs.length ? notifs.map(n =>
      '<div class="notif-item'+(n.read?'':' unread')+'"><div class="ic">'+(window.RTGGlyf&&RTGGlyf.heeft(n.icon)?RTGGlyf.svgHTML(n.icon,{klasse:'gl-inline'}):(n.icon||'•'))+'</div><div class="tx"><b>'+n.title+'</b><span>'+n.body+'</span><time>'+timeAgo(n.at)+'</time></div></div>'
    ).join('') : '<div class="empty">'+T('sup.nonotif','Nog geen meldingen. Nieuwe bestellingen en betalingen ziet u hier live.')+'</div>';
  }
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
  /* Opbouw en bediening van het werkblad; de kaart zelf staat in 84a. */
  function renderEtenWerkblad(){
    const el = $('#etenWerkblad'); if (!el) return;
    if (!etenWerk){ el.innerHTML = '<section class="eten-werk"><div class="eten-kop"><div><h3>RTG Eten · operationeel werkblad</h3><p>Dezelfde order als bij de klant, toegespitst op je rol.</p></div><span class="eten-live">Live</span></div><div class="eten-leeg">Werkblad wordt geladen…</div></section>'; return; }
    const d = etenWerk, cap = d.capaciteit || {}, sm = d.samenvatting || {};
    const rollen = (d.rollen || []).map(r => '<button data-eten-rol="'+r+'" class="'+(r===etenRol?'aan':'')+'">'+etenLabel(r)+'</button>').join('');
    const filters = [['nieuw','Nieuw'],['vertraagd','Vertraagd'],['klaar','Klaar'],['afhaal','Afhaal'],['bezorging','Bezorging'],['allergie','Allergie'],['probleem','Probleem']].map(f => '<button data-eten-filter="'+f[0]+'" class="'+(etenFilters.includes(f[0])?'aan':'')+'">'+f[1]+'</button>').join('');
    const pauzes = (state.menu || []).slice(0,60).map(m => '<label><input type="checkbox" data-eten-pauze="'+esc(m.id)+'" '+((cap.gepauzeerdeItems||[]).includes(String(m.id))?'checked':'')+'>'+esc(m.name || m.naam)+'</label>').join('');
    const codes = (d.kortingscodes || []).map(k => '<span>'+esc(k.code)+' · '+(k.procent?k.procent+'%':etenBedrag(k.centen))+' <button class="obtn warn" data-eten-codeweg="'+esc(k.code)+'">×</button></span>').join('');
    const beheer = etenRol === 'management' ? '<div class="eten-cap"><label><input type="checkbox" id="etenOpen" '+(cap.open?'checked':'')+'> Bestellen open</label><label><input type="checkbox" id="etenAuto" '+(cap.auto?'checked':'')+'> Automatische sturing</label><label>Minimale extra minuten<input id="etenExtra" type="number" min="0" max="120" value="'+Number(cap.ingesteldeExtraMinuten||0)+'"></label><label>Druk vanaf<input id="etenLimiet" type="number" min="10" max="180" value="'+Number(cap.limietMinuten||35)+'"></label><label>Koks op de lijn<input id="etenKokken" type="number" min="1" max="60" value="'+Number(cap.kokken||1)+'"></label><label><input type="checkbox" id="etenAfhaal" '+(cap.afhalenPromoten?'checked':'')+'> Afhalen voorop</label><div class="eten-breed"><span class="soft-xs">Gerechten tijdelijk pauzeren</span><div class="eten-pauzes">'+(pauzes||'<span>Geen kaartitems</span>')+'</div></div><p class="eten-capadvies">'+esc(cap.advies||'')+' · wachttijd '+Number(cap.wachttijd||0)+' min</p><button class="obtn primary eten-breed" id="etenCapBewaar">Capaciteit publiceren</button><div class="eten-breed"><span class="soft-xs">Kortingscodes</span><div class="eten-zoeken"><input id="etenCode" maxlength="30" placeholder="Code"><input id="etenProcent" type="number" min="1" max="100" placeholder="%"><button class="obtn" id="etenCodeBewaar">Bewaar</button></div><div class="eten-samenvatting">'+codes+'</div></div></div>' : '<div class="eten-cap"><p class="eten-capadvies">Capaciteit: <b>'+esc(cap.stand||'rustig')+'</b> · '+esc(cap.advies||'')+'</p></div>';
    el.innerHTML = '<section class="eten-werk"><div class="eten-kop"><div><h3>RTG Eten · operationeel werkblad</h3><p>Nieuw → geaccepteerd → in bereiding → klaar → overgedragen. Geld, bewijs en audit lopen eronder mee.</p></div><span class="eten-live">Live</span></div><div class="eten-rollen">'+rollen+'</div><div class="eten-zoeken"><input id="etenZoek" value="'+esc(etenZoek)+'" placeholder="Zoek bestelling, nummer, klant, gerecht, code of bezorger"><button class="obtn" id="etenZoekGo">Zoek</button></div><div class="eten-filters">'+filters+'</div><div class="eten-samenvatting"><span><b>'+Number(sm.zichtbaar||0)+'</b> zichtbaar</span><span><b>'+Number(sm.nieuw||0)+'</b> nieuw</span><span><b>'+Number(sm.keuken||0)+'</b> keuken</span><span><b>'+Number(sm.klaar||0)+'</b> klaar</span><span><b>'+Number(sm.problemen||0)+'</b> aandacht</span></div>'+beheer+'<div class="eten-orders">'+((d.orders||[]).map(etenOrderHtml).join('')||'<div class="eten-leeg">Geen orders binnen deze rol en filters.</div>')+'</div></section>';
    bindEtenWerkblad(el);
  }

