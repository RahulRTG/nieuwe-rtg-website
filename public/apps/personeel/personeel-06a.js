  // de voorspeller op de PDA: het team ziet de piek van morgen aankomen
  let vwPda = null, vwPdaBezig = false;
  function laadVwPda(){
    if (vwPdaBezig || vwPda) return;
    vwPdaBezig = true;
    API.call('/staff/voorspel', {}).then(d => { vwPda = d; renderToday(); })
      .catch(() => {}).finally(() => { vwPdaBezig = false; });
  }
  function renderToday(){
    const shift = myShift(0);
    const tasks = taskList();
    $('#todaySub').textContent = new Date().toLocaleDateString(lang()==='en'?'en-GB':'nl-NL', { weekday:'long', day:'numeric', month:'long' });
    const klok = zaken && zaken.klok;
    /* De ochtendkaart: dezelfde kaart voor iedereen, van kantine tot eigenaar.
       Zonder kaart (oudere server, storing) blijft de gewone dienstkop staan. */
    const kaart = ochtend;
    const uur = new Date().getHours();
    const groet = uur < 12 ? T('pd.o.morgen','Goedemorgen') : uur < 18 ? T('pd.o.middag','Goedemiddag') : T('pd.o.avond','Goedenavond');
    const graad = r => r.graad === 'gemeten' ? r.bron : r.graad === 'vermoed' ? T('pd.o.vermoed','vermoed')+' · '+r.bron : T('pd.o.onbekend','niet vast te stellen');
    const kop = kaart
      ? '<div class="k">'+esc(groet+(kaart.naam ? ', '+kaart.naam : ''))+'</div><div class="shift-big">'+esc(kaart.kop)+'</div>'+
        kaart.regels.map(r => '<div class="task"><div class="t"><b>'+esc(r.tekst)+'</b><span>'+esc(graad(r))+'</span></div></div>').join('')
      : '<div class="k">'+T('pd.myshift','Uw dienst vandaag')+'</div><div class="shift-big">'+(shift||T('pd.noshift','Geen dienst'))+'</div>';
    const klokTekst = klok && klok.open ? T('pd.k.uit','Klok uit')
      : '▶ '+(kaart && kaart.knop ? kaart.knop.tekst : T('pd.k.in','Klok in'));
    $('#todayWrap').innerHTML =
      '<div class="card">'+kop+
      (klok ? '<div class="s-8egbf3">'+
        '<span class="s-7igkjy">'+T('pd.k.vandaag','Vandaag')+' <b class="s-1btm41d">'+klok.vandaagUren+' u</b> · '+T('pd.k.week','deze week')+' <b class="s-1btm41d">'+klok.weekUren+' u</b></span>'+
        '<button class="abtn'+(klok.open?'':' ghost')+'" id="klokBtn">'+esc(klokTekst)+'</button></div>' : '')+
      pauzeBlok()+
      '</div>'+
      '<div class="card"><div class="k">'+T('pd.tasksnow','Nu aandacht nodig')+' ('+tasks.length+')</div>'+
      (tasks.length ? tasks.slice(0,6).map(t=>'<div class="task"><span class="ic">'+RTGGlyf.tekst(t.icon)+'</span><div class="t"><b>'+esc(MTX(t.b))+'</b><span>'+esc(MTX(t.s))+'</span></div></div>').join('')
        : '<div class="s-12fq584">✓ '+T('pd.alldone','Alles is bij.')+'</div>')+
      (tasks.length>6?'<div class="s-fxj2rg">+'+(tasks.length-6)+' '+T('pd.more','meer onder Taken')+'</div>':'')+'</div>'+
      (vwPda && vwPda.ok && vwPda.morgen
        ? '<div class="card"><div class="k">'+T('pd.vw','Morgen verwacht')+'</div>'+
          '<div class="s-coirz">'+
          '~<b class="s-1btm41d">'+vwPda.morgen.verwachtTransacties+'</b> '+T('pd.vw.trans','transacties')+' ('+vwPda.morgen.dagNaam+')'+
          (vwPda.morgen.drukUren.length ? ' · '+T('pd.vw.piek','piek rond')+' '+vwPda.morgen.drukUren.map(u=>u.uur+':00').join(', ') : '')+
          '<br>'+esc(vwPda.morgen.advies||'')+'</div></div>'
        : '');
    const nuMissie = horecaMissies.filter(x=>x.status!=='klaar').sort((a,b)=>(a.prioriteit==='hoog'?-1:0)-(b.prioriteit==='hoog'?-1:0))[0];
    if (horecaOverdrachten.length) {
      const o=horecaOverdrachten[0];
      $('#todayWrap').insertAdjacentHTML('afterbegin','<div class="card s-1p274fk"><div class="k" style="color:var(--gold);">GEVERIFIEERDE OVERDRACHT</div><div class="shift-big s-1btm41d">'+esc(o.vanNaam)+' draagt een missie over</div><p class="s-1oe4h5s">De verantwoordelijkheid wisselt pas nadat u accepteert.</p><button class="abtn h-mt70" id="hmAccept">Accepteer overdracht</button></div>');
      $('#hmAccept').addEventListener('click',async()=>{try{await API.call('/supplier/horeca/handover/accept',{id:o.id});toast('Overdracht geaccepteerd.');await laadZaken();renderAll();}catch(e){toast(e.message)}});
    }
    if (nuMissie) {
      $('#todayWrap').insertAdjacentHTML('afterbegin','<div class="card s-o6zcaq">'+
        '<div class="k" style="color:var(--rtg-leesgoud,var(--gold));">RAHUL SERVICE COMPASS · NU</div><div class="shift-big s-1btm41d">'+esc(nuMissie.titel)+'</div>'+
        '<div class="s-hi9xnv">'+esc(nuMissie.sectie)+' · circa '+nuMissie.minuten+' min'+(nuMissie.detail?' · '+esc(nuMissie.detail):'')+'</div>'+
        '<div class="row s-1gqhwia">'+(nuMissie.status==='nieuw'?'<button class="abtn" data-hmnu="'+nuMissie.id+'" data-hmnst="bezig">Start nu</button>':'<button class="abtn" data-hmnu="'+nuMissie.id+'" data-hmnst="klaar">Gereed</button><button class="abtn ghost" data-hmnu="'+nuMissie.id+'" data-hmnst="hulp">Vraag hulp</button><button class="abtn ghost" id="hmDraag">Overdragen</button>')+'<button class="abtn ghost" id="hmAlle">Bekijk hierna</button></div></div>');
      document.querySelectorAll('[data-hmnu]').forEach(b=>b.addEventListener('click',async()=>{
        try{await API.call('/supplier/horeca/missions/status',{id:b.dataset.hmnu,status:b.dataset.hmnst});toast(b.dataset.hmnst==='klaar'?'Missie gereed.':b.dataset.hmnst==='hulp'?'Chef ziet uw hulpvraag.':'Missie gestart.');await laadZaken();renderAll();openTab('vandaag');}catch(e){toast(e.message);}
      }));
      const alle=$('#hmAlle'); if(alle) alle.addEventListener('click',()=>openTab('taken'));
      const draag=$('#hmDraag'); if(draag) draag.addEventListener('click',async()=>{try{const d=await API.call('/supplier/horeca/handover/start',{missieId:nuMissie.id});toast('Overdracht wacht op '+d.overdracht.naarNaam+'.');}catch(e){toast(e.message)}});
    }
    laadVwPda();
    // Service op sterrenniveau: gasten die aandacht vragen en te lang stille
    // tafels staan bovenaan, zodat niemand ooit wordt vergeten.
    const A = (aandacht && aandacht.aandacht) || [], TT = (aandacht && aandacht.traagTafels) || [];
    if (A.length || TT.length){
      let h = '<div class="card s-1p274fk"><div class="k" style="color:var(--rtg-leesgoud,var(--gold));">'+T('pd.attn','Aandacht gevraagd')+' ('+(A.length+TT.length)+')</div>';
      h += A.map(a => '<div class="task"><span class="ic"></span><div class="t"><b>'+esc(a.reden)+(a.tafel?' · '+esc(a.tafel):'')+'</b><span>'+esc(a.codename)+' · '+timeAgo(a.at)+'</span></div><button class="abtn" data-aankl="'+a.id+'">'+T('pd.help','Help')+'</button></div>').join('');
      h += TT.map(t => '<div class="task"><span class="ic"></span><div class="t"><b>'+esc(t.tafel||t.ref)+'</b><span>'+esc(t.codename)+' · '+t.minuten+' min '+T('pd.waiting','zonder aandacht')+'</span></div><button class="abtn ghost" data-coachref="'+esc(t.ref)+'" data-coachtafel="'+esc(t.tafel||t.ref)+'" title="'+T('pd.tr.coachtable','Vraag de coach over deze tafel')+'"></button></div>').join('');
      h += '</div>';
      $('#todayWrap').insertAdjacentHTML('afterbegin', h);
      document.querySelectorAll('[data-aankl]').forEach(b => b.addEventListener('click', async () => {
        try { await API.call('/supplier/aandacht/klaar', { id:b.dataset.aankl }); toast(T('pd.helped','Gast geholpen.')); await refresh(); openTab('vandaag'); } catch(e){ toast(e.message); }
      }));
      document.querySelectorAll('[data-coachref]').forEach(b => b.addEventListener('click', () => {
        coachRef = b.dataset.coachref; coachRefTafel = b.dataset.coachtafel; coachAntwoord = null;
        renderHulp(); openTab('hulp');
        const inp = document.getElementById('coachVraag'); if (inp) inp.focus();
      }));
    }
