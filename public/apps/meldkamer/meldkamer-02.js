    if (z.apotheken) {
      $('#kVoorschrijf').hidden = false;
      $('#rApotheek').innerHTML = z.apotheken.map(a => '<option value="' + a.code + '">' + esc(a.naam) + '</option>').join('');
      $('#eigenRecepten').innerHTML = (z.eigenRecepten || []).slice(0, 5).map(r => esc(r.middel) + ' (' + esc(r.status) + ')').join('<br>');
    }
    if (z.verwijsDoelen && z.verwijsDoelen.length) {
      $('#kVerwijs').hidden = false;
      $('#vNaar').innerHTML = z.verwijsDoelen.map(v => '<option value="' + v.code + '">' + esc(v.naam) + ' (' + esc(v.soort) + ')</option>').join('');
    }
    if (z.verwijzingen) {
      $('#kInbox').hidden = false;
      $('#verwijzingen').innerHTML = z.verwijzingen.length ? z.verwijzingen.map(v =>
        '<div class="melding">' + esc(v.reden) + ' · van ' + esc(v.van) + ' · ' + esc(v.status) +
        (v.status === 'nieuw' || v.status === 'gepland' ? '<div class="rij"><button class="knop klein" data-vz="gepland" data-v="' + v.id + '" type="button">Plan</button>' +
          '<button class="knop klein" data-vz="gezien" data-v="' + v.id + '" type="button">Gezien</button>' +
          '<button class="knop klein" data-vz="terugverwezen" data-v="' + v.id + '" type="button">Terug</button></div>' : '') +
        '</div>').join('') : '<p class="stil">Geen verwijzingen in de inbox.</p>';
    }
    if (z.afspraken) {
      $('#kAfspraken').hidden = false;
      $('#aIntakeRij').hidden = z.soort !== 'beautymedical';
      $('#afspraken').innerHTML = z.afspraken.length ? z.afspraken.map(a =>
        '<div class="melding">' + esc(a.wat) + (a.wanneer ? ' · ' + esc(a.wanneer) : '') + ' · ' + esc(a.status) +
        (a.status === 'gepland' ? '<div class="rij"><button class="knop klein" data-az="afgerond" data-a="' + a.id + '" type="button">Rond af</button>' +
          '<button class="knop klein" data-az="geannuleerd" data-a="' + a.id + '" type="button">Annuleer</button></div>' : '') +
        '</div>').join('') : '<p class="stil">De agenda is leeg.</p>';
    }
    document.querySelectorAll('[data-proep]').forEach(b => b.addEventListener('click', () =>
      doe('zorg/receptie/roep', { id: b.dataset.proep, kamer: (document.querySelector('[data-pkamer="' + b.dataset.proep + '"]') || {}).value })));
    document.querySelectorAll('[data-pklaar]').forEach(b => b.addEventListener('click', () => doe('zorg/receptie/klaar', { id: b.dataset.pklaar })));
    document.querySelectorAll('[data-seh]').forEach(b => b.addEventListener('click', () => doe('zorg/seh/zet', { id: b.dataset.p, status: b.dataset.seh })));
    document.querySelectorAll('[data-rz]').forEach(b => b.addEventListener('click', () => doe('zorg/recept/zet', { id: b.dataset.r, status: b.dataset.rz })));
    document.querySelectorAll('[data-vz]').forEach(b => b.addEventListener('click', () => doe('zorg/verwijs/zet', { id: b.dataset.v, status: b.dataset.vz })));
    document.querySelectorAll('[data-az]').forEach(b => b.addEventListener('click', () => doe('zorg/afspraak/zet', { id: b.dataset.a, status: b.dataset.az })));
  }

  function bind() {
    document.querySelectorAll('[data-wijs]').forEach(b => b.addEventListener('click', () =>
      doe('hulp/melding/wijs', { melding: b.dataset.wijs, eenheid: (document.querySelector('[data-wijs-e="' + b.dataset.wijs + '"]') || {}).value })));
    document.querySelectorAll('[data-status]').forEach(b => b.addEventListener('click', () =>
      doe('hulp/melding/status', { melding: b.dataset.m, status: b.dataset.status })));
    document.querySelectorAll('[data-bij]').forEach(b => b.addEventListener('click', () =>
      doe('hulp/bijstand', { melding: b.dataset.bij, korps: (document.querySelector('[data-bij-k="' + b.dataset.bij + '"]') || {}).value })));
    document.querySelectorAll('[data-ezet]').forEach(b => b.addEventListener('click', () =>
      doe('hulp/eenheid/zet', { id: b.dataset.e, status: b.dataset.ezet })));
    document.querySelectorAll('[data-op]').forEach(b => b.addEventListener('click', () =>
      doe('hulp/opname/zet', { id: b.dataset.o, status: b.dataset.op })));
    document.querySelectorAll('[data-cz]').forEach(b => b.addEventListener('click', () =>
      doe('hulp/consult/zet', { id: b.dataset.c, status: b.dataset.cz })));
  }
  async function doe(pad, body) {
    try { await api(pad, body); laad(); } catch (e) { alert(e.message); }
  }
  $('#mMaak').addEventListener('click', () => {
    const tekst = $('#mTekst').value.trim();
    if (!tekst) return;
    doe('hulp/melding/maak', { tekst, plek: $('#mPlek').value, prio: Number($('#mPrio').value) });
    $('#mTekst').value = ''; $('#mPlek').value = '';
  });
  $('#eMaak').addEventListener('click', () => {
    const naam = $('#eNaam').value.trim();
    if (!naam) return;
    doe('hulp/eenheid/maak', { naam, soort: $('#eSoort').value });
    $('#eNaam').value = '';
  });
  $('#bZet').addEventListener('click', () => doe('hulp/bedden', { totaal: Number($('#bTotaal').value) }));
  $('#oMaak').addEventListener('click', async () => {
    try {
      const r = await api('hulp/overdracht', { ziekenhuis: $('#oZiekenhuis').value, triage: $('#oTriage').value });
      $('#oUit').textContent = 'Aangekondigd bij het ziekenhuis.' + (r.waarschuwing ? ' ' + r.waarschuwing : '');
      $('#oTriage').value = '';
    } catch (e) { $('#oUit').textContent = e.message; }
  });
  $('#cMaak').addEventListener('click', () => {
    const klacht = $('#cKlacht').value.trim();
    if (!klacht) return;
    doe('hulp/consult/maak', { klacht, urgentie: $('#cUrgentie').value, wanneer: $('#cWanneer').value });
    $('#cKlacht').value = '';
  });
  $('#pAan').addEventListener('click', () => {
    const aanduiding = $('#pAanduiding').value.trim();
    if (!aanduiding) return;
    doe('zorg/receptie/aan', { aanduiding, reden: $('#pReden').value });
    $('#pAanduiding').value = ''; $('#pReden').value = '';
  });
  $('#sBinnen').addEventListener('click', () => {
    const klacht = $('#sKlacht').value.trim();
    if (!klacht) return;
    doe('zorg/seh/binnen', { klacht, triage: $('#sTriage').value, via: $('#sVia').value });
    $('#sKlacht').value = '';
  });
  $('#rSchrijf').addEventListener('click', () => {
    const middel = $('#rMiddel').value.trim();
    if (!middel) return;
    doe('zorg/recept/maak', { apotheek: $('#rApotheek').value, middel, dosering: $('#rDosering').value });
    $('#rMiddel').value = ''; $('#rDosering').value = '';
  });
  $('#vStuur').addEventListener('click', async () => {
    try {
      await api('zorg/verwijs/maak', { naar: $('#vNaar').value, reden: $('#vReden').value });
      $('#vUit').textContent = 'Verwezen; de specialist ziet hem in de inbox.';
      $('#vReden').value = '';
    } catch (e) { $('#vUit').textContent = e.message; }
  });
  $('#aMaak').addEventListener('click', async () => {
    try {
      await api('zorg/afspraak/maak', { wat: $('#aWat').value, wanneer: $('#aWanneer').value, intake: $('#aIntake').checked });
      $('#aUit').textContent = 'Ingepland.';
      $('#aWat').value = '';
      laad();
    } catch (e) { $('#aUit').textContent = e.message; }
  });
  $('#aiStuur').addEventListener('click', async () => {
    const q = $('#aiVraag').value.trim();
    if (!q) return;
    $('#aiVraag').value = '';
    const chat = $('#aiChat');
    chat.insertAdjacentHTML('beforeend', '<div class="b ik">' + esc(q) + '</div>');
    try {
      const r = await api('hulp/ai', { q });
      chat.insertAdjacentHTML('beforeend', '<div class="b">' + esc(r.antwoord) + '</div>');
    } catch (e) { chat.insertAdjacentHTML('beforeend', '<div class="b">' + esc(e.message) + '</div>'); }
    chat.scrollTop = chat.scrollHeight;
  });
  $('#aiVraag').addEventListener('keydown', e => { if (e.key === 'Enter') $('#aiStuur').click(); });

  /* ---------- de interne noodknop: het hele team + RTG in een tik ---------- */
  $('#noodKnop').addEventListener('click', () => {
    const reden = prompt('Interne noodoproep: wat is er aan de hand? (bijv. agressieve bezoeker bij de balie)') || '';
    if (reden === '' && !confirm('Zonder omschrijving alarmeren?')) return;
    const vuur = (lat, lng) => api('security', { lat, lng, note: reden }).then(() => {
      $('#ktUit').textContent = 'Noodoproep verstuurd; het hele team en RTG zijn gealarmeerd.';
    }).catch(e => alert(e.message));
    if (navigator.geolocation) {
      let klaar = false;
      const een = (lat, lng) => { if (!klaar) { klaar = true; vuur(lat, lng); } };
      navigator.geolocation.getCurrentPosition(p => een(p.coords.latitude, p.coords.longitude), () => een(), { timeout: 2500 });
      setTimeout(() => een(), 3200);
    } else vuur();
  });

  /* ---------- de ketenchat ---------- */
  let ktGekozen = 'keten';
  async function laadKeten() {
    let st = null;
    try { st = await api('keten/status'); } catch (e) { $('#kKeten').hidden = true; return; }
    $('#kKeten').hidden = false;
    $('#ktKandidaat').innerHTML = (st.kandidaten || []).map(k => '<option value="' + k.code + '">' + esc(k.naam) + '</option>').join('');
    $('#ktLinks').textContent = (st.links || []).filter(l => l.status === 'akkoord').map(l => l.metNaam).join(' · ') || 'nog niet verbonden';
    $('#ktInkomend').innerHTML = (st.links || []).filter(l => l.inkomend).map(l =>
      '<span class="stil" style="font-size:0.78rem;">' + esc(l.metNaam) + ' nodigt u uit</span>' +
      '<button class="knop klein" data-ktja="' + l.met + '" type="button">Akkoord</button>' +
      '<button class="knop klein" data-ktnee="' + l.met + '" type="button">Weiger</button>').join('');
    document.querySelectorAll('[data-ktja]').forEach(b => b.addEventListener('click', () => ktDoe('keten/beslis', { korps: b.dataset.ktja, akkoord: true })));
    document.querySelectorAll('[data-ktnee]').forEach(b => b.addEventListener('click', () => ktDoe('keten/beslis', { korps: b.dataset.ktnee, akkoord: false })));
