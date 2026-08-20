/* alles in een keer betalen */
    $('#payAllWrap').innerHTML = (open.length
      ? '<button class="btn-pay payall" id="payAll">' + FID + T('app.payall','Betaal alles') + ', ' + eur(openSum) + '</button>'
      : '') +
      (open.length ? '<div style="margin-top:1rem;background:var(--card);border:1px solid var(--line);border-radius:0;padding:0.9rem 1.1rem;font-size:0.74rem;color:var(--muted);line-height:1.6;">' +
        '<b style="color:var(--txt);font-size:0.68rem;letter-spacing:0.1em;text-transform:uppercase;">'+T('app.bank.h','Liever overboeken?')+'</b><br>' +
        T('app.bank.to','Maak het bedrag over naar')+' <b style="color:var(--txt);" id="rtgIban">' + RTG_IBAN + '</b> ' +
        T('app.bank.name','t.n.v. RTG, o.v.v. uw codenaam')+' (<b style="color:var(--gold);">' + user.codename + '</b>) ' +
        T('app.bank.ref','en het factuurnummer. Na ontvangst zetten wij de factuur op betaald.') +
        ' <button id="ibanCopy" style="background:none;border:1px solid var(--line);border-radius:0;padding:0.25rem 0.7rem;font-size:0.66rem;color:var(--muted);margin-left:0.2rem;">'+T('app.bank.copy','Kopieer IBAN')+'</button></div>' : '');
    document.querySelectorAll('.js-pay').forEach(b =>
      b.addEventListener('click', () => payWithFaceId(eur(Number(b.dataset.amt)), () => executePay(b.dataset.inv))));
    const pa = $('#payAll');
    if (pa) pa.addEventListener('click', () => payWithFaceId(eur(openSum), () => executePay('all')));
    const ic = $('#ibanCopy');
    if (ic) ic.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(RTG_IBAN); toast(T('app.bank.copied','IBAN gekopieerd.')); }
      catch(e){ toast(RTG_IBAN); }
    });
    renderGiftcards();
    renderBoekhouder();
    renderPunten();
  }

  /* RTG-punten + open betaalverzoeken (gesplitste rekeningen) + meldingsvoorkeuren */
  async function renderPunten(){
    if (!API.live || user.tier === 'guest') return;
    let wrap = $('#puntenWrap');
    if (!wrap){
      wrap = document.createElement('div');
      wrap.id = 'puntenWrap';
      $('#payAllWrap').insertAdjacentElement('afterend', wrap);
    }
    let p = null, splitsen = [], vk = null;
    try {
      [p, splitsen, vk] = await Promise.all([
        API.call('/punten').catch(() => null),
        API.call('/splitsen/mijn').then(d => d.splitsen || []).catch(() => []),
        API.call('/meldingen/voorkeur').then(d => d.voorkeur).catch(() => null)
      ]);
    } catch(e){ return; }
    const kaart = inhoud => '<div style="margin-top:1rem;background:var(--card);border:1px solid var(--line);border-radius:0;padding:0.9rem 1.1rem;">' + inhoud + '</div>';
    let html = '';
    // punten: saldo, tegoed en verzilveren
    if (p) html += kaart(
      '<div style="display:flex;justify-content:space-between;align-items:center;gap:0.8rem;">' +
        '<div><b style="font-size:0.86rem;">✦ ' + T('erv.punten','RTG-punten') + '</b>' +
        '<div style="font-size:0.72rem;color:var(--muted);margin-top:0.2rem;">' + p.saldo + ' ' + T('erv.puntensaldo','punten') + (p.tegoed ? ' · € ' + p.tegoed + ' ' + T('erv.tegoed','tegoed (verrekent automatisch)') : '') + '</div>' +
        '<div style="font-size:0.64rem;color:var(--soft);margin-top:0.2rem;">' + T('erv.puntenuitleg','1 punt per € 10; 100 punten = € 10 tegoed. RTG legt bij, de zaak ontvangt alles.') + '</div></div>' +
        (p.saldo >= 100 ? '<button class="vbtn" id="pzGo">' + T('erv.verzilver','Verzilver 100') + '</button>' : '') +
      '</div>');
    // open betaalverzoeken: mijn deel van gesplitste rekeningen
    const mijnKey = user.id != null ? 'user-' + user.id : user.tier;
    const echteOpen = splitsen.filter(s => s.delen.some(d2 => !d2.paid)).slice(0, 6);
    if (echteOpen.length) html += kaart(
      '<b style="font-size:0.86rem;">' + T('erv.verzoeken','Gesplitste rekeningen') + '</b>' +
      echteOpen.map(s => {
        const mijnDeel = s.delen.find(d2 => d2.key === mijnKey && !d2.paid);
        return '<div style="display:flex;justify-content:space-between;align-items:center;gap:0.6rem;margin-top:0.55rem;font-size:0.78rem;">' +
          '<span>' + s.supplierName + ' · ' + eur(s.totaal) + ' · ' + s.delen.filter(d2 => d2.paid).length + '/' + s.delen.length + ' ' + T('erv.betaald','betaald') + '</span>' +
          (mijnDeel
            ? '<button class="vbtn js-splpay" data-id="' + s.id + '" data-amt="' + mijnDeel.bedrag + '">' + T('erv.betaaldeel','Betaal mijn deel') + '</button>'
            : '<span style="color:var(--soft);font-size:0.68rem;">' + T('erv.wachtop','wacht op vrienden') + '</span>') +
        '</div>';
      }).join(''));
    // meldingsvoorkeuren: per soort aan of uit
    if (vk) html += kaart(
      '<b style="font-size:0.86rem;">' + T('erv.meldingen','Meldingen') + '</b>' +
      '<div style="display:flex;flex-wrap:wrap;gap:0.5rem 1rem;margin-top:0.55rem;">' +
      [['orders', T('erv.m.orders','Bestellingen')], ['events', T('erv.m.events','Events')], ['salon', 'De Salon'], ['live', T('erv.m.live','Onderweg')], ['wachtlijst', T('erv.wachtlijst','Wachtlijst')]].map(([k, l]) =>
        '<label style="display:inline-flex;align-items:center;gap:0.35rem;font-size:0.76rem;"><input type="checkbox" class="js-vk" data-scope="' + k + '"' + (vk[k] !== false ? ' checked' : '') + '> ' + l + '</label>'
      ).join('') + '</div>');
    wrap.innerHTML = html;
    const pz = $('#pzGo');
    if (pz) pz.addEventListener('click', async () => {
      try { const d = await API.call('/punten/verzilver', { punten: 100 }); toast('✦ ' + T('erv.verzilverd','Verzilverd:') + ' € ' + d.tegoed + ' ' + T('erv.tegoedkort','tegoed.')); renderPunten(); }
      catch(e){ toast(e.message); }
    });
    wrap.querySelectorAll('.js-splpay').forEach(b => b.addEventListener('click', () =>
      payWithFaceId(eur(Number(b.dataset.amt)), async () => { await API.call('/splits/betaal', { id: b.dataset.id }); return null; },
        { message: () => T('erv.deelbetaald','Uw deel is betaald.'), after: () => renderPunten() })));
    wrap.querySelectorAll('.js-vk').forEach(c => c.addEventListener('change', async () => {
      try { await API.call('/meldingen/voorkeur', { zet: { [c.dataset.scope]: c.checked } }); }
      catch(e){ toast(e.message); }
    }));
  }

  // cadeaukaarten: kopen met Face ID, cadeau doen, inwisselen bij de zaak op code
  async function renderGiftcards(){
    const wrap = $('#gcWrap');
    if (!wrap) return;
    let kaarten = [];
    try { kaarten = (await API.call('/giftcards/mine')).kaarten || []; } catch(e){}
    if (!suppliers.length){
      try { suppliers = (await API.call('/suppliers')).suppliers || []; } catch(e){}
    }
    const opties = suppliers.map(s => '<option value="' + s.code + '">' + s.name + '</option>').join('');
    wrap.innerHTML = '<div style="margin-top:1.6rem;background:var(--card);border:1px solid var(--line);border-radius:0;padding:1rem 1.1rem;">' +
      '<div style="font-size:0.6rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--gold);">' + T('gc.h','Cadeaukaarten') + '</div>' +
      '<div style="font-size:0.72rem;color:var(--muted);margin-top:0.3rem;line-height:1.5;">' + T('gc.s','Koop een cadeaukaart van een partner en geef de code cadeau. Inwisselen gaat bij de zaak.') + '</div>' +
      (kaarten.length ? kaarten.map(k =>
        '<div style="display:flex;justify-content:space-between;align-items:center;gap:0.7rem;padding:0.55rem 0;border-bottom:1px solid var(--line);font-size:0.8rem;">' +
        '<span>' + k.supplierName + '<span style="display:block;font-size:0.66rem;color:var(--gold);letter-spacing:0.06em;">' + k.code + '</span></span>' +
        '<b>' + eur(k.saldo) + '</b></div>').join('') : '') +
      '<div style="display:flex;gap:0.5rem;margin-top:0.7rem;flex-wrap:wrap;">' +
      '<select id="gcSup" style="flex:2;min-width:120px;background:var(--bg);border:1px solid var(--line);border-radius:0;padding:0.6rem;color:var(--txt);font-family:inherit;">' + opties + '</select>' +
      '<input id="gcAmt" type="number" placeholder="€ 50" style="flex:1;min-width:70px;background:var(--bg);border:1px solid var(--line);border-radius:0;padding:0.6rem;color:var(--txt);font-family:inherit;">' +
      '<button id="gcBuy" style="background:var(--knop);color:var(--knop-txt);border:none;border-radius:0;padding:0.6rem 1rem;font-size:0.74rem;font-weight:600;font-family:inherit;">' + T('gc.koop','Koop') + '</button></div></div>';
    const kb = $('#gcBuy');
    if (kb) kb.addEventListener('click', () => {
      const bedrag = Math.round(Number($('#gcAmt').value));
      if (!(bedrag >= 10)) { toast(T('gc.min','Kies een bedrag vanaf € 10.')); return; }
      payWithFaceId(eur(bedrag), async () => {
        const d = await API.call('/giftcard/buy', { supplierCode: $('#gcSup').value, bedrag });
        return d.kaart;
      }, { message: k => T('gc.klaar','Cadeaukaart gekocht. Code:') + ' ' + k.code, after: () => renderGiftcards() });
    });
  }

  // Business Pass: de AI-boekhouder die per land weet wat terug te vorderen is
  let lidBordenUI = null;
  function renderBoekhouder(){
    const wrap = $('#bhWrap');
    if (!wrap) return;
