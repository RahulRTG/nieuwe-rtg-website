    if (item.startsWith('tab:')) {
      const svg = tabKnop(item.slice(4)) && tabKnop(item.slice(4)).querySelector('svg');
      return svg ? svg.cloneNode(true) : document.createTextNode('•');
    }
    return glyfVoor(item) || monogram((itemDef(item) || {}).naam || item);
  }
  function itemNaam(item) {
    return item.startsWith('tab:') ? tabNaam(item.slice(4)) : (itemDef(item) || {}).naam || item;
  }
  /* Zichtbaar is een app als hij bestaat, bij jouw pas hoort, en als de functie
     erachter in je boardroom aan staat (isAan, 25-os-04b.js). Ook de functierij
     onder de klok volgt dat: zet je "Directe berichten" uit, dan verdwijnt de
     tegel Berichten. Een tegel die je wel kunt openen maar die daarna 403 geeft
     is erger dan geen tegel.

     Wat NIET uit kan, bepaalt de boardroom zelf (vast:true op de server, zoals
     je wallet met de ledenpas) -- niet dit scherm. Zo staat de regel op een
     plek in plaats van op twee. */
  function itemZichtbaar(item) {
    if (!item || typeof item !== 'string') return false;
    if (gast() && LEDEN_ONLY.has(item)) return false;
    if (item.startsWith('tab:')) return tabZichtbaar(item.slice(4)) && isAan(item);
    if (item.startsWith('link:') && PREMIUM.has(item.slice(5)) && !premiumPas) return false;
    if (!itemDef(item)) return false;
    return isAan(item);
  }
  // een gratis account (zonder pas) heeft geen wallet en geen Rahul; de kern
  // zet daarvoor de klasse os-gast op #app (00-kern-05.js)
  const gast = () => app.classList.contains('os-gast');
  const LEDEN_ONLY = new Set(['link:wallet']);
  function openItem(item) {
    if (wiebel) return; // in wiebel-modus opent er niets, net als op een telefoon
    telGebruik(item);
    if (item.startsWith('tab:')) { const b = tabKnop(item.slice(4)); if (b) b.click(); }
    else if (item.startsWith('os:')) { openOsApp(item.slice(3)); }
    else {
      const l = LINKS[item.slice(5)];
      if (!l) return;
      // op een breed scherm opent een app als venster op het bureaublad
      // (meerdere naast elkaar); op de telefoon gewoon schermvullend.
      const openen = () => {
        if (window.RTGVensters && RTGVensters.actief()) RTGVensters.open(l.url, l.app || l.naam || 'App');
        else location.href = l.url;
      };
      // prive-apps openen pas na de algemene pin (25-os-01a.js)
      if (l.prive) return metAlgPin(openen);
      openen();
    }
  }

  /* ---------- de kiezer: Bellen, Videobellen en Snaps ----------
     Een tik op de app opent uw contacten; een tik op een contact belt,
     videobelt of stuurt de snap meteen (via de sociale laag, RTGSocial). */
  const belScrim = $('#osBelScrim'), belTitel = $('#osBelTitel'), belLijst = $('#osBelLijst');
  function openOsApp(naam) {
    const app = OSAPPS[naam]; if (!app || !belScrim) return;
    sluitScrims();
    // Werk: de eigen kiezer met gekoppelde werkplekken en de algemene pin
    if (naam === 'werk') { openWerkKiezer(); return; }
    belTitel.textContent = app.naam;
    belLijst.textContent = '';
    // RTFoundation: een leeftijdskeuze, daarna opent de juiste app (RTF-jas)
    if (naam === 'rtf') {
      let onthouden = null;
      try { onthouden = localStorage.getItem('rtf_app_groep'); } catch (e) {}
      for (const gr of RTF_GROEPEN) {
        const b = document.createElement('button');
        const zi = document.createElement('span'); zi.className = 'zi';
        const gg = window.RTGGlyf && RTGGlyf.svg('rtf-' + gr.g);
        if (gg) zi.appendChild(gg); else zi.textContent = (gr.naam.match(/[A-Z]/g) || ['R']).slice(0, 2).join('');
        b.appendChild(zi);
        b.appendChild(document.createTextNode(gr.naam));
        const m = document.createElement('span'); m.className = 'zm';
        m.textContent = gr.sub + (onthouden === gr.g ? ' · vorige keer' : '');
        b.appendChild(m);
        b.addEventListener('click', () => { location.href = '/apps/foundation/index.html?groep=' + gr.g; });
        belLijst.appendChild(b);
      }
      belScrim.classList.add('open');
      return;
    }
    const S = window.RTGSocial;
    const lijst = S && S.ok && S.ok() ? S.lijst() : [];
    if (!lijst.length) {
      const d = document.createElement('div');
      d.className = 'os-bel-leeg';
      d.textContent = 'Nog geen contacten. Voeg iemand toe in De Salon; daarna belt, videobelt en snapt u met een tik, zonder telefoonnummer.';
      belLijst.appendChild(d);
      const ga = document.createElement('button');
      const gi = document.createElement('span'); gi.className = 'zi';
      const gis = window.RTGGlyf && RTGGlyf.svg('salon'); if (gis) gi.appendChild(gis);
      ga.appendChild(gi); ga.appendChild(document.createTextNode('Naar De Salon'));
      ga.addEventListener('click', () => { sluitScrims(); const b = tabKnop('salon'); if (b) b.click(); });
      belLijst.appendChild(ga);
    }
    for (const c of lijst) {
      const b = document.createElement('button');
      const zi = document.createElement('span'); zi.className = 'zi';
      zi.textContent = String(c.codename || '?').trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
      b.appendChild(zi);
      b.appendChild(document.createTextNode(c.codename || ''));
      const m = document.createElement('span'); m.className = 'zm';
      const mg = window.RTGGlyf && RTGGlyf.svg(naam); if (mg) m.appendChild(mg); b.appendChild(m);
      b.addEventListener('click', () => {
        sluitScrims();
        if (!window.RTGSocial) return;
        if (naam === 'snaps') RTGSocial.snap(c.key);
        else RTGSocial.bel(c.key, c.codename, naam === 'videobellen');
      });
      belLijst.appendChild(b);
    }
    belScrim.classList.add('open');
  }

