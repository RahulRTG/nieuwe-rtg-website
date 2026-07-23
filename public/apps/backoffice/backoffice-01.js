(function(){
  const $ = s => document.querySelector(s);
  const T = (k, nl) => (window.RTGi18n ? RTGi18n.t(k, nl) : nl);
  // klik binnen de kaart niet naar de achtergrond laten lekken (zonder inline handler)
  document.querySelectorAll('[data-stop]').forEach(el => el.addEventListener('click', e => e.stopPropagation()));
  const lang = () => (window.RTGi18n ? RTGi18n.lang : 'nl');
  // Escapet tekst die als HTML-inhoud in het scherm belandt (namen, plaatsen,
  // diensten, sollicitaties), zodat door leden/partners ingevoerde tekst nooit
  // als opmaak of script in de backoffice kan uitvoeren.
  const escHtml = s => String(s == null ? '' : s).replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
  const eur = n => '€ ' + Number(n).toLocaleString(lang() === 'en' ? 'en-US' : 'nl-NL');
  const STATUS = { 'nieuw':'new', 'in bereiding':'in preparation', 'klaar':'ready', 'geserveerd':'served', 'geweigerd':'declined', 'terugbetaald':'refunded',
    'aangevraagd':'requested', 'geaccepteerd':'accepted', 'onderweg':'en route', 'aangekomen':'at pickup', 'aan-boord':'on board', 'rijdt':'on board', 'afgerond':'completed', 'gearriveerd':'completed' };
  const tStatus = s => (lang() === 'en' ? (STATUS[s] || s) : s);
  // API-client uit de gedeelde app-shell (public/shared/appshell.js).
  const API = RTGApp.maakAPI();
  let state = null, source = null;
  let tl = null, tlPage = 1, tlTimer = null;
  const enabled = API.enabled;
  const call = (path, body) => API.call(path, body);
  function timeAgo(iso){ const s=Math.max(1,Math.round((Date.now()-new Date(iso))/1000)); if(s<60)return T('t.now','zojuist'); const ago=T('t.ago',' geleden'); const m=Math.round(s/60); if(m<60)return m+T('t.min',' min')+ago; const h=Math.round(m/60); if(h<24)return h+T('t.h',' u')+ago; return Math.round(h/24)+T('t.d',' d')+ago; }

  /* Het inloggen woont in de personeels-app (kantoor-ingang, met TOTP als die
     is ingesteld); zonder geldige sessie sturen we daarheen, met een
     terug-adres zodat u na het inloggen weer hier staat. */
  function naarInlog(){
    location.replace('/apps/personeel.html?kantoor=1&terug=' + encodeURIComponent(location.pathname + location.search));
  }

  // Werk-OS-bord: Cmd+K (of de Panelen-knop in de kop) opent een springboard
  // over het bord; een tik scrolt naar het paneel en licht het even op.
  let wosBord = null;
  function startWerkOS(){
    if (wosBord || !window.WerkOS) return;
    const apps = [];
    document.querySelectorAll('#app .panel h2, #app .panel2 h2, #app h2').forEach(h => {
      const el = h.closest('.panel') || h.closest('.card') || h.parentElement;
      if (!el || apps.some(a => a.el === el)) return;
      const lab = h.querySelector('[data-i18n]');
      const ruw = ((lab ? lab.textContent : h.textContent) || '').trim().replace(/\s+/g, ' ');
      const emoji = ((h.textContent || '').match(/\p{Extended_Pictographic}/u) || [])[0] || '▦';
      const naam = ruw.replace(/^[^\p{L}]+/u, '').replace(/[▾▸›\s]+$/g, '').split('·')[0].trim().slice(0, 26);
      if (naam) apps.push({ naam, icoon: emoji, el });
    });
    wosBord = WerkOS.bord({ titel: 'RTG Backoffice, alle panelen', apps, knopIn: document.querySelector('header .wrap > span') });
  }

  function enterApp(){
    $('#gate').style.display = 'none';
    $('#app').classList.add('on');
    $('#liveInd').style.display = 'inline-flex';
    startWerkOS();
    render();
    laadTimeline();
    loadAanmeldingen();
    loadVerify();
    loadConcierge();
    loadIncidenten();
    loadSalonNaleving();
    loadOntmoetingen();
    loadTrust();
    stream();
  }

  // Blijf ingelogd: met een bewaard token direct het overzicht in; zonder
  // (of met een verlopen) token gaat het via de ene inlog in de personeels-app.
  (async function restoreSession(){
    if (!enabled) return;
    let t = null; try { t = localStorage.getItem('rtg_office_token'); } catch(e){}
    if (!t){ naarInlog(); return; }
    API.token = t;
    try {
      state = (await call('/office/state')).state;
      enterApp();
    } catch(e){
      API.token = null;
      try { localStorage.removeItem('rtg_office_token'); } catch(e2){}
      naarInlog();
    }
  })();

  async function refresh(){ try { state = (await call('/office/state')).state; render(); } catch(e){} }

  async function loadVerify(){
    let pend = [];
    try { pend = (await call('/office/verifications')).pending || []; } catch(e){ return; }
    $('#verify').innerHTML = pend.length ? pend.map(v =>
      '<div class="vrow" data-id="'+v.id+'">' +
        '<div class="vi"><div class="nm">'+escHtml(v.name)+' <span style="color:var(--soft);font-weight:400;font-size:0.72rem;">· '+escHtml(v.codename)+'</span></div>' +
          '<div class="sub">'+escHtml(v.email||'')+' · '+escHtml(v.tier)+'</div></div>' +
        '<button class="vbtn doc" data-doc="'+v.doc+'">'+T('bo.viewdoc','Document')+'</button>' +
        '<label style="font-size:0.72rem;display:flex;align-items:center;gap:0.3rem;"><input type="checkbox" data-face checked> '+T('bo.face','Gezicht = paspoort')+'</label>' +
        '<button class="vbtn ok" data-ok>'+T('bo.approve','Goedkeuren')+'</button>' +
        '<button class="vbtn no" data-no>'+T('bo.reject','Afwijzen')+'</button>' +
      '</div>').join('') : '<div class="empty">'+T('bo.noverify','Geen openstaande verificaties.')+'</div>';
    $('#verify').querySelectorAll('.vrow').forEach(row => {
      const id = Number(row.dataset.id);
      row.querySelector('[data-doc]').addEventListener('click', e => {
        $('#docImg').src = '/api/office/doc?token='+encodeURIComponent(API.token)+'&file='+encodeURIComponent(e.target.dataset.doc);
        $('#docScrim').classList.add('open');
      });
      row.querySelector('[data-ok]').addEventListener('click', () => decide(id, 'approve', row.querySelector('[data-face]').checked));
      row.querySelector('[data-no]').addEventListener('click', () => decide(id, 'reject', false));
    });
  }
  async function decide(userId, decision, faceMatch){
    try { await call('/office/verify', { userId, decision, faceMatch: !!faceMatch }); } catch(e){ alert(e.message); return; }
    loadVerify();
  }

  // ---- aanmeldingen per pas: de AI deed alles, alleen ja/nee is aan het personeel ----
  async function loadAanmeldingen(){
    const el = document.getElementById('aanmeldingen'); if (!el) return;
    let lijst = [];
    try { lijst = (await call('/aanmelding/lijst', { status: 'in behandeling' })).aanmeldingen || []; } catch(e){ return; }
    el.innerHTML = lijst.length ? lijst.map(a => {
      const gedaan = (a.reis || []).map(s => s.naam).join(' · ');
      const uitnod = a.viaUitnodiging ? ' <span style="color:var(--gold);font-size:0.7rem;">op uitnodiging</span>' : '';
      return '<div class="vrow" data-id="'+a.id+'">' +
        '<div class="vi"><div class="nm">'+escHtml(a.naam)+' <span style="color:var(--soft);font-weight:400;font-size:0.72rem;">· '+escHtml(a.pasNaam)+'</span>'+uitnod+'</div>' +
          '<div class="sub">'+escHtml(a.contact||'')+'</div>' +
          '<div class="sub" style="color:var(--soft);">'+T('bo.aanmklaar','AI klaar')+': '+escHtml(gedaan)+'</div></div>' +
        '<button class="vbtn ok" data-ok>'+T('bo.accept','Accepteren')+'</button>' +
        '<button class="vbtn no" data-no>'+T('bo.reject','Afwijzen')+'</button>' +
      '</div>';
    }).join('') : '<div class="empty">'+T('bo.noaanm','Geen openstaande aanmeldingen.')+'</div>';
    el.querySelectorAll('.vrow').forEach(row => {
      const id = row.dataset.id;
      row.querySelector('[data-ok]').addEventListener('click', () => beslisAanm(id, 'geaccepteerd'));
      row.querySelector('[data-no]').addEventListener('click', () => beslisAanm(id, 'afgewezen'));
    });
  }
  async function beslisAanm(id, besluit){
    try { await call('/aanmelding/beslis', { id, besluit }); } catch(e){ alert(e.message); return; }
    loadAanmeldingen();
  }

  // ---- paspoort-incidenten: RTG beoordeelt of een opgeeiste identiteit vrijkomt ----
  async function loadIncidenten(){
    const el = document.getElementById('incidenten'); if (!el) return;
    let inc = [];
    try { inc = (await call('/office/incidenten', { alleen: 'open' })).incidenten || []; } catch(e){ return; }
    el.innerHTML = inc.length ? inc.map(i =>
      '<div class="vrow" data-id="'+i.id+'">' +
        '<div class="vi"><div class="nm">'+escHtml(i.codenaam||'\u2013')+' <span style="color:var(--soft);font-weight:400;font-size:0.72rem;">· '+escHtml(i.supplierName)+' · '+escHtml(i.gevraagdNiveau)+'</span></div>' +
          '<div class="sub">'+escHtml(i.reden)+'</div></div>' +
        '<button class="vbtn ok" data-vrij>'+T('bo.release','Vrijgeven')+'</button>' +
        '<button class="vbtn no" data-afw>'+T('bo.declineinc','Afwijzen')+'</button>' +
      '</div>').join('') : '<div class="empty">'+T('bo.noinc','Geen openstaande incidenten.')+'</div>';
    el.querySelectorAll('.vrow').forEach(row => {
      const id = row.dataset.id;
      row.querySelector('[data-vrij]').addEventListener('click', () => decideInc(id, 'vrijgeven'));
      row.querySelector('[data-afw]').addEventListener('click', () => decideInc(id, 'afwijzen'));
    });
  }
  async function decideInc(id, besluit){
    try { await call('/office/incident/beslis', { id, besluit }); } catch(e){ alert(e.message); return; }
    loadIncidenten();
  }

  // ---- Salon-naleving: welke partners hebben (g)een compleet profiel ----
  async function loadSalonNaleving(){
    const el = document.getElementById('salonNaleving'); if (!el) return;
    let d;
    try { d = await call('/office/salon-naleving', {}); } catch(e){ return; }
    const kop = '<div class="vrow"><div class="vi"><div class="nm">'+d.compleet+' / '+d.totaal+' '+T('bo.saloncompleet','profielen compleet')+'</div>'+
      '<div class="sub">'+(d.achter.length ? d.achter.length+' '+T('bo.salonachter','partner(s) nog niet zichtbaar voor leden') : T('bo.salonok','alle partners zijn zichtbaar'))+'</div></div></div>';
    const rows = (d.partners || []).map(p =>
      '<div class="vrow"><div class="vi"><div class="nm">'+(p.compleet?'✅':'⚠️')+' '+escHtml(p.name)+' <span style="color:var(--soft);font-weight:400;font-size:0.72rem;">· '+escHtml(p.type)+'</span></div>'+
      '<div class="sub">'+(p.bio?'✓':'✗')+' bio · '+(p.foto?'✓':'✗')+' foto · '+p.items+' '+T('bo.salonitems','items')+' · '+p.volgers+' '+T('bo.salonvolgers','volgers')+'</div></div></div>').join('');
    el.innerHTML = kop + rows;
  }

  // ---- Salon-ontmoetingen: lopende afspraken met live-locatie en SOS ----
  async function loadOntmoetingen(){
    const el = document.getElementById('ontmoetOffice'); if (!el) return;
    let d;
    try { d = await call('/office/ontmoetingen', {}); } catch(e){ return; }
    if (!d.dates || !d.dates.length){ el.innerHTML = '<div class="empty">'+T('bo.ontgeen','Geen lopende afspraken.')+'</div>'; return; }
    el.innerHTML = d.dates.map(dt => {
      const nood = dt.sos && dt.sos.length;
