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

  /* ---------- het gezamenlijke rampbeeld ---------- */
  const NIVEAUS = ['normaal', 'incident', 'opgeschaald', 'ramp'];
  async function laadRamp() {
    let b = null;
    try { b = await api('keten/rampbeeld'); } catch (e) { $('#kRamp').hidden = true; return; }
    $('#kRamp').hidden = false;
    const nu = (b.ramp && b.ramp.niveau) || 'normaal';
    $('#rampNiveau').innerHTML = NIVEAUS.map(n => '<button class="nvl' + (n === nu ? ' on' : '') + '" data-nvl="' + n + '" type="button">' + n + '</button>').join('') +
      (b.ramp && b.ramp.door ? '<span class="stil" style="font-size:0.72rem;">gezet door ' + esc(b.ramp.door) + '</span>' : '');
    const t = b.totalen;
    $('#rampKpis').innerHTML =
      '<div class="rkpi"><b style="color:var(--groen);">' + t.eenhedenVrij + '</b><span>eenheden vrij</span></div>' +
      '<div class="rkpi"><b style="color:var(--gold);">' + t.eenhedenIngezet + '</b><span>ingezet</span></div>' +
      '<div class="rkpi"><b style="color:var(--groen);">' + t.beddenVrij + '</b><span>bedden vrij</span></div>' +
      '<div class="rkpi"><b>' + t.sehWachtend + '</b><span>SEH wacht</span></div>' +
      '<div class="rkpi"><b style="color:var(--rood);">' + t.meldingenOpen + '</b><span>open meldingen</span></div>';
    let h = '';
    if (b.korpsen.length) h += '<div style="margin-top:0.5rem;"><b style="font-size:0.8rem;">Korpsen</b>' + b.korpsen.map(k =>
      '<div class="melding" style="padding:0.4rem 0;">' + esc(k.naam) + ' · ' + k.vrij + ' vrij / ' + k.inzet + ' ingezet' +
      (k.perSoort.length ? ' <span class="stil">(' + k.perSoort.map(p => p.vrij + ' ' + p.soort).join(', ') + ')</span>' : '') + '</div>').join('') + '</div>';
    if (b.ziekenhuizen.length) h += '<div style="margin-top:0.5rem;"><b style="font-size:0.8rem;">Ziekenhuizen</b>' + b.ziekenhuizen.map(z =>
      '<div class="melding" style="padding:0.4rem 0;">' + esc(z.naam) + ' · ' + z.beddenVrij + '/' + z.beddenTotaal + ' bedden vrij · SEH: ' + z.sehWachtend + ' wacht</div>').join('') + '</div>';
    if (b.defensie.length) h += '<div style="margin-top:0.5rem;"><b style="font-size:0.8rem;">Defensie</b>' + b.defensie.map(d =>
      '<div class="melding" style="padding:0.4rem 0;">' + esc(d.naam) + ' · ' + d.gevechtsgereed + ' gevechtsgereed, ' + d.beperkt + ' beperkt · ' + d.gewonden + ' gewonden</div>').join('') + '</div>';
    $('#rampDetail').innerHTML = h;
    document.querySelectorAll('[data-nvl]').forEach(x => x.addEventListener('click', async () => {
      try {
        const r = await api('keten/rampbeeld/schaal', { niveau: x.dataset.nvl });
        // bij afschalen naar normaal komt het naoefening-rapport meteen mee
        if (r.evaluatie) toonRapport(r.evaluatie);
        laadRamp();
      } catch (e) { alert(e.message); }
    }));
  }
  $('#coordKnop').addEventListener('click', async () => {
    $('#coordUit').textContent = 'De coordinator denkt mee…';
    try { const r = await api('keten/rampbeeld/ai', {}); $('#coordUit').textContent = r.antwoord; }
    catch (e) { $('#coordUit').textContent = e.message; }
  });
  function toonRapport(ev) {
    const m = ev.meldingen, e = ev.evacuaties;
    $('#rapportUit').innerHTML =
      '<div class="melding" style="padding:0.5rem 0;"><b>Meldingen</b>: ' + m.totaal + ' (prio 1: ' + m.perPrio[1] + ', 2: ' + m.perPrio[2] + ', 3: ' + m.perPrio[3] + '), ' + m.bemand + ' bemand.' +
      (m.gemAanrijMin != null ? ' Gem. aanrijtijd ' + m.gemAanrijMin + ' min.' : '') +
      (m.gemAfhandelMin != null ? ' Gem. afhandeltijd ' + m.gemAfhandelMin + ' min' + (m.langsteAfhandelMin != null ? ' (langste ' + m.langsteAfhandelMin + ' min)' : '') + '.' : '') + '</div>' +
      '<div class="melding" style="padding:0.5rem 0;"><b>Evacuaties</b>: ' + e.totaal +
      (e.totaal ? ' (' + Object.entries(e.perTriage).map(function(t){return t[1]+' '+t[0];}).join(', ') + ')' : '') + '.</div>' +
      '<div class="melding" style="padding:0.5rem 0;"><b>Knelpunten</b><ul style="margin:0.3rem 0 0 1rem;">' + ev.knelpunten.map(function(k){return '<li>'+esc(k)+'</li>';}).join('') + '</ul></div>';
  }
  $('#rapportKnop').addEventListener('click', async () => {
    $('#rapportUit').textContent = 'Rapport opstellen…';
    try { toonRapport(await api('keten/rampbeeld/evaluatie', {})); }
    catch (e) { $('#rapportUit').textContent = e.message; }
  });

  function start() {
    $('#vLogin').hidden = true;
    $('#vBord').hidden = false;
    $('#noodKnop').hidden = false;
    laad().then(laadKeten).then(laadRamp).catch(e => { $('#vLogin').hidden = false; $('#vBord').hidden = true; $('#lFout').textContent = e.message; token = ''; });
  }
  setInterval(() => { if (!$('#vBord').hidden && !document.hidden) laad().catch(() => {}); }, 20000);
  if (token) start();
})();
