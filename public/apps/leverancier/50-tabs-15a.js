      if (renderDorp.buurt.length) buurtBlok = '<div style="margin-top:0.7rem;font-size:0.68rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--soft);">'+T('dorp.buurt','In de buurt')+'</div>'+
        '<div class="pos-chips" style="margin-top:0.35rem;">'+renderDorp.buurt.map(b =>
          '<span><button class="obtn js-dbuurt" data-naam="'+esc(b.naam)+'" data-soort="'+esc(b.soort)+'" data-km="'+b.km+'" style="padding:0.15rem 0.5rem;">'+b.icon+' '+esc(b.naam)+' · '+b.km+' km</button></span>').join('')+'</div>'+
        '<div class="softline" style="margin-top:0.3rem;">'+T('dorp.buurt.s','Een tik zet de naam alvast in de wens.')+'</div>';
    }
    el.innerHTML =
      '<div class="card" style="display:flex;gap:0.4rem;flex-wrap:wrap;">'+d.afdelingen.map(a =>
        '<button class="obtn'+(a.key===dorpKant?' primary':'')+'" data-dkant="'+a.key+'">'+a.icon+' '+esc(a.label)+(a.openAantal?' · '+a.openAantal:'')+'</button>').join('')+'</div>'+
      '<div class="card"><div class="tt-h">'+afd.icon+' '+esc(afd.label)+' <span class="sub">('+afd.keten.join(' · ')+')</span></div>'+
        toolsBlok+
        (afd.open.length ? afd.open.map(rij).join('') : '<div class="softline" style="margin-top:0.5rem;">'+T('dorp.leeg','Niets open bij deze afdeling.')+'</div>')+
        buurtBlok+
        (afd.klaar.length ? '<div style="margin-top:0.6rem;font-size:0.68rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--soft);">'+T('dorp.klaar','Net afgerond')+'</div>'+afd.klaar.map(rij).join('') : '')+
        '<div class="tt-add" style="flex-wrap:wrap;margin-top:0.7rem;">'+
          '<input id="dorpWaar" placeholder="'+esc(afd.waarHint)+'" style="flex:1;min-width:110px;">'+
          '<input id="dorpTekst" placeholder="'+esc(afd.watHint)+'" style="flex:2;min-width:160px;">'+
          '<button id="dorpAdd">'+T('dorp.zet','Zet erbij')+'</button></div>'+
      '</div>';
    el.querySelectorAll('[data-dkant]').forEach(b => b.addEventListener('click', () => {
      dorpKant = b.dataset.dkant;
      try { localStorage.setItem('rtg_dorp_kant', dorpKant); } catch(e){}
      renderDorp();
    }));
    el.querySelectorAll('[data-dpost]').forEach(elp => {
      const knop = elp.querySelector('.js-dverder');
      if (knop) knop.addEventListener('click', async () => {
        try { await API.call('/supplier/dorp/verder', { id: elp.dataset.dpost }); renderDorp(); } catch(e){ toast(e.message); }
      });
      // afdelingen praten met elkaar: de post reist door, met het spoor erbij
      const stuurKnop = elp.querySelector('.js-dstuur');
      if (stuurKnop) stuurKnop.addEventListener('click', async () => {
        const naar = window.prompt(T('dorp.stuurwaar','Naar welke afdeling?')+' ('+d.afdelingen.map(a=>a.key).join(', ')+')');
        if (!naar) return;
        try {
          const r = await API.call('/supplier/dorp/stuurdoor', { id: elp.dataset.dpost, naar: naar.trim().toLowerCase() });
          const doel = d.afdelingen.find(a => a.key === r.post.afdeling);
          toast((doel?doel.icon+' ':'')+T('dorp.gestuurd','Doorgestuurd naar')+' '+(doel?doel.label:r.post.afdeling)+'.');
          renderDorp();
        } catch(e){ toast(e.message); }
      });
    });
    // de buurt: een tik zet de naam alvast in de wens van de concierge
    el.querySelectorAll('.js-dbuurt').forEach(b => b.addEventListener('click', () => {
      const inp = el.querySelector('#dorpTekst');
      if (inp){ inp.value = T('dorp.regelbij','Regel bij')+' '+b.dataset.naam+' ('+b.dataset.soort+', '+b.dataset.km+' km): '; inp.focus(); }
    }));
    // de leeftijdscheck: de paspoort-bevestiging geeft ja/nee, nooit gegevens
    el.querySelectorAll('.js-dlft').forEach(b => b.addEventListener('click', async () => {
      const inp = el.querySelector('#dorpLftIn'), uit = el.querySelector('#dorpLftUit');
      const codenaam = (inp && inp.value || '').trim();
      if (!codenaam){ toast(T('dorp.lft.leeg','Vul de codenaam van de gast in.')); return; }
      const min = Number(b.dataset.min);
      try {
        const r = await API.call('/supplier/paspoort/vraag', { codenaam, niveau: 'bevestiging', minLeeftijd: min });
        const ok = r.bevestiging && r.bevestiging.voldoetLeeftijd === true;
        uit.innerHTML = ok
          ? '<b style="color:var(--green,#7ecb8f);font-size:1rem;">'+esc(codenaam)+' '+T('dorp.lft.ja','is')+' '+min+'+</b>'
          : '<b style="color:var(--burgundy,#C23A5E);font-size:1rem;">'+esc(codenaam)+' '+T('dorp.lft.nee','is NIET aantoonbaar')+' '+min+'+</b>';
      } catch(e){ uit.innerHTML = '<b style="color:var(--burgundy,#C23A5E);">'+esc(e.message)+'</b>'; }
    }));
    // het logmoment: een tik en het staat geklokt als afgeronde post
    el.querySelectorAll('.js-dactie').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/dorp/post', { afdeling: dorpKant, waar: '', tekst: b.dataset.tekst, directKlaar: true }); toast(afd.icon+' '+T('dorp.geklokt','Geklokt.')); renderDorp(); }
      catch(e){ toast(e.message); }
    }));
    // de meter van de afdeling: drukte, voorraad, seizoen
    el.querySelectorAll('[data-meter]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/dorp/drukte', { afdeling: dorpKant, stand: b.dataset.meter }); renderDorp(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('.js-dsnel').forEach(b => b.addEventListener('click', () => {
      const inp = el.querySelector('#dorpTekst');
      if (inp){ inp.value = b.dataset.snel+' '; inp.focus(); }
    }));
    const add = el.querySelector('#dorpAdd'); if (add) add.addEventListener('click', async () => {
      const waar = el.querySelector('#dorpWaar').value.trim();
      const tekst = el.querySelector('#dorpTekst').value.trim();
      if (!tekst){ toast(T('dorp.vul','Schrijf kort op wat er speelt.')); return; }
      try { await API.call('/supplier/dorp/post', { afdeling: dorpKant, waar, tekst }); toast(afd.icon+' '+T('dorp.gezet','Staat op de lijst van')+' '+afd.label+'.'); renderDorp(); }
      catch(e){ toast(e.message); }
    });
  }

