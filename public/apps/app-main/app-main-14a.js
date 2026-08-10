  /* ---- verzorging: de kapper, de barbier en de nagelstudio ----
     Ze staan in dezelfde tab als de zorg, want een lid denkt niet in
     stelsels; hij denkt "ik moet naar de kapper". Maar ze staan er als een
     EIGEN blok met een eigen kop, want cosmetische verzorging is geen zorg:
     hier reist geen zorgprofiel mee en is er geen intake te delen. Boeken
     gaat naar /api/verzorging, dat de agenda van de salon zelf vult. */
  let verzOv = null, verzOpen = null, verzKeuze = null;
  async function laadVerzorging(){
    if (!API.live) return;
    const datum = (verzKeuze && verzKeuze.datum) || new Date().toISOString().slice(0, 10);
    try { verzOv = await API.call('/verzorging', { datum }); } catch(e){ verzOv = null; }
    renderVerzorging();
  }
  function renderVerzorging(){
    const el = $('#verzorgingAanbod'); if (!el) return;
    const aanb = (verzOv && verzOv.aanbieders) || [];
    if (!aanb.length){ el.innerHTML = ''; return; }
    const dagen = [];
    for (let d = 0; d < 7; d++){ dagen.push(new Date(Date.now() + d * 86400000).toISOString().slice(0, 10)); }
    const gekozenDag = (verzKeuze && verzKeuze.datum) || dagen[0];
    const mijn = (verzOv && verzOv.mijn) || [];
    let html = '';
    if (mijn.length){
      html += '<div style="font-size:0.66rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--soft);margin:1.1rem 0 0.5rem;">'+T('verz.mijn','Mijn verzorgingsafspraken')+'</div>';
      html += mijn.map(a => '<div class="card">'+
        '<div style="font-size:0.62rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--soft);">'+esc(a.salon)+'</div>'+
        '<div style="margin-top:0.35rem;font-size:0.92rem;"><b>'+esc(a.behandeling)+'</b> <span class="soft-sm">· '+esc(a.stoel)+'</span></div>'+
        '<div class="soft-sm" style="margin-top:0.15rem;">'+a.datum+' · '+a.van+' tot '+a.tot+' · '+eur(a.prijs)+' · '+T('verz.bijsalon','af te rekenen bij de salon')+'</div>'+
        '<button class="bz-btn" data-verzannul="'+esc(a.code)+':'+esc(a.id)+'" style="margin-top:0.55rem;">'+T('verz.annuleer','Annuleer')+'</button></div>').join('');
    }
    html += '<div style="font-size:0.66rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--soft);margin:1.1rem 0 0.35rem;">'+T('verz.kop','Kapper, barbier en nagels')+'</div>'+
      '<div class="soft-sm" style="margin-bottom:0.5rem;">'+T('verz.uitleg','Verzorging, geen zorg: er reist geen zorgprofiel mee en er valt niets medisch te delen. U boekt op uw codenaam.')+'</div>'+
      '<div style="display:flex;gap:0.35rem;flex-wrap:wrap;margin-bottom:0.6rem;">'+dagen.map(d =>
        '<button class="bz-btn'+(gekozenDag===d?' on':'')+'" data-verzdag="'+d+'">'+(d===dagen[0]?T('care.vandaag','vandaag'):d.slice(8)+'/'+d.slice(5,7))+'</button>').join('')+'</div>';
    for (const a of aanb){
      html += '<div class="card"><div><b>'+esc(a.naam)+'</b>'+(a.waar?' <span class="soft-sm">· '+esc(a.waar)+'</span>':'')+'</div>';
      for (const b of a.behandelingen){
        const sleutel = a.code+':'+b.id;
        html += '<div style="border-top:1px solid var(--line,rgba(255,255,255,0.08));margin-top:0.55rem;padding-top:0.55rem;">'+
          '<div style="display:flex;justify-content:space-between;gap:0.5rem;align-items:baseline;">'+
            '<span>'+esc(b.naam)+' <span class="soft-sm">· '+b.duurMin+' min</span></span>'+
            '<span class="soft-sm">'+eur(b.prijs)+'</span></div>';
        if (!b.tijden.length){
          html += '<div class="soft-sm" style="margin-top:0.3rem;">'+T('verz.vol','Deze dag is vol. Kies een andere dag.')+'</div>';
        } else if (verzOpen === sleutel){
          html += '<div style="display:flex;gap:0.35rem;flex-wrap:wrap;margin-top:0.45rem;">'+b.tijden.map(t2 =>
            '<button class="bz-btn'+((verzKeuze&&verzKeuze.tijd===t2)?' on':'')+'" data-verzt="'+t2+'">'+t2+'</button>').join('')+'</div>'+
            '<button class="bz-groot" id="verzBoek" style="margin-top:0.7rem;"'+((verzKeuze&&verzKeuze.tijd)?'':' disabled')+'>'+T('verz.boek','Maak deze afspraak')+'</button>';
        } else {
          html += '<button class="bz-btn" data-verzopen="'+esc(sleutel)+'" style="margin-top:0.45rem;">'+T('verz.kies','Kies een tijd')+'</button>';
        }
        html += '</div>';
      }
      html += '</div>';
    }
    el.innerHTML = html;
    el.querySelectorAll('[data-verzdag]').forEach(x => x.addEventListener('click', () => {
      verzKeuze = { datum: x.dataset.verzdag, tijd: null }; verzOpen = null; laadVerzorging();
    }));
    el.querySelectorAll('[data-verzopen]').forEach(x => x.addEventListener('click', () => {
      verzOpen = x.dataset.verzopen;
      verzKeuze = { datum: gekozenDag, tijd: null };
      renderVerzorging();
    }));
    el.querySelectorAll('[data-verzt]').forEach(x => x.addEventListener('click', () => {
      verzKeuze = { datum: gekozenDag, tijd: x.dataset.verzt }; renderVerzorging();
    }));
    el.querySelectorAll('[data-verzannul]').forEach(x => x.addEventListener('click', async () => {
      const [code, id] = x.dataset.verzannul.split(':');
      try { await API.call('/verzorging/annuleer', { code, id }); toast(T('verz.annultoast','Afspraak geannuleerd.')); laadVerzorging(); }
      catch(e){ toast(e.message); }
    }));
    const boek = $('#verzBoek');
    if (boek) boek.addEventListener('click', async () => {
      const [code, behandelingId] = verzOpen.split(':');
      try {
        await API.call('/verzorging/boek', { code, behandelingId, datum: verzKeuze.datum, tijd: verzKeuze.tijd });
        toast(T('verz.oktoast','Afspraak staat genoteerd. U rekent af bij de salon.'));
        verzOpen = null; verzKeuze = { datum: verzKeuze.datum, tijd: null };
        laadVerzorging();
      } catch(e){ toast(e.message); }
    });
  }
