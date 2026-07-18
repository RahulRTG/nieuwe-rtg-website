    if (kantoorSec === 'tarief'){
      const t2 = (state.settings && state.settings.tarief) || {};
      html += '<div class="tkc"><h3>🧮 '+T('kt.tarief','Tarief')+'</h3>'+
        '<div class="tkc-who">'+T('kt.tarief.s','Elke aanvraag krijgt hiermee direct een vaste nettoprijs voor het lid; u houdt 100%.')+'</div>'+
        '<div class="st-form">'+
        '<label class="soft-xs">'+T('kt.start','Starttarief (€)')+'</label><input class="st-in" id="ktTa" type="number" step="0.1" value="'+(t2.start||0)+'">'+
        '<label class="soft-xs">'+T('kt.perkm','Per kilometer (€)')+'</label><input class="st-in" id="ktTb" type="number" step="0.1" value="'+(t2.perKm||0)+'">'+
        '<label class="soft-xs">'+T('kt.min','Minimumprijs (€)')+'</label><input class="st-in" id="ktTc" type="number" step="1" value="'+(t2.minimum||0)+'">'+
        '<button class="bigbtn" id="ktTSave" style="margin-top:0.2rem;">'+T('kt.tsave','Tarief opslaan')+'</button></div></div>';
    }
    if (kantoorSec === 'diensten'){
      // het aanbod van de zelfstandige: diensten en producten, eigen beheer
      const sv = state.services || [];
      html += '<div class="tkc" style="grid-column:1/-1;"><h3>🗂️ '+T('kt.aanbod','Uw diensten en producten')+' ('+sv.length+')</h3>'+
        (sv.length ? sv.map(x =>
          '<div class="st-row"><span>'+(x.soort==='product'?'📦':'🗓️')+' '+x.name+'<span class="sub">'+(x.desc||'')+(x.duurMin?' · '+x.duurMin+' min':'')+'</span></span>'+
          '<span class="acts"><b style="color:var(--gold);margin-right:0.4rem;">'+eur(x.price)+'</b><button class="obtn warn" data-svdel="'+x.id+'">✕</button></span></div>').join('')
          : '<div class="tkc-who">'+T('kt.geenaanbod','Nog geen aanbod. Voeg hieronder uw eerste dienst of product toe.')+'</div>')+
        '<div class="st-form"><input class="st-in" id="svNaam" placeholder="'+T('kt.svnaam','Naam, bijv. Personal styling')+'">'+
        '<input class="st-in" id="svDesc" placeholder="'+T('kt.svdesc','Korte omschrijving')+'">'+
        '<div class="row-gap"><input class="st-in" id="svPrijs" type="number" placeholder="€" style="flex:1;">'+
        '<input class="st-in" id="svDuur" type="number" placeholder="'+T('kt.svduur','min.')+'" style="flex:1;">'+
        '<select class="st-in" id="svSoort" style="flex:1;"><option value="dienst">'+T('kt.svdienst','Dienst')+'</option><option value="product">'+T('kt.svproduct','Product')+'</option></select></div>'+
        '<button class="bigbtn" id="svAdd" style="margin-top:0.2rem;">'+T('kt.svadd','Zet in de RTG-app')+'</button></div>'+
        '<div class="tkc-who">'+T('kt.svnote','Leden zien dit direct in de app en boeken met datum en tijd; u houdt 100% van de prijs.')+'</div></div>';
    }
    if (kantoorSec === 'prijzen'){
      const h = state.prices || [];
      html += '<div class="tkc"><h3>💶 '+T('kt.newprice','Prijs doorgeven aan RTG')+'</h3>'+
        '<div class="st-form"><input class="st-in" id="kPrS" placeholder="'+T('kt.service','Dienst, bijv. Luchthaven, centrum')+'">'+
        '<input class="st-in" id="kPrP" type="number" inputmode="decimal" placeholder="€">'+
        '<button class="bigbtn" id="kPrSend" style="margin-top:0.2rem;">'+T('kt.sendprice','Verstuur naar RTG')+'</button></div>'+
        '<div class="tkc-who">'+T('kt.pricenote','RTG-leden betalen uw nettoprijs; u ontvangt altijd het volledige bedrag, RTG rekent 0% commissie.')+'</div></div>';
      html += '<div class="tkc"><h3>'+T('sup.pricehist','Eerder doorgegeven')+'</h3>'+
        (h.length ? h.slice(0,10).map(p=>'<div class="st-row"><span>'+p.service+'<span class="sub">'+timeAgo(p.at)+'</span></span><b style="color:var(--gold);">'+eur(p.price)+'</b></div>').join('')
        : '<div class="tkc-who">'+T('sup.noprices','Nog geen prijzen doorgegeven.')+'</div>')+'</div>';
    }
