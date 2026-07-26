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
