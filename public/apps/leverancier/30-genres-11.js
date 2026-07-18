  function retailVariantRij(v){
    return '<div class="mitem" style="display:flex;align-items:center;gap:0.5rem;"><div style="flex:1;min-width:0;"><div class="nm">'+esc(v.kleur)+' · '+esc(v.maat)+'</div><div class="ds">'+esc(v.vsku)+'</div></div>'+
      '<button class="obtn" data-rvmin="'+esc(v.vsku)+'">−</button>'+
      '<span style="min-width:2ch;text-align:center;font-weight:700;color:'+(v.voorraad<=3?'var(--amber)':'var(--txt)')+';">'+v.voorraad+'</span>'+
      '<button class="obtn" data-rvplus="'+esc(v.vsku)+'">+</button></div>';
  }
  function retailClienteling(canEdit){
    if (retailKlant) return retailKlantDossier(canEdit);
    const kl = retailData.klanten || [];
    let html = '<div class="card"><div class="tt-h">'+T('rt.klantdossier','Clienteling')+' ('+kl.length+')</div>'+
      '<p class="ds" style="margin:0.4rem 0 0.2rem;">'+T('rt.clienteltip','Het geheime wapen van elk modehuis: maten, verlanglijst, aankoophistorie en stylist-notities per klant.')+'</p>'+
      (kl.length ? '<div style="margin-top:0.5rem;display:grid;gap:0.4rem;">'+kl.map(k => '<button class="mitem" data-rklant="'+esc(k.key)+'" style="text-align:left;width:100%;background:var(--card);border:1px solid var(--line);cursor:pointer;"><div class="r1"><span class="nm">'+esc(k.codenaam||k.key)+'</span><span class="pr">'+geld(k.besteedTotaal)+'</span></div><div class="ds">'+k.aankopen+' '+T('rt.aankopen','aankopen')+' · '+(k.wishlist?k.wishlist.length:0)+' '+T('rt.opverlang','op verlanglijst')+'</div></button>').join('')+'</div>'
        : '<div class="empty">'+T('rt.geenklant','Nog geen klantdossiers. Ze ontstaan zodra u een klant erbij pakt op de vloer (PDA) of een verkoop op naam boekt.')+'</div>')+'</div>';
    return html;
  }
  function retailKlantDossier(canEdit){
    const k = retailKlant;
    const maten = retailData.maten || [];
    let html = '<div style="margin-bottom:0.6rem;"><button class="obtn" id="rKlantTerug">← '+T('rt.terug','Terug')+'</button></div>';
    html += '<div class="card"><div class="r1"><span class="nm" style="font-size:1rem;">'+esc(k.codenaam||k.key)+'</span><span class="pr">'+geld(k.besteedTotaal)+'</span></div>'+
      '<div class="ds">'+k.aankopen+' '+T('rt.aankopen','aankopen')+(k.sinds?' · '+T('rt.klantsinds','klant sinds')+' '+esc(String(k.sinds).slice(0,10)):'')+'</div></div>';
    // maten + voorkeuren
    html += '<div class="card"><div class="tt-h">'+T('rt.maten2','Maten & voorkeuren')+'</div>'+
      '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0.4rem;margin-top:0.5rem;">'+
      ['Boven','Onder','Schoen','Jurk','Confectie'].map(cat => '<div class="field" style="margin:0;"><label>'+T('rt.mt.'+cat.toLowerCase(),cat)+'</label><input class="rMaatIn" data-rmaatcat="'+cat+'" value="'+esc((k.maten&&k.maten[cat])||'')+'" style="width:100%;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:0.5rem;font-size:0.85rem;color:var(--txt);outline:none;"></div>').join('')+'</div>'+
      '<div class="field"><label>'+T('rt.voorkeuren','Voorkeuren')+'</label><textarea id="rVoorkeuren" rows="2">'+esc(k.voorkeuren||'')+'</textarea></div>'+
      '<button class="obtn primary" id="rMatenBewaar">'+T('rt.bewaarmaten','Bewaar maten')+'</button></div>';
    // verlanglijst
    html += '<div class="card"><div class="tt-h">'+T('rt.verlanglijst','Verlanglijst')+'</div>'+
      ((k.wishlist&&k.wishlist.length) ? '<div style="margin-top:0.5rem;display:grid;gap:0.4rem;">'+k.wishlist.map(w => '<div class="mitem"><div class="r1"><span class="nm">'+esc(w.naam)+'</span><span class="pr">'+geld(w.price)+'</span></div></div>').join('')+'</div>'
        : '<div class="empty">'+T('rt.geenverlang','Nog niets op de verlanglijst.')+'</div>')+'</div>';
    // historie
    html += '<div class="card"><div class="tt-h">'+T('rt.historie','Aankoophistorie')+'</div>'+
      ((k.historie&&k.historie.length) ? '<div style="margin-top:0.5rem;">'+k.historie.slice().reverse().map(h => '<div class="mitem"><div class="r1"><span class="nm">'+esc(h.naam)+'</span><span class="pr">'+geld(h.bedrag)+'</span></div><div class="ds">'+esc(String(h.at).slice(0,10))+'</div></div>').join('')+'</div>'
        : '<div class="empty">'+T('rt.geenhist','Nog geen aankopen.')+'</div>')+'</div>';
    // notities
    html += '<div class="card"><div class="tt-h">'+T('rt.notities','Stylist-notities')+'</div>'+
      ((k.notities&&k.notities.length) ? '<div style="margin-top:0.5rem;">'+k.notities.slice().reverse().map(n => '<div class="mitem"><div class="ds" style="color:var(--txt);">'+esc(n.tekst)+'</div><div class="ds">'+esc(n.door||'Team')+' · '+esc(String(n.at).slice(0,10))+'</div></div>').join('')+'</div>' : '')+
      '<div style="display:flex;gap:0.4rem;margin-top:0.5rem;"><input id="rNotitie" placeholder="'+T('rt.notitieph','Nieuwe notitie…')+'" style="flex:1;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:0.6rem 0.7rem;font-size:0.85rem;color:var(--txt);outline:none;"><button class="obtn primary" id="rNotitieAdd">'+T('rt.voegtoe','Voeg toe')+'</button></div></div>';
    // stylingvoorstel sturen
    html += '<div class="card"><div class="tt-h">'+T('rt.styling','Stylingvoorstel sturen')+'</div>'+
      '<p class="ds" style="margin:0.3rem 0;">'+T('rt.stylingtip','Kies artikelen; ze verschijnen als voorstel in de app van de klant.')+'</p>'+
      '<div style="max-height:180px;overflow-y:auto;display:grid;gap:0.3rem;margin-top:0.4rem;">'+(retailData.artikelen||[]).map(a => '<label style="display:flex;align-items:center;gap:0.5rem;font-size:0.85rem;"><input type="checkbox" class="rStylPick" value="'+a.id+'"> '+esc(a.naam)+' · '+geld(a.price)+'</label>').join('')+'</div>'+
      '<div class="field"><label>'+T('rt.stylingtitel','Titel')+'</label><input id="rStylTitel" value="'+T('rt.stylingtiteldef','Een selectie voor u')+'"></div>'+
      '<div class="field"><label>'+T('rt.stylingbericht','Bericht')+'</label><input id="rStylBericht" placeholder="'+T('rt.stylingberichtph','Optioneel persoonlijk bericht')+'"></div>'+
      '<button class="obtn primary" id="rStylStuur">'+T('rt.stuurstyling','Stuur voorstel')+'</button></div>';
    return html;
  }
  function retailBindActions(el, canEdit){
    el.querySelectorAll('[data-rpkbreng]').forEach(b => b.addEventListener('click', async () => {
      const paskamer = prompt(T('rt.welkepaskamer','In welke paskamer? (optioneel)')) || '';
      try { await API.call('/supplier/retail/paskamer/breng', { id: b.dataset.rpkbreng, paskamer }); toast(T('rt.gebracht','Gemarkeerd als gebracht.')); await laadRetail(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-rrelease]').forEach(b => b.addEventListener('click', async () => {
      try { const r = await API.call('/supplier/retail/drop/release', { artikelId: b.dataset.rrelease }); toast(T('rt.gereleased','Drop is live')+(r.bericht?' · '+r.bericht+' '+T('rt.opwachtlijst','op de wachtlijst geinformeerd'):'')); await laadRetail(); } catch(e){ toast(e.message); }
    }));
    // collecties
    const colAdd = el.querySelector('#rColAdd');
    if (colAdd) colAdd.addEventListener('click', async () => {
      try { await API.call('/supplier/retail/collectie', { naam: $('#rColNaam').value, seizoen: $('#rColSeiz').value, jaar: Number($('#rColJaar').value) }); toast(T('rt.colok','Collectie toegevoegd.')); await laadRetail(); } catch(e){ toast(e.message); }
    });
    el.querySelectorAll('[data-rcoldel]').forEach(b => b.addEventListener('click', async () => {
      if (!confirm(T('rt.colweg','Deze collectie verwijderen?'))) return;
      try { await API.call('/supplier/retail/collectie', { action:'remove', id: b.dataset.rcoldel }); await laadRetail(); } catch(e){ toast(e.message); }
    }));
    // artikelen
    const artNieuw = el.querySelector('#rArtNieuw');
    if (artNieuw) artNieuw.addEventListener('click', () => { retailArtBewerk = 'nieuw'; renderRetail(); const f = $('#rArtForm'); if (f) f.scrollIntoView({ behavior:'smooth' }); });
    el.querySelectorAll('[data-rartedit]').forEach(b => b.addEventListener('click', () => { retailArtBewerk = b.dataset.rartedit; renderRetail(); const f = $('#rArtForm'); if (f) f.scrollIntoView({ behavior:'smooth' }); }));
    el.querySelectorAll('[data-rartdel]').forEach(b => b.addEventListener('click', async () => {
      if (!confirm(T('rt.artweg','Dit artikel verwijderen?'))) return;
      try { await API.call('/supplier/retail/artikel', { action:'remove', id: b.dataset.rartdel }); toast(T('rt.artwegok','Artikel verwijderd.')); retailArtBewerk = null; await laadRetail(); } catch(e){ toast(e.message); }
    }));
    // artikel-formulier
    let artFotoData = null;
    el.querySelectorAll('[data-rmaat]').forEach(b => b.addEventListener('click', () => b.classList.toggle('primary')));
    const artFoto = el.querySelector('#rArtFoto');
    if (artFoto) artFoto.addEventListener('change', () => { if (artFoto.files && artFoto.files[0]) fileToDataURL(artFoto.files[0], d => { artFotoData = d; const n = $('#rArtFotoNaam'); if (n) n.textContent = T('rt.fotogekozen','foto gekozen'); }); });
    const artAnn = el.querySelector('#rArtAnnuleer');
    if (artAnn) artAnn.addEventListener('click', () => { retailArtBewerk = null; renderRetail(); });
