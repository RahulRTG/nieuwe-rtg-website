      const act = mine.filter(o => (o.stations||{})[st] !== 'klaar').sort(spoedEerst);
      const done = mine.filter(o => (o.stations||{})[st] === 'klaar');
      if (st === 'keuken' || st === 'bar') html += stStats(act);
      if (st === 'keuken') html += allDay(act);
      if (st === 'bar') html += allDay(act, 'bar') + overschotChips() + overschotBlok();
      html += act.length ? act.map(o => ticketCard(o, st, {})).join('') : '<div class="st-empty">'+T('st.calm','Rustig. Nieuwe bestellingen verschijnen hier vanzelf, met geluid van de bel in de app.')+'</div>';
      if (done.length){
        html += '<div class="st-sec">'+T('st.done','Klaargemeld, wacht op uitserveren')+'</div>';
        html += done.map(o => ticketCard(o, st, { dim:true })).join('');
      }
      if (st === 'keuken'){
        const vandaagStr = new Date().toISOString().slice(0, 10);
        const morgenStr = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
        const dms = state.dailyMeps || {};
        html += '<div class="st-sec">\uD83D\uDCC5 '+T('dm.h','Dagelijkse mise en place (\u00e0 la carte)')+'</div>';
        const dmCard = (plan, label) => {
          const open = plan.tasks.filter(x=>!x.done).length;
          return '<div class="tkc" style="grid-column:1/-1;">'+
            '<div class="tkc-top"><span style="font-weight:600;">'+label+' \u00b7 \u00b1'+plan.covers+' couverts</span><span class="tkc-age">'+plan.factorLabel+' \u00b7 '+T('dm.by','voorspeld door')+' '+plan.by+'</span></div>'+
            '<div style="display:flex;gap:0.4rem;flex-wrap:wrap;">'+plan.portions.map(p=>'<span class="st-badge">'+p.name+' \u00b7 <b style="color:var(--gold);">'+p.n+'\u00d7</b></span>').join('')+'</div>'+
            plan.tasks.map(x=>'<div class="st-row'+(x.done?'" style="opacity:0.5;':'"')+'"><span><b style="color:var(--gold);font-variant-numeric:tabular-nums;margin-right:0.6rem;">'+x.time+'</b>'+(x.done?'<s>'+x.task+'</s>':x.task)+(x.done&&x.doneBy?'<span class="sub">\u2713 '+x.doneBy+'</span>':'')+'</span>'+
              '<button class="obtn'+(x.done?' primary':'')+'" data-dmdone="'+plan.date+'" data-item="'+x.id+'">'+(x.done?'\u2713':T('rs.doit','Gedaan'))+'</button></div>').join('')+
            (open?'':'<div class="tkc-who">\u2705 '+T('dm.alldone','Alles afgevinkt, de lijn staat.')+'</div>')+
          '</div>';
        };
        if (dms[vandaagStr]) html += dmCard(dms[vandaagStr], T('rs.today','vandaag').toUpperCase());
        if (dms[morgenStr]) html += dmCard(dms[morgenStr], T('rs.tomorrow','morgen').toUpperCase());
        html += '<div class="tkc"><div class="tkc-who">'+T('dm.deck','De voorspelling rekent met de verkoop van de afgelopen drie weken, de tafelcapaciteit en de weekdag.')+'</div>'+
          '<div class="tkc-act"><button class="tkc-start" data-dmgen="vandaag">\u2728 '+(dms[vandaagStr]?T('dm.redo','Opnieuw voor vandaag'):T('dm.today','Voorspel vandaag'))+'</button>'+
          '<button class="tkc-start" data-dmgen="morgen">\u2728 '+(dms[morgenStr]?T('dm.redo2','Opnieuw voor morgen'):T('dm.tomorrow','Voorspel morgen'))+'</button></div></div>';
        const evs2 = (state.events||[]).filter(e => e.published && (e.date||'') >= vandaagStr && (e.catering && e.catering.mode !== 'geen' || (e.allergies||[]).length));
        if (evs2.length){
          html += '<div class="st-sec">\uD83D\uDC68\u200D\uD83C\uDF73 '+T('ek.h','Event-keuken')+'</div>';
          html += evs2.map(e => {
            const dishes = e.catering.mode === 'menu'
              ? e.catering.itemIds.map(id => (state.menu||[]).find(m => m.id === id)).filter(Boolean)
              : (state.menu||[]).filter(m => m.station !== 'bar');
            const covers = Math.max((e.guests||[]).reduce((n,g)=>n+g.qty,0), Math.ceil(e.capacity*0.6));
            return '<div class="tkc">'+
              '<div class="tkc-top"><span style="font-weight:600;">'+e.name+'</span><span class="tkc-age">'+e.date+'</span></div>'+
              '<div class="tkc-who">'+(e.catering.mode==='menu'?T('ek.menu','Vast menu')+' \u00b7 '+dishes.length+' '+T('ek.courses','gangen'):e.catering.mode==='alacarte'?'\u00c0 la carte':'')+' \u00b7 \u00b1'+covers+' couverts</div>'+
              (e.catering.mode==='menu' && dishes.length ? '<div class="tkc-items" style="font-size:0.82rem;">'+dishes.map(d=>'<span>\u2022 '+d.name+'</span>').join('')+'</div>' : '')+
              ((e.allergies||[]).length ? (e.allergies||[]).map(a =>
                '<div class="tkc-alg">\u26a0 '+a.allergen+' ('+a.count+'\u00d7)'+
                (a.alternative?'<br>\u2192 <b>'+a.alternative.name+'</b>'+(a.alternative.desc?': '+a.alternative.desc:''):'<br>'+T('ek.noalt','Nog geen vervangend gerecht, vraag het Kantoor of tik hieronder.'))+'</div>').join('') : '')+
              '<div class="tkc-act"><button class="tkc-ready" data-kmep="'+e.id+'">\u2728 '+T('ek.mep','Organiseer de mise en place')+'</button></div>'+
            '</div>';
          }).join('');
        }
      }
      html += runsheetStrip(st);
    }
    el.innerHTML = html;
    bindStation(el);
  }

  // de keukenhulp: haalt live advies op (Claude of de regel-coach) en toont het
  let coachSeq = 0;
  async function loadCoach(el){
    const box = el.querySelector('#coachBox'); if (!box) return;
    const mijn = ++coachSeq;
    try {
      const d = await API.call('/supplier/kitchen/coach', {});
      if (mijn !== coachSeq) return; // er is al een nieuwere render
      if (!d.lines || !d.lines.length){ box.style.display = 'none'; return; }
      box.style.display = 'block';
      box.innerHTML = '<div class="tkc" style="border-color:rgba(169,143,28,0.5);">'+
        '<h3>\uD83E\uDD16 '+T('kc.h','Keukenhulp')+(d.ai?' \u00b7 Claude':'')+'</h3>'+
        d.lines.map(l=>'<div style="font-size:0.9rem;line-height:1.6;padding:0.2rem 0;">'+l+'</div>').join('')+'</div>';
    } catch(e){ box.style.display = 'none'; }
  }
  /* Het gerechtenmenu: tik op een gerecht en kies recept, bereidingswijze,
     allergenen met vervangers, een dranksuggestie of een 86-melding
     (uitverkocht; leden kunnen het per direct niet meer bestellen). */
  function sluitDish(){ const d = document.getElementById('dishSheet'); if (d) d.remove(); }
  function dishSheet(itemId){
    sluitDish();
    const m = (state.menu||[]).find(x => x.id === itemId); if (!m) return;
    const host = $('#station') || document.body;
    const wrap = document.createElement('div');
    wrap.id = 'dishSheet';
    const alg = (m.allergens||[]).length
      ? m.allergens.map(a => '<span class="ds-alg">⚠ '+a+'</span>').join('')
      : '<span class="ds-alg ok">'+T('ds.noalg','geen allergenen geregistreerd')+'</span>';
    const icoon = KSECTIES[m.sectie||'warm'] && m.station !== 'bar' ? KSECTIES[m.sectie||'warm'][0]+' ' : (m.station==='bar'?'🍸 ':'');
    wrap.innerHTML = '<div class="ds-scrim"></div>'+
      '<div class="ds-card" role="dialog" aria-modal="true" aria-label="'+m.name+'">'+
        '<div class="ds-top"><div><b>'+icoon+m.name+'</b>'+
          (m.desc?'<span class="ds-desc">'+m.desc+'</span>':'')+
          '<div class="ds-algs">'+alg+'</div></div>'+
          '<button class="st-exit" data-dsluit>'+T('ds.sluit','Sluit')+'</button></div>'+
        '<div class="ds-acts">'+
          '<button data-dsk="recept">📖 '+T('ds.recept','Recept')+'</button>'+
          '<button data-dsk="bereiding">👨‍🍳 '+T('ds.bereiding','Bereidingswijze')+'</button>'+
          '<button data-dsk="allergenen">⚠️ '+T('ds.allergenen','Allergenen en vervangers')+'</button>'+
          '<button data-dsk="pairing">🍷 '+T('ds.pairing','Dranksuggestie')+'</button>'+
          '<button data-ds86'+(m.uitverkocht?' class="aan"':'')+'>⛔ '+(m.uitverkocht?T('ds.86off','86 opheffen'):T('ds.86','86, uitverkocht'))+'</button>'+
        '</div>'+
        (m.uitverkocht?'<div class="ds-86">'+T('ds.86nu','Dit gerecht staat op 86: leden kunnen het nu niet bestellen.')+'</div>':'')+
        '<div class="ds-body" id="dsBody">'+T('ds.kies','Kies hierboven wat je wilt zien.')+'</div>'+
      '</div>';
    host.appendChild(wrap);
    wrap.querySelector('.ds-scrim').addEventListener('click', sluitDish);
    wrap.querySelector('[data-dsluit]').addEventListener('click', sluitDish);
    wrap.querySelectorAll('[data-dsk]').forEach(b => b.addEventListener('click', async () => {
      const body = wrap.querySelector('#dsBody');
      wrap.querySelectorAll('[data-dsk]').forEach(x => x.classList.toggle('aan', x === b));
      body.textContent = T('ds.laden','De AI-chef schrijft...');
      try {
        const d = await API.call('/supplier/menu/kennis', { itemId, soort: b.dataset.dsk });
        body.textContent = d.tekst;
        if (b.dataset.dsk === 'recept') m.recept = d.tekst;
      } catch(e){ body.textContent = e.message; }
    }));
    wrap.querySelector('[data-ds86]').addEventListener('click', async () => {
      try {
        const d = await API.call('/supplier/menu/86', { itemId, op: !m.uitverkocht });
        m.uitverkocht = d.uitverkocht;
        toast(m.uitverkocht ? '⛔ 86: '+m.name : '✅ '+m.name+' '+T('ds.weerbeschikbaar','is weer beschikbaar'));
        dishSheet(itemId);
      } catch(e){ toast(e.message); }
    });
  }

  function bindStation(el){
