    let ov = document.getElementById('apchat'); if (ov) return ov;
    ov = document.createElement('div'); ov.id='apchat';
    ov.style.cssText='position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.55);display:none;align-items:flex-end;justify-content:center;';
    ov.innerHTML='<div style="background:var(--bg,#12100f);border:1px solid var(--line,#2a2622);border-radius:16px 16px 0 0;width:min(100%,34rem);max-height:80vh;display:flex;flex-direction:column;">'+
      '<div style="display:flex;align-items:center;gap:.6rem;padding:.8rem 1rem;border-bottom:1px solid var(--line,#2a2622);"><b id="apchatWie" style="flex:1;"></b><button id="apchatX" style="background:none;border:none;color:var(--soft,#9a938c);font-size:1.2rem;cursor:pointer;">✕</button></div>'+
      '<div id="apchatMsgs" style="flex:1;overflow:auto;padding:1rem;display:flex;flex-direction:column;gap:.4rem;"></div>'+
      '<div style="display:flex;gap:.5rem;padding:.7rem 1rem;border-top:1px solid var(--line,#2a2622);"><input id="apchatIn" placeholder="'+T('ap.chat.ph','Bericht (bijv. Kun je donderdag om 15u?)')+'" style="flex:1;background:var(--card2,#1b1817);border:1px solid var(--line,#2a2622);border-radius:12px;padding:.55rem .8rem;color:var(--txt,#fff);"><button id="apchatSend" class="obtn primary">'+T('ap.chat.send','Stuur')+'</button></div>'+
      '</div>';
    document.body.appendChild(ov);
    ov.querySelector('#apchatX').addEventListener('click', closeApChat);
    ov.addEventListener('click', e=>{ if(e.target===ov) closeApChat(); });
    ov.querySelector('#apchatSend').addEventListener('click', sendApChat);
    ov.querySelector('#apchatIn').addEventListener('keydown', e=>{ if(e.key==='Enter') sendApChat(); });
    return ov;
  }
  function apMsgHtml(m){
    const mij = m.van==='werkgever';
    const inner = mij ? escT(m.tekst) : '<span class="xlate">'+escT(m.tekst)+'</span>';
    return '<div style="align-self:'+(mij?'flex-end':'flex-start')+';max-width:80%;padding:.45rem .75rem;border-radius:12px;'+(mij?'background:var(--gold,#C9A24B);color:#1a1710;':'background:var(--card2,#1b1817);border:1px solid var(--line,#2a2622);')+'white-space:pre-wrap;">'+inner+'</div>';
  }
  function apVertaal(root){ if(!root||!window.Vertaal) return; const to=(window.RTGi18n?RTGi18n.lang:'nl'); root.querySelectorAll('.xlate:not([data-vt])').forEach(el=>{ el.setAttribute('data-vt','1'); Vertaal.vul(el, el.textContent, to); }); }
  async function laadApChat(){
    if (!apChatId) return;
    try { const d = await API.call('/supplier/apply/chat', { id: apChatId });
      const box = document.getElementById('apchatMsgs'); if(!box) return;
      box.innerHTML = (d.chat.berichten||[]).map(apMsgHtml).join('') || '<div style="color:var(--soft,#9a938c);text-align:center;margin:auto;font-size:.85rem;">'+T('ap.chat.leeg','Nog geen berichten. Stel een afspraak voor.')+'</div>';
      apVertaal(box); box.scrollTop = box.scrollHeight;
    } catch(e){}
  }
  function openApChat(id, wie){
    apChatId = id; const ov = ensureApChatEl();
    ov.querySelector('#apchatWie').textContent = (wie||T('ap.chat.title','Chat met kandidaat'));
    ov.style.display='flex'; laadApChat();
    clearInterval(apChatTimer); apChatTimer = setInterval(laadApChat, 4000);
  }
  function closeApChat(){ apChatId=null; clearInterval(apChatTimer); const ov=document.getElementById('apchat'); if(ov) ov.style.display='none'; }
  async function sendApChat(){
    const inp = document.getElementById('apchatIn'); const t=(inp.value||'').trim(); if(!t||!apChatId) return; inp.value='';
    try { await API.call('/supplier/apply/chat/send', { id: apChatId, text: t }); laadApChat(); } catch(e){ toast(e.message); }
  }
  function timeAgo(iso){ const s=Math.max(1,Math.round((Date.now()-new Date(iso))/1000)); if(s<60)return T('t.now','zojuist'); const ago=T('t.ago',' geleden'); const m=Math.round(s/60); if(m<60)return m+T('t.min',' min')+ago; const h=Math.round(m/60); if(h<24)return h+T('t.hour',' uur')+ago; return Math.round(h/24)+T('t.days',' dag(en)')+ago; }
  function has(cap){ return S && S.caps && S.caps.includes(cap); }

  // ---- login ----
  function initials(name){ return String(name||'?').trim().split(/\s+/).map(w=>w[0]).slice(0,2).join('').toUpperCase(); }

  function renderGate(){
    const list = SDEF ? DEMO.filter(d => SDEF.codes.includes(d.code)) : DEMO;
    if (SDEF){
      document.title = SDEF.label + ', RTG Partners';
      const badge = document.querySelector('#gate .badge');
      if (badge) badge.textContent = (lang() === 'en' ? SDEF.labelEn : SDEF.label);
    }
    // het inlogscherm blijft kaal: geen demo-partnerlijst; de demo logt in met
    // de account-gegevens (of via ?sector=). De lijst blijft wel bestaan als
    // element voor eventuele diepe koppelingen, maar wordt niet gevuld.
    const gl = $('#gateList');
    if (gl) gl.innerHTML = '';
    document.querySelectorAll('[data-code]').forEach(b => b.addEventListener('click', () => pickPartner(b.dataset.code)));
    const lf = document.getElementById('loginForm');
    if (lf) lf.addEventListener('submit', e => {
      e.preventDefault();
      login({ username: document.getElementById('liUser').value, password: document.getElementById('liPass').value }, true);
    });
    const tog = document.getElementById('enrollToggle'), ef = document.getElementById('enrollForm');
    if (tog && ef) tog.addEventListener('click', () => {
      const open = ef.hasAttribute('hidden');
      if (open) { ef.removeAttribute('hidden'); tog.setAttribute('aria-expanded', 'true'); document.getElementById('enBedrijf').focus(); }
      else { ef.setAttribute('hidden', ''); tog.setAttribute('aria-expanded', 'false'); }
    });
    if (ef) ef.addEventListener('submit', enroll);
    gateTik();
  }
  // De klok en de datum op het inlogscherm komen van de ene RTG-klok
  // (/shared/klok.js): overal dezelfde cijfers, met seconden en milliseconden.
  function gateTik(){ if (window.RTGKlok) RTGKlok.alles(); }

  // Uitgenodigd door de werkgever: aanmelden met bedrijfsnaam + kassacode + eigen
  // RTG-inlog. Alleen echte RTG/Lifestyle/Business-leden komen erin.
  async function enroll(e){
    e.preventDefault();
    if (!API.enabled){ toast(T('sup.needserver','Start de server (npm start) om de leverancier-app te gebruiken.')); return; }
    const msg = document.getElementById('enrollMsg');
    const bedrijf = document.getElementById('enBedrijf').value.trim();
    const kassacode = document.getElementById('enCode').value.trim();
    const login2 = document.getElementById('enLogin').value.trim();
    const password = document.getElementById('enPass').value;
    const pin = document.getElementById('enPin').value.trim();
    msg.className = 'enroll-msg';
    msg.textContent = T('enr.busy','Bezig met aanmelden...');
    try {
      const r = await API.call('/supplier/staff/join', { bedrijf, kassacode, login: login2, password, pin });
      msg.className = 'enroll-msg ok';
      msg.textContent = T('enr.ok','Gelukt! U bent aangemeld. U wordt ingelogd...');
      await login({ code: r.code, staffId: r.staffId, pin }, false, true);
    } catch (err) {
      msg.className = 'enroll-msg err';
      msg.textContent = err.message || T('enr.fail','Aanmelden mislukt. Controleer de gegevens.');
    }
  }

  // Functies per genre: zo kiest personeel direct de eigen rol,
  // en solliciteert een kandidaat overal op dezelfde manier.
  const TYPEOF = { KIKUNOI:'restaurant', PONTO:'bar', HOSHI:'hotel', SAKURA:'apartment', MKKX:'taxi', JETAG:'jet', IBIZAIR:'helikopter', AYAKA:'zzp', KAITO:'zzp', ESVEDRA:'activiteit', MACE:'activiteit', ISLAREN:'verhuur', IBIZALIV:'vastgoed', MAISON:'retail', AZUL:'charter', LUNARA:'villa', TERRAMAR:'vracht', MERIDIAAN:'kantoorgebouw', SAROCA:'golfclub', FORTIA:'fitnessclub', VELVET:'beautysalon', AMICS:'petcare', NIDO:'kinderopvang', PORTELL:'marina' };
  const FUNCS = {
    restaurant: ['Bediening','Keuken','Gastheer/gastvrouw','Afwas'],
    bar:        ['Bediening','Bar','Keuken','Security'],
    club:       ['Bediening','Bar','Security'],
    hotel:      ['Receptie','Housekeeping','Roomservice','Onderhoud','Security'],
    apartment:  ['Beheer','Housekeeping','Onderhoud'],
    villa:      ['Beheer','Housekeeping','Onderhoud'],
    taxi:       ['Taxi centrale','Chauffeur'],
    jet:        ['Operations','Crew','Piloot'],
    helikopter: ['Operations','Piloot','Crew','Grondpersoneel'],
    activiteit: ['Gids','Security','Ticketbalie'],
    verhuur:    ['Balie','Monteur','Schoonmaak'],
    vastgoed:   ['Makelaar','Bezichtigingen','Backoffice'],
    vracht:     ['Expediteur','Planner','Douane-declarant','Loods'],
    kantoorgebouw: ['Receptie','Security','Facilitair','Concierge & jetset'],
    golfclub:   ['Club-secretaris','Golfpro','Caddiemaster','Greenkeeping'],
    fitnessclub: ['Clubmanager','Receptie & check-in','Trainer'],
    beautysalon: ['Salonmanager','Barbier','Stylist','Nagelstudio'],
    petcare:    ['Eigenaar','Dierverzorging','Uitlaatservice','Trimsalon'],
    kinderopvang: ['Locatiemanager','Pedagogisch medewerker','Nanny-coordinator'],
    marina:     ['Havenmeester','Steiger & brandstof','Service & helling','Marina-concierge']
  };
  let pickCode = null, gateRoster = null, pendingStation = null;
  const spH2 = () => document.querySelector('#staffPick h2');
  const spDeck = () => document.querySelector('#staffPick .sp-deck');

  async function pickPartner(code){
