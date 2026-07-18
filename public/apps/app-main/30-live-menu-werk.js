  /* ---------- Onderweg (live reis) ---------- */
  let liveData = null;
  let liveMode = 'driving';
  let simTimer = null;
  const RIDE_ST = { 'wacht-op-betaling':'awaiting payment', 'aangevraagd':'requested', 'geaccepteerd':'confirmed', 'onderweg':'on the way', 'aangekomen':'arrived', 'rijdt':'driving', 'aan-boord':'on board', 'gearriveerd':'completed', 'afgerond':'completed', 'geweigerd':'declined' };
  const tRide = s => (lang() === 'en' ? (RIDE_ST[s] || s) : s);

  async function renderLive(){
    if (!API.live){ $('#livePanel').innerHTML = ''; return; }
    try { liveData = (await API.call('/live/state')).live; }
    catch (e){ $('#livePanel').innerHTML = ''; return; }
    if (!liveData || !liveData.active){ stopSim(); renderLiveStart(); }
    else renderLivePanel();
  }

  function renderLiveStart(){
    const opts = suppliers.map(s => '<option value="' + s.code + '">' + s.name + ' (' + tType(s.typeLabel) + ')</option>').join('');
    const modes = [['walking','Lopen'],['driving','Rijden'],['flying','Vliegen']];
    $('#livePanel').innerHTML =
      '<div class="live-start">' +
        '<div class="lh">' + T('live.start.h','Ergens heen?') + '</div>' +
        '<div class="ld">' + T('live.start.d','Zet uw reis live. Uw partners, uw taxi, het restaurant, zien waar u bent en zorgen dat alles klaarstaat wanneer u aankomt. Altijd op codenaam, nooit op naam.') + '</div>' +
        '<div class="live-dest-row"><select id="liveDest">' + opts + '</select></div>' +
        '<div class="live-mode">' + modes.map(m => '<button data-mode="' + m[0] + '"' + (m[0]===liveMode?' class="on"':'') + '>' + T('live.mode.'+m[0], m[1]) + '</button>').join('') + '</div>' +
        '<button class="live-go" id="liveGo">' + T('live.go','Start onderweg') + '</button>' +
        '<button class="live-go" id="liveDeel" style="margin-top:0.45rem;background:none;border:1px solid var(--line);color:var(--txt);">📍 ' + T('live.deel','Deel mijn live locatie met deze zaak') + '</button>' +
        '<div style="margin-top:0.4rem;font-size:0.62rem;color:var(--soft);line-height:1.5;">' + T('live.deel.s','Alleen deze zaak ziet dan waar u bent, tot de zaak het niet meer nodig heeft of u het zelf stopt.') + '</div>' +
      '</div>';
    $('#livePanel').querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => {
      liveMode = b.dataset.mode;
      $('#livePanel').querySelectorAll('[data-mode]').forEach(x => x.classList.toggle('on', x.dataset.mode === liveMode));
    }));
    $('#liveGo').addEventListener('click', startLive);
    const ld = $('#liveDeel');
    if (ld) ld.addEventListener('click', async () => {
      try {
        const r = await API.call('/locatie/deel', { supplierCode: $('#liveDest').value });
        toast('📍 ' + r.deel.supplierName + ' ' + T('live.deelok','kijkt nu met u mee, tot het niet meer nodig is.'));
        renderZorg();
      } catch(e){ toast(e.message); }
    });
  }

  /* ---------- Toren 3: RTG Shared Assets ----------
     Altijd 300 tickets per object; een ticket is 24 uur per jaar, tien jaar
     lang. Access loopt af, Asset heeft restwaarde en stapt uit via een Tik. */
  async function renderAssets(){
    const el = $('#assetsWrap'); if (!el) return;
    if (!API.live){ el.innerHTML = ''; return; }
    let d, mijn;
    try {
      d = await API.call('/assets');
      mijn = (await API.call('/asset/mijn')).posities || [];
    } catch(e){ el.innerHTML = ''; return; }
    const posVan = id => mijn.find(p => p.assetId === id);
    el.innerHTML = d.assets.map(a => {
      const p = posVan(a.id);
      const vol = a.beschikbaar === 0;
      return '<div class="live-start" style="margin-top:0.8rem;">' +
        '<div class="lh">' + a.icon + ' ' + esc(a.naam) + '</div>' +
        '<div class="ld">' + esc(a.beschrijving) + '<br>' + esc(a.waar) + ' · ' + T('as.waarde','objectwaarde') + ' ' + eur(a.waarde) + '</div>' +
        '<div style="display:flex;gap:0.4rem;flex-wrap:wrap;margin-top:0.55rem;font-size:0.72rem;color:var(--soft);">' +
          '<span style="border:1px solid var(--line);border-radius:999px;padding:0.2rem 0.6rem;">' + a.totaal + ' ' + T('as.tickets','tickets') + ' · ' + (vol ? T('as.vol','uitverkocht') : a.beschikbaar + ' ' + T('as.vrij','beschikbaar')) + '</span>' +
          '<span style="border:1px solid var(--line);border-radius:999px;padding:0.2rem 0.6rem;">1 ' + T('as.ticket','ticket') + ' = 24 ' + T('as.uur','uur per jaar') + ' · ' + d.regels.jaren + ' ' + T('as.jaar','jaar') + '</span>' +
          '<span style="border:1px solid var(--line);border-radius:999px;padding:0.2rem 0.6rem;">' + T('as.tw','ticketwaarde nu') + ' ' + eur(a.ticketWaarde) + '</span>' +
        '</div>' +
        (p ? '<div style="margin-top:0.7rem;border:1px solid var(--gold-soft,rgba(201,154,46,0.4));border-radius:12px;padding:0.6rem 0.75rem;font-size:0.78rem;">' +
            '<b>' + T('as.mijn','Mijn positie') + ':</b> ' + p.tickets + ' ' + T('as.tickets','tickets') + ' (' + p.access + ' Access · ' + p.asset + ' Asset)' + (p.tickets ? ' · ' +
            '<b style="color:var(--gold-bright,#C99A2E);">' + p.dagenTegoed + '</b> ' + T('as.dagen','x 24 uur over dit jaar') + ' · ' + T('as.geldig','geldig tot') + ' ' + p.vervaltOp : '') +
            (p.asset ? '<br>' + T('as.uitstapw','Uitstapwaarde vandaag') + ': <b>' + eur(p.uitstapWaarde) + '</b>' : '') +
            ((p.terugkoopOnderweg||[]).length ? '<br>⏳ ' + T('as.tkw','Terugkoop onderweg') + ': ' + p.terugkoopOnderweg.map(v => eur(v.waarde) + ' ' + T('as.uiterlijk','uiterlijk') + ' ' + v.uiterlijk).join(', ') : '') +
            (p.gepland.length ? '<br>📅 ' + T('as.gepland','Gepland') + ': ' + p.gepland.join(', ') : '') +
            '<div style="display:flex;gap:0.45rem;flex-wrap:wrap;margin-top:0.5rem;">' +
              (p.tickets ? '<input type="date" data-asdatum="' + a.id + '" min="' + new Date().toISOString().slice(0,10) + '" style="flex:1;min-width:130px;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:0.45rem 0.6rem;font-size:0.78rem;color:var(--txt);" aria-label="' + T('as.dag','Kies uw dag') + '">' +
              '<button class="mo-code js-asboek" data-id="' + a.id + '">' + T('as.boek','Boek mijn 24 uur') + '</button>' : '') +
              (p.asset ? '<button class="mo-code js-asuit" data-id="' + a.id + '" data-tid="' + p.assetTicketIds[0] + '" data-w="' + p.ticketWaarde + '">' + T('as.uitstap','Stap uit (1 ticket)') + '</button>' : '') +
              ((p.herroepbaar||[]).length ? '<button class="mo-code js-asherroep" data-tid="' + p.herroepbaar[0].id + '" data-p="' + p.herroepbaar[0].prijs + '">↩ ' + T('as.herroep','Herroep (14 dgn)') + '</button>' : '') +
            '</div></div>' : '') +
        (vol
          ? '<div style="margin-top:0.7rem;font-size:0.74rem;color:var(--soft);">' + T('as.volh','De pool is vol.') + ' ' + (a.wachtenden ? a.wachtenden + ' ' + T('as.wachten','op de wachtlijst.') : '') + '</div>' +
            (a.opWachtlijst
              ? '<div style="margin-top:0.4rem;font-size:0.74rem;color:var(--gold-bright,#C99A2E);">✓ ' + T('as.opwl','U staat op de wachtlijst; bij de eerstvolgende uitstapper bent u aan de beurt.') + '</div>'
              : '<button class="live-go js-aswacht" data-id="' + a.id + '" style="margin-top:0.5rem;">' + T('as.wachtknop','Zet mij op de wachtlijst') + '</button>')
          : '<div style="margin-top:0.7rem;font-size:0.72rem;color:var(--soft);line-height:1.6;">' +
            '<b style="color:var(--txt);">Access</b> · ' + eur(a.prijsAccess) + ' · ' + T('as.access.s','dienstenvoucher: alleen het gebruik (25% van de ticketwaarde). Teller reset elk jaar, na tien jaar is het klaar.') + '<br>' +
            '<b style="color:var(--txt);">Asset</b> · ' + eur(a.prijsAsset) + ' · ' + T('as.asset.s','deelnemingsbewijs in') + ' ' + esc(a.entiteit) + ': ' + T('as.asset.s2','zelfde gebruik, plus uw aandeel in de restwaarde. Uitstappen via de wachtlijst, anders koopt RTG terug binnen 30 dagen.') + '<br>' +
            '<span style="font-size:0.66rem;">' + T('as.taxatie','Servicefee') + ' ' + eur(a.serviceFee) + '/' + T('as.perjaar','jaar per ticket') + ' · ' + T('as.bedenk','14 dagen bedenktijd met volledige terugbetaling') + ' · ' + T('as.beweegt','prijzen en uitstapwaarde bewegen mee met de taxatie.') + '</span></div>' +
          '<div style="display:flex;gap:0.45rem;flex-wrap:wrap;margin-top:0.5rem;">' +
            '<input type="number" min="1" max="10" value="1" data-asaantal="' + a.id + '" style="width:64px;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:0.45rem 0.6rem;font-size:0.8rem;color:var(--txt);" aria-label="aantal">' +
            '<button class="live-go js-askoop" data-id="' + a.id + '" data-smaak="access" style="flex:1;margin-top:0;">Access</button>' +
            '<button class="live-go js-askoop" data-id="' + a.id + '" data-smaak="asset" data-ent="' + esc(a.entiteit) + '" data-fee="' + a.serviceFee + '" style="flex:1;margin-top:0;background:var(--gold-bright,#C99A2E);">Asset</button>' +
          '</div>')+
        '<button class="mo-code js-asdoc" data-id="' + a.id + '" style="margin-top:0.5rem;">📄 ' + T('as.doc','Essentiele informatie') + '</button>' +
        '<div data-asdocuit="' + a.id + '" style="display:none;margin-top:0.5rem;font-size:0.7rem;color:var(--soft);line-height:1.6;border:1px solid var(--line);border-radius:12px;padding:0.6rem 0.75rem;"></div>' +
      '</div>';
    }).join('');
    el.querySelectorAll('.js-askoop').forEach(b => b.addEventListener('click', async () => {
      const aantal = parseInt((el.querySelector('[data-asaantal="' + b.dataset.id + '"]') || {}).value, 10) || 1;
      const body = { assetId: b.dataset.id, smaak: b.dataset.smaak, aantal };
      if (b.dataset.smaak === 'asset'){
        // deelnemingsbewijs: uitdrukkelijk akkoord na de kerninformatie
        if (!window.confirm(T('as.akk1','U koopt een deelnemingsbewijs in') + ' ' + b.dataset.ent + '.\n\n' +
          T('as.akk2','De restwaarde beweegt mee met de taxatie en kan dalen. Jaarlijkse servicefee:') + ' ' + eur(Number(b.dataset.fee)) + ' ' + T('as.akk3','per ticket. Uitstappen loopt eerst via de wachtlijst; anders koopt RTG terug binnen 30 dagen. U heeft 14 dagen bedenktijd met volledige terugbetaling.') + '\n\n' +
          T('as.akk4','Gaat u akkoord?'))) return;
        body.akkoord = true;
      }
      try {
        const r = await API.call('/asset/koop', body);
        toast('🎟️ ' + r.tickets.length + ' ticket(s) · ' + eur(r.totaalPrijs) + '. ' + T('as.welkom','Welkom in de pool.'));
        renderAssets();
      } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('.js-aswacht').forEach(b => b.addEventListener('click', async () => {
      try { const r = await API.call('/asset/wachtlijst', { assetId: b.dataset.id }); toast('📋 ' + T('as.wlok','U staat op de wachtlijst, positie') + ' ' + r.positie + '.'); renderAssets(); }
      catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('.js-asherroep').forEach(b => b.addEventListener('click', async () => {
      if (!window.confirm(T('as.herroepvraag','Herroepen binnen de bedenktijd? U krijgt de volledige koopsom') + ' (' + eur(Number(b.dataset.p)) + ') ' + T('as.herroepvraag2','terug via een Tik.'))) return;
      try { const r = await API.call('/asset/herroep', { ticketId: b.dataset.tid }); toast('↩ ' + T('as.herroepok','Herroepen. De Tik van') + ' ' + eur(r.terug) + ' ' + T('as.uitok2','staat in uw tegoed.')); renderAssets(); }
      catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('.js-asdoc').forEach(b => b.addEventListener('click', async () => {
      const uit = el.querySelector('[data-asdocuit="' + b.dataset.id + '"]');
      if (!uit) return;
      if (uit.style.display !== 'none'){ uit.style.display = 'none'; return; }
      try {
        const d = (await API.call('/asset/document', { assetId: b.dataset.id })).document;
        uit.innerHTML = '<b style="color:var(--txt);">' + esc(d.object) + '</b> · ' + esc(d.entiteit) + '<br>' +
          esc(d.gebruik) + '<br><b>Access:</b> ' + esc(d.smaken.access.aard) + '<br><b>Asset:</b> ' + esc(d.smaken.asset.aard) + '<br>' +
          esc(d.kosten.serviceFee) + '<br>' + esc(d.kosten.overdracht) + '<br><b>' + T('as.doc.uit','Uitstappen') + ':</b> ' + esc(d.uitstappen) + '<br><b>' + T('as.doc.bed','Bedenktijd') + ':</b> ' + esc(d.bedenktijd) + '<br><b>' + T('as.doc.risico','Risico') + ':</b> ' + esc(d.risico);
        uit.style.display = '';
      } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('.js-asboek').forEach(b => b.addEventListener('click', async () => {
      const datum = (el.querySelector('[data-asdatum="' + b.dataset.id + '"]') || {}).value;
      if (!datum){ toast(T('as.kiesdag','Kies eerst een dag.')); return; }
      try { const r = await API.call('/asset/gebruik', { assetId: b.dataset.id, datum }); toast('📅 ' + datum + ' ' + T('as.vast','staat vast.') + ' ' + r.dagenTegoed + ' ' + T('as.dagenover','x 24 uur over dit jaar.')); renderAssets(); }
      catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('.js-asuit').forEach(b => b.addEventListener('click', async () => {
      if (!window.confirm(T('as.uitvraag','Uitstappen? RTG betaalt de actuele ticketwaarde') + ' (' + eur(Number(b.dataset.w)) + ') ' + T('as.uitvraag2','uit via een Tik en het ticket gaat terug in de pool.'))) return;
      try { const r = await API.call('/asset/uitstap', { ticketId: b.dataset.tid }); toast('💰 ' + T('as.uitok','Uitgestapt. De Tik van') + ' ' + eur(r.waarde) + ' ' + T('as.uitok2','staat in uw tegoed.')); renderAssets(); }
      catch(e){ toast(e.message); }
    }));
  }

  /* ---------- het brein van De Butler: geheugen en seintjes ----------
     Het gesprek zelf loopt via de gewone Butler-chat op de AI-tab; deze
     kaart toont rustig wat hij weet (wisbaar) en wat hij zelf ziet. */
  let fluisterSyncAt = 0;
  async function renderFluister(){
    const el = $('#fluisterWrap'); if (!el) return;
    if (!API.live){ el.innerHTML = ''; return; }
    // de inklap-laag deelt (alleen) de gebruikstellers, zodat de Butler leert
    if (window.FocusUI && Date.now() - fluisterSyncAt > 60000){
      fluisterSyncAt = Date.now();
      API.call('/fluister/focus', { scores: FocusUI.scores() }).catch(() => {});
    }
    let prof;
    try { prof = await API.call('/fluister/profiel'); } catch(e){ el.innerHTML = ''; return; }
    el.innerHTML =
      '<div class="live-start" style="margin-bottom:0.8rem;">' +
        '<div class="lh">🤵 ' + T('fl.h','Wat Rahul weet en ziet') + '</div>' +
        '<div class="ld">' + T('fl.d','Hij onthoudt wat u vertelt ("onthoud dat..."), leert van wat u gebruikt en regelt alles in de chat hieronder: zoeken, reserveren, bestellen en afrekenen, uw 24 uur, een Tik of betaalverzoek. Vraag "wat kun je" voor het hele overzicht; geld gaat nooit zonder uw "ja" de deur uit.') + '</div>' +
        ((prof.seintjes || []).length
          ? '<div style="margin-top:0.55rem;border:1px solid var(--line);border-radius:12px;padding:0.55rem 0.7rem;">' +
              '<div style="font-size:0.6rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--soft);">' + T('fl.sein','Rahul ziet') + '</div>' +
              prof.seintjes.map(x => '<div style="margin-top:0.3rem;font-size:0.76rem;line-height:1.45;">' + esc(x.icoon) + ' ' + esc(x.tekst) + '</div>').join('') + '</div>'
          : '') +
        (prof.weetjes.length
          ? '<div style="display:flex;gap:0.35rem;flex-wrap:wrap;margin-top:0.5rem;">' + prof.weetjes.map((w, i) =>
              '<span style="display:inline-flex;align-items:center;gap:0.35rem;border:1px solid var(--line);border-radius:999px;padding:0.25rem 0.6rem;font-size:0.68rem;color:var(--txt);">' + esc(w.tekst) +
              '<button class="js-flweg" data-i="' + i + '" aria-label="' + T('fl.weg','vergeet dit') + '" style="background:none;border:none;color:var(--soft);cursor:pointer;font-size:0.75rem;padding:0;">✕</button></span>').join('') + '</div>'
          : '<div style="margin-top:0.5rem;font-size:0.68rem;color:var(--soft);">' + T('fl.leeg','Nog geen weetjes. Zeg bijvoorbeeld: "onthoud dat ik cava drink, nooit rode wijn".') + '</div>') +
        (prof.top.length ? '<div style="margin-top:0.4rem;font-size:0.64rem;color:var(--soft);">' + T('fl.top','Ik zie dat u het meest werkt met') + ': ' + prof.top.map(esc).join(', ') + '.</div>' : '') +
      '</div>';
    el.querySelectorAll('.js-flweg').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/fluister/vergeet', { wat: Number(b.dataset.i) }); renderFluister(); } catch(e){ toast(e.message); }
    }));
  }

  /* ---------- de zorgvolle keten: zorgprofiel + wie kijkt mee ---------- */
  async function renderZorg(){
    const el = $('#zorgPanel'); if (!el) return;
    if (!API.live){ el.innerHTML = ''; return; }
    let zorg, delen;
    try {
      zorg = (await API.call('/zorgprofiel')).zorg;
      delen = await API.call('/locatie/mijn');
    } catch(e){ el.innerHTML = ''; return; }
    el.innerHTML =
      '<div class="live-start" style="margin-top:0.8rem;">' +
        '<div class="lh">🩺 ' + T('zorg.h','Mijn zorgprofiel') + '</div>' +
        '<div class="ld">' + T('zorg.d','Allergenen en aandachtspunten reizen automatisch mee met uw bestellingen en verblijven, alleen als u delen aanzet. De keuken en de receptie weten het dan meteen.') + '</div>' +
        '<input id="zAll" placeholder="' + T('zorg.all','Allergenen, gescheiden door komma (bijv. noten, schaaldieren)') + '" value="' + esc((zorg.allergenen || []).join(', ')) + '" style="width:100%;margin-top:0.5rem;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:0.6rem 0.7rem;font-size:0.8rem;color:var(--txt);">' +
        '<input id="zDieet" placeholder="' + T('zorg.dieet','Dieet (bijv. vegetarisch, halal)') + '" value="' + esc(zorg.dieet || '') + '" style="width:100%;margin-top:0.4rem;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:0.6rem 0.7rem;font-size:0.8rem;color:var(--txt);">' +
        '<input id="zMed" placeholder="' + T('zorg.med','Medische aandachtspunten (bijv. diabetes, rolstoel)') + '" value="' + esc(zorg.medisch || '') + '" style="width:100%;margin-top:0.4rem;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:0.6rem 0.7rem;font-size:0.8rem;color:var(--txt);">' +
        '<label style="display:flex;align-items:center;gap:0.5rem;margin-top:0.55rem;font-size:0.74rem;color:var(--txt);"><input type="checkbox" id="zDelen"' + (zorg.delen ? ' checked' : '') + '> ' + T('zorg.delen','Deel dit automatisch met zaken waar ik bestel of verblijf') + '</label>' +
        '<button class="live-go" id="zOpslaan" style="margin-top:0.55rem;">' + T('zorg.opslaan','Bewaar zorgprofiel') + '</button>' +
        ((delen.actief || []).length
          ? '<div style="margin-top:0.8rem;font-size:0.62rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--soft);">📍 ' + T('zorg.kijkt','Kijkt live met mij mee') + '</div>' +
            delen.actief.map(d => '<div style="display:flex;justify-content:space-between;align-items:center;gap:0.5rem;margin-top:0.4rem;font-size:0.78rem;"><span><b>' + esc(d.supplierName) + '</b> · ' + T('zorg.sinds','sinds') + ' ' + String(d.at).slice(11, 16) + '</span><button class="mo-code js-zstop" data-id="' + d.id + '">' + T('zorg.stop','Stop delen') + '</button></div>').join('')
          : '<div style="margin-top:0.8rem;font-size:0.68rem;color:var(--soft);">📍 ' + T('zorg.niemand','Er kijkt nu niemand live met u mee.') + '</div>') +
      '</div>';
    $('#zOpslaan').addEventListener('click', async () => {
      try {
        await API.call('/zorgprofiel/zet', { allergenen: $('#zAll').value, dieet: $('#zDieet').value, medisch: $('#zMed').value, delen: $('#zDelen').checked });
        toast('🩺 ' + T('zorg.bewaard','Zorgprofiel bewaard.'));
      } catch(e){ toast(e.message); }
    });
    el.querySelectorAll('.js-zstop').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/locatie/stop', { id: b.dataset.id }); toast('📍 ' + T('zorg.gestopt','Delen gestopt.')); renderZorg(); }
      catch(e){ toast(e.message); }
    }));
  }

  async function startLive(){
    const destCode = $('#liveDest').value;
    try { liveData = (await API.call('/live/start', { destCode, mode: liveMode })).live; toast(T('live.started','U bent onderweg. Uw partners zijn op de hoogte.')); renderLivePanel(); }
    catch (e){ toast(e.message); }
  }

  // projecteer lat/lng-punten in het 130px-kaartje (percentage-coördinaten)
  function projectPoints(pts){
    if (!pts.length) return [];
    const lats = pts.map(p => p.lat), lngs = pts.map(p => p.lng);
    let minLat = Math.min(...lats), maxLat = Math.max(...lats), minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
    let dLat = (maxLat - minLat) || 0.002, dLng = (maxLng - minLng) || 0.002;
    minLat -= dLat*0.2; maxLat += dLat*0.2; minLng -= dLng*0.2; maxLng += dLng*0.2;
    dLat = maxLat - minLat; dLng = maxLng - minLng;
    return pts.map(p => ({ x: ((p.lng - minLng)/dLng)*100, y: (1 - (p.lat - minLat)/dLat)*100 }));
  }

  function renderLivePanel(){
    const L = liveData; if (!L) return;
    const dest = L.dest;
    let head, sub = '';
    if (L.arrived && dest){ head = T('live.arrivedh','U bent <em>gearriveerd</em>'); sub = dest.name; }
    else if (dest){ head = T('live.headingto','Onderweg naar') + ' <em>' + dest.name + '</em>'; sub = dest.etaMin != null ? T('live.aankomst','aankomst over ~') + dest.etaMin + ' ' + T('live.min','min') : ''; }
    else { head = T('live.moving','U bent <em>onderweg</em>'); }

    const pts = [];
    if (L.me) pts.push({ lat: L.me.lat, lng: L.me.lng, me: true });
    L.partners.forEach(p => { if (p.loc) pts.push({ lat: p.loc.lat, lng: p.loc.lng, icon: p.icon, name: p.name }); });
    const proj = projectPoints(pts);
    const markers = proj.map((pt,i) => {
      const s = pts[i];
      return '<div class="mk' + (s.me?' me':'') + '" style="left:' + pt.x.toFixed(1) + '%;top:' + pt.y.toFixed(1) + '%;">' +
        (s.me ? '<div class="pin"></div>' : '<div>' + s.icon + '</div>') +
        '<div class="lbl">' + (s.me ? T('live.you','U') : s.name) + '</div></div>';
    }).join('');

    const partners = L.partners.map(p => {
      const isVeh = p.type === 'taxi' || p.type === 'jet';
      let eta;
      if (p.ride && isVeh){
        eta = p.taxiEtaMin != null && p.ride.status !== 'gearriveerd'
          ? '<div class="eta"><div class="n">' + p.taxiEtaMin + '</div><div class="u">' + T('live.mintoyou','min naar u') + '</div></div>'
          : '<div class="eta"><div class="n" style="font-size:0.9rem;">' + tRide(p.ride.status) + '</div></div>';
      } else if (p.isDest && L.arrived){
        eta = '<div class="eta arr"><div class="n">✓ ' + T('live.here','ter plaatse') + '</div></div>';
      } else {
        eta = p.etaMin != null ? '<div class="eta"><div class="n">' + p.etaMin + '</div><div class="u">' + T('live.minaway','min heen') + '</div></div>' : '';
      }
      let line2 = tType(p.typeLabel);
      if (p.ride){
        line2 += ' · ' + T('live.ride','rit') + ' ' + tRide(p.ride.status);
        const extra = [];
        if (p.ride.driver) extra.push('🚘 ' + p.ride.driver + (p.ride.vehicle ? ' · ' + p.ride.vehicle : ''));
        if (p.ride.quote) extra.push(T('live.vast','vaste nettoprijs') + ' ' + eur(p.ride.quote));
        if (extra.length) line2 += '<br>' + extra.join(' · ');
        // betaling achteraf: de zaak liet de rit direct rijden; afrekenen kan nu
        if (!p.ride.paid && p.ride.quote && p.ride.status !== 'wacht-op-betaling')
          line2 += '<br><button class="js-rpay" data-rref="' + p.ride.ref + '" data-rq="' + p.ride.quote + '" style="margin-top:0.35rem;background:none;border:1px solid var(--gold);color:var(--gold);border-radius:999px;padding:0.3rem 0.8rem;font-size:0.7rem;font-weight:600;font-family:inherit;cursor:pointer;">' + T('live.betaalrit','Betaal de rit') + ' · ' + eur(p.ride.quote) + '</button>';
      }
      else if (p.order) line2 += ' · ' + p.order.items + ' ' + T('app.items','item(s)') + ', ' + tStatus(p.order.status);
      return '<div class="live-partner"><span class="pic">' + p.icon + '</span><div class="pt"><b>' + p.name + '</b><span>' + line2 + '</span></div>' + eta + '</div>';
    }).join('');

    let preorder = '';
    const destSup = dest ? suppliers.find(s => s.code === dest.code) : null;
    if (dest && destSup && destSup.hasMenu && !dest.order && !L.arrived){
      preorder = '<div class="live-preorder"><span>' + T('live.preorder','Bestel vast vooruit, dan staat het klaar als u aankomt.') + '</span><button id="livePre">' + T('live.preorderbtn','Vooruit bestellen') + '</button></div>';
    }

    const hasVeh = L.partners.some(p => p.type === 'taxi' || p.type === 'jet');
    const canDoor = L.arrived && dest && dest.hasDoors;
    const acts = '<div class="live-acts">' +
      (canDoor ? '<button class="prim glowbtn" id="liveDoor">🔓 ' + T('live.door','Open de deur') + '</button>' : '') +
      '<button class="sec" id="liveSim">' + T('live.simulate','Simuleer rit') + '</button>' +
      (hasVeh ? '' : '<button class="sec" id="liveTaxi">' + T('live.taxi','Vraag een taxi') + '</button>') +
      (canDoor ? '' : '<button class="prim" id="liveShare">' + T('live.share','Deel mijn locatie') + '</button>') +
      (canDoor ? '<button class="sec" id="liveShare">' + T('live.share','Deel mijn locatie') + '</button>' : '') +
    '</div>';

    $('#livePanel').innerHTML =
      '<div class="live-panel">' +
        '<div class="live-top"><span class="live-badge"><span class="dot"></span>' + T('live.badge','Live onderweg') + '</span><button class="live-stop" id="liveStop">' + T('live.stop','Stop') + '</button></div>' +
        '<div class="live-headline">' + head + '</div>' + (sub ? '<div class="live-sub">' + sub + '</div>' : '') +
        '<div class="live-map">' + markers + '</div>' +
        preorder +
        '<div style="margin-top:0.5rem;">' + partners + '</div>' +
        acts +
      '</div>';

    $('#liveStop').addEventListener('click', stopLive);
    $('#liveSim').addEventListener('click', simulateRide);
    document.querySelectorAll('.js-rpay').forEach(b => b.addEventListener('click', () => {
      const bedrag = eur(Number(b.dataset.rq));
      payWithFaceId(bedrag, async () => {
        await API.call('/ride/pay', { ref: b.dataset.rref });
      }, { message: () => T('live.ritbetaald','Rit betaald en definitief:') + ' ' + bedrag, after: () => renderLive() });
    }));
    $('#liveShare').addEventListener('click', shareMyLocation);
    const tx = $('#liveTaxi'); if (tx) tx.addEventListener('click', requestTaxi);
    const pre = $('#livePre'); if (pre) pre.addEventListener('click', () => { if (dest) openMenu(dest.code); });
    const dr = $('#liveDoor'); if (dr) dr.addEventListener('click', async () => {
      try { const d = await API.call('/live/door'); toast('🔓 ' + d.door.name + ' ' + T('live.dooropen','is open. Vergrendelt zichzelf na') + ' ' + d.door.relockSec + ' ' + T('live.sec','seconden.')); }
      catch(e){ toast(e.message); }
    });
  }

  async function stopLive(){
    stopSim();
    try { await API.call('/live/stop'); } catch (e) {}
    liveData = null; toast(T('live.stopped','Reis gestopt.')); renderLive();
  }

  function requestTaxi(){
    const veh = suppliers.find(s => s.type === 'taxi') || suppliers.find(s => s.type === 'jet');
    if (!veh){ toast(T('live.notaxi','Geen vervoerspartner beschikbaar op deze bestemming.')); return; }
    // paspoortleeftijd: privejets boek je vanaf 18 jaar
    if (veh.type === 'jet' && user.leeftijdsgroep === '15-17'){ toast(T('live.jet18','Privejets boek je vanaf 18 jaar. Een taxi regelen we graag voor je.')); return; }
    // nette aanvraag: personen, bagage en tijdstip; de prijs komt direct terug
    $('#rideSup').textContent = veh.name;
    $('#ride-sheet').dataset.code = veh.code;
    $('#ride-sheet').classList.add('open'); $('#ride-scrim').classList.add('open');
  }
  async function verstuurRit(){
    const code = $('#ride-sheet').dataset.code;
    const wanneer = $('#ridePlan').value === 'later' ? ($('#rideTijd').value ? T('live.om','om') + ' ' + $('#rideTijd').value : 'Zo snel mogelijk') : 'Zo snel mogelijk';
    try {
      const d = await API.call('/ride/request', {
        supplierCode: code,
        toCode: (liveData && liveData.destCode) || undefined,
        passengers: Number($('#ridePax').value) || 1,
        luggage: Number($('#rideBag').value) || 0,
        when: wanneer,
        date: $('#ridePlan').value === 'later' ? $('#rideDatum').value : '',
        time: $('#ridePlan').value === 'later' ? $('#rideTijd').value : '',
        note: $('#rideNote').value.trim()
      });
      $('#ride-sheet').classList.remove('open'); $('#ride-scrim').classList.remove('open');
      if (d.ride && d.ride.status === 'wacht-op-betaling'){
        // betalen-eerst: pas na afrekenen gaat de aanvraag naar de vervoerder
        payWithFaceId(eur(d.ride.quote), async () => {
          await API.call('/ride/pay', { ref: d.ride.ref });
          return d.ride;
        }, { message: () => T('live.ritbetaald','Rit betaald en definitief:') + ' ' + eur(d.ride.quote), after: () => renderLive() });
      } else {
        toast('🚘 ' + T('live.taxireq2','Rit aangevraagd.') + (d.ride && d.ride.quote ? ' ' + T('live.vast','vaste nettoprijs') + ': ' + eur(d.ride.quote) : ''));
        await renderLive();
      }
    } catch (e){ toast(e.message); }
  }

  function shareMyLocation(){
    if (navigator.geolocation){
      navigator.geolocation.getCurrentPosition(async pos => {
        try { liveData = (await API.call('/live/update', { lat: pos.coords.latitude, lng: pos.coords.longitude })).live; renderLivePanel(); toast(T('live.shared','Locatie gedeeld met uw partners.')); }
        catch (e){ toast(e.message); }
      }, () => toast(T('live.geodenied','Locatie niet beschikbaar. Gebruik "Simuleer rit" voor de demo.')), { timeout: 4000 });
    } else toast(T('live.geono','Locatie is hier niet beschikbaar.'));
  }

  function stopSim(){ if (simTimer){ clearInterval(simTimer); simTimer = null; } }
  function simulateRide(){
    const L = liveData;
    if (!L || !L.me || !L.dest || !L.dest.loc){ toast(T('live.nosim','Kies eerst een bestemming.')); return; }
    stopSim();
    const start = { lat: L.me.lat, lng: L.me.lng };
    const end = { lat: L.dest.loc.lat, lng: L.dest.loc.lng };
    let step = 0; const N = 16;
    toast(T('live.simstart','Simulatie gestart, u nadert de bestemming.'));
    simTimer = setInterval(async () => {
      step++;
      const t = step / N;
      const lat = start.lat + (end.lat - start.lat) * t + (Math.random() - 0.5) * 0.0004;
      const lng = start.lng + (end.lng - start.lng) * t + (Math.random() - 0.5) * 0.0004;
      try { liveData = (await API.call('/live/update', { lat, lng })).live; renderLivePanel(); } catch (e) {}
      if (step >= N) stopSim();
    }, 900);
  }

  const FID_MINI = '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 19 V13 a7 7 0 0 1 7-7 h6"/><path d="M45 6 h6 a7 7 0 0 1 7 7 v6"/><path d="M58 45 v6 a7 7 0 0 1-7 7 h-6"/><path d="M19 58 h-6 a7 7 0 0 1-7-7 v-6"/><circle cx="23.5" cy="26.5" r="3" fill="currentColor"/><circle cx="40.5" cy="26.5" r="3" fill="currentColor"/><path d="M32 26 v8.5 a2.2 2.2 0 0 1-2.2 2.2"/><path d="M23 42.5 a12.5 8.5 0 0 0 18 0"/></svg>';

  async function openMenu(code){
    let data;
    try { data = await API.call('/supplier/menu/get', { code }); }
    catch (e) { toast(e.message); return; }
    menuState = { supplier: data.supplier, menu: data.menu, alcohol: data.alcohol || null, qty: {}, note: '', tag: false, table: '', retail: null, retailMijn: null };
    $('#msName').textContent = data.supplier.name;
    $('#msMeta').textContent = tType(data.supplier.typeLabel) + ' · ' + data.supplier.city + (data.supplier.loc ? ' · ' + data.supplier.loc.label : '');
    // mode-/retailpartner: haal de catalogus en de eigen apart/styling erbij
    if ((data.supplier.caps || []).includes('retail')){
      try { menuState.retail = await API.call('/retail/catalogus', { supplierCode: code }); } catch(e){}
      try { menuState.retailMijn = await API.call('/retail/mijn', {}); } catch(e){}
      try { menuState.modeBezorg = (await API.call('/mode/bezorg/mijn', {})).bezorgingen || []; } catch(e){ menuState.modeBezorg = []; }
    }
    renderMenuSheet();
    $('#menu-sheet').classList.add('open');
    $('#menu-scrim').classList.add('open');
  }

  function renderMenuSheet(){
    const m = menuState.menu;
    const s = menuState.supplier;
    // fotostrip + kamers van de partner (hotels, of elke partner met foto's)
    let head = '';
    // rating + favoriet-hart + tafel reserveren (de ervaring-laag)
    head += '<div style="display:flex;align-items:center;gap:0.6rem;padding:0.2rem 0 0.6rem;">' +
      (s.rating ? '<span style="font-size:0.8rem;">⭐ <b>' + s.rating.score + '</b> <span style="color:var(--soft);font-size:0.7rem;">(' + s.rating.aantal + ')</span></span>' : '<span style="font-size:0.72rem;color:var(--soft);">' + T('erv.nogGeenReviews','Nog geen reviews') + '</span>') +
      '<button id="msFav" style="margin-left:auto;background:none;border:1px solid var(--line);border-radius:999px;padding:0.35rem 0.8rem;font-size:0.85rem;" aria-label="' + T('fav.aria','Favoriet') + '">' + (s.favoriet ? '❤️ ' + T('fav.bewaard','Bewaard') : '🤍 ' + T('fav.bewaar','Bewaar')) + '</button></div>';
    if ((s.tableNames || []).length && s.reservationsOpen !== false){
      const morgen = new Date(Date.now() + 86400000).toISOString().slice(0,10);
      head += '<div class="ms-cat">🪑 ' + T('erv.reserveer.h','Tafel reserveren') + '</div>' +
        '<div style="display:flex;gap:0.4rem;align-items:center;padding:0.2rem 0 0.9rem;flex-wrap:wrap;">' +
        '<input type="date" id="rsvDatum" value="' + morgen + '" min="' + new Date().toISOString().slice(0,10) + '" style="flex:2;min-width:120px;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:0.6rem 0.7rem;font-size:0.8rem;color:var(--txt);" aria-label="' + T('erv.datum','Datum') + '">' +
        '<input type="time" id="rsvTijd" value="20:00" style="flex:1;min-width:84px;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:0.6rem 0.7rem;font-size:0.8rem;color:var(--txt);" aria-label="' + T('erv.tijd','Tijd') + '">' +
        '<select id="rsvPers" style="flex:1;min-width:70px;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:0.6rem 0.5rem;font-size:0.8rem;color:var(--txt);" aria-label="' + T('erv.personen','Personen') + '">' +
        [1,2,3,4,5,6,8,10].map(n => '<option' + (n===2?' selected':'') + '>' + n + '</option>').join('') + '</select>' +
        '<button class="vbtn" id="rsvGo">' + T('erv.reserveer','Reserveer') + '</button></div>';
    }
    if (s.photos && s.photos.length)
      head += '<div class="ms-photos">' + s.photos.map(p => '<img src="' + p + '" alt="">').join('') + '</div>';
    if (s.rooms && s.rooms.length){
      const inDatum = new Date(Date.now() + 86400000).toISOString().slice(0,10);
      const uitDatum = new Date(Date.now() + 3 * 86400000).toISOString().slice(0,10);
      head += '<div class="ms-cat">' + T('app.ms.rooms','Beschikbare kamers') + '</div>' +
        '<div style="display:flex;gap:0.4rem;align-items:center;padding:0.2rem 0 0.6rem;flex-wrap:wrap;">' +
        '<input type="date" id="vbAankomst" value="' + inDatum + '" min="' + new Date().toISOString().slice(0,10) + '" style="flex:1;min-width:120px;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:0.6rem 0.7rem;font-size:0.8rem;color:var(--txt);" aria-label="' + T('vb.aankomst','Aankomst') + '">' +
        '<input type="date" id="vbVertrek" value="' + uitDatum + '" min="' + inDatum + '" style="flex:1;min-width:120px;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:0.6rem 0.7rem;font-size:0.8rem;color:var(--txt);" aria-label="' + T('vb.vertrek','Vertrek') + '">' +
        '<select id="vbPers" style="flex:0 1 70px;min-width:64px;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:0.6rem 0.5rem;font-size:0.8rem;color:var(--txt);" aria-label="' + T('erv.personen','Personen') + '">' +
        [1,2,3,4,6].map(n => '<option' + (n===2?' selected':'') + '>' + n + '</option>').join('') + '</select></div>' +
        s.rooms.map(r => '<div class="ms-room"><div class="rt"><b>' + r.name + '</b>' + (r.desc ? '<span>' + r.desc + '</span>' : '') + '</div>' +
          '<div class="rp" style="display:flex;align-items:center;gap:0.5rem;">' + eur(r.price) + ' <span style="font-size:0.62rem;color:var(--soft);">' + T('app.ms.pernight','p.n.') + '</span>' +
          '<button class="vbtn" data-vbboek="' + r.id + '">' + T('vb.boek','Boek') + '</button></div></div>').join('') +
        '<div style="margin:0.5rem 0 0.6rem;font-size:0.74rem;color:var(--soft);">' + T('app.ms.roomnote2','Tegen nettoprijs; het huis bevestigt uw verblijf en de rekening loopt op de kamer.') + '</div>' +
        // keyless: tijdens een ingecheckt verblijf is de telefoon de sleutel
        '<div style="display:flex;gap:0.5rem;padding-bottom:0.8rem;">' +
        '<button class="vbtn" id="vbDeurKamer" style="flex:1;">🗝️ ' + T('vb.deurkamer','Open mijn kamerdeur') + '</button>' +
        '<button class="vbtn" id="vbDeurEntree" style="flex:1;background:var(--card);color:var(--txt);border:1px solid var(--line);">' + T('vb.deurentree','Open de entree') + '</button></div>';
    }
    const funcs = APPLY_FUNCS[s.type] || [];
    const applyBlock = funcs.length
      ? '<div class="ms-cat">' + T('cv.workat','Werken bij') + ' ' + s.name + '</div>' +
        '<div style="display:flex;gap:0.5rem;align-items:center;padding:0.3rem 0 0.9rem;">' +
        '<select id="apFunc2" style="flex:1;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:0.7rem 0.9rem;font-size:0.86rem;color:var(--txt);outline:none;">' +
        funcs.map(f => '<option>' + f + '</option>').join('') + '</select>' +
        '<button class="vbtn" id="apGo2">' + T('cv.apply','Solliciteer') + '</button></div>'
      : '';
    const evs = s.events || [];
    const eventsBlock = evs.length
      ? '<div class="ms-cat">\uD83C\uDF9F ' + T('ev.h','Events') + '</div>' + evs.map(e =>
          '<div style="border:1px solid var(--line);border-radius:14px;padding:0.85rem 1rem;margin-bottom:0.6rem;">' +
          '<div style="display:flex;justify-content:space-between;gap:0.6rem;align-items:baseline;"><b style="font-size:0.92rem;">' + e.name + '</b><span style="font-size:0.7rem;color:var(--soft);flex-shrink:0;">' + e.date + (e.time ? ' \u00b7 ' + e.time : '') + '</span></div>' +
          (e.desc ? '<div style="font-size:0.78rem;color:var(--muted);margin-top:0.25rem;">' + e.desc + '</div>' : '') +
          '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:0.6rem;gap:0.6rem;">' +
          '<span style="font-size:0.72rem;color:' + (e.spotsLeft > 0 ? 'var(--soft)' : 'var(--burgundy)') + ';">' + (e.spotsLeft > 0 ? e.spotsLeft + ' ' + T('ev.spots','plekken vrij') : T('ev.full','Vol')) + (e.price ? ' \u00b7 ' + eur(e.price) + ' p.p.' : ' \u00b7 ' + T('ev.free','gratis')) + '</span>' +
          (e.spotsLeft > 0 ? '<button class="vbtn" data-rsvp="' + e.id + '">' + T('ev.join','Zet mij op de lijst') + '</button>'
            : '<button class="vbtn" data-wl="' + e.id + '">⏳ ' + T('erv.wachtlijst','Wachtlijst') + '</button>') +
          '</div></div>'
        ).join('')
      : '';
    const retailBlock = menuState.retail ? retailMenuBlock() : '';
    const cats = [...new Set(m.map(x => x.cat))];
    $('#msBody').innerHTML = head + retailBlock + eventsBlock + applyBlock + cats.map(c =>
      '<div class="ms-cat">' + c + '</div>' + m.filter(x => x.cat === c).map(x => {
        const q = menuState.qty[x.id] || 0;
        // alcohol op slot: onder de landsgrens (paspoortleeftijd) niet bestelbaar
        const slot = x.station === 'bar' && menuState.alcohol && menuState.alcohol.mag === false;
        // 86 van het keukenscherm: uitverkocht, dus even niet te bestellen
        const op86 = !!x.uitverkocht;
        return '<div class="ms-item" data-id="' + x.id + '"' + (op86 ? ' style="opacity:0.5;"' : '') + '>' +
          '<div class="info"><div class="nm">' + x.name + '</div>' +
            (x.desc ? '<div class="ds">' + x.desc + '</div>' : '') +
            (x.allergens && x.allergens.length ? '<div class="alg">' + x.allergens.map(a => '<span>' + tAlg(a) + '</span>').join('') + '</div>' : '') +
          '</div>' +
          '<div class="side"><div class="pr">' + eur(x.price) + '</div>' +
            (op86 ? '<div class="qty" style="opacity:0.7;font-size:0.64rem;justify-content:center;">' + T('menu.86','uitverkocht') + '</div>'
              : slot ? '<div class="qty" style="opacity:0.55;font-size:0.64rem;justify-content:center;">🔞 ' + menuState.alcohol.grens + '+</div>'
              : '<div class="qty"><button class="js-minus">−</button><b>' + q + '</b><button class="js-plus">+</button></div>') +
          '</div></div>';
      }).join('')
    ).join('');
    const apGo = $('#apGo2');
    if (apGo) apGo.addEventListener('click', () => memberApply(menuState.supplier.code, $('#apFunc2').value, ''));
    document.querySelectorAll('[data-rsvp]').forEach(b => b.addEventListener('click', async () => {
      try {
        await API.call('/event/rsvp', { supplierCode: menuState.supplier.code, eventId: b.dataset.rsvp, qty: 1 });
        toast(T('ev.joined','U staat op de gastenlijst. Uw codenaam is uw toegang.'));
        await openMenu(menuState.supplier.code); // sheet ververst: plekken en knop kloppen weer
      } catch(e){ toast(e.message); }
    }));
    // vol event: op de wachtlijst; bij een vrijgekomen plek krijgt u meteen bericht
    document.querySelectorAll('[data-wl]').forEach(b => b.addEventListener('click', async () => {
      try {
        const d = await API.call('/wachtlijst', { supplierCode: menuState.supplier.code, eventId: b.dataset.wl });
        toast('⏳ ' + T('erv.wlok','U staat op de wachtlijst (nr. ') + d.positie + '). ' + T('erv.wlbericht','Bij een vrije plek hoort u het meteen.'));
      } catch(e){ toast(e.message); }
    }));
    // favoriet-hart + tafel reserveren
    const favB = $('#msFav');
    if (favB) favB.addEventListener('click', async () => {
      try {
        const d = await API.call('/favoriet', { supplierCode: s.code });
        menuState.supplier.favoriet = d.favoriet;
        renderMenuSheet();
      } catch(e){ toast(e.message); }
    });
    const rsvGo = $('#rsvGo');
    if (rsvGo) rsvGo.addEventListener('click', async () => {
      try {
        const d = await API.call('/reserveer', { supplierCode: s.code, datum: $('#rsvDatum').value, tijd: $('#rsvTijd').value, personen: Number($('#rsvPers').value) });
        toast('🪑 ' + T('erv.reserveerok','Reservering aangevraagd voor') + ' ' + d.reservering.datum + ' ' + d.reservering.tijd + '. ' + T('erv.zaakbevestigt','De zaak bevestigt hem zo.'));
      } catch(e){ toast(e.message); }
    });
    // keyless: de deur van je kamer of de entree, met je telefoon als sleutel
    const deur = async welke => {
      try {
        const d = await API.call('/verblijf/deur', { supplierCode: s.code, welke });
        toast('🔓 ' + d.door.name + ' ' + T('vb.deuropen','is open; hij vergrendelt zelf weer na') + ' ' + d.door.relockSec + 's.');
      } catch(e){ toast(e.message); }
    };
    const dk = $('#vbDeurKamer'); if (dk) dk.addEventListener('click', () => deur('kamer'));
    const de = $('#vbDeurEntree'); if (de) de.addEventListener('click', () => deur('entree'));
    // een kamer boeken: datums kiezen, een knop, het huis bevestigt
    $('#msBody').querySelectorAll('[data-vbboek]').forEach(b => b.addEventListener('click', async () => {
      try {
        const d = await API.call('/verblijf', {
          supplierCode: s.code, roomId: b.dataset.vbboek,
          aankomst: $('#vbAankomst').value, vertrek: $('#vbVertrek').value,
          personen: Number($('#vbPers').value)
        });
        toast('🛎️ ' + T('vb.ok','Verblijf aangevraagd:') + ' ' + d.verblijf.roomName + ', ' + d.verblijf.nachten + ' ' + T('vb.nachten','nacht(en)') + ' (' + eur(d.verblijf.totaal) + '). ' + T('erv.zaakbevestigt','De zaak bevestigt hem zo.'));
      } catch(e){ toast(e.message); }
    }));
    if (menuState.retail) bindRetailMenu();
    $('#msBody').querySelectorAll('.ms-item').forEach(el => {
      const id = el.dataset.id;
      const plus = el.querySelector('.js-plus'), min = el.querySelector('.js-minus');
      if (plus) plus.addEventListener('click', () => { menuState.qty[id] = (menuState.qty[id]||0)+1; renderMenuSheet(); });
      if (min) min.addEventListener('click', () => { menuState.qty[id] = Math.max(0,(menuState.qty[id]||0)-1); renderMenuSheet(); });
    });
    if (!m.length){ $('#msFoot').innerHTML = ''; return; }
    if (menuState.supplier.ordersOpen === false){
      $('#msFoot').innerHTML = '<div style="padding:0.9rem 0;text-align:center;font-size:0.82rem;color:var(--soft);">⏸ ' + T('app.ms.closed','Bestellingen zijn tijdelijk gesloten. De kaart blijft ter inzage.') + '</div>';
      return;
    }
    const total = m.reduce((s,x) => s + x.price * (menuState.qty[x.id]||0), 0);
    const count = Object.values(menuState.qty).reduce((a,b)=>a+b,0);
    const tafels = menuState.supplier.tableNames || [];
    $('#msFoot').innerHTML =
      (tafels.length ? '<select class="ms-note" id="msTable" style="margin-bottom:0.5rem;">'+
        '<option value="">' + T('app.ms.tableq','Aan welke tafel zit u? (optioneel)') + '</option>'+
        tafels.map(t => '<option' + (menuState.table === t ? ' selected' : '') + '>' + t + '</option>').join('') + '</select>' : '') +
      '<input class="ms-note" id="msNote" placeholder="' + T('app.ms.note','Allergie of opmerking (bijv. geen noten)') + '" value="' + menuState.note.replace(/"/g,'&quot;') + '">' +
      '<label class="ms-tag"><input type="checkbox" id="msTag"' + (menuState.tag ? ' checked' : '') + '> ' + T('app.ms.tag','Tag dit voor De Salon (7 dagen na verblijf)') + '</label>' +
      '<select class="ms-note" id="msFooi" style="margin-top:0.4rem;" aria-label="' + T('erv.fooi','Fooi') + '">' +
        '<option value="0">' + T('erv.fooi.geen','Geen fooi') + '</option>' +
        '<option value="p5"' + (menuState.fooi==='p5'?' selected':'') + '>' + T('erv.fooi.team','Fooi voor het team') + ': 5%</option>' +
        '<option value="p10"' + (menuState.fooi==='p10'?' selected':'') + '>' + T('erv.fooi.team','Fooi voor het team') + ': 10%</option>' +
        '<option value="e5"' + (menuState.fooi==='e5'?' selected':'') + '>' + T('erv.fooi.team','Fooi voor het team') + ': € 5</option>' +
      '</select>' +
      '<div style="font-size:0.66rem;color:var(--soft);margin:0.35rem 0;">' + T('app.ms.los','U bestelt rechtstreeks bij deze zaak: een losse overeenkomst, en uw betaling gaat rechtstreeks naar de zaak.') + '</div>' +
      ((menuState.supplier.hasMenu !== false && (menuState.menu || []).some(x => x.station === 'bar'))
        ? '<div style="font-size:0.66rem;color:var(--soft);margin:0.35rem 0;">🔞 ' +
          (menuState.alcohol && menuState.alcohol.mag === false
            ? T('app.ms.geenalc','Alcohol staat voor u uit:') + ' ' + (menuState.alcohol.land || '') + ' ' + T('app.ms.vanaf','hanteert') + ' ' + menuState.alcohol.grens + '+ ' + T('app.ms.pasp','(leeftijd geverifieerd via uw paspoort).')
            : 'Alcohol: ' + ((menuState.alcohol && menuState.alcohol.grens) || 18) + '+; ' + T('app.ms.18b','de zaak kan om legitimatie vragen.')) + '</div>' : '') +
      '<button class="ms-order" id="msOrder"' + (count ? '' : ' disabled') + '>' + (count ? T('app.ms.order','Bestel') + ' ' + count + ' ' + T('app.items','item(s)') + ', ' + eur(total) : T('app.ms.choose','Kies gerechten')) + '</button>';
    const mt = $('#msTable');
    if (mt) mt.addEventListener('change', e => menuState.table = e.target.value);
    $('#msNote').addEventListener('input', e => menuState.note = e.target.value);
    $('#msTag').addEventListener('change', e => menuState.tag = e.target.checked);
    const mf = $('#msFooi');
    if (mf) mf.addEventListener('change', e => menuState.fooi = e.target.value);
    const ob = $('#msOrder');
    if (count) ob.addEventListener('click', placeOrder);
  }

  // ---- mode-/retailcatalogus in de partner-sheet ----
  function retailMenuBlock(){
    const r = menuState.retail;
    const mijn = menuState.retailMijn || { apart: [], styling: [] };
    let html = '<div class="ms-cat">🛍 ' + T('rt.m.cat','Collectie') + '</div>';
    // eigen apart-artikelen en stylingvoorstellen bij dit merk
    const apart = (mijn.apart || []).filter(a => a.supplierName === r.supplier.name);
    if (apart.length) html += '<div style="background:var(--card);border:1px solid var(--line);border-radius:14px;padding:0.7rem 0.9rem;margin-bottom:0.7rem;"><div style="font-size:0.7rem;color:var(--gold);letter-spacing:0.08em;text-transform:uppercase;">' + T('rt.m.apart','Voor u apart gelegd') + '</div>' +
      apart.map(a => '<div style="font-size:0.82rem;margin-top:0.3rem;">' + esc(a.artikelNaam) + ' · ' + esc(a.kleur) + ', ' + esc(a.maat) + ' <span style="color:var(--soft);">(' + T('rt.m.tot','tot') + ' ' + esc(a.tot) + ')</span></div>').join('') +
      '<button class="rt-bezorg" style="margin-top:0.55rem;width:100%;background:var(--gold);color:#000;border:none;border-radius:10px;padding:0.5rem;font-weight:600;font-family:inherit;cursor:pointer;">🚚 ' + T('mb.laat','Veilig laten bezorgen') + '</button>' +
      '<div style="font-size:0.66rem;color:var(--soft);margin-top:0.3rem;">' + T('mb.veiliguitleg','Met bezorgcode, live volgen en pas-aan-de-deur. Dure stukken: ID aan de deur.') + '</div></div>';
    // lopende bezorgingen van deze winkel
    const bez = (menuState.modeBezorg || []).filter(b => b.supplierName === r.supplier.name && !['afgeleverd','retour','geannuleerd'].includes(b.status));
    if (bez.length) html += bez.map(b => '<div style="background:var(--card);border:1px solid var(--gold);border-radius:14px;padding:0.7rem 0.9rem;margin-bottom:0.7rem;"><div style="font-size:0.7rem;color:var(--gold);letter-spacing:0.08em;text-transform:uppercase;">🚚 ' + T('mb.onderweg','Bezorging') + ' · ' + esc(b.status) + '</div>' +
      '<div style="font-size:0.85rem;margin-top:0.3rem;">' + T('mb.code','Bezorgcode') + ': <b style="letter-spacing:0.2em;font-size:1.05rem;">' + esc(b.bezorgcode) + '</b></div>' +
      '<div style="font-size:0.68rem;color:var(--soft);margin-top:0.2rem;">' + (b.koerier ? T('mb.koerieris','Koerier') + ': ' + esc(b.koerier) + (b.etaMin != null ? ' · ETA ' + b.etaMin + ' min' : '') : T('mb.geefcode','Geef deze code alleen aan de RTG-koerier aan de deur.')) + '</div></div>').join('');
    const styling = (mijn.styling || []).filter(v => v.supplierName === r.supplier.name);
    if (styling.length) html += styling.map(v => '<div style="background:var(--card);border:1px solid var(--line);border-radius:14px;padding:0.7rem 0.9rem;margin-bottom:0.7rem;"><div style="font-size:0.7rem;color:var(--gold);letter-spacing:0.08em;text-transform:uppercase;">✨ ' + esc(v.titel) + '</div>' +
      (v.bericht ? '<div style="font-size:0.78rem;color:var(--muted);margin-top:0.25rem;">' + esc(v.bericht) + '</div>' : '') +
      '<div style="font-size:0.8rem;margin-top:0.3rem;">' + v.items.map(i => esc(i.naam)).join(' · ') + '</div><div style="font-size:0.68rem;color:var(--soft);margin-top:0.2rem;">' + T('rt.m.van','van') + ' ' + esc(v.van) + '</div></div>').join('');
    // de artikelen
    const now = Date.now();
    html += (r.artikelen || []).map(a => {
      const drop = a.drop && a.drop.releaseMs > now;
      const bes = a.beschikbaar || [];
      return '<div style="border:1px solid var(--line);border-radius:16px;padding:0.8rem;margin-bottom:0.7rem;" data-rart="' + escAttr(a.id) + '">' +
        '<div style="display:flex;gap:0.8rem;">' +
        (a.foto ? '<img src="' + escAttr(a.foto) + '" alt="' + escAttr(a.naam) + '" style="width:72px;height:92px;object-fit:cover;border-radius:10px;flex-shrink:0;">' : '<div style="width:72px;height:92px;border-radius:10px;background:var(--card);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:1.4rem;">👗</div>') +
        '<div style="flex:1;min-width:0;">' +
        '<div style="display:flex;justify-content:space-between;gap:0.5rem;"><b style="font-size:0.92rem;">' + esc(a.naam) + '</b>' +
        '<button class="rt-fav" data-rfav="' + escAttr(a.id) + '" style="background:none;border:none;font-size:1.1rem;flex-shrink:0;cursor:pointer;" aria-label="' + T('rt.m.verlang','Verlanglijst') + '">' + (a.opWishlist ? '💛' : '🤍') + '</button></div>' +
        '<div style="font-size:0.78rem;color:var(--soft);">' + esc(a.categorie || '') + (a.materiaal ? ' · ' + esc(a.materiaal) : '') + '</div>' +
        (a.kleuren && a.kleuren.length ? '<div style="font-size:0.76rem;color:var(--muted);margin-top:0.2rem;">' + a.kleuren.map(k => esc(k)).join(' · ') + '</div>' : '') +
        '<div style="font-weight:600;margin-top:0.3rem;">' + eur(a.price) + '</div>' +
        (drop ? '<div style="font-size:0.72rem;color:var(--gold);margin-top:0.3rem;">⏳ ' + T('rt.m.drop','Drop') + ' ' + esc(a.drop.datum) + ' ' + esc(a.drop.tijd) + '</div>' : '') +
        '</div></div>' +
        (!drop && bes.length ? '<div style="display:flex;gap:0.4rem;align-items:center;margin-top:0.6rem;flex-wrap:wrap;">' +
          '<span style="font-size:0.72rem;color:var(--soft);">' + T('rt.m.paskamer','Vraag een maat in de paskamer:') + '</span>' +
          '<select class="rt-maat" style="background:var(--card);border:1px solid var(--line);border-radius:10px;padding:0.45rem 0.6rem;font-size:0.8rem;color:var(--txt);">' +
          bes.map(v => '<option value="' + escAttr(v.vsku) + '">' + esc(v.kleur) + ' · ' + esc(v.maat) + '</option>').join('') + '</select>' +
          '<button class="vbtn rt-pas" data-rpas="' + escAttr(a.id) + '">' + T('rt.m.vraag','Vraag') + '</button></div>'
          : (drop ? '' : '<div style="font-size:0.72rem;color:var(--soft);margin-top:0.5rem;">' + T('rt.m.uitverkocht','Tijdelijk uitverkocht.') + '</div>')) +
        '</div>';
    }).join('');
    return html;
  }
  function bindRetailMenu(){
    const code = menuState.supplier.code;
    const bezBtn = document.querySelector('.rt-bezorg');
    if (bezBtn) bezBtn.addEventListener('click', async () => {
      const mijn = menuState.retailMijn || { apart: [] };
      const items = (mijn.apart || []).filter(a => a.supplierName === menuState.supplier.name)
        .map(a => ({ naam: a.artikelNaam, maat: a.maat, kleur: a.kleur, prijs: a.price || 0, aantal: 1 }));
      if (!items.length) return toast(T('mb.geenitems','Geen apart-gelegde stukken om te bezorgen.'));
      const adres = prompt(T('mb.vraagadres','Op welk adres bezorgen we?'));
      if (!adres || !adres.trim()) return;
      try {
        const r = await API.call('/mode/bezorg/aanvraag', { supplierCode: code, adres: adres.trim(), items });
        toast('🚚 ' + T('mb.aangevraagd','Bezorging aangevraagd. Bezorgcode:') + ' ' + r.bezorging.bezorgcode);
        try { menuState.modeBezorg = (await API.call('/mode/bezorg/mijn', {})).bezorgingen || []; } catch(e){}
        renderMenuSheet();
      } catch(e){ toast(e.message); }
    });
    document.querySelectorAll('[data-rfav]').forEach(b => b.addEventListener('click', async () => {
      try {
        const d = await API.call('/retail/wishlist', { code, artikelId: b.dataset.rfav });
        b.textContent = d.wishlist ? '💛' : '🤍';
        const a = (menuState.retail.artikelen || []).find(x => x.id === b.dataset.rfav); if (a) a.opWishlist = d.wishlist;
        toast(d.wishlist ? T('rt.m.opverlang','Op uw verlanglijst. De boetiek ziet het.') : T('rt.m.afverlang','Van uw verlanglijst gehaald.'));
      } catch(e){ toast(e.message); }
    }));
    document.querySelectorAll('[data-rpas]').forEach(b => b.addEventListener('click', async () => {
      const card = b.closest('[data-rart]');
      const sel = card ? card.querySelector('.rt-maat') : null;
      if (!sel || !sel.value) return;
      try {
        await API.call('/retail/paskamer', { code, vsku: sel.value });
        toast('🚪 ' + T('rt.m.pasok','Uw maat is aangevraagd. Een medewerker brengt hem naar de paskamer.'));
      } catch(e){ toast(e.message); }
    }));
  }

  async function placeOrder(){
    const items = Object.entries(menuState.qty).filter(([,q]) => q > 0).map(([id,qty]) => ({ id, qty }));
    if (!items.length) return;
    let d;
    try {
      d = await API.call('/order', { supplierCode: menuState.supplier.code, items, table: menuState.table || '', allergyNote: menuState.note, tagSalon: menuState.tag });
    } catch (e) { toast(e.message); return; }
    $('#menu-sheet').classList.remove('open');
    $('#menu-scrim').classList.remove('open');
    if (d.order.status === 'wacht-op-betaling'){
      // betalen-eerst: de bestelling is pas definitief na directe betaling
      payOrder(d.order, menuState.fooi);
    } else {
      // deze zaak koos betaling achteraf: de bestelling loopt al, afrekenen kan zo
      toast('🛎️ ' + T('app.orderok','Bestelling geplaatst.') + ' ' + T('app.betaalachteraf','Betalen kan achteraf via Bestellingen.'));
    }
    renderTerPlaatse();
  }

  function payOrder(o, fooiKeus){
    // fooi voor het team: percentage of vast bedrag, gekozen in de bestelbon
    const fooi = fooiKeus === 'p5' ? Math.round(o.total * 5) / 100
      : fooiKeus === 'p10' ? Math.round(o.total * 10) / 100
      : fooiKeus === 'e5' ? 5 : 0;
    payWithFaceId(eur(o.total + fooi), async () => {
      await API.call('/order/pay', { ref: o.ref, fooi });
      return o;
    }, { message: () => T('app.paidto','Betaald aan') + ' ' + o.supplierName + '.' + (fooi ? ' 💛 ' + eur(fooi) + ' ' + T('erv.fooivoorteam','fooi voor het team.') : ''), after: () => renderTerPlaatse() });
  }

  $('#msClose').addEventListener('click', () => { $('#menu-sheet').classList.remove('open'); $('#menu-scrim').classList.remove('open'); });
  $('#menu-scrim').addEventListener('click', () => { $('#menu-sheet').classList.remove('open'); $('#menu-scrim').classList.remove('open'); });

  /* ---------- cv-builder + solliciteren via RTG ---------- */
  let myCv = null, myCvReady = false, myApps = [];
  const APPLY_FUNCS = {
    restaurant: ['Bediening','Keuken','Gastheer/gastvrouw','Afwas'],
    bar:        ['Bediening','Bar','Keuken','Security'],
    club:       ['Bediening','Bar','Security'],
    hotel:      ['Receptie','Housekeeping','Roomservice','Onderhoud','Security'],
    apartment:  ['Beheer','Housekeeping','Onderhoud'],
    taxi:       ['Taxi centrale','Chauffeur'],
    jet:        ['Operations','Crew','Piloot']
  };
  async function loadCv(){
    if (!API.live) return;
    try { const d = await API.call('/cv/get'); myCv = d.cv; myCvReady = d.ready; renderCvCard(); } catch(e){}
  }
  function renderCvCard(){
    const el = $('#homeCv'); if (!el) return;
    el.innerHTML = '<div style="font-size:0.62rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--soft);">'+T('cv.card.k','Werken via RTG')+'</div>'+
      (myCvReady
        ? '<div style="margin-top:0.4rem;font-size:0.85rem;color:var(--muted);">✓ '+T('cv.card.ready','Uw cv staat klaar. Solliciteer bij elke RTG-partner in een tik, via Ter plaatse.')+'</div>'
        : '<div style="margin-top:0.4rem;font-size:0.85rem;color:var(--muted);">'+T('cv.card.build','Maak eenmalig uw cv met de cv-builder en solliciteer daarna bij elke RTG-partner op dezelfde manier.')+'</div>')+
      (myApps.length ? '<div style="margin-top:0.9rem;display:flex;flex-direction:column;gap:0.45rem;">'+myApps.map(a => {
        const kleur = a.status==='aangenomen' ? '#4CAF7D' : a.status==='afgewezen' ? 'var(--burgundy)' : a.status==='uitgenodigd' ? '#4CAF7D' : 'var(--gold)';
        const label = a.status==='aangenomen' ? T('cv.st.hired','aangenomen') : a.status==='afgewezen' ? T('cv.st.rejected','afgewezen') : a.status==='uitgenodigd' ? T('cv.st.invited','uitgenodigd') : T('cv.st.new','in behandeling');
        return '<div style="display:flex;align-items:center;justify-content:space-between;gap:0.6rem;font-size:0.78rem;color:var(--muted);">'+
          '<span>'+a.company+' · '+a.func+'</span>'+
          '<span style="display:flex;align-items:center;gap:0.4rem;flex-shrink:0;">'+
          (a.chatId ? '<button class="chatb" style="width:auto;padding:0.2rem 0.55rem;font-size:0.7rem;" data-apchat="'+a.chatId+'" data-apco="'+encodeURIComponent(a.company)+'">💬 '+T('cv.chat','Chat')+'</button>' : '')+
          '<span style="font-size:0.6rem;letter-spacing:0.08em;text-transform:uppercase;color:'+kleur+';border:1px solid '+kleur+';border-radius:999px;padding:0.15rem 0.55rem;">'+label+'</span></span></div>';
      }).join('')+'</div>' : '')+
      '<button class="vbtn" style="margin-top:0.8rem;" id="cvOpen">'+(myCvReady?T('cv.card.edit','Bewerk mijn cv'):T('cv.card.make','Maak mijn cv'))+'</button>';
    $('#cvOpen').addEventListener('click', openCvSheet);
    el.querySelectorAll('[data-apchat]').forEach(b => b.addEventListener('click', () => openApplyChat(b.dataset.apchat, decodeURIComponent(b.dataset.apco||''))));
  }
  function openCvSheet(){
    const c = myCv || {};
    $('#cvName').value = c.name || (user && user.full) || '';
    $('#cvContact').value = c.contact || (user && (user.phone || user.email)) || '';
    $('#cvHeadline').value = c.headline || '';
    $('#cvExp').value = (c.experience || []).join('\n');
    $('#cvSkills').value = (c.skills || []).join(', ');
    $('#cvLang').value = (c.languages || []).join(', ');
    $('#cvAbout').value = c.about || '';
    $('#cv-sheet').classList.add('open');
    $('#cv-scrim').classList.add('open');
  }
  function closeCvSheet(){ $('#cv-sheet').classList.remove('open'); $('#cv-scrim').classList.remove('open'); }
  $('#cvClose').addEventListener('click', closeCvSheet);
  $('#cv-scrim').addEventListener('click', closeCvSheet);
  $('#cvSave').addEventListener('click', async () => {
    try {
      const d = await API.call('/cv/save', {
        name: $('#cvName').value, contact: $('#cvContact').value, headline: $('#cvHeadline').value,
        experience: $('#cvExp').value, skills: $('#cvSkills').value, languages: $('#cvLang').value, about: $('#cvAbout').value
      });
      myCv = d.cv; myCvReady = d.ready;
      toast(d.ready ? T('cv.saved','Cv bewaard. U kunt nu overal solliciteren.') : T('cv.savedpart','Bewaard. Vul ervaring of vaardigheden aan om te kunnen solliciteren.'));
      renderCvCard(); closeCvSheet();
    } catch(e){ toast(e.message); }
  });
  async function memberApply(code, func, note){
    try {
      await API.call('/member/apply', { supplierCode: code, func, note });
      toast(T('cv.applied','Sollicitatie verstuurd, met uw RTG-cv erbij.'));
      return true;
    } catch(e){
      toast(e.message);
      if (/cv/i.test(e.message)) openCvSheet();
      return false;
    }
  }

  /* ---------- vacatures: dezelfde partnervacatures als in de RTFoundation,
     nu ook voor RTG-leden, met land- en afstandfilter en solliciteren met cv ---------- */
  const VLAG = { NL:'🇳🇱', BE:'🇧🇪', DE:'🇩🇪', FR:'🇫🇷', ES:'🇪🇸', JP:'🇯🇵' };
  const VACSOORT = { bijbaan:'Bijbaan', vakantiewerk:'Vakantiewerk', parttime:'Parttime', fulltime:'Fulltime', stage:'Stage', vrijwilliger:'Vrijwilliger' };
  let vacs = [], vacLanden = [], vacLand = '';
  async function loadVacatures(){
    try {
      const d = await API.call('/member/vacatures', vacLand ? { land: vacLand } : {});
      vacs = d.vacatures || []; vacLanden = d.landen || [];
      renderVacatures();
      // locatie ophalen zodat vacatures op afstand komen (eenmalig)
      if (window.Geo && !Geo.laatste() && !loadVacatures._gps){ loadVacatures._gps = true; Geo.positie().then(p => { if (p) renderVacatures(); }); }
    } catch(e){ $('#homeVacatures').hidden = true; }
  }
  function renderVacatures(){
    const el = $('#homeVacatures'); if (!el) return;
    if (!vacs.length && !vacLand){ el.hidden = true; return; }
    el.hidden = false;
    const mijnPlek = window.Geo ? Geo.laatste() : null;
    const rij = vacs.map(v => ({ v, km: mijnPlek && v.loc ? Geo.afstandKm(mijnPlek, v.loc) : null }));
    if (mijnPlek) rij.sort((a,b) => (a.km==null?1e9:a.km) - (b.km==null?1e9:b.km));
    const isApplied = (v) => myApps.some(a => a.func === v.func && a.company === v.bedrijf);
    const landOpts = '<option value="">🌍 '+T('vac.overal','Overal')+'</option>' +
      vacLanden.map(l => '<option value="'+l.code+'"'+(l.code===vacLand?' selected':'')+'>'+(VLAG[l.code]||'🏳️')+' '+esc(l.naam)+'</option>').join('');
    let h = '<div style="display:flex;align-items:center;justify-content:space-between;gap:0.5rem;flex-wrap:wrap;">'+
      '<div style="font-size:0.62rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--soft);">💼 '+T('vac.k','Werk en vacatures')+'</div>'+
      '<select id="vacLand" style="background:var(--card2);color:var(--txt,#fff);border:1px solid var(--line);border-radius:999px;padding:0.3rem 0.6rem;font-size:0.72rem;">'+landOpts+'</select></div>';
    if (!rij.length){
      h += '<div style="margin-top:0.6rem;font-size:0.82rem;color:var(--muted);">'+T('vac.leeg','Nu geen open vacatures die bij u passen. Kijk gerust later nog eens.')+'</div>';
    } else {
      h += '<div style="margin-top:0.7rem;display:flex;flex-direction:column;gap:0.6rem;">'+ rij.slice(0,20).map(({v,km})=>{
        const al = isApplied(v);
        const meta = [ VACSOORT[v.soort]||v.soort, (VLAG[v.land]||'')+' '+(v.landNaam||''), v.plaats||v.stad, km!=null?('📍 '+Geo.tekst(km)):'' ].filter(x=>x&&x.trim()).join(' · ');
        return '<div style="border:1px solid var(--line);border-radius:12px;padding:0.7rem 0.85rem;">'+
          '<div style="display:flex;align-items:flex-start;gap:0.5rem;justify-content:space-between;">'+
          '<div style="min-width:0;"><b style="font-size:0.9rem;">'+esc(v.func)+'</b>'+
          '<div style="font-size:0.74rem;color:var(--gold);font-weight:600;">'+esc(v.bedrijf)+'</div>'+
          '<div style="font-size:0.7rem;color:var(--soft);margin-top:0.15rem;">'+esc(meta)+'</div></div>'+
          (al ? '<span style="flex-shrink:0;font-size:0.6rem;letter-spacing:0.06em;text-transform:uppercase;color:#4CAF7D;border:1px solid #4CAF7D;border-radius:999px;padding:0.15rem 0.5rem;">'+T('vac.verstuurd','verstuurd')+'</span>'
               : '<button class="vbtn" style="flex-shrink:0;width:auto;padding:0.4rem 0.8rem;font-size:0.74rem;" data-vac="'+v.id+'" data-sup="'+v.supplierCode+'">'+T('vac.sol','Solliciteer')+'</button>')+
          '</div>'+
          (v.omschrijving?'<div style="font-size:0.74rem;color:var(--muted);margin-top:0.4rem;line-height:1.4;">'+esc(v.omschrijving)+'</div>':'')+
          '</div>';
      }).join('')+'</div>';
    }
    el.innerHTML = h;
    const sel = $('#vacLand'); if (sel) sel.addEventListener('change', () => { vacLand = sel.value; loadVacatures(); });
    el.querySelectorAll('[data-vac]').forEach(b => b.addEventListener('click', () => applyVac(b.dataset.sup, b.dataset.vac)));
  }
  async function applyVac(supplierCode, vacatureId){
    const v = vacs.find(x => x.id === vacatureId);
    try {
      await API.call('/member/apply', { supplierCode, vacatureId });
      toast(T('cv.applied','Sollicitatie verstuurd, met uw RTG-cv erbij.'));
      if (v) myApps.unshift({ company: v.bedrijf, func: v.func, status: 'nieuw', at: new Date().toISOString() });
      renderVacatures(); renderCvCard();
    } catch(e){
      toast(e.message);
      if (/cv/i.test(e.message)) openCvSheet();
    }
  }

  /* ---------- chat met de werkgever (na uitnodigen/aannemen) ----------
     De sollicitant en de werkgever maken hier samen een afspraak om langs te
     komen. Berichten worden automatisch naar de gekozen taal vertaald. */
  let apChatId = null, apChatTimer = null;
  function apMsgHtml(m){
    const mij = m.van === 'sollicitant';
    const inner = mij ? escT(m.tekst) : '<span class="xlate">' + escT(m.tekst) + '</span>';
    return '<div class="dm-m' + (mij ? ' mine' : '') + '">' + inner + '</div>';
  }
  function ensureApChatEl(){
    let ov = document.getElementById('apchat'); if (ov) return ov;
    ov = document.createElement('div'); ov.id='apchat';
    ov.style.cssText='position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.6);display:none;align-items:flex-end;justify-content:center;';
    ov.innerHTML='<div style="background:var(--bg,#0C0C0B);border:1px solid var(--line);border-radius:16px 16px 0 0;width:min(100%,34rem);height:78vh;display:flex;flex-direction:column;">'+
      '<div style="display:flex;align-items:center;gap:.6rem;padding:.9rem 1rem;border-bottom:1px solid var(--line);"><b id="apchatWie" style="flex:1;"></b><button id="apchatX" style="background:none;border:none;color:var(--soft);font-size:1.3rem;">✕</button></div>'+
      '<div id="apchatMsgs" class="dm-body" style="flex:1;overflow:auto;padding:1rem;display:flex;flex-direction:column;gap:.4rem;"></div>'+
      '<div style="display:flex;gap:.5rem;padding:.8rem 1rem;border-top:1px solid var(--line);"><input id="apchatIn" placeholder="'+T('cv.chat.ph','Bericht (bijv. Kan ik donderdag om 15u langskomen?)')+'" style="flex:1;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:.6rem .85rem;color:var(--txt,#fff);"><button id="apchatSend" class="vbtn" style="width:auto;padding:.5rem 1rem;">'+T('cv.chat.send','Stuur')+'</button></div>'+
      '</div>';
    document.body.appendChild(ov);
    ov.querySelector('#apchatX').addEventListener('click', closeApplyChat);
    ov.addEventListener('click', e=>{ if(e.target===ov) closeApplyChat(); });
    ov.querySelector('#apchatSend').addEventListener('click', sendApplyChat);
    ov.querySelector('#apchatIn').addEventListener('keydown', e=>{ if(e.key==='Enter') sendApplyChat(); });
    return ov;
  }
  async function laadApplyChat(){
    if (!apChatId) return;
    try { const d = await API.call('/member/apply/chat', { id: apChatId });
      const box = document.getElementById('apchatMsgs'); if(!box) return;
      box.innerHTML = (d.chat.berichten||[]).map(apMsgHtml).join('') || '<div style="color:var(--soft);text-align:center;margin:auto;font-size:0.82rem;">'+T('cv.chat.leeg','Nog geen berichten. Stel een moment voor om langs te komen.')+'</div>';
      vertaalBubbels(box); box.scrollTop = box.scrollHeight;
    } catch(e){}
  }
  function openApplyChat(id, bedrijf){
    apChatId = id; const ov = ensureApChatEl();
    ov.querySelector('#apchatWie').textContent = bedrijf || T('cv.chat.title','Chat met de werkgever');
    ov.style.display='flex'; laadApplyChat();
    clearInterval(apChatTimer); apChatTimer = setInterval(laadApplyChat, 4000);
  }
  function closeApplyChat(){ apChatId=null; clearInterval(apChatTimer); const ov=document.getElementById('apchat'); if(ov) ov.style.display='none'; }
  async function sendApplyChat(){
    const inp = document.getElementById('apchatIn'); const t=(inp.value||'').trim(); if(!t||!apChatId) return; inp.value='';
    try { await API.call('/member/apply/chat/send', { id: apChatId, text: t }); laadApplyChat(); } catch(e){ toast(e.message); }
  }

  /* ---------- gastchat met een partner ---------- */
  let pchat = null; // { code, name, dept, depts }
  const DEPT_EN = { 'Receptie':'Reception', 'Roomservice':'Room service', 'Housekeeping':'Housekeeping', 'Onderhoud':'Maintenance', 'Security':'Security', 'Beheer':'Management', 'Team':'Team' };
  const tDept = d => (lang() === 'en' ? (DEPT_EN[d] || d) : d);
  async function openPChat(code){
    const s = suppliers.find(x => x.code === code);
    if (!s) return;
    const depts = s.depts && s.depts.length ? s.depts : ['Team'];
    pchat = { code, name: s.name, dept: depts[0], depts };
    $('#pcName').textContent = s.name;
    renderPChatDepts();
    $('#pchat-sheet').classList.add('open');
    $('#pchat-scrim').classList.add('open');
    await loadPChat();
    $('#pcInput').focus();
  }
  function renderPChatDepts(){
    const el = $('#pcDepts');
    if (!pchat || pchat.depts.length < 2){ el.innerHTML = ''; return; }
    el.innerHTML = pchat.depts.map(d =>
      '<button data-dept="' + d + '"' + (d === pchat.dept ? ' class="on"' : '') + '>' + tDept(d) + '</button>'
    ).join('');
    el.querySelectorAll('[data-dept]').forEach(b => b.addEventListener('click', async () => {
      pchat.dept = b.dataset.dept;
      renderPChatDepts();
      await loadPChat();
    }));
  }
  function closePChat(){
    pchat = null;
    $('#pchat-sheet').classList.remove('open');
    $('#pchat-scrim').classList.remove('open');
  }
  async function loadPChat(){
    if (!pchat) return;
    let msgs = [];
    try { msgs = (await API.call('/partner/chat/history', { supplierCode: pchat.code, dept: pchat.dept })).messages || []; }
    catch(e){ return; }
    renderPChat(msgs);
  }
  function renderPChat(msgs){
    // Met Util.el: zowel de naam van de afzender (m.who) als de berichttekst gaan
    // structureel als tekstknoop. Dat sluit een gat: de oude versie zette m.who
    // ongefilterd in de HTML en escapete de tekst maar deels.
    const E = Util.el, body = $('#pcBody');
    if (!msgs.length){
      Util.vervang(body, E('div', { class: 'pc-empty' }, T('app.pc.empty', 'Stel uw vraag rechtstreeks aan het team. Roomservice, een verzoek aan de eigenaar, of gewoon even iets regelen.')));
      return;
    }
    Util.vervang(body, msgs.map(m => E('div', { class: 'pc-msg ' + (m.from === 'guest' ? 'me' : 'them') },
      m.from === 'partner' ? E('span', { class: 'who' }, m.who) : null,
      m.text,
      m.orig ? E('span', { style: { display: 'block', marginTop: '0.25rem', fontSize: '0.66rem', opacity: '0.55', fontStyle: 'italic' } }, m.orig) : null,
      E('time', {}, timeAgo(m.at)))));
    body.scrollTop = body.scrollHeight;
  }
  async function sendPChat(){
    const inp = $('#pcInput');
    const text = (inp.value || '').trim();
    if (!text || !pchat) return;
    inp.value = '';
    try { renderPChat((await API.call('/partner/chat/send', { supplierCode: pchat.code, dept: pchat.dept, text })).messages); }
    catch(e){ toast(e.message); }
  }
  $('#pcClose').addEventListener('click', closePChat);
  $('#pchat-scrim').addEventListener('click', closePChat);
  // vooraf al op elkaars Salon kijken: nooit vreemden van elkaar
  $('#pcSalon').addEventListener('click', () => { if (pchat) openEtalage(pchat.code); });
  $('#pcSend').addEventListener('click', sendPChat);
  $('#pcInput').addEventListener('keydown', e => { if (e.key === 'Enter') sendPChat(); });
  // De gast vraagt zelf om aandacht: het team krijgt meteen een prioriteitsmelding.
  document.querySelectorAll('#pcAttn [data-attn]').forEach(b => b.addEventListener('click', async () => {
    if (!pchat) return;
    try { await API.call('/aandacht', { supplierCode: pchat.code, reden: b.dataset.attn }); toast(T('app.attn.ok','Het team is gewaarschuwd en komt eraan.')); }
    catch(e){ toast(e.message); }
  }));

