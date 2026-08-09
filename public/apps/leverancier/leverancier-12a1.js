  /* ---- de btw-aangifte, deel 2: HET DETAIL van een aangifte ----

     Afgesplitst van leverancier-12a.js, dat tegen de omvanglat aan liep toen de
     naheffing erbij kwam. Op deze plek in de stroom -- de delen worden rauw
     aaneengeplakt -- staat dit in dezelfde scope als btwKaart() hierboven, dus
     die kan er gewoon bij; zie de kop van leverancier-12a.js voor waarom die
     plek uitmaakt. */
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
