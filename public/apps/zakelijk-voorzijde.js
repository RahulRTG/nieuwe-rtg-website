(() => {
  'use strict';
  /* Zakelijk vervoer op het RTG Design System (TRAVELOS-MIGRATIE.md, stroom
     D). Dezelfde zaakkern als ervoor: /api/supplier/mob/akkoord, /beleid en
     /zakelijk met het zaaktoken. Alleen de vorm komt nu uit /ds/, en bedragen
     volgen de taal van de gebruiker in plaats van vast nl-NL. */
  const $ = s => document.querySelector(s);
  const token = (() => { try { return localStorage.getItem('rtg_pda_token'); } catch (e) { return null; } })();
  const api = (pad, body) => fetch('/api/supplier/mob/' + pad, { method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify(body || {}) }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
  const taal = () => document.documentElement.lang || 'nl';
  let meldT;
  const zeg = t => { const m = $('#melding'); m.textContent = t; m.classList.add('toon');
    clearTimeout(meldT); meldT = setTimeout(() => m.classList.remove('toon'), 4600); };
  const eur = c => new Intl.NumberFormat(taal(), { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(c / 100);
  const leeg = el => { while (el.firstChild) el.removeChild(el.firstChild); };
  const maak = (tag, klas, tekst) => { const e = document.createElement(tag); if (klas) e.className = klas;
    if (tekst != null) e.textContent = tekst; return e; };
  const p = (waar, tekst, klas) => { const e = maak(waar.tagName === 'UL' ? 'li' : 'p', klas || 'ds-meta', tekst); waar.appendChild(e); return e; };
  const ICOON = '<svg class="ds-lijst__icoon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M5 16V9l2-4h10l2 4v7M5 16h14M7 19v-3m10 3v-3M5 11h14"/></svg>';
  const DAGNAMEN = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'];
  /* Een rij uit de lijst: icoon, titel met onderregel, en rechts een waarde of knoppen. */
  function rij(titel, sub, rechts) {
    const li = maak('li', 'ds-lijst__rij'); li.innerHTML = ICOON;
    const tekst = maak('span'); tekst.appendChild(maak('span', 'ds-lijst__titel', titel));
    if (sub) tekst.appendChild(maak('span', 'ds-lijst__tekst', sub));
    li.appendChild(tekst); li.appendChild(rechts || maak('span')); return li;
  }

  /* ---------------- de tabs ---------------- */
  const VLAKKEN = { akkoord: '#tAkkoord', beleid: '#tBeleid', overzicht: '#tOverzicht' };
  document.querySelectorAll('#tabs button').forEach(b => b.addEventListener('click', () => {
    document.querySelectorAll('#tabs button').forEach(x => x.setAttribute('aria-selected', String(x === b)));
    for (const [k, sel] of Object.entries(VLAKKEN)) $(sel).hidden = k !== b.dataset.tab;
    document.body.dataset.dsSchermtype = b.dataset.tab === 'beleid' ? 'taak' : 'collectie';
    /* Bij het openen van een tab meteen verse cijfers halen. Alleen de klok
       van 30 seconden laten werken betekent dat een werkgever die terugklikt
       naar "Op akkoord" een halve minuut naar een oude lijst kijkt. */
    if (b.dataset.tab === 'overzicht') haalOverzicht();
    if (b.dataset.tab === 'akkoord') haalWacht();
    if (b.dataset.tab === 'beleid') haalBeleid();
  }));

  /* ---------------- wat op akkoord wacht ---------------- */
  async function haalWacht() {
    const r = await api('akkoord', {});
    const waar = $('#lijstWacht'); leeg(waar);
    if (r.status !== 200) { p(waar, r.body.error || 'Geen toegang tot de goedkeuringen.'); return; }
    if (!(r.body.wachtend || []).length) { p(waar, r.body.uitleg || 'Er wacht niets op uw akkoord.'); return; }
    for (const w of r.body.wachtend) {
      const knoppen = maak('span', 'ds-veldgroep');
      const ja = maak('button', 'ds-knop ds-knop--primair ds-knop--klein', 'Akkoord'); ja.type = 'button';
      const nee = maak('button', 'ds-knop ds-knop--stil ds-knop--klein', 'Weiger'); nee.type = 'button';
      ja.addEventListener('click', () => besluit(w.ref, true));
      nee.addEventListener('click', () => besluit(w.ref, false));
      knoppen.append(ja, nee);
      waar.appendChild(rij(w.van.label + ' → ' + w.naar.label,
        w.medewerker + ' · ' + eur(w.prijs) + ' · ' + w.km + ' km · ' + w.ritsoort +
        (w.kostenplaats ? ' · ' + w.kostenplaats : ' · zonder kostenplaats') +
        (w.drempel ? ' · drempel ' + eur(w.drempel) : ''), knoppen));
    }
  }
  async function besluit(ref, akkoord) {
    const r = await api('akkoord', { ref, akkoord });
    zeg(r.body.error || r.body.uitleg || 'Besluit genomen.');
    haalWacht();
  }

  /* ---------------- het reisbeleid ---------------- */
  let dagen = [];
  function tekenDagen() {
    const waar = $('#bDagen'); leeg(waar);
    DAGNAMEN.forEach((naam, i) => {
      const b = maak('button', 'ds-chip', naam); b.type = 'button';
      b.setAttribute('aria-pressed', String(dagen.includes(i)));
      b.addEventListener('click', () => {
        beleidBewerking++;
        dagen = dagen.includes(i) ? dagen.filter(d => d !== i) : dagen.concat([i]).sort();
        tekenDagen();
      });
      waar.appendChild(b);
    });
  }
  const invoerInCenten = el => Math.round((Number(el.value) || 0) * 100);
  const naarEuro = c => (c ? (c / 100) : '');

  function vulBeleid(b) {
    $('#bMax').value = naarEuro(b && b.maxPrijs);
    $('#bDrempel').value = naarEuro(b && b.goedkeuringVanaf);
    $('#bBudget').value = naarEuro(b && b.budgetPerMaand);
    $('#bVan').value = (b && b.van) || '';
    $('#bTot').value = (b && b.tot) || '';
    dagen = (b && b.dagen) || []; tekenDagen();
    $('#bSteden').value = ((b && b.steden) || []).join(', ');
    $('#bKp').value = ((b && b.kostenplaatsen) || []).join(', ');
    $('#bKpVerplicht').value = b && b.kostenplaatsVerplicht ? '1' : '0';
    spiegel(b);
  }
  /* De spiegel: dezelfde zinnen die een medewerker te lezen krijgt, hier naast
     de knoppen. Een werkgever die niet ziet hoe zijn beleid klinkt, zet een
     grens die niemand begrijpt. */
  function spiegel(b) {
    const waar = $('#beleidSpiegel'); leeg(waar);
    if (!b) { p(waar, 'Er is nog geen reisbeleid; dan gelden er geen grenzen behalve die van de vervoerder.'); return; }
    const zinnen = [];
    if (b.maxPrijs) zinnen.push('Boven ' + eur(b.maxPrijs) + ' per rit: "Deze rit kost … ; het maximum per rit is ' + eur(b.maxPrijs) + '."');
    if (b.budgetPerMaand) zinnen.push('Over het budget: "… uw budget is ' + eur(b.budgetPerMaand) + ' (nu besteed: …)."');
    if (b.goedkeuringVanaf) zinnen.push('Vanaf ' + eur(b.goedkeuringVanaf) + ' gaat de rit eerst langs u; hij wordt niet geweigerd.');
    if (b.van && b.tot) zinnen.push('Buiten ' + b.van + ' tot ' + b.tot + ': "Zakelijk reizen mag tussen ' + b.van + ' en ' + b.tot + '."');
    if ((b.dagen || []).length) zinnen.push('Alleen op ' + b.dagnamen.join(', ') + '.');
    if ((b.steden || []).length) zinnen.push('Alleen in ' + b.steden.join(', ') + '.');
    if (b.kostenplaatsVerplicht) zinnen.push('Zonder kostenplaats gaat de rit niet door.');
    if (!zinnen.length) { p(waar, 'Er staan geen grenzen ingesteld: elke zakelijke rit gaat gewoon door.'); return; }
    for (const z of zinnen) p(waar, z);
  }

  /* Alleen de nieuwste leesaanvraag mag het formulier tekenen. Bij een trage
     verbinding konden de opstartaanvraag en de tab-aanvraag NA een zojuist
     opgeslagen beleid binnenkomen en de zichtbare keuze terugzetten. */
  let beleidVraag = 0;
  let beleidBewerking = 0;
  /* Een verse serverlezing mag een invoer die de werkgever intussen begon
     nooit terugzetten. De tab start bewust een achtergrondlezing; op een
     trage machine kon die NA de eerste toetsaanslag binnenkomen en vlak voor
     Bewaren de drempel weer leegmaken. De vraagvolgorde beschermt tegen oude
     lezingen onderling, deze teller beschermt de gebruiker tegen elke lezing
     die vóór diens laatste bewerking begon. */
  document.querySelectorAll('#tBeleid input, #tBeleid select').forEach(el => {
    el.addEventListener('input', () => { beleidBewerking++; });
    el.addEventListener('change', () => { beleidBewerking++; });
  });
  async function haalBeleid() {
    const vraag = ++beleidVraag;
    const bewerking = beleidBewerking;
    const r = await api('beleid', {});
    if (vraag !== beleidVraag || bewerking !== beleidBewerking) return;
    if (r.status !== 200) { $('#bStand').textContent = r.body.error || 'Geen toegang.'; return; }
    vulBeleid(r.body.beleid);
    $('#bStand').textContent = r.body.beleid && r.body.beleid.gewijzigd
      ? 'Laatst gewijzigd op ' + r.body.beleid.gewijzigd.slice(0, 10) + ' door ' + (r.body.beleid.door || 'de werkgever') + '.'
      : (r.body.reden || '');
  }
  $('#bBewaar').addEventListener('click', async () => {
    const lijst = s => s.split(',').map(x => x.trim()).filter(Boolean);
    /* Maak alle oudere GETs ongeldig voordat de mutatie onderweg gaat. */
    beleidVraag++;
    const r = await api('beleid', { zet: true,
      maxPrijs: invoerInCenten($('#bMax')), goedkeuringVanaf: invoerInCenten($('#bDrempel')),
      budgetPerMaand: invoerInCenten($('#bBudget')),
      van: $('#bVan').value || null, tot: $('#bTot').value || null,
      dagen, steden: lijst($('#bSteden').value), kostenplaatsen: lijst($('#bKp').value),
      kostenplaatsVerplicht: $('#bKpVerplicht').value === '1' });
    if (r.body.error) { zeg(r.body.error); return; }
    zeg('Het reisbeleid is bewaard.');
    vulBeleid(r.body.beleid);
    haalBeleid();
  });

  /* ---------------- het maandoverzicht (zakelijk-overzicht.js) ---------------- */
  const haalOverzicht = window.RTGZakelijkOverzicht({ $, api, eur, leeg, p, maak, rij });
  $('#oHaal').addEventListener('click', haalOverzicht);

  /* ---------------- opstarten ---------------- */
  (async () => {
    if (!token) { $('#vPoort').hidden = false; return; }
    const r = await api('beleid', {});
    if (r.status !== 200) { $('#vPoort').hidden = false; return; }
    $('#vBeeld').hidden = false;
    // de naam die de werkgever van zichzelf kent, niet zijn partnercode
    $('#zaakNaam').textContent = r.body.naam || (r.body.beleid && r.body.beleid.org) || 'uw bedrijf';
    tekenDagen();
    vulBeleid(r.body.beleid);
    haalBeleid();
    haalWacht();
    setInterval(haalWacht, 30000);
  })();
})();
