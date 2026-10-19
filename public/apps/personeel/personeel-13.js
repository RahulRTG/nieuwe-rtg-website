/* Fluister: de persoonlijke assistent, nooit gedeeld met de werkgever */
    $('#hulpWrap').innerHTML =
      // Fluister: de persoonlijke assistent van dit personeelslid (eigen
      // geheugen, nooit gedeeld met de werkgever)
      '<div class="card"><div class="k">✦ '+T('pd.fl.h','Mijn assistent')+'</div>'+
      '<div class="s-1dlzpnu">'+T('pd.fl.d','Uw eigen assistent. Hij onthoudt wat u hem vertelt ("onthoud dat...") en leert van wat u gebruikt; vraag "wat weet je over mij" en wis wanneer u wilt.')+'</div>'+
      '<div id="pkFlSein"></div>'+
      '<div id="pkFlUit" style="margin-top:0.45rem;font-size:0.8rem;line-height:1.5;">'+(pkFlLaatst||'')+'</div>'+
      '<div class="s-1stuony"><input id="pkFlIn" placeholder="'+T('pd.fl.ph','Vraag iets, of: onthoud dat...')+'" class="s-1143q4m">'+
      '<button class="abtn ghost" id="pkFlMic" aria-label="'+T('pd.fl.mic','Spreek uw vraag in')+'"></button>'+
      '<button class="abtn" id="pkFlStuur">'+T('pd.fl.stuur','Stuur')+'</button></div></div>'+
      trainingKaart()+
      '<div class="card"><div class="k">'+T('pd.eh.h','EHBO, direct bij de hand')+'</div>'+
      '<div class="s-v4g2d9">'+
        '<a href="tel:112" class="abtn" style="text-decoration:none;text-align:center;flex:1;">'+T('pd.eh.112','Bel 112')+'</a>'+
        '<button class="abtn ghost h-flex1" id="ehboAlarm">'+T('pd.eh.alarm','EHBO-alarm team')+'</button></div>'+
      gids.map((g, i) =>
        '<div class="task s-3vd53t" data-eh="'+i+'"><span class="ic">'+g.i+'</span><div class="t"><b>'+g.t+'</b>'+
        (hulpOpen === i
          ? '<ol class="s-1tkl25v">'+g.s.map(x => '<li>'+x+'</li>').join('')+'</ol>'
          : '<span>'+T('pd.eh.open','Tik voor de stappen')+'</span>')+
        '</div></div>').join('')+
      '<div class="s-1xzubp5">'+T('pd.eh.disc','Dit is een geheugensteun, geen opleiding. Bel bij twijfel altijd 112.')+'</div></div>'+

      '<div class="card"><div class="k">'+T('pd.tp.h','Vertrouwenspersoon van RTG')+'</div>'+
      '<div class="s-lkp24d">'+T('pd.tp.s','Volledig vertrouwelijk: uw werkgever ziet hier niets van. Alleen de vertrouwenspersoon van RTG leest en beantwoordt uw bericht. Voor alles wat u niet op de zaak kwijt kunt: van een onveilig gevoel tot problemen met een leidinggevende.')+'</div>'+
      (tr.messages.length ? '<div class="chat h-mt60">'+tr.messages.map(m =>
        '<div class="msg '+(m.from === 'staff' ? 'me' : 'other')+'">'+(m.from === 'rtg' ? '<span class="who">'+T('pd.tp.rtg','Vertrouwenspersoon RTG')+'</span>' : '')+esc(m.text)+'</div>').join('')+'</div>' : '')+
      '<label class="s-pgr0m8"><input type="checkbox" id="tpAnon"'+(tr.anon ? ' checked' : '')+'> '+T('pd.tp.anon','Verstuur anoniem (uw naam wordt niet gedeeld)')+'</label>'+
      '<div class="compose s-oeboaz"><input id="tpText" placeholder="'+T('pd.tp.ph','Vertel in vertrouwen wat er speelt...')+'"><button id="tpSend">'+T('pd.send','Stuur')+'</button></div></div>'+

      '<div class="card"><div class="k">'+T('pd.ad.h','Mijn administratie')+'</div>'+
      '<button class="abtn ghost" id="ziekBtn" style="width:100%;margin-top:0.5rem;">'+(ziekArm ? ''+T('pd.ad.ziek2','Tik nogmaals om de ziekmelding te bevestigen') : ''+T('pd.ad.ziek','Ziek melden'))+'</button>'+
      '<div class="s-md2d33">'+T('pd.ad.verlof','Verlof aanvragen')+'</div>'+
      '<div class="s-v4g2d9"><input type="date" id="vlVan" class="vlin s-1ujuoye"><input type="date" id="vlTot" class="vlin s-1ujuoye"></div>'+
      '<div class="compose s-1ult97w"><span class="h-flex1 h-zachter">'+T('pd.ad.geenreden','Een reden is niet nodig.')+'</span><button id="vlGo">'+T('pd.ad.vraag','Vraag aan')+'</button></div>'+
      (vl.length ? '<div class="h-mt60">'+vl.map(v =>
        '<div class="task"><span class="ic">'+(v.soort === 'ziek' ? '' : '')+'</span><div class="t"><b>'+(v.soort === 'ziek' ? T('pd.ad.zm','Ziekmelding')+' '+v.van : v.van+' t/m '+(v.tot || ''))+'</b></div>'+
        '<span style="font-size:0.64rem;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:'+(VST[v.status] || [v.status, 'var(--soft)'])[1]+';">'+(VST[v.status] || [v.status])[0]+'</span></div>').join('')+'</div>' : '')+
      '</div>'+

      (() => { const mijnCon = (pdContracten||[]).filter(c => c.partij.kind === 'staff' && c.partij.naam === me.name);
        return mijnCon.length ? '<div class="card"><div class="k">\uD83D\uDCDD '+T('pd.ct.h','Mijn contracten')+'</div>'+
        mijnCon.map(c => {
          const ikGetekend = !!c.tekenPartij, zaakGetekend = !!c.tekenZaak;
          return '<div class="task s-116qcbx"><div class="t"><b>'+esc(c.titel)+'</b><span>'+T('pd.ct.'+c.soort, c.soort)+' \u00B7 '+(zaakGetekend?'\u2705':'\u25CB')+' '+T('pd.ct.zaak','zaak')+' / '+(ikGetekend?'\u2705':'\u25CB')+' '+T('pd.ct.ik','ik')+'</span></div>'+
          (c.velden && c.velden.length ? '<div class="s-114a5um">'+c.velden.map(v=>esc(v.label)+': '+esc(v.waarde)).join(' \u00B7 ')+'</div>' : '')+
          '<details class="h-mt30"><summary class="s-1mwt7yy">'+T('pd.ct.lees','Voorwaarden')+'</summary><div class="s-879nso">'+esc(c.tekst)+'</div></details>'+
          (!ikGetekend && c.status !== 'geweigerd' ? '<button class="abtn h-mt50" data-ctteken="'+c.ref+'">'+T('pd.ct.teken','Ondertekenen')+'</button>' : (ikGetekend ? '<div class="s-w6x99n">\u2705 '+T('pd.ct.getekend','U tekende dit contract.')+'</div>' : ''))+
          '</div>';
        }).join('')+'</div>' : '';
      })();

    // Mijn taal: de moedertaal van dit personeelslid. Het HELE werkscherm,
    // de bonnen en de taken volgen deze keuze, in elke werk-app.
    $('#hulpWrap').insertAdjacentHTML('beforeend',
      '<div class="card"><div class="k">'+T('pd.taal.h','Mijn taal')+'</div>'+
      '<div class="s-1qsgee5">'+T('pd.taal.s','Kies uw moedertaal. Uw hele scherm, uw bonnen en uw taken verschijnen dan in die taal, hier en op elke andere werk-app waar u inlogt.')+'</div>'+
      '<select id="mtKies" class="s-n6ctnm"></select></div>');
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
      el.innerHTML = '<div class="s-9lp1ns">'+
        '<div class="s-1912qcj">'+T('pd.fl.sein','Mijn assistent ziet')+'</div>'+
        prof.seintjes.map(x => '<div class="s-nqrzav">'+esc(x.icoon)+' '+esc(x.tekst)+'</div>').join('')+'</div>';
    }).catch(() => {});
    // Fluister: vraag stellen; de gebruikstellers van de inklap-laag reizen mee
    const pkFlVraag = async q => {
      if (!q) return;
      if (window.FocusUI) API.call('/staff/fluister/focus', { scores: FocusUI.scores() }).catch(() => {});
      try {
        const r = await API.call('/staff/fluister', { q });
        pkFlLaatst = '<span class="s-1pv2lmv">› '+esc(q)+'</span><br>✦ '+esc(r.antwoord);
        const uit = document.getElementById('pkFlUit');
        if (uit) uit.innerHTML = pkFlLaatst;
        const v = (r.goedkeuringen || [])[0];
        if (v && confirm(T('pd.fl.check','Controleer deze exacte actie:')+'\n\n'+(v.samenvatting || v.pad)+'\n\n'+T('pd.fl.confirm','Wilt u dit eenmalige voorstel uitvoeren?'))) {
          const b = await API.call('/staff/doe/bevestig', { goedkeuringId: v.id, akkoord: true });
          toast(b.ok ? T('pd.fl.done','Voorstel bevestigd en uitgevoerd.') : T('pd.fl.stop','De server heeft de actie geweigerd.'));
        }
      } catch(e){ toast(e.message); }
    };
    const pkfs = document.getElementById('pkFlStuur');
