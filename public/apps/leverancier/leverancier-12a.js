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
  let btwData = null, btwBusy = false, btwOpen = null, btwMsg = '', btwNaheff = null;
  async function laadBtw(){
    if (btwBusy) return;
    btwBusy = true;
    try { btwData = await API.call('/supplier/btw/aangiftes', {}); }
    catch(e){ btwData = { error: e.message, aangiftes: [] }; }
    /* De naheffingen die de Belastingdienst oplegde. Concepten zitten er niet
       bij -- die filtert de server weg, want een concept is nog geen besluit. */
    try { btwNaheff = (await API.call('/supplier/btw/naheffingen', {})).naheffingen; }
    catch(e){ btwNaheff = []; }
    btwBusy = false;
    renderStation();
  }
  function btwPeriodes(){
    const d = new Date(); const uit = [];
    let j = d.getUTCFullYear(), k = Math.floor(d.getUTCMonth() / 3) + 1;
    for (let i = 0; i < 5; i++){ uit.push(j + 'K' + k); k -= 1; if (k === 0){ k = 4; j -= 1; } }
    return uit;
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
      btwNaheffingen()+
      '</div>';
  }
  /* De naheffingen. Alleen tonen wat er staat: het bedrag, de grond van een
     boete en het besluit op een bezwaar komen alle drie van de Belastingdienst,
     en het scherm rekent of vertaalt er niets aan. */
  function btwNaheffingen(){
    if (!btwNaheff || !btwNaheff.length) return '';
    return '<div class="btw-blok"><b>'+T('fn.nh','Naheffing van de Belastingdienst')+'</b>'+
      btwNaheff.map(n =>
        '<div class="st-row"><span>'+escT(n.kenmerk)+' · '+escT(n.periode)+
        '<span class="sub">'+T('fn.nh.stand','stand')+': '+escT(n.status)+
        (n.boeteCenten ? ' · '+T('fn.nh.boete','boete')+' '+eur(n.boeteCenten/100)+(n.boeteGrond ? ' ('+escT(n.boeteGrond)+')' : '') : '')+
        (n.vervaltOp ? ' · '+T('fn.nh.vervalt','vervalt')+' '+escT(n.vervaltOp) : '')+
        (n.bezwaar && n.bezwaar.besluit ? ' · '+T('fn.nh.besluit','besluit op bezwaar')+': '+escT(n.bezwaar.besluit)+' · '+escT(n.bezwaar.motivering || '') : '')+
        '</span></span><b class="btw-saldo betaal">'+eur(n.totaalCenten/100)+'</b></div>'+
        (n.betaaldOp
          ? '<div class="tkc-who">'+T('fn.nh.betaald','Betaald op')+' '+escT(String(n.betaaldOp).slice(0,10))+
            (n.terugbetaaldOp ? ' · '+T('fn.nh.terug','teruggestort op')+' '+escT(String(n.terugbetaaldOp).slice(0,10)) : '')+'</div>'
          /* Betalen mag zolang de aanslag staat -- ook tijdens een bezwaar, want
             bezwaar schort de betaling niet op. Is hij vernietigd, dan valt er
             niets meer te betalen en staat de knop er dus ook niet. */
          : ['vastgesteld','bezwaar','gehandhaafd'].includes(n.status)
            ? '<div class="btw-rij"><button class="obtn primary" data-nhbet="'+escT(n.id)+'">'+
              T('fn.nh.betaal','Betalen')+' '+eur(n.totaalCenten/100)+'</button></div>' : '')+
        (n.status === 'vastgesteld'
          ? '<div class="btw-rij"><input class="st-in btw-kenmerk" id="nhr'+escT(n.id)+'" placeholder="'+T('fn.nh.reden','Waarom bent u het er niet mee eens?')+'">'+
            '<button class="obtn" data-nhbez="'+escT(n.id)+'">'+T('fn.nh.bezwaar','Bezwaar maken')+'</button></div>'
          : n.status === 'bezwaar' ? '<div class="tkc-who">'+T('fn.nh.loopt','Uw bezwaar loopt; een andere inspecteur beoordeelt het.')+'</div>' : '')
      ).join('')+'</div>';
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
    el.querySelectorAll('[data-nhbet]').forEach(b => b.addEventListener('click', async () => {
      btwMsg = '';
      try {
        const d = await API.call('/supplier/btw/naheffing/betaal', { id: b.dataset.nhbet });
        btwMsg = d.let || '';
        btwData = null; await laadBtw();
      } catch(e){ toast(e.message); btwMsg = e.message; renderStation(); }
    }));
    el.querySelectorAll('[data-nhbez]').forEach(b => b.addEventListener('click', async () => {
      const veld = el.querySelector('#nhr' + b.dataset.nhbez);
      btwMsg = '';
      try {
        const d = await API.call('/supplier/btw/naheffing/bezwaar', { id: b.dataset.nhbez, reden: veld ? veld.value : '' });
        btwMsg = d.let || '';
        btwData = null; await laadBtw();
      } catch(e){ toast(e.message); btwMsg = e.message; renderStation(); }
    }));
    const bD = el.querySelector('#btwDien'); if (bD) bD.addEventListener('click', async () => {
      btwMsg = '';
      try {
        const d = await API.call('/supplier/btw/indienen', { id: bD.dataset.id, kenmerk: (el.querySelector('#btwKenmerk') || {}).value || '' });
        btwOpen = d.aangifte; btwMsg = d.let || '';
        await laadBtw();
      } catch(e){ toast(e.message); btwMsg = e.message; renderStation(); }
    });
  }
