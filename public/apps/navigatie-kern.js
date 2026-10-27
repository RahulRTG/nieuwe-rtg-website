/* RTG Navigatie op het RTG Design System (TRAVELOS-MIGRATIE.md, batch 4):
   de kern die de vier andere delen delen. Het scherm stond als een inline
   script van bijna 60 kB in navigatie.html; het is in zes stukken geknipt
   langs zijn eigen naden, zonder dat er een aanroep veranderde:

     navigatie-kern.js       de stand, de api, de lagen en de projectie
     navigatie-drie.js       de 3D-kaart (Drie), de 2D-terugval en de camera
     navigatie-zoek.js       zoeken, route en het routepaneel
     navigatie-bediening.js  status, inspreken, poort, lagen en melden
     navigatie-start.js      de plek en de start
     navigatie-kaarten.js    welke gebieden RTG kan leveren

   Alles hangt aan window.RTGNav; dat is de enige gedeelde naam. */
(() => {
  'use strict';
  const $ = s => document.querySelector(s);
  const token = (() => { try { return localStorage.getItem('rtg_member_token'); } catch (e) { return null; } })();
  const api = (pad, body) => fetch(pad, { method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify(body || {}) }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
  let toastT;
  const zeg = t => { const m = $('#toast'); m.textContent = t; m.classList.add('toon'); clearTimeout(toastT); toastT = setTimeout(() => m.classList.remove('toon'), 3000); };

  /* Zichtbaar of niet: `hidden` voor het systeem, en de klasse `zien` als
     de stand die de navigatieproef en de toetsen al jaren lezen. De
     objectkaart onderaan wijkt voor een vel dat daar ligt (poort of route). */
  function toon(el, aan) {
    if (typeof el === 'string') el = $(el);
    el.classList.toggle('zien', !!aan); el.hidden = !aan;
    $('#intelligenceDock').hidden = !$('#poort').hidden || !$('#paneel').hidden;
  }

  const landVan = p => p && p.lat >= 50.70 && p.lat <= 53.72 && p.lng >= 3.20 && p.lng <= 7.30 ? 'NL' : 'ES';

  /* EEN BESTEMMING DIE VAN BUITEN MEEKOMT (?naar=lat,lng&label=...). RTG Move
     lost de plek al op; zonder deze ingang kwam een lid op een kaart die niet
     wist waar hij heen ging. ALLEEN EEN PUNT, en met opzet geen zoekterm: het
     label is wat er in het veld komt te staan, de route rekent op de
     coordinaten. Onzin in de URL levert `null`. */
  const meegegeven = (() => {
    try {
      const q = new URLSearchParams(location.search);
      const d = String(q.get('naar') || '').split(',');
      const lat = Number(d[0]), lng = Number(d[1]);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
      return { lat, lng, naam: String(q.get('label') || '').slice(0, 80) || 'Meegegeven bestemming' };
    } catch (e) { return null; }
  })();

  /* GEEN VERZONNEN PLEK. Voor navigatie IS je positie de hele functie: zonder
     plek bouwen we niets en zegt de poort waarom. `hier` blijft null tot de
     eerste fix of tot u zelf een vertrekpunt kiest. */
  const S = {
    hier: null, land: 'ES', kaartData: null, modus: 'auto', profiel: 'slim', route: null, naar: null,
    kaartBegonnen: false, navigerend: false, laatsteHerberekening: 0, flitsPunten: [], wachtNogOpPlek: false,
    actief: { leverancier: true, ov: true, laad: true, tank: false, civic: false, flits: true, wegennet: true }
  };

  /* Meenemen (shared/uitvoer.js): staat er een route, dan de stappen met hun
     afstand; anders de plekken van de kaart. De 3D-meshes zijn tekenwerk en
     geen gegevens. */
  if (window.RTGUitvoer) RTGUitvoer.bron(() => {
    const { route, kaartData } = S;
    if (route && route.stappen) {
      return { naam: 'route', kolommen: ['stap', 'instructie', 'richting', 'afstand-m'],
        rijen: route.stappen.map((s, i) => [i + 1, s.instructie || '', s.bocht || '', s.afstandM || 0]) };
    }
    if (kaartData && (kaartData.plekken || []).length) {
      return { naam: 'plekken', kolommen: ['naam', 'soort', 'laag', 'afstand-m', 'lat', 'lng'],
        rijen: kaartData.plekken.map(p => [p.naam || '', p.soort || '', p.laag || '',
          p.afstandM == null ? '' : p.afstandM, p.lat, p.lng]) };
    }
    return null;
  });
  /* De generieke uitvoerknop hoort in de zichtbare objectkaart. Als hij als
     eerste kind van het canvas landt, ligt de vaste TravelOS-kop erboven en is
     hij niet aan te raken. De bestaande mountvoorziening houdt knop en dialoog
     bij dezelfde uitvoerlaag; er komt geen tweede exportmechanisme bij. */
  if (window.RTGUitvoer) RTGUitvoer.mount(document.getElementById('navigatieUitvoer'), document.body);

  /* Kleuren per laag: voor het tekenen op het doek (3D en 2D) en voor de stip
     in de laagknop. Dit is tekenwerk op een canvas en in een SVG-attribuut,
     geen stijl. */
  const LAAG = {
    leverancier: { css: '#C23A5E', rgb: [0.76, 0.23, 0.37], naam: 'Leverancier', knop: 'Leveranciers' },
    ov:          { css: '#C9A24B', rgb: [0.79, 0.63, 0.29], naam: 'OV-halte', knop: 'OV-haltes' },
    laad:        { css: '#69B891', rgb: [0.41, 0.72, 0.57], naam: 'Laadpaal', knop: 'Laadpalen' },
    tank:        { css: '#8FA0AE', rgb: [0.56, 0.63, 0.68], naam: 'Tankstation', knop: 'Tankstations' },
    civic:       { css: '#7C93C4', rgb: [0.49, 0.58, 0.77], naam: 'Loket', knop: 'Loketten' },
    flits:       { css: '#DE6E92', rgb: [0.87, 0.43, 0.57], naam: 'Flits', knop: 'Flits-meldingen' },
    wegennet:    { css: '#C9A24B', rgb: [0.79, 0.63, 0.29], naam: 'Nederlands wegennet' }
  };

  /* Projectie: lat/lng naar wereld-eenheden (dezelfde als de server). */
  const P = { WERELD: 0.025, cosRef: 1, ref: { lat: 38.91, lng: 1.43 } };
  const naarWereld = (lat, lng) => [(lng - P.ref.lng) * 111320 * P.cosRef * P.WERELD, (P.ref.lat - lat) * 110540 * P.WERELD];

  const taal = () => document.documentElement.lang || 'nl';
  const getal = (n, d) => new Intl.NumberFormat(taal(), { maximumFractionDigits: d, minimumFractionDigits: d }).format(n);
  const afstandTekst = m => m < 1000 ? m + ' m' : getal(m / 1000, 1) + ' km';

  const svgNS = 'http://www.w3.org/2000/svg';
  /* De stip van een laag: een cirkel met de laagkleur als SVG-attribuut. */
  const stip = function stip(laag) {
    const s = document.createElementNS(svgNS, 'svg'), c = document.createElementNS(svgNS, 'circle');
    s.setAttribute('viewBox', '0 0 12 12'); s.setAttribute('class', 'ds-vel__stip'); s.setAttribute('aria-hidden', 'true');
    c.setAttribute('cx', '6'); c.setAttribute('cy', '6'); c.setAttribute('r', '5'); c.setAttribute('fill', (LAAG[laag] || LAAG.leverancier).css);
    s.appendChild(c); return s;
  };

  window.RTGNav = { stip, $, token, api, zeg, toon, landVan, meegegeven, S, LAAG, P, naarWereld, taal, getal, afstandTekst,
    RUSTIG: !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) };
})();
