/* een prijs doorgeven aan RTG */
    if (kantoorSec === 'prijzen'){
      const h = state.prices || [];
      html += '<div class="tkc"><h3>'+T('kt.newprice','Prijs doorgeven aan RTG')+'</h3>'+
        '<div class="st-form"><input class="st-in" id="kPrS" placeholder="'+T('kt.service','Dienst, bijv. Luchthaven, centrum')+'">'+
        '<input class="st-in" id="kPrP" type="number" inputmode="decimal" placeholder="€">'+
        '<button class="bigbtn h-mt20" id="kPrSend">'+T('kt.sendprice','Verstuur naar RTG')+'</button></div>'+
        '<div class="tkc-who">'+T('kt.pricenote','RTG-leden betalen uw nettoprijs; u ontvangt altijd het volledige bedrag, RTG rekent 0% commissie.')+'</div></div>';
      html += '<div class="tkc"><h3>'+T('sup.pricehist','Eerder doorgegeven')+'</h3>'+
        (h.length ? h.slice(0,10).map(p=>'<div class="st-row"><span>'+p.service+'<span class="sub">'+timeAgo(p.at)+'</span></span><b class="s-12itpbj">'+eur(p.price)+'</b></div>').join('')
        : '<div class="tkc-who">'+T('sup.noprices','Nog geen prijzen doorgegeven.')+'</div>')+'</div>';
    }
    if (kantoorSec === 'marketing'){
      const photos = state.photos || [];
      html += '<div class="tkc"><h3>'+T('sup.photos','Foto\'s op uw pagina')+' ('+photos.length+'/6)</h3>'+
        '<div class="ph-grid h-mt50">'+
        photos.map((p,i)=>'<div class="ph"><img src="'+p+'" alt=""><button data-kphd="'+i+'">✕</button></div>').join('')+
        (photos.length<6?'<label class="ph add">+<input type="file" id="kPhFile" accept="image/jpeg,image/png,image/webp" style="display:none;"></label>':'')+
        '</div><div class="tkc-who">'+T('sup.photonote','Gasten zien deze foto\'s in de RTG-app bij uw pagina, direct na plaatsen.')+'</div></div>';
      html += '<div class="tkc"><h3>'+T('sup.salonpub','Publiceer op De Salon')+'</h3>'+
        '<div class="st-form"><textarea class="st-in s-1olxuka" id="kSpText" placeholder="'+T('kt.salonph','Vertel RTG-leden over uw nieuwste aanbod, suite of avond...')+'"></textarea>'+
        (photos.length?'<div class="ph-pick">'+photos.map((p,i)=>'<img src="'+p+'" data-kpick="'+i+'" alt="">').join('')+'</div>':'')+
        '<button class="bigbtn" id="kSpPost">'+T('sup.salonpost','Publiceer als RTG-partner')+'</button></div>'+
        '<div class="tkc-who">'+T('sup.salonnote','Uw bericht staat er direct, zonder wachttijd (de 7-dagen-regel geldt alleen voor leden). Alle leden zien het met uw bedrijfsnaam als partner; uw volgers krijgen een melding.')+'</div></div>';
      // het verplichte Salon-bedrijfsaccount met marketinggereedschap en cijfers
      if (!mktData){
        laadMarketing();
        html += '<div class="tkc h-volbreed"><h3>✦ '+T('mk.salon','Uw Salon-bedrijfsaccount')+'</h3><div class="tkc-who">'+T('kt.laden','Laden...')+'</div></div>';
      } else if (mktData.error){
        html += '<div class="tkc h-volbreed"><h3>✦ '+T('mk.salon','Uw Salon-bedrijfsaccount')+'</h3><div class="tkc-who">'+mktData.error+'</div></div>';
      } else {
        const mk = mktData;
        if (mktMsg){ html += '<div class="tkc s-9ncju4">'+mktMsg+'</div>'; }
        html += '<div class="tkc h-volbreed"><h3>✦ '+T('mk.salon','Uw Salon-bedrijfsaccount')+'</h3>'+
          '<div class="tkc-who">'+T('mk.salon.s','Vast onderdeel van uw RTG-partnerschap: leden volgen uw zaak en krijgen een melding bij elk bericht.')+'</div>'+
          '<div class="s-116fi4o">'+
          [[T('mk.volgers','Volgers'), mk.volgers], [T('mk.posts','Berichten'), mk.posts], ['Likes', mk.likes], [T('mk.reacties','Reacties'), mk.reacties]]
          .map(x => '<div class="s-1fnwq24">'+
            '<div class="s-c8fkab">'+x[1]+'</div>'+
            '<div class="s-1wpvz51">'+x[0]+'</div></div>').join('')+'</div>'+
          '<div class="st-form"><textarea class="st-in s-1a76yta" id="mkBio" placeholder="'+T('mk.bioph','Uw bio op De Salon, bijv. aan zee sinds 1998, drie generaties.')+'">'+(mk.bio||'')+'</textarea>'+
          '<button class="obtn primary" id="mkBioSave" style="align-self:flex-start;">'+T('mk.biosave','Bio opslaan')+'</button></div></div>';
        html += '<div class="tkc"><h3>'+T('mk.deal','Exclusieve aanbieding')+'</h3>'+
          '<div class="tkc-who">'+T('mk.deal.s','Alleen voor leden; zij claimen met een persoonlijke code die u aan de kassa verzilvert. Pure klantbinding.')+'</div>'+
          '<div class="st-form"><input class="st-in" id="mkDt" placeholder="'+T('mk.dealtitel','Titel, bijv. Amuse van het huis')+'">'+
          '<input class="st-in" id="mkDx" placeholder="'+T('mk.dealtekst','Tekst, bijv. Bij elk diner deze maand')+'">'+
          '<input class="st-in" id="mkDg" type="date">'+
          '<button class="bigbtn" id="mkDealGo">'+T('mk.dealgo','Zet op De Salon')+'</button></div>'+
          (mk.deals.length ? mk.deals.map(d2 =>
            '<div class="st-row"><span>'+d2.titel+'<span class="sub">'+(d2.geldigTot?'t/m '+d2.geldigTot+' · ':'')+d2.claims+' '+T('mk.claims','geclaimd')+' · '+d2.verzilverd+' '+T('mk.verzilverd','verzilverd')+'</span></span></div>').join('') : '')+
          '<div class="s-v4g2d9"><input class="st-in h-flex1" id="mkCode" placeholder="RTG-D-XXXXXX">'+
          '<button class="obtn" id="mkRedeem">'+T('mk.innen','Verzilver')+'</button></div></div>';
        html += '<div class="tkc"><h3>'+T('mk.poll','Vraag het uw leden (poll)')+'</h3>'+
          '<div class="tkc-who">'+T('mk.poll.s','Marketinginzicht: laat leden kiezen en zie live de uitslag.')+'</div>'+
          '<div class="st-form"><input class="st-in" id="mkPv" placeholder="'+T('mk.pollvraag','Vraag, bijv. welk menu in december?')+'">'+
          '<input class="st-in" id="mkP1" placeholder="'+T('mk.optie','Optie')+' 1"><input class="st-in" id="mkP2" placeholder="'+T('mk.optie','Optie')+' 2"><input class="st-in" id="mkP3" placeholder="'+T('mk.optie','Optie')+' 3 ('+T('mk.optioneel','optioneel')+')">'+
          '<button class="bigbtn" id="mkPollGo">'+T('mk.pollgo','Plaats de poll')+'</button></div>'+
          (mk.polls.length ? mk.polls.map(pl =>
            '<div class="h-mt40"><div class="tkc-who s-1btm41d">'+pl.vraag+'</div>'+
            pl.opties.map(o => '<div class="st-row" style="padding:0.3rem 0;"><span class="sub">'+o.tekst+'</span><b class="s-12itpbj">'+o.stemmen+'</b></div>').join('')+'</div>').join('') : '')+'</div>';
      }
      // pr-plus (los script leverancier-pr.js): planner, nieuwsbrief, bereik
      html += '<div id="prPlusWortel" class="s-q28qmq"></div>';
    }
    return html;
  }

  function bindKantoor(el){
    el.querySelectorAll('[data-ksec]').forEach(b => b.addEventListener('click', () => { kantoorSec = b.dataset.ksec; kantoorMsg=''; histData = null; histPage = 1; boData = null; finData = null; finMsg = ''; mktData = null; mktMsg = ''; invData = null; vakData = null; vakAiMsg = ''; vakUren = null; thuisData = null; wvData = null; tresData = null; tresGraaf = null; tresMsg = ''; renderStation(); }));
    // Salon-bedrijfsaccount: bio, aanbiedingen (plaatsen en verzilveren) en polls
    const mkB = el.querySelector('#mkBioSave'); if (mkB) mkB.addEventListener('click', async () => {
      try { await API.call('/supplier/salon/bio', { bio: el.querySelector('#mkBio').value }); mktMsg = ''+T('mk.bioklaar','Bio opgeslagen.'); mktData = null; renderStation(); } catch(e){ toast(e.message); }
    });
    const mkD = el.querySelector('#mkDealGo'); if (mkD) mkD.addEventListener('click', async () => {
      try {
        await API.call('/supplier/salon/deal', { titel: el.querySelector('#mkDt').value, text: el.querySelector('#mkDx').value, geldigTot: el.querySelector('#mkDg').value });
        mktMsg = ''+T('mk.dealklaar','Aanbieding staat op De Salon; uw volgers hebben een melding gekregen.');
        mktData = null;
        renderStation();
      } catch(e){ toast(e.message); }
    });
    const mkR = el.querySelector('#mkRedeem'); if (mkR) mkR.addEventListener('click', async () => {
      try {
        const d = await API.call('/supplier/salon/deal/redeem', { code: el.querySelector('#mkCode').value });
        mktMsg = ''+T('mk.geind','Verzilverd:')+' <b>'+d.titel+'</b> · '+d.codename;
        mktData = null;
        renderStation();
      } catch(e){ toast(e.message); }
    });
    const mkP = el.querySelector('#mkPollGo'); if (mkP) mkP.addEventListener('click', async () => {
      try {
        await API.call('/supplier/salon/poll', { vraag: el.querySelector('#mkPv').value,
          opties: [el.querySelector('#mkP1').value, el.querySelector('#mkP2').value, el.querySelector('#mkP3').value].filter(x => x && x.trim()) });
        mktMsg = ''+T('mk.pollklaar','Poll staat op De Salon.');
        mktData = null;
        renderStation();
      } catch(e){ toast(e.message); }
    });
    // boekhouding: land en uurloon opslaan, cadeaukaarten en de AI-boekhouder
