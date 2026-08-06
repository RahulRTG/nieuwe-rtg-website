    API.call('/pin/status', {}).then(st => {
      const zetten = !st.gezet;
      belTitel.textContent = zetten ? T('pin.zet', 'Kies uw algemene pin') : T('pin.vraag', 'Algemene pin');
      belLijst.textContent = '';
      const uitleg = document.createElement('div');
      uitleg.className = 'os-bel-leeg';
      uitleg.textContent = zetten
        ? T('pin.zetuit', 'Een pincode van 4 tot 8 cijfers, overal dezelfde: hij beschermt uw prive-apps en opent uw werk-apps.')
        : T('pin.vrguit', 'Dezelfde pin die uw prive-apps beschermt.');
      belLijst.appendChild(uitleg);
      const inp = document.createElement('input');
      inp.type = 'password'; inp.inputMode = 'numeric'; inp.maxLength = 8; inp.autocomplete = 'off';
      inp.setAttribute('aria-label', T('pin.veld', 'Algemene pin'));
      inp.style.cssText = 'width:100%;margin:0.5rem 0;background:var(--card2,#1B1817);border:1px solid var(--line);border-radius:10px;padding:0.6rem 0.8rem;font-size:1rem;letter-spacing:0.4em;text-align:center;color:var(--txt);';
      belLijst.appendChild(inp);
      const fout = document.createElement('div');
      fout.className = 'os-bel-leeg'; fout.style.color = 'var(--burgundy-on-dark,#C23A5E)';
      belLijst.appendChild(fout);
      const ga = document.createElement('button');
      ga.textContent = zetten ? T('pin.bewaar', 'Pin instellen') : T('pin.open', 'Ontgrendel');
      const doe = async () => {
        const pin = inp.value.trim();
        if (!/^\d{4,8}$/.test(pin)) { fout.textContent = T('pin.vorm', '4 tot 8 cijfers.'); return; }
        try {
          if (zetten) await API.call('/pin/zet', { pin });
          else await API.call('/pin/check', { pin });
          pinOkTot = Date.now() + 5 * 60000;
          sluitScrims();
          af(pin);
        } catch (e) { fout.textContent = e.message || T('pin.mis', 'Dat ging niet goed.'); inp.value = ''; inp.focus(); }
      };
      ga.addEventListener('click', doe);
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') doe(); });
      belLijst.appendChild(ga);
      belScrim.classList.add('open');
      setTimeout(() => inp.focus(), 60);
    }).catch(() => af(null)); // geen account/lijn: niet blokkeren, de werk-app vraagt zelf
  }

  /* de Werk-kiezer: gekoppelde werkplekken uit het ene account */
  function openWerkKiezer() {
    belTitel.textContent = T('werk.h', 'Mijn werkplekken');
    belLijst.textContent = '';
    API.call('/account/rollen', {}).then(d => {
      const rollen = (d.rollen || []).filter(r => WERKDOEL[r.rol]);
      if (!rollen.length) {
        const leeg = document.createElement('div');
        leeg.className = 'os-bel-leeg';
        leeg.textContent = T('werk.leeg', 'Nog geen werkplek gekoppeld. Bewijs eenmalig uw werk-inlog (bijvoorbeeld uw personeels-PIN in de leverancier-app); daarna opent uw werk hier met uw algemene pin.');
        belLijst.appendChild(leeg);
      }
      for (const r of rollen) {
        const doel = WERKDOEL[r.rol];
        const b = document.createElement('button');
        const zi = document.createElement('span'); zi.className = 'zi';
        const zg = window.RTGGlyf && RTGGlyf.svg(doel.glyf); if (zg) zi.appendChild(zg);
        b.appendChild(zi);
        b.appendChild(document.createTextNode(doel.app));
        const m = document.createElement('span'); m.className = 'zm';
        m.textContent = (r.zaakNaam || r.naam || '') + (r.naam && r.zaakNaam ? ' · ' + r.naam : '');
        b.appendChild(m);
        b.addEventListener('click', () => metAlgPin(async (pin) => {
          try {
            const body = { rol: r.rol, code: r.code, staffId: r.staffId, pin };
            let s;
            try { s = await API.call('/account/start', body); }
            catch (e1) {
              if (!(e1.data && e1.data.locatieNodig)) throw e1;
              const pos = await vraagPositie();
              if (!pos) throw e1;
              s = await API.call('/account/start', Object.assign({ positie: pos }, body));
            }
            try { doel.bewaar(s.token, r); } catch (e2) {}
            // Rahuls welzijnszin (late dienst, veel starts): stil tonen, nooit blokkeren
            if (s.welzijn) bannerToon('', 'Rahul', s.welzijn);
            // de werk-app opent schermvullend, op elk formaat
            location.href = doel.url;
          } catch (e) { bannerToon('', T('werk.dicht', 'Werk'), e.message || T('werk.mis', 'Openen lukte niet.')); }
        }));
        belLijst.appendChild(b);
      }
      /* De eerste keer. Een werkruimte heeft zijn eigen inlog (code +
         lid-token) en hoort dat te houden: hij moet ook werken voor iemand
         zonder RTG-pas. Maar dan moet die deur hier wel te vinden zijn --
         anders is "een inlog" alleen waar voor wie al binnen was. Deze rij
         staat er dus altijd, ook als de lijst leeg is. */
      const nieuw = document.createElement('button');
      const nzi = document.createElement('span'); nzi.className = 'zi';
      const nzg = window.RTGGlyf && RTGGlyf.svg('werk'); if (nzg) nzi.appendChild(nzg);
      nieuw.appendChild(nzi);
      nieuw.appendChild(document.createTextNode(T('werk.nieuw', 'Werkruimte openen')));
      const nm = document.createElement('span'); nm.className = 'zm';
      nm.textContent = T('werk.nieuw.sub', 'Eerste keer: met uw werkruimtecode en lid-token. Koppelt u daar uw RTG-account, dan staat hij hierboven.');
      nieuw.appendChild(nm);
      nieuw.addEventListener('click', () => { location.href = '/apps/werk.html'; });
      belLijst.appendChild(nieuw);
    }).catch(() => {
      const leeg = document.createElement('div');
      leeg.className = 'os-bel-leeg';
      leeg.textContent = T('werk.acc', 'Werk op het OS werkt met een echt RTG-account.');
      belLijst.appendChild(leeg);
    });
    belScrim.classList.add('open');
  }
  /* ---------- mappen: eigen namen ----------
     De naam van een map is van de gebruiker: hernoemen kan in de wiebel-modus
     (tik op de map) of via Rahul; de keuze staat per pas in localStorage. */
  function mapNamen() { try { return JSON.parse(localStorage.getItem('rtg_os_mapnamen_' + pas) || '{}'); } catch (e) { return {}; } }
  function mapNaam(map) { return (mapNamen()[map.sleutel] || '').trim() || map.naam; }
  function zetMapNaam(map, naam) {
    try {
      const m = mapNamen();
      const schoon = (naam || '').trim().slice(0, 18);
      if (schoon && schoon !== map.naam) m[map.sleutel] = schoon; else delete m[map.sleutel];
      localStorage.setItem('rtg_os_mapnamen_' + pas, JSON.stringify(m));
    } catch (e) {}
    bouw();
  }

  /* ---------- gebruik bijhouden: het OS leert wat u vaak opent ----------
     Telt per app hoe vaak hij geopend wordt, met verval per dag; Spotlight
     zet daar de rij "Voor u" van. Alles blijft lokaal op het toestel. */
  function gebruik() { try { return JSON.parse(localStorage.getItem('rtg_os_gebruik_' + pas) || '{}'); } catch (e) { return {}; } }
  function telGebruik(sleutel) {
    try {
      const g = gebruik(), nu = Date.now(), oud = g[sleutel] || { n: 0, t: nu };
      const dagen = Math.max(0, (nu - (oud.t || nu)) / 86400000);
      g[sleutel] = { n: (oud.n || 0) * Math.pow(0.85, dagen) + 1, t: nu };
      localStorage.setItem('rtg_os_gebruik_' + pas, JSON.stringify(g));
    } catch (e) {}
  }
  function topGebruik(k) {
    const g = gebruik(), nu = Date.now();
    return Object.entries(g)
      .map(([s, v]) => [s, (v.n || 0) * Math.pow(0.85, Math.max(0, (nu - (v.t || nu)) / 86400000))])
      .sort((a, b) => b[1] - a[1])
      .map(([s]) => s)
      .filter(itemZichtbaar)
      .slice(0, k);
  }

  const sleutelVan = it => typeof it === 'string' ? it : it.sleutel;
  // rij 0 = de mappen boven de klok, rij 1 = de functies eronder
  const RIJEN = () => [MAPPEN, FUNCTIES];
  function bewaardeVolgorde(p) { try { return JSON.parse(localStorage.getItem('rtg_os_indeling_' + pas + '_' + p) || 'null'); } catch (e) { return null; } }
  function bewaarVolgorde(p, volgorde) { try { localStorage.setItem('rtg_os_indeling_' + pas + '_' + p, JSON.stringify(volgorde)); } catch (e) {} }
  function gesorteerd(p) {
    const basis = RIJEN()[p], orde = bewaardeVolgorde(p);
    if (!orde) return basis;
    const perSleutel = new Map(basis.map(it => [sleutelVan(it), it]));
    const uit = [];
    for (const s of orde) if (perSleutel.has(s)) { uit.push(perSleutel.get(s)); perSleutel.delete(s); }
    for (const it of basis) if (perSleutel.has(sleutelVan(it))) uit.push(it); // nieuw sinds de bewaring: achteraan
    return uit;
  }

  /* ---------- iconen bouwen ---------- */
  const tabKnop = t => tabbar.querySelector('button[data-tab="' + t + '"]');
  const tabZichtbaar = t => { const b = tabKnop(t); return !!b && b.style.display !== 'none'; };
  const tabNaam = t => { const s = tabKnop(t); const sp = s && s.querySelector('span'); return sp ? sp.textContent : t; };

  function itemDef(item) { // os-app of link-app: de registry-invoer
    return item.startsWith('os:') ? OSAPPS[item.slice(3)] : LINKS[item.slice(5)];
  }
  // een Bodoni-monogram als de app (nog) geen eigen glyf heeft: de eerste
  // letters van de naam, netjes in de display-letter (huisstijl, geen emoji).
  function monogram(naam) {
    const woorden = String(naam || '').trim().split(/\s+/).filter(w => !/^(de|het|een|rtg|rtf|mijn)$/i.test(w));
    let m = woorden.length >= 2 ? (woorden[0][0] + woorden[1][0])
      : (woorden[0] || naam || '?').slice(0, 2);
    const span = document.createElement('span');
    span.className = 'os-monogram';
    span.textContent = m.toUpperCase();
    return span;
  }
  function glyfVoor(item) { // huisstijl-glyf op naam van de sleutel
    const sleutel = item.slice(item.indexOf(':') + 1);
    return window.RTGGlyf ? RTGGlyf.svg(sleutel) : null;
  }
  function tegelInhoud(item) { // svg (tab), glyf (link/os-app) of monogram in de tegel
