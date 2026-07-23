        const d = await API.call('/zakelijk/feed');
        body.innerHTML =
          '<div class="zak-kaart"><textarea id="zakPostTekst" placeholder="' + T('zak.postph','Deel een inzicht, vraag of mijlpaal met het netwerk…') + '" style="width:100%;min-height:64px;background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:0.6rem 0.7rem;color:var(--txt);font-family:inherit;font-size:0.8rem;"></textarea>' +
          '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:0.45rem;">' +
          '<span style="font-size:0.62rem;color:var(--soft);">' + (d.mijnProfiel ? T('zak.alsprof','U post onder uw professionele naam.') : T('zak.eerstprof','Maak eerst uw profiel aan (tab Mijn profiel).')) + '</span>' +
          '<button class="go" id="zakPost" style="padding:0.35rem 0.9rem;font-size:0.7rem;">' + T('zak.plaats','Plaats') + '</button></div></div>' +
          (d.posts.length ? d.posts.map(x =>
            '<div class="zak-kaart"><div style="display:flex;gap:0.5rem;align-items:baseline;"><b style="font-size:0.82rem;">' + escT(x.naam) + '</b>' +
            '<span style="font-size:0.64rem;color:var(--soft);">' + escT(x.kop) + ' · ' + timeAgo(x.at) + '</span>' +
            (x.openVoorWerk ? '<span class="zak-open">' + T('zak.open','open voor werk') + '</span>' : '') + '</div>' +
            '<div style="font-size:0.8rem;line-height:1.55;margin-top:0.35rem;white-space:pre-wrap;">' + msgHTML(x.tekst, x.lang) + '</div>' +
            '<div style="display:flex;gap:0.9rem;margin-top:0.5rem;font-size:0.7rem;color:var(--muted);">' +
            '<button class="js-zlike" data-id="' + x.id + '" style="background:none;border:none;color:' + (x.mijnLike ? 'var(--gold)' : 'var(--muted)') + ';font-family:inherit;cursor:pointer;">' + x.likes + '</button>' +
            '<span>' + x.reactiesTotaal + '</span></div>' +
            x.reacties.map(r => '<div style="font-size:0.72rem;margin-top:0.35rem;color:var(--muted);"><b style="color:var(--txt);">' + escT(r.naam) + '</b> ' + msgHTML(r.tekst, r.lang) + '</div>').join('') +
            '<div style="display:flex;gap:0.4rem;margin-top:0.5rem;"><input class="js-zretxt" data-id="' + x.id + '" placeholder="' + T('zak.reageer','Reageer…') + '" style="flex:1;background:var(--bg);border:1px solid var(--line);border-radius:999px;padding:0.4rem 0.75rem;color:var(--txt);font-family:inherit;font-size:0.72rem;">' +
            '<button class="js-zre" data-id="' + x.id + '" style="background:none;border:1px solid var(--line);border-radius:999px;padding:0.4rem 0.7rem;color:var(--txt);font-family:inherit;font-size:0.68rem;cursor:pointer;">↩</button></div></div>').join('')
          : '<div class="zak-kaart" style="color:var(--soft);font-size:0.78rem;">' + T('zak.leeg','Nog geen posts. Wees de eerste: deel waar u aan werkt.') + '</div>');
        $('#zakPost').addEventListener('click', async () => {
          try { await API.call('/zakelijk/post', { tekst: $('#zakPostTekst').value }); zakRender(); }
          catch(e){ if (e.status === 409){ zakView = 'profiel'; document.querySelectorAll('.zak-tab').forEach(x => x.classList.toggle('active', x.dataset.zaktab === 'profiel')); zakRender(); } toast(e.message); }
        });
        body.querySelectorAll('.js-zlike').forEach(b => b.addEventListener('click', async () => {
          try { await API.call('/zakelijk/like', { id: b.dataset.id }); zakRender(); } catch(e){ toast(e.message); }
        }));
        body.querySelectorAll('.js-zre').forEach(b => b.addEventListener('click', async () => {
          const inp = body.querySelector('.js-zretxt[data-id="' + b.dataset.id + '"]');
          try { await API.call('/zakelijk/reactie', { id: b.dataset.id, tekst: inp.value }); zakRender(); } catch(e){ toast(e.message); }
        }));
        hydrateMsgs(body); // zakelijke feed leest per kijker in de eigen taal
      } else if (zakView === 'netwerk'){
        const zoek = async (q) => {
          const d = await API.call('/zakelijk/gids', { q, openVoorWerk: $('#zakFilterWerk') ? $('#zakFilterWerk').checked : false });
          $('#zakGids').innerHTML = d.resultaten.length ? d.resultaten.map(zakProfielKaart).join('')
            : '<div class="zak-kaart" style="color:var(--soft);font-size:0.78rem;">' + T('zak.geen','Geen profielen gevonden. Leden verschijnen hier zodra ze hun zakelijke profiel aanzetten.') + '</div>';
          $('#zakGids').querySelectorAll('.js-zcon').forEach(b => b.addEventListener('click', async () => {
            try { const r = await API.call('/zakelijk/connect', { key: b.dataset.key }); toast(r.status === 'aangevraagd' ? T('zak.gevraagd','Verzoek gestuurd. De ander accepteert in Contacten.') : r.status); zoek($('#zakZoek').value); }
            catch(e){ toast(e.message); }
          }));
          $('#zakGids').querySelectorAll('.js-zaanb').forEach(ch => ch.addEventListener('click', async () => {
            try { const r = await API.call('/zakelijk/aanbevelen', { key: ch.dataset.key, vaardigheid: ch.dataset.v });
              toast(r.aanbevolen ? T('zak.aanbevolen','Aanbevolen') + ': ' + ch.dataset.v : T('zak.ingetrokken','Aanbeveling ingetrokken.')); zoek($('#zakZoek').value); }
            catch(e){ toast(e.message); }
          }));
        };
        body.innerHTML = '<div style="display:flex;gap:0.4rem;margin-top:0.6rem;">' +
          '<input id="zakZoek" placeholder="' + T('zak.zoekph','Zoek op naam, sector of vaardigheid…') + '" style="flex:1;background:var(--bg);border:1px solid var(--line);border-radius:999px;padding:0.5rem 0.85rem;color:var(--txt);font-family:inherit;font-size:0.76rem;">' +
          '<button class="go" id="zakZoekGo" style="padding:0.35rem 0.9rem;font-size:0.7rem;">' + T('zak.zoek','Zoek') + '</button></div>' +
          '<label style="display:flex;align-items:center;gap:0.4rem;font-size:0.7rem;color:var(--muted);margin-top:0.5rem;"><input type="checkbox" id="zakFilterWerk"> ' + T('zak.filterwerk','Alleen leden die open voor werk zijn') + '</label>' +
          '<div id="zakGids"></div>';
        $('#zakZoekGo').addEventListener('click', () => zoek($('#zakZoek').value));
        $('#zakZoek').addEventListener('keydown', e => { if (e.key === 'Enter') zoek(e.target.value); });
        $('#zakFilterWerk').addEventListener('change', () => zoek($('#zakZoek').value));
        zoek('');
      } else if (zakView === 'kansen'){
        const SOORT_ICO = { opdracht:'', samenwerking:'', vacature:'', investering:'', anders:'' };
