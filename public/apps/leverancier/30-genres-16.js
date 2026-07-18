    const aan = $('#vkAan'); if (aan) aan.addEventListener('change', async () => { try { await API.call('/supplier/verkoop/aan', { aan: aan.checked }); renderVerkoop(); } catch(e){ toast(e.message); } });
    el.querySelectorAll('[data-vkplan]').forEach(b => b.addEventListener('click', async () => { const m = prompt(T('vk.moment','Wanneer? (bv. za 10:00)')); if(m===null) return; try { await API.call('/supplier/verkoop/deal', { ref:b.dataset.vkplan, actie:'plan', moment:m }); renderVerkoop(); } catch(e){ toast(e.message); } }));
    el.querySelectorAll('[data-vkact]').forEach(b => b.addEventListener('click', async () => {
      const actie = b.dataset.act; const body = { ref:b.dataset.vkact, actie };
      if (actie==='aanvaard'){ const p = prompt(T('vk.tegenbod','Verkoopprijs bevestigen of tegenbod (€):'), b.dataset.prijs||''); if(p===null) return; body.prijs = p; if (b.dataset.inruil==='1'){ const t = prompt(T('vk.taxatie','Inruil taxeren op (€):'),'0'); if(t!==null) body.taxatie = t; } }
      try { await API.call('/supplier/verkoop/deal', body); renderVerkoop(); } catch(e){ toast(e.message); }
    }));
    const nw = el.querySelector('.js-vknew'); if (nw) nw.addEventListener('click', () => { vkAutoBewerk = {}; vkForm(d.brandstoffen||[]); });
    el.querySelectorAll('.js-vkedit').forEach(b => b.addEventListener('click', () => { vkAutoBewerk = (d.showroom||[]).find(a=>a.id===b.dataset.id) || {}; vkForm(d.brandstoffen||[]); }));
    if (vkAutoBewerk) vkForm(d.brandstoffen||[]);
  }
  function vkDeal(d){
    const koop = d.soort==='koop';
    let acties = '';
    if (koop){
      if (d.status==='aangevraagd') acties = '<button class="js-vkact" data-vkact="'+d.ref+'" data-act="aanvaard" data-prijs="'+(d.prijs||'')+'" data-inruil="'+(d.inruil?1:0)+'" style="flex:1;background:var(--gold);color:#000;border:none;border-radius:8px;padding:0.4rem;font-weight:600;font-family:inherit;font-size:0.75rem;">'+T('vk.aanvaard','Aanvaarden')+'</button>';
      else if (d.status==='getekend') acties = '<button class="js-vkact" data-vkact="'+d.ref+'" data-act="afgeleverd" style="flex:1;background:var(--gold);color:#000;border:none;border-radius:8px;padding:0.4rem;font-weight:600;font-family:inherit;font-size:0.75rem;">'+T('vk.aflever','Afgeleverd')+'</button>';
      else acties = '<span class="sub" style="flex:1;align-self:center;">'+T('vk.wacht','wacht op tekenen')+'</span>';
    } else {
      if (d.status==='aangevraagd') acties = '<button data-vkplan="'+d.ref+'" style="flex:1;background:var(--gold);color:#000;border:none;border-radius:8px;padding:0.4rem;font-weight:600;font-family:inherit;font-size:0.75rem;">'+T('vk.plan','Inplannen')+'</button>';
      else if (d.status==='ingepland') acties = '<button class="js-vkact" data-vkact="'+d.ref+'" data-act="gereden" style="flex:1;background:var(--gold);color:#000;border:none;border-radius:8px;padding:0.4rem;font-weight:600;font-family:inherit;font-size:0.75rem;">'+T('vk.gereden','Gereden')+'</button>';
    }
    return '<div style="border:1px solid var(--line);border-radius:12px;padding:0.7rem 0.85rem;margin-top:0.5rem;">'+
      '<div style="display:flex;gap:0.5rem;"><b style="flex:1;font-size:0.85rem;">'+(koop?'🔑 ':'🚗 ')+esc(d.autoNaam)+'</b><span class="sub">'+esc(d.codenaam)+' · '+esc(d.status)+'</span></div>'+
      '<div class="sub">'+(koop? (T('vk.bod','bod')+' '+eur(d.bod||0)+(d.inruil?' · '+T('vk.inruil','inruil')+' '+esc([d.inruil.merk,d.inruil.model].filter(Boolean).join(' ')):'')+(d.concierge?' · '+T('vk.concierge','concierge')+' '+esc(d.adres||''):'')) : (d.wens?esc(d.wens):T('vk.proefrit','proefrit'))+(d.moment?' · '+esc(d.moment):''))+'</div>'+
      '<div style="display:flex;gap:0.4rem;margin-top:0.5rem;">'+acties+'<button class="js-vkact" data-vkact="'+d.ref+'" data-act="afwijs" style="background:none;border:1px solid var(--line);border-radius:8px;padding:0.4rem 0.7rem;color:var(--soft);font-family:inherit;font-size:0.75rem;">'+T('vk.afwijs','Afwijzen')+'</button></div></div>';
  }
  function vkForm(brandstoffen){
    const el = $('#vkForm'); if (!el) return; const a = vkAutoBewerk || {};
    el.innerHTML = '<div style="border:1px solid var(--gold);border-radius:12px;padding:0.8rem;margin-top:0.5rem;">'+
      '<div class="row-gap"><input id="vkMerk" class="st-in" placeholder="'+T('vk.f.merk','Merk')+'" value="'+esc(a.merk||'')+'" style="flex:1;"><input id="vkModel" class="st-in" placeholder="'+T('vk.f.model','Model')+'" value="'+esc(a.model||'')+'" style="flex:1;"></div>'+
      '<div class="row-gap"><input id="vkJaar" class="st-in" type="number" placeholder="'+T('vk.f.jaar','Jaar')+'" value="'+(a.jaar||'')+'" style="flex:1;"><input id="vkKm" class="st-in" type="number" placeholder="'+T('vk.f.km','Km')+'" value="'+(a.km!=null?a.km:'')+'" style="flex:1;"><input id="vkPrijs" class="st-in" type="number" placeholder="'+T('vk.f.prijs','Prijs €')+'" value="'+(a.prijs!=null?a.prijs:'')+'" style="flex:1;"></div>'+
      '<div class="row-gap"><select id="vkBr" class="st-in" style="flex:1;">'+(brandstoffen||['Benzine']).map(b=>'<option'+(a.brandstof===b?' selected':'')+'>'+esc(b)+'</option>').join('')+'</select><input id="vkPk" class="st-in" type="number" placeholder="'+T('vk.f.pk','Pk')+'" value="'+(a.vermogenPk||'')+'" style="flex:1;"><input id="vkGar" class="st-in" type="number" placeholder="'+T('vk.f.garantie','Garantie mnd')+'" value="'+(a.garantieMnd!=null?a.garantieMnd:12)+'" style="flex:1;"></div>'+
      '<input id="vkHist" class="st-in" placeholder="'+T('vk.f.historie','Historie / bijzonderheden')+'" value="'+esc(a.historie||'')+'" style="width:100%;">'+
      '<label style="display:flex;align-items:center;gap:0.5rem;font-size:0.8rem;margin:0.3rem 0;"><input type="checkbox" id="vkVip"'+(a.vip?' checked':'')+'> '+T('vk.f.vip','VIP / exclusief (bovenaan)')+'</label>'+
      '<div style="display:flex;gap:0.4rem;margin-top:0.4rem;"><button id="vkSave" style="flex:1;background:var(--gold);color:#000;border:none;border-radius:8px;padding:0.45rem;font-weight:600;font-family:inherit;">'+T('vk.opslaan','Opslaan')+'</button>'+
      '<button id="vkCancel" style="background:none;border:1px solid var(--line);border-radius:8px;padding:0.45rem 0.8rem;color:var(--soft);font-family:inherit;">'+T('vk.annuleer','Annuleer')+'</button></div></div>';
    $('#vkCancel').addEventListener('click', () => { vkAutoBewerk = null; renderVerkoop(); });
    $('#vkSave').addEventListener('click', async () => {
      const body = { id:a.id, merk:$('#vkMerk').value.trim(), model:$('#vkModel').value.trim(), jaar:$('#vkJaar').value, km:$('#vkKm').value,
        prijs:$('#vkPrijs').value, brandstof:$('#vkBr').value, vermogenPk:$('#vkPk').value, garantieMnd:$('#vkGar').value,
        historie:$('#vkHist').value.trim(), vip:$('#vkVip').checked };
      try { await API.call('/supplier/verkoop/auto', body); vkAutoBewerk = null; toast(T('vk.opgeslagen','Auto opgeslagen.')); renderVerkoop(); } catch(e){ toast(e.message); }
    });
  }

