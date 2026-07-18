    if (stationMode === 'keuken') loadCoach(el);
    // de voorraadbalk: 86 zetten op advies en derving melden vanaf de vloer
    el.querySelectorAll('[data-st86adv]').forEach(b => b.addEventListener('click', async () => {
      try {
        await API.call('/supplier/menu/86', { itemId: b.dataset.st86adv, op: true });
        toast('⛔ '+T('st.86gezet','86 gezet; leden kunnen het niet meer bestellen.'));
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
        toast('♻ '+T('st.derfok','Geboekt in het voorraadlogboek.'));
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
      try { await API.call('/supplier/overschot', { op: 'erbij', itemId: el.querySelector('#ovGerecht').value, qty: el.querySelector('#ovAantal').value }); toast('🥡 '+T('over.toast','Gemeld; elk scherm telt het nu van de maaklijst af.')); await refresh(); } catch(e){ toast(e.message); }
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
        toast('⚡ '+T('spoed.toast','Spoedbon staat op de lijn, als gewone bon.'));
        await refresh();
      } catch(e){ toast(e.message); }
    });
    el.querySelectorAll('[data-spoedaf]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/order/spoed', { ref: b.dataset.spoedaf, op: false }); await refresh(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-lijnaan]').forEach(b => b.addEventListener('click', async () => {
      try { const d = await API.call('/supplier/lijn', { sectie: b.dataset.lijnaan }); toast(d.aangemeld ? '👥 '+T('lijn.aant','Aangemeld op deze kant.') : T('lijn.aftoast','Afgemeld van deze kant.')); await refresh(); } catch(e){ toast(e.message); }
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
    el.querySelectorAll('[data-sttbl]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/table/status', { id: b.dataset.sttbl, status: TBL_NEXT[b.dataset.cur]||'vrij' }); await refresh(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-evcheck]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/event/checkin', { eventId: b.dataset.evcheck, key: b.dataset.key }); await refresh(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-rundone]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/event/runsheet/done', { id: b.dataset.rundone, itemId: b.dataset.item }); await refresh(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-kmep]').forEach(b => b.addEventListener('click', async () => {
      b.disabled = true; b.textContent = T('ek.busy','De mise en place wordt georganiseerd...');
      try { const d = await API.call('/supplier/event/mep', { id: b.dataset.kmep });
        toast('\u2705 '+d.added+' '+T('ek.planned','MEP-taken ingepland voor '+d.covers+' couverts.'));
        await refresh(); } catch(e){ toast(e.message); b.disabled = false; }
    }));
    el.querySelectorAll('[data-dmgen]').forEach(b => b.addEventListener('click', async () => {
      b.disabled = true; b.textContent = T('dm.busy','Voorspellen...');
      try { const d = await API.call('/supplier/mep/daily', { day: b.dataset.dmgen });
        toast('\u2728 '+T('dm.done1','Voorspelling klaar:')+' '+d.plan.covers+' couverts ('+d.plan.factorLabel+')'+(d.histDagen?', '+T('dm.hist','op basis van')+' '+d.histDagen+' '+T('dm.days','dagen historie'):''));
        await refresh(); } catch(e){ toast(e.message); b.disabled = false; }
    }));
    el.querySelectorAll('[data-dmdone]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/mep/daily/done', { date: b.dataset.dmdone, taskId: b.dataset.item }); await refresh(); } catch(e){ toast(e.message); }
    }));
    if (stationMode === 'kantoor') bindKantoor(el);
    // chauffeurspost: ritfase doorzetten of een open rit aannemen
    el.querySelectorAll('[data-chgo]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/ride/status', { ref: b.dataset.chgo, status: b.dataset.st }); await refresh(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-bkgo]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/booking/status', { ref: b.dataset.bkgo, status: b.dataset.st }); await refresh(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-chneem]').forEach(b => b.addEventListener('click', async () => {
      try {
        const s2 = await API.call('/supplier/ride/suggest', { ref: b.dataset.chneem });
        await API.call('/supplier/ride/assign', { ref: b.dataset.chneem, self: true, vehicleId: s2.vehicleId });
        toast(T('ch.genomen','Rit is van u.') + (s2.vehicleName ? ' 🚘 ' + s2.vehicleName : ''));
        await refresh();
      } catch(e){ toast(e.message); }
    }));
  }

