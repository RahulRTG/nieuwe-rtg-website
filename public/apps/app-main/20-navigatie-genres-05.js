    for (const p of vhPartners){
      html += '<div class="card"><b>'+esc(p.name)+'</b> <span class="soft-sm">\u00B7 '+esc(p.city||'')+'</span>';
      for (const a of p.autos){
        const open = vhOpen === p.code + ':' + a.id;
        html += '<div style="margin-top:0.7rem;border-top:1px solid var(--line);padding-top:0.6rem;">'+
          '<div style="display:flex;justify-content:space-between;gap:0.5rem;"><div style="font-size:0.88rem;">'+(a.icoon||'\uD83D\uDE97')+' '+esc(a.name)+'</div>'+
          '<span style="color:var(--gold);font-size:0.82rem;white-space:nowrap;">'+eur(a.dagprijs)+'/'+T('vh.dag','dag')+'</span></div>'+
          '<div style="font-size:0.7rem;color:var(--soft);margin-top:0.2rem;">'+esc(a.categorie||'')+' \u00B7 '+(a.transmissie==='automaat'?T('vh.aut','automaat'):T('vh.hand','handgesch.'))+' \u00B7 '+esc(a.brandstof||'')+' \u00B7 \uD83D\uDC65'+(a.stoelen||'-')+' \u00B7 \uD83E\uDDF3'+(a.bagage||0)+(a.airco?' \u00B7 \u2744\uFE0F':'')+
          ' \u00B7 '+(a.kmPerDag?a.kmPerDag+' km/'+T('vh.dag','dag'):T('vh.onbeperkt','onbeperkt km'))+' \u00B7 '+T('vh.borg','borg')+' '+eur(a.borg||0)+'</div>'+
          (a.apk && a.apk.bekend ? '<div style="font-size:0.68rem;margin-top:0.25rem;color:'+(a.apk.geldig?'var(--green)':'var(--gold)')+';">\uD83D\uDEE1\uFE0F RDW '+(a.apk.geldig?T('vh.apkok','APK geldig'):T('vh.apkuit','APK verloopt'))+' \u00B7 '+T('vh.apktot','tot')+' '+esc(a.apk.apkTot)+'</div>' : '');
        if (open){
          html += '<div style="display:flex;gap:0.5rem;margin-top:0.5rem;">'+
            '<div class="bz-veld" style="flex:1;margin-top:0;"><label>'+T('vh.van','Ophalen')+'</label><input type="date" id="vhVan" value="'+vhKeuze.van+'"></div>'+
            '<div class="bz-veld" style="flex:1;margin-top:0;"><label>'+T('vh.tot','Inleveren')+'</label><input type="date" id="vhTot" value="'+vhKeuze.tot+'"></div></div>'+
            '<button class="bz-groot" id="vhBoek" style="margin-top:0.7rem;">'+T('vh.boek','Boek en betaal, vaste prijs')+'</button>';
        } else {
          html += '<button class="bz-btn" data-vhopen="'+p.code+':'+a.id+'" style="margin-top:0.45rem;">'+T('vh.kies','Kies periode')+'</button>';
        }
        html += '</div>';
      }
      html += '</div>';
    }
    el.innerHTML = html;
    document.querySelectorAll('[data-vhopen]').forEach(b => b.addEventListener('click', () => {
      vhOpen = b.dataset.vhopen;
      const morgen = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
      const overmorgen = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
      vhKeuze = { van: morgen, tot: overmorgen };
      renderVhAanbod(); koppelVhActies();
    }));
    const boek = document.getElementById('vhBoek');
    if (boek) boek.addEventListener('click', async () => {
      const [code, autoId] = vhOpen.split(':');
      try {
        const h = await API.call('/huur/boek', { supplierCode: code, autoId, van: $('#vhVan').value, tot: $('#vhTot').value });
        await API.call('/booking/pay', { ref: h.huur.ref });
        toast(T('vh.ok','Geboekt en betaald: ') + eur(h.huur.price) + T('vh.ok2',' vast, geen verrassingen aan de balie.'));
        vhOpen = null; vhKeuze = null;
        laadVerhuur();
      } catch(e){ toast(e.message); }
    });
  }

  /* ---------- charter: boten en jachten huren ---------- */
  let chPartners = [], chOpen = null, chKeuze = null, chLocWatch = {};
  async function laadCharter(){
    if (!API.live) return;
    try { chPartners = (await API.call('/charter/aanbod')).partners || []; } catch(e){ chPartners = []; }
    let mijn = [];
    try { mijn = (await API.call('/charter/mijn')).charters || []; } catch(e){}
    const el = $('#chMijn');
    const CH_ST = { 'aangevraagd': T('ch.m.geboekt','geboekt; leg de staat vast bij het uitvaren'), 'lopend': T('ch.m.lopend','op zee; behouden vaart'), 'afgerond': T('ch.m.af','afgerond') };
    if (el) el.innerHTML = mijn.filter(c => c.status !== 'afgerond' || c.tot >= new Date().toISOString().slice(0, 10)).map(c =>
      '<div class="card" style="border-color:rgba(91,185,140,0.35);">'+
      '<div style="font-size:0.62rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--green);">'+T('ch.m.kop','Charter')+' · '+esc(c.supplierName)+'</div>'+
      '<div style="margin-top:0.35rem;font-size:0.92rem;"><b>'+esc(c.boot)+'</b> ('+esc(c.type)+') · '+c.van+' → '+c.tot+' · '+eur(c.prijs)+'</div>'+
      (c.spec ? '<div style="margin-top:0.25rem;font-size:0.72rem;color:var(--soft);">'+(c.spec.lengte||0)+'m · '+(c.spec.gasten||'-')+(c.spec.hutten?' · '+c.spec.hutten:'')+' · '+(c.spec.snelheidKn||0)+' kn · '+esc(c.spec.ligplaats||'')+(c.borg?' · '+T('ch.borg','borg')+' '+eur(c.borg):'')+'</div>' : '')+
      '<div style="margin-top:0.3rem;font-size:0.78rem;color:var(--muted);">'+(c.metSkipper?''+T('ch.m.metskipper','met schipper')+(c.skipperNaam?' ('+esc(c.skipperNaam)+')':''):T('ch.m.bareboat','bareboat'))+' · '+(CH_ST[c.status]||c.status)+' ·  '+c.fotosVoor+'/'+c.fotosNa+'</div>'+
      (c.teruggave ? '<div style="margin-top:0.25rem;font-size:0.78rem;color:'+(c.teruggave.meerkosten>0?'var(--gold)':'var(--green)')+';">'+(c.teruggave.meerkosten>0 ? T('ch.m.meer','Meerkosten')+': '+eur(c.teruggave.meerkosten) : '✓ '+T('ch.m.geenmeer','geen meerkosten, borg vrij'))+'</div>' : '')+
      (c.status !== 'afgerond' ?
        '<div style="display:flex;gap:0.4rem;flex-wrap:wrap;margin-top:0.55rem;">'+
        (c.status === 'aangevraagd' ? '<button class="bz-btn" data-chf="'+c.ref+'" data-fase="voor">'+T('ch.m.fotovoor','Staat vastleggen (voor)')+'</button>' : '')+
        (c.status === 'lopend' ? '<button class="bz-btn" data-chf="'+c.ref+'" data-fase="na">'+T('ch.m.fotona','Staat vastleggen (na)')+'</button>'+
          '<button class="bz-btn'+(c.locatieAan?' on':'')+'" data-chloc="'+c.ref+'" data-aan="'+(c.locatieAan?'0':'1')+'">'+(c.locatieAan?T('ch.m.locuit','Positie delen uit'):T('ch.m.locaan','Deel live positie'))+'</button>' : '')+
        '<button data-chsos="'+c.ref+'" style="background:var(--burgundy-deep);border:1px solid var(--burgundy);color:#fff;border-radius:999px;padding:0.5rem 1rem;font-size:0.8rem;font-weight:700;cursor:pointer;font-family:inherit;">SOS</button>'+
        '</div>' : '')+
      '</div>').join('');
    renderChAanbod();
    koppelChActies();
  }
  function koppelChActies(){
    const file = (() => { let f = document.getElementById('chLidFile');
      if (!f){ f = document.createElement('input'); f.type = 'file'; f.accept = 'image/*'; f.capture = 'environment'; f.id = 'chLidFile'; f.style.display = 'none'; document.body.appendChild(f); }
      return f; })();
    document.querySelectorAll('[data-chf]').forEach(b => b.addEventListener('click', () => {
      file.onchange = () => {
        if (!file.files[0]) return;
        vhFotoKlein(file.files[0], async (dataUrl) => {
          try { await API.call('/charter/foto', { ref: b.dataset.chf, fase: b.dataset.fase, foto: dataUrl });
            toast(T('ch.m.foto.ok','Vastgelegd. Dit is uw bewijs van de staat.')); laadCharter(); }
          catch(e){ toast(e.message); }
        });
        file.value = '';
      };
      file.click();
    }));
    document.querySelectorAll('[data-chsos]').forEach(b => b.addEventListener('click', () => {
      const bericht = prompt(T('ch.m.sosvraag','Wat is er aan de hand? (gaat direct naar het charterbedrijf EN naar RTG)'));
      if (bericht == null) return;
      const stuur = (lat, lng) => API.call('/charter/sos', { ref: b.dataset.chsos, bericht, lat, lng })
        .then(() => toast(T('ch.m.sosok','SOS verstuurd. Het charterbedrijf en RTG zijn gewaarschuwd.')))
        .catch(e => toast(e.message));
      if (navigator.geolocation) navigator.geolocation.getCurrentPosition(p => stuur(p.coords.latitude, p.coords.longitude), () => stuur());
      else stuur();
    }));
    document.querySelectorAll('[data-chloc]').forEach(b => b.addEventListener('click', async () => {
      const ref = b.dataset.chloc, aan = b.dataset.aan === '1';
      try {
        if (aan && navigator.geolocation){
          chLocWatch[ref] = navigator.geolocation.watchPosition(p =>
            API.call('/charter/locatie', { ref, aan: true, lat: p.coords.latitude, lng: p.coords.longitude }).catch(()=>{}));
          await API.call('/charter/locatie', { ref, aan: true });
        } else {
          if (chLocWatch[ref] != null){ navigator.geolocation.clearWatch(chLocWatch[ref]); delete chLocWatch[ref]; }
          await API.call('/charter/locatie', { ref, aan: false });
        }
        toast(aan ? T('ch.m.locaanok','U deelt uw positie met het charterbedrijf; uitzetten kan altijd.') : T('ch.m.locuitok','Positie delen staat uit en is gewist.'));
        laadCharter();
      } catch(e){ toast(e.message); }
    }));
  }
  function renderChAanbod(){
    const el = $('#chAanbod'); if (!el) return;
    if (!chPartners.length){ el.innerHTML = ''; return; }
    let html = '<div style="font-size:0.66rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--soft);margin:1.1rem 0 0.5rem;">'+T('ch.kop','Boten & jachten, RTG-veilig')+'</div>'+
      '<div style="font-size:0.72rem;color:var(--soft);margin-bottom:0.5rem;">'+T('ch.uitleg','Vaste prijs vooraf. Met of zonder schipper (bareboat met vaarbewijs). Staat met foto\'s voor en na, SOS op zee en RTG als scheidsrechter.')+'</div>';
    for (const p of chPartners){
      html += '<div class="card"><b>'+esc(p.name)+'</b> <span class="soft-sm">· '+esc(p.city||'')+'</span>';
