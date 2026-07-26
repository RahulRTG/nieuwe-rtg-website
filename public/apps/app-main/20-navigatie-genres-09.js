    if (adresIn) adresIn.addEventListener('input', () => { bzAdresW = adresIn.value; });
    $('#bzTerug').addEventListener('click', () => { bzZaak = null; renderBestellen(); });
    document.querySelectorAll('[data-bzplus]').forEach(b => b.addEventListener('click', () => { bzMand[b.dataset.bzplus]=(bzMand[b.dataset.bzplus]||0)+1; renderBzZaak(); }));
    document.querySelectorAll('[data-bzmin]').forEach(b => b.addEventListener('click', () => { const k=b.dataset.bzmin; if (bzMand[k]) bzMand[k]--; if (!bzMand[k]) delete bzMand[k]; renderBzZaak(); }));
    document.querySelectorAll('[data-bzlev]').forEach(b => b.addEventListener('click', () => { bzLevering = b.dataset.bzlev; renderBzZaak(); }));
    const hier = document.getElementById('bzHier');
    if (hier) hier.addEventListener('click', () => {
      if (!navigator.geolocation) return toast(T('bz.geengps','Dit apparaat deelt geen locatie.'));
      navigator.geolocation.getCurrentPosition(pos => { bzGeo = { lat: pos.coords.latitude, lng: pos.coords.longitude }; renderBzZaak(); },
        () => toast(T('bz.gpsfout','Locatie delen is geweigerd; de ETA blijft dan een schatting.')));
    });
    $('#bzBestel').addEventListener('click', async () => {
      const items = Object.entries(bzMand).map(([id, qty]) => ({ id, qty }));
      if (!items.length) return;
      try {
        const b = await API.call('/bezorg/bestel', { supplierCode: p.code, levering: bzLevering, items,
          adres: bzLevering === 'bezorgen' ? bzAdresW : undefined,
          lat: bzGeo ? bzGeo.lat : undefined, lng: bzGeo ? bzGeo.lng : undefined });
        await API.call('/order/pay', { ref: b.order.ref });
        toast(bzLevering === 'ophalen' ? T('bz.ok.oph','Betaald. Uw ophaalcode: ') + b.order.pickup : T('bz.ok.bez','Betaald. U volgt de bezorging hierboven live.'));
        bzZaak = null; bzMand = {};
        renderBestellen(); laadBzMijn();
      } catch(e){ toast(e.message); }
    });
  }

  /* ---------- ter plaatse: bestellen bij RTG-partners ---------- */
  const ALG_ICON = '<svg viewBox="0 0 64 64" fill="none" stroke="#0C0C0B" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 19 V13 a7 7 0 0 1 7-7 h6"/><path d="M45 6 h6 a7 7 0 0 1 7 7 v6"/><path d="M58 45 v6 a7 7 0 0 1-7 7 h-6"/><path d="M19 58 h-6 a7 7 0 0 1-7-7 v-6"/><circle cx="23.5" cy="26.5" r="2.6" fill="#0C0C0B"/><circle cx="40.5" cy="26.5" r="2.6" fill="#0C0C0B"/><path d="M32 26 v8.5 a2.2 2.2 0 0 1-2.2 2.2"/><path d="M23 42.5 a12.5 8.5 0 0 0 18 0"/></svg>';
  let suppliers = [];
  let myOrders = [];
  let menuState = null; // { supplier, menu, qty:{}, note, tag }

  async function renderTerPlaatse(){
    if (!API.live){
      $('#supplierList').innerHTML = '<div class="empty" style="padding:2rem 1rem;color:var(--soft);text-align:center;font-size:0.85rem;">'+T('app.tp.needserver','Ter plaatse werkt via de RTG-server. Start de app met de backend om te bestellen bij partners.')+'</div>';
      return;
    }
    try {
      const [sd, od] = await Promise.all([API.call('/suppliers', { city: trip.dest }), API.call('/orders/mine')]);
      suppliers = sd.suppliers || [];
      myOrders = od.orders || [];
      $('#tpSub').textContent = T('app.tp.partnersin','RTG-partners in') + ' ' + (sd.city || trip.dest) + ', ' + T('app.tp.orderpayreserve','bestel, betaal en reserveer.');
    } catch (e) { return; }

    renderLive();  // live "onderweg"-paneel bovenaan
    renderZorg();  // zorgprofiel + wie er (met toestemming) live meekijkt

    // mijn lopende bestellingen bovenaan
    const active = myOrders.filter(o => o.status !== 'terugbetaald');
    // "De rekening": achteraf-lopende bonnen per zaak, om na het eten in een keer
    // te voldoen (aan-de-balie-bonnen tellen niet mee: die gaan langs de kassa)
    const rekBij = {};
    active.filter(o => !o.paid && o.betaalMoment === 'achteraf' && !o.aanBalie).forEach(o => {
