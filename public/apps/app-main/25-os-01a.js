  /* ---------- Werk op het OS + de algemene pin ----------
     De werk-apps zijn gewone apps op het RTG-OS: een tik op "Werk" toont de
     werkplekken die aan het ene RTG-account gekoppeld zijn (bevoegdheid), en
     openen gaat met de algemene pin (het bewijs), dezelfde pin die de
     privacygevoelige apps op dit OS beschermt. Onder water munt
     /api/account/start de werksessie, dus alle regels (zoals het werkvenster
     van de werkgever) blijven gewoon gelden. Deelt de OS-IIFE-scope:
     OSAPPS/INDELING/LINKS komen uit 25-os-01.js, de kiezer-scrim uit 01b. */
  OSAPPS.werk = { naam: 'Werk', icoon: '💼' };
  // Werk zit in de App Store (categorie "Het huis & diensten"); installeer je
  // het, dan verschijnt het op pagina 2 en opent het met de algemene pin.
  // deze apps zijn prive: openen kan pas na de algemene pin (5 min geldig)
  for (const pk of ['berichten', 'vonk', 'rendezvous', 'wbw']) { if (LINKS[pk]) LINKS[pk].prive = true; }

  let pinOkTot = 0; // de pin blijft vijf minuten geldig, zoals op een telefoon
  // de werkplek-zone kan om een positie vragen: dan een keer ophalen en
  // opnieuw proberen; de server vergelijkt en bewaart er niets van
  const vraagPositie = () => new Promise(af => {
    if (!navigator.geolocation) return af(null);
    navigator.geolocation.getCurrentPosition(
      p => af({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => af(null), { enableHighAccuracy: true, timeout: 8000 });
  });
  const WERKDOEL = {
    personeel: { icoon: '🧭', app: 'Personeel (PDA)', url: '/apps/personeel.html', bewaar: (t, r) => { localStorage.setItem('rtg_pda_token', t); localStorage.setItem('rtg_pda_code', r.code || ''); } },
    zaak:      { icoon: '🏛️', app: 'Leverancier',    url: '/apps/leverancier.html', bewaar: (t) => { localStorage.setItem('rtg_sup_token', t); } },
    kantoor:   { icoon: '📊', app: 'Backoffice',     url: '/apps/backoffice.html', bewaar: (t) => { localStorage.setItem('rtg_office_token', t); } }
  };

  /* vraag de algemene pin (of zet hem eerst) en geef hem door aan af(pin) */
  function metAlgPin(af) {
    if (Date.now() < pinOkTot) return af(null);
    API.call('/pin/status', {}).then(st => {
      const zetten = !st.gezet;
      belTitel.textContent = zetten ? '🔒 ' + T('pin.zet', 'Kies uw algemene pin') : '🔒 ' + T('pin.vraag', 'Algemene pin');
      belLijst.textContent = '';
      const uitleg = document.createElement('div');
      uitleg.className = 'os-bel-leeg';
      uitleg.textContent = zetten
        ? T('pin.zetuit', 'Een pincode van 4 tot 8 cijfers, overal dezelfde: hij beschermt uw prive-apps en opent uw werk-apps.')
        : T('pin.vrguit', 'Dezelfde pin die uw prive-apps beschermt.');
      belLijst.appendChild(uitleg);
      const inp = document.createElement('input');
      inp.type = 'password'; inp.inputMode = 'numeric'; inp.maxLength = 8; inp.autocomplete = 'off';
      inp.setAttribute('aria-label', T('pin.veld', 'Algemene pin'));
      inp.style.cssText = 'width:100%;margin:0.5rem 0;background:var(--card2,#1B1817);border:1px solid var(--line);border-radius:10px;padding:0.6rem 0.8rem;font-size:1rem;letter-spacing:0.4em;text-align:center;color:var(--txt);';
      belLijst.appendChild(inp);
      const fout = document.createElement('div');
      fout.className = 'os-bel-leeg'; fout.style.color = 'var(--burgundy-on-dark,#C23A5E)';
      belLijst.appendChild(fout);
      const ga = document.createElement('button');
      ga.textContent = zetten ? T('pin.bewaar', 'Pin instellen') : T('pin.open', 'Ontgrendel');
      const doe = async () => {
        const pin = inp.value.trim();
        if (!/^\d{4,8}$/.test(pin)) { fout.textContent = T('pin.vorm', '4 tot 8 cijfers.'); return; }
        try {
          if (zetten) await API.call('/pin/zet', { pin });
          else await API.call('/pin/check', { pin });
          pinOkTot = Date.now() + 5 * 60000;
          sluitScrims();
          af(pin);
        } catch (e) { fout.textContent = e.message || T('pin.mis', 'Dat ging niet goed.'); inp.value = ''; inp.focus(); }
      };
      ga.addEventListener('click', doe);
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') doe(); });
      belLijst.appendChild(ga);
      belScrim.classList.add('open');
      setTimeout(() => inp.focus(), 60);
    }).catch(() => af(null)); // geen account/lijn: niet blokkeren, de werk-app vraagt zelf
  }

  /* de Werk-kiezer: gekoppelde werkplekken uit het ene account */
  function openWerkKiezer() {
    belTitel.textContent = '💼 ' + T('werk.h', 'Werk');
    belLijst.textContent = '';
    API.call('/account/rollen', {}).then(d => {
      const rollen = (d.rollen || []).filter(r => WERKDOEL[r.rol]);
      if (!rollen.length) {
        const leeg = document.createElement('div');
        leeg.className = 'os-bel-leeg';
        leeg.textContent = T('werk.leeg', 'Nog geen werkplek gekoppeld. Bewijs eenmalig uw werk-inlog (bijvoorbeeld uw personeels-PIN in de leverancier-app); daarna opent uw werk hier met uw algemene pin.');
        belLijst.appendChild(leeg);
        return;
      }
      for (const r of rollen) {
        const doel = WERKDOEL[r.rol];
        const b = document.createElement('button');
        const zi = document.createElement('span'); zi.className = 'zi'; zi.textContent = doel.icoon;
        b.appendChild(zi);
        b.appendChild(document.createTextNode(doel.app));
        const m = document.createElement('span'); m.className = 'zm';
        m.textContent = (r.zaakNaam || r.naam || '') + (r.naam && r.zaakNaam ? ' · ' + r.naam : '');
        b.appendChild(m);
        b.addEventListener('click', () => metAlgPin(async (pin) => {
          try {
            const body = { rol: r.rol, code: r.code, staffId: r.staffId, pin };
            let s;
            try { s = await API.call('/account/start', body); }
            catch (e1) {
              if (!(e1.data && e1.data.locatieNodig)) throw e1;
              const pos = await vraagPositie();
              if (!pos) throw e1;
              s = await API.call('/account/start', Object.assign({ positie: pos }, body));
            }
            try { doel.bewaar(s.token, r); } catch (e2) {}
            location.href = doel.url;
          } catch (e) { bannerToon('💼', T('werk.dicht', 'Werk'), e.message || T('werk.mis', 'Openen lukte niet.')); }
        }));
        belLijst.appendChild(b);
      }
    }).catch(() => {
      const leeg = document.createElement('div');
      leeg.className = 'os-bel-leeg';
      leeg.textContent = T('werk.acc', 'Werk op het OS werkt met een echt RTG-account.');
      belLijst.appendChild(leeg);
    });
    belScrim.classList.add('open');
  }
