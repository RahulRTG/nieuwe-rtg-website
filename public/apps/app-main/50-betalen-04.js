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
    wrap.innerHTML = '<div style="margin-top:1.6rem;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:1rem 1.1rem;">' +
      '<div style="font-size:0.6rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--gold);">' + T('gc.h','Cadeaukaarten') + '</div>' +
      '<div style="font-size:0.72rem;color:var(--muted);margin-top:0.3rem;line-height:1.5;">' + T('gc.s','Koop een cadeaukaart van een partner en geef de code cadeau. Inwisselen gaat bij de zaak.') + '</div>' +
      (kaarten.length ? kaarten.map(k =>
        '<div style="display:flex;justify-content:space-between;align-items:center;gap:0.7rem;padding:0.55rem 0;border-bottom:1px solid var(--line);font-size:0.8rem;">' +
        '<span>' + k.supplierName + '<span style="display:block;font-size:0.66rem;color:var(--gold);letter-spacing:0.06em;">' + k.code + '</span></span>' +
        '<b>' + eur(k.saldo) + '</b></div>').join('') : '') +
      '<div style="display:flex;gap:0.5rem;margin-top:0.7rem;flex-wrap:wrap;">' +
      '<select id="gcSup" style="flex:2;min-width:120px;background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:0.6rem;color:var(--txt);font-family:inherit;">' + opties + '</select>' +
      '<input id="gcAmt" type="number" placeholder="€ 50" style="flex:1;min-width:70px;background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:0.6rem;color:var(--txt);font-family:inherit;">' +
      '<button id="gcBuy" style="background:var(--knop);color:var(--knop-txt);border:none;border-radius:999px;padding:0.6rem 1rem;font-size:0.74rem;font-weight:600;font-family:inherit;">' + T('gc.koop','Koop') + '</button></div></div>';
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
    if (user.tier !== 'business'){ wrap.innerHTML = ''; return; }
    let land = 'NL';
    try { land = localStorage.getItem('rtg_boekland') || 'NL'; } catch(e){}
    const landen = [['NL','Nederland'],['BE','Belgie'],['DE','Duitsland'],['FR','Frankrijk'],['ES','Spanje'],['JP','Japan']];
    wrap.innerHTML = '<div style="margin-top:1rem;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:1rem 1.1rem;">' +
      '<div style="font-size:0.6rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--gold);">' + T('bh2.h','AI-boekhouder · Business Pass') + '</div>' +
      '<div style="font-size:0.72rem;color:var(--muted);margin-top:0.3rem;line-height:1.5;">' + T('bh2.s','Kent per land de aftrekregels voor uw zakelijke reiskosten. Uw facturen staan al boekhoudklaar, met afboekcode en btw-specificatie.') + '</div>' +
      '<div style="display:flex;gap:0.5rem;margin-top:0.7rem;">' +
      '<select id="bhLand" style="background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:0.55rem;color:var(--txt);font-family:inherit;">' +
      landen.map(l => '<option value="' + l[0] + '"' + (l[0] === land ? ' selected' : '') + '>' + l[1] + '</option>').join('') + '</select>' +
      '<input id="bhQ" placeholder="' + T('bh2.ph','Bijv. kan ik dit diner terugvorderen?') + '" style="flex:1;background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:0.55rem 0.7rem;color:var(--txt);font-family:inherit;font-size:0.8rem;">' +
      '<button id="bhGo" style="background:var(--knop);color:var(--knop-txt);border:none;border-radius:999px;padding:0.55rem 0.95rem;font-size:0.74rem;font-weight:600;font-family:inherit;">' + T('bh2.vraag','Vraag') + '</button></div>' +
      '<div id="bhA" style="display:none;margin-top:0.7rem;border:1px solid var(--gold);border-radius:12px;padding:0.7rem 0.9rem;font-size:0.78rem;line-height:1.6;color:var(--muted);"></div>' +
      // zzp-belastingtool: jaarwinst in, indicatie van aftrek, belasting en netto uit
      '<div style="margin-top:0.9rem;border-top:1px solid var(--line);padding-top:0.9rem;">' +
      '<div style="font-size:0.6rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--gold);">' + T('zzp.h','Zzp-belastingtool') + '</div>' +
      '<div style="font-size:0.72rem;color:var(--muted);margin-top:0.3rem;line-height:1.5;">' + T('zzp.s','Voor zelfstandigen: vul uw verwachte jaarwinst in voor een indicatie van uw belasting, nettowinst en wat u maandelijks opzij zet. Het land volgt de keuze hierboven.') + '</div>' +
      '<div style="display:flex;gap:0.5rem;margin-top:0.6rem;">' +
      '<input id="zzpWinst" type="number" placeholder="' + T('zzp.winstph','Jaarwinst, bijv. 60000') + '" style="flex:1;background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:0.55rem 0.7rem;color:var(--txt);font-family:inherit;font-size:0.8rem;">' +
      '<button id="zzpGo" style="background:var(--knop);color:var(--knop-txt);border:none;border-radius:999px;padding:0.55rem 0.95rem;font-size:0.74rem;font-weight:600;font-family:inherit;">' + T('zzp.reken','Reken') + '</button></div>' +
      '<div style="display:flex;gap:1rem;margin-top:0.5rem;font-size:0.72rem;color:var(--muted);flex-wrap:wrap;">' +
      '<label style="display:flex;align-items:center;gap:0.35rem;"><input type="checkbox" id="zzpUren" checked> ' + T('zzp.uren','Urencriterium (1.225 uur)') + '</label>' +
      '<label style="display:flex;align-items:center;gap:0.35rem;"><input type="checkbox" id="zzpStart"> ' + T('zzp.start','Startersaftrek') + '</label></div>' +
      '<div id="zzpRes" style="display:none;margin-top:0.7rem;border:1px solid var(--line);border-radius:12px;padding:0.8rem 0.95rem;font-size:0.76rem;line-height:1.7;color:var(--muted);"></div></div></div>' +
