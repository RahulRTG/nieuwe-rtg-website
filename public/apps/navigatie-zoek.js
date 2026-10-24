/* RTG Navigatie: zoeken, de route en het routepaneel. Zelfde aanroepen als
   altijd (/api/nav/bestemmingen en /api/nav/route); de stand staat in
   window.RTGNav (navigatie-kern.js). */
(() => {
  'use strict';
  const N = window.RTGNav, { $, S, LAAG, api, zeg, toon, afstandTekst } = N;
  let zoekT, zoekVraag = 0, keuzes = [], keuze = -1;
  $('#zoek').addEventListener('input', e => {
    clearTimeout(zoekT);
    const q = e.target.value.trim();
    zoekT = setTimeout(() => zoekBestemmingen(q), 220);
  });
  /* De lijst hoort ook bij het TOETSENBORD: pijltjes wijzen een optie aan,
     Enter pakt hem, Escape sluit. Wie geen muis of vinger gebruikt, komt zo
     ook bij zijn bestemming. */
  $('#zoek').addEventListener('keydown', e => {
    if (e.key === 'Escape') { sluitLijst(); return; }
    if (!keuzes.length) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      keuze = e.key === 'ArrowDown' ? (keuze + 1) % keuzes.length : (keuze <= 0 ? keuzes.length : keuze) - 1;
      merkKeuze();
    } else if (e.key === 'Enter') {
      e.preventDefault(); pak(keuzes[keuze < 0 ? 0 : keuze]);
    }
  });
  function merkKeuze() {
    const knoppen = $('#res').querySelectorAll('button');
    knoppen.forEach((b, i) => b.setAttribute('aria-selected', i === keuze));
    const aan = knoppen[keuze];
    $('#zoek').setAttribute('aria-activedescendant', aan ? aan.id : '');
    if (aan) aan.scrollIntoView({ block: 'nearest' });
  }
  function sluitLijst() {
    toon('#res', false); $('#zoek').setAttribute('aria-expanded', 'false');
    $('#zoek').setAttribute('aria-activedescendant', ''); keuzes = []; keuze = -1;
  }
  /* Wat de motor zegt (nul treffers, of een 503 zonder ingeladen wegennet),
     zegt het scherm door. Een mededeling is geen keuze: zolang er iets te
     MELDEN valt is dit vak een status en geen lijst, en staat de combobox
     dicht. */
  function meldInLijst(tekst) {
    const res = $('#res'); res.textContent = '';
    const p = document.createElement('p'); p.className = 'leeg ds-meta'; p.textContent = tekst;
    res.appendChild(p); toon(res, true);
    res.setAttribute('role', 'status');
    $('#zoek').setAttribute('aria-expanded', 'false'); $('#zoek').setAttribute('aria-activedescendant', '');
    keuzes = []; keuze = -1;
  }
  /* ZOEKEN KAN ZONDER PLEK, EN MOET DAT OOK. De server accepteert een
     zoekvraag zonder plek en laat dan alleen de afstanden weg. Dus sturen we
     wat we weten, en niets meer. */
  async function zoekBestemmingen(q) {
    const vraag = ++zoekVraag, hier = S.hier;
    const r = await api('/api/nav/bestemmingen', hier ? { q, lat: hier.lat, lng: hier.lng } : { q });
    if (vraag !== zoekVraag) return;
    if (r.status !== 200) return meldInLijst(r.body.error || 'Zoeken lukt hier nu niet.');
    const rij = (r.body.bestemmingen || []).slice(0, 18);
    if (!rij.length) return meldInLijst(q ? 'Niets gevonden voor “' + q + '”.' : 'Nog geen bestemmingen in beeld.');
    const res = $('#res'); res.textContent = ''; res.setAttribute('role', 'listbox');
    keuzes = rij.slice(); keuze = -1;
    rij.forEach((p, i) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'ds-vel__rij';
      b.id = 'res-' + i; b.setAttribute('role', 'option'); b.setAttribute('aria-selected', 'false');
      const kl = (LAAG[p.laag] || LAAG.leverancier);
      const nm = document.createElement('span'); nm.className = 'ds-vel__naam nm'; nm.appendChild(document.createTextNode(p.naam));
      const sm = document.createElement('small'); sm.textContent = kl.naam + (p.extra ? ' · ' + p.extra : ''); nm.appendChild(sm);
      const af = document.createElement('span'); af.className = 'af ds-meta'; af.textContent = p.afstandM != null ? afstandTekst(p.afstandM) : '';
      b.append(N.stip(p.laag), nm, af);
      b.addEventListener('click', () => pak(p));
      res.appendChild(b);
    });
    toon(res, true); $('#zoek').setAttribute('aria-expanded', 'true');
  }
  function pak(p) {
    if (!p) return;
    sluitLijst(); $('#zoek').value = p.naam; kiesBestemming(p);
  }
  N.zoekBestemmingen = zoekBestemmingen;

  N.kiesBestemming = kiesBestemming;
  async function kiesBestemming(p) {
    S.naar = { lat: p.lat, lng: p.lng, naam: p.naam };
    await N.berekenRoute();
  }
  /* ZONDER VERTREKPUNT GEEN ROUTE, EN DAT ZEGT HET SCHERM ZELF; de uitweg
     staat in de poort: kies zelf waar u vertrekt. */
  N.berekenRoute = async function berekenRoute() {
    if (!S.naar) return;
    if (!S.hier) { zeg('Ik weet nog niet waar u bent. Kies eerst uw vertrekpunt.'); N.vraagVertrekpunt(); return; }
    const r = await api('/api/nav/route', { van: S.hier, naar: S.naar, modus: S.modus, profiel: S.profiel });
    if (r.status !== 200) { zeg(r.body.error || 'Geen route gevonden.'); return; }
    S.route = r.body;
    toonRoute();
    N.bouwRoute(); N.kaderRoute();
  };
  function tijdTekst(iso) {
    const d = new Date(iso); if (!Number.isFinite(d.getTime())) return '·';
    return d.toLocaleTimeString(N.taal(), { hour: '2-digit', minute: '2-digit' });
  }
  const tekst = (sel, t) => { $(sel).textContent = t; };
  function knop(klasse, inhoud, doe) {
    const b = document.createElement('button'); b.type = 'button'; b.className = klasse;
    b.append(...inhoud); b.addEventListener('click', doe); return b;
  }
  function toonRoute() {
    const route = S.route, intel = route.intelligence || {};
    document.body.classList.add('nav-route');
    tekst('#bestemNaam', S.naar.naam || 'Route');
    tekst('#etaGroot', route.etaMin[S.modus] + ' min');
    tekst('#afKm', afstandTekst(route.afstandM) + ' · ' + (route.intelligence ? route.intelligence.naam : 'RTG route'));
    tekst('#aankomst', tijdTekst(intel.aankomstAt));
    tekst('#arrivalState', intel.vertrouwen ? intel.vertrouwen + '% aankomstzekerheid' : 'Eigen routeberekening');
    tekst('#adviesTitel', (intel.advies && intel.advies.titel) || 'Beste route geselecteerd');
    tekst('#adviesReden', (intel.advies && intel.advies.reden) || 'RTG weegt de beschikbare route-informatie.');
    tekst('#vertrouwen', intel.vertrouwen ? intel.vertrouwen + '%' : '·');
    tekst('#vertraging', intel.vertragingMin ? '+' + intel.vertragingMin + ' min' : 'Geen');
    tekst('#energie', intel.energie && intel.energie.kwh != null ? N.getal(intel.energie.kwh, 1) + ' kWh' : 'N.v.t.');
    tekst('#verkeersbeeld', intel.verkeersbeeld || 'Rustig');
    document.querySelectorAll('#profielrij button').forEach(b => b.setAttribute('aria-pressed', b.dataset.profiel === S.profiel));
    // vervoerwijze met ETA
    const mr = $('#modusrij'); mr.textContent = '';
    for (const [k, nm] of [['auto', 'Auto'], ['ev', 'EV'], ['fiets', 'Fiets'], ['lopen', 'Lopen']]) {
      const b = knop('ds-chip', [nm + ' ' + route.etaMin[k] + '′'], () => {
        S.modus = k;
        if (k === 'ev') S.profiel = 'eco';
        else if (S.profiel === 'eco') S.profiel = 'slim';
        N.berekenRoute();
      });
      b.setAttribute('aria-pressed', k === S.modus); mr.appendChild(b);
    }
    const ar = $('#alternatieven'); ar.textContent = '';
    for (const alt of (route.alternatieven || [])) {
      const strong = document.createElement('strong'); strong.textContent = alt.naam;
      const meta = document.createElement('span'); meta.className = 'ds-meta';
      meta.textContent = alt.etaMin + ' min · ' + afstandTekst(alt.afstandM) + ' · ' + alt.vertrouwen + '% zeker';
      ar.appendChild(knop('ds-keuze', [strong, meta], () => { S.profiel = alt.profiel; N.berekenRoute(); }));
    }
    // stappen
    const ol = $('#stappen'); ol.textContent = '';
    const ICO = { start: '\u{1F3C1}', links: '↰', rechts: '↱', eind: '\u{1F4CD}' };
    for (const s of route.stappen) {
      const li = document.createElement('li'); li.className = 'ds-vel__rij';
      const pijl = document.createElement('span'); pijl.setAttribute('aria-hidden', 'true'); pijl.textContent = ICO[s.bocht] || '↑';
      const tk = document.createElement('span'); tk.className = 'ds-vel__naam'; tk.textContent = s.instructie;
      const df = document.createElement('span'); df.className = 'ds-meta'; df.textContent = s.afstandM ? afstandTekst(s.afstandM) : '';
      li.append(pijl, tk, df); ol.appendChild(li);
    }
    // langs de route: laadpalen, flits en partnersignalen
    const lg = $('#langs'); lg.textContent = '';
    const chip = t => { const c = document.createElement('span'); c.className = 'ds-chip'; c.textContent = t; lg.appendChild(c); };
    const nl = (route.langs.laad || []).length, nf = (route.langs.flits || []).length, np = (route.langs.partners || []).length;
    if (nl) chip(nl + ' laadpaal' + (nl > 1 ? 'punten' : '') + ' langs de route');
    if (nf) chip(nf + ' melding' + (nf > 1 ? 'en' : '') + ' op de route');
    if (np) chip(np + ' partnersignaal' + (np > 1 ? 'en' : '') + ' meegewogen');
    tekst('#bron', route.bron + '. ' + (route.privacy || 'Alles op codenaam.'));
    toon('#paneel', true);
  }
  $('#sluitPaneel').addEventListener('click', () => {
    toon('#paneel', false);
    document.body.classList.remove('nav-route', 'nav-actief'); S.navigerend = false;
    $('#startRoute').setAttribute('aria-pressed', 'false'); $('#startRoute').textContent = 'Start begeleiding';
    S.route = null; N.bouwRoute();
  });
  document.querySelectorAll('#profielrij button').forEach(b => b.addEventListener('click', () => {
    S.profiel = b.dataset.profiel;
    if (S.profiel === 'eco') S.modus = 'ev';
    N.berekenRoute();
  }));
  $('#startRoute').addEventListener('click', () => {
    S.navigerend = !S.navigerend;
    $('#startRoute').setAttribute('aria-pressed', S.navigerend);
    $('#startRoute').textContent = S.navigerend ? 'Begeleiding actief' : 'Start begeleiding';
    document.body.classList.toggle('nav-actief', S.navigerend);
    zeg(S.navigerend ? 'RTG volgt de route en herberekent bij nieuwe signalen.' : 'Begeleiding gepauzeerd.');
  });
})();
