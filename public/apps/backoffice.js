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
    /* TWEE DINGEN DIE NIET IN DEZELFDE try HOREN, en dat kostte een oneindige lus.
       Hier stond `state = await call('/office/state'); enterApp();` samen in een
       try met een catch die het token weggooit en naar de inlog stuurt. Dat klopt
       voor de EERSTE regel: een sessie die de server niet kent, is geen sessie.
       Voor de tweede klopt het niet -- enterApp() bouwt het scherm op, en als daar
       iets omvalt is dat geen authenticatieprobleem. De catch wiste dan toch het
       token en stuurde door naar /apps/personeel.html?kantoor=1&terug=..., waar de
       poort een geldige kantoorsessie zag en meteen terugstuurde naar `terug`.
       Backoffice heen, poort terug, zeven keer per seconde, eindeloos: in vier
       seconden laadde de pagina zichzelf 42 keer opnieuw. Voor een medewerker een
       knipperend scherm, voor de server een storm.

       Het spoor dat het verraadde was een verzoek zonder Authorization-header:
       /api/aanmelding/betalingen vertrok tokenloos terwijl /aanmelding/lijst uit
       dezelfde functie hem negen milliseconden eerder nog wel droeg. Het token was
       er dus tussenuit gehaald terwijl het scherm nog aan het laden was.

       Nu staan ze los. Zakt het scherm, dan blijft u ingelogd en zegt de console
       WAT er omviel -- in plaats van u stil uit te loggen om een fout die niets met
       inloggen te maken had. */
    try {
      state = (await call('/office/state')).state;
    } catch(e){
      API.token = null;
      try { localStorage.removeItem('rtg_office_token'); } catch(e2){}
      naarInlog();
      return;
    }
    try { enterApp(); }
    catch(e){ console.error('[backoffice] het scherm kwam niet op:', e); }
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
  /* ---- backoffice, vervolg van deel 01 ----
     Geknipt op een TOP-NIVEAU grens binnen dezelfde IIFE: de delen worden
     achter elkaar geplakt, dus het resultaat is letter voor letter hetzelfde
     bestand. Geknipt omdat deel 01 door de 10 KB van keuringsregel 13 ging
     nadat de bewaarverzoek-knop erbij kwam. */
  // ---- aanmeldingen per pas: de AI deed alles, alleen ja/nee is aan het personeel ----
  async function loadAanmeldingen(){
    const el = document.getElementById('aanmeldingen'); if (!el) return;
    let lijst = [];
    try { lijst = (await call('/aanmelding/lijst', { status: 'in behandeling' })).aanmeldingen || []; } catch(e){ return; }
    el.innerHTML = lijst.length ? lijst.map(a => {
      const gedaan = (a.reis || []).map(s => s.naam).join(' · ');
      const uitnod = a.viaUitnodiging ? ' <span style="color:var(--rtg-leesgoud,var(--gold));font-size:0.7rem;">op uitnodiging</span>' : '';
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
    // de lopende lidmaatschapsbetalingen: na een akkoord loopt de bijdrage 12
    // maanden automatisch, met de 30%-foundationsplit (20% lokaal, 10% RTF).
    try {
      const b = await call('/aanmelding/betalingen', {});
      const eur = n => '€ ' + (Math.round(Number(n))).toLocaleString('nl-NL');
      if (b && b.aantalLeden) {
        el.insertAdjacentHTML('beforeend',
          '<div style="margin-top:.7rem;border-top:1px solid var(--line,#2a2a2a);padding-top:.6rem;font-size:0.8rem;color:var(--soft);line-height:1.7;">' +
          '<b style="color:var(--txt);">'+b.aantalLeden+'</b> '+T('bo.aanmlopend','lopende lidmaatschap(pen), 12 maanden automatisch.')+'<br>' +
          T('bo.aanmnaarfound','Per jaar naar de RTFoundation')+': <b style="color:var(--rtg-leesgoud,var(--gold));">'+eur(b.totaal.foundation)+'</b> ('+
          T('bo.aanmlokaal','20% lokaal')+' '+eur(b.totaal.lokaal)+' &middot; '+T('bo.aanmrtf','10% RTF')+' '+eur(b.totaal.rtf)+')</div>');
      }
    } catch(e){}
  }
  async function beslisAanm(id, besluit){
    try { await call('/aanmelding/beslis', { id, besluit }); } catch(e){ alert(e.message); return; }
    loadAanmeldingen();
  }

  /* FOUNDATION: kijken mag op kantoor; besluiten blijft Boardroomwerk. */
  async function loadFoundationRegistraties(){
    const el=document.getElementById('foundationRegistraties');if(!el)return;
    let d;try{d=await call('/office/foundation/registraties');}catch(e){el.innerHTML='<div class="empty">Registraties niet beschikbaar.</div>';return;}
    const lijst=d.registraties||[];
    el.innerHTML=lijst.length?lijst.map(a=>{
      const eisen=(a.toelating&&a.toelating.eisen)||[];
      const klaar=e=>['geverifieerd','niet_van_toepassing'].includes(e.status)&&!(e.gecontroleerd&&e.gecontroleerd.geldigTot&&Date.parse(e.gecontroleerd.geldigTot)<Date.now());
      const open=eisen.filter(e=>!klaar(e));
      const controles=eisen.map(e=>'<div style="border-left:2px solid '+(klaar(e)?'var(--green)':e.status==='afgekeurd'?'#df6b7d':'var(--gold)')+';padding:.18rem 0 .18rem .5rem;margin-top:.25rem"><div class="sub"><b style="color:var(--text)">'+(klaar(e)?'✓ ':'○ ')+escHtml(e.label)+'</b> · '+escHtml(e.status)+'</div>'+
        (a.status==='nieuw'&&!klaar(e)?'<button class="vbtn ok" data-frcheck="'+a.id+'" data-freis="'+e.id+'">Controleren</button> '+(e.magNietVanToepassing?'<button class="vbtn" data-frnvt="'+a.id+'" data-freis="'+e.id+'">N.v.t.</button>':''):'')+'</div>').join('');
      return '<div class="row"><div class="r1"><div><div class="nm">'+escHtml(a.naam)+' <span style="color:var(--soft);font-weight:400">· '+escHtml(a.typeLabel)+' · '+escHtml(a.plaats)+'</span></div><div class="sub">'+escHtml(a.contactNaam)+' · '+escHtml(a.email)+(a.brin?' · BRIN '+escHtml(a.brin):'')+(a.registratieNummer?' · registratie '+escHtml(a.registratieNummer):'')+' · '+timeAgo(a.at)+'</div>'+controles+'</div>'+
        (a.status==='nieuw'?'<div style="display:flex;gap:.3rem;align-items:flex-start">'+(open.length?'<span class="pill nieuw">'+open.length+' open</span>':'<button class="vbtn ok" data-frok="'+a.id+'">Goedkeuren</button>')+'<button class="vbtn" data-frno="'+a.id+'">Afwijzen</button></div>':'<span class="pill '+(a.status==='goedgekeurd'?'klaar':'bereiding')+'">'+escHtml(a.status)+'</span>')+'</div></div>';
    }).join(''):'<div class="empty">Geen registraties.</div>';
    el.querySelectorAll('[data-frcheck],[data-frnvt]').forEach(b=>b.addEventListener('click',async()=>{const nvt=b.hasAttribute('data-frnvt');const ref=prompt(nvt?'Waarom is dit aantoonbaar niet van toepassing?':'Welke officiële bron en uitkomst zijn gecontroleerd?');if(!ref||ref.trim().length<3)return;try{await call('/office/foundation/registratie/controle',{id:b.dataset.frcheck||b.dataset.frnvt,onderdeel:b.dataset.freis,uitkomst:nvt?'niet_van_toepassing':'geverifieerd',referentie:ref});loadFoundationRegistraties();}catch(e){alert(e.message);}}));
    el.querySelectorAll('[data-frok]').forEach(b=>b.addEventListener('click',async()=>{try{const r=await call('/office/foundation/registratie/besluit',{id:b.dataset.frok,action:'goedkeuren'});alert('Goedgekeurd'+(r.toegang?' · toegang is veilig per e-mail verstrekt.':'.'));loadFoundationRegistraties();}catch(e){alert(e.message);}}));
    el.querySelectorAll('[data-frno]').forEach(b=>b.addEventListener('click',async()=>{const reden=prompt('Waarom wordt deze registratie afgewezen?');if(!reden||reden.trim().length<3)return;try{await call('/office/foundation/registratie/besluit',{id:b.dataset.frno,action:'afwijzen',reden});loadFoundationRegistraties();}catch(e){alert(e.message);}}));
  }
  /* ---- backoffice, vervolg van deel 01b: DE OFFICIELE BRONWACHT ----

     APART GEZET omdat 01b met de samenvoeging van 22 augustus 2026 over de
     10 KB kwam, maar de naad ligt hier echt: dit is een eigen onderwerp. De
     bronwacht haalt officiele registers automatisch op en laat het JURIDISCHE
     oordeel bij een mens -- dezelfde grens die ONDERHOUD.md aan de wetwacht
     stelt. De rest van 01b gaat over kantoorlijsten en Foundation-inzage.

     Deel van dezelfde genaaide bundel (scripts/bundel.js): dit bestand is geen
     module en draait binnen dezelfde IIFE als 01, 01b en 02. */
  /* De officiele bronwacht: automatisch ophalen, maar nooit stil juridisch
     versoepelen. Een echte bronwijziging wordt hier een beoordeelbare taak en
     zet geraakte partnerbewijzen op hercontrole. */
  async function loadHandelsRegels(){
    const el = document.getElementById('handelsRegels'); if (!el) return;
    let d; try { d = await call('/office/partner/regels'); }
    catch(e){ el.innerHTML = '<div class="empty">Handelsregelwacht niet beschikbaar.</div>'; return; }
    const open = (d.gebeurtenissen || []).filter(g => g.status === 'open');
    const fouten = (d.bronnen || []).filter(b => String(b.uitslag || '').startsWith('fout'));
    const bronnen = (d.bronnen || []).map(b =>
      '<div class="sub"><a href="'+escHtml(b.url)+'" target="_blank" rel="noopener">'+escHtml(b.naam)+'</a> · '+
      escHtml(b.uitslag || 'nog geen basis')+(b.laatsteCheck?' · '+timeAgo(b.laatsteCheck):'')+'</div>').join('');
    const gebeurtenissen = open.map(g =>
      '<div class="row"><div class="r1"><div><div class="nm">Regelwijziging · '+escHtml(g.naam)+'</div>'+
      '<div class="sub">'+timeAgo(g.at)+' · '+g.aanvragen+' bedrijfs-, '+(g.foundationAanvragen||0)+' FOUNDATION- en '+g.leveranciers+' partnercontrole(s) heropend</div></div>'+
      '<button class="vbtn ok" data-regelbevestig="'+g.id+'">Beoordeling vastleggen</button></div></div>').join('');
    const getroffen = (d.getroffenLeveranciers || []).map(s =>
      '<div class="row"><div><div class="nm">Hercontrole · '+escHtml(s.naam)+' <span style="color:var(--soft);font-weight:400">· '+escHtml(s.land)+'</span></div>'+
      '<div style="display:flex;gap:.3rem;flex-wrap:wrap;margin-top:.35rem">'+s.eisen.map(e =>
        '<button class="vbtn" data-regelcode="'+escHtml(s.code)+'" data-regeleis="'+escHtml(e.id)+'">'+escHtml(e.label)+'</button>').join('')+'</div></div></div>').join('');
    el.innerHTML = '<div class="row"><div class="r1"><div><div class="nm">Automatische officiële regelwacht</div><div class="sub">'+
      (d.automatisch?'Actief, iedere '+Math.round(d.intervalMs/3600000)+' uur':'Uitgeschakeld')+' · '+open.length+' open wijziging(en) · '+fouten.length+' bronfout(en)</div></div>'+
      '<button class="vbtn" id="regelCheckNu">Nu controleren</button></div><details style="margin-top:.55rem"><summary class="sub">'+(d.bronnen||[]).length+' officiële bronnen</summary>'+bronnen+'</details></div>'+
      gebeurtenissen+getroffen;
    document.getElementById('regelCheckNu').addEventListener('click', async () => {
      try { await call('/office/partner/regels/check', {}); await loadHandelsRegels(); }
      catch(e){ alert(e.message); }
    });
    el.querySelectorAll('[data-regelbevestig]').forEach(b => b.addEventListener('click', async () => {
      const toelichting = prompt('Wat is gewijzigd en wat betekent dit voor RTG en de betrokken bedrijven?');
      if (!toelichting || toelichting.trim().length < 3) return;
      try { await call('/office/partner/regels/bevestig', { id:b.dataset.regelbevestig, toelichting }); await loadHandelsRegels(); }
      catch(e){ alert(e.message); }
    }));
    el.querySelectorAll('[data-regelcode]').forEach(b => b.addEventListener('click', async () => {
      const referentie = prompt('Welke actuele officiële bron en uitkomst zijn gecontroleerd?');
      if (!referentie || referentie.trim().length < 3) return;
      const geldigTot = prompt('Geldig tot (JJJJ-MM-DD), of leeg als er geen einddatum is:') || '';
      try { await call('/office/partner/regels/hercontrole', { code:b.dataset.regelcode,
        onderdeel:b.dataset.regeleis, referentie, geldigTot }); await loadHandelsRegels(); }
      catch(e){ alert(e.message); }
    }));
  }
  /* ---- backoffice, DE VAKBEWIJZEN ----
     TERUGGEZET OP 23 AUGUSTUS 2026. Deze vier functies stonden in deel 01c en
     zijn op 21 augustus (32ace3a9, "drie te grote bestanden") VERWIJDERD in
     plaats van verplaatst, terwijl `loadVakbewijzen()` in deel 01 gewoon bleef
     staan. Wat dat opleverde was geen foutmelding maar een oneindige lus: de
     ReferenceError viel in de catch van restoreSession, die hem las als een
     verlopen sessie, het kantoortoken weggooide en doorstuurde naar de
     personeelspoort -- waar een geldige sessie stond, dus die stuurde terug.
     Zeven keer per seconde. De aftekening van vakbewijzen was al die tijd
     onbereikbaar, en niemand zag WAAROM omdat de fout stil werd opgegeten.
     Sinds vandaag staan de sessiecontrole en de schermopbouw in deel 01 los
     van elkaar, dus een fout hier logt niemand meer uit.

     WAAROM DIT SCHERM ER MOEST KOMEN. De persoonseis (server/kern/persoonseis.js)
     houdt personeel in een kinderopvang, een praktijk of een beveiligingsteam
     tegen tot RTG hun stuk heeft gezien. Die aftekening kon alleen over een
     API -- en een poort die dichtzit met een sleutel die niemand kan pakken, is
     geen beveiliging maar een storing. Dit is de plek waar een mens het stuk
     ziet en tekent.

     TWEE DINGEN DIE HIER BEWUST ZO ZIJN.

     1. GEEN ECHTE NAAM, ALLEEN DE CODENAAM. De naam ligt in de kluis en elke
        blik daarin hoort door het inzagejournaal (zie pendingVerifications in
        kern/kantoor/index.js). Voor deze stapel is dat niet nodig: wie aftekent
        bekijkt een STUK, en de koppeling tussen dat stuk en de mens is de
        identiteitsverificatie hiernaast, die al gedaan is.
     2. DE AFTEKENING VRAAGT EEN NAAM, en die wordt hier GEVRAAGD en niet
        geraden. De server weigert een lege naam met 400; een knop die stilletjes
        "backoffice" invult zou van een aftekening een vinkje maken. */

  // ---- de stapel: wat is ingediend en wacht op een mens ----
  async function loadVakbewijzen(){
    const el = document.getElementById('vakbewijzen'); if (!el) return;
    let r = null;
    try { r = await call('/office/vakbewijzen'); } catch(e){ return; }
    if (r.soorten) VAK_SOORTEN = r.soorten;
    const open = r.open || [], verlopend = r.verlopend || [];
    const rij = v =>
      '<div class="vrow" data-sleutel="'+escHtml(v.sleutel)+'" data-wat="'+escHtml(v.wat)+'">' +
        '<div class="vi"><div class="nm">'+escHtml(vakLabel(v.wat)) +
          ' <span class="bij">· '+escHtml(v.wie || '-')+'</span></div>' +
          '<div class="sub" data-nr>' +
            (v.tot ? T('bo.vak.tot','geldig tot')+' '+escHtml(v.tot) : T('bo.vak.geendatum','geen einddatum')) +
            (v.toelichting ? ' · '+escHtml(v.toelichting) : '') + '</div></div>' +
        /* Het NUMMER staat er niet bij. Het ligt in de identiteitskluis, en die
           gaat alleen open met een reden die in het inzagejournaal landt en waar
           de betrokkene bericht van krijgt. Een lijst die het nummer gewoon
           toont, zou van elke blik een ongemerkte blik maken. */
        '<button class="vbtn" data-nummer>'+T('bo.vak.nummer','Nummer inzien')+'</button>' +
        '<button class="vbtn ok" data-teken>'+T('bo.vak.teken','Gezien en aftekenen')+'</button>' +
      '</div>';
    el.innerHTML = (open.length ? open.map(rij).join('')
      : '<div class="empty">'+T('bo.vak.leeg','Geen openstaande vakbewijzen.')+'</div>') +
      /* Wat er BINNENKORT afloopt hoort op hetzelfde bord: zonder die blik
         merkt een zaak het verlopen pas op de ochtend dat er iemand niet meer
         naar binnen kan. */
      (verlopend.length ? '<div class="sub vkop">' +
        T('bo.vak.verlopend','Loopt binnen 60 dagen af') + '</div>' + verlopend.map(v =>
        '<div class="vrow"><div class="vi"><div class="nm">'+escHtml(vakLabel(v.wat)) +
          ' <span class="bij">· '+escHtml(v.wie || '-')+'</span></div>' +
          '<div class="sub">'+T('bo.vak.tot','geldig tot')+' '+escHtml(v.tot || '')+'</div></div>' +
        '<button class="vbtn no" data-intrek data-sleutel="'+escHtml(v.sleutel)+'" data-wat="'+escHtml(v.wat)+'">' +
          T('bo.vak.intrek','Intrekken')+'</button></div>').join('') : '');

    el.querySelectorAll('[data-teken]').forEach(b => b.addEventListener('click', e => {
      const row = e.target.closest('.vrow');
      teken(row.dataset.sleutel, row.dataset.wat);
    }));
    el.querySelectorAll('[data-nummer]').forEach(b => b.addEventListener('click', e => {
      const row = e.target.closest('.vrow');
      nummerInzien(row);
    }));
    el.querySelectorAll('[data-intrek]').forEach(b => b.addEventListener('click', e =>
      intrek(e.target.dataset.sleutel, e.target.dataset.wat)));
  }

  /* De leesbare naam van een soort. De lijst komt van de server (het register in
     kern/persoonseis-lijst.js); valt die weg, dan tonen we de id -- lelijker,
     maar nooit een leeg vakje waar een mens op moet gokken. */
  let VAK_SOORTEN = null;
  const vakLabel = id => (VAK_SOORTEN && VAK_SOORTEN[id] && VAK_SOORTEN[id].naam) || id;

  /* HET NUMMER OPVRAGEN. De reden wordt hier GEVRAAGD en niet verzonnen; de
     server weigert een lege of nietszeggende reden met 400. Wat er terugkomt
     zetten we in de rij zelf, met de grens eronder -- zodat wie het leest ook
     ziet dat de betrokkene hier bericht van heeft gekregen. */
  async function nummerInzien(row){
    const reden = prompt(T('bo.vak.reden','Waarvoor heeft u dit nummer nodig? De betrokkene krijgt uw reden te zien.'));
    if (reden === null) return;
    let r;
    try { r = await call('/office/vakbewijs/nummer', { sleutel: row.dataset.sleutel, wat: row.dataset.wat, reden: (reden||'').trim() }); }
    catch(e){ alert(e.message); return; }
    const sub = row.querySelector('[data-nr]');
    if (sub) sub.innerHTML = '<b>'+escHtml(r.nummer || T('bo.vak.geennr','zonder nummer'))+'</b> · ' + sub.innerHTML +
      '<div class="vgrens">'+escHtml(r.grens || '')+'</div>';
    const knop = row.querySelector('[data-nummer]'); if (knop) knop.remove();
  }

  async function teken(sleutel, wat){
    const door = prompt(T('bo.vak.wie','Wie tekent af dat dit stuk is gezien? (uw naam)'));
    if (door === null) return;
    if (!door.trim()) { alert(T('bo.vak.naamnodig','Een aftekening zonder naam is geen aftekening.')); return; }
    try {
      const r = await call('/office/vakbewijs/teken', { sleutel, wat, door: door.trim() });
      /* De grens die de server meestuurt tonen we letterlijk. Wie aftekent moet
         weten wat hij WEL en NIET vastlegt: dat het stuk er is, niet dat het
         klopt. RTG is geen inspectie. */
      if (r && r.grens) alert(r.grens);
    } catch(e){ alert(e.message); return; }
    loadVakbewijzen();
  }

  async function intrek(sleutel, wat){
    const reden = prompt(T('bo.vak.waarom','Waarom trekt u dit stuk in? (bijvoorbeeld: doorgehaald in het register)'));
    if (reden === null) return;
    const door = prompt(T('bo.vak.wie','Wie tekent af dat dit stuk is gezien? (uw naam)'));
    if (door === null || !door.trim()) return;
    try { await call('/office/vakbewijs/intrek', { sleutel, wat, door: door.trim(), reden: reden.trim() }); }
    catch(e){ alert(e.message); return; }
    loadVakbewijzen();
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
      '<div class="vrow"><div class="vi"><div class="nm">'+(p.compleet?'✓':'⚠')+' '+escHtml(p.name)+' <span style="color:var(--soft);font-weight:400;font-size:0.72rem;">· '+escHtml(p.type)+'</span></div>'+
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
      const namen = dt.deelnemers.map(p => escHtml(p.codenaam) + (p.getekend ? ' ✓' : '')).join(' · ');
      const pos = dt.deelnemers.filter(p => p.pos).map(p => escHtml(p.codenaam) + ': ' + p.pos.lat.toFixed(4) + ', ' + p.pos.lng.toFixed(4)).join(' · ') || T('bo.ontgeenpos','nog geen locatie');
      const status = dt.status === 'noodgeval' ? ''+T('bo.ontnood','NOODGEVAL') : dt.status === 'actief' ? ''+T('bo.ontactief','loopt') : ''+T('bo.onttekenen','wacht op tekenen');
      let sosBlok = '';
      if (nood) sosBlok = dt.sos.map(s =>
        '<div style="margin-top:0.4rem;background:rgba(220,40,40,0.12);border-radius:0;padding:0.5rem 0.7rem;">'+
        '<b style="color:#ff8a8a;">'+escHtml(s.door)+'</b> · '+escHtml(s.bericht)+
        '<div style="margin-top:0.4rem;display:flex;gap:0.4rem;flex-wrap:wrap;">'+
        '<button class="vbtn ok" data-live="'+dt.id+'" data-naam="'+escHtml(s.door)+'">'+T('bo.ontlive','Live meekijken')+'</button>'+
        '<a class="vbtn" href="tel:112" style="text-decoration:none;background:#c62828;color:#fff;">'+T('bo.ont112','Bel 112')+'</a>'+
        '<button class="vbtn" data-sosaf="'+dt.id+'" data-sosid="'+s.id+'">'+T('bo.ontsosaf','SOS afgehandeld')+'</button>'+
        '</div></div>').join('');
      return '<div class="vrow" style="'+(nood?'border:1px solid #c62828;border-radius:0;':'')+'"><div class="vi" style="width:100%;">'+
        '<div class="nm">'+RTGGlyf.tekst(dt.icon)+' '+escHtml(dt.activiteitLabel)+' <span style="color:var(--soft);font-weight:400;font-size:0.72rem;">· '+namen+'</span></div>'+
        '<div class="sub">'+status+' · '+pos+'</div>'+ sosBlok +'</div></div>';
    }).join('');
    el.querySelectorAll('[data-sosaf]').forEach(b => b.addEventListener('click', async () => {
      try { await call('/office/ontmoeting/sos-af', { dateId: b.dataset.sosaf, sosId: b.dataset.sosid }); loadOntmoetingen(); } catch(e){ alert(e.message); }
    }));
    el.querySelectorAll('[data-live]').forEach(b => b.addEventListener('click', () => ontLiveWacht(b.dataset.live, b.dataset.naam)));
  }

  /* Live meekijken bij een SOS: het lid stuurt een WebRTC-aanbod via de office-
     stream ('ontmoeting-signaal'); wij openen het beeld en antwoorden terug. */
  let ontPc = null, ontLiveDate = null, ontIce = null;
  async function ontHaalIce(){ try { ontIce = (await (await fetch('/api/ice')).json()).iceServers; } catch(e){ ontIce = [{ urls:'stun:stun.l.google.com:19302' }]; } return ontIce; }
  function ontLiveWacht(dateId, naam){
    ontLiveDate = dateId;
    $('#ontLiveNaam').textContent = '' + naam;
    $('#ontLiveStatus').textContent = T('bo.ontwacht','Wachten op het camerabeeld van het lid…');
    $('#ontLiveVid').srcObject = null;
    $('#ontLiveScrim').style.display = 'flex';
  }
  function ontLiveSluit(){
    $('#ontLiveScrim').style.display = 'none';
    if (ontPc){ try { ontPc.close(); } catch(e){} ontPc = null; }
    ontLiveDate = null;
  }
  async function opOntSignaal(d){
    if (!d || !d.payload || (ontLiveDate && d.dateId !== ontLiveDate)) return;
    // een nieuw aanbod: open het scherm als dat nog niet openstaat
    if (d.payload.sdp && d.payload.sdp.type === 'offer'){
      ontLiveDate = d.dateId;
      if ($('#ontLiveScrim').style.display !== 'flex'){ $('#ontLiveNaam').textContent = '' + (d.codenaam||'SOS'); $('#ontLiveScrim').style.display = 'flex'; }
      await ontHaalIce();
      if (ontPc){ try { ontPc.close(); } catch(e){} }
      ontPc = new RTCPeerConnection({ iceServers: ontIce || [{ urls:'stun:stun.l.google.com:19302' }] });
      ontPc.ontrack = e => { $('#ontLiveVid').srcObject = e.streams[0]; $('#ontLiveStatus').textContent = T('bo.ontlivenu','Live beeld en geluid van het lid.'); };
      ontPc.onicecandidate = e => { if (e.candidate) call('/office/ontmoeting/signaal', { dateId: d.dateId, naarKey: d.van, payload: { ice: e.candidate } }).catch(()=>{}); };
      await ontPc.setRemoteDescription(new RTCSessionDescription(d.payload.sdp));
      const ans = await ontPc.createAnswer();
      await ontPc.setLocalDescription(ans);
      await call('/office/ontmoeting/signaal', { dateId: d.dateId, naarKey: d.van, payload: { sdp: ontPc.localDescription } });
    } else if (d.payload.ice && ontPc){
      try { await ontPc.addIceCandidate(new RTCIceCandidate(d.payload.ice)); } catch(e){}
    }
  }
  document.getElementById('ontLiveClose').addEventListener('click', ontLiveSluit);

  let convData = [], convUser = null;
  async function loadConcierge(){
    try { convData = (await call('/office/conversations')).conversations || []; } catch(e){ return; }
    $('#concierge').innerHTML = convData.length ? convData.map(c =>
      '<div class="vrow" data-uid="'+c.userId+'"><div class="vi"><div class="nm">'+escHtml(c.codename)+
        ' <span style="color:var(--soft);font-weight:400;font-size:0.72rem;">· '+escHtml(c.tier)+'</span>'+
        (c.needsConcierge?' <span class="pill nieuw">'+T('bo.waiting','wacht')+'</span>':'')+'</div>'+
        '<div class="sub">'+(c.lastFrom==='concierge'?'↩ ':'')+escHtml((c.last||'').slice(0,55))+'</div></div>'+
        '<button class="vbtn ok" data-open>'+T('bo.open','Open')+'</button></div>'
    ).join('') : '<div class="empty">'+T('bo.noconv','Nog geen gesprekken.')+'</div>';
    $('#concierge').querySelectorAll('.vrow').forEach(row =>
      row.querySelector('[data-open]').addEventListener('click', () => openThread(Number(row.dataset.uid))));
    if (convUser && $('#convScrim').classList.contains('open')) openThread(convUser);
  }
  // Vertrouwenslijn: personeel van partners bereikt hier vertrouwelijk de
  // vertrouwenspersoon van RTG; de werkgever ziet deze gesprekken nooit.
  let trustData = [], trustId = null;
  async function loadTrust(){
    try { trustData = (await call('/office/trust')).threads || []; } catch(e){ return; }
    $('#trustList').innerHTML = trustData.length ? trustData.map(t =>
      '<div class="vrow"><div class="vi"><div class="nm">'+escHtml(t.name)+' <span style="color:var(--soft);font-weight:400;font-size:0.72rem;">· '+escHtml(t.company)+'</span>'+
      (t.open?' <span class="pill nieuw">'+T('bo.waiting','wacht')+'</span>':'')+'</div>'+
      '<div class="sub">'+escHtml(((t.messages[t.messages.length-1]||{}).text||'').slice(0,55))+'</div></div>'+
      '<button class="vbtn ok" data-trust="'+t.id+'">'+T('bo.open','Open')+'</button></div>'
    ).join('') : '<div class="empty">'+T('bo.notrust','Geen berichten. De vertrouwenslijn is er voor het personeel van partners; werkgevers zien hier niets van.')+'</div>';
    $('#trustList').querySelectorAll('[data-trust]').forEach(b => b.addEventListener('click', () => openTrustThread(b.dataset.trust)));
    if (trustId && $('#convScrim').classList.contains('open')) openTrustThread(trustId);
  }
  function openTrustThread(id){
    const t = trustData.find(x => x.id === id); if (!t) return;
    trustId = id; convUser = null;
    $('#convWho').textContent = '' + t.name + ' · ' + t.company;
    $('#convBody').innerHTML = t.messages.map(m =>
      '<div class="cmsg '+(m.from==='staff'?'in':'out')+'">'+escHtml(m.text)+'</div>').join('');
    $('#convScrim').classList.add('open');
    setTimeout(()=>{ const b=$('#convBody'); b.scrollTop=b.scrollHeight; }, 30);
  }

  function openThread(uid){
    const c = convData.find(x => x.userId === uid); if (!c) return;
    convUser = uid;
    trustId = null;
    $('#convWho').textContent = c.codename + ' · ' + c.tier;
    $('#convBody').innerHTML = c.messages.map(m =>
      '<div class="cmsg '+(m.from==='member'?'in':'out')+'">'+escHtml(m.text)+'</div>'
    ).join('');
    $('#convScrim').classList.add('open');
    setTimeout(()=>{ const b=$('#convBody'); b.scrollTop=b.scrollHeight; }, 30);
  }
  $('#convClose').addEventListener('click', () => { $('#convScrim').classList.remove('open'); trustId = null; });
  $('#convScrim').addEventListener('click', () => { $('#convScrim').classList.remove('open'); trustId = null; });
  $('#convReply').addEventListener('submit', async e => {
    e.preventDefault();
    const t = $('#convText').value.trim(); if (!t) return;
    if (trustId){
      try { await call('/office/trust/reply', { id: trustId, text: t }); $('#convText').value=''; await loadTrust(); openTrustThread(trustId); refresh(); }
      catch(e2){ alert(e2.message); }
      return;
    }
    if (!convUser) return;
    try { convData = (await call('/office/reply', { userId: convUser, text: t })).conversations || convData; $('#convText').value=''; openThread(convUser); loadConcierge(); }
    catch(e2){ alert(e2.message); }
  });

  function render(){
    const st2 = state.stats || {};
    const alerts = state.alerts || [];
    // globale zoekfilter: een veld dat door alle lijsten heen zoekt
    const q = (($('#zoekInp')||{}).value || '').trim().toLowerCase();
    const past = function(){ return !q || [].slice.call(arguments).join(' ').toLowerCase().includes(q); };
    $('#stat').innerHTML =
      '<div class="b"><div class="l">'+T('bo.partners','Partners')+'</div><div class="v">'+state.suppliers.length+'</div></div>' +
      '<div class="b"><div class="l">'+T('bo.livenu','Nu onderweg')+'</div><div class="v">'+(st2.liveNu||0)+'</div></div>' +
      '<div class="b"><div class="l">'+T('bo.today','Vandaag')+'</div><div class="v a">'+(st2.aantalVandaag||0)+' · '+eur(st2.omzetVandaag||0)+'</div></div>' +
      '<div class="b"><div class="l">'+T('bo.weekrev','Weekomzet')+'</div><div class="v g">'+eur(st2.omzetWeek||0)+'</div></div>' +
      '<div class="b"><div class="l">RTFoundation</div><div class="v g">'+eur(st2.foundation||0)+'</div></div>' +
      (st2.fondsAfdracht ? '<div class="b"><div class="l">'+T('bo.rtfteStorten','RTF af te dragen')+'</div><div class="v'+(st2.fondsAfdracht.teStorten>0 && !st2.fondsAfdracht.iban?' a':' g')+'">'+eur(st2.fondsAfdracht.teStorten||0)+'</div><div class="sub">'+(st2.fondsAfdracht.iban?(T('bo.rtfNaar','naar')+' '+escHtml(st2.fondsAfdracht.iban)):T('bo.rtfGeenIban','IBAN nog niet ingesteld'))+'</div></div>' : '') +
      (st2.muntOntvangst && st2.muntOntvangst.aan ? '<div class="b"><div class="l">'+T('bo.munt','Munten (in euro)')+'</div><div class="v g">'+eur(st2.muntOntvangst.ontvangen||0)+'</div>'+(st2.muntOntvangst.wacht?'<div class="sub">'+st2.muntOntvangst.wacht+' '+T('bo.muntWacht','openstaand')+'</div>':'')+'</div>' : '') +
      '<div class="b"><div class="l">'+T('bo.actions','Open acties')+'</div><div class="v'+(alerts.some(a=>a.level==='rood')?' a':'')+'">'+alerts.length+'</div></div>';

    // actiecentrum: vastgelopen zaken bovenaan, met een herinneringsknop
    $('#alertList').innerHTML = alerts.length ? alerts.map(a => {
      const koeling = a.nudgedAt && (Date.now() - new Date(a.nudgedAt)) < 10*60000;
      const knop = (a.kind === 'order' || a.kind === 'ride')
        ? (koeling ? '<span class="pill klaar">'+T('bo.nudged','herinnerd')+'</span>'
                   : '<button class="vbtn ok" data-nudge="'+a.ref+'" data-nkind="'+a.kind+'">'+T('bo.nudge','Stuur herinnering')+'</button>')
        : '';
      return '<div class="alert '+a.level+'"><span class="lv"></span><div class="tx">'+escHtml(a.text)+'</div>'+knop+'</div>';
    }).join('') : '<div class="empty">✓ '+T('bo.noalerts','Alles loopt. Vastgelopen bestellingen, wachtende leden en open beoordelingen verschijnen hier vanzelf.')+'</div>';
    $('#alertList').querySelectorAll('[data-nudge]').forEach(b => b.addEventListener('click', async () => {
      b.disabled = true;
      try { await call('/office/nudge', { ref: b.dataset.nudge, kind: b.dataset.nkind }); await refresh(); }
      catch(e){ alert(e.message); b.disabled = false; }
    }));

    // partnerprestaties: omzetranglijst met open werk en gemiddelde ritduur
    const perf = state.performance || [];
    const maxOmzet = Math.max.apply(null, perf.map(p=>p.omzet).concat([1]));
    const medaille = ['1.','2.','3.'];
    $('#perfList').innerHTML = perf.length ? perf.filter(p => past(p.name, p.code, p.type)).map((p, i) =>
      '<div class="row"><div class="r1"><div style="flex:1;min-width:0;"><div class="nm">'+(medaille[i]||'')+' '+p.name+
        ' <span style="color:var(--soft);font-weight:400;font-size:0.72rem;">· '+p.code+'</span></div>'+
        '<div class="sub">'+p.aantal+' '+T('bo.trans','transactie(s)')+' · '+p.openNu+' '+T('bo.opennow','nu open')+
        (p.gemMin!=null?' · Ø '+p.gemMin+' '+T('bo.minride','min per rit'):'')+'</div>'+
        '<div class="perfbar"><i style="width:'+Math.max(2, Math.round(p.omzet/maxOmzet*100))+'%;"></i></div></div>'+
        '<div class="amt g">'+eur(p.omzet)+'</div></div></div>'
    ).join('') : '<div class="empty">'+T('bo.noperf','Nog geen partnercijfers.')+'</div>';

    // omzet per dag: de laatste zeven dagen als staafjes, vandaag uitgelicht
    const wk = state.week || [];
    const maxDag = Math.max.apply(null, wk.map(d=>d.omzet).concat([1]));
    $('#weekChart').innerHTML = wk.map((d, i) =>
      '<div class="cb'+(i===wk.length-1?' vandaag':'')+'" title="'+d.aantal+' '+T('bo.trans','transactie(s)')+'">'+
      '<b>'+(d.omzet?eur(d.omzet):'·')+'</b><i style="height:'+Math.max(2, Math.round(d.omzet/maxDag*72))+'%;"></i><span>'+d.label+'</span></div>'
    ).join('');

    const live = (state.live || []).filter(g => past(g.codename, (g.dest&&g.dest.name)||'', (g.partners||[]).join(' ')));
    $('#liveList').innerHTML = live.length ? live.map(g =>
      '<div class="row"><div class="r1"><div><div class="nm">'+escHtml(g.codename)+
        (g.dest?' <span style="color:var(--soft);font-weight:400;">· '+T('bo.to','naar')+' '+escHtml(g.dest.name)+'</span>':'')+'</div>'+
        '<div class="sub">'+(g.arrived?'✓ '+T('bo.arrived','gearriveerd'):T('bo.onthemove','onderweg')+' ('+T('bo.mode.'+g.mode, g.mode==='walking'?'lopend':g.mode==='flying'?'vliegend':'rijdend')+')')+
        ' · '+escHtml((g.partners||[]).join(', '))+'</div></div>'+
        '<span class="pill '+(g.arrived?'klaar':'bereiding')+'">'+(g.arrived?T('bo.arrived','gearriveerd'):T('bo.live','live'))+'</span></div></div>'
    ).join('') : '<div class="empty">'+T('bo.nolive','Niemand is nu onderweg. Zodra een lid een reis live zet, ziet u hier waar zij zijn en met welke partners.')+'</div>';

    const prijzen = state.prices.filter(p => past(p.supplierName, p.service));
    $('#prices').innerHTML = prijzen.length ? prijzen.map(p =>
      '<div class="row"><div class="r1"><div><div class="nm">'+escHtml(p.supplierName)+'</div><div class="sub">'+escHtml(p.service)+' · '+timeAgo(p.at)+'</div></div><div class="amt g">'+eur(p.price)+'</div></div></div>'
    ).join('') : '<div class="empty">'+T('bo.noprices','Nog geen prijzen. Zodra een partner een dynamische prijs doorgeeft, verschijnt die hier live.')+'</div>';

    // tijdlijn (bestellingen & ritten) komt gepagineerd van de server
    renderTimeline();
    const totals = state.totals || {};
    $('#liveTot').textContent = totals.live > (state.live || []).length ? (state.live || []).length + ' ' + T('bo.van', 'van') + ' ' + totals.live : '';

    const apps = (state.applications || []).filter(x => past(x.name, x.func, x.company));
    $('#appsList').innerHTML = apps.length ? apps.map(x => {
      const pc = x.status==='nieuw'?'nieuw':x.status==='aangenomen'?'klaar':'bereiding';
      const st = x.status==='nieuw'?T('bo.ap.new','nieuw'):x.status==='aangenomen'?T('bo.ap.hired','aangenomen'):T('bo.ap.rejected','afgewezen');
      return '<div class="row"><div class="r1"><div><div class="nm">'+escHtml(x.name)+' <span style="color:var(--soft);font-weight:400;">· '+escHtml(x.func)+'</span>'+
        (x.viaRTG?' <span style="font-size:0.58rem;letter-spacing:0.08em;color:var(--rtg-leesgoud,var(--gold));border:1px solid var(--gold);border-radius:0;padding:0.1rem 0.45rem;vertical-align:middle;">RTG</span>':'')+'</div>'+
        '<div class="sub">'+escHtml(x.company)+' · '+timeAgo(x.at)+'</div></div>'+
        '<span class="pill '+pc+'">'+st+'</span></div></div>';
    }).join('') : '<div class="empty">'+T('bo.noapps','Nog geen sollicitaties. Kandidaten solliciteren via de partner-apps, RTG-leden via de leden-app met hun cv.')+'</div>';

    const pas = (state.partnerApplications || []).filter(x => past(x.company, x.type, x.city, x.contactName,
      x.registratie && (x.registratie.nummer || x.registratie.kvkNummer), x.registratie && x.registratie.landNaam));
    $('#paList').innerHTML = pas.length ? pas.map(x => {
      const pc = x.status==='nieuw'?'nieuw':x.status==='goedgekeurd'?'klaar':'bereiding';
      const st = x.status==='nieuw'?T('bo.pa.new','nieuw'):x.status==='goedgekeurd'?T('bo.pa.ok','goedgekeurd'):T('bo.pa.no','afgewezen');
      const toel = x.toelating || null;
      const eisen = toel && Array.isArray(toel.eisen) ? toel.eisen : [];
      const eisKlaar = e => ['geverifieerd','niet_van_toepassing'].includes(e.status) &&
        !(e.gecontroleerd&&e.gecontroleerd.geldigTot&&Date.parse(e.gecontroleerd.geldigTot)<Date.now());
      const open = eisen.filter(e => !eisKlaar(e));
      const controleHtml = toel ? '<div style="display:grid;gap:.3rem;margin-top:.55rem;">'+eisen.map(e => {
        const klaar = eisKlaar(e);
        const verlopen = e.status==='geverifieerd'&&!klaar;
        const referentie = e.gecontroleerd && e.gecontroleerd.referentie || e.referentie || '';
        return '<div style="border-left:2px solid '+(klaar?'var(--green)':e.status==='afgekeurd'?'#df6b7d':'var(--gold)')+';padding-left:.55rem;">'+
          '<div class="sub"><b style="color:var(--text)">'+(klaar?'✓ ':e.status==='afgekeurd'?'✕ ':'○ ')+escHtml(e.label)+'</b> · '+escHtml(e.status)+
          (verlopen?' · verlopen':'')+(referentie?' · '+escHtml(referentie):'')+'</div>'+
          (x.status==='nieuw'&&!klaar?'<div style="display:flex;gap:.3rem;margin-top:.25rem;"><button class="vbtn ok" data-pactl="'+x.id+'" data-paeis="'+e.id+'">'+T('bo.pa.check','Controleren')+'</button>'+
            (e.magNietVanToepassing?'<button class="vbtn" data-panvt="'+x.id+'" data-paeis="'+e.id+'">N.v.t.</button>':'')+'</div>':'')+'</div>';
      }).join('')+'</div>' : '<div class="sub" style="color:#df6b7d;margin-top:.45rem;">Oude aanvraag zonder toelatingsdossier · opnieuw laten aanvragen</div>';
      const reg = x.registratie || {};
      const pre = reg.voorcontrole || {};
      const regNummer = reg.nummer || reg.kvkNummer || '';
      const regTitel = (reg.landNaam || (reg.kvkNummer ? 'Nederland' : '')) + (reg.regioOfStaat ? ' · ' + reg.regioOfStaat : '');
      return '<div class="row"><div class="r1"><div><div class="nm">'+escHtml(x.company)+' <span style="color:var(--soft);font-weight:400;">· '+escHtml(x.type)+' · '+escHtml(x.city)+'</span></div>'+
        '<div class="sub">'+escHtml(x.contactName)+' · '+escHtml(x.email)+(x.phone?' · '+escHtml(x.phone):'')+' · '+timeAgo(x.at)+
          (regNummer?'<br>'+escHtml(regTitel)+' · registratie '+escHtml(regNummer)+(reg.vestigingsnummer?' · vestiging '+escHtml(reg.vestigingsnummer):'')+' · voorcontrole '+escHtml(pre.status||'handmatig'):'')+
          (reg.registerBron?'<br><a href="'+escHtml(reg.registerBron)+'" target="_blank" rel="noopener">Open officieel register</a>':'')+
          (x.note?'<br>"'+escHtml(x.note.slice(0,120))+'"':'')+(x.code?' · code '+escHtml(x.code):'')+'</div>'+controleHtml+'</div>'+
        (x.status==='nieuw'
          ? '<div style="display:flex;gap:0.4rem;flex-shrink:0;align-items:flex-start;">'+(toel&&open.length===0?'<button class="vbtn ok" data-paok="'+x.id+'">'+T('bo.pa.approve','Goedkeuren')+'</button>':'<span class="pill nieuw">'+(toel?open.length+' open':'geblokkeerd')+'</span>')+'<button class="vbtn" data-pano="'+x.id+'">'+T('bo.pa.reject','Afwijzen')+'</button></div>'
          : '<span class="pill '+pc+'">'+st+'</span>')+
        '</div></div>';
    }).join('') : '<div class="empty">'+T('bo.nopa','Nog geen aanvragen. Bedrijven melden zich aan via de pagina "Partner worden" op de site.')+'</div>';
    document.querySelectorAll('[data-pactl]').forEach(b => b.addEventListener('click', async () => {
      const referentie = prompt('Welke officiële bron, registerverwijzing of controle-uitkomst is geraadpleegd?');
      if (!referentie || referentie.trim().length < 3) return;
      const geldigTot = prompt('Geldig tot (JJJJ-MM-DD), of laat leeg als dit niet van toepassing is:') || '';
      try { await call('/office/partner/controle', { id:b.dataset.pactl, onderdeel:b.dataset.paeis, uitkomst:'geverifieerd', referentie, geldigTot }); await refresh(); }
      catch(e){ alert(e.message); }
    }));
    document.querySelectorAll('[data-panvt]').forEach(b => b.addEventListener('click', async () => {
      const reden = prompt('Waarom is dit controleonderdeel aantoonbaar niet van toepassing?');
      if (!reden || reden.trim().length < 3) return;
      try { await call('/office/partner/controle', { id:b.dataset.panvt, onderdeel:b.dataset.paeis, uitkomst:'niet_van_toepassing', referentie:reden }); await refresh(); }
      catch(e){ alert(e.message); }
    }));
    document.querySelectorAll('[data-paok]').forEach(b => b.addEventListener('click', async () => {
      try {
        const d = await call('/office/partner/decide', { id: b.dataset.paok, action: 'goedkeuren' });
        const box = $('#paResult');
        box.style.display = 'block';
        box.innerHTML = '✓ '+T('bo.pa.done','Goedgekeurd. Geef dit eenmalig door (staat ook in de welkomstmail):')+
          '<br><b>'+T('bo.pa.code','Leverancierscode')+': '+d.code+'</b> · <b>'+T('bo.pa.pin','Manager-PIN')+': '+d.pin+'</b>';
        await refresh();
      } catch(e){ alert(e.message); }
    }));
    document.querySelectorAll('[data-pano]').forEach(b => b.addEventListener('click', async () => {
      const reden = prompt('Waarom wordt deze aanvraag afgewezen? Dit komt in het beslisspoor en in de e-mail aan de aanvrager.');
      if (!reden || reden.trim().length < 3) return;
      try { await call('/office/partner/decide', { id: b.dataset.pano, action: 'afwijzen', reden }); await refresh(); } catch(e){ alert(e.message); }
    }));

    /* De catalogus-wensen uit de onboarding. Eigen route en niet uit de
       kantoorstaat: hij hoort bij de ondernemerskant en die staat apart
       (routes/office/ondernemers.js). Op CODENAAM -- de echte naam ligt in de
       kluis en hoort niet in een lijst. */
    renderCatalogusWensen();

    /* De reisbalie en de instellingen. Ook eigen routes: het aanbod en de
       instellingen staan niet in de kantoorstaat, want ze horen bij een andere
       kamer (routes/kantoren/reizen.js en routes/office/instellingen.js). */
    renderReisaanbod();
    renderReisaanvragen();
    renderInstellingen();

    // schoolaanmeldingen: een school kan pas personeel toelaten en klassen maken
    // nadat RTG hem hier goedkeurt
    const scholen = (state.pendingSchools || []).filter(x => past(x.naam, x.code, x.plaats));
    $('#schoolList').innerHTML = scholen.length ? scholen.map(x =>
      '<div class="row"><div class="r1"><div><div class="nm">'+escHtml(x.naam)+' <span style="color:var(--soft);font-weight:400;">· '+escHtml(x.plaats||'')+'</span></div>'+
        '<div class="sub">'+T('bo.sc.code','code')+' '+escHtml(x.code)+' · '+x.personeel+' '+T('bo.sc.staff','aanmelding(en) personeel')+' · '+timeAgo(x.at)+'</div></div>'+
        '<div style="display:flex;gap:0.4rem;flex-shrink:0;"><button class="vbtn ok" data-scok="'+escHtml(x.code)+'">'+T('bo.sc.approve','Goedkeuren')+'</button><button class="vbtn" data-scno="'+escHtml(x.code)+'">'+T('bo.sc.reject','Afwijzen')+'</button></div>'+
      '</div></div>'
    ).join('') : '<div class="empty">'+T('bo.nosc','Geen wachtende schoolaanmeldingen. Scholen melden zich aan via de RTFoundation-app; hier keurt u ze goed voordat ze personeel en klassen kunnen aanmaken.')+'</div>';
    document.querySelectorAll('[data-scok]').forEach(b => b.addEventListener('click', async () => {
      try { await call('/office/school/decide', { code: b.dataset.scok, action: 'goedkeuren' }); await refresh(); } catch(e){ alert(e.message); }
    }));
    document.querySelectorAll('[data-scno]').forEach(b => b.addEventListener('click', async () => {
      try { await call('/office/school/decide', { code: b.dataset.scno, action: 'afwijzen' }); await refresh(); } catch(e){ alert(e.message); }
    }));
  }


  /* De wensen om in de catalogus te komen. Een besluit maakt hier GEEN zaak: dat
     blijft de partner-aanvraag, met ledenbewijs. Wat hier gebeurt is bijhouden
     dat er iemand naar gekeken heeft, en wie. De pas staat erbij omdat je wilt
     weten met wie je spreekt -- niet als drempel: elk lid met een pas mag een
     bedrijf aanmelden. */
  async function renderCatalogusWensen(){
    const el = $('#cwList'); if (!el) return;
    let d = null; try { d = await call('/office/catalogus-wensen'); } catch(e){ return; }
    const rij = (d && d.wensen) || [];
    el.innerHTML = rij.length ? rij.map(function(w){
      const st = w.besluit === 'opgepakt' ? T('bo.cw.ok','opgepakt')
        : w.besluit === 'afgewezen' ? T('bo.cw.no','afgewezen') : null;
      const passen = { rtg: T('bo.cw.rtg','RTG Pass'), lifestyle: T('bo.cw.ls','Lifestyle Pass'), business: T('bo.cw.bp','Business Pass') };
      const pas = passen[w.pas]
        ? '<span class="pill klaar">'+passen[w.pas]+'</span>'
        : '<span class="pill">'+T('bo.cw.geenpas','pas onbekend')+'</span>';
      return '<div class="row"><div class="r1"><div><div class="nm">'+escHtml(w.naam)+' '+pas+'</div>'+
        '<div class="sub">'+escHtml(w.eigenaar||'')+' · '+timeAgo(w.gevraagd)+
          (w.door?' · '+T('bo.cw.door','door')+' '+escHtml(w.door):'')+
          (w.notitie?'<br>"'+escHtml(w.notitie.slice(0,120))+'"':'')+'</div></div>'+
        (st ? '<span class="pill '+(w.besluit==='opgepakt'?'klaar':'bereiding')+'">'+st+'</span>'
            : '<div style="display:flex;gap:0.4rem;flex-shrink:0;"><button class="vbtn ok" data-cwok="'+escHtml(w.id)+'">'+T('bo.cw.pak','Opgepakt')+'</button><button class="vbtn" data-cwno="'+escHtml(w.id)+'">'+T('bo.cw.wijs','Afwijzen')+'</button></div>')+
        '</div></div>';
    }).join('') : '<div class="empty">'+T('bo.nocw','Nog geen bedrijven uit de onboarding. Leden geven bij het aanmelden op of ze er een hebben.')+'</div>';
    document.querySelectorAll('[data-cwok]').forEach(function(b){
      b.addEventListener('click', async function(){
        try { await call('/office/catalogus-wens/besluit', { id: b.dataset.cwok, besluit: 'opgepakt' }); renderCatalogusWensen(); }
        catch(e){ alert(e.message); }
      });
    });
    document.querySelectorAll('[data-cwno]').forEach(function(b){
      b.addEventListener('click', async function(){
        // afwijzen vraagt een reden: een deur die dichtgaat krijgt een grond
        const reden = prompt(T('bo.cw.reden','Waarom wijst u deze wens af?'));
        if (!reden) return;
        try { await call('/office/catalogus-wens/besluit', { id: b.dataset.cwno, besluit: 'afgewezen', notitie: reden }); renderCatalogusWensen(); }
        catch(e){ alert(e.message); }
      });
    });
  }
  /* DE REISBALIE EN DE INSTELLINGEN -- twee kantoorschermen voor twee deuren die
     er wel waren maar nergens op uitkwamen.

     De reisbalie: het reisbureau LAS db.data.partnerTrips en niemand schreef
     erin, dus een echte installatie had nul reizen en elke aanvraag gaf 404. En
     de aanvraag-routes bestonden al maar hadden geen enkel scherm -- een
     besluit dat je nergens kunt nemen is er geen.

     De instellingen: gemeente, luchthaven, vervoerder en de andere interne
     genres komen niet via het partnerformulier binnen, en kwamen dus alleen uit
     de demo. Aansluiten is boardroomwerk (het maakt een bedrijfscode en een
     beheer-inlog), de lijst mag het hele kantoor zien.

     Alles op één plek omdat het één soort werk is: kantoor dat iets NEERZET in
     plaats van iets beoordeelt. */

  const euro = (n) => (lang() === 'en' ? 'EUR ' : '€ ') +
    Number(n || 0).toLocaleString(lang() === 'en' ? 'en-US' : 'nl-NL', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

  async function renderReisaanbod(){
    const el = $('#raList'); if (!el) return;
    let d = null; try { d = await call('/office/reisaanbod'); } catch(e){ return; }
    const rij = (d && d.reizen) || [];
    el.innerHTML = rij.length ? rij.map(function(r){
      const open = r.openAanvragen
        ? '<span class="pill bereiding">'+r.openAanvragen+' '+T('ra.open','open')+'</span>' : '';
      return '<div class="row"><div class="r1"><div><div class="nm">'+escHtml(r.titel)+' '+open+'</div>'+
        '<div class="sub">'+escHtml(r.bestemming)+' · '+euro(r.netto)+' '+T('ra.pp','p.p.')+
          (r.dates ? ' · '+escHtml(r.dates) : '')+
          (r.door ? ' · '+T('ra.door','door')+' '+escHtml(r.door) : '')+
          (r.desc ? '<br>'+escHtml(r.desc.slice(0,140)) : '')+'</div></div>'+
        '<div style="display:flex;gap:0.4rem;flex-shrink:0;"><button class="vbtn" data-raweg="'+escHtml(r.id)+'">'+T('ra.weg','Uit het aanbod')+'</button></div>'+
      '</div></div>';
    }).join('') : '<div class="empty">'+T('bo.nora','Nog geen reizen in het aanbod. Zolang hier niets staat, is het reisbureau voor leden leeg en kan er niets worden aangevraagd.')+'</div>';
    document.querySelectorAll('[data-raweg]').forEach(function(b){
      b.addEventListener('click', async function(){
        try { await call('/office/reisaanbod/weg', { id: b.dataset.raweg }); renderReisaanbod(); }
        catch(e){ alert(e.message); }
      });
    });
  }

  /* Neerzetten. `includes` komt als één regel binnen met puntkomma's ertussen:
     dat is sneller typen dan een lijstje bouwen, en de server knipt en snoeit. */
  function reisaanbodKnop(){
    const knop = $('#raZet'); if (!knop) return;
    knop.addEventListener('click', async function(){
      const incl = ($('#raIncl').value || '').split(';').map(function(x){ return x.trim(); }).filter(Boolean);
      try {
        await call('/office/reisaanbod/zet', {
          titel: $('#raTitel').value, bestemming: $('#raBestemming').value,
          netto: ($('#raNetto').value || '').replace(',', '.'),
          dates: $('#raDates').value, desc: $('#raDesc').value, includes: incl
        });
        ['raTitel','raBestemming','raNetto','raDates','raDesc','raIncl'].forEach(function(id){ $('#'+id).value = ''; });
        renderReisaanbod();
      } catch(e){ alert(e.message); }
    });
  }

  /* De aanvragen van leden. Bevestigen zet de reis in hun dossier op bevestigd,
     afwijzen haalt hem eruit -- en dat laatste vraagt een reden, zoals elke
     deur die dichtgaat in dit huis. */
  async function renderReisaanvragen(){
    const el = $('#rbList'); if (!el) return;
    let d = null; try { d = await call('/office/reisbureau'); } catch(e){ return; }
    const rij = (d && d.aanvragen) || [];
    el.innerHTML = rij.length ? rij.map(function(a){
      const af = a.status !== 'aangevraagd';
      const stand = a.status === 'bevestigd' ? T('rb.ok','bevestigd')
        : a.status === 'afgewezen' ? T('rb.no','afgewezen')
        : a.status === 'geannuleerd' ? T('rb.an','ingetrokken') : null;
      return '<div class="row"><div class="r1"><div><div class="nm">'+escHtml(a.titel || a.bestemming)+'</div>'+
        '<div class="sub">'+escHtml(a.codename || '')+' · '+a.personen+' '+T('rb.pers','p.')+
          (a.vertrek ? ' · '+escHtml(a.vertrek) : '')+' · '+escHtml(a.ref)+' · '+timeAgo(a.at)+
          (a.besluit && a.besluit.door ? ' · '+T('rb.door','door')+' '+escHtml(a.besluit.door) : '')+
          (a.besluit && a.besluit.reden ? '<br>"'+escHtml(a.besluit.reden.slice(0,120))+'"' : '')+'</div></div>'+
        (af ? '<span class="pill '+(a.status==='bevestigd'?'klaar':'bereiding')+'">'+escHtml(stand || a.status)+'</span>'
            : '<div style="display:flex;gap:0.4rem;flex-shrink:0;"><button class="vbtn ok" data-rbok="'+escHtml(a.ref)+'">'+T('rb.bev','Bevestigen')+'</button><button class="vbtn no" data-rbno="'+escHtml(a.ref)+'">'+T('rb.wijs','Afwijzen')+'</button></div>')+
      '</div></div>';
    }).join('') : '<div class="empty">'+T('bo.norb','Nog geen reisaanvragen. Leden vragen een reis aan in het reisbureau; hier bevestigt u de datum of wijst u af.')+'</div>';
    document.querySelectorAll('[data-rbok]').forEach(function(b){
      b.addEventListener('click', async function(){
        try { await call('/office/reisbureau/bevestig', { ref: b.dataset.rbok }); renderReisaanvragen(); }
        catch(e){ alert(e.message); }
      });
    });
    document.querySelectorAll('[data-rbno]').forEach(function(b){
      b.addEventListener('click', async function(){
        const reden = prompt(T('rb.reden','Waarom wijst u deze aanvraag af?'));
        if (!reden) return;
        try { await call('/office/reisbureau/afwijzen', { ref: b.dataset.rbno, reden: reden }); renderReisaanvragen(); }
        catch(e){ alert(e.message); }
      });
    });
  }

  /* De instellingen. De keuzelijst komt van de server en dus uit het
     genre-register: wie daar een genre op 'intern' zet, ziet het hier vanzelf
     verschijnen zonder dat dit bestand iets weet. */
  async function renderInstellingen(){
    const el = $('#instList'); if (!el) return;
    let d = null; try { d = await call('/office/instellingen'); } catch(e){ return; }
    const rij = (d && d.instellingen) || [];
    el.innerHTML = rij.length ? rij.map(function(i){
      const stand = i.online
        ? '<span class="pill klaar">'+T('inst.on','online')+'</span>'
        : '<span class="pill bereiding">'+T('inst.off','offline')+'</span>';
      return '<div class="row"><div class="r1"><div><div class="nm">'+escHtml(i.naam)+' '+stand+
          (i.demo ? ' <span class="pill">'+T('inst.demo','demo')+'</span>' : '')+'</div>'+
        '<div class="sub">'+escHtml(i.genre)+' · '+escHtml(i.plaats || '')+' · '+escHtml(i.code)+
          (i.door ? ' · '+T('inst.door','aangesloten door')+' '+escHtml(i.door) : '')+'</div></div>'+
      '</div></div>';
    }).join('') : '<div class="empty">'+T('bo.noinst','Nog geen instellingen aangesloten. Zolang er geen gemeente, luchthaven of vervoerder hangt, staan die werelden voor leden leeg.')+'</div>';

    const keuze = $('#instGenre');
    if (keuze && !keuze.options.length) {
      let g = null; try { g = await call('/office/instelling/genres'); } catch(e){ return; }
      keuze.innerHTML = ((g && g.genres) || []).map(function(x){
        return '<option value="'+escHtml(x.id)+'">'+escHtml(x.label)+'</option>';
      }).join('');
    }
  }

  function instellingKnop(){
    const knop = $('#instZet'); if (!knop) return;
    knop.addEventListener('click', async function(){
      const box = $('#instResult');
      try {
        const d = await call('/office/instelling/aansluiten', {
          genre: $('#instGenre').value, naam: $('#instNaam').value,
          plaats: $('#instPlaats').value, beheerder: $('#instBeheerder').value
        });
        // de code en de PIN gaan hier één keer over het scherm; daarna nergens meer
        box.style.display = 'block';
        box.innerHTML = '✓ '+escHtml(d.vervolg || '')+
          '<br><b>'+T('inst.code','Bedrijfscode')+': '+escHtml(d.code)+'</b> · <b>'+T('inst.pin','Beheer-PIN')+': '+escHtml(d.pin)+'</b>';
        ['instNaam','instPlaats','instBeheerder'].forEach(function(id){ $('#'+id).value = ''; });
        renderInstellingen();
      } catch(e){ alert(e.message); }
    });
  }
  // De tijdlijn is schaalvast: de server bladert en zoekt door de volledige
  // historie; het scherm toont altijd 25 regels plus het eerlijke totaal.
  async function laadTimeline(){
    try { tl = await call('/office/timeline', { page: tlPage, q: ($('#zoekInp').value || '').trim() }); }
    catch(e){ tl = { items: [], total: 0, page: 1, pages: 1 }; }
    renderTimeline();
  }
  function renderTimeline(){
    if (!tl) return;
    const KLAAR_R = { 'afgerond':1, 'gearriveerd':1, 'geweigerd':1, 'geserveerd':1, 'terugbetaald':1, 'klaar':1 };
    $('#tlTot').textContent = '(' + tl.total.toLocaleString(lang()==='en'?'en-US':'nl-NL') + ')';
    $('#orders').innerHTML = tl.items.length ? tl.items.map(x => {
      const pc = (x.status==='nieuw'||x.status==='aangevraagd')?'nieuw':KLAAR_R[x.status]?'klaar':'bereiding';
      const icoon = x.soort==='order'?'hotel':x.soort==='jet'?'✈':'auto';
      return '<div class="row"><div class="r1"><div><div class="nm">'+escHtml(x.supplierName)+' <span style="color:var(--soft);font-weight:400;">· '+T('bo.guest','gast')+' '+escHtml(x.customerCodename)+'</span></div>'+
        '<div class="sub">'+icoon+' '+escHtml(x.sub||'')+' · '+timeAgo(x.at)+(x.when?' · '+escHtml(x.when):'')+' · '+(x.paid?T('bo.paid','betaald'):T('bo.unpaid','onbetaald'))+'</div></div>'+
        '<div style="text-align:right;"><div class="amt">'+eur(x.bedrag)+'</div><span class="pill '+pc+'">'+tStatus(x.status)+'</span></div></div></div>';
    }).join('') : '<div class="empty">'+T('bo.noorders','Nog geen bestellingen of ritten via partners.')+'</div>';
    const pager = $('#tlPager');
    pager.style.display = tl.pages > 1 ? 'flex' : 'none';
    $('#tlWaar').textContent = T('bo.pagina','Pagina') + ' ' + tl.page + ' / ' + tl.pages;
    $('#tlPrev').disabled = tl.page <= 1;
    $('#tlNext').disabled = tl.page >= tl.pages;
  }
  $('#tlPrev').addEventListener('click', () => { if (tlPage > 1){ tlPage--; laadTimeline(); } });
  $('#tlNext').addEventListener('click', () => { if (tl && tlPage < tl.pages){ tlPage++; laadTimeline(); } });

  /* Meenemen (shared/uitvoer.js): de tijdlijn kent zijn eigen velden, dus geeft
     het kantoor die door in plaats van de gedeelde laag de rijen van het scherm
     te laten plukken -- daar staat "hotel 2 item(s) · 3 u geleden" in een regel,
     hier staan partner, gast, bedrag en status als losse kolommen. Dit is de
     pagina die u OPEN hebt (25 regels, uw zoekterm); de knop CSV hiernaast
     blijft wat hij was: de hele historie, door de server gebouwd. De gast staat
     er met zijn codenaam in, precies zoals op het scherm. */
  if (window.RTGUitvoer) RTGUitvoer.bron(function(){
    if (!tl || !tl.items || !tl.items.length) return null;
    return {
      naam: 'tijdlijn',
      kolommen: ['datum','referentie','soort','partner','gast','omschrijving','bedrag','betaald','status'],
      rijen: tl.items.map(x => [String(x.at || '').slice(0, 10), x.ref || '', x.soort || '',
        x.supplierName || '', x.customerCodename || '', x.sub || '', x.bedrag || 0,
        x.paid ? 'ja' : 'nee', x.status || ''])
    };
  });

  function stream(){
    if (!window.EventSource) return;
    try { source = new EventSource('/api/office/stream?token='+encodeURIComponent(API.token)); } catch(e){ return; }
    source.addEventListener('sync', () => { refresh(); laadTimeline(); loadVerify(); loadVakbewijzen(); loadConcierge(); laadTafels(); loadIncidenten(); loadSalonNaleving(); loadOntmoetingen(); loadTrust(); });
    source.addEventListener('notify', e => { refresh(); const p=$('#prices'); if(p) p.classList.add('flash'); setTimeout(()=>p&&p.classList.remove('flash'),1600); });
    // Salon-ontmoetingen: SOS-alarm en het live camerabeeld (WebRTC-signaal)
    source.addEventListener('ontmoeting-sos', () => { loadOntmoetingen(); const p=$('#prices'); if(p) p.classList.add('flash'); });
    source.addEventListener('ontmoeting-signaal', e => { try { opOntSignaal(JSON.parse(e.data)); } catch(err){} });
  }

  $('#docScrim').addEventListener('click', () => { $('#docScrim').classList.remove('open'); $('#docImg').src = ''; });

  // dagbriefing: een samenvatting van vandaag in gewone taal, met een tik
  $('#briefBtn').addEventListener('click', async () => {
    const box = $('#briefBox');
    if (box.classList.contains('on')){ box.classList.remove('on'); return; }
    box.textContent = '…';
    box.classList.add('on');
    try { box.textContent = (await call('/office/briefing', { lang: lang() })).briefing; }
    catch(e){ box.textContent = e.message; }
  });

  // zoeken: filtert de panelen direct en laat de server door de volledige
  // tijdlijn zoeken (met een korte adempauze tegen onnodige verzoeken)
  $('#zoekInp').addEventListener('input', () => {
    if (!state) return;
    render();
    clearTimeout(tlTimer);
    tlTimer = setTimeout(() => { tlPage = 1; laadTimeline(); }, 350);
  });

  // export voor de boekhouding: de server bouwt het volledige bestand, hoe
  // groot de historie ook is. Via fetch met de Authorization-header (nooit
  // het token in een URL) en dan een blob-download.
  $('#csvBtn').addEventListener('click', async () => {
    if (!API.token) return;
    try {
      const r = await fetch('/api/office/export.csv', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + API.token }, body: '{}'
      });
      if (!r.ok) return;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(await r.blob());
      a.download = 'rtg-backoffice-' + new Date().toISOString().slice(0, 10) + '.csv';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    } catch (e) {}
  });

  /* De knoppen van de reisbalie en de instellingen: één keer ophangen, niet bij
     elke render. Anders krijgt dezelfde knop bij elke verversing een extra
     luisteraar en zet één klik straks drie reizen neer. */
  reisaanbodKnop();
  instellingKnop();

  window.addEventListener('rtglang', () => { if (state){ render(); loadVerify(); } });

  /* de backoffice: RENDEZ-VOUS -- THE TABLE

     Curatie is mensenwerk: hier stelt het kantoor een tafel samen van zes of
     acht leden. Dit is de enige plek waar een gastenlijst zichtbaar is; de leden
     zelf zien alleen hun eigen uitnodiging (kern/rendezvous-tafels.js legt uit
     waarom die twee kanten uit elkaar staan).

     OP CODENAAM, zoals overal. Wie een echte naam nodig heeft gaat langs de
     kluis, met een reden en een regel in het inzagejournaal. */
  async function laadTafels(){
    const el = $('#rvTafels'); if (!el) return;
    try {
      const d = await call('/office/rendezvous/tafels');
      const lijst = d.tafels || [];
      el.innerHTML = lijst.length ? lijst.map(t =>
        '<div class="row"><div class="rl"><b>'+escHtml(t.naam)+'</b>'+
        '<span class="sub">'+escHtml([t.stad, t.datum, t.tijd].filter(Boolean).join(' · '))+
        (t.thema ? ' · ' + escHtml(t.thema) : '')+'</span>'+
        '<span class="sub">'+t.toegezegd+' van '+t.genodigden.length+' toegezegd, '+t.plaatsen+' plaatsen</span>'+
        '<span class="sub">'+t.genodigden.map(g => escHtml(g.codenaam)+' ('+g.status+')').join(', ')+'</span></div>'+
        '<div class="rr"><input data-nodig="'+escHtml(t.id)+'" placeholder="Codenaam erbij" style="width:11rem;">'+
        '<button class="hbtn" data-nodigknop="'+escHtml(t.id)+'">Uitnodigen</button></div></div>').join('')
        : '<div class="row"><div class="rl"><span class="sub">Nog geen tafels samengesteld.</span></div></div>';
      el.querySelectorAll('[data-nodigknop]').forEach(b => b.addEventListener('click', async () => {
        const inp = el.querySelector('[data-nodig="' + b.dataset.nodigknop + '"]');
        try { await call('/office/rendezvous/tafel/nodig', { id: b.dataset.nodigknop, codenaam: inp.value });
          inp.value = ''; laadTafels(); } catch(e){ alert(e.message); }
      }));
    } catch(e){ el.innerHTML = '<div class="row"><div class="rl"><span class="sub">'+escHtml(e.message)+'</span></div></div>'; }
  }
  function koppelTafelMaak(){
    const b = $('#tfMaak'); if (!b) return;
    b.addEventListener('click', async () => {
      const gasten = String(($('#tfGasten') || {}).value || '').split(',').map(x => x.trim()).filter(Boolean);
      try {
        await call('/office/rendezvous/tafel/maak', {
          naam: $('#tfNaam').value, stad: $('#tfStad').value, datum: $('#tfDatum').value,
          tijd: $('#tfTijd').value, thema: $('#tfThema').value,
          plaatsen: Number($('#tfPlaatsen').value) || 8, genodigden: gasten });
        $('#tfNaam').value = ''; $('#tfGasten').value = ''; $('#tfThema').value = '';
        laadTafels();
      } catch(e){ alert(e.message); }
    });
  }

  /* Alleen de knop koppelen; LADEN gebeurt pas na het inloggen, vanuit
     enterApp() in deel 01 -- net als de andere panelen. Riep dit bestand het
     zelf aan, dan vuurde de backoffice bij elke paginalading een verzoek af
     zonder token: een 401 in de console die echte fouten onder ruis bedelft. */
  koppelTafelMaak();
})();
