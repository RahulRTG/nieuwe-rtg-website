  /* ---------- Heel RTG leest de functiegids (eigenaarsbesluit 19 oktober 2026) ----------
     Het zoekmenu "Heel RTG" in de rand (shared/rtg-edge-smart-menu.js) toonde
     alleen de URL-catalogus van de widgets. De OS-apps -- Videobellen, Bellen,
     Snaps, Werk -- hebben geen adres en stonden er dus niet in, terwijl Rahul ze
     met "open videobellen" wel vindt. Hier zoekt het menu in DEZELFDE gids als
     gidsCommando (RTGWorkspaceDirectory over RTGWorkspaceWorldCatalog, met
     gidsToegang als poort): geen tweede lijst, en wat een lid niet mag openen
     (werkrol, pas) vindt hij ook niet. Een treffer opent via gidsOpen, dezelfde
     weg als Rahul; een link die de catalogus al toont, komt er niet dubbel bij. */
  function heelRtgZoek(invoer) {
    const D = window.RTGWorkspaceDirectory, gezicht = invoer.closest('.rtg-edge-face-all');
    const lijst = gezicht && gezicht.querySelector('.rtg-edge-groups');
    if (!D || !lijst) return;
    let groep = lijst.querySelector('[data-edge-gids]');
    const uit = D.search(invoer.value, { catalog: window.RTGWorkspaceWorldCatalog, guard: gidsContext(), allow: gidsToegang, alles: true });
    // het adres staat in dezelfde catalogus; een OS-app heeft er geen
    const urlVan = id => { for (const w of window.RTGWorkspaceWorldCatalog || []) for (const i of w.items || []) if (i.id === id) return i.url || null; return null; };
    const al = new Set(Array.from(lijst.querySelectorAll('a[href]:not([data-gids-id])')).map(a => a.getAttribute('href')));
    const treffers = uit.status === 'ready' ? uit.matches.filter(m => m.kind === 'item' && !(urlVan(m.id) && al.has(urlVan(m.id)))) : [];
    if (!treffers.length) { if (groep) groep.remove(); return; }
    if (!groep) {
      groep = document.createElement('section'); groep.className = 'rtg-edge-group'; groep.setAttribute('data-edge-gids', '');
      const kop = document.createElement('h3'); kop.textContent = T('edge.gids', 'In de app'); groep.appendChild(kop);
      lijst.prepend(groep);
    }
    groep.querySelectorAll('a').forEach(a => a.remove());
    treffers.forEach((m, i) => {
      const a = document.createElement('a'), nr = document.createElement('span'), naam = document.createElement('b'), pijl = document.createElement('em');
      a.href = urlVan(m.id) || '#'; a.dataset.gidsId = m.id; a.dataset.search = (m.world + ' ' + m.name).toLowerCase();
      nr.textContent = String(i + 1).padStart(2, '0'); naam.textContent = m.name; pijl.textContent = '→';
      a.append(nr, naam, pijl);
      a.addEventListener('click', ev => {
        ev.preventDefault();
        const menu = document.querySelector('.rtg-edge-menu[aria-expanded="true"]'); if (menu) menu.click();
        gidsOpen(m);
      });
      groep.appendChild(a);
    });
    groep.hidden = false;
    const geen = gezicht.querySelector('.rtg-edge-none'); if (geen) geen.hidden = true;
  }
  /* EN DE CATALOGUS LOOPT DOOR DEZELFDE POORT. De widgetcatalogus van Heel RTG
     kent geen werkrol en geen pas, en toonde zo "Tweede scherm" (werkrol zaak)
     aan elk lid. Heeft een catalogusadres een ingang in de gids, dan beslist
     gidsToegang: false als geen van die ingangen voor dit lid zichtbaar is. Geen
     ingang in de gids: null, en het menu laat hem staan zoals voorheen. Het adres
     telt zonder query, met hash (/apps/geld.html#wallet is een eigen ingang). */
  const zonderQuery = u => { const s = String(u || ''), h = s.indexOf('#'); return (h < 0 ? s : s.slice(0, h)).split('?')[0] + (h < 0 ? '' : s.slice(h)); };
  /* DE GEZINSROL: een regel, hier en nergens anders. Een catalogusscherm met
     `gezinssessie` (scripts/world-widgets.js leest dat uit het scherm: het laadt
     apps/foundation/sessie.js) draait op een gezinsprofielsessie, en de server
     opent zijn routes alleen via rtf.verifieerProfiel(code, token): gezinsPoort,
     rtfPoort, rtfSpeler, rtfSociaal en profiel()/sessieVan, allemaal via
     server/foundation/gezinstoken.js. Een ledentoken opent daar niets, ook niet
     voor een volwassene zonder gezinsprofiel. Dus: zonder sessie (rtf_sessie
     met code, token en profiel) toont Heel RTG ze niet -- behalve de deur,
     index.html, waar je met de gezinscode inlogt (os:rtf en accounts-os.js
     wijzen erheen). Een verlopen sessie toont het scherm, dat dan opnieuw om de
     gezinscode vraagt: nooit meer toegang dan de server geeft. */
  const GEZINSDEUR = '/apps/foundation/index.html';
  const gezinssessie = () => { try { const s = JSON.parse(localStorage.getItem('rtf_sessie') || 'null'); return !!(s && s.code && s.token && s.profiel); } catch (e) { return false; } };
  window.RTGAppCatalogusPoort = (url, app) => {
    const doel = zonderQuery(url), ids = [];
    for (const w of window.RTGWorkspaceWorldCatalog || []) for (const i of w.items || []) if (i.url && zonderQuery(i.url) === doel) ids.push(i.id);
    if (ids.length) return ids.some(id => gidsToegang(id));
    return app && app.gezinssessie && doel.split('#')[0] !== GEZINSDEUR ? gezinssessie() : null;
  };
  document.addEventListener('input', e => {
    const t = e.target;
    if (t && t.matches && t.matches('.rtg-edge-face-all .rtg-edge-find input')) heelRtgZoek(t);
  });
