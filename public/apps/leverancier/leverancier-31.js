    // Verkoop: producten (oogst vult de voorraad) en verkopen via de Salon
    html += '<div class="card"><div class="tt-h">'+T('boer.verkoop','Verkoop via de Salon')+'</div>'+
      '<p class="sub h-mt20">'+T('boer.verkoop.sub','Uw oogst komt hier automatisch in de voorraad. Zet een prijs en plaats het in de Salon; leden claimen en halen op.')+'</p>'+
      ((o.producten||[]).length ? (o.producten||[]).map(pr => '<div class="mitem"><div class="r1"><span class="nm">'+esc(pr.naam)+'</span><span class="pr">'+pr.voorraad+' '+esc(pr.eenheid)+'</span></div>'+
        '<div class="s-1yabp00">'+
          '<span class="s-b4rdxo">€</span><input type="number" min="0" step="0.1" value="'+(pr.prijs||'')+'" data-prijsin="'+pr.id+'" class="s-j52dwk"><span class="s-b4rdxo">/'+esc(pr.eenheid)+'</span>'+
          (canEdit?'<button class="obtn" data-prijsset="'+pr.id+'">'+T('boer.prijsopslaan','Prijs')+'</button>':'')+
          (canEdit?'<button class="obtn primary" data-naarsalon="'+pr.id+'">'+(pr.inSalon?''+T('boer.opnieuwsalon','Opnieuw in Salon'):'✦ '+T('boer.insalon','In de Salon'))+'</button>':'')+
          (canEdit?'<button class="rr-del" data-proddel="'+pr.id+'">✕</button>':'')+
        '</div></div>').join('')
        : '<div class="ds h-mt50">'+T('boer.geenprod','Nog geen producten. Oogst een perceel of voeg er hieronder een toe.')+'</div>')+
      (canEdit ? '<div class="s-m6o005"><input id="boerPrNaam" placeholder="'+T('boer.prnaam','Product')+'" class="s-1hdld0o"><input id="boerPrEenh" placeholder="'+T('boer.preenh','kg')+'" class="s-1b459jf"><input id="boerPrPrijs" type="number" min="0" step="0.1" placeholder="€" class="s-xhqwuk"><button class="obtn primary" id="boerPrAdd">+</button></div>' : '')+'</div>';
    // AI-adviseur
    if (canEdit){
      html += '<div class="card"><div class="tt-h">'+T('boer.ai','AI-adviseur')+'</div>'+
        '<p class="sub h-mt30">'+T('boer.ai.sub','Vraag advies of geef een opdracht, bijv. "zaai tomaat op Kasblok 1" of "voeg 20 melkkoeien toe".')+'</p>'+
        '<div id="boerAiOut" class="h-mt50"></div>'+
        '<div class="s-1stuony"><input id="boerAiIn" placeholder="'+T('boer.ai.ph','Uw vraag of opdracht...')+'" class="s-15cxk9r"><button class="obtn primary" id="boerAiGo">'+T('boer.ai.go','Vraag')+'</button></div></div>';
    }
    el.innerHTML = html;
    // wiring
    el.querySelectorAll('[data-btype]').forEach(b => b.addEventListener('click', async () => { try { boerToe(await API.call('/supplier/boerderij/type', { type: b.dataset.btype })); toast(T('boer.typeok','Boerderijtype ingesteld.')); } catch(e){ toast(e.message); } }));
    el.querySelectorAll('[data-zaaisel]').forEach(s2 => s2.addEventListener('change', async () => { if (!s2.value) return; try { const r = await API.call('/supplier/boerderij/zaai', { id: s2.dataset.zaaisel, gewas: s2.value }); toast(T('boer.zaaiok','Gezaaid. Oogst verwacht rond ')+r.oogstVerwacht); boerToe(r); } catch(e){ toast(e.message); } }));
    el.querySelectorAll('[data-oogst]').forEach(b => b.addEventListener('click', async () => { try { const r = await API.call('/supplier/boerderij/oogst', { id: b.dataset.oogst }); toast(T('boer.oogstok','Geoogst: ')+r.opbrengst+' '+r.eenheid); boerToe(r); } catch(e){ toast(e.message); } }));
    el.querySelectorAll('[data-water]').forEach(b => b.addEventListener('click', async () => { try { boerToe(await API.call('/supplier/boerderij/water', { id: b.dataset.water })); toast(T('boer.waterok','Beregend.')); } catch(e){ toast(e.message); } }));
    el.querySelectorAll('[data-percdel]').forEach(b => b.addEventListener('click', async () => { try { boerToe(await API.call('/supplier/boerderij/perceel', { weg: true, id: b.dataset.percdel })); } catch(e){ toast(e.message); } }));
    const pcAdd = $('#boerPcAdd'); if (pcAdd) pcAdd.addEventListener('click', async () => { const naam = $('#boerPcNaam').value.trim(); if (!naam) return; try { boerToe(await API.call('/supplier/boerderij/perceel', { naam, ha: Number($('#boerPcHa').value)||0 })); } catch(e){ toast(e.message); } });
    el.querySelectorAll('[data-voer]').forEach(b => b.addEventListener('click', async () => { try { const r = await API.call('/supplier/boerderij/voer', { id: b.dataset.voer }); toast(T('boer.voerok','Gevoerd ')+'('+r.voerKg+' kg).'); boerToe(r); } catch(e){ toast(e.message); } }));
    el.querySelectorAll('[data-opbset]').forEach(b => b.addEventListener('click', async () => { const inp = el.querySelector('[data-opbin="'+b.dataset.opbset+'"]'); const v = inp?Number(inp.value):0; try { boerToe(await API.call('/supplier/boerderij/opbrengst', { id: b.dataset.opbset, waarde: v })); toast(T('boer.opbok','Opbrengst vastgelegd.')); } catch(e){ toast(e.message); } }));
    el.querySelectorAll('[data-gezond]').forEach(s2 => s2.addEventListener('change', async () => { try { boerToe(await API.call('/supplier/boerderij/dier', { id: s2.dataset.gezond, gezondheid: s2.value })); } catch(e){ toast(e.message); } }));
    el.querySelectorAll('[data-dierdel]').forEach(b => b.addEventListener('click', async () => { try { boerToe(await API.call('/supplier/boerderij/dier', { weg: true, id: b.dataset.dierdel })); } catch(e){ toast(e.message); } }));
    const drAdd = $('#boerDrAdd'); if (drAdd) drAdd.addEventListener('click', async () => { try { boerToe(await API.call('/supplier/boerderij/dier', { soort: $('#boerDrSoort').value, aantal: Number($('#boerDrAantal').value)||0 })); } catch(e){ toast(e.message); } });
    el.querySelectorAll('[data-taakklaar]').forEach(b => b.addEventListener('click', async () => { try { boerToe(await API.call('/supplier/boerderij/taak/klaar', { id: b.dataset.taakklaar })); } catch(e){ toast(e.message); } }));
    el.querySelectorAll('[data-taakdel]').forEach(b => b.addEventListener('click', async () => { try { boerToe(await API.call('/supplier/boerderij/taak', { weg: true, id: b.dataset.taakdel })); } catch(e){ toast(e.message); } }));
    const tkAdd = $('#boerTkAdd'); if (tkAdd) tkAdd.addEventListener('click', async () => { const wat = $('#boerTkWat').value.trim(); if (!wat) return; try { boerToe(await API.call('/supplier/boerderij/taak', { wat, voor: $('#boerTkVoor').value })); } catch(e){ toast(e.message); } });
    el.querySelectorAll('[data-prijsset]').forEach(b => b.addEventListener('click', async () => { const inp = el.querySelector('[data-prijsin="'+b.dataset.prijsset+'"]'); try { boerToe(await API.call('/supplier/boerderij/product', { id: b.dataset.prijsset, prijs: inp?Number(inp.value):0 })); toast(T('boer.prijsok','Prijs opgeslagen.')); } catch(e){ toast(e.message); } }));
    el.querySelectorAll('[data-naarsalon]').forEach(b => b.addEventListener('click', async () => { try { const r = await API.call('/supplier/boerderij/naar-salon', { id: b.dataset.naarsalon }); toast(T('boer.salonok','In de Salon gezet; leden zien het nu.')); boerToe(r); } catch(e){ toast(e.message); } }));
    el.querySelectorAll('[data-proddel]').forEach(b => b.addEventListener('click', async () => { try { boerToe(await API.call('/supplier/boerderij/product', { weg: true, id: b.dataset.proddel })); } catch(e){ toast(e.message); } }));
    const prAdd = $('#boerPrAdd'); if (prAdd) prAdd.addEventListener('click', async () => { const naam = $('#boerPrNaam').value.trim(); if (!naam) return; try { boerToe(await API.call('/supplier/boerderij/product', { naam, eenheid: $('#boerPrEenh').value.trim()||'kg', prijs: Number($('#boerPrPrijs').value)||0 })); } catch(e){ toast(e.message); } });
