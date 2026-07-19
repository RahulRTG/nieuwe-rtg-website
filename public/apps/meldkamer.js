/* RTG Meldkamer: het werkscherm van de zes hulpdienst-korpsen. Inloggen op
   naam met PIN (personeelslogin van de zaak), daarna het bord: meldingen
   aannemen en toewijzen, eenheden over land, water en door de lucht,
   bijstand, het beddenbord van het ziekenhuis, de consulten van de
   huisarts, en de meldkamer-AI. */
(() => {
  const $ = s => document.querySelector(s);
  const esc = t => String(t == null ? '' : t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let token = '';
  try { token = sessionStorage.getItem('rtg_meldkamer_token') || ''; } catch (e) {}
  let korps = null;

  async function api(pad, body) {
    const r = await fetch('/api/supplier/' + pad, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
      body: JSON.stringify(body || {})
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || 'Er ging iets mis.');
    return d;
  }

  /* ---------- aanmelden ---------- */
  $('#lZoek').addEventListener('click', async () => {
    $('#lFout').textContent = '';
    try {
      const d = await api('roster', { code: $('#lCode').value.trim().toUpperCase() });
      $('#lWie').innerHTML = d.staff.map(m => '<option value="' + m.id + '">' + esc(m.name) + ' (' + esc(m.func || m.role) + ')</option>').join('');
      $('#lWieRij').hidden = false;
    } catch (e) { $('#lFout').textContent = e.message; }
  });
  $('#lIn').addEventListener('click', async () => {
    $('#lFout').textContent = '';
    try {
      const d = await api('login', { code: $('#lCode').value.trim().toUpperCase(), staffId: Number($('#lWie').value), pin: $('#lPin').value });
      token = d.token;
      try { sessionStorage.setItem('rtg_meldkamer_token', token); } catch (e) {}
      start();
    } catch (e) { $('#lFout').textContent = e.message; }
  });
  $('#lPin').addEventListener('keydown', e => { if (e.key === 'Enter') $('#lIn').click(); });

  /* ---------- het bord ---------- */
  async function laad() {
    let d;
    try {
      d = await api('hulp/overzicht');
    } catch (e) {
      // de zorg-zaken (apotheek, specialist, beauty medical) hebben geen
      // meldkamer; zij draaien alleen op het zorg-bord hieronder
      d = null;
    }
    document.querySelectorAll('#kMeldkamer, #kEenheden, #kAi').forEach(el => { el.hidden = !d; });
    await laadZorg(d);
    if (!d) return;
    korps = d;
    $('#titel').textContent = '🚨 ' + d.korps.naam;
    $('#wie').textContent = d.korps.label;
    // special forces nemen zelf niets aan; hun werk komt via bijstand binnen
    $('#rNieuw').hidden = ['specials', 'ziekenhuis', 'huisarts'].includes(d.korps.soort);
    const alle = [...(d.bijstand || []).map(m => ({ ...m, viaBijstand: true })), ...(d.meldingen || [])];
    $('#meldingen').innerHTML = alle.length ? alle.map(m => {
      const vrij = (d.eenheden || []).filter(e => e.status === 'vrij');
      const kanWijzen = m.status !== 'afgerond';
      return '<div class="melding"><span class="prio p' + m.prio + '">P' + m.prio + '</span><b>' + esc(m.tekst) + '</b>' +
        (m.plek ? ' · ' + esc(m.plek) : '') + ' · ' + esc(m.status) + (m.viaBijstand ? ' · <span style="color:var(--gold);">bijstandsverzoek</span>' : '') +
        '<div class="rij">' +
        (kanWijzen && vrij.length ? '<select data-wijs-e="' + m.id + '">' + vrij.map(e => '<option value="' + e.id + '">' + esc(e.naam) + ' (' + e.soort + ')</option>').join('') + '</select>' +
          '<button class="knop klein" data-wijs="' + m.id + '" type="button">Stuur</button>' : '') +
        (kanWijzen ? '<button class="knop klein" data-status="ter-plaatse" data-m="' + m.id + '" type="button">Ter plaatse</button>' +
          '<button class="knop klein" data-status="afgerond" data-m="' + m.id + '" type="button">Rond af</button>' : '') +
        (!m.viaBijstand && kanWijzen && (d.korpsen || []).length ? '<select data-bij-k="' + m.id + '">' + d.korpsen.map(k => '<option value="' + k.code + '">' + esc(k.naam) + '</option>').join('') + '</select>' +
          '<button class="knop klein" data-bij="' + m.id + '" type="button">Vraag bijstand</button>' : '') +
        '</div>' +
        '<div class="log">' + (m.logboek || []).slice(-3).map(l => esc(l.wat)).join(' · ') + '</div></div>';
    }).join('') : '<p class="stil">Geen meldingen op het bord.</p>';
    $('#eenheden').innerHTML = (d.eenheden || []).map(e =>
      '<span class="eenheid ' + e.status + '">' + esc(e.naam) + ' · ' + e.soort + ' · ' + e.status +
      (e.status === 'vrij' ? ' <button class="knop klein" data-ezet="buiten-dienst" data-e="' + e.id + '" type="button">buiten dienst</button>'
        : e.status === 'buiten-dienst' ? ' <button class="knop klein" data-ezet="vrij" data-e="' + e.id + '" type="button">weer vrij</button>' : '') +
      '</span>').join('') || '<span class="stil">Nog geen eenheden; zet ze hieronder op het bord.</span>';
    // de kaarten per soort korps
    $('#kZiekenhuis').hidden = d.korps.soort !== 'ziekenhuis';
    if (d.bedden) {
      $('#bedden').textContent = 'Bedden: ' + d.bedden.bezet + ' bezet van ' + d.bedden.totaal + '.';
      $('#opnames').innerHTML = (d.opnames || []).map(o =>
        '<div class="melding">' + esc(o.triage) + ' · van ' + esc(o.van) + ' · ' + esc(o.status) +
        (o.status === 'aangekondigd' ? '<div class="rij"><button class="knop klein" data-op="opgenomen" data-o="' + o.id + '" type="button">Neem op</button>' +
          '<button class="knop klein" data-op="geweigerd" data-o="' + o.id + '" type="button">Weiger</button></div>' :
          o.status === 'opgenomen' ? '<div class="rij"><button class="knop klein" data-op="ontslagen" data-o="' + o.id + '" type="button">Ontsla</button></div>' : '') +
        '</div>').join('') || '<p class="stil">Geen opnames aangekondigd.</p>';
    }
    $('#kOverdracht').hidden = !(d.ziekenhuizen && d.ziekenhuizen.length);
    if (d.ziekenhuizen) $('#oZiekenhuis').innerHTML = d.ziekenhuizen.map(z =>
      '<option value="' + z.code + '">' + esc(z.naam) + ' (' + z.bedden.bezet + '/' + z.bedden.totaal + ' bezet)</option>').join('');
    $('#kConsulten').hidden = d.korps.soort !== 'huisarts';
    if (d.consulten) $('#consulten').innerHTML = d.consulten.map(c =>
      '<div class="melding">' + esc(c.klacht) + ' · ' + esc(c.urgentie) + (c.wanneer ? ' · ' + esc(c.wanneer) : '') + ' · ' + esc(c.status) +
      (c.status === 'gepland' ? '<div class="rij"><button class="knop klein" data-cz="afgerond" data-c="' + c.id + '" type="button">Rond af</button>' +
        '<button class="knop klein" data-cz="verwezen" data-c="' + c.id + '" type="button">Verwijs door</button></div>' : '') +
      '</div>').join('') || '<p class="stil">Geen consulten gepland.</p>';
    bind();
  }
  /* ---------- het zorg-bord: recepten, SEH, verwijzingen, afspraken ---------- */
  const TRIAGE_KLEUR = { rood: 'var(--rood)', oranje: '#E08A3C', geel: 'var(--gold)', groen: 'var(--groen)', blauw: '#6FA8DC' };
  async function laadZorg(hulpBord) {
    let z = null;
    try { z = await api('zorg/overzicht'); } catch (e) { z = null; }
    ['#kReceptie', '#kSeh', '#kRecepten', '#kVoorschrijf', '#kVerwijs', '#kInbox', '#kAfspraken'].forEach(s => { $(s).hidden = true; });
    if (!z) return;
    if (!hulpBord) { $('#titel').textContent = '🩺 ' + z.zaak.naam; $('#wie').textContent = z.zaak.label; }
    if (z.receptie) {
      $('#kReceptie').hidden = false;
      $('#wachtkamer').innerHTML = z.receptie.length ? z.receptie.map(p =>
        '<div class="melding"><b>' + esc(p.aanduiding) + '</b>' + (p.reden ? ' · ' + esc(p.reden) : '') + ' · ' + esc(p.status) + (p.kamer ? ' (' + esc(p.kamer) + ')' : '') +
        '<div class="rij">' +
        (p.status === 'wacht' ? '<input class="veld" data-pkamer="' + p.id + '" placeholder="Kamer" maxlength="30" style="max-width:8rem;">' +
          '<button class="knop klein" data-proep="' + p.id + '" type="button">Roep op</button>' : '') +
        '<button class="knop klein" data-pklaar="' + p.id + '" type="button">Klaar</button></div></div>').join('')
        : '<p class="stil">De wachtkamer is leeg.</p>';
    }
    if (z.seh) {
      $('#kSeh').hidden = false;
      $('#sehRij').innerHTML = z.seh.length ? z.seh.map(p =>
        '<div class="melding"><span class="prio" style="color:' + TRIAGE_KLEUR[p.triage] + ';border-color:' + TRIAGE_KLEUR[p.triage] + ';">' + esc(p.triage) + '</span>' +
        esc(p.klacht) + ' · via ' + esc(p.via) + ' · ' + esc(p.status) +
        '<div class="rij"><button class="knop klein" data-seh="in-behandeling" data-p="' + p.id + '" type="button">In behandeling</button>' +
        '<button class="knop klein" data-seh="opgenomen" data-p="' + p.id + '" type="button">Neem op</button>' +
        '<button class="knop klein" data-seh="naar-huis" data-p="' + p.id + '" type="button">Naar huis</button></div></div>').join('')
        : '<p class="stil">De wachtkamer is leeg.</p>';
    }
    if (z.recepten) {
      $('#kRecepten').hidden = false;
      $('#recepten').innerHTML = z.recepten.length ? z.recepten.map(r =>
        '<div class="melding"><b>' + esc(r.middel) + '</b>' + (r.dosering ? ' · ' + esc(r.dosering) : '') + ' · van ' + esc(r.van) + ' · ' + esc(r.status) +
        (r.status !== 'uitgereikt' ? '<div class="rij"><button class="knop klein" data-rz="klaar" data-r="' + r.id + '" type="button">Zet klaar</button>' +
          '<button class="knop klein" data-rz="uitgereikt" data-r="' + r.id + '" type="button">Reik uit</button></div>' : '') +
        '</div>').join('') : '<p class="stil">Geen recepten in de rij.</p>';
    }
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
    const opties = (st.kanalen || []).map(k => '<option value="' + k.id + '">' + esc(k.naam) + '</option>').join('');
    const had = $('#ktKanaal').value;
    $('#ktKanaal').innerHTML = opties || '<option value="">nog geen kanalen</option>';
    if (had && [...$('#ktKanaal').options].some(o => o.value === had)) $('#ktKanaal').value = had;
    ktGekozen = $('#ktKanaal').value || 'keten';
    $('#ktGroepKorps').innerHTML = [st.eigen, ...(st.partners || [])].filter(Boolean)
      .map(c => '<option value="' + c + '">' + c + '</option>').join('');
    laadKetenGesprek();
  }
  async function laadKetenGesprek() {
    if (!ktGekozen) { $('#ktChat').innerHTML = ''; return; }
    try {
      const g = await api('keten/gesprek', { kanaal: ktGekozen });
      $('#ktChat').innerHTML = (g.berichten || []).map(m =>
        '<div class="b"><span class="stil" style="display:block;font-size:0.68rem;">' + esc(m.van) + ' · ' + esc(m.korpsNaam || m.korps) + '</span>' + esc(m.tekst) + '</div>').join('')
        || '<p class="stil">Nog geen berichten' + (g.kijktMee ? ' (u kijkt mee als meldkamer)' : '') + '.</p>';
      $('#ktTekst').disabled = g.magSchrijven === false;
      $('#ktTekst').placeholder = g.magSchrijven === false ? 'U kijkt mee als meldkamer; alleen de leden schrijven.' : 'Bericht aan de keten of de groep';
      $('#ktChat').scrollTop = $('#ktChat').scrollHeight;
    } catch (e) { $('#ktChat').innerHTML = '<p class="stil">' + esc(e.message) + '</p>'; }
  }
  async function ktDoe(pad, body) {
    try { await api(pad, body); laadKeten(); } catch (e) { $('#ktUit').textContent = e.message; }
  }
  $('#ktNodig').addEventListener('click', () => { if ($('#ktKandidaat').value) ktDoe('keten/verzoek', { korps: $('#ktKandidaat').value }); });
  $('#ktKanaal').addEventListener('change', () => { ktGekozen = $('#ktKanaal').value; laadKetenGesprek(); });
  $('#ktStuur').addEventListener('click', async () => {
    const t = $('#ktTekst').value.trim();
    if (!t) return;
    $('#ktTekst').value = '';
    try { await api('keten/bericht', { kanaal: ktGekozen, tekst: t }); laadKetenGesprek(); } catch (e) { $('#ktUit').textContent = e.message; }
  });
  $('#ktTekst').addEventListener('keydown', e => { if (e.key === 'Enter') $('#ktStuur').click(); });
  // een besloten deelgroep maken: mensen per korps ophalen en aanvinken
  let ktGroepKeuze = [];
  $('#ktGroepToon').addEventListener('click', () => { $('#ktGroepMaak').hidden = !$('#ktGroepMaak').hidden; });
  $('#ktGroepRoster').addEventListener('click', async () => {
    const code = $('#ktGroepKorps').value;
    if (!code) return;
    try {
      const d = await api('roster', { code });
      $('#ktGroepLeden').insertAdjacentHTML('beforeend', d.staff.map(m =>
        '<label class="stil" style="font-size:0.75rem;display:flex;gap:0.3rem;align-items:center;"><input type="checkbox" data-ktlid="' + code + ':' + m.id + ':' + esc(m.name) + '">' + esc(m.name) + ' (' + code + ')</label>').join(''));
    } catch (e) { $('#ktUit').textContent = e.message; }
  });
  $('#ktGroepMaakKnop').addEventListener('click', async () => {
    ktGroepKeuze = [...document.querySelectorAll('[data-ktlid]:checked')].map(c => {
      const [code, staffId, naam] = c.dataset.ktlid.split(':');
      return { code, staffId: Number(staffId), naam };
    });
    try {
      await api('keten/groep/maak', { naam: $('#ktGroepNaam').value, leden: ktGroepKeuze });
      $('#ktGroepMaak').hidden = true;
      $('#ktGroepLeden').innerHTML = '';
      $('#ktGroepNaam').value = '';
      $('#ktUit').textContent = 'De groep staat; alleen de leden schrijven, de meldkamer-chefs kijken mee.';
      laadKeten();
    } catch (e) { $('#ktUit').textContent = e.message; }
  });

  function start() {
    $('#vLogin').hidden = true;
    $('#vBord').hidden = false;
    $('#noodKnop').hidden = false;
    laad().then(laadKeten).catch(e => { $('#vLogin').hidden = false; $('#vBord').hidden = true; $('#lFout').textContent = e.message; token = ''; });
  }
  setInterval(() => { if (!$('#vBord').hidden && !document.hidden) laad().catch(() => {}); }, 20000);
  if (token) start();
})();
