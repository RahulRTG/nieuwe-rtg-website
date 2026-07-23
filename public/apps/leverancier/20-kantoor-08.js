    if (kantoorSec === 'tarief'){
      const t2 = (state.settings && state.settings.tarief) || {};
      html += '<div class="tkc"><h3>'+T('kt.tarief','Tarief')+'</h3>'+
        '<div class="tkc-who">'+T('kt.tarief.s','Elke aanvraag krijgt hiermee direct een vaste nettoprijs voor het lid; u houdt 100%.')+'</div>'+
        '<div class="st-form">'+
        '<label class="soft-xs">'+T('kt.start','Starttarief (€)')+'</label><input class="st-in" id="ktTa" type="number" step="0.1" value="'+(t2.start||0)+'">'+
        '<label class="soft-xs">'+T('kt.perkm','Per kilometer (€)')+'</label><input class="st-in" id="ktTb" type="number" step="0.1" value="'+(t2.perKm||0)+'">'+
        '<label class="soft-xs">'+T('kt.min','Minimumprijs (€)')+'</label><input class="st-in" id="ktTc" type="number" step="1" value="'+(t2.minimum||0)+'">'+
        '<button class="bigbtn" id="ktTSave" style="margin-top:0.2rem;">'+T('kt.tsave','Tarief opslaan')+'</button></div></div>';
    }
    if (kantoorSec === 'vandaag'){
      // het slimme vandaag-bord van de dienstverlener (zzp, chef, wellness)
      if (!vakData){
        laadVakwerk();
        html += '<div class="tkc" style="grid-column:1/-1;"><h3>'+T('kt.vandaag','Vandaag')+'</h3><div class="tkc-who">'+T('kt.laden','Laden...')+'</div></div>';
      } else if (vakData.error){
        html += '<div class="tkc" style="grid-column:1/-1;"><h3>'+T('kt.vandaag','Vandaag')+'</h3><div class="tkc-who">'+vakData.error+'</div></div>';
      } else {
        const v = vakData, k = v.kpi;
        const rij = (b, knop) => '<div class="st-row"><span>'+(b.soort==='product'?'':'')+' '+b.dienst+
          '<span class="sub">'+b.klant+(b.tijd?' · '+b.tijd:(b.datum?' · '+b.datum:' · '+T('kt.geendatum','nog geen datum')))+(b.duurMin?' · '+b.duurMin+' min':'')+'</span></span>'+
          '<span class="acts"><b style="color:var(--gold);margin-right:0.4rem;">'+eur(b.prijs)+'</b>'+(knop||'')+'</span></div>';
        // KPI-strip
        html += '<div class="tkc" style="grid-column:1/-1;"><h3>'+T('kt.vandaag','Vandaag')+' · '+v.label+'</h3>'+
          '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(115px,1fr));gap:0.55rem;">'+
          [[T('vk.omzetvd','Omzet vandaag'), eur(k.omzetVandaag)],
           [T('vk.omzetwk','Deze week'), eur(k.omzetWeek)],
           [T('vk.omzetmnd','Deze maand'), eur(k.omzetMaand)],
           [T('vk.gembon','Gem. bon'), eur(k.gemBon)],
           [T('vk.open','Open aanvragen'), k.openAanvragen],
           [T('vk.bezet','Bezet vandaag'), k.bezetUurVandaag+' u']]
          .map(x => '<div style="background:rgba(255,255,255,0.04);border:1px solid var(--line);border-radius:12px;padding:0.7rem 0.8rem;">'+
            '<div style="font-size:0.54rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--soft);">'+x[0]+'</div>'+
            '<div style="font-family:\'Bodoni Moda\',serif;font-size:1.2rem;color:var(--gold);margin-top:0.15rem;">'+x[1]+'</div></div>').join('')+'</div>'+
          '<div class="tkc-who" style="margin-top:0.5rem;">'+T('vk.nulcom','RTG rekent 0% commissie: deze omzet is volledig van u.')+'</div></div>';
        // aanvragen die op bevestiging wachten
        html += '<div class="tkc" style="grid-column:1/-1;"><h3>'+T('vk.tebev','Wacht op bevestiging')+' ('+v.teBevestigen.length+')</h3>'+
          (v.teBevestigen.length ? v.teBevestigen.map(b => rij(b, '<button class="obtn primary" data-vakbev="'+b.ref+'">'+T('vk.bevestig','Bevestig')+'</button>')).join('')
            : '<div class="tkc-who">'+T('vk.geentebev','Geen openstaande aanvragen.')+'</div>')+'</div>';
        // het vandaag-bord
        html += '<div class="tkc" style="grid-column:1/-1;"><h3>'+T('vk.vandaaglijst','Vandaag')+' ('+v.vandaag.length+')</h3>'+
          (v.vandaag.length ? v.vandaag.map(b => rij(b, b.status==='bevestigd' ? '<button class="obtn" data-vakaf="'+b.ref+'">'+T('vk.afronden','Afronden')+'</button>' : '')).join('')
            : '<div class="tkc-who">'+T('vk.geenvandaag','Vandaag staat er niets in de agenda.')+'</div>')+'</div>';
        // de eerstvolgende afspraken
        if (v.binnenkort.length) html += '<div class="tkc" style="grid-column:1/-1;"><h3>'+T('vk.binnenkort','Binnenkort')+' ('+v.binnenkort.length+')</h3>'+
          v.binnenkort.slice(0,12).map(b => rij(b, '')).join('')+'</div>';
        // boekingen zonder datum die nog gepland moeten worden
        if (v.zonderDatum.length) html += '<div class="tkc" style="grid-column:1/-1;"><h3>'+T('vk.zonderdatum','Nog te plannen')+' ('+v.zonderDatum.length+')</h3>'+
          v.zonderDatum.map(b => rij(b, b.status==='aangevraagd' ? '<button class="obtn primary" data-vakbev="'+b.ref+'">'+T('vk.bevestig','Bevestig')+'</button>' : '')).join('')+'</div>';
        // de beschikbaarheid: werkdagen en openingstijden waarin leden boeken
        if (vakUren){
          const dagNamen = ['Zo','Ma','Di','Wo','Do','Vr','Za'];
          html += '<div class="tkc" style="grid-column:1/-1;"><h3>'+T('vk.beschik','Beschikbaarheid')+'</h3>'+
            '<div class="tkc-who" style="margin-top:0;">'+T('vk.beschik.s','Leden boeken alleen binnen deze werkdagen en tijden; de app biedt vrije tijdvakken aan op basis van de duur van de dienst.')+'</div>'+
            '<div style="display:flex;flex-wrap:wrap;gap:0.4rem;margin:0.5rem 0;">'+
            dagNamen.map((d,i)=>'<button class="obtn'+(vakUren.dagen[i]?' primary':'')+'" data-vakdag="'+i+'">'+d+'</button>').join('')+'</div>'+
            '<div class="row-gap"><label class="soft-xs" style="align-self:center;">'+T('vk.van','Van')+'</label><input class="st-in" id="vakVan" type="time" value="'+vakUren.van+'" style="flex:1;">'+
            '<label class="soft-xs" style="align-self:center;">'+T('vk.tot','Tot')+'</label><input class="st-in" id="vakTot" type="time" value="'+vakUren.tot+'" style="flex:1;"></div>'+
            '<button class="bigbtn" id="vakUrenSave" style="margin-top:0.4rem;">'+T('vk.urenopslaan','Beschikbaarheid opslaan')+'</button></div>';
        }
        // de genre-bewuste AI-assistent
        html += '<div class="tkc" style="grid-column:1/-1;"><h3>'+T('vk.assistent','Meedenken met de assistent')+'</h3>'+
          '<div class="st-form"><input class="st-in" id="vakQ" placeholder="'+T('vk.aiplace','Bijv. waar moet ik me vandaag op richten?')+'">'+
          '<button class="bigbtn" id="vakAi"'+(vakAiBusy?' disabled':'')+'>'+(vakAiBusy?T('vk.aidenkt','De assistent denkt na...'):T('vk.aivraag','Vraag advies'))+'</button></div>'+
          (vakAiMsg ? '<div style="border:1px solid var(--gold);border-radius:12px;padding:0.7rem 0.9rem;font-size:0.85rem;line-height:1.6;white-space:pre-wrap;">'+vakAiMsg+'</div>' : '')+'</div>';
      }
    }
    if (kantoorSec === 'diensten'){
      // het aanbod van de zelfstandige: diensten en producten, eigen beheer
      const sv = state.services || [];
      html += '<div class="tkc" style="grid-column:1/-1;"><h3>'+T('kt.aanbod','Uw diensten en producten')+' ('+sv.length+')</h3>'+
        (sv.length ? sv.map(x =>
          '<div class="st-row"><span>'+(x.soort==='product'?'':'')+' '+x.name+'<span class="sub">'+(x.desc||'')+(x.duurMin?' · '+x.duurMin+' min':'')+'</span></span>'+
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
      html += '<div class="tkc"><h3>'+T('kt.newprice','Prijs doorgeven aan RTG')+'</h3>'+
        '<div class="st-form"><input class="st-in" id="kPrS" placeholder="'+T('kt.service','Dienst, bijv. Luchthaven, centrum')+'">'+
        '<input class="st-in" id="kPrP" type="number" inputmode="decimal" placeholder="€">'+
        '<button class="bigbtn" id="kPrSend" style="margin-top:0.2rem;">'+T('kt.sendprice','Verstuur naar RTG')+'</button></div>'+
        '<div class="tkc-who">'+T('kt.pricenote','RTG-leden betalen uw nettoprijs; u ontvangt altijd het volledige bedrag, RTG rekent 0% commissie.')+'</div></div>';
      html += '<div class="tkc"><h3>'+T('sup.pricehist','Eerder doorgegeven')+'</h3>'+
        (h.length ? h.slice(0,10).map(p=>'<div class="st-row"><span>'+p.service+'<span class="sub">'+timeAgo(p.at)+'</span></span><b style="color:var(--gold);">'+eur(p.price)+'</b></div>').join('')
        : '<div class="tkc-who">'+T('sup.noprices','Nog geen prijzen doorgegeven.')+'</div>')+'</div>';
    }
