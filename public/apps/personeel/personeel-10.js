      // geheugen, nooit gedeeld met de werkgever)
      '<div class="card"><div class="k">✦ '+T('pd.fl.h','Mijn assistent')+'</div>'+
      '<div style="margin-top:0.35rem;font-size:0.74rem;color:var(--soft);">'+T('pd.fl.d','Uw eigen assistent. Hij onthoudt wat u hem vertelt ("onthoud dat...") en leert van wat u gebruikt; vraag "wat weet je over mij" en wis wanneer u wilt.')+'</div>'+
      '<div id="pkFlSein"></div>'+
      '<div id="pkFlUit" style="margin-top:0.45rem;font-size:0.8rem;line-height:1.5;">'+(pkFlLaatst||'')+'</div>'+
      '<div style="display:flex;gap:0.4rem;margin-top:0.5rem;"><input id="pkFlIn" placeholder="'+T('pd.fl.ph','Vraag iets, of: onthoud dat...')+'" style="flex:1;background:var(--card2,#191715);border:1px solid var(--line);border-radius:10px;padding:0.55rem 0.7rem;color:var(--txt);outline:none;font-family:inherit;font-size:0.85rem;">'+
      '<button class="abtn ghost" id="pkFlMic" aria-label="'+T('pd.fl.mic','Spreek uw vraag in')+'"></button>'+
      '<button class="abtn" id="pkFlStuur">'+T('pd.fl.stuur','Stuur')+'</button></div></div>'+
      trainingKaart()+
      '<div class="card"><div class="k">'+T('pd.eh.h','EHBO, direct bij de hand')+'</div>'+
      '<div style="display:flex;gap:0.5rem;margin-top:0.6rem;">'+
        '<a href="tel:112" class="abtn" style="text-decoration:none;text-align:center;flex:1;">'+T('pd.eh.112','Bel 112')+'</a>'+
        '<button class="abtn ghost" id="ehboAlarm" style="flex:1;">'+T('pd.eh.alarm','EHBO-alarm team')+'</button></div>'+
      gids.map((g, i) =>
        '<div class="task" data-eh="'+i+'" style="cursor:pointer;"><span class="ic">'+g.i+'</span><div class="t"><b>'+g.t+'</b>'+
        (hulpOpen === i
          ? '<ol style="margin:0.45rem 0 0.2rem 1.1rem;font-size:0.8rem;line-height:1.5;color:var(--txt);display:flex;flex-direction:column;gap:0.3rem;">'+g.s.map(x => '<li>'+x+'</li>').join('')+'</ol>'
          : '<span>'+T('pd.eh.open','Tik voor de stappen')+'</span>')+
        '</div></div>').join('')+
      '<div style="margin-top:0.55rem;font-size:0.66rem;color:var(--soft);">'+T('pd.eh.disc','Dit is een geheugensteun, geen opleiding. Bel bij twijfel altijd 112.')+'</div></div>'+

      '<div class="card"><div class="k">'+T('pd.tp.h','Vertrouwenspersoon van RTG')+'</div>'+
      '<div style="margin-top:0.4rem;font-size:0.76rem;line-height:1.5;color:var(--soft);">'+T('pd.tp.s','Volledig vertrouwelijk: uw werkgever ziet hier niets van. Alleen de vertrouwenspersoon van RTG leest en beantwoordt uw bericht. Voor alles wat u niet op de zaak kwijt kunt: van een onveilig gevoel tot problemen met een leidinggevende.')+'</div>'+
      (tr.messages.length ? '<div class="chat" style="margin-top:0.6rem;">'+tr.messages.map(m =>
        '<div class="msg '+(m.from === 'staff' ? 'me' : 'other')+'">'+(m.from === 'rtg' ? '<span class="who">'+T('pd.tp.rtg','Vertrouwenspersoon RTG')+'</span>' : '')+esc(m.text)+'</div>').join('')+'</div>' : '')+
      '<label style="display:flex;align-items:center;gap:0.5rem;margin-top:0.6rem;font-size:0.76rem;color:var(--soft);"><input type="checkbox" id="tpAnon"'+(tr.anon ? ' checked' : '')+'> '+T('pd.tp.anon','Verstuur anoniem (uw naam wordt niet gedeeld)')+'</label>'+
      '<div class="compose" style="padding:0.6rem 0 0;"><input id="tpText" placeholder="'+T('pd.tp.ph','Vertel in vertrouwen wat er speelt...')+'"><button id="tpSend">'+T('pd.send','Stuur')+'</button></div></div>'+

      '<div class="card"><div class="k">'+T('pd.ad.h','Mijn administratie')+'</div>'+
      '<button class="abtn ghost" id="ziekBtn" style="width:100%;margin-top:0.6rem;">'+(ziekArm ? ''+T('pd.ad.ziek2','Tik nogmaals om de ziekmelding te bevestigen') : ''+T('pd.ad.ziek','Ziek melden'))+'</button>'+
      '<div style="margin-top:0.9rem;font-size:0.64rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--soft);">'+T('pd.ad.verlof','Verlof aanvragen')+'</div>'+
      '<div style="display:flex;gap:0.5rem;margin-top:0.45rem;"><input type="date" id="vlVan" class="vlin" style="flex:1;min-width:0;"><input type="date" id="vlTot" class="vlin" style="flex:1;min-width:0;"></div>'+
      '<div class="compose" style="padding:0.5rem 0 0;"><input id="vlReden" placeholder="'+T('pd.ad.reden','Reden (mag leeg blijven)')+'"><button id="vlGo">'+T('pd.ad.vraag','Vraag aan')+'</button></div>'+
      (vl.length ? '<div style="margin-top:0.6rem;">'+vl.map(v =>
        '<div class="task"><span class="ic">'+(v.soort === 'ziek' ? '' : '')+'</span><div class="t"><b>'+(v.soort === 'ziek' ? T('pd.ad.zm','Ziekmelding')+' '+v.van : v.van+' t/m '+(v.tot || ''))+'</b><span>'+esc(v.reden || '')+'</span></div>'+
        '<span style="font-size:0.64rem;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:'+(VST[v.status] || [v.status, 'var(--soft)'])[1]+';">'+(VST[v.status] || [v.status])[0]+'</span></div>').join('')+'</div>' : '')+
      '</div>'+

      (() => { const mijnCon = (pdContracten||[]).filter(c => c.partij.kind === 'staff' && c.partij.naam === me.name);
        return mijnCon.length ? '<div class="card"><div class="k">\uD83D\uDCDD '+T('pd.ct.h','Mijn contracten')+'</div>'+
        mijnCon.map(c => {
          const ikGetekend = !!c.tekenPartij, zaakGetekend = !!c.tekenZaak;
          return '<div class="task" style="flex-direction:column;align-items:stretch;"><div class="t"><b>'+esc(c.titel)+'</b><span>'+T('pd.ct.'+c.soort, c.soort)+' \u00B7 '+(zaakGetekend?'\u2705':'\u25CB')+' '+T('pd.ct.zaak','zaak')+' / '+(ikGetekend?'\u2705':'\u25CB')+' '+T('pd.ct.ik','ik')+'</span></div>'+
          (c.velden && c.velden.length ? '<div style="font-size:0.72rem;color:var(--soft);margin-top:0.2rem;">'+c.velden.map(v=>esc(v.label)+': '+esc(v.waarde)).join(' \u00B7 ')+'</div>' : '')+
          '<details style="margin-top:0.3rem;"><summary style="cursor:pointer;font-size:0.72rem;color:var(--gold);">'+T('pd.ct.lees','Voorwaarden')+'</summary><div style="font-size:0.76rem;color:var(--muted);white-space:pre-wrap;margin-top:0.3rem;">'+esc(c.tekst)+'</div></details>'+
          (!ikGetekend && c.status !== 'geweigerd' ? '<button class="abtn" data-ctteken="'+c.ref+'" style="margin-top:0.5rem;">'+T('pd.ct.teken','Ondertekenen')+'</button>' : (ikGetekend ? '<div style="margin-top:0.4rem;font-size:0.76rem;color:var(--green);">\u2705 '+T('pd.ct.getekend','U tekende dit contract.')+'</div>' : ''))+
          '</div>';
        }).join('')+'</div>' : '';
      })();

    // Mijn taal: de moedertaal van dit personeelslid. Het HELE werkscherm,
    // de bonnen en de taken volgen deze keuze, in elke werk-app.
    $('#hulpWrap').insertAdjacentHTML('beforeend',
      '<div class="card"><div class="k">'+T('pd.taal.h','Mijn taal')+'</div>'+
      '<div style="margin-top:0.4rem;font-size:0.74rem;color:var(--soft);">'+T('pd.taal.s','Kies uw moedertaal. Uw hele scherm, uw bonnen en uw taken verschijnen dan in die taal, hier en op elke andere werk-app waar u inlogt.')+'</div>'+
      '<select id="mtKies" style="width:100%;margin-top:0.5rem;background:var(--card2,#191715);border:1px solid var(--line);border-radius:10px;padding:0.55rem 0.7rem;color:var(--txt);font:inherit;font-size:0.85rem;"></select></div>');
    if (window.MoederTaal) MoederTaal.talen().then(ts => {
      const sel = document.getElementById('mtKies'); if (!sel || !ts.length) return;
      const nu = MoederTaal.actueel();
      sel.innerHTML = ts.map(t2 => '<option value="'+t2.code+'"'+(t2.code === nu ? ' selected' : '')+'>'+t2.naam+'</option>').join('');
      sel.addEventListener('change', async () => {
        try { await MoederTaal.zet(sel.value); toast(T('pd.taal.ok','Uw taal staat ingesteld; het scherm volgt.')); }
        catch(e){ toast(e.message); }
      });
    });

    // Fluister fluistert ook zelf: seintjes uit je eigen weetjes (datums die
    // naderen), zonder dat je iets hoeft te vragen
    API.call('/staff/fluister/profiel').then(prof => {
      const el = document.getElementById('pkFlSein');
      if (!el || !(prof.seintjes || []).length) return;
      el.innerHTML = '<div style="margin-top:0.45rem;border:1px solid var(--line);border-radius:10px;padding:0.5rem 0.65rem;">'+
        '<div style="font-size:0.58rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--soft);">'+T('pd.fl.sein','Mijn assistent ziet')+'</div>'+
        prof.seintjes.map(x => '<div style="margin-top:0.28rem;font-size:0.76rem;line-height:1.45;">'+esc(x.icoon)+' '+esc(x.tekst)+'</div>').join('')+'</div>';
    }).catch(() => {});
    // Fluister: vraag stellen; de gebruikstellers van de inklap-laag reizen mee
    const pkFlVraag = async q => {
      if (!q) return;
      if (window.FocusUI) API.call('/staff/fluister/focus', { scores: FocusUI.scores() }).catch(() => {});
      try {
        const r = await API.call('/staff/fluister', { q });
        pkFlLaatst = '<span style="color:var(--soft);">› '+esc(q)+'</span><br>✦ '+esc(r.antwoord);
        const uit = document.getElementById('pkFlUit');
        if (uit) uit.innerHTML = pkFlLaatst;
      } catch(e){ toast(e.message); }
    };
    const pkfs = document.getElementById('pkFlStuur');
    if (pkfs) pkfs.addEventListener('click', () => {
      const inp = document.getElementById('pkFlIn');
      const q = (inp.value || '').trim();
      inp.value = '';
      pkFlVraag(q);
    });
    // spreek de vraag in via de gedeelde spraakmotor: handig met een
    // dienblad in de ene hand
    if (window.Spraak) Spraak.koppel(document.getElementById('pkFlMic'), {
      opTekst: zin => {
        const inp = document.getElementById('pkFlIn');
        if (inp) inp.value = zin;
        pkFlVraag(zin);
      },
      kanNiet: () => toast(T('pd.fl.micniet','Spraak werkt niet op dit toestel; typen kan altijd.'))
    });
    document.querySelectorAll('[data-eh]').forEach(el => el.addEventListener('click', () => {
      const i = Number(el.dataset.eh);
      hulpOpen = hulpOpen === i ? null : i;
      renderHulp();
    }));
    document.querySelectorAll('[data-ctteken]').forEach(b => b.addEventListener('click', async () => {
      const naam = prompt(T('pd.ct.tekenvraag','Typ uw naam om digitaal te ondertekenen:'));
      if (!naam) return;
      try { await API.call('/supplier/contract/teken', { ref: b.dataset.ctteken, naam, akkoord: true }); toast(T('pd.ct.tekenok','Ondertekend.')); await laadZaken(); renderHulp(); }
      catch(e){ toast(e.message); }
    }));
    const ea = document.getElementById('ehboAlarm');
    if (ea) ea.addEventListener('click', () => sendSOS('EHBO nodig', ''+T('pd.eh.gestuurd','EHBO-alarm verstuurd. Het team is gealarmeerd.')));
