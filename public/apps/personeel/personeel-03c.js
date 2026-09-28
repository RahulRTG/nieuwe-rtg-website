/* MIJN TIJD (VRIJHEID.md): de tab waarin een medewerker zijn eigen tijd ziet
   en vraagt. Alles komt van /api/staff/tijd*, en de persoon komt daar uit de
   SESSIE -- dit scherm stuurt nooit mee wie er vraagt.

   Twee dingen die hier met opzet zo staan. Een saldo dat het systeem niet kent
   staat er als "niet bekend" MET de reden, nooit als nul. En wat het systeem
   niet weet (geen verantwoordelijkheden, geen feestdagen) staat onderaan even
   groot als de rest: een verzoek dat daarop afketst, hoort uit te leggen
   waarom. Dit deel staat tussen twee hele functies (na personeel-03b.js); openTab
   in personeel-25.js roept laadTijd aan. */
  let tijdData = null, tijdFout = '', tijdKeuze = 'STATUTORY_LEAVE';
  const TIJD_KEUZES = {
    STATUTORY_LEAVE: ['VRIJE_DAG', 'Vakantie'], RTG_DAY: ['VRIJE_DAG', 'RTG Day'],
    SPECIAL_LEAVE: ['VRIJE_DAG', 'Bijzonder verlof'], UNPAID_LEAVE: ['VRIJE_DAG', 'Onbetaald verlof'],
    EERDER: ['EERDER_WEG', 'Eerder weg'], LATER: ['LATER_BEGINNEN', 'Later beginnen']
  };
  const TIJD_STAND = { AUTO_APPROVED: 'goedgekeurd', APPROVED: 'goedgekeurd', SCHEDULED: 'ingepland',
    HUMAN_REVIEW: 'bij je leidinggevende', ALTERNATIVE_PROPOSED: 'alternatief voorgesteld', DECLINED: 'niet gelukt',
    CANCELLED: 'ingetrokken', TAKEN: 'opgenomen', COMPLETED: 'afgerond', CHECKING: 'wordt bekeken', SUBMITTED: 'ingediend' };
  const TIJD_VELDEN = ['tijdDatum', 'tijdKlok', 'tijdReden'];
  const TIJD_LOOPT = ['SUBMITTED', 'CHECKING', 'HUMAN_REVIEW', 'ALTERNATIVE_PROPOSED', 'AUTO_APPROVED', 'APPROVED', 'SCHEDULED'];

  function tijdSaldo(titel, s){
    const waarde = s.recht == null ? T('pd.tijd.onbekend', 'niet bekend') : s.over + ' ' + T('pd.tijd.van', 'van') + ' ' + s.recht;
    return '<div class="task"><div class="t"><b>' + esc(titel) + ': ' + esc(String(waarde)) + '</b><span>' +
      esc(s.recht == null ? (s.reden || '') : (s.tekst || '')) + '</span></div></div>';
  }

  function renderTijd(){
    const w = $('#tijdWrap'); if (!w) return;
    if (tijdFout){ w.innerHTML = '<div class="card"><div class="t">' + esc(tijdFout) + '</div></div>'; return; }
    if (!tijdData){ w.innerHTML = '<div class="card h-zachter">' + T('pd.tijd.laden', 'Laden...') + '</div>'; return; }
    const d = tijdData, t = d.tijd, k = TIJD_KEUZES[tijdKeuze];
    const klok = k[0] === 'EERDER_WEG' ? 'vanaf' : k[0] === 'LATER_BEGINNEN' ? 'tot' : null;
    /* een herlaadbeurt wist niet wat iemand al had ingevuld */
    const bewaard = {}; TIJD_VELDEN.forEach(id => { const e = w.querySelector('#' + id); if (e) bewaard[id] = e.value; });
    w.innerHTML =
      '<div class="card"><div class="k">' + T('pd.tijd.saldo', 'Wat je hebt') + '</div>' +
        tijdSaldo(T('pd.tijd.vak', 'Vakantie'), t.vakantie) + tijdSaldo('RTG Days', t.rtgDagen) +
        (t.verjaardag ? '<div class="task"><div class="t"><b>' + T('pd.tijd.jarig', 'Je verjaardag') + (t.verjaardag.datum ? ': ' + esc(t.verjaardag.datum) : '') +
          '</b><span>' + esc(t.verjaardag.tekst || '') + '</span></div></div>' : '') +
      '</div>' +
      '<div class="card"><div class="k">' + T('pd.tijd.vraag', 'Tijd vragen') + '</div>' +
        '<div class="h-rij h-wrap h-mt40">' + Object.keys(TIJD_KEUZES).map(c =>
          '<button class="abtn' + (c === tijdKeuze ? '' : ' ghost') + '" data-tijdkeuze="' + c + '">' + T('pd.tijd.k.' + c, TIJD_KEUZES[c][1]) + '</button>').join('') + '</div>' +
        '<div class="compose h-mt40"><input type="date" id="tijdDatum" class="vlin h-flex1">' +
          (klok ? '<input type="time" id="tijdKlok" class="vlin h-flex1" aria-label="' + (klok === 'vanaf' ? 'Weg om' : 'Begin om') + '">' : '') +
          '<button id="tijdGo">' + T('pd.ad.vraag', 'Vraag aan') + '</button></div>' +
        '<div class="h-zachter h-mt40">' + (tijdKeuze === 'SPECIAL_LEAVE'
          ? T('pd.tijd.bijz', 'Alleen je leidinggevende ziet waarom; je team ziet alleen dat je afwezig bent.')
          : T('pd.ad.geenreden', 'Een reden is niet nodig.')) + '</div>' +
        (tijdKeuze === 'SPECIAL_LEAVE' ? '<input id="tijdReden" class="vlin h-volbreed h-mt40" maxlength="500" placeholder="' + T('pd.tijd.reden', 'Waarom (optioneel)') + '">' : '') +
      '</div>' +
      (t.verzoeken.length ? '<div class="card"><div class="k">' + T('pd.tijd.mijn', 'Je verzoeken') + '</div>' +
        t.verzoeken.slice().reverse().map(v => '<div class="task h-stapel"><div class="t"><b>' + esc(v.datum) + ' · ' +
          esc(T('pd.tijd.k.' + v.categorie, (TIJD_KEUZES[v.categorie] || [0, v.categorie])[1])) + ' · ' + esc(TIJD_STAND[v.stand] || v.stand) + '</b>' +
          (v.uitleg ? '<span>' + esc(v.uitleg) + '</span>' : '') +
          (v.alternatieven || []).map(a => '<span>→ ' + esc(a.zin || '') + '</span>').join('') + '</div>' +
          (TIJD_LOOPT.includes(v.stand) ? '<button class="abtn ghost h-mt40" data-tijdin="' + esc(v.id) + '">' + T('pd.tijd.in', 'Trek in') + '</button>' : '') +
          '</div>').join('') + '</div>' : '') +
      '<div class="card"><div class="k">' + T('pd.tijd.vj', 'Je verjaardag') + '</div>' +
        '<div class="h-zachter h-mt40">' + T('pd.tijd.vj.s', 'Alleen als je dat wilt. Valt hij op een vrije dag, dan is de werkdag ervoor van jou.') + '</div>' +
        '<div class="compose h-mt40"><input type="date" id="tijdVj" class="vlin h-flex1"' + (d.verjaardag ? ' value="2000-' + esc(d.verjaardag) + '"' : '') + '>' +
        '<button id="tijdVjGo">' + T('pd.tijd.bewaar', 'Bewaar') + '</button>' +
        (d.verjaardag ? '<button id="tijdVjWeg">' + T('pd.tijd.weg', 'Haal weg') + '</button>' : '') + '</div>' +
      '</div>' +
      (d.ontbreekt.length ? '<div class="card"><div class="k">' + T('pd.tijd.niet', 'Wat het systeem niet weet') + '</div>' +
        d.ontbreekt.map(o => '<div class="h-zachter h-mt40">' + esc(o) + '</div>').join('') + '</div>' : '');
    TIJD_VELDEN.forEach(id => { const e = w.querySelector('#' + id); if (e && bewaard[id]) e.value = bewaard[id]; });
    bindTijd(w);
  }

  async function tijdDoe(pad, lijf, klaar){
    try { await API.call(pad, lijf); if (klaar) toast(klaar); await laadTijd(); }
    catch(e){ toast(e.message); }
  }

  function bindTijd(w){
    w.querySelectorAll('[data-tijdkeuze]').forEach(b => b.addEventListener('click', () => { tijdKeuze = b.dataset.tijdkeuze; renderTijd(); }));
    const vj = w.querySelector('#tijdVjGo'); if (vj) vj.addEventListener('click', () => {
      const v = w.querySelector('#tijdVj').value; if (!v) return toast(T('pd.tijd.kies', 'Kies eerst een datum.'));
      tijdDoe('/staff/tijd/verjaardag', { mmdd: v.slice(5) }, T('pd.tijd.vjok', 'Bewaard.'));
    });
    const vjw = w.querySelector('#tijdVjWeg'); if (vjw) vjw.addEventListener('click', () => tijdDoe('/staff/tijd/verjaardag', { mmdd: null }));
    const go = w.querySelector('#tijdGo'); if (go) go.addEventListener('click', () => {
      if (go.disabled) return;
      const datum = w.querySelector('#tijdDatum').value; if (!datum) return toast(T('pd.tijd.kies', 'Kies eerst een datum.'));
      const k = TIJD_KEUZES[tijdKeuze], lijf = { soort: k[0], categorie: k[0] === 'VRIJE_DAG' ? tijdKeuze : 'SCHEDULE_FLEXIBILITY', datum };
      const klok = w.querySelector('#tijdKlok'), reden = w.querySelector('#tijdReden');
      if (klok){ if (!klok.value) return toast(T('pd.tijd.tijd', 'Kies ook een tijd.')); lijf[k[0] === 'EERDER_WEG' ? 'vanaf' : 'tot'] = klok.value; }
      if (reden && reden.value.trim()) lijf.reden = reden.value.trim();
      /* een sleutel per druk; de knop gaat dicht tot het antwoord er is, zodat een
         dubbeltik niet twee verzoeken wordt */
      lijf.sleutel = RTGId('tijd');
      go.disabled = true;
      API.call('/staff/tijd/verzoek', lijf).then(() => {
        /* pas na een antwoord leeg: een mislukte poging laat de invoer staan */
        TIJD_VELDEN.forEach(id => { const e = w.querySelector('#' + id); if (e) e.value = ''; });
        toast(T('pd.tijd.verstuurd', 'Verstuurd. Hieronder zie je wat er mee gebeurde.'));
        return laadTijd();
      }).catch(e => { toast(e.message); go.disabled = false; });
    });
    w.querySelectorAll('[data-tijdin]').forEach(b => b.addEventListener('click', () => tijdDoe('/staff/tijd/intrekken', { id: b.dataset.tijdin })));
  }

  async function laadTijd(){
    try { tijdData = await API.call('/staff/tijd', {}); tijdFout = ''; }
    catch(e){ tijdData = null; tijdFout = e.message; }
    renderTijd();
  }
