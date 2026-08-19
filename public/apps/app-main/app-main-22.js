/* het boekingsblad: de diensten van een partner kiezen */
    $('#boekBody').innerHTML =
      (s.vak ? '<div style="font-size:0.72rem;color:var(--gold);letter-spacing:0.1em;text-transform:uppercase;margin-bottom:0.6rem;">' + s.vak + ' · ' + s.city + '</div>' : '') +
      s.services.map(x =>
        '<div class="rowitem js-svc" data-svc="' + x.id + '" style="cursor:pointer;border:1px solid var(--line);border-radius:12px;padding:0.75rem 0.9rem;margin-bottom:0.55rem;">' +
        '<div class="t"><b>' + (x.soort === 'product' ? '' : '') + x.name + '</b><span>' + (x.desc || '') + (x.duurMin ? ' · ' + x.duurMin + ' min' : '') + '</span></div>' +
        '<span class="amount">' + eur(x.price) + '</span></div>').join('') +
      '<div style="display:flex;gap:0.5rem;margin-top:0.6rem;">' +
      '<input id="boekDatum" type="date" value="' + morgen + '" style="flex:1;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:0.6rem;color:var(--txt);font-family:inherit;color-scheme:dark;">' +
      '<input id="boekTijd" type="time" value="14:00" style="flex:1;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:0.6rem;color:var(--txt);font-family:inherit;color-scheme:dark;"></div>' +
      '<div id="boekSlots" style="margin-top:0.5rem;"></div>' +
      '<input id="boekNote" placeholder="' + T('boek.noteph','Bijv. maat, locatie of blessure') + '" style="width:100%;margin-top:0.5rem;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:0.6rem 0.7rem;color:var(--txt);font-family:inherit;font-size:0.82rem;">' +
      '<div style="font-size:0.66rem;color:var(--soft);margin:0.5rem 0 0;">' + T('boek.los','U boekt rechtstreeks bij deze professional: een losse overeenkomst, en uw betaling gaat rechtstreeks naar de professional.') + '</div>' +
      '<button id="boekGo" class="btn-pay" style="width:100%;margin-top:0.7rem;justify-content:center;">' + FID + T('boek.go','Boek en betaal') + '</button>';
    $('#boek-sheet').classList.add('open');
    $('#boek-scrim').classList.add('open');
    // de vrije tijdvakken van de professional ophalen en als chips tonen
    async function laadSlots(){
      const box = $('#boekSlots'); if (!box) return;
      if (!boekKeuze){ box.innerHTML = ''; return; }
      box.innerHTML = '<div style="font-size:0.7rem;color:var(--soft);">' + T('boek.slotsladen','Vrije tijden laden...') + '</div>';
      let d;
      try { d = await API.call('/booking/slots', { supplierCode: code, serviceId: boekKeuze, date: $('#boekDatum').value }); }
      catch(e){ box.innerHTML = ''; return; }
      if (!d.tijden || !d.tijden.length){
        box.innerHTML = '<div style="font-size:0.7rem;color:var(--soft);">' + T('boek.geenslots','Geen vrije tijden op deze dag; kies een andere datum of typ een tijd.') + '</div>';
        return;
      }
      box.innerHTML = '<div style="font-size:0.66rem;color:var(--soft);letter-spacing:0.08em;text-transform:uppercase;margin-bottom:0.35rem;">' + T('boek.vrijetijden','Vrije tijden') + '</div>' +
        '<div style="display:flex;flex-wrap:wrap;gap:0.4rem;">' + d.tijden.map(t =>
          '<button class="js-slot" data-t="' + t + '" style="background:var(--card);border:1px solid var(--line);border-radius:999px;padding:0.35rem 0.7rem;color:var(--txt);font-family:inherit;font-size:0.8rem;cursor:pointer;">' + t + '</button>').join('') + '</div>';
      box.querySelectorAll('.js-slot').forEach(b => b.addEventListener('click', () => {
        $('#boekTijd').value = b.dataset.t;
        box.querySelectorAll('.js-slot').forEach(x => { x.style.borderColor = 'var(--line)'; x.style.color = 'var(--txt)'; });
        b.style.borderColor = 'var(--gold)'; b.style.color = 'var(--gold)';
      }));
    }
    $('#boekBody').querySelectorAll('.js-svc').forEach(el => el.addEventListener('click', () => {
      boekKeuze = el.dataset.svc;
      $('#boekBody').querySelectorAll('.js-svc').forEach(x => x.style.borderColor = x.dataset.svc === boekKeuze ? 'var(--gold)' : 'var(--line)');
      laadSlots();
    }));
    $('#boekDatum').addEventListener('change', laadSlots);
    $('#boekGo').addEventListener('click', async () => {
      if (!boekKeuze){ toast(T('boek.kies','Kies eerst een dienst of product.')); return; }
      let d;
      try {
        d = await API.call('/booking/request', { supplierCode: code, serviceId: boekKeuze,
          date: $('#boekDatum').value, time: $('#boekTijd').value, note: $('#boekNote').value.trim() });
      } catch(e){ toast(e.message); return; }
      $('#boek-sheet').classList.remove('open');
      $('#boek-scrim').classList.remove('open');
      if (d.boeking.status === 'wacht-op-betaling'){
        payWithFaceId(eur(d.boeking.price), async () => {
          await API.call('/booking/pay', { ref: d.boeking.ref });
          return d.boeking;
        }, { message: () => T('boek.betaald','Geboekt en betaald; u hoort het zodra het bevestigd is.'), after: () => renderTerPlaatse() });
      } else {
        toast('' + T('boek.ok','Aanvraag verstuurd; betalen kan achteraf.'));
        renderTerPlaatse();
      }
    });
  }
  $('#boekClose').addEventListener('click', () => { $('#boek-sheet').classList.remove('open'); $('#boek-scrim').classList.remove('open'); });
  $('#boek-scrim').addEventListener('click', () => { $('#boek-sheet').classList.remove('open'); $('#boek-scrim').classList.remove('open'); });


  /* "De rekening" (betalen na het eten): haal de lopende achteraf-bonnen bij de
     zaak op, toon ze als een itemgewijze rekening met een fooikeuze, en reken
     alles in een keer af met Face ID. Dezelfde /api/rekening-route bedient ook
     Rahul, zodat "rekenen af" via de AI langs precies dit pad loopt.
     Losse part (5-10 KB-discipline), afgesplitst van 20-navigatie-genres-10.js. */
  function vraagRekening(code){
