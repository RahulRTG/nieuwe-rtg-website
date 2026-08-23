/* Een gerecht met ingrediënten, dieetlabels en keuzes aan de menukaart toevoegen. */
    if (canEdit){
      html += '<div class="card h-mt120"><div class="tt-h">'+T('menu.add','Gerecht toevoegen')+'</div>'+
        '<div class="field"><label>'+T('menu.name','Naam')+'</label><input id="mnName" placeholder="'+T('menu.nameph','Bijv. gegrilde octopus')+'"></div>'+
        '<div class="row-gap"><div class="field h-flex2"><label>'+T('menu.cat','Categorie')+'</label><input id="mnCat" placeholder="'+T('menu.catph','Bijv. Voorgerechten')+'"></div>'+
        '<div class="field h-flex1"><label>'+T('menu.price','Prijs (€)')+'</label><input id="mnPrice" type="number" inputmode="decimal" placeholder="45"></div></div>'+
        '<div class="field"><label>'+T('menu.desc','Omschrijving')+'</label><input id="mnDesc" placeholder="'+T('menu.descph','Kort en smakelijk')+'"></div>'+
        '<div class="field"><label>'+T('menu.alg','Allergenen (komma\'s)')+'</label><input id="mnAlg" placeholder="vis, soja"></div>'+
        '<div class="row-gap"><div class="field h-flex2"><label>Ingrediënten</label><input id="mnIng" placeholder="tomaat"></div><div class="field h-flex1"><label>Bereiding (min)</label><input id="mnPrep" placeholder="12"></div></div>'+
        '<div class="field"><label>Dieetlabels</label><input id="mnDieet" placeholder="vegetarisch"></div><div class="field"><label>Keuzes</label><input id="mnOpt" placeholder="Cuisson*: medium, doorbakken +1; Extra: kaas"></div>'+
        '<div class="field"><label>'+T('menu.station','Werkplek')+'</label><select id="mnStation" style="width:100%;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:0.8rem 1rem;font-size:0.9rem;color:var(--txt);outline:none;">'+
        '<option value="keuken"'+((S&&(S.type==='bar'||S.type==='club'))?'':' selected')+'>\uD83D\uDD25 '+T('menu.keuken','Keuken')+'</option>'+
        '<option value="bar"'+((S&&(S.type==='bar'||S.type==='club'))?' selected':'')+'>\uD83C\uDF78 Bar</option></select></div>'+
        '<button class="bigbtn" id="mnAdd">'+T('menu.addbtn','Zet op de kaart')+'</button></div>';
    }
    el.innerHTML = html;
    el.querySelectorAll('[data-mdel]').forEach(b => b.addEventListener('click', async () => {
      const menu = (state.menu||[]).filter(x => x.id !== b.dataset.mdel);
      try { await API.call('/supplier/menu', { menu }); toast(T('menu.removed','Van de kaart gehaald.')); await refresh(); openTab('menu'); } catch(e){ toast(e.message); }
    }));
    // gerecht wisselen van werkplek: keuken <-> bar (bepaalt op welk scherm het ticket komt)
    el.querySelectorAll('[data-mst]').forEach(b => b.addEventListener('click', async () => {
      const menu = (state.menu||[]).map(x => x.id === b.dataset.mst ? { ...x, station: x.station === 'bar' ? 'keuken' : 'bar' } : x);
      try { await API.call('/supplier/menu', { menu }); toast(T('menu.stmoved','Verplaatst naar de andere werkplek.')); await refresh(); openTab('menu'); } catch(e){ toast(e.message); }
    }));
    const add = $('#mnAdd'); if (add) add.addEventListener('click', async () => {
      const name = $('#mnName').value.trim(), price = Number($('#mnPrice').value);
      if (!name || !(price>0)){ toast(T('menu.fill','Vul een naam en prijs in.')); return; }
      const opties = $('#mnOpt').value.split(';').map((g,gi)=>{ const p=g.split(':'), kop=(p[0]||'').trim(), verplicht=kop.endsWith('*'); const keuzes=(p.slice(1).join(':')||'').split(',').map((v,ki)=>{const m=v.trim().match(/^(.*?)(?:\s+\+(\d+(?:[.,]\d+)?))?$/);return {id:'k-'+gi+'-'+ki,naam:(m&&m[1]||'').trim(),prijsCenten:Math.round(Number((m&&m[2]||'0').replace(',','.'))*100)};}).filter(k=>k.naam);return {id:'g-'+gi,naam:kop.replace(/\*$/,'').trim(),verplicht,min:verplicht?1:0,max:verplicht?1:Math.max(1,keuzes.length),keuzes};}).filter(g=>g.naam&&g.keuzes.length);
      const item = { id: RTGId('m'), cat: $('#mnCat').value.trim()||T('menu.other','Overig'), name, desc: $('#mnDesc').value.trim(), price, allergens: $('#mnAlg').value.split(',').map(a=>a.trim().toLowerCase()).filter(Boolean), ingredienten:$('#mnIng').value.split(',').map(a=>a.trim()).filter(Boolean), dieet:$('#mnDieet').value.split(',').map(a=>a.trim().toLowerCase()).filter(Boolean), opties, prepMin:Number($('#mnPrep').value)||undefined, station: $('#mnStation') ? $('#mnStation').value : 'keuken' };
      try { await API.call('/supplier/menu', { menu: [...(state.menu||[]), item] }); toast(T('menu.added','Staat op de kaart, gasten zien het direct.')); await refresh(); openTab('menu'); } catch(e){ toast(e.message); }
    });
  }
