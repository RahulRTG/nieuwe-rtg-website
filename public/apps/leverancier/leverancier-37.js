/* de collecties van een retailzaak */
    const cols = retailData.collecties || [];
    html += '<div class="card"><div class="tt-h">'+T('rt.collecties','Collecties')+'</div>'+
      (cols.length ? '<div class="h-mt50">'+cols.map(c => '<div class="mitem"><div class="r1"><span class="nm">'+esc(c.naam)+'</span><span class="pr">'+esc(c.seizoen)+' '+c.jaar+'</span></div>'+
        (canEdit?'<div class="h-mt40"><button class="obtn warn" data-rcoldel="'+c.id+'">'+T('rt.verwijder','Verwijder')+'</button></div>':'')+'</div>').join('')+'</div>'
        : '<div class="empty">'+T('rt.geencoll','Nog geen collecties.')+'</div>')+
      (canEdit ? '<div style="margin-top:0.75rem;display:grid;grid-template-columns:1fr auto auto auto;gap:0.4rem;align-items:end;">'+
        '<div class="field" style="margin:0;"><label>'+T('rt.f.collnaam','Naam')+'</label><input id="rColNaam" placeholder="'+T('rt.f.collnaamph','Bijv. Riviera')+'"></div>'+
        '<div class="field" style="margin:0;"><label>'+T('rt.f.seizoen','Seizoen')+'</label><select id="rColSeiz" '+rSelStyle()+'>'+(retailData.seizoenen||['SS','AW']).map(s=>'<option>'+s+'</option>').join('')+'</select></div>'+
        '<div class="field" style="margin:0;width:70px;"><label>'+T('rt.f.jaar','Jaar')+'</label><input id="rColJaar" type="number" value="'+(new Date().getFullYear())+'"></div>'+
        '<button class="obtn primary" id="rColAdd">'+T('rt.f.voeg','Voeg toe')+'</button></div>' : '')+'</div>';
    // artikelen
    const arts = retailData.artikelen || [];
    html += '<div class="card"><div class="tt-h">'+T('rt.artikelen2','Artikelen')+' ('+arts.length+')</div>'+
      (arts.length ? '<div style="margin-top:0.5rem;display:grid;gap:0.5rem;">'+arts.map(a => {
        const drop = a.drop && !a.drop.gereleased ? '<span class="pill" style="color:var(--rtg-leesgoud,var(--gold));border-color:rgba(212,175,55,0.4);margin-left:0.3rem;">'+T('rt.drop','drop')+' '+esc(a.drop.datum)+'</span>' : '';
        return '<div class="mitem"><div style="display:flex;gap:0.7rem;">'+
          (a.foto ? '<img src="'+esc(a.foto)+'" alt="'+esc(a.naam)+'" style="width:52px;height:64px;object-fit:cover;border-radius:0;flex-shrink:0;">' : '<div style="width:52px;height:64px;border-radius:0;background:var(--card2);display:flex;align-items:center;justify-content:center;flex-shrink:0;"></div>')+
          '<div style="flex:1;min-width:0;"><div class="r1"><span class="nm">'+esc(a.naam)+drop+'</span><span class="pr">'+geld(a.price)+'</span></div>'+
          '<div class="ds">'+esc(collNaam(a.collectieId))+' · '+esc(a.categorie||'')+'</div>'+
          '<div class="ds">'+esc((a.varianten||[]).map(v=>v.kleur).filter((x,i,z)=>z.indexOf(x)===i).join(', '))+' · '+T('rt.totvoorraad','voorraad')+' '+(a.voorraad||0)+'</div>'+
          (canEdit?'<div style="margin-top:0.5rem;display:flex;gap:0.4rem;"><button class="obtn" data-rartedit="'+a.id+'">'+T('rt.bewerk','Bewerk')+'</button><button class="obtn warn" data-rartdel="'+a.id+'">'+T('rt.verwijder','Verwijder')+'</button></div>':'')+
          '</div></div></div>';
      }).join('')+'</div>' : '<div class="empty">'+T('rt.geenart','Nog geen artikelen.')+'</div>')+
      (canEdit ? '<div class="h-mt80"><button class="obtn primary" id="rArtNieuw">'+T('rt.nieuwart','+ Nieuw artikel')+'</button></div>' : '')+'</div>';
    // artikel-formulier
    if (canEdit && retailArtBewerk) html += retailArtikelForm();
    return html;
  }
  function retailArtikelForm(){
    const a = retailArtBewerk === 'nieuw' ? null : (retailData.artikelen||[]).find(x => x.id === retailArtBewerk);
    const maten = retailData.maten || ['XS','S','M','L','XL','XXL'];
    const gekozenM = a ? [...new Set((a.varianten||[]).map(v=>v.maat))] : ['S','M','L'];
    const kleuren = a ? [...new Set((a.varianten||[]).map(v=>v.kleur))].join(', ') : '';
    return '<div class="card" id="rArtForm"><div class="tt-h">'+(a?T('rt.bewerkart','Artikel bewerken'):T('rt.nieuwart2','Nieuw artikel'))+'</div>'+
      '<div class="field"><label>'+T('rt.f.naam','Naam')+'</label><input id="rArtNaam" value="'+esc(a?a.naam:'')+'" placeholder="'+T('rt.f.naamph','Bijv. Zijden slipdress')+'"></div>'+
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;">'+
        '<div class="field"><label>'+T('rt.f.sku','SKU')+'</label><input id="rArtSku" value="'+esc(a?a.sku:'')+'" placeholder="'+T('rt.optioneel','optioneel')+'"></div>'+
        '<div class="field"><label>'+T('rt.f.cat','Categorie')+'</label><input id="rArtCat" value="'+esc(a?a.categorie:'')+'" placeholder="'+T('rt.f.catph','Bijv. Jurken')+'"></div>'+
      '</div>'+
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;">'+
        '<div class="field"><label>'+T('rt.f.materiaal','Materiaal')+'</label><input id="rArtMat" value="'+esc(a?a.materiaal:'')+'" placeholder="'+T('rt.f.materiaalph','Bijv. 100% zijde')+'"></div>'+
        '<div class="field"><label>'+T('rt.f.prijs','Publieke prijs (€)')+'</label><input id="rArtPrijs" type="number" step="0.01" value="'+(a?a.publiekePrijs:'')+'"></div>'+
      '</div>'+
      '<div class="field"><label>'+T('rt.f.coll','Collectie')+'</label><select id="rArtColl" '+rSelStyle()+'>'+(retailData.collecties||[]).map(c=>'<option value="'+c.id+'"'+(a&&a.collectieId===c.id?' selected':'')+'>'+esc(c.seizoen+' '+c.jaar+' · '+c.naam)+'</option>').join('')+'</select></div>'+
      '<div class="field"><label>'+T('rt.f.oms','Omschrijving')+'</label><textarea id="rArtOms" rows="2">'+esc(a?a.omschrijving:'')+'</textarea></div>'+
      '<div class="field"><label>'+T('rt.f.kleuren','Kleuren (komma’s)')+'</label><input id="rArtKleuren" value="'+esc(kleuren)+'" placeholder="'+T('rt.f.kleurenph','Bijv. Zwart, Ivoor, Camel')+'"></div>'+
      '<div class="field"><label>'+T('rt.f.maten','Maten')+'</label><div id="rArtMaten" style="display:flex;flex-wrap:wrap;gap:0.4rem;">'+
        maten.map(m => '<button type="button" class="obtn rmaat'+(gekozenM.includes(m)?' primary':'')+'" data-rmaat="'+m+'">'+m+'</button>').join('')+'</div></div>'+
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;">'+
        '<div class="field"><label>'+T('rt.f.startvoorraad','Startvoorraad p. maat')+'</label><input id="rArtVoorraad" type="number" value="'+(a?'':'8')+'" placeholder="'+T('rt.optioneel','optioneel')+'"></div>'+
        '<div class="field"><label>'+T('rt.f.drop','Drop-datum')+'</label><input id="rArtDrop" type="date" value="'+esc(a&&a.drop?a.drop.datum:'')+'"></div>'+
      '</div>'+
      '<div class="field"><label>'+T('rt.f.foto','Foto')+'</label><label class="obtn" style="cursor:pointer;">'+T('rt.f.kiesfoto','Kies foto')+'<input type="file" id="rArtFoto" accept="image/*" style="display:none;"></label> <span id="rArtFotoNaam" style="font-size:0.75rem;color:var(--muted);">'+(a&&a.foto?T('rt.fotoaanwezig','foto aanwezig'):'')+'</span></div>'+
      '<div style="margin-top:0.75rem;display:flex;gap:0.5rem;"><button class="obtn primary" id="rArtBewaar">'+T('rt.bewaar','Bewaar artikel')+'</button><button class="obtn" id="rArtAnnuleer">'+T('rt.annuleer','Annuleer')+'</button></div></div>';
  }
  function retailVoorraadView(){
    let html = '<div class="card"><div class="tt-h">'+T('rt.zoekvoorraad','Voorraad opzoeken')+'</div>'+
      '<div style="display:flex;gap:0.4rem;margin-top:0.5rem;"><input id="rZoek" placeholder="'+T('rt.zoekph','Naam, kleur of maat…')+'" style="flex:1;background:var(--card);border:1px solid var(--line);border-radius:0;padding:0.7rem 0.8rem;font-size:0.9rem;color:var(--txt);outline:none;"><button class="obtn primary" id="rZoekBtn">'+T('rt.zoek','Zoek')+'</button></div>'+
      '<div class="h-mt60" id="rZoekUit"></div></div>';
    // alle varianten met snelle bijstelknoppen
    html += '<div class="card"><div class="tt-h">'+T('rt.allevoorraad','Alle voorraad')+'</div><div class="h-mt50">'+
      (retailData.artikelen||[]).map(a => '<div style="margin-bottom:0.75rem;"><div style="font-size:0.85rem;font-weight:600;margin-bottom:0.25rem;">'+esc(a.naam)+'</div>'+
        (a.varianten||[]).map(v => retailVariantRij(v)).join('')+'</div>').join('') + '</div></div>';
    return html;
  }
  function retailVariantRij(v){
    return '<div class="mitem" style="display:flex;align-items:center;gap:0.5rem;"><div style="flex:1;min-width:0;"><div class="nm">'+esc(v.kleur)+' · '+esc(v.maat)+'</div><div class="ds">'+esc(v.vsku)+'</div></div>'+
      '<button class="obtn" data-rvmin="'+esc(v.vsku)+'">−</button>'+
      '<span style="min-width:2ch;text-align:center;font-weight:700;color:'+(v.voorraad<=3?'var(--amber)':'var(--txt)')+';">'+v.voorraad+'</span>'+
      '<button class="obtn" data-rvplus="'+esc(v.vsku)+'">+</button></div>';
  }
  function retailClienteling(canEdit){
    if (retailKlant) return retailKlantDossier(canEdit);
    const kl = retailData.klanten || [];
