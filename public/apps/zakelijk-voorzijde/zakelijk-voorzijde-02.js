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
