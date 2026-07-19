    if (kantoorSec === 'marketing'){
      const photos = state.photos || [];
      html += '<div class="tkc"><h3>📷 '+T('sup.photos','Foto\'s op uw pagina')+' ('+photos.length+'/6)</h3>'+
        '<div class="ph-grid" style="margin-top:0.5rem;">'+
        photos.map((p,i)=>'<div class="ph"><img src="'+p+'" alt=""><button data-kphd="'+i+'">✕</button></div>').join('')+
        (photos.length<6?'<label class="ph add">+<input type="file" id="kPhFile" accept="image/jpeg,image/png,image/webp" style="display:none;"></label>':'')+
        '</div><div class="tkc-who">'+T('sup.photonote','Gasten zien deze foto\'s in de RTG-app bij uw pagina, direct na plaatsen.')+'</div></div>';
      html += '<div class="tkc"><h3>📣 '+T('sup.salonpub','Publiceer op De Salon')+'</h3>'+
        '<div class="st-form"><textarea class="st-in" id="kSpText" placeholder="'+T('kt.salonph','Vertel RTG-leden over uw nieuwste aanbod, suite of avond...')+'" style="min-height:70px;resize:vertical;"></textarea>'+
        (photos.length?'<div class="ph-pick">'+photos.map((p,i)=>'<img src="'+p+'" data-kpick="'+i+'" alt="">').join('')+'</div>':'')+
        '<button class="bigbtn" id="kSpPost">'+T('sup.salonpost','Publiceer als RTG-partner')+'</button></div>'+
        '<div class="tkc-who">'+T('sup.salonnote','Uw bericht staat er direct, zonder wachttijd (de 7-dagen-regel geldt alleen voor leden). Alle leden zien het met uw bedrijfsnaam als partner; uw volgers krijgen een melding.')+'</div></div>';
      // het verplichte Salon-bedrijfsaccount met marketinggereedschap en cijfers
      if (!mktData){
        laadMarketing();
        html += '<div class="tkc" style="grid-column:1/-1;"><h3>✦ '+T('mk.salon','Uw Salon-bedrijfsaccount')+'</h3><div class="tkc-who">'+T('kt.laden','Laden...')+'</div></div>';
      } else if (mktData.error){
        html += '<div class="tkc" style="grid-column:1/-1;"><h3>✦ '+T('mk.salon','Uw Salon-bedrijfsaccount')+'</h3><div class="tkc-who">'+mktData.error+'</div></div>';
      } else {
        const mk = mktData;
        if (mktMsg){ html += '<div class="tkc" style="grid-column:1/-1;border-color:var(--gold);">'+mktMsg+'</div>'; }
        html += '<div class="tkc" style="grid-column:1/-1;"><h3>✦ '+T('mk.salon','Uw Salon-bedrijfsaccount')+'</h3>'+
          '<div class="tkc-who">'+T('mk.salon.s','Vast onderdeel van uw RTG-partnerschap: leden volgen uw zaak en krijgen een melding bij elk bericht.')+'</div>'+
          '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:0.55rem;">'+
          [[T('mk.volgers','Volgers'), mk.volgers], [T('mk.posts','Berichten'), mk.posts], ['Likes', mk.likes], [T('mk.reacties','Reacties'), mk.reacties]]
          .map(x => '<div style="background:rgba(255,255,255,0.04);border:1px solid var(--line);border-radius:12px;padding:0.6rem 0.7rem;text-align:center;">'+
            '<div style="font-family:\'Bodoni Moda\',serif;font-size:1.25rem;color:var(--gold);">'+x[1]+'</div>'+
            '<div style="font-size:0.54rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--soft);margin-top:0.1rem;">'+x[0]+'</div></div>').join('')+'</div>'+
          '<div class="st-form"><textarea class="st-in" id="mkBio" placeholder="'+T('mk.bioph','Uw bio op De Salon, bijv. aan zee sinds 1998, drie generaties.')+'" style="min-height:52px;resize:vertical;">'+(mk.bio||'')+'</textarea>'+
          '<button class="obtn primary" id="mkBioSave" style="align-self:flex-start;">'+T('mk.biosave','Bio opslaan')+'</button></div></div>';
        html += '<div class="tkc"><h3>🎁 '+T('mk.deal','Exclusieve aanbieding')+'</h3>'+
          '<div class="tkc-who">'+T('mk.deal.s','Alleen voor leden; zij claimen met een persoonlijke code die u aan de kassa verzilvert. Pure klantbinding.')+'</div>'+
          '<div class="st-form"><input class="st-in" id="mkDt" placeholder="'+T('mk.dealtitel','Titel, bijv. Amuse van het huis')+'">'+
          '<input class="st-in" id="mkDx" placeholder="'+T('mk.dealtekst','Tekst, bijv. Bij elk diner deze maand')+'">'+
          '<input class="st-in" id="mkDg" type="date">'+
          '<button class="bigbtn" id="mkDealGo">'+T('mk.dealgo','Zet op De Salon')+'</button></div>'+
          (mk.deals.length ? mk.deals.map(d2 =>
            '<div class="st-row"><span>'+d2.titel+'<span class="sub">'+(d2.geldigTot?'t/m '+d2.geldigTot+' · ':'')+d2.claims+' '+T('mk.claims','geclaimd')+' · '+d2.verzilverd+' '+T('mk.verzilverd','verzilverd')+'</span></span></div>').join('') : '')+
          '<div style="display:flex;gap:0.5rem;margin-top:0.4rem;"><input class="st-in" id="mkCode" placeholder="RTG-D-XXXXXX" style="flex:1;">'+
          '<button class="obtn" id="mkRedeem">'+T('mk.innen','Verzilver')+'</button></div></div>';
        html += '<div class="tkc"><h3>📊 '+T('mk.poll','Vraag het uw leden (poll)')+'</h3>'+
          '<div class="tkc-who">'+T('mk.poll.s','Marketinginzicht: laat leden kiezen en zie live de uitslag.')+'</div>'+
          '<div class="st-form"><input class="st-in" id="mkPv" placeholder="'+T('mk.pollvraag','Vraag, bijv. welk menu in december?')+'">'+
          '<input class="st-in" id="mkP1" placeholder="'+T('mk.optie','Optie')+' 1"><input class="st-in" id="mkP2" placeholder="'+T('mk.optie','Optie')+' 2"><input class="st-in" id="mkP3" placeholder="'+T('mk.optie','Optie')+' 3 ('+T('mk.optioneel','optioneel')+')">'+
          '<button class="bigbtn" id="mkPollGo">'+T('mk.pollgo','Plaats de poll')+'</button></div>'+
          (mk.polls.length ? mk.polls.map(pl =>
            '<div style="margin-top:0.4rem;"><div class="tkc-who" style="color:var(--txt);">'+pl.vraag+'</div>'+
            pl.opties.map(o => '<div class="st-row" style="padding:0.3rem 0;"><span class="sub">'+o.tekst+'</span><b style="color:var(--gold);">'+o.stemmen+'</b></div>').join('')+'</div>').join('') : '')+'</div>';
      }
    }
    return html;
  }

  function bindKantoor(el){
    el.querySelectorAll('[data-ksec]').forEach(b => b.addEventListener('click', () => { kantoorSec = b.dataset.ksec; kantoorMsg=''; histData = null; histPage = 1; boData = null; finData = null; finMsg = ''; mktData = null; mktMsg = ''; invData = null; vakData = null; vakAiMsg = ''; renderStation(); }));
    // Salon-bedrijfsaccount: bio, aanbiedingen (plaatsen en verzilveren) en polls
    const mkB = el.querySelector('#mkBioSave'); if (mkB) mkB.addEventListener('click', async () => {
      try { await API.call('/supplier/salon/bio', { bio: el.querySelector('#mkBio').value }); mktMsg = '✅ '+T('mk.bioklaar','Bio opgeslagen.'); mktData = null; renderStation(); } catch(e){ toast(e.message); }
    });
    const mkD = el.querySelector('#mkDealGo'); if (mkD) mkD.addEventListener('click', async () => {
      try {
        await API.call('/supplier/salon/deal', { titel: el.querySelector('#mkDt').value, text: el.querySelector('#mkDx').value, geldigTot: el.querySelector('#mkDg').value });
        mktMsg = '🎁 '+T('mk.dealklaar','Aanbieding staat op De Salon; uw volgers hebben een melding gekregen.');
        mktData = null;
        renderStation();
      } catch(e){ toast(e.message); }
    });
    const mkR = el.querySelector('#mkRedeem'); if (mkR) mkR.addEventListener('click', async () => {
      try {
        const d = await API.call('/supplier/salon/deal/redeem', { code: el.querySelector('#mkCode').value });
        mktMsg = '✅ '+T('mk.geind','Verzilverd:')+' <b>'+d.titel+'</b> · '+d.codename;
        mktData = null;
        renderStation();
      } catch(e){ toast(e.message); }
    });
    const mkP = el.querySelector('#mkPollGo'); if (mkP) mkP.addEventListener('click', async () => {
      try {
        await API.call('/supplier/salon/poll', { vraag: el.querySelector('#mkPv').value,
          opties: [el.querySelector('#mkP1').value, el.querySelector('#mkP2').value, el.querySelector('#mkP3').value].filter(x => x && x.trim()) });
        mktMsg = '📊 '+T('mk.pollklaar','Poll staat op De Salon.');
        mktData = null;
        renderStation();
      } catch(e){ toast(e.message); }
    });
    // boekhouding: land en uurloon opslaan, cadeaukaarten en de AI-boekhouder
    const fnS = el.querySelector('#fnSave'); if (fnS) fnS.addEventListener('click', async () => {
      try {
        await API.call('/supplier/settings', { land: el.querySelector('#fnLand').value, uurloon: Number(el.querySelector('#fnUur').value) });
        finData = null; finMsg = '';
        await refresh();
      } catch(e){ toast(e.message); }
    });
    const fnP = el.querySelector('#fnPdf'); if (fnP) fnP.addEventListener('click', () => dlBestand('/supplier/finance/export', { formaat: 'pdf' }, 'RTG-boekhouding.pdf'));
    const fnC = el.querySelector('#fnCsv'); if (fnC) fnC.addEventListener('click', () => dlBestand('/supplier/finance/export', { formaat: 'csv' }, 'RTG-boekhouding.csv'));
