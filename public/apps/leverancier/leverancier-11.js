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
      ? m.allergens.map(a => '<span class="ds-alg">'+a+'</span>').join('')
      : '<span class="ds-alg ok">'+T('ds.noalg','geen allergenen geregistreerd')+'</span>';
    const icoon = KSECTIES[m.sectie||'warm'] && m.station !== 'bar' ? KSECTIES[m.sectie||'warm'][0]+' ' : (m.station==='bar'?'':'');
    wrap.innerHTML = '<div class="ds-scrim"></div>'+
      '<div class="ds-card" role="dialog" aria-modal="true" aria-label="'+m.name+'">'+
        '<div class="ds-top"><div><b>'+icoon+m.name+'</b>'+
          (m.desc?'<span class="ds-desc">'+m.desc+'</span>':'')+
          '<div class="ds-algs">'+alg+'</div></div>'+
          '<button class="st-exit" data-dsluit>'+T('ds.sluit','Sluit')+'</button></div>'+
        '<div class="ds-acts">'+
          '<button data-dsk="recept">'+T('ds.recept','Recept')+'</button>'+
          '<button data-dsk="bereiding">'+T('ds.bereiding','Bereidingswijze')+'</button>'+
          '<button data-dsk="allergenen">'+T('ds.allergenen','Allergenen en vervangers')+'</button>'+
          '<button data-dsk="pairing">'+T('ds.pairing','Dranksuggestie')+'</button>'+
          '<button data-ds86'+(m.uitverkocht?' class="aan"':'')+'>'+(m.uitverkocht?T('ds.86off','86 opheffen'):T('ds.86','86, uitverkocht'))+'</button>'+
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
        toast(m.uitverkocht ? '86: '+m.name : ''+m.name+' '+T('ds.weerbeschikbaar','is weer beschikbaar'));
        dishSheet(itemId);
      } catch(e){ toast(e.message); }
    });
  }

  function bindStation(el){
    if (stationMode === 'keuken') loadCoach(el);
    // de voorraadbalk: 86 zetten op advies en derving melden vanaf de vloer
    el.querySelectorAll('[data-st86adv]').forEach(b => b.addEventListener('click', async () => {
      try {
        await API.call('/supplier/menu/86', { itemId: b.dataset.st86adv, op: true });
        toast(''+T('st.86gezet','86 gezet; leden kunnen het niet meer bestellen.'));
        wvAt = 0; laadWerkvloer(); await refresh();
      } catch(e){ toast(e.message); }
    }));
    const stDerf = el.querySelector('[data-stderf]'); if (stDerf) stDerf.addEventListener('click', async () => {
      const naam = prompt(T('st.derfwat','Welk artikel is er weg (naam van de voorraadlijst)?')); if (!naam) return;
      const art = ((wvInfo && wvInfo.artikelen) || []).find(a => a.naam.toLowerCase() === naam.trim().toLowerCase());
      if (!art){ toast(T('st.derfgeen','Dat artikel staat niet op de voorraadlijst.')); return; }
      const hv = prompt(T('vr.derfvraag','Hoeveel is er weg (breuk, derving)?')); if (!hv) return;
      const reden = prompt(T('vr.derfreden','Reden?')) || '';
      try {
        await API.call('/supplier/keuken/verspilling', { artikelId: art.id, hoeveelheid: Number(String(hv).replace(',', '.')), reden });
        toast(''+T('st.derfok','Geboekt in het voorraadlogboek.'));
        wvAt = 0; laadWerkvloer();
      } catch(e){ toast(e.message); }
    });
    el.querySelectorAll('.rcp-item').forEach(s2 => s2.addEventListener('click', () => dishSheet(s2.dataset.rcp)));
    el.querySelectorAll('[data-settbl]').forEach(b => b.addEventListener('click', async () => {
      const t = prompt(T('st.tblq','Welke tafel? (leeg = geen tafel)'), b.dataset.cur || '');
      if (t === null) return;
      try { await API.call('/supplier/order/table', { ref: b.dataset.settbl, table: t.trim() }); await refresh(); } catch(e){ toast(e.message); }
    }));
    // het overschot: is over melden, gebruikt afboeken of afschrijven
    const ovBij = el.querySelector('#ovBij'); if (ovBij) ovBij.addEventListener('click', async () => {
      try { await API.call('/supplier/overschot', { op: 'erbij', itemId: el.querySelector('#ovGerecht').value, qty: el.querySelector('#ovAantal').value }); toast(''+T('over.toast','Gemeld; elk scherm telt het nu van de maaklijst af.')); await refresh(); } catch(e){ toast(e.message); }
    });
    el.querySelectorAll('[data-overgebruikt]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/overschot', { op: 'gebruikt', id: b.dataset.overgebruikt }); await refresh(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-overweg]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/overschot', { op: 'weg', id: b.dataset.overweg }); await refresh(); } catch(e){ toast(e.message); }
    }));
    // de spoedbon: als gewone bon op de lijn zetten, of intrekken
    const spGo = el.querySelector('#spGo'); if (spGo) spGo.addEventListener('click', async () => {
      try {
        await API.call('/supplier/order/spoed', { itemId: el.querySelector('#spGerecht').value, qty: el.querySelector('#spAantal').value, table: el.querySelector('#spTafel').value });
        toast(''+T('spoed.toast','Spoedbon staat op de lijn, als gewone bon.'));
        await refresh();
      } catch(e){ toast(e.message); }
    });
    el.querySelectorAll('[data-spoedaf]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/order/spoed', { ref: b.dataset.spoedaf, op: false }); await refresh(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-lijnaan]').forEach(b => b.addEventListener('click', async () => {
      try { const d = await API.call('/supplier/lijn', { sectie: b.dataset.lijnaan }); toast(d.aangemeld ? ''+T('lijn.aant','Aangemeld op deze kant.') : T('lijn.aftoast','Afgemeld van deze kant.')); await refresh(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-ksel]').forEach(b => b.addEventListener('click', () => {
      keukenSectie = b.dataset.ksel;
      try { localStorage.setItem('rtg_sup_ksectie', keukenSectie); } catch(e){}
      renderStation();
    }));
    el.querySelectorAll('[data-secgo]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/order/sectie', { ref: b.dataset.secgo, sectie: keukenSectie, phase: b.dataset.phase }); await refresh(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-stgo]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/order/station', { ref: b.dataset.stgo, station: stationMode, phase: b.dataset.phase }); await refresh(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-stserve]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/order/status', { ref: b.dataset.stserve, status: 'geserveerd' }); await refresh(); } catch(e){ toast(e.message); }
    }));
