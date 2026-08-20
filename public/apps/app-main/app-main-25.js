/* de algemene pin: zetten of vragen */
    API.call('/pin/status', {}).then(st => {
      const zetten = !st.gezet;
      belTitel.textContent = zetten ? T('pin.zet', 'Kies uw algemene pin') : T('pin.vraag', 'Algemene pin');
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

      // "Pin vergeten?" onder het veld. De hele stroom -- de knop, de aanvraag
      // en het scherm dat de nieuwe pin zet -- woont in /shared/pinherstel.js:
      // een plek voor een ding, en dit deel zat al aan de 10 KB-grens.
      if (!zetten && window.RTGPinHerstel) RTGPinHerstel.knop(belLijst, fout, API, T);
      belScrim.classList.add('open');
      setTimeout(() => inp.focus(), 60);
    }).catch(() => af(null)); // geen account/lijn: niet blokkeren, de werk-app vraagt zelf
  }

  /* de Werk-kiezer: gekoppelde werkplekken uit het ene account */
  function openWerkKiezer() {
    belTitel.textContent = T('werk.h', 'Mijn werkplekken');
    belLijst.textContent = '';
    API.call('/account/rollen', {}).then(d => {
      const rollen = (d.rollen || []).filter(r => WERKDOEL[r.rol]);
      if (!rollen.length) {
        const leeg = document.createElement('div');
        leeg.className = 'os-bel-leeg';
        leeg.textContent = T('werk.leeg', 'Nog geen werkplek gekoppeld. Bewijs eenmalig uw werk-inlog (bijvoorbeeld uw personeels-PIN in de leverancier-app); daarna opent uw werk hier met uw algemene pin.');
        belLijst.appendChild(leeg);
      }
      for (const r of rollen) {
        // Een manager hoort in de zaak-app en niet in de PDA. accStart() munt
        // dezelfde sessie: geen bevoegdheid verandert, alleen waar hij landt.
        const doel = (r.rol === 'personeel' && r.manager) ? WERKDOEL.zaak : WERKDOEL[r.rol];
        const b = document.createElement('button');
        const zi = document.createElement('span'); zi.className = 'zi';
        const zg = window.RTGGlyf && RTGGlyf.svg(doel.glyf); if (zg) zi.appendChild(zg);
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
            // Rahuls welzijnszin (late dienst, veel starts): stil tonen, nooit blokkeren
            if (s.welzijn) bannerToon('', 'Rahul', s.welzijn);
            // de werk-app opent schermvullend, op elk formaat
            location.href = doel.url;
          } catch (e) { bannerToon('', T('werk.dicht', 'Werk'), e.message || T('werk.mis', 'Openen lukte niet.')); }
        }));
        belLijst.appendChild(b);
      }
      /* De eerste keer. Een werkruimte heeft zijn eigen inlog (code +
         lid-token) en hoort dat te houden: hij moet ook werken voor iemand
         zonder RTG-pas. Maar dan moet die deur hier wel te vinden zijn --
         anders is "een inlog" alleen waar voor wie al binnen was. Deze rij
         staat er dus altijd, ook als de lijst leeg is. */
      const nieuw = document.createElement('button');
      const nzi = document.createElement('span'); nzi.className = 'zi';
      const nzg = window.RTGGlyf && RTGGlyf.svg('werk'); if (nzg) nzi.appendChild(nzg);
      nieuw.appendChild(nzi);
      nieuw.appendChild(document.createTextNode(T('werk.nieuw', 'Werkruimte openen')));
      const nm = document.createElement('span'); nm.className = 'zm';
      nm.textContent = T('werk.nieuw.sub', 'Eerste keer: met uw werkruimtecode en lid-token. Koppelt u daar uw RTG-account, dan staat hij hierboven.');
      nieuw.appendChild(nm);
      nieuw.addEventListener('click', () => { location.href = '/apps/werk.html'; });
      belLijst.appendChild(nieuw);
    }).catch(() => {
      const leeg = document.createElement('div');
      leeg.className = 'os-bel-leeg';
      leeg.textContent = T('werk.acc', 'Werk op het OS werkt met een echt RTG-account.');
      belLijst.appendChild(leeg);
    });
    belScrim.classList.add('open');
  }
