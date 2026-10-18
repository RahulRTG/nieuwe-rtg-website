/* de aandelen in een deal, en wie akkoord is */
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
          '<div class="s-12ib2j6">'+
            '<input id="synNaam" placeholder="'+T('sy.naam','Naam van de deal')+'" class="s-bgva62">'+
            '<input id="synPartner" placeholder="'+T('sy.partner','Partnercode (bijv. SAKURA)')+'" class="s-jwsivx">'+
            '<input id="synPrijs" inputmode="decimal" placeholder="'+T('sy.prijs','Totaal EUR')+'" class="s-1lkmfch">'+
            '<input id="synMijn" inputmode="decimal" placeholder="'+T('sy.mijn','Mijn deel EUR')+'" class="s-1lkmfch">'+
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
        html += '<div class="tkc h-volbreed"><h3>'+T('sw.h','Baas over uw zaak')+'</h3>'+
          '<div class="tkc-who">'+T('sw.s','Zet elke functie aan of uit wanneer u dat wilt. Alleen betalen via de app staat altijd aan; het moment (vooraf of achteraf) bepaalt u zelf.')+'</div>'+
          funcBlok(T('sw.blok','Schakelaars'), rijen.map(r => ({ aan: r[3] })), swRows)+
          '<div class="st-row"><span>'+T('sw.apppay','Betalen via de app')+'<span class="sub">'+T('sw.apppay.s','Vast onderdeel van elk RTG-partnerschap')+'</span></span>'+
          '<span class="pill klaar">'+T('sw.altijd','Altijd aan')+'</span></div></div>';
        html += werkvensterBlokHtml(inst);
        const maxD = Math.max.apply(null, b.week.map(d => d.omzet).concat([1]));
        html += '<div class="tkc"><h3>'+T('bz.weekh','Omzet per dag')+'</h3>'+
          '<div class="s-2wkit8">'+
          b.week.map((d, i) =>
            '<div class="s-22kawz">'+
            '<span class="s-1nccjyo">'+(d.omzet?eur(d.omzet):'·')+'</span>'+
            '<i style="display:block;width:100%;max-width:32px;border-radius:0;min-height:2px;height:'+Math.max(2, Math.round(d.omzet/maxD*70))+'%;background:'+(i===6?'var(--burgundy)':'var(--gold)')+';"></i>'+
            '<span class="s-179p4gf">'+d.label+'</span></div>').join('')+'</div></div>';
        html += '<div class="tkc"><h3>'+T('bz.top','Toppers')+'</h3>'+
          (b.toppers.length ? b.toppers.map((t2, i) =>
            '<div class="st-row"><span>'+(['','',''][i]||'')+' '+t2.naam+'<span class="sub">'+t2.aantal+'x '+T('bz.verkocht','verkocht')+'</span></span><b class="s-12itpbj">'+eur(t2.omzet)+'</b></div>').join('')
            : '<div class="tkc-who">'+T('bz.geentop','Nog geen verkopen. Zodra er via de app of de kassa verkocht wordt, staan de toppers hier.')+'</div>')+'</div>';
      }
    }
