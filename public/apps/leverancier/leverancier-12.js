/* de tafelstatus en het inchecken van gasten */
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
        toast(T('ch.genomen','Rit is van u.') + (s2.vehicleName ? '  ' + s2.vehicleName : ''));
        await refresh();
      } catch(e){ toast(e.message); }
    }));
  }

  /* ---- het Kantoor: de eigenaar/manager past hier alles aan ---- */
  let kantoorSec = 'bo', kantoorMsg = '';
  let kantoorEdit = null;   // gerecht dat open staat in de kaart-bewerker
  // de AI-bedrijfsagent: vaste leverancier, inkoopvoorstellen en het AI-weekrooster
  let agentData = null, agentMarkt = null, agentBusy = false;
  // de urenregistratie: iedereen klokt via de PDA, het kantoor ziet het beeld
  let klokOverzicht = null, klokBusy = false;
  async function laadKlok(){
    if (klokBusy) return;
    klokBusy = true;
    try { klokOverzicht = (await API.call('/staff/klok/overzicht', {})).rows; } catch(e){ klokOverzicht = []; }
    klokBusy = false;
    renderStation();
  }
  async function laadAgent(){
    if (agentBusy) return;
    agentBusy = true;
    try { agentData = (await API.call('/supplier/agent', {})).agent; } catch(e){ agentData = { voorstellen: [], error: e.message }; }
    try { if (!agentMarkt) agentMarkt = (await API.call('/supplier/inkoop/markt', {})).groothandels || []; } catch(e){ agentMarkt = agentMarkt || []; }
    agentBusy = false;
    renderStation();
  }
  // eigen backoffice van de zaak: dagcijfers, weektrend, toppers en actiecentrum
  let boData = null, boBusy = false, vwData = null, synData = null;
  async function laadBackoffice(){
    if (boBusy) return;
    boBusy = true;
    try { boData = await API.call('/supplier/backoffice', {}); }
    catch(e){ boData = { error: e.message }; }
    // de voorspeller kijkt mee: wat komt er morgen waarschijnlijk?
    try { vwData = await API.call('/supplier/voorspel', {}); } catch(e){ vwData = null; }
    // synergie: deals en pakketten samen met andere zaken
    try { synData = await API.call('/supplier/synergie', {}); } catch(e){ synData = null; }
    boBusy = false;
    renderStation();
  }
  // open uitnodigingen (kassacodes) van het team, voor de HR-sectie
  let invData = null, invBusy = false;
  async function laadInvites(){
    if (invBusy) return;
    invBusy = true;
    try { invData = await API.call('/supplier/staff/invites', {}); }
    catch(e){ invData = { invites: [] }; }
    invBusy = false;
    renderStation();
  }
  // boekhouding: btw per genre, personeelskosten en cadeaukaarten, per land
  let finData = null, finBusy = false, finMsg = '', accAntwoord = '';
  let zakData = null, zakBusy = false;
  let thuisData = null, thuisBusy = false;
  let wvData = null, wvBusy = false, wvTab = 'koppel';
  // Salon-bedrijfsprofiel: volgers, aanbiedingen, polls en cijfers
  let mktData = null, mktBusy = false, mktMsg = '';
  async function laadMarketing(){
    if (mktBusy) return;
    mktBusy = true;
    try { mktData = await API.call('/supplier/salon/stats', {}); }
    catch(e){ mktData = { error: e.message }; }
    mktBusy = false;
    renderStation();
  }
  // Een bestand (PDF/CSV) ophalen met het token en als download aanbieden.
  async function dlBestand(pad, body, filename){
    if (!API.token) return;
    try {
      const res = await fetch('/api' + pad, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + API.token }, body: JSON.stringify(body || {}) });
      if (!res.ok) throw new Error('fout');
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch(e){ toast(T('fn.dlfout','Exporteren lukte niet.')); }
  }
  async function laadFinance(){
    if (finBusy) return;
    finBusy = true;
    try { finData = await API.call('/supplier/finance', {}); }
    catch(e){ finData = { error: e.message }; }
    finBusy = false;
    renderStation();
  }
