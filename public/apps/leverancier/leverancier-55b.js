    /* ---- Werkbeleid: wat staat er dicht op de passen van uw mensen? ----
       Een bedrijf dat passen voor zijn mensen neemt, moet kunnen zeggen welke
       functies daarop dicht staan. Eén regel maakt dat veilig, en die staat er
       met zoveel woorden bij: u kunt alleen DICHTzetten, nooit openzetten.
       Verplicht aanzetten van locatie, GPS of paspoort delen bestaat hier
       bewust niet -- dat zou geen beleid zijn maar een afluisterknop.

       De chips lezen als de rest van dit scherm: groen = de medewerker beslist
       zelf, rood = wij hebben hem dicht gezet. */
    let wb = null; try { wb = await API.call('/supplier/werkbeleid'); } catch(e){}
    if (wb && wb.beleid){
      const fns = (wb.beleid.functies||[]);
      const wbChips = '<div class="sub" style="margin:0 0 0.5rem;">'+T('wb.regel','U kunt functies alleen dichtzetten, nooit openzetten. Verplicht aanzetten van locatie, GPS of paspoort delen bestaat hier bewust niet.')+'</div>'+
        '<div style="display:flex;flex-wrap:wrap;gap:0.4rem;">'+
        fns.map(f => '<button class="js-wbf" data-id="'+f.id+'" data-dicht="'+f.dicht+'" title="'+esc(f.uitleg||'')+'" style="border:1px solid '+(f.dicht?'var(--rood)':'#1f5637')+';background:'+(f.dicht?'#3a1420':'#12321f')+';color:'+(f.dicht?'#F4B8C6':'#7EE0A3')+';border-radius:0;padding:0.34rem 0.75rem;font-size:0.74rem;font-weight:600;font-family:inherit;">'+(f.dicht?'○ ':'● ')+esc(f.naam)+'</button>').join('')+
        '</div>'+
        (wb.beleid.gewijzigd ? '<div class="sub" style="margin-top:0.5rem;font-size:0.7rem;">'+T('wb.laatst','Laatst gewijzigd')+': '+esc(String(wb.beleid.gewijzigd).slice(0,10))+(wb.beleid.door?' · '+esc(wb.beleid.door):'')+'</div>' : '');
      // het blok telt hoeveel er VRIJ zijn, zodat de kop leest als de andere
      const alsFuncties = fns.map(f => ({ id:f.id, naam:f.naam, aan: !f.dicht }));
      h += '<div class="st-sec">'+T('wb.kop','Werkbeleid op de passen van uw mensen')+'</div>'+
        funcBlok(T('wb.functies','Vrij voor de medewerker'), alsFuncties, wbChips);
    }

    // de belastingtool van de zaak: dezelfde motor als de Business Pass
    h += '<div class="st-sec">'+T('zb.bel','Belastingtool')+'</div>'+
      '<div class="sub" style="margin-bottom:0.5rem;">'+T('zb.bel.s','Vul de verwachte jaarwinst in voor een indicatie van de belasting, de nettowinst en wat u maandelijks opzij zet. Het land van de zaak is het vertrekpunt.')+'</div>'+
      '<div style="display:flex;gap:0.4rem;flex-wrap:wrap;margin-bottom:0.5rem;">'+
      '<input id="zbBelWinst" type="number" min="1" placeholder="'+T('zb.bel.ph','jaarwinst €')+'" style="width:9rem;">'+
      '<button class="abtn" id="zbBelGo">'+T('zb.bel.reken','Reken')+'</button></div>'+
      '<div id="zbBelRes" style="display:none;border:1px solid var(--line);border-radius:0;padding:0.7rem 0.9rem;font-size:0.78rem;line-height:1.7;color:var(--muted);margin-bottom:0.8rem;"></div>';
    el.innerHTML = h;
    const zbGo = el.querySelector('#zbBelGo');
    if (zbGo) zbGo.addEventListener('click', async () => {
      const box = el.querySelector('#zbBelRes');
      box.style.display = 'block'; box.textContent = '…';
      try {
        const d2 = await API.call('/supplier/belasting', { winst: Number(el.querySelector('#zbBelWinst').value) });
        const rij = (l, v, sterk) => '<div style="display:flex;justify-content:space-between;gap:0.8rem;"><span>'+l+'</span><span style="flex-shrink:0;'+(sterk?'color:var(--txt);font-weight:600;':'')+'">'+v+'</span></div>';
        box.innerHTML = '<div style="font-size:0.58rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--rtg-leesgoud,var(--gold));margin-bottom:0.35rem;">'+d2.regime+' · '+d2.landNaam+'</div>'+
          rij(T('zb.bel.winst','Jaarwinst'), eur(d2.winst))+
          d2.posten.map(p2 => rij(p2.label, (p2.bedrag<0?'- ':'')+eur(Math.abs(p2.bedrag)))).join('')+
          rij(T('zb.bel.betalen','Te betalen (indicatie)'), eur(d2.belasting), true)+
          rij(T('zb.bel.netto','Netto over'), eur(d2.netto), true)+
          '<div style="margin-top:0.5rem;color:var(--rtg-leesgoud,var(--gold));">'+T('zb.bel.zet','Zet ~')+d2.reserveerPct+'% '+T('zb.bel.opzij','opzij: ongeveer')+' '+eur(d2.perMaand)+' '+T('zb.bel.pm','per maand')+'.</div>'+
          '<div style="margin-top:0.4rem;font-size:0.64rem;color:var(--soft);">'+T('zb.bel.disc','Indicatie; dit is voorlichting, geen bindend fiscaal advies.')+'</div>';
      } catch(e){ box.textContent = e.message; }
    });
    wireFuncBlok(el);
    el.querySelectorAll('.js-zbf').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/zaak/functie', { id:b.dataset.id, aan: b.dataset.aan!=='true' }); await refresh(); renderZaakBoard(); } catch(e){ toast(e.message); }
    }));
    /* Een chip omzetten stuurt de VOLLEDIGE dicht-lijst terug, niet een los
       aan/uit: dan kan een half mislukt verzoek nooit een beleid achterlaten
       dat niemand zo bedoeld heeft. */
    el.querySelectorAll('.js-wbf').forEach(b => b.addEventListener('click', async () => {
      const dicht = [];
      el.querySelectorAll('.js-wbf').forEach(x => {
        const nu = x === b ? x.dataset.dicht !== 'true' : x.dataset.dicht === 'true';
        if (nu) dicht.push(x.dataset.id);
      });
      try { await API.call('/supplier/werkbeleid/zet', { uit: dicht }); renderZaakBoard(); }
      catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('.js-zbnaar').forEach(b => b.addEventListener('click', () => openTab(b.dataset.tab)));
    const bvSend = $('#bvSend');
    if (bvSend) bvSend.addEventListener('click', async () => {
      const bedrag = Number(($('#bvBedrag')||{}).value);
      if (!(bedrag >= 0.5)) { toast(T('zb.bedragmin','Kies een bedrag van minstens € 0,50.')); return; }
      /* Knop op slot tegen de dubbeltik, idem-sleutel tegen een herhaalde
         poging. Twee verzoeken van hetzelfde bedrag kan de gast namelijk
         ALLEBEI afrekenen (TAKEN.md 4.60). */
      if (bvSend.disabled) return;
      bvSend.disabled = true;
      try { await API.call('/supplier/betaalverzoek', { codename: ($('#bvCode')||{}).value, bedrag, omschrijving: ($('#bvOms')||{}).value, idem: RTGIdem('bv') }); toast(''+T('zb.verzoekgestuurd','Betaalverzoek verstuurd.')); renderZaakBoard(); }
      catch(e){ bvSend.disabled = false; toast(e.message); }
    });
    el.querySelectorAll('[data-bvweg]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/betaalverzoek/intrek', { ref:b.dataset.bvweg }); renderZaakBoard(); } catch(e){ toast(e.message); }
    }));
  }
/* DIT SLUITHAAKJE HOORT HIER, EN NIET EEN BESTAND VERDEROP.

   Het stond bovenaan 56.js, waardoor renderZaakBoard() pas daar dichtging en
   alles wat ertussen stond BINNEN die functie kwam te liggen -- zoals de
   Vooruit-kaart en de postvoorstellen van deze zaak (55c/55d). Aan deze kant
   viel dat niet meteen op, want renderZaakBoard roept ze zelf aan en een
   functieverklaring hijst binnen zijn eigen functie. Kapot was het toch: de
   `let`-variabelen ernaast werden bij ELKE render opnieuw op null gezet, dus de
   kaart haalde zijn gegevens elke keer opnieuw op en onthield niets.

   Aan de ledenkant liep dezelfde fout wel meteen stuk ("renderVooruit is not
   defined"). Zie de gelijkluidende opmerking in apps/app-main/app-main-53.js. */
