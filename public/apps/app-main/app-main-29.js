/* de realtime-verbinding starten en herstellen */
    RTGRealtime.start = (token, opts) => {
      opts = opts || {};
      const oud = opts.onChange;
      opts.onChange = n => {
        if (oud) oud(n);
        if (n && n.title) bannerToon(n.icon || '', n.title, n.body || '');
      };
      return echteStart(token, opts);
    };
  }

  /* ---------- Rahul bestuurt het OS ----------
     Zinnen die het OS zelf kan uitvoeren (open <app>, thema, licht/donker,
     zoek, home) onderscheppen we in de capture-fase, vóór de chat-handlers;
     al het andere gaat gewoon door naar Rahul-chat, die met zijn
     acties-registry op de server bestelt, boekt, betaalt en annuleert. */
  function gidsToegang(id, soort) {
    if (soort === 'world') return id === 'world:core' || MAPPEN.some(mp => mp.wereld && 'world:' +
      String(mp.naam || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') === id);
    return itemZichtbaar(id);
  }
  function gidsContext() {
    let bewaard = '';
    try { bewaard = localStorage.getItem('rtg_member_token') || ''; } catch (e) {}
    return { authenticated: !!(user && user.account && API.token), sameSession: !!API.token && bewaard === API.token,
      contextCurrent: !!(app && app.classList.contains('active')) };
  }
  function gidsOpen(match) {
    if (!match) return false;
    if (match.kind === 'item') { sluitScrims(); openItem(match.id); return true; }
    const wereld = match.id === 'world:core' ? MAPPEN.find(mp => mp.sleutel === 'map-instellingen')
      : MAPPEN.find(mp => mp.naam === match.name);
    if (!wereld) return false;
    sluitScrims(); openMap(wereld); return true;
  }
  function gidsKeuzes(query) {
    openZoek(); zoekInput.value = query; zoek();
  }
  function gidsCommando(soort, query) {
    const D = window.RTGWorkspaceDirectory;
    if (!D) return { handled: false, message: '' };
    const opties = { catalog: window.RTGWorkspaceWorldCatalog, guard: gidsContext(), allow: gidsToegang };
    const uit = soort === 'search' ? D.search(query, opties) : D.resolve(query, opties);
    if (uit.status === 'closed') return { handled: true, message: 'De functiegids is in deze sessie niet beschikbaar.' };
    if (soort === 'search') {
      gidsKeuzes(uit.query || query);
      return { handled: true, message: uit.status === 'ready' ? 'Ik toon de passende RTG-onderdelen.' : 'Ik vond geen passend RTG-onderdeel.' };
    }
    if (uit.status === 'match' && gidsOpen(uit.match)) {
      bannerToon('✦', 'Rahul', uit.match.name + ' staat voor u open.');
      return { handled: true, message: uit.match.name + ' staat voor u open.' };
    }
    if (uit.status === 'choices') {
      gidsKeuzes(uit.query);
      const namen = uit.matches.slice(0, 3).map(x => x.name).join(', ');
      bannerToon('✦', 'Rahul', 'Kies het bedoelde onderdeel' + (namen ? ': ' + namen + '.' : '.'));
      return { handled: true, message: 'Ik vond meerdere mogelijkheden. Kies het bedoelde onderdeel.' };
    }
    bannerToon('✦', 'Rahul', 'Ik vond geen RTG-onderdeel met die naam.');
    return { handled: true, message: 'Ik vond geen RTG-onderdeel met die naam.' };
  }
  function osCommando(ruw) {
    const schoon = (ruw || '').trim().replace(/[?.!]+$/, '');
    const q = schoon.toLowerCase();
    if (!q) return false;
    if (/^(home|thuis|beginscherm)$/.test(q)) { sluitScrims(); naarHome(); bannerToon('✦', 'Rahul', 'Naar het beginscherm.'); return true; }
    // elke functie een eigen app: bellen en videobellen direct via Rahul
    if (/^(bel|bellen|iemand bellen)$/.test(q)) { sluitScrims(); openItem('os:bellen'); return true; }
    if (/^(videobel|videobellen|video bellen)$/.test(q)) { sluitScrims(); openItem('os:videobellen'); return true; }
    // RTF met leeftijd erbij slaat de keuze over: "open rtf kids"
    let mr = q.match(/^(?:open\s+|start\s+|ga naar\s+)?rtf\s+(mini|kids|kind|tiener|jong|volw|volwassen)$/);
    if (mr) {
      const g = ({ kids: 'kind', volwassen: 'volw' })[mr[1]] || mr[1];
      sluitScrims(); location.href = '/apps/foundation/index.html?groep=' + g;
      return true;
    }
    // mappen hernoemen: "hernoem sociaal naar vrienden" of "noem de map rtg & info om naar over rtg"
    const mh = schoon.match(/^(?:hernoem|noem)\s+(?:de\s+)?(?:map\s+)?(.+?)\s+(?:om\s+)?naar\s+(.+)$/i);
    if (mh) {
      // lidwoorden tellen niet mee: "de crew" en "crew" wijzen dezelfde map aan
      const kaal = s => String(s || '').toLowerCase().replace(/^(?:de|het|een)\s+/, '');
      const doel = MAPPEN.find(mp => kaal(mapNaam(mp)) === kaal(mh[1]) || kaal(mp.naam) === kaal(mh[1]));
      if (doel) {
        zetMapNaam(doel, mh[2]);
        bannerToon('✦', 'Rahul', 'De map heet nu "' + mapNaam(doel) + '".');
        return true;
      }
    }
    let m = q.match(/^zoek(?:en)?(?:\s+naar)?\s+(.+)$/);
    if (m) return gidsCommando('search', m[1]).handled;
    m = q.match(/^thema\s+(bordeaux|parelmoer|standaard|klassiek)$/);
    if (m && window.RTGOSThema && RTGOSThema.keuzeMogelijk()) {
      RTGOSThema.zet(m[1] === 'klassiek' ? 'standaard' : m[1]);
      bannerToon('✦', 'Rahul', 'Het thema staat op ' + m[1] + '.');
      return true;
    }
    if (/^(licht|donker|lichte modus|donkere modus)$/.test(q)) {
      const b = $('#rtg-thema-knop');
      if (b) { b.click(); bannerToon('✦', 'Rahul', 'De weergave is omgezet.'); return true; }
      return false;
    }
    m = q.match(/^(?:open|start|ga naar)\s+(.+)$/);
    if (m) {
      const naam = m[1].replace(/^(?:de|het|een)\s+/, '');
      return gidsCommando('open', naam).handled;
    }
    return false;
  }
  /* Command gebruikt exact dezelfde lokale, accountgebonden gidsroute. Dit is
     geen uitvoerder: alleen zoeken en een bestaande RTG-bestemming openen. */
  window.RTGAppDirectoryCommand = function (tekst) {
    const schoon = String(tekst || '').trim().replace(/[?.!]+$/, '');
    let m = schoon.match(/^zoek(?:en)?(?:\s+naar)?\s+(.+)$/i);
    if (m) return gidsCommando('search', m[1]);
    m = schoon.match(/^(?:open|start|ga naar|breng(?: me)? naar|toon|laat zien|terug naar)\s+(.+)$/i);
    return m ? gidsCommando('open', m[1].replace(/^(?:de|het|een)\s+/i, '')) : { handled: false, message: '' };
  };
  document.addEventListener('click', e => {
    if (!e.target || !e.target.closest || !e.target.closest('#askBtn')) return;
    const inp = $('#askInput');
    if (inp && osCommando(inp.value)) { inp.value = ''; e.stopImmediatePropagation(); e.preventDefault(); }
  }, true);
  document.addEventListener('keydown', e => {
    if (e.key !== 'Enter' || !e.target || e.target.id !== 'askInput') return;
    if (osCommando(e.target.value)) { e.target.value = ''; e.stopImmediatePropagation(); e.preventDefault(); }
  }, true);


  /* ---------- de balk van Rahul, onderaan het beginscherm ----------
     Eén regel waarin je alles kwijt kunt. Is het een opdracht die het OS zelf
     kan uitvoeren ("open Reizen", "donker", "zoek villa", "hernoem Geld naar
     Bank"), dan doet het OS het meteen en blijf je op het beginscherm. Al het
     andere gaat naar Rahul zelf: zijn app opent met de vraag er al in, en zijn
     acties-registry op de server regelt de rest.

     Rahuls signatuurmond (dezelfde bewegende lippen als op het inlogscherm)
     zit in de balk, zodat zichtbaar is tegen wie je praat. */
  const aiBalk = $('#osAiBalk'), aiIn = $('#osAiIn'), aiOrb = $('#osAiOrb');
  if (aiOrb) aiOrb.appendChild(aiMond());
  if (aiBalk && aiIn) {
    aiBalk.addEventListener('submit', e => {
      e.preventDefault();
      const vraag = aiIn.value.trim();
      if (!vraag) { vraagRahul(''); return; } // lege balk: zijn hele app openen
      aiIn.value = '';
      if (osCommando(vraag)) return; // het OS kon het zelf; blijf thuis
      /* En anders antwoordt hij HIER, in de draad boven de balk. Je blijft dus
         op het beginscherm; wie het hele gesprek wil ziet dat in zijn app. */
      osRahulVraag(vraag);
    });
    // een tik op de mond opent Rahul zonder dat je iets hoeft te typen
    if (aiOrb) {
      aiOrb.style.cursor = 'pointer';
      aiOrb.addEventListener('click', () => vraagRahul(aiIn.value.trim()));
    }
  }
