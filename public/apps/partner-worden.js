(() => {
  'use strict';
  const form = document.getElementById('aanvraag');
  const type = form.elements.type;
  const land = form.elements.landCode;
  const melding = document.getElementById('melding');
  const lijst = document.getElementById('statusLijst');
  const knop = document.getElementById('verstuur');
  const bewijsVelden = document.getElementById('bewijsVelden');
  const token = (() => { try { return localStorage.getItem('rtg_member_token') || ''; } catch (_) { return ''; } })();
  let catalogus = { types: [], activiteitEisen: {} };
  const veilig = waarde => String(waarde == null ? '' : waarde).replace(/[&<>"']/g, teken => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[teken]));
  const toon = (tekst, soort) => { melding.textContent = tekst; melding.className = 'msg on ' + (soort || ''); };
  const post = async (pad, body) => {
    const res = await fetch('/api' + pad, { method:'POST', headers:{'Content-Type':'application/json', ...(token ? {Authorization:'Bearer ' + token} : {})}, body:JSON.stringify(body || {}) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Dit lukte niet. Probeer het opnieuw.');
    return data;
  };

  function bewijsEisen() {
    const gekozen = catalogus.types.find(t => t.code === type.value);
    const nederlands = land.value === 'NL';
    const eisen = nederlands ? [...(gekozen && gekozen.eisen || [])] : [];
    const sectorVlaggen = ['voedsel', 'alcohol', 'pakketreis'];
    for (const vlag of sectorVlaggen) {
      const veld = form.elements[vlag];
      const eis = catalogus.activiteitEisen && catalogus.activiteitEisen[vlag];
      if (nederlands && veld && veld.checked && eis && !eisen.some(e => e.id === eis.id)) eisen.push(eis);
    }
    if (!nederlands && ((gekozen && gekozen.gereguleerd) || sectorVlaggen.some(v => form.elements[v].checked)))
      eisen.push(catalogus.handelEisen.sector_lokaal);
    const handelsVeld = { euBtw:'vies', douane:'eori', goederen:'goederencode', gecontroleerdeGoederen:'exportvergunning' };
    for (const [veld, id] of Object.entries(handelsVeld))
      if (form.elements[veld].checked) eisen.push(catalogus.handelEisen[id]);
    return eisen;
  }

  function tekenBewijzen() {
    const bewaard = {};
    bewijsVelden.querySelectorAll('[data-bewijs]').forEach(i => { bewaard[i.dataset.bewijs] = i.value; });
    const eisen = bewijsEisen();
    bewijsVelden.innerHTML = eisen.length ? '<small>Voor dit bedrijf zijn deze officiële referenties nodig. Vul alleen een nummer of registerverwijzing in; upload geen identiteitsbewijs.</small>' + eisen.map(e =>
      '<label>' + veilig(e.label) + '<input data-bewijs="' + veilig(e.id) + '" maxlength="120" value="' + veilig(bewaard[e.id] || '') + '" required placeholder="Registratie-, vergunning- of goederencodereferentie">' +
      '<small>Controle via ' + (e.url ? '<a href="' + veilig(e.url) + '" target="_blank" rel="noopener">' + veilig(e.bron) + '</a>' : veilig(e.bron)) + '</small></label>').join('') : '';
  }

  function stelLandIn() {
    const keuze = (catalogus.landen || []).find(l => l.code === land.value);
    if (!keuze) return;
    const nl = keuze.code === 'NL', us = keuze.code === 'US';
    const nummer = form.elements.registratieNummer;
    document.getElementById('registratieLabel').textContent = nl ? 'KVK-nummer' : 'Officieel registratienummer';
    nummer.inputMode = nl ? 'numeric' : 'text'; nummer.maxLength = nl ? 8 : 40;
    if (nl) { nummer.pattern = '[0-9]{8}'; nummer.minLength = 8; }
    else { nummer.removeAttribute('pattern'); nummer.removeAttribute('minlength'); }
    const vestiging = document.getElementById('vestigingVeld');
    vestiging.hidden = !nl; form.elements.vestigingsnummer.required = nl;
    const regio = document.getElementById('regioVeld');
    regio.hidden = !us; form.elements.regioOfStaat.required = us;
    const bronVeld = document.getElementById('registerBronVeld');
    bronVeld.hidden = nl; form.elements.registerBron.required = !nl;
    form.elements.registerBron.value = nl ? '' : (keuze.register && keuze.register.url || '');
    document.getElementById('registerHint').textContent = nl ? '' :
      'Gebruik de officiële overheidsbron. Suggestie: ' + (keuze.register && keuze.register.naam || 'nationaal ondernemingsregister') + '.';
    tekenBewijzen();
  }

  post('/partner/types').then(data => {
    catalogus = data;
    type.innerHTML = '<option value="">Kies een type</option>' + (data.types || []).map(t => '<option value="' + veilig(t.code) + '">' + veilig(t.label) + '</option>').join('');
    land.innerHTML = (data.landen || []).map(l => '<option value="' + veilig(l.code) + '"' + (l.code === 'NL' ? ' selected' : '') + '>' + veilig(l.naam) + '</option>').join('');
    stelLandIn();
  }).catch(err => { type.innerHTML = '<option value="">Niet beschikbaar</option>'; toon(err.message, 'bad'); });
  type.addEventListener('change', tekenBewijzen);
  land.addEventListener('change', stelLandIn);
  const vinkjes = ['voedsel', 'alcohol', 'pakketreis', 'internationaleHandel', 'goederen', 'euBtw', 'douane', 'gecontroleerdeGoederen', 'vsBetrokken'];
  vinkjes.forEach(naam => form.elements[naam].addEventListener('change', () => {
    if (!['voedsel', 'alcohol', 'pakketreis', 'internationaleHandel'].includes(naam) && form.elements[naam].checked)
      form.elements.internationaleHandel.checked = true;
    tekenBewijzen();
  }));

  const laadStatus = () => {
    if (!token) return;
    post('/partner/applications/mijn').then(data => {
      lijst.innerHTML = (data.aanvragen || []).length ? data.aanvragen.map(a => {
        const t = a.toelating || {};
        const controleTekst = t.status === 'klaar_voor_besluit' ? 'controles klaar' : (t.open || 0) + ' controle(s) open';
        return '<div class="status-row"><b>' + veilig(a.company) + '</b><span>' + veilig(a.city) + ' · ' + veilig(controleTekst) + '</span><span class="pill">' + veilig(a.status) + (a.code ? ' · ' + veilig(a.code) : '') + '</span></div>';
      }).join('') : '<p class="lead klein">Nog geen aanvragen met dit account.</p>';
    }).catch(err => { lijst.innerHTML = '<p class="lead klein">' + veilig(err.message) + '</p>'; });
  };

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!token) { toon('Open eerst de Business Pass en log in. Kom daarna terug naar dit formulier.', 'bad'); return; }
    if (!form.reportValidity()) return;
    knop.disabled = true;
    const data = Object.fromEntries(new FormData(form).entries());
    for (const naam of ['akkoord', 'bevoegd', 'waarheidsgetrouw', ...vinkjes]) data[naam] = form.elements[naam].checked;
    data.bewijzen = {};
    bewijsVelden.querySelectorAll('[data-bewijs]').forEach(i => { data.bewijzen[i.dataset.bewijs] = i.value.trim(); });
    try {
      const antwoord = await post('/partner/apply', data);
      toon('Aanvraag ontvangen. ' + antwoord.toelating.controles + ' controles bewaken nu de toelating; zonder compleet dossier ontstaat geen bedrijfscode.', 'good');
      form.reset(); land.value = 'NL'; stelLandIn(); laadStatus();
    } catch (err) { toon(err.message, 'bad'); }
    finally { knop.disabled = false; }
  });
  laadStatus();
})();
