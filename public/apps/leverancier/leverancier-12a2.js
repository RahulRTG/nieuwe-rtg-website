  /* ---- "Waarom?" -- de bewijsketen op het scherm (server: kern/fiscaal/herkomst.js) ----

     De aangifte hierboven zegt een bedrag. Deze kaart vouwt dat bedrag open:
     per tarief, met de facturen eronder, plus de twee dingen die de server
     erbij vindt -- of de opbouw aansluit op de telling waar de aangifte op
     staat, en of er een percentage op een factuurregel staat dat op die dag in
     dit land niet bestond.

     NET ALS DE KAART HIERBOVEN REKENT DIT SCHERM NIETS UIT. Ook niet "even" de
     som van de tarieven als controle: dan staat er een derde teller in huis,
     en die is het vroeg of laat oneens met de andere twee. Wat hier staat komt
     van /supplier/btw/verklaar, inclusief het oordeel of het aansluit.

     UITZONDERINGSGESTUURD (ONTWERP.md): als alles klopt, staat er een rustige
     opbouw en verder niets. Alleen wat afwijkt krijgt kleur -- een opbouw die
     niet aansluit en een tarief dat die dag niet bestond. Een scherm dat bij
     "alles in orde" een groen vinkje toont, leert de lezer over kleur heen te
     kijken, en dan valt de ene keer dat het misgaat ook niet meer op.

     Een eigen deelbestand op deze plek in de stroom, vlak na btwDetail: de
     delen worden rauw aaneengeplakt en delen dus een scope, dus btwKaart() en
     btwBedrading() in deel 12a kunnen deze functies aanroepen ook al staan ze
     hier lager -- functiedeclaraties hijsen over het hele bestand. */
  let waaromData = null, waaromPer = null, waaromBusy = false, herbouwUit = null;

  async function laadWaarom(periode){
    if (waaromBusy) return;
    waaromBusy = true; waaromPer = periode; herbouwUit = null;
    try { waaromData = await API.call('/supplier/btw/verklaar', { periode }); }
    catch(e){ waaromData = { error: e.message }; }
    waaromBusy = false;
    renderStation();
  }

  /* De klasse van de uitkomst (server: kern/fiscaal/zekerheid.js). Wordt
     getoond zoals hij binnenkomt: "vastgesteld" onder een getelde opbouw is
     iets anders dan "vraag een fiscalist" onder een schatting, en dat verschil
     is precies de bedoeling van die laag. */
  function waaromKlasse(z){
    if (!z) return '';
    return '<div class="tkc-who"><b>'+escT(z.kop || '')+'</b> · '+escT(z.waarom || '')+
      (z.mits ? ' '+escT(z.mits) : '')+'</div>';
  }

  function waaromOpbouw(d){
    const rijen = (d.tarieven || []).map(t =>
      '<div class="st-row"><span>'+T('fn.wrm.tar','Omzet')+' '+t.tarief+'%'+
        '<span class="sub">'+T('fn.grondslag','grondslag')+' '+eur(t.grondslagCenten/100)+' · '+
        (t.facturen || []).length+' '+T('fn.wrm.fact','facturen')+'</span></span>'+
        '<b class="btw-btw">'+eur(t.btwCenten/100)+'</b></div>'+
      /* De facturen zelf, ingesprongen: dit is de onderste trede van de keten
         die de gebruiker hier kan zien. Dieper (de regels van een factuur) zou
         betekenen dat dit scherm het factuurregister gaat tonen, en daar is de
         facturenkaart voor. */
      '<div class="wrm-fact">'+(t.facturen || []).slice(0, 12).map(f =>
        '<span>'+escT(f.nummer)+' <span class="sub">'+escT(f.datum)+' · '+eur(f.btwCenten/100)+'</span></span>').join('')+
      ((t.facturen || []).length > 12 ? '<span class="sub">'+T('fn.wrm.meer','en meer')+'</span>' : '')+'</div>').join('');
    return rijen || '<div class="tkc-who">'+T('fn.btwleeg','Geen facturen in deze periode.')+'</div>';
  }

  /* De twee bevindingen. Allebei alleen zichtbaar als ze er zijn. */
  function waaromBevindingen(d){
    let uit = '';
    if (d.sluitAan === false)
      uit += '<div class="tkc-who let"><b>'+T('fn.wrm.scheef','De opbouw sluit niet aan')+'</b> · '+
        T('fn.wrm.scheef.s','Deze posten tellen niet op tot het bedrag waar de aangifte op staat. Verschil')+
        ': '+eur((d.afwijkingCenten || 0)/100)+'</div>';
    const vr = d.vreemdeTarieven || [];
    if (vr.length)
      uit += '<div class="tkc-who let"><b>'+T('fn.wrm.vreemd','Een percentage dat die dag niet bestond')+'</b>'+
        vr.slice(0, 6).map(v => '<div class="sub">'+escT(v.nummer)+' ('+escT(v.datum)+'): '+v.tarief+'% · '+
          T('fn.wrm.vreemd.s','toen golden hier')+' '+(v.bestond || []).join('%, ')+'%</div>').join('')+
        (vr.length > 6 ? '<div class="sub">'+T('fn.wrm.meer','en meer')+'</div>' : '')+'</div>';
    return uit;
  }

  function btwWaaromKaart(toon){
    const per = (toon && toon.periode) || null;
    const d = waaromData;
    const zelfde = d && !d.error && d.periode === per;
    return '<div class="btw-blok">'+
      '<div class="btw-rij"><b>'+T('fn.wrm','Waarom dit bedrag?')+'</b>'+
        (per ? '<button class="obtn" id="btwWrm" data-p="'+escT(per)+'">'+
          (waaromBusy ? T('fn.wrm.bezig','Bezig…') : T('fn.wrm.knop','Vouw open'))+'</button>' : '')+
        (toon && toon.stand === 'ingediend'
          ? '<button class="obtn" id="btwHerb" data-id="'+escT(toon.id)+'">'+T('fn.wrm.herb','Herbouw dit bedrag')+'</button>' : '')+
      '</div>'+
      (d && d.error ? '<div class="tkc-who let">'+escT(d.error)+'</div>' : '')+
      (zelfde
        ? '<div class="st-row streep"><span><b>'+T('fn.btwversch','Verschuldigde btw')+'</b>'+
            '<span class="sub">'+escT(d.van)+' t/m '+escT(d.tot)+' · '+d.facturen+' '+T('fn.wrm.fact','facturen')+'</span></span>'+
            '<b>'+eur(d.verschuldigdCenten/100)+'</b></div>'+
          waaromOpbouw(d)+waaromBevindingen(d)+waaromKlasse(d.zekerheid)
        : '')+
      /* De uitslag van een herbouw. Groen of rood zonder tussenweg: hij is op
         de cent gelijk of hij is dat niet, en een "bijna" bestaat hier niet. */
      (herbouwUit
        ? '<div class="tkc-who '+(herbouwUit.gelijk ? '' : 'let')+'"><b>'+
            (herbouwUit.gelijk ? T('fn.wrm.groen','Op de cent gelijk') : T('fn.wrm.rood','Niet gelijk'))+'</b> · '+
            escT(herbouwUit.uitslag || '')+
            (herbouwUit.gelijk ? '' : ' '+T('fn.wrm.nu','Nu geteld')+': '+eur(herbouwUit.herbouwd.saldoCenten/100)+
              ' · '+T('fn.wrm.toen','ingediend')+': '+eur(herbouwUit.ingediend.saldoCenten/100))+'</div>'
        : '')+
      '</div>';
  }

  function btwWaaromBedrading(el){
    const b = el.querySelector('#btwWrm');
    if (b) b.addEventListener('click', () => laadWaarom(b.dataset.p));
    const h = el.querySelector('#btwHerb');
    if (h) h.addEventListener('click', async () => {
      btwMsg = '';
      try { herbouwUit = await API.call('/supplier/btw/herbouw', { id: h.dataset.id }); }
      catch(e){ toast(e.message); herbouwUit = null; }
      renderStation();
    });
  }
