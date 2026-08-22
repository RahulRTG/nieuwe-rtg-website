/* de backoffice: de basis (helpers, taal, elementen) */
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

  // WerkOS-bord: Cmd+K (of de Panelen-knop in de kop) opent het register
  // over het bord; een keuze scrolt naar het paneel en licht het even op.
  let wosBord = null;
  function startWerkOS(){
    if (wosBord || !window.WerkOS) return;
    const apps = [];
    document.querySelectorAll('#app .panel h2, #app .panel2 h2, #app h2').forEach(h => {
      const el = h.closest('.panel') || h.closest('.card') || h.parentElement;
      if (!el || apps.some(a => a.el === el)) return;
      const lab = h.querySelector('[data-i18n]');
      const ruw = ((lab ? lab.textContent : h.textContent) || '').trim().replace(/\s+/g, ' ');
      const naam = ruw.replace(/^[^\p{L}]+/u, '').replace(/[▾▸›\s]+$/g, '').split('·')[0].trim().slice(0, 26);
      if (naam) apps.push({ naam, glyf: 'paneel', el });
    });
    wosBord = WerkOS.bord({ titel: 'RTG Backoffice, alle panelen', apps, knopIn: document.querySelector('header .wrap > span') });
  }

  function enterApp(){
    $('#gate').style.display = 'none';
    $('#app').classList.add('on');
    $('#liveInd').style.display = 'inline-flex';
    startWerkOS();
    render();
    loadHandelsRegels();
    loadFoundationRegistraties();
    laadTimeline();
    loadAanmeldingen();
    loadVerify();
    loadVakbewijzen();
    loadConcierge();
    laadTafels();
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

  async function refresh(){ try { state = (await call('/office/state')).state; render(); loadHandelsRegels(); loadFoundationRegistraties(); } catch(e){} }

  async function loadVerify(){
    let pend = [];
    try { pend = (await call('/office/verifications')).pending || []; } catch(e){ return; }
    $('#verify').innerHTML = pend.length ? pend.map(v =>
      '<div class="vrow" data-id="'+v.id+'">' +
        '<div class="vi"><div class="nm">'+escHtml(v.name)+' <span style="color:var(--soft);font-weight:400;font-size:0.72rem;">· '+escHtml(v.codename)+'</span></div>' +
          '<div class="sub">'+escHtml(v.email||'')+' · '+escHtml(v.tier)+'</div></div>' +
        '<button class="vbtn doc" data-doc="'+v.doc+'">'+T('bo.viewdoc','Document')+'</button>' +
        '<label style="font-size:0.72rem;display:flex;align-items:center;gap:0.3rem;"><input type="checkbox" data-face checked> '+T('bo.face','Gezicht = paspoort')+'</label>' +
        /* De geboortedatum van het DOCUMENT. Voorgevuld met wat het lid zelf
           opgaf, zodat de keurder vergelijkt in plaats van overtypt; wijkt hij
           af, dan wint het document. Zonder dit veld rustte elke leeftijdsclaim
           in het huis op een zelf ingetypte datum. */
        '<label style="font-size:0.72rem;display:flex;align-items:center;gap:0.3rem;">'+T('bo.dob','Geb. op document')+
          '<input type="date" data-geb value="'+escHtml(v.geborenOpgegeven||'')+'" style="font:inherit;font-size:0.72rem;"></label>' +
        '<button class="vbtn ok" data-ok>'+T('bo.approve','Goedkeuren')+'</button>' +
        '<button class="vbtn no" data-no>'+T('bo.reject','Afwijzen')+'</button>' +
        /* Langer bewaren dan de regel: het bewijs verdwijnt zodra de
           klantrelatie voorbij is, tenzij hier een verzoek MET reden ligt.
           De knop staat naast de beslissing omdat dit hetzelfde dossier is,
           en hij noemt zichzelf een verzoek en geen instelling. */
        '<button class="vbtn" data-bewaar title="'+T('bo.keep.help','Dit dossier na afloop van het lidmaatschap nog een jaar bewaren, met reden')+'">'+T('bo.keep','Bewaren met reden')+'</button>' +
      '</div>').join('') : '<div class="empty">'+T('bo.noverify','Geen openstaande verificaties.')+'</div>';
    $('#verify').querySelectorAll('.vrow').forEach(row => {
      const id = Number(row.dataset.id);
      row.querySelector('[data-doc]').addEventListener('click', e => {
        $('#docImg').src = '/api/office/doc?token='+encodeURIComponent(API.token)+'&file='+encodeURIComponent(e.target.dataset.doc);
        $('#docScrim').classList.add('open');
      });
      row.querySelector('[data-ok]').addEventListener('click', () => decide(id, 'approve',
        row.querySelector('[data-face]').checked, row.querySelector('[data-geb]').value));
      row.querySelector('[data-no]').addEventListener('click', () => decide(id, 'reject', false));
      row.querySelector('[data-bewaar]').addEventListener('click', () => bewaarVerzoek(id));
    });
  }
  /* Het bewaarverzoek. De reden is verplicht aan de serverkant; hier vragen we
     hem gewoon, en een lege invoer stuurt niets -- een knop die een 400
     oplevert leert niemand iets. */
  async function bewaarVerzoek(userId){
    const reden = prompt(T('bo.keep.ask','Waarom moet dit identiteitsdossier na afloop van het lidmaatschap nog een jaar blijven staan? (bijvoorbeeld: lopend geschil, verzoek van een toezichthouder)'));
    if (reden === null) return;
    if (!reden.trim()) { alert(T('bo.keep.need','Zonder reden leggen we niets vast; dat is de hele bedoeling van het verzoek.')); return; }
    try { await call('/office/bewaarverzoek', { userId, reden: reden.trim() }); alert(T('bo.keep.ok','Vastgelegd. Het dossier blijft tot een jaar na het einde van het lidmaatschap; daarna wist de bewaarveger het alsnog.')); }
    catch(e){ alert(e.message); }
  }
  async function decide(userId, decision, faceMatch, geboortedatum){
    try { await call('/office/verify', { userId, decision, faceMatch: !!faceMatch,
      geboortedatum: geboortedatum || undefined }); } catch(e){ alert(e.message); return; }
    loadVerify();
  }
