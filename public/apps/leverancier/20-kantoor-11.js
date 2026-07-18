    const ktM = el.querySelector('#ktMAdd'); if (ktM) ktM.addEventListener('click', async () => {
      const name = el.querySelector('#ktMn').value.trim(), price = Number(el.querySelector('#ktMp').value);
      if (!name || !(price>0)){ toast(T('menu.fill','Vul een naam en prijs in.')); return; }
      const item = { id: 'm'+Date.now().toString(36), cat: el.querySelector('#ktMc').value.trim()||T('menu.other','Overig'), name, desc:'', price, allergens:[], station: kantoorSec };
      try { await API.call('/supplier/menu', { menu: [...(state.menu||[]), item] }); await refresh(); } catch(e){ toast(e.message); }
    });
    // de AI-bedrijfsagent: koppelen, inkoop voorstellen, goedkeuren/aanpassen/afwijzen, rooster
    const agK = el.querySelector('#agKoppel'); if (agK) agK.addEventListener('click', async () => {
      try { await API.call('/supplier/agent/koppel', { groothandelCode: el.querySelector('#agGh').value, auto: el.querySelector('#agAuto').checked }); agentData = null; toast(T('ag2.gekoppeld','Vaste leverancier bijgewerkt.')); renderStation(); } catch(e){ toast(e.message); }
    });
    el.querySelectorAll('[data-agweg]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/agent/koppel', { groothandelCode: b.dataset.agweg, weg: true }); agentData = null; toast(T('ag2.los','Groothandel losgekoppeld.')); renderStation(); } catch(e){ toast(e.message); }
    }));
    const agS = el.querySelector('#agStel'); if (agS) agS.addEventListener('click', async () => {
      try { await API.call('/supplier/agent/voorstel', {}); agentData = null; renderStation(); } catch(e){ toast(e.message); }
    });
    el.querySelectorAll('[data-agok]').forEach(b => b.addEventListener('click', async () => {
      const id = b.dataset.agok;
      const regels = [...el.querySelectorAll('[data-agr="'+id+'"]')].map(inp => ({ productId: inp.dataset.pid, aantal: inp.value }));
      try { const d = await API.call('/supplier/agent/beslis', { id, actie: 'akkoord', regels }); toast('✔ '+T('ag2.besteld','Besteld bij de leverancier')+(d.order?' ('+d.order.ref+')':'')); agentData = null; renderStation(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-agnee]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/agent/beslis', { id: b.dataset.agnee, actie: 'afwijzen' }); agentData = null; renderStation(); } catch(e){ toast(e.message); }
    }));
    const agR = el.querySelector('#agRooster'); if (agR) agR.addEventListener('click', async () => {
      try { await API.call('/supplier/rooster/voorstel', {}); agentData = null; renderStation(); } catch(e){ toast(e.message); }
    });
    const agRok = el.querySelector('#agRoosterOk'); if (agRok) agRok.addEventListener('click', async () => {
      try { await API.call('/supplier/rooster/beslis', { actie: 'akkoord' }); agentData = null; toast(T('ag2.rooster.vastok','Weekrooster vastgesteld.')); renderStation(); } catch(e){ toast(e.message); }
    });
    const agRnee = el.querySelector('#agRoosterNee'); if (agRnee) agRnee.addEventListener('click', async () => {
      try { await API.call('/supplier/rooster/beslis', { actie: 'afwijzen' }); agentData = null; renderStation(); } catch(e){ toast(e.message); }
    });
    el.querySelectorAll('[data-ktoggle]').forEach(b => b.addEventListener('click', async () => {
      const k = b.dataset.ktoggle, cur = (state.settings||{})[k] !== false;
      try { const body = {}; body[k] = !cur; await API.call('/supplier/settings', body); await refresh(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-ktdel]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/table/remove', { id: b.dataset.ktdel }); await refresh(); } catch(e){ toast(e.message); }
    }));
    const ktT = el.querySelector('#ktTAdd'); if (ktT) ktT.addEventListener('click', async () => {
      const name = el.querySelector('#ktTn').value.trim(); if(!name){ toast(T('kt.filltafel','Geef de tafel een naam.')); return; }
      try { await API.call('/supplier/table/add', { name, seats: Number(el.querySelector('#ktTs').value)||4 }); await refresh(); } catch(e){ toast(e.message); }
    });
    const kEv = el.querySelector('#kEvAdd'); if (kEv) kEv.addEventListener('click', async () => {
      const name = el.querySelector('#kEvName').value.trim(), date = el.querySelector('#kEvDate').value;
      if (!name || !date){ toast(T('kt.ev.fill','Vul minimaal een naam en datum in.')); return; }
      try { await API.call('/supplier/event', { action:'add', event: { name, date, time: el.querySelector('#kEvTime').value, desc: el.querySelector('#kEvDesc').value.trim(), capacity: Number(el.querySelector('#kEvCap').value)||50, price: Number(el.querySelector('#kEvPrice').value)||0 } });
        kantoorMsg = '\u2705 '+T('kt.ev.made','Event aangemaakt als concept. Publiceer hem zodra hij af is.');
        await refresh(); } catch(e){ toast(e.message); }
    });
    el.querySelectorAll('[data-kevpub]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/event', { action:'publish', id: b.dataset.kevpub }); await refresh(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-kevdel]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/event', { action:'remove', id: b.dataset.kevdel }); await refresh(); } catch(e){ toast(e.message); }
    }));
    // draaiboek: regel toevoegen / weghalen / plakken / uploaden / AI
    el.querySelectorAll('[data-kradd]').forEach(b => b.addEventListener('click', async () => {
      const id = b.dataset.kradd;
      const text = el.querySelector('#krX'+id).value.trim();
      if (!text){ toast(T('rs.fill','Omschrijf wat er moet gebeuren.')); return; }
      try { await API.call('/supplier/event/runsheet', { id, action:'add', item: { time: el.querySelector('#krT'+id).value || '00:00', station: el.querySelector('#krS'+id).value, text, daysBefore: Number(el.querySelector('#krD'+id).value)||0 } }); await refresh(); } catch(e){ toast(e.message); }
    }));
