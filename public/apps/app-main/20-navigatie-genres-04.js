      if (open){
        const k = carePakKeuze;
        html += '<div style="margin-top:0.6rem;border-top:1px solid var(--line);padding-top:0.6rem;">'+
          '<div class="soft-sm" style="margin-bottom:0.35rem;">'+T('care.pakkies','Kies wanneer de behandeling valt:')+'</div>'+
          '<div style="display:flex;gap:0.35rem;flex-wrap:wrap;">'+dagen.map(d =>
            '<button class="bz-btn'+(k.datum===d?' on':'')+'" data-carepakd="'+d+'">'+(d===dagen[0]?T('care.vandaag','vandaag'):d.slice(8)+'/'+d.slice(5,7))+'</button>').join('')+'</div>'+
          '<div style="display:flex;gap:0.35rem;flex-wrap:wrap;margin-top:0.45rem;">'+(p.tijden||[]).map(t2 =>
            '<button class="bz-btn'+(k.tijd===t2?' on':'')+'" data-carepakt="'+t2+'">'+t2+'</button>').join('')+'</div>'+
          '<button class="bz-groot" id="carePakBoek" style="margin-top:0.7rem;"'+(k.tijd?'':' disabled')+'>'+T('care.pakboek','Boek dit pakket')+' · '+eur(p.prijs)+'</button></div>';
      } else {
        html += '<button class="bz-btn" data-carepakopen="'+esc(p.id)+'" style="margin-top:0.5rem;">'+T('care.pakkies2','Kies dag en tijd')+'</button>';
      }
      html += '</div>';
    }
    el.innerHTML = html;
    el.querySelectorAll('[data-carepakpay]').forEach(x => x.addEventListener('click', async () => {
      try { await API.call('/care/pakket/betaal', { ref: x.dataset.carepakpay }); toast(T('care.paktoast','Pakket betaald. Fijn verblijf.')); laadCare(); }
      catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-carepakopen]').forEach(x => x.addEventListener('click', () => {
      carePakOpen = x.dataset.carepakopen; carePakKeuze = { datum: dagen[0], tijd: null }; renderCarePakketten();
    }));
    el.querySelectorAll('[data-carepakd]').forEach(x => x.addEventListener('click', () => { carePakKeuze.datum = x.dataset.carepakd; renderCarePakketten(); }));
    el.querySelectorAll('[data-carepakt]').forEach(x => x.addEventListener('click', () => { carePakKeuze.tijd = x.dataset.carepakt; renderCarePakketten(); }));
    const pb = document.getElementById('carePakBoek');
    if (pb) pb.addEventListener('click', async () => {
      try {
        const r = await API.call('/care/pakket/boek', { pakketId: carePakOpen, datum: carePakKeuze.datum, tijd: carePakKeuze.tijd });
        await API.call('/care/pakket/betaal', { ref: r.pakket.ref });
        toast(T('care.paktoast','Pakket betaald. Fijn verblijf.'));
        carePakOpen = null; carePakKeuze = null;
        laadCare();
      } catch(e){ toast(e.message); }
    });
  }

  /* ---------- autoverhuur: eerlijk huren ---------- */
  let vhPartners = [], vhOpen = null, vhKeuze = null, vhLocWatch = {};
  function vhFotoKlein(file, cb){
    const r = new FileReader();
    r.onload = () => { const img = new Image(); img.onload = () => {
      const c = document.createElement('canvas'); const sc = Math.min(1, 900 / Math.max(img.width, img.height));
      c.width = Math.round(img.width * sc); c.height = Math.round(img.height * sc);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      cb(c.toDataURL('image/jpeg', 0.7));
    }; img.src = r.result; };
    r.readAsDataURL(file);
  }
  async function laadVerhuur(){
    if (!API.live) return;
    try { vhPartners = (await API.call('/verhuur/aanbod')).partners || []; } catch(e){ vhPartners = []; }
    let mijn = [];
    try { mijn = (await API.call('/huur/mijn')).huren || []; } catch(e){}
    const el = $('#vhMijn');
    const VH_ST = { 'aangevraagd': T('vh.m.geboekt','geboekt; leg de staat vast bij het ophalen'), 'lopend': T('vh.m.lopend','onderweg; goede reis'), 'afgerond': T('vh.m.af','afgerond') };
    if (el) el.innerHTML = mijn.filter(h => h.status !== 'afgerond' || h.tot >= new Date().toISOString().slice(0, 10)).map(h =>
      '<div class="card" style="border-color:rgba(91,185,140,0.35);">'+
      '<div style="font-size:0.62rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--green);">\uD83D\uDE97 '+T('vh.m.kop','Huurauto')+' \u00B7 '+esc(h.supplierName)+'</div>'+
      '<div style="margin-top:0.35rem;font-size:0.92rem;"><b>'+esc(h.auto)+'</b>'+(h.kenteken?' ('+esc(h.kenteken)+')':'')+' \u00B7 '+h.van+' \u2192 '+h.tot+' \u00B7 '+eur(h.prijs)+'</div>'+
      (h.spec ? '<div style="margin-top:0.25rem;font-size:0.72rem;color:var(--soft);">'+esc(h.spec.categorie||'')+' \u00B7 '+(h.spec.transmissie==='automaat'?T('vh.aut','automaat'):T('vh.hand','handgesch.'))+' \u00B7 \uD83D\uDC65'+(h.spec.stoelen||'-')+' \u00B7 '+(h.spec.kmPerDag?h.spec.kmPerDag+' km/'+T('vh.dag','dag'):T('vh.onbeperkt','onbeperkt km'))+(h.borg?' \u00B7 '+T('vh.borg','borg')+' '+eur(h.borg):'')+'</div>' : '')+
      '<div style="margin-top:0.3rem;font-size:0.78rem;color:var(--muted);">'+(VH_ST[h.status]||h.status)+' \u00B7 \uD83D\uDCF7 '+T('vh.m.voor','voor')+' '+h.fotosVoor+' \u00B7 '+T('vh.m.na','na')+' '+h.fotosNa+(h.uitgifte?' \u00B7 '+h.uitgifte.kmStart+' km':'')+'</div>'+
      (h.inname ? '<div style="margin-top:0.25rem;font-size:0.78rem;color:'+(h.inname.meerkosten>0?'var(--gold)':'var(--green)')+';">'+(h.inname.meerkosten>0 ? T('vh.m.meer','Meerkosten')+': '+eur(h.inname.meerkosten)+' ('+h.inname.gereden+' km)' : '\u2713 '+h.inname.gereden+' km \u00B7 '+T('vh.m.geenmeer','geen meerkosten, borg vrij'))+'</div>' : '')+
      (h.status !== 'afgerond' ?
        '<div style="display:flex;gap:0.4rem;flex-wrap:wrap;margin-top:0.55rem;">'+
        (h.status === 'aangevraagd' ? '<button class="bz-btn" data-vhf="'+h.ref+'" data-fase="voor">\uD83D\uDCF7 '+T('vh.m.fotovoor','Staat vastleggen (voor)')+'</button>' : '')+
        (h.status === 'lopend' ? '<button class="bz-btn" data-vhf="'+h.ref+'" data-fase="na">\uD83D\uDCF7 '+T('vh.m.fotona','Staat vastleggen (na)')+'</button>'+
          '<button class="bz-btn'+(h.locatieAan?' on':'')+'" data-vhloc="'+h.ref+'" data-aan="'+(h.locatieAan?'0':'1')+'">\uD83D\uDCCD '+(h.locatieAan?T('vh.m.locuit','Locatie delen uit'):T('vh.m.locaan','Deel live locatie'))+'</button>' : '')+
        '<button data-vhsos="'+h.ref+'" style="background:var(--burgundy-deep);border:1px solid var(--burgundy);color:#fff;border-radius:999px;padding:0.5rem 1rem;font-size:0.8rem;font-weight:700;cursor:pointer;font-family:inherit;">\uD83C\uDD98 SOS</button>'+
        '</div>' : '')+
      '</div>').join('');
    renderVhAanbod();
    koppelVhActies();
  }
  function koppelVhActies(){
    const file = (() => { let f = document.getElementById('vhLidFile');
      if (!f){ f = document.createElement('input'); f.type = 'file'; f.accept = 'image/*'; f.capture = 'environment'; f.id = 'vhLidFile'; f.style.display = 'none'; document.body.appendChild(f); }
      return f; })();
    document.querySelectorAll('[data-vhf]').forEach(b => b.addEventListener('click', () => {
      file.onchange = () => {
        if (!file.files[0]) return;
        vhFotoKlein(file.files[0], async (dataUrl) => {
          try { await API.call('/huur/foto', { ref: b.dataset.vhf, fase: b.dataset.fase, foto: dataUrl });
            toast(T('vh.m.foto.ok','Vastgelegd. Dit is uw bewijs van de staat.')); laadVerhuur(); }
          catch(e){ toast(e.message); }
        });
        file.value = '';
      };
      file.click();
    }));
    document.querySelectorAll('[data-vhsos]').forEach(b => b.addEventListener('click', () => {
      const bericht = prompt(T('vh.m.sosvraag','Wat is er aan de hand? (gaat direct naar de verhuurder EN naar RTG)'));
      if (bericht == null) return;
      const stuur = (lat, lng) => API.call('/huur/sos', { ref: b.dataset.vhsos, bericht, lat, lng })
        .then(() => toast(T('vh.m.sosok','SOS verstuurd. De verhuurder en RTG zijn gewaarschuwd.')))
        .catch(e => toast(e.message));
      if (navigator.geolocation) navigator.geolocation.getCurrentPosition(p => stuur(p.coords.latitude, p.coords.longitude), () => stuur());
      else stuur();
    }));
    document.querySelectorAll('[data-vhloc]').forEach(b => b.addEventListener('click', async () => {
      const ref = b.dataset.vhloc, aan = b.dataset.aan === '1';
      try {
        if (aan && navigator.geolocation){
          vhLocWatch[ref] = navigator.geolocation.watchPosition(p =>
            API.call('/huur/locatie', { ref, aan: true, lat: p.coords.latitude, lng: p.coords.longitude }).catch(()=>{}));
          await API.call('/huur/locatie', { ref, aan: true });
        } else {
          if (vhLocWatch[ref] != null){ navigator.geolocation.clearWatch(vhLocWatch[ref]); delete vhLocWatch[ref]; }
          await API.call('/huur/locatie', { ref, aan: false });
        }
        toast(aan ? T('vh.m.locaanok','U deelt uw locatie met de verhuurder; uitzetten kan altijd.') : T('vh.m.locuitok','Locatie delen staat uit en is gewist.'));
        laadVerhuur();
      } catch(e){ toast(e.message); }
    }));
  }
  function renderVhAanbod(){
    const el = $('#vhAanbod'); if (!el) return;
    if (!vhPartners.length){ el.innerHTML = ''; return; }
    let html = '<div style="font-size:0.66rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--soft);margin:1.1rem 0 0.5rem;">'+T('vh.kop','Autoverhuur, RTG-veilig')+'</div>'+
      '<div style="font-size:0.72rem;color:var(--soft);margin-bottom:0.5rem;">'+T('vh.uitleg','Vaste prijs vooraf betaald. Staat vastgelegd met foto\'s voor en na. SOS-knop en RTG als scheidsrechter.')+'</div>';
