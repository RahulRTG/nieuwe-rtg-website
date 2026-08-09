  /* ---- de btw-aangifte van de zaak (server: kern/fiscaal/btwaangifte.js) ----

     Dit scherm rekent zelf NIETS uit. Het toont wat de aangifte zegt, en die
     komt uit het factuurregister. Een tweede optelling hier zou een tweede
     btw-motor zijn, en de hele opzet van die laag is dat er er maar een is. Ook
     de periodegrenzen komen van de server mee (van/tot); hier worden alleen de
     labels 2026K3 gemaakt.

     De weigeringen worden letterlijk getoond en niet vertaald naar iets
     vriendelijkers: "de periode loopt nog", "de cijfers zijn veranderd" en "al
     ingediend" zijn precies wat de ondernemer moet lezen.

     Een eigen deelbestand OP DEZE PLEK, en niet aan het eind van een deel: de
     delen worden rauw aaneengeplakt, dus de plek in de stroom bepaalt in welke
     scope een functie staat. Hier, vlak na laadFinance, is dat de scope van de
     app zelf, en kunnen renderStation (deel 15) en de bedrading (deel 22) er
     allebei bij. Aan het eind van deel 12 zat dit middenin een andere functie
     en was het op het scherm een ReferenceError; check.js regel 42 wees dat aan. */
  let btwData = null, btwBusy = false, btwOpen = null, btwMsg = '';
  async function laadBtw(){
    if (btwBusy) return;
    btwBusy = true;
    try { btwData = await API.call('/supplier/btw/aangiftes', {}); }
    catch(e){ btwData = { error: e.message, aangiftes: [] }; }
    btwBusy = false;
    renderStation();
  }
  function btwPeriodes(){
    const d = new Date(); const uit = [];
    let j = d.getUTCFullYear(), k = Math.floor(d.getUTCMonth() / 3) + 1;
    for (let i = 0; i < 5; i++){ uit.push(j + 'K' + k); k -= 1; if (k === 0){ k = 4; j -= 1; } }
    return uit;
  }
  function btwDetail(a){
    if (!a) return '';
    const rijen = (a.tarieven || []).map(r =>
      '<div class="st-row"><span>'+T('fn.btwomzet','Omzet')+' '+r.tarief+'%'+
      '<span class="sub">'+(r.rubriek ? T('fn.btwrub','rubriek')+' '+r.rubriek+' · ' : '')+
        T('fn.grondslag','grondslag')+' '+eur(r.omzetCenten/100)+'</span>'+
      '</span><b class="btw-btw">'+eur(r.btwCenten/100)+'</b></div>').join('')
      || '<div class="tkc-who">'+T('fn.btwleeg','Geen facturen in deze periode.')+'</div>';
    const terug = a.saldoCenten < 0;
    return '<div class="btw-blok">'+
      '<div class="st-row"><span><b>'+escT(a.periode)+'</b>'+(a.soort === 'correctie' ? ' ('+T('fn.btwcorr','correctie')+')' : '')+
        '<span class="sub">'+escT(a.van)+' t/m '+escT(a.tot)+' · '+a.verkoopFacturen+' '+T('fn.btwvk','verkoopfacturen')+
        ' · '+a.inkoopFacturen+' '+T('fn.btwik','inkoopfacturen')+'</span></span>'+
        '<span class="sub">'+(a.stand === 'ingediend' ? T('fn.btwin','ingediend') : T('fn.btwcon','concept'))+'</span></div>'+
      rijen+
      '<div class="st-row streep"><span>'+T('fn.btwversch','Verschuldigde btw')+'</span><b>'+eur(a.verschuldigdCenten/100)+'</b></div>'+
      '<div class="st-row"><span>'+T('fn.btwvoor','Voorbelasting')+'<span class="sub">'+T('fn.btwvoor.s','btw op uw inkoopfacturen')+'</span></span><b>- '+eur(a.voorbelastingCenten/100)+'</b></div>'+
      '<div class="st-row streep"><span><b>'+(terug ? T('fn.btwterug','Terug te vragen') : T('fn.btwbetaal','Te betalen'))+'</b></span>'+
        '<b class="btw-saldo '+(terug ? 'terug' : 'betaal')+'">'+eur(Math.abs(a.saldoCenten)/100)+'</b></div>'+
      (a.verschilCenten != null ? '<div class="tkc-who">'+T('fn.btwversch2','Verschil met de ingediende aangifte')+': '+eur(a.verschilCenten/100)+'</div>' : '')+
      (a.let ? '<div class="tkc-who">'+escT(a.let)+'</div>' : '')+
      (a.stand === 'ingediend'
        ? '<div class="tkc-who">'+T('fn.btwinop','Ingediend op')+' '+escT(String(a.ingediendOp).slice(0, 10))+' '+T('fn.btwdoor','door')+' '+
            escT(a.ingediendDoor)+' · '+T('fn.btwkenmerk','kenmerk')+' '+escT(a.kenmerk)+'</div>'+
          '<button class="obtn" id="btwCorr" data-p="'+escT(a.periode)+'">'+T('fn.btwmaakcorr','Correctie opmaken')+'</button>'
        : a.periodeLoopt ? ''
        : '<div class="btw-rij">'+
          '<input class="st-in btw-kenmerk" id="btwKenmerk" placeholder="'+T('fn.btwkenmerk.ph','Kenmerk van de Belastingdienst')+'">'+
          '<button class="obtn primary" id="btwDien" data-id="'+escT(a.id)+'">'+T('fn.btwdien','Indienen vastleggen')+'</button></div>')+
      '</div>';
  }
  /* De kaart. Bewust NAAST "Btw deze maand" en niet als hetzelfde getal
     eronder: dat bord is de maandstand uit de kassa en de boekingen, de
     aangifte is de periode uit het factuurregister. Twee verschillende vragen,
     en ze horen niet als een cijfer gepresenteerd te worden. */
  function btwKaart(){
    if (!btwData && !btwBusy) laadBtw();
    const eerder = ((btwData && btwData.aangiftes) || []).slice().sort((a, b) => (a.periode < b.periode ? 1 : -1));
    const toon = btwOpen || eerder[0] || null;
    return '<div class="tkc h-volbreed"><h3>'+T('fn.btwaan','Btw-aangifte')+'</h3>'+
      '<div class="tkc-who">'+T('fn.btwaan.s','Opgemaakt uit uw factuurregister: elke regel telt mee met het tarief dat erop staat. Omzet zonder factuur staat er niet in. Controleren en indienen doet u zelf; RTG dient nooit voor u in en verzendt niets.')+'</div>'+
      '<div class="btw-rij">'+
      '<select class="st-in btw-per" id="btwPer">'+
      btwPeriodes().map(p => '<option value="'+p+'"'+(toon && toon.periode === p ? ' selected' : '')+'>'+p+'</option>').join('')+'</select>'+
      '<button class="obtn primary" id="btwOp">'+T('fn.btwopmaak','Opmaken')+'</button></div>'+
      (btwMsg ? '<div class="tkc-who btw-melding">'+escT(btwMsg)+'</div>' : '')+
      (btwData && btwData.error ? '<div class="tkc-who">'+escT(btwData.error)+'</div>' : '')+
      btwDetail(toon)+
      (eerder.length > 1 ? '<div class="tkc-who btw-eerder">'+T('fn.btweerder','Eerder')+': '+
        eerder.slice(1, 6).map(a => escT(a.periode)+' ('+(a.stand === 'ingediend' ? T('fn.btwin','ingediend') : T('fn.btwcon','concept'))+')').join(' · ')+'</div>' : '')+
      '</div>';
  }
  function btwBedrading(el){
    async function opmaken(periode, correctie){
      btwMsg = '';
      try {
        const d = await API.call('/supplier/btw/opmaken', { periode, correctie: !!correctie });
        btwOpen = d.aangifte;
        btwMsg = d.bijgewerkt ? T('fn.btwbij','De aangifte is bijgewerkt met de facturen die er sindsdien bij kwamen.') : '';
        await laadBtw();
      } catch(e){ toast(e.message); btwMsg = e.message; renderStation(); }
    }
    const bO = el.querySelector('#btwOp'); if (bO) bO.addEventListener('click', () => opmaken(el.querySelector('#btwPer').value, false));
    const bC = el.querySelector('#btwCorr'); if (bC) bC.addEventListener('click', () => opmaken(bC.dataset.p, true));
    const bD = el.querySelector('#btwDien'); if (bD) bD.addEventListener('click', async () => {
      btwMsg = '';
      try {
        const d = await API.call('/supplier/btw/indienen', { id: bD.dataset.id, kenmerk: (el.querySelector('#btwKenmerk') || {}).value || '' });
        btwOpen = d.aangifte; btwMsg = d.let || '';
        await laadBtw();
      } catch(e){ toast(e.message); btwMsg = e.message; renderStation(); }
    });
  }
