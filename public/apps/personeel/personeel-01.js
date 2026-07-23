(function(){
  const $ = s => document.querySelector(s);
  const T = (k, nl) => (window.RTGi18n ? RTGi18n.t(k, nl) : nl);
  const lang = () => (window.RTGi18n ? RTGi18n.lang : 'nl');
  // dynamische tekst (taken, bonnen, opdrachten) in de moedertaal van de medewerker
  const MTX = t => (window.MoederTaal ? MoederTaal.tekst(t) : t);
  const eur = n => '€ ' + Number(n).toLocaleString(lang() === 'en' ? 'en-US' : 'nl-NL');

  const SECTORS = [
    { id:'horeca',  icon:'horeca', nl:'Horeca',  en:'Hospitality', sub:'Restaurants, bars, beachclubs, koffie', codes:['KIKUNOI','PONTO','VORA','BRISA','FUEGO'] },
    { id:'verblijf',icon:'hotel', nl:'Verblijf', en:'Stays', sub:'Hotels, appartementen, villa\'s', codes:['HOSHI','SAKURA','LUNARA'] },
    { id:'vervoer', icon:'auto', nl:'Vervoer', en:'Transport', sub:'Taxi\'s, privéjets en helikopters', codes:['MKKX','JETAG','IBIZAIR'] },
    { id:'zzp', icon:'werk', nl:'Zelfstandig', en:'Independent', sub:'Mode, health, wellness en meer', codes:['AYAKA','KAITO','SERENA'] },
    { id:'zorg', icon:'zorg', nl:'Zorg & welzijn', en:'Care & wellness', sub:'Spa\'s, klinieken, de zorgbalie', codes:['ZENITH','CLARA'] },
    { id:'activiteiten', icon:'ticket', nl:'Activiteiten', en:'Experiences', sub:'Tours, musea, events, galeries', codes:['ESVEDRA','MACE','FESTA','LIENZO'] },
    { id:'verhuur', icon:'sleutel', nl:'Verhuur', en:'Rentals', sub:'Auto\'s, scooters, motoren, quads', codes:['ISLAREN','MOTOISLA'] },
    { id:'vastgoed', icon:'gebouw', nl:'Vastgoed', en:'Real estate', sub:'Makelaar, bezichtigingen', codes:['IBIZALIV'] },
    { id:'mode', icon:'mode', nl:'Mode & retail', en:'Fashion & retail', sub:'Modehuizen, juweliers, winkels', codes:['MAISON','ORODOR'] },
    { id:'charter', icon:'boot', nl:'Boten & jachten', en:'Boats & yachts', sub:'Charters, schippers, op zee', codes:['AZUL'] },
    { id:'beveiliging', icon:'schild', nl:'Beveiliging', en:'Security', sub:'Diensten, posten, rondes, SOS', codes:['AEGIS'] },
    { id:'boerderij', icon:'oogst', nl:'Boerderij', en:'Farm', sub:'Land, kas, dieren en oogst', codes:['CANFERRER'] },
    { id:'creator', icon:'camera', nl:'Creators', en:'Creators', sub:'Content, planning, samenwerkingen', codes:['LUMINA'] },
    { id:'vracht', icon:'logistiek', nl:'Vracht', en:'Freight', sub:'Zendingen, douane, de loods', codes:['TERRAMAR'] },
    { id:'gebouw', icon:'gebouw', nl:'Kantoorgebouw', en:'Office tower', sub:'Receptie, facilitair, concierge (Zuidas)', codes:['MERIDIAAN'] },
    { id:'marina', icon:'boot', nl:'Marina', en:'Marina', sub:'Steiger, brandstof, service, concierge', codes:['PORTELL'] },
    { id:'verzekeraar', icon:'parasol', nl:'Verzekeraar', en:'Insurer', sub:'Adviesvragen, declaraties, pas-controle', codes:['SEGUR'] }
  ];
  const BEDRIJVEN = {
    KIKUNOI:{ name:'Sal de Mar', icon:'' }, PONTO:{ name:'Sunset Ibiza', icon:'' },
    HOSHI:{ name:'Aguamarina Ibiza', icon:'' }, SAKURA:{ name:'Villa Bahia Ibiza', icon:'' },
    MKKX:{ name:'Ibiza Executive Cars', icon:'' }, JETAG:{ name:'Aria Private Aviation', icon:'' },
    IBIZAIR:{ name:'Ibiza Sky Charter', icon:'' },
    AYAKA:{ name:'Atelier Marfil', icon:'' }, KAITO:{ name:'Studio Milan', icon:'' },
    ESVEDRA:{ name:'Es Vedra Cruises', icon:'' }, MACE:{ name:'MACE Museum Eivissa', icon:'' },
    ISLAREN:{ name:'Isla Rent Ibiza', icon:'' },
    IBIZALIV:{ name:'Ibiza Living Estates', icon:'' },
    MAISON:{ name:'Maison Solène', icon:'' },
    AZUL:{ name:'Azul Yacht Charter', icon:'' },
    AEGIS:{ name:'Aegis Elite Security', icon:'' },
    CANFERRER:{ name:'Finca Can Ferrer', icon:'' },
    LUMINA:{ name:'Lumina Media', icon:'' },
    VORA:{ name:'Vora Beach Club', icon:'' }, BRISA:{ name:'Cafe Brisa', icon:'' },
    FUEGO:{ name:'Chef Fuego', icon:'' }, LUNARA:{ name:'Casa Lunara', icon:'' },
    MOTOISLA:{ name:'Moto Isla', icon:'' }, FESTA:{ name:'Festa Ibiza Events', icon:'' },
    SERENA:{ name:'Serena Spa', icon:'' }, ORODOR:{ name:"Casa d'Oro", icon:'' },
    ZENITH:{ name:'Zenith Spa & Wellness', icon:'' }, CLARA:{ name:'Kliniek Clara Ibiza', icon:'' },
    LIENZO:{ name:'Galeria Lienzo', icon:'' },
    TERRAMAR:{ name:'TerraMar Cargo', icon:'' },
    MERIDIAAN:{ name:'Meridiaan Toren', icon:'' },
    PORTELL:{ name:'Marina Portell', icon:'' },
    SEGUR:{ name:'Segur Advies', icon:'' }
  };

  // De API-client komt uit de gedeelde app-shell (public/shared/appshell.js),
  // zodat alle apps zich identiek gedragen.
  const API = RTGApp.maakAPI();

  let state = null, me = null, code = null, week = null;
  let toastTimer;
  function toast(m){ const t=$('#toast'); t.textContent=m; t.classList.add('show'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>t.classList.remove('show'),3000); }
  function timeAgo(iso){ const s=Math.max(1,Math.round((Date.now()-new Date(iso))/1000)); if(s<60)return T('t.now','zojuist'); const m=Math.round(s/60); if(m<60)return m+T('t.min',' min'); const h=Math.round(m/60); if(h<24)return h+T('t.hour',' uur'); return Math.round(h/24)+T('t.days',' dg'); }
  function esc(x){ return String(x).replace(/&/g,'&amp;').replace(/</g,'&lt;'); }

  // ---- het kantoorgebouw (Zuidas) op zak: receptie, facilitair, concierge ----
  let pdGeb = null;
  const heeftGebouw = () => !!(state && state.supplier && (state.supplier.caps || []).includes('gebouw'));
  async function laadGebouwPda(){
    if (!heeftGebouw()) return;
    try { pdGeb = await API.call('/supplier/gebouw', {}); } catch(e){ pdGeb = null; }
    renderGebouwPda();
  }
  function renderGebouwPda(){
    const tabBtn = document.getElementById('tabGebouw');
    if (tabBtn) tabBtn.style.display = heeftGebouw() ? '' : 'none';
    const wrap = $('#gebouwPdaWrap'); if (!wrap) return;
    if (!heeftGebouw()){ wrap.innerHTML = ''; return; }
    if (!pdGeb){ wrap.innerHTML = '<div class="card">…</div>'; laadGebouwPda(); return; }
    const d = pdGeb;
    const MELD = { schoonmaak: 'Schoonmaak', onderhoud: 'Onderhoud', catering: 'Catering' };
    const JET = { concierge: 'Concierge', chauffeur: 'Chauffeur', 'jet-transfer': 'Jet-transfer', lounge: 'Executive lounge' };
    let html = '';
    // de receptie: wie staat er voor de balie
    const verwacht = (d.bezoekers||[]).filter(b => b.status !== 'vertrokken');
    html += '<div class="card"><div class="k">'+T('pd.geb.receptie','Receptie')+' ('+verwacht.length+')</div>'+
      (verwacht.length ? verwacht.map(b => '<div class="task"><div class="t"><b>'+esc(b.naam)+'</b><span>'+esc(b.voorWie)+' · '+esc(b.status)+(b.badge?' · '+esc(b.badge):'')+'</span></div>'+
        (b.status==='verwacht' ? '<button class="abtn" data-pgbin="'+b.id+'">'+T('pd.geb.binnen','Binnen')+'</button>' : '<button class="abtn" data-pgweg="'+b.id+'" style="background:var(--card2);color:var(--txt);border:1px solid var(--line);">'+T('pd.geb.weg','Weg')+'</button>')+'</div>').join('')
        : '<div style="margin-top:0.5rem;font-size:0.8rem;color:var(--soft);">'+T('pd.geb.rustig','Geen bezoekers in de rij.')+'</div>')+'</div>';
    // facilitair: de meldingen van het huis
    const open = (d.meldingen||[]).filter(m => m.status !== 'klaar');
    html += '<div class="card"><div class="k">'+T('pd.geb.fac','Facilitair')+' ('+open.length+')</div>'+
      (open.length ? open.map(m => '<div class="task"><div class="t"><b>'+esc(m.tekst)+'</b><span>'+MELD[m.soort]+' · '+T('pd.geb.verd','verdieping')+' '+m.verdieping+' · '+esc(m.status)+'</span></div>'+
        (m.status==='open' ? '<button class="abtn" data-pgmb="'+m.id+'">'+T('pd.geb.pak','Pak op')+'</button>' : '<button class="abtn" data-pgmk="'+m.id+'">'+T('pd.geb.klaar','Klaar')+'</button>')+'</div>').join('')
        : '<div style="margin-top:0.5rem;font-size:0.8rem;color:var(--soft);">'+T('pd.geb.oporde','Het huis is op orde.')+'</div>')+'</div>';
    // valet en de jetset-diensten voor de concierge
    const valet = (d.valet||[]).filter(v => v.status !== 'klaar');
    const jetset = (d.jetset||[]).filter(j => j.status !== 'afgerond');
    html += '<div class="card"><div class="k">'+T('pd.geb.jetset','Concierge en jetset')+' ('+(valet.length+jetset.length)+')</div>'+
      valet.map(v => '<div class="task"><div class="t"><b>'+esc(v.wie)+'</b><span>'+T('pd.geb.valet','valet')+' · '+esc(v.status)+'</span></div>'+
        (v.status==='gevraagd' ? '<button class="abtn" data-pgvv="'+v.id+'">'+T('pd.geb.voorrijden','Voorrijden')+'</button>' : '<button class="abtn" data-pgvk="'+v.id+'">'+T('pd.geb.klaar','Klaar')+'</button>')+'</div>').join('')+
      jetset.map(j => '<div class="task"><div class="t"><b>'+JET[j.soort]+' · '+esc(j.voorWie)+'</b><span>'+esc(j.wens)+' · '+esc(j.moment)+' · '+esc(j.status)+'</span></div>'+
        (j.status==='aangevraagd' ? '<button class="abtn" data-pgjb="'+j.id+'">'+T('pd.geb.bevestig','Bevestig')+'</button>' : '<button class="abtn" data-pgja="'+j.id+'">'+T('pd.geb.afgerond','Afgerond')+'</button>')+'</div>').join('')+
      ((valet.length+jetset.length) ? '' : '<div style="margin-top:0.5rem;font-size:0.8rem;color:var(--soft);">'+T('pd.geb.geenjetset','Geen open verzoeken.')+'</div>')+'</div>';
    wrap.innerHTML = html;
    const doe = (sel, body) => wrap.querySelectorAll('['+sel+']').forEach(b => b.addEventListener('click', async () => {
      const { pad, data } = body(b.dataset);
      try { await API.call(pad, data); laadGebouwPda(); } catch(e){ toast(e.message); }
    }));
    doe('data-pgbin', ds => ({ pad: '/supplier/gebouw/bezoeker/status', data: { id: ds.pgbin, status: 'binnen' } }));
    doe('data-pgweg', ds => ({ pad: '/supplier/gebouw/bezoeker/status', data: { id: ds.pgweg, status: 'vertrokken' } }));
    doe('data-pgmb', ds => ({ pad: '/supplier/gebouw/melding/status', data: { id: ds.pgmb, status: 'bezig' } }));
    doe('data-pgmk', ds => ({ pad: '/supplier/gebouw/melding/status', data: { id: ds.pgmk, status: 'klaar' } }));
    doe('data-pgvv', ds => ({ pad: '/supplier/gebouw/valet/status', data: { id: ds.pgvv, status: 'voorgereden' } }));
    doe('data-pgvk', ds => ({ pad: '/supplier/gebouw/valet/status', data: { id: ds.pgvk, status: 'klaar' } }));
    doe('data-pgjb', ds => ({ pad: '/supplier/gebouw/jetset/status', data: { id: ds.pgjb, status: 'bevestigd' } }));
    doe('data-pgja', ds => ({ pad: '/supplier/gebouw/jetset/status', data: { id: ds.pgja, status: 'afgerond' } }));
  }

