/* TIJD VAN HET TEAM (VRIJHEID.md): de kaart in het Kantoor waarin een
   leidinggevende beoordeelt wat op een MENS wacht en de bezetting per weekdag
   vastlegt. leverancier-16.js zet de lege kaart neer, bindKantoor roept
   laadTijdKaart aan. Dit deel staat tussen twee hele functies (na
   leverancier-55d.js): een deel dat midden in een functie valt, is onzichtbaar.

   Het overzicht opent alleen met een PERSOONLIJKE login: bij bijzonder verlof
   kan de reden erin staan, en die leest niet een gedeeld bedrijfsaccount. Wie
   met het bedrijfsaccount binnen is, krijgt de zin van de server te zien en
   geen lege kaart. Een afwijzing vraagt een reden, want de medewerker leest
   hem. */
  let tijdOv = null, tijdEisen = [];
  const TIJD_DAGEN = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'];
  const TIJD_STAP = { werkstand: 'Werk', dekking: 'Bezetting', bevoegdheden: 'Bevoegdheden', rust: 'Rust', eerlijkheid: 'Eerlijkheid', teamImpact: 'Team' };

  function tijdNaam(id){
    const m = ((state && state.staff) || []).find(x => String(x.id) === String(id));
    return m ? m.name : T('kt.tijd.onbekend', 'Onbekende medewerker');
  }

  function tijdWachtHtml(v){
    const stappen = Object.keys(TIJD_STAP).filter(k => v[k]).map(k =>
      '<div class="tkc-who">' + escT(T('kt.tijd.s.' + k, TIJD_STAP[k])) + ': ' + escT(v[k].stand) + (v[k].uitleg ? ' · ' + escT(v[k].uitleg) : '') + '</div>').join('');
    const alts = (v.alternatieven || []).map(a => '<div class="tkc-who">→ ' + escT(a.zin || '') + '</div>').join('');
    return '<div class="st-row h-stapel"><span>' + escT(tijdNaam(v.persoon)) + '<span class="sub">' + escT(v.datum) + (v.vanaf ? ' ' + escT(v.vanaf) : '') +
      ' · ' + escT(v.soort) + '</span></span>' + stappen + alts +
      (v.reden ? '<div class="tkc-who">' + T('kt.tijd.reden', 'Reden (alleen voor u)') + ': ' + escT(v.reden) + '</div>' : '') +
      '<input class="h-volbreed h-mt40" data-tijdreden="' + escT(v.id) + '" maxlength="500" placeholder="' + T('kt.tijd.waarom', 'Reden bij afwijzen (de medewerker leest hem)') + '">' +
      '<span class="acts h-mt40"><button class="obtn primary" data-tijdja="' + escT(v.id) + '">' + T('kt.vja', 'Goedkeuren') + '</button>' +
      '<button class="obtn warn" data-tijdnee="' + escT(v.id) + '">' + T('kt.vnee', 'Afwijzen') + '</button></span></div>';
  }

  function tijdEisHtml(e, i){
    const ver = Object.entries(e.vereist || {}).map(([c, n]) => c + ' ×' + n).join(', ');
    return '<div class="st-row"><span>' + TIJD_DAGEN[e.weekdag] + ' ' + escT(e.van) + ' ' + T('kt.tijd.tot', 'tot') + ' ' + escT(e.tot) + '<span class="sub">' +
      T('kt.tijd.min', 'minstens') + ' ' + e.minBezetting + (e.kamer ? ' · ' + escT(e.kamer) : '') + (ver ? ' · ' + escT(ver) : '') + '</span></span>' +
      '<span class="acts"><button class="obtn" data-tijdeisweg="' + i + '">' + T('kt.tijd.weg', 'Weg') + '</button></span></div>';
  }

  function renderTijdKaart(el, fout){
    const k = el.querySelector('#tijdKaart'); if (!k) return;
    const kop = '<h3>' + T('kt.tijd', 'Tijd van het team') + (tijdOv && tijdOv.wachtend.length ? ' (' + tijdOv.wachtend.length + ')' : '') + '</h3>';
    if (fout || !tijdOv){ k.innerHTML = kop + '<div class="tkc-who">' + escT(fout || T('kt.laden', 'Laden...')) + '</div>'; return; }
    const o = tijdOv;
    k.innerHTML = kop +
      '<div class="tkc-who">' + T('kt.tijd.deck', 'Wat het systeem niet zelf mag besluiten, wacht hier op u. Een verzoek dat veilig is, keurt het zelf goed; een dat niet kan, krijgt alternatieven.') + '</div>' +
      (o.wachtend.length ? o.wachtend.map(tijdWachtHtml).join('') : '<div class="tkc-who h-mt40">' + T('kt.tijd.leeg', 'Er wacht niets op u.') + '</div>') +
      '<div class="tkc-who h-mt60"><b>' + T('kt.tijd.bez', 'Bezetting per weekdag') + '</b></div>' +
      (tijdEisen.length ? tijdEisen.map(tijdEisHtml).join('') : '<div class="tkc-who">' + T('kt.tijd.geeneis', 'Nog geen bezetting vastgelegd, dus kan het systeem niet zeggen of iemand gemist kan worden: dan beslist u.') + '</div>') +
      '<div class="st-row h-wrap h-mt40"><select id="tijdDag">' + TIJD_DAGEN.map((d, i) => '<option value="' + i + '">' + d + '</option>').join('') + '</select>' +
      '<input type="time" id="tijdVan" value="09:00" aria-label="van"><input type="time" id="tijdTot" value="17:00" aria-label="tot">' +
      '<input type="number" id="tijdMin" min="0" value="1" aria-label="' + T('kt.tijd.min', 'minstens') + '">' +
      (o.kamers ? '<select id="tijdKamer"><option value="">' + T('kt.tijd.alle', 'hele huis') + '</option>' + o.kamers.map(c => '<option>' + escT(c) + '</option>').join('') + '</select>' : '') +
      '<button class="obtn" id="tijdEisPlus">+ ' + T('kt.tijd.plus', 'Voeg toe') + '</button></div>' +
      '<div class="tkc-act"><button class="tkc-ready" id="tijdEisBewaar">' + T('kt.tijd.bewaar', 'Bewaar de bezetting') + '</button></div>' +
      '<div class="tkc-who h-mt60"><b>' + T('kt.tijd.fd', 'Feestdagen') + '</b></div>' +
      '<div class="st-row h-wrap"><input class="h-flex1" id="tijdFd" value="' + escT(o.feestdagen.join(', ')) + '" placeholder="2026-12-25, 2026-12-26">' +
      '<button class="obtn" id="tijdFdBewaar">' + T('kt.tijd.bewaar2', 'Bewaar') + '</button></div>' +
      (o.ontbreekt.length ? '<div class="tkc-who h-mt60"><b>' + T('kt.tijd.niet', 'Wat het systeem niet weet') + '</b></div>' +
        o.ontbreekt.map(r => '<div class="tkc-who">' + escT(r) + '</div>').join('') : '');
    bindTijdKaart(el, k);
  }

  async function tijdKaartDoe(el, pad, lijf, klaar){
    try { await API.call(pad, lijf); if (klaar) toast(klaar); await laadTijdKaart(el); }
    catch(e){ toast(e.message); }
  }

  function bindTijdKaart(el, k){
    k.querySelectorAll('[data-tijdja]').forEach(b => b.addEventListener('click', () =>
      tijdKaartDoe(el, '/supplier/tijd/beoordeel', { id: b.dataset.tijdja, besluit: 'APPROVED' }, T('kt.tijd.ok', 'Goedgekeurd; de medewerker ziet het direct.'))));
    k.querySelectorAll('[data-tijdnee]').forEach(b => b.addEventListener('click', () => {
      const r = k.querySelector('[data-tijdreden="' + b.dataset.tijdnee + '"]');
      const reden = r ? r.value.trim() : '';
      if (!reden){ toast(T('kt.tijd.moet', 'Geef een reden: de medewerker leest hem.')); if (r) r.focus(); return; }
      tijdKaartDoe(el, '/supplier/tijd/beoordeel', { id: b.dataset.tijdnee, besluit: 'DECLINED', reden });
    }));
    k.querySelectorAll('[data-tijdeisweg]').forEach(b => b.addEventListener('click', () => {
      tijdEisen.splice(Number(b.dataset.tijdeisweg), 1); renderTijdKaart(el);
    }));
    const plus = k.querySelector('#tijdEisPlus'); if (plus) plus.addEventListener('click', () => {
      const kamer = k.querySelector('#tijdKamer');
      const e = { weekdag: Number(k.querySelector('#tijdDag').value), van: k.querySelector('#tijdVan').value, tot: k.querySelector('#tijdTot').value,
        minBezetting: Math.max(0, parseInt(k.querySelector('#tijdMin').value, 10) || 0), vereist: {} };
      if (kamer && kamer.value) e.kamer = kamer.value;
      tijdEisen.push(e); renderTijdKaart(el);
    });
    const bewaar = k.querySelector('#tijdEisBewaar'); if (bewaar) bewaar.addEventListener('click', () =>
      tijdKaartDoe(el, '/supplier/tijd/bezetting', { eisen: tijdEisen }, T('kt.tijd.bewaard', 'Bezetting bewaard.')));
    const fd = k.querySelector('#tijdFdBewaar'); if (fd) fd.addEventListener('click', () => {
      const lijst = k.querySelector('#tijdFd').value.split(/[\s,]+/).filter(Boolean);
      tijdKaartDoe(el, '/supplier/tijd/feestdagen', { feestdagen: lijst }, T('kt.tijd.bewaard2', 'Feestdagen bewaard.'));
    });
  }

  async function laadTijdKaart(el){
    if (!el.querySelector('#tijdKaart')) return;
    try { tijdOv = await API.call('/supplier/tijd/overzicht', {}); tijdEisen = (tijdOv.eisen || []).map(e => ({ ...e, vereist: { ...(e.vereist || {}) } })); }
    catch(e){ tijdOv = null; return renderTijdKaart(el, e.message); }
    renderTijdKaart(el);
  }
