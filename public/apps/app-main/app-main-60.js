    const tab = active ? active.tab : 'home';
    // inhoud opnieuw ophalen in de nieuwe taal (facturen, reis, menu's)
    if (API.live){ try { applyState((await API.call('/state')).state); } catch (e) {} }
    renderAll();
    renderBell();
    openTab(tab);
  });

  /* ---------- PWA ---------- */

  if ('serviceWorker' in navigator && (location.protocol === 'http:' || location.protocol === 'https:')){
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }

  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) logoutBtn.addEventListener('click', doLogout);

  /* ---------- AVG: inzage en vergetelheid ---------- */
  const privExport = document.getElementById('privExport');
  if (privExport) privExport.addEventListener('click', async () => {
    if (!API.live){ toast(T('app.priv.needlogin','Log eerst in.')); return; }
    try {
      const data = await API.call('/privacy/export');
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'rtg-mijn-gegevens.json';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      toast(T('app.priv.exported','Uw gegevens zijn gedownload als JSON.'));
    } catch(e){ toast(e.message); }
  });
  const privDelete = document.getElementById('privDelete');
  if (privDelete) privDelete.addEventListener('click', async () => {
    if (!API.live){ toast(T('app.priv.needlogin','Log eerst in.')); return; }
    if (!confirm(T('app.priv.confirm','Weet u het zeker? Dit wist uw cv, chats, likes en locatie definitief en logt u overal uit.'))) return;
    try {
      await API.call('/privacy/delete');
      try { localStorage.removeItem('rtg_member_token'); } catch(e2){}
      location.reload();
    } catch(e){ toast(e.message); }
  });

  // In Magnaat start de echte OS-schil direct op een synthetische Business
  // persona. Normaal blijft de bestaande sessieherstelroute ongewijzigd.
  if (magnaatProef) login(vastePas === 'lifestyle' ? 'lifestyle' : vastePas === 'rtg' ? 'rtg' : 'business');
  else restoreSession();

  /* ---- HET VAKBEWIJS: de stukken die bij je WERK horen ----

     WAAROM DIT SCHERM ER MOEST KOMEN. server/kern/persoonseis.js houdt personeel
     in een kinderopvang, een praktijk, een beveiligingsteam of een korps tegen
     tot hun stuk is gezien. Zonder deze plek kon je dat stuk nergens indienen --
     en dan is de poort geen beveiliging maar een storing: je staat op het
     rooster en komt er niet in, zonder weg terug.

     WAAROM HET HIER STAAT EN NIET BIJ DE IDENTITEITSVERIFICATIE IN DEEL 41,
     waar het inhoudelijk hoort. De delen van app-main zijn op GROOTTE geknipt
     en niet op structuur: deel 41 eindigt midden in laadPaspoortInbox() en deel
     42 zet diezelfde functie voort. Een nieuw bestand ertussen belandt dus
     BINNEN die functie, en dan is laadVakbewijs() vanuit renderHome() niet te
     zien. Dat is precies wat er gebeurde -- de banner bleef leeg en renderHome
     brak stil af na de verificatiebanner, zonder dat er iets klaagde. Het einde
     van het laatste deel is de enige echte top-niveau grens in deze reeks.

     HIJ VERSCHIJNT ALLEEN ALS HIJ ERGENS OVER GAAT. Wie niet in zo'n genre
     werkt, ziet niets. Een banner die iedereen om papieren vraagt die 55 van de
     73 genres niet kennen, is ruis -- en door ruis leren mensen heen klikken.

     WAT ER NIET GEBEURT. Geen foto, geen scan, geen upload. Er wordt vastgelegd
     WELK stuk je hebt, met zijn nummer en tot wanneer het geldt; het document
     zelf blijft waar het hoort. Dezelfde regel die kern/gegevenspoort.js al
     trekt: geen tweede intake naast de eerste. */
  async function laadVakbewijs(){
    const el = document.getElementById('vakbewijsBanner');
    if (!el || !user || !user.account) return;
    let r = null;
    try { r = await API.call('/vakbewijs', {}); } catch(e){ return; }
    const eisen = r.eisen || [], mijn = r.vakbewijzen || [], soorten = r.soorten || {};

    /* Wat vraagt mijn werk, en wat heb ik daarvan? De handeling-eisen tellen
       mee: een arts die niet kan voorschrijven staat niet buiten de deur, maar
       hij hoort wel te weten waarom die knop niets doet. */
    const nodig = new Map();
    for (const e of eisen){
      for (const s of (e.werk || [])) nodig.set(s.id, { soort: s, waarvoor: 'werk' });
      for (const h of Object.values(e.handelingen || {}))
        for (const s of (h.nodig || [])) if (!nodig.has(s.id)) nodig.set(s.id, { soort: s, waarvoor: h.wat });
    }
    /* `identiteit` staat er niet bij: die loopt over de verificatie hierboven en
       heeft daar zijn eigen banner. Twee plekken die om hetzelfde vragen, laten
       een mens twee keer hetzelfde doen. */
    nodig.delete('identiteit');
    if (!nodig.size){ el.innerHTML = ''; return; }

    const stand = id => mijn.find(v => v.wat === id) || null;
    const regels = [...nodig.entries()].map(([id, n]) => {
      const v = stand(id), naam = (soorten[id] && soorten[id].naam) || id;
      let stateTekst, klasse;
      if (!v){ stateTekst = T('vak.geen','nog niet ingediend'); klasse = 'open'; }
      else if (v.ingetrokken){ stateTekst = T('vak.in','ingetrokken'); klasse = 'open'; }
      else if (v.verlopen){ stateTekst = T('vak.verlopen','verlopen op')+' '+esc(v.tot || ''); klasse = 'open'; }
      else if (!v.gezien){ stateTekst = T('vak.wacht','ingediend, RTG kijkt ernaar'); klasse = 'pending'; }
      else { stateTekst = T('vak.ok','gezien en afgetekend') + (v.tot ? ' · '+T('vak.tot','geldig tot')+' '+esc(v.tot) : ''); klasse = 'ok'; }
      return '<div class="vakrij" data-soort="'+esc(id)+'">' +
        '<div><b>'+esc(naam)+'</b> <span class="vaksub">'+esc(n.waarvoor === 'werk'
          ? T('vak.voorwerk','nodig om hier te werken')
          : T('vak.voor','nodig om ')+esc(n.waarvoor))+'</span>' +
        '<div class="vaksub vak-'+klasse+'">'+stateTekst+'</div></div>' +
        (klasse === 'ok' ? '' : '<button class="vbtn" data-vak="'+esc(id)+'">' +
          (v ? T('vak.opnieuw','Opnieuw indienen') : T('vak.indienen','Indienen')) + '</button>') +
        '</div>';
    }).join('');

    el.innerHTML = '<div class="vbanner"><b>'+T('vak.h','Papieren voor uw werk')+'</b>' +
      '<span>'+T('vak.b','Uw werk vraagt om een stuk op uw eigen naam. U legt hier vast welk stuk dat is en tot wanneer het geldt; een medewerker van RTG tekent af dat hij het heeft gezien. RTG beoordeelt de inhoud niet en uw werkgever ziet alleen of het rond is.')+'</span>' +
      regels + '</div>';
    el.querySelectorAll('[data-vak]').forEach(b =>
      b.addEventListener('click', () => vakIndienen(b.dataset.vak, (soorten[b.dataset.vak] || {}))));
  }

  /* Indienen. Drie vragen, want dat is precies wat de server bewaart: welk stuk,
     welk nummer, tot wanneer. Het uitleg-zinnetje van het register komt mee, dus
     de vraag heet bij de naam die de mens zelf kent ("uw BIG-nummer"). */
  async function vakIndienen(soort, def){
    const nummer = prompt((def.uitleg || T('vak.watnr','Wat is het nummer van dit stuk?')) + '\n\n' +
      T('vak.nr','Nummer:'));
    if (nummer === null) return;
    if (!nummer.trim()){ toast(T('vak.nrnodig','Zonder nummer kan RTG het stuk niet terugvinden.')); return; }
    const tot = prompt(T('vak.totvraag','Tot wanneer is het geldig? (jjjj-mm-dd; leeg laten mag als er geen einddatum op staat)'), '');
    if (tot === null) return;
    if (tot.trim() && !/^\d{4}-\d{2}-\d{2}$/.test(tot.trim())){
      toast(T('vak.datumfout','Een datum ziet eruit als 2030-01-31.')); return;
    }
    try {
      const r = await API.call('/vakbewijs/zet', { wat: soort, nummer: nummer.trim(), tot: tot.trim() || null });
      toast(r.uitleg || T('vak.ontvangen','Vastgelegd.'));
    } catch(e){ toast(e.message); return; }
    laadVakbewijs();
  }
})();
