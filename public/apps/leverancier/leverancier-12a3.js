  /* ---- de afsluiting van de periode en de pre-flight ----

     Afgesplitst van leverancier-12a2.js, dat over de omvanglat ging, en de
     snee valt op een echte grens: hiernaast staat WAAR EEN BEDRAG VANDAAN KOMT
     (de bewijsketen), hier staat OF DE PERIODE AF IS en WAT ER GEBEURT ALS JE
     indient. Terugkijken en vooruitkijken zijn twee vragen.

     Zelfde plek in de stroom, dus zelfde scope: btwKaart() en btwDetail() in de
     delen hierboven roepen deze functies aan, ook al staan ze lager -- de delen
     worden rauw aaneengeplakt en functiedeclaraties hijsen. */
  /* ---- de afsluiting van de periode (server: kern/fiscaal/aansluiting.js) ----

     Drie getallen die samen het kwartaal zijn: bewezen, uitzondering,
     ontbrekend. De derde is waarom deze kaart bestaat -- geld waar geen
     controle overheen ligt, ziet er in elk ander overzicht uit als nul.

     De balk is bewust GEEN percentagecijfer alleen: 99,96% leest als "af",
     terwijl de 0,04% ernaast juist het enige is dat werk vraagt. Dus staan de
     bedragen erbij, en is de uitzondering de enige die kleur krijgt. */
  let sluitData = null, sluitBusy = false;

  async function laadSluiting(periode){
    if (sluitBusy) return;
    sluitBusy = true;
    try { sluitData = await API.call('/supplier/btw/afsluiting', { periode }); }
    catch(e){ sluitData = { error: e.message }; }
    sluitBusy = false;
    renderStation();
  }

  function sluitBalk(d){
    const t = d.dekking.totaalCenten || 1;
    const b = (n) => Math.max(0, Math.round((n / t) * 1000) / 10);
    return '<div class="afs-balk" role="img" aria-label="'+
        T('fn.afs.bewezen','Bewezen')+' '+d.dekking.bewezenPct+'%, '+
        T('fn.afs.uitz','Uitzondering')+' '+d.dekking.uitzonderingPct+'%, '+
        T('fn.afs.ontbr','Ontbrekend')+' '+d.dekking.ontbrekendPct+'%">'+
      '<span class="afs-b" style="width:'+b(d.dekking.bewezenCenten)+'%"></span>'+
      '<span class="afs-u" style="width:'+b(d.dekking.uitzonderingCenten)+'%"></span>'+
      '<span class="afs-o" style="width:'+b(d.dekking.ontbrekendCenten)+'%"></span>'+
      '</div>';
  }

  function btwAfsluiting(toon){
    const per = (toon && toon.periode) || null;
    const d = sluitData;
    const zelfde = d && !d.error && d.periode === per;
    return '<div class="btw-blok">'+
      '<div class="btw-rij"><b>'+T('fn.afs','Is deze periode af?')+'</b>'+
        (per ? '<button class="obtn" id="btwAfs" data-p="'+escT(per)+'">'+
          (sluitBusy ? T('fn.wrm.bezig','Bezig…') : T('fn.afs.knop','Nakijken'))+'</button>' : '')+
      '</div>'+
      (d && d.error ? '<div class="tkc-who let">'+escT(d.error)+'</div>' : '')+
      (zelfde
        ? sluitBalk(d)+
          '<div class="st-row"><span>'+T('fn.afs.bewezen','Bewezen')+
            '<span class="sub">'+d.dekking.bewezenPct+'%</span></span><b>'+eur(d.dekking.bewezenCenten/100)+'</b></div>'+
          (d.dekking.uitzonderingCenten
            ? '<div class="st-row"><span class="let">'+T('fn.afs.uitz','Uitzondering')+
              '<span class="sub">'+d.dekking.uitzonderingPct+'%</span></span><b class="let">'+eur(d.dekking.uitzonderingCenten/100)+'</b></div>' : '')+
          (d.dekking.ontbrekendCenten
            ? '<div class="st-row"><span class="let">'+T('fn.afs.ontbr','Ontbrekend')+
              '<span class="sub">'+T('fn.afs.ontbr.s','geen controle ligt hierover')+' · '+d.dekking.ontbrekendPct+'%</span></span>'+
              '<b class="let">'+eur(d.dekking.ontbrekendCenten/100)+'</b></div>' : '')+
          /* De controles zelf: alleen wat niet sluit krijgt kleur. Een rij
             groene vinkjes leert de lezer over kleur heen te kijken. */
          d.controles.map(c => '<div class="tkc-who'+(c.stand === 'sluit_aan' ? '' : ' let')+'">'+
            escT(c.naam)+' · '+escT(c.stand.replace(/_/g, ' '))+
            (c.let ? '<span class="sub">'+escT(c.let)+'</span>' : '')+'</div>').join('')+
          '<div class="tkc-who">'+escT(d.let)+'</div>'
        : '')+
      '</div>';
  }

  /* ---- de pre-flight (server: kern/fiscaal/preflight.js) ----
     Wat er gebeurt als je indient, VOOR de klik. Alleen zichtbaar op een
     aangifte die nog niet is ingediend en waarvan de periode voorbij is --
     daarbuiten is er niets te keuren en zou de kaart alleen ruis zijn. */
  let vlucht = null;

  function btwPreflight(a){
    if (!a || a.stand === 'ingediend' || a.periodeLoopt) return '';
    const kleur = vlucht && vlucht.uitslag === 'BLOCK' ? ' let'
      : vlucht && vlucht.uitslag === 'REVIEW' ? ' let' : '';
    return '<div class="btw-rij"><button class="obtn" id="btwPre" data-id="'+escT(a.id)+'">'+
        T('fn.pre','Wat gebeurt er als ik indien?')+'</button></div>'+
      (vlucht
        ? '<div class="tkc-who'+kleur+'"><b>'+escT(vlucht.uitslag)+'</b>'+
          (vlucht.redenen && vlucht.redenen.length
            ? vlucht.redenen.map(r => '<span class="sub">'+escT(r)+'</span>').join('')
            : '<span class="sub">'+escT(vlucht.let || '')+'</span>')+'</div>'
        : '');
  }

  function btwAfsluitingBedrading(el){
    const a = el.querySelector('#btwAfs');
    if (a) a.addEventListener('click', () => laadSluiting(a.dataset.p));
    const p = el.querySelector('#btwPre');
    if (p) p.addEventListener('click', async () => {
      try { vlucht = await API.call('/supplier/btw/preflight',
        { id: p.dataset.id, kenmerk: (el.querySelector('#btwKenmerk') || {}).value || '' }); }
      catch(e){ toast(e.message); vlucht = null; }
      renderStation();
    });
  }
