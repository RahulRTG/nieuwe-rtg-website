/* de kantoordeur op naam: pin, passkey en wat de deur antwoordt */
  /* Het kantoor openen met het ene RTG-account (/api/account/start), via de
     ene clientweg (shared/kantoordeur.js). De pin komt voor de passkey; de
     passkey start altijd in een tik op de knop. */
  async function kantoorMetAccount(lt, pin){
    if ($('#kaFout')) $('#kaFout').textContent = '';
    const deur = window.RTGKantoorDeur;
    if (!deur) { if ($('#kaFout')) $('#kaFout').textContent = T('pd.passkeyStart', 'De passkey kon hier niet starten.'); return; }
    const st = kaStand || await deur.stand();
    kaUitkomst(lt, pin, await deur.vraag(lt, { pin, passkey: st.codeDicht }));
  }
  function kaUitkomst(lt, pin, u, stil){
    const fout = t => { if ($('#kaFout')) $('#kaFout').textContent = t || ''; };
    if (u.token) { kaToken = u.token; try { localStorage.setItem('rtg_office_token', kaToken); } catch(e){} enterKantoor(); return; }
    if (u.pinNodig) {
      if (!$('#kaPin') && $('#kaFout')) {
        $('#kaFout').insertAdjacentHTML('afterend', '<div class="pinrow h-mt60"><input id="kaPin" type="password" inputmode="numeric" maxlength="8" autocomplete="off" aria-label="'+T('pin.veld','Algemene pin')+'" placeholder="'+T('pin.veld','Algemene pin')+'">'+
          '<button id="kaPinGo" class="hoofd">'+T('pd.ka.binnen','Binnen')+'</button></div>');
        const ga = () => kantoorMetAccount(lt, $('#kaPin').value.trim());
        $('#kaPinGo').addEventListener('click', ga);
        $('#kaPin').addEventListener('keydown', e => { if (e.key === 'Enter') ga(); });
        $('#kaPin').focus();
      }
      fout(u.error);
      return;
    }
    if (u.geenPasskey) {
      // geen passkey op dit account: de weg erheen, en geen terugval op de code
      const b = $('#kaAccountVerder'); if (b) b.remove();
      if ($('#kaDeurVak') && !$('#kaPasskeyZet')) $('#kaDeurVak').insertAdjacentHTML('beforeend',
        '<a id="kaPasskeyZet" class="abtn" style="display:block;margin-top:0.7rem;text-align:center;padding:0.8rem;" href="'+RTGKantoorDeur.PASSKEYS+'">'+T('pd.ka.passkeyZet','Een passkey toevoegen')+'</a>');
      fout(u.error);
      return;
    }
    if (u.bevestiging) {
      kaWapen(lt, pin, u.bevestiging);
      if (stil) return;   // vooraf opgehaald: niets starten zonder tik
      /* Na een tik (de knop, de pin, het koppelen) meteen proberen; weigert de
         browser de ceremonie buiten de tik, dan wacht de gewapende knop. */
      RTGKantoorDeur.tekenNu(u.bevestiging).then(async bw => {
        if (!bw.fout) return kaUitkomst(lt, pin, await RTGKantoorDeur.lever(lt, bw, { pin }));
        fout(T('pd.ka.tik','Tik op de knop om met uw passkey te bevestigen.'));
        kaUitkomst(lt, pin, await RTGKantoorDeur.bereid(lt, { pin }), true);
      });
      return;
    }
    fout(u.error || T('pd.mis', 'Er ging iets mis.'));
  }
  /* De knop draagt de klaarliggende ceremonie: get() start in de klik zelf. */
  function kaWapen(lt, pin, bevestiging){
    let b = $('#kaAccountVerder');
    if (!b && $('#kaDeurVak')) {
      // kwam de rol er pas net bij (koppelen), dan bestaat de knop nog niet
      b = document.createElement('button'); b.id = 'kaAccountVerder'; b.className = 'hoofd';
      b.style.cssText = 'margin-top:0.7rem;width:100%;padding:0.8rem;';
      $('#kaDeurVak').appendChild(b);
    }
    if (!b) return;
    b.textContent = T('pd.ka.passkey', 'Kantoor openen met passkey');
    b.onclick = () => {
      const p = RTGKantoorDeur.tekenNu(bevestiging);
      b.disabled = true;
      p.then(async bw => {
        if (bw.fout) {
          if ($('#kaFout')) $('#kaFout').textContent = bw.fout;
          // een nieuwe ceremonie voor de volgende tik: de vorige kan verlopen zijn
          kaUitkomst(lt, pin, await RTGKantoorDeur.bereid(lt, { pin }), true);
        } else kaUitkomst(lt, pin, await RTGKantoorDeur.lever(lt, bw, { pin }));
      }).finally(() => { b.disabled = false; });
    };
  }
  async function enterKantoor(){
    const k = await kaApi('kamers');
    // een kantoren-deeplink bracht ons hier alleen voor het inloggen: meteen door
    const terug = kaTerugPad();
    if (terug){ location.replace(terug); return; }
    let naam = ''; try { naam = localStorage.getItem('rtg_kantoor_naam') || ''; } catch(e){}
    $('#gateStep').innerHTML = '<button class="gback" id="kaTerug">← '+T('pd.ka.staf','Personeel van een zaak')+'</button>'+
      '<div class="card" id="kaMeld">'+
        '<div class="k">'+T('pd.ka.naam','Jouw naam')+'</div>'+
        '<input class="hin h-mt40" id="kaNaam" maxlength="30" value="'+esc(naam)+'">'+
        '<div class="row"><select class="hin" id="kaKamer">'+k.kamers.map(x => '<option value="'+x.id+'">'+esc(x.naam)+'</option>').join('')+'</select>'+
        '<select class="hin" id="kaWaar" style="max-width:9.5rem;"><option value="thuis">'+T('pd.ka.thuis','Thuis')+'</option><option value="kantoor">'+T('pd.ka.hier','Kantoor')+'</option></select></div>'+
        '<button class="abtn" id="kaMeldGo" style="margin-top:0.75rem;width:100%;padding:0.8rem;">'+T('pd.ka.meld','Meld je aan voor je dienst')+'</button>'+
        '<div id="kaMFout" style="margin-top:0.5rem;font-size:0.76rem;color:var(--burgundy);min-height:1rem;"></div></div>'+
      '<div class="card" id="kaDienstBlok" hidden><div id="kaDienstTekst" style="font-size:0.9rem;"></div>'+
        '<button class="abtn ghost h-mt60" id="kaAfmeld">'+T('pd.ka.afmeld','Meld je af')+'</button></div>'+
      '<div class="card"><div class="k">'+T('pd.ka.wie','Nu aan het werk')+'</div><div class="h-mt40" id="kaWie"></div></div>'+
      '<div class="card"><div class="k">'+T('pd.ka.chat','De chat van jouw kamer')+'</div>'+
        '<div id="kaChat" style="max-height:15rem;overflow-y:auto;font-size:0.85rem;margin-top:0.5rem;"></div>'+
        '<div class="row"><input class="hin" id="kaTekst" maxlength="500" placeholder="'+T('pd.ka.bericht','Bericht...')+'">'+
        '<button class="abtn" id="kaStuur">'+T('pd.ka.stuur','Stuur')+'</button></div></div>'+
      '<div class="card"><div class="k">Integratiekamer</div>'+
        '<div class="pd-card-copy">SMTP, SMS, Stripe Connect en SEPA lokaal testen, gecontroleerd schakelen en samen als keten beproeven. Bediening vraagt boardroomtoegang.</div>'+
        '<a class="abtn pd-block" href="/apps/kantoren.html?kamer=integraties">Open het beveiligde schakelbord</a></div>'+
      '<div class="card"><div class="k">RTG Controleregister</div>'+
        '<div class="pd-card-copy">Bekijk welke code al een kantoor, rol, proef, audit, gameplay en economisch gevolg heeft. Ontbrekende koppelingen worden werk voor het juiste team.</div>'+
        '<a class="abtn pd-block" href="/apps/magnaat-kantoor.html">Open de dekkingsmatrix</a></div>'+
      '<div style="margin-top:0.5rem;font-size:0.7rem;line-height:1.5;color:var(--soft);">'+T('pd.ka.uitleg','Het volledige kantoor (statistieken, taken, boardroom) staat in de kantoren-app; dit is je zak-versie voor aanmelden en contact.')+'</div>';
