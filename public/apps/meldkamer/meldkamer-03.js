/* het ketengesprek */
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

