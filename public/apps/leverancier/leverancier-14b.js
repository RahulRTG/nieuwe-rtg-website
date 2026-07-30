            const mij = d.aandelen.find(a => a.code === mijnCode) || {};
            return '<div class="st-row"><span><b>'+esc(d.naam)+'</b> · '+eur(d.prijsCenten)+
              '<span class="sub">'+d.aandelen.map(a => esc(a.naam)+' '+eur(a.centen)+(a.akkoord?' ✓':' …')).join(' + ')+
              ' · status: '+esc(d.status)+'</span></span>'+
              (d.status === 'voorstel' && !mij.akkoord
                ? '<span><button class="obtn" data-synja="'+d.id+'">✓ '+T('sy.teken','Teken')+'</button> '+
                  '<button class="obtn ghost" data-synnee="'+d.id+'">✕</button></span>'
                : (d.status !== 'gestopt' ? '<button class="obtn ghost" data-synstop="'+d.id+'">'+T('sy.stop','Stop')+'</button>' : ''))+
              '</div>';
          }).join('')+
          '<div style="display:flex;gap:0.45rem;flex-wrap:wrap;margin-top:0.6rem;align-items:center;">'+
            '<input id="synNaam" placeholder="'+T('sy.naam','Naam van de deal')+'" style="flex:2;min-width:9rem;">'+
            '<input id="synPartner" placeholder="'+T('sy.partner','Partnercode (bijv. SAKURA)')+'" style="flex:1;min-width:7rem;">'+
            '<input id="synPrijs" inputmode="decimal" placeholder="'+T('sy.prijs','Totaal EUR')+'" style="width:6.5rem;">'+
            '<input id="synMijn" inputmode="decimal" placeholder="'+T('sy.mijn','Mijn deel EUR')+'" style="width:6.5rem;">'+
            '<button class="obtn" id="synMaak">'+T('sy.maak','Stel voor')+'</button></div></div>';
        // baas over uw zaak: elke functie aan of uit; alleen app-betalen heeft
        // bewust geen knop, wel kiest u het moment (vooraf of achteraf)
        const caps2 = (S && S.caps) || [];
        const inst = state.settings || {};
        const optAan = k => !inst.opties || inst.opties[k] !== false;
        const rijen = [];
        if (caps2.includes('menu') || caps2.includes('rooms')){
          rijen.push(['ordersOpen', T('sw.orders','Bestellen via de app'), T('sw.orders.s','Leden kunnen bij u bestellen'), inst.ordersOpen !== false]);
          rijen.push(['reservationsOpen', T('sw.res','Reserveringen'), T('sw.res.s','Nieuwe reserveringen aannemen'), inst.reservationsOpen !== false]);
        }
        rijen.push(['betaalVooraf', T('sw.vooraf','Vooraf betalen'), T('sw.vooraf.s','Uit = gasten betalen achteraf. Betalen zelf gaat altijd via de app.'), optAan('betaalVooraf')]);
        rijen.push(['gastchat', T('sw.chat','Gastchat'), T('sw.chat.s','Gasten kunnen uw team berichten sturen'), optAan('gastchat')]);
        if (caps2.includes('rides')) rijen.push(['ritten', T('sw.ritten','Ritaanvragen'), T('sw.ritten.s','Nieuwe ritten aannemen via de app'), optAan('ritten')]);
        if (caps2.includes('doors')) rijen.push(['deurenGast', T('sw.deuren','Digitale gastsleutel'), T('sw.deuren.s','Gearriveerde gasten openen zelf de voordeur'), optAan('deurenGast')]);
        if (horeca) rijen.push(['events', T('sw.events','Event-aanmeldingen'), T('sw.events.s','Leden kunnen zich aanmelden voor uw events'), optAan('events')]);
        const swRows = rijen.map(r =>
          '<div class="st-row"><span>'+r[1]+'<span class="sub">'+r[2]+'</span></span>'+
          '<button class="obtn'+(r[3]?' primary':' warn')+'" data-kopt="'+r[0]+'" data-val="'+(r[3]?'0':'1')+'">'+(r[3]?T('sw.aan','Aan'):T('sw.uit','Uit'))+'</button></div>').join('');
        html += '<div class="tkc" style="grid-column:1/-1;"><h3>'+T('sw.h','Baas over uw zaak')+'</h3>'+
          '<div class="tkc-who">'+T('sw.s','Zet elke functie aan of uit wanneer u dat wilt. Alleen betalen via de app staat altijd aan; het moment (vooraf of achteraf) bepaalt u zelf.')+'</div>'+
          funcBlok(T('sw.blok','Schakelaars'), rijen.map(r => ({ aan: r[3] })), swRows)+
          '<div class="st-row"><span>'+T('sw.apppay','Betalen via de app')+'<span class="sub">'+T('sw.apppay.s','Vast onderdeel van elk RTG-partnerschap')+'</span></span>'+
          '<span class="pill klaar">'+T('sw.altijd','Altijd aan')+'</span></div></div>';
        html += werkvensterBlokHtml(inst);
        const maxD = Math.max.apply(null, b.week.map(d => d.omzet).concat([1]));
        html += '<div class="tkc"><h3>'+T('bz.weekh','Omzet per dag')+'</h3>'+
          '<div style="display:flex;align-items:flex-end;gap:0.45rem;height:120px;margin-top:0.4rem;">'+
          b.week.map((d, i) =>
            '<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:0.2rem;height:100%;min-width:0;">'+
            '<span style="font-size:0.54rem;color:var(--soft);white-space:nowrap;">'+(d.omzet?eur(d.omzet):'·')+'</span>'+
            '<i style="display:block;width:100%;max-width:32px;border-radius:5px 5px 2px 2px;min-height:2px;height:'+Math.max(2, Math.round(d.omzet/maxD*70))+'%;background:'+(i===6?'var(--burgundy)':'var(--gold)')+';"></i>'+
            '<span style="font-size:0.52rem;color:var(--soft);text-transform:uppercase;">'+d.label+'</span></div>').join('')+'</div></div>';
        html += '<div class="tkc"><h3>'+T('bz.top','Toppers')+'</h3>'+
          (b.toppers.length ? b.toppers.map((t2, i) =>
            '<div class="st-row"><span>'+(['','',''][i]||'')+' '+t2.naam+'<span class="sub">'+t2.aantal+'x '+T('bz.verkocht','verkocht')+'</span></span><b style="color:var(--gold);">'+eur(t2.omzet)+'</b></div>').join('')
            : '<div class="tkc-who">'+T('bz.geentop','Nog geen verkopen. Zodra er via de app of de kassa verkocht wordt, staan de toppers hier.')+'</div>')+'</div>';
      }
    }
