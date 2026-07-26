    if (kantoorSec === 'keuken' || kantoorSec === 'bar'){
      const stn = kantoorSec;
      const items = (state.menu||[]).filter(m=>(m.station==='bar')===(stn==='bar'));
      const KANTEN = { warm:'Warme kant', koud:'Koude kant', snack:'Snacks', dessert:'Desserts' };
      // de kaart-bewerker: de chef past alles per gerecht aan, ook het vuurplan
      const bewerker = x => '<div class="st-form" data-kedit-form="'+x.id+'" style="border:1px solid var(--line);border-radius:12px;padding:0.7rem;margin:0.3rem 0 0.5rem;">'+
        '<input class="st-in" data-kf="name" value="'+escT(x.name)+'" placeholder="'+T('menu.name','Naam')+'">'+
        '<div class="row-gap"><input class="st-in" data-kf="cat" value="'+escT(x.cat||'')+'" placeholder="'+T('menu.cat','Categorie')+'" style="flex:2;"><input class="st-in" data-kf="price" type="number" inputmode="decimal" value="'+x.price+'" placeholder="\u20ac" style="flex:1;"></div>'+
        '<input class="st-in" data-kf="desc" value="'+escT(x.desc||'')+'" placeholder="'+T('kt.m.desc','Omschrijving (voor gast en keuken)')+'">'+
        (stn==='keuken'
          ? '<div class="row-gap"><select class="st-in" data-kf="sectie" style="flex:2;">'+Object.keys(KANTEN).map(k=>'<option value="'+k+'"'+((x.sectie||'warm')===k?' selected':'')+'>'+T('ks.'+k, KANTEN[k])+'</option>').join('')+'</select>'+
            '<input class="st-in" data-kf="prepMin" type="number" inputmode="numeric" value="'+(x.prepMin||'')+'" placeholder="'+T('kt.m.vuur','vuurplan-min')+'" style="flex:1;" title="'+T('kt.m.vuur.t','Bereidingstijd in minuten voor het vuurplan; leeg = de standaardtijd van de kant')+'"></div>'
          : '')+
        '<input class="st-in" data-kf="allergens" value="'+escT((x.allergens||[]).join(', '))+'" placeholder="'+T('kt.m.alg','Allergenen, met komma ertussen')+'">'+
        '<div class="row-gap"><button class="bigbtn" data-ksave="'+x.id+'" style="flex:1;">'+T('kt.m.save','Opslaan')+'</button>'+
        '<button class="obtn" data-kedit="'+x.id+'">'+T('kt.m.klaar','Klaar')+'</button></div></div>';
      html += '<div class="tkc" style="grid-column:1/-1;"><h3>'+(stn==='bar'?'\uD83C\uDF78 Bar':'\uD83D\uDD25 '+T('kt.keuken','Keuken'))+' \u00b7 '+items.length+' '+T('kt.items','items op de kaart')+'</h3>'+
        (items.length ? items.map(x=>'<div class="st-row"><span>'+x.name+(x.uitverkocht?' <b style="color:#FF8589;">86</b>':'')+
          '<span class="sub">'+x.cat+' \u00b7 '+eur(x.price)+(stn==='keuken'?' \u00b7 '+T('ks.'+(x.sectie||'warm'), KANTEN[x.sectie||'warm'])+(x.prepMin?' \u00b7 \uD83D\uDD25 '+x.prepMin+' min':''):'')+'</span></span>'+
          '<span class="acts"><button class="obtn'+(kantoorEdit===x.id?' primary':'')+'" data-kedit="'+x.id+'">\u270E</button><button class="obtn" data-kst="'+x.id+'">\u21c4 '+(stn==='bar'?T('kt.tokeuken','naar keuken'):T('kt.tobar','naar bar'))+'</button><button class="obtn warn" data-kmdel="'+x.id+'">\u2715</button></span></div>'+
          (kantoorEdit===x.id ? bewerker(x) : '')).join('')
        : '<div class="tkc-who">'+T('kt.noitems','Nog niets op de kaart voor deze werkplek.')+'</div>')+
        '<div class="st-form"><input class="st-in" id="ktMn" placeholder="'+T('menu.name','Naam')+'"><div class="row-gap"><input class="st-in" id="ktMc" placeholder="'+T('menu.cat','Categorie')+'" style="flex:2;"><input class="st-in" id="ktMp" type="number" inputmode="decimal" placeholder="\u20ac" style="flex:1;"></div>'+
        '<button class="bigbtn" id="ktMAdd" style="margin-top:0.2rem;">'+T('kt.addcard','Zet op de kaart bij ')+(stn==='bar'?'de bar':T('kt.dekitchen','de keuken'))+'</button></div></div>';
      if (stn === 'keuken'){
        // de AI-inkoop: vaste leverancier koppelen, voorstellen goedkeuren of aanpassen
        if (!agentData){
          html += '<div class="tkc" style="grid-column:1/-1;"><h3>\ud83e\udde0 '+T('ag2.h','AI-inkoop')+'</h3><div class="tkc-who">\u2026</div></div>';
          laadAgent();
        } else {
          const A = agentData;
          html += '<div class="tkc" style="grid-column:1/-1;"><h3>\ud83e\udde0 '+T('ag2.h','AI-inkoop')+'</h3>'+
            '<div class="tkc-who">'+T('ag2.deck','De AI stelt de inkoop voor op de verkoop, de mise en place en de verwachte drukte. De gemachtigde keurt goed, past aan of wijst af; pas dan wordt er echt besteld bij de vaste leverancier.')+'</div>'+
            // meerdere groothandels: elke gekoppelde staat als chip met een weg-knop
            ((A.partners||[]).length ? '<div style="display:flex;gap:0.4rem;flex-wrap:wrap;margin-bottom:0.4rem;">'+
              A.partners.map(p=>'<span style="display:inline-flex;align-items:center;gap:0.4rem;border:1px solid var(--gold);border-radius:999px;padding:0.3rem 0.7rem;font-size:0.74rem;">\ud83d\udce6 '+p.naam+
                '<button data-agweg="'+p.code+'" style="background:none;border:none;color:var(--soft);cursor:pointer;font-size:0.8rem;" title="'+T('ag2.weg','loskoppelen')+'">\u2715</button></span>').join('')+'</div>' : '')+
            '<div class="row-gap"><select class="st-in" id="agGh" style="flex:2;"><option value="">'+T('ag2.kies2','Groothandel erbij...')+'</option>'+
              (agentMarkt||[]).filter(g=>!(A.partners||[]).find(p=>p.code===g.code)).map(g=>'<option value="'+g.code+'">'+g.name+'</option>').join('')+'</select>'+
              '<label style="display:flex;align-items:center;gap:0.35rem;font-size:0.72rem;color:var(--muted);"><input type="checkbox" id="agAuto"'+(A.auto?' checked':'')+'>'+T('ag2.auto','automatisch na de MEP-voorspelling')+'</label></div>'+
            '<div class="tkc-act"><button class="tkc-start" id="agKoppel">'+T('ag2.koppel2','Koppel erbij')+'</button>'+
            ((A.partners||[]).length?'<button class="tkc-ready" id="agStel">\u2728 '+T('ag2.stel','Stel inkoop voor')+'</button>':'')+'</div>'+
            ((A.partners||[]).length>1?'<div class="tkc-who" style="margin-top:0.3rem;">'+T('ag2.multi','De AI vergelijkt de gekoppelde groothandels per bestelling en kiest de beste dekking en prijs.')+'</div>':'')+
            (A.voorstellen||[]).slice(0,3).map(v=>{
              const wacht = v.status === 'wacht-op-goedkeuring';
              return '<div style="border:1px solid var(--line);border-radius:12px;padding:0.7rem;margin-top:0.5rem;">'+
                '<div class="tkc-top"><span style="font-weight:600;">'+(v.groothandelNaam||'')+' \u00b7 \u20ac '+v.totaal+'</span><span class="tkc-age">'+(wacht?'\u23f3 '+T('ag2.wacht','wacht op de gemachtigde'):v.status+(v.ref?' \u00b7 '+v.ref:''))+'</span></div>'+
                '<div class="tkc-who">'+v.uitleg+'</div>'+
                (v.regels||[]).slice(0,10).map(r=>'<div class="st-row"><span>'+r.naam+'<span class="sub">'+(r.reden||'')+' \u00b7 \u20ac '+r.prijs+' / '+(r.eenheid||'st')+'</span></span>'+
                  (wacht?'<input class="st-in" style="width:4.5rem;flex:none;" type="number" min="1" value="'+r.aantal+'" data-agr="'+v.id+'" data-pid="'+r.productId+'">':'<span class="sub">'+r.aantal+'\u00d7</span>')+'</div>').join('')+
                (wacht?'<div class="tkc-act"><button class="tkc-ready" data-agok="'+v.id+'">\u2714 '+T('ag2.ok','Keur goed en bestel')+'</button><button class="obtn warn" data-agnee="'+v.id+'" style="margin-left:0.5rem;">'+T('ag2.nee','Wijs af')+'</button></div>':'')+
              '</div>';
            }).join('')+'</div>';
        }
      }
    }
    if (kantoorSec === 'bediening'){
      const st2 = state.settings || {};
      html += '<div class="tkc"><h3>'+T('kt.open','Open of dicht')+'</h3>'+
        '<div class="st-row"><span>'+T('bh.orders','Bestellingen')+'<span class="sub">'+T('kt.orders.s','Leden kunnen bestellen via de app')+'</span></span><button class="obtn'+(st2.ordersOpen!==false?' primary':' warn')+'" data-ktoggle="ordersOpen">'+(st2.ordersOpen!==false?T('kt.isopen','Open'):T('kt.isclosed','Dicht'))+'</button></div>'+
        '<div class="st-row"><span>'+T('bh.res','Reserveringen')+'<span class="sub">'+T('kt.res.s','Nieuwe reserveringen aannemen')+'</span></span><button class="obtn'+(st2.reservationsOpen!==false?' primary':' warn')+'" data-ktoggle="reservationsOpen">'+(st2.reservationsOpen!==false?T('kt.isopen','Open'):T('kt.isclosed','Dicht'))+'</button></div></div>';
      html += '<div class="tkc"><h3>'+T('kt.tafels','Tafelindeling')+'</h3>'+
        (state.tables||[]).map(t=>'<div class="st-row"><span>'+t.name+'<span class="sub">'+t.seats+' '+T('tbl.pers','pers.')+' \u00b7 '+tTbl(t.status)+'</span></span>'+
          '<span class="acts"><button class="obtn" data-sttbl="'+t.id+'" data-cur="'+t.status+'">\u21bb</button><button class="obtn warn" data-ktdel="'+t.id+'">\u2715</button></span></div>').join('')+
        '<div class="st-form"><div class="row-gap"><input class="st-in" id="ktTn" placeholder="'+T('kt.tafelnaam','Tafelnaam')+'" style="flex:2;"><input class="st-in" id="ktTs" type="number" placeholder="4" style="flex:1;"></div>'+
        '<button class="bigbtn" id="ktTAdd" style="margin-top:0.2rem;">'+T('kt.tafeladd','Tafel toevoegen')+'</button></div></div>';
    }
