    const pct = totaal ? Math.round(klaar / totaal * 100) : 0;
    const label = { fontSize: '0.62rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--soft)' };

    const coachInp = E('input', { placeholder: coachRef ? T('pd.tr.askctx', 'Vraag over deze tafel... bijv. waar let ik op?') : T('pd.tr.ask', 'Vraag de coach... bijv. hoe stel ik een wijn voor?') });
    const coachBtn = E('button', { onclick: async () => {
      const vraag = (coachInp.value || '').trim();
      if (!vraag) return;
      coachBtn.disabled = true; coachBtn.textContent = '...';
      try { coachAntwoord = await API.call('/supplier/coach', coachRef ? { vraag, ref: coachRef } : { vraag }); }
      catch (e) { toast(e.message); }
      vulTrainingKaart();
    } }, T('pd.tr.coach', 'Vraag'));

    function tipRij(x){
      const g = gelezen.includes(x.t);
      return E('div', { class: 'task', style: g ? { alignItems: 'flex-start', opacity: '0.7' } : { alignItems: 'flex-start' } },
        E('button', { class: 'ic', 'aria-label': g ? T('pd.tr.unread', 'Markeer als ongelezen') : T('pd.tr.mark', 'Markeer als gelezen'),
          style: { cursor: 'pointer', background: 'none', border: 'none', fontSize: '1.1rem' },
          onclick: async () => {
            const uit = (trainData.gelezen || []).includes(x.t);
            try { const d = await API.call('/supplier/training/gelezen', { titel: x.t, uit }); if (trainData) trainData.gelezen = d.gelezen; vulTrainingKaart(); }
            catch (e) { toast(e.message); }
          } }, g ? '' : ''),
        E('div', { class: 't' }, E('b', {}, x.t), E('span', { style: { lineHeight: '1.5' } }, x.s)),
        (t.kanBeheren && eigen.some(e => e.t === x.t)) ? E('button', { class: 'abtn ghost', style: { flex: '0 0 auto', padding: '0.25rem 0.5rem', fontSize: '0.7rem' },
          onclick: async () => { try { await API.call('/supplier/training/remove', { titel: x.t }); await laadZaken(); vulTrainingKaart(); } catch (e) { toast(e.message); } } }, '✕') : null
      );
    }

    let beheer = null;
    if (t.kanBeheren) {
      const titelInp = E('input', { placeholder: T('pd.tr.title', 'Titel, bijv. Onze wijn-aanpak'), style: { width: '100%', marginBottom: '0.4rem' } });
      const tekstInp = E('input', { placeholder: T('pd.tr.text', 'De tip in een of twee zinnen...') });
      const addBtn = E('button', { onclick: async () => {
        const titel = (titelInp.value || '').trim(), tekst = (tekstInp.value || '').trim();
        if (!titel || !tekst) { toast(T('pd.tr.leeg', 'Geef een titel en een tekst.')); return; }
        try { await API.call('/supplier/training/add', { titel, tekst }); toast('' + T('pd.tr.added', 'Huistip toegevoegd voor het team.')); tipsOpen = true; await laadZaken(); vulTrainingKaart(); }
        catch (e) { toast(e.message); }
      } }, T('pd.tr.add', 'Voeg toe'));
      beheer = E('div', { style: { marginTop: '0.7rem', paddingTop: '0.6rem', borderTop: '1px solid var(--line,rgba(255,255,255,0.08))' } },
        E('div', { style: Object.assign({}, label, { marginBottom: '0.4rem' }) }, T('pd.tr.own', 'Eigen huistip toevoegen')),
        titelInp,
        E('div', { class: 'compose', style: { padding: '0' } }, tekstInp, addBtn));
    }

    return E('div', { class: 'card' },
      E('div', { class: 'k' }, '' + T('pd.tr.h', 'Training & tips'),
        t.func ? E('span', { style: { fontWeight: '500', color: 'var(--soft)', fontSize: '0.72rem' } }, ' ' + t.func) : null),
      tvd ? E('div', { style: { marginTop: '0.6rem', padding: '0.7rem 0.8rem', borderRadius: '12px', background: 'linear-gradient(135deg,rgba(197,160,89,0.16),rgba(197,160,89,0.05))', border: '1px solid rgba(197,160,89,0.3)' } },
        E('div', { style: Object.assign({}, label, { color: 'var(--gold)' }) }, T('pd.tr.tvd', 'Tip van de dag')),
        E('b', { style: { display: 'block', marginTop: '0.25rem', fontSize: '0.9rem' } }, tvd.t),
        E('span', { style: { display: 'block', marginTop: '0.2rem', fontSize: '0.8rem', lineHeight: '1.5', color: 'var(--muted)' } }, tvd.s)) : null,
      totaal ? E('div', { style: { marginTop: '0.6rem' } },
        E('div', { style: { display: 'flex', justifyContent: 'space-between', fontSize: '0.66rem', color: 'var(--soft)' } },
          E('span', {}, T('pd.tr.prog', 'Voortgang')), E('span', {}, klaar + ' / ' + totaal + ' ' + T('pd.tr.read', 'gelezen'))),
        E('div', { style: { height: '7px', borderRadius: '99px', background: 'var(--line,rgba(255,255,255,0.1))', marginTop: '0.3rem', overflow: 'hidden' } },
          E('div', { style: { height: '100%', width: pct + '%', background: 'linear-gradient(90deg,var(--gold),#e6c874)', borderRadius: '99px', transition: 'width .35s' } })),
        (klaar >= totaal) ? E('div', { style: { marginTop: '0.3rem', fontSize: '0.7rem', color: 'var(--green)' } }, '' + T('pd.tr.allread', 'Alle tips gelezen. Topper!')) : null) : null,
      coachRef ? E('div', { style: { marginTop: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.72rem', color: 'var(--gold)' } },
        '' + T('pd.tr.ctx', 'Coaching voor') + ' ' + (coachRefTafel || coachRef) + ' ',
        E('button', { class: 'abtn ghost', style: { padding: '0.1rem 0.4rem', fontSize: '0.68rem', lineHeight: '1' },
          onclick: () => { coachRef = null; coachRefTafel = null; vulTrainingKaart(); } }, '✕')) : null,
      E('div', { class: 'compose', style: { padding: '0.55rem 0 0' } }, coachInp, coachBtn),
      coachAntwoord ? E('div', { style: { marginTop: '0.55rem', padding: '0.65rem 0.8rem', borderRadius: '12px', background: 'var(--panel2,rgba(255,255,255,0.04))', border: '1px solid var(--line,rgba(255,255,255,0.08))' } },
        E('div', { style: Object.assign({}, label, { letterSpacing: '0.1em' }) }, (coachAntwoord.bron === 'ai' ? T('pd.tr.ai', 'AI-coach') : T('pd.tr.bib', 'Uit de tips')) + (coachAntwoord.tafel ? ' · ' + coachAntwoord.tafel : '')),
        E('span', { style: { display: 'block', marginTop: '0.25rem', fontSize: '0.82rem', lineHeight: '1.55' } }, coachAntwoord.antwoord)) : null,
      alle.length ? E('button', { class: 'abtn ghost', style: { width: '100%', marginTop: '0.6rem' },
        onclick: () => { tipsOpen = !tipsOpen; vulTrainingKaart(); } },
        tipsOpen ? ('▲ ' + T('pd.tr.hide', 'Verberg de tips')) : ('▼ ' + T('pd.tr.all', 'Alle tips voor mijn rol') + ' (' + alle.length + ')')) : null,
      tipsOpen ? E('div', { style: { marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' } }, alle.map(tipRij)) : null,
      beheer
    );
  }
  let pkFlLaatst = ''; // het laatste Fluister-antwoord blijft staan bij her-render
  function renderHulp(){
    const gids = EHBO_GIDS();
    const tr = (zaken && zaken.trust) || { anon: false, messages: [] };
    const vl = (zaken && zaken.verlof) || [];
    const VST = {
      nieuw: [T('pd.vl.new','in behandeling'), 'var(--soft)'],
      goedgekeurd: [T('pd.vl.ok','goedgekeurd'), 'var(--green)'],
      afgewezen: [T('pd.vl.no','afgewezen'), 'var(--burgundy)'],
      gemeld: [T('pd.vl.zm','gemeld'), 'var(--green)']
    };
    $('#hulpWrap').innerHTML =
      // Fluister: de persoonlijke assistent van dit personeelslid (eigen
