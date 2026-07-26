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

