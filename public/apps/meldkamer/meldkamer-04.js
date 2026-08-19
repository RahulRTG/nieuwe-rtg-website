  /* ---------- het gezamenlijke rampbeeld ---------- */
  const NIVEAUS = ['normaal', 'incident', 'opgeschaald', 'ramp'];
  async function laadRamp() {
    let b = null;
    try { b = await api('keten/rampbeeld'); } catch (e) { $('#kRamp').hidden = true; return; }
    $('#kRamp').hidden = false;
    const nu = (b.ramp && b.ramp.niveau) || 'normaal';
    $('#rampNiveau').innerHTML = NIVEAUS.map(n => '<button class="nvl' + (n === nu ? ' on' : '') + '" data-nvl="' + n + '" type="button">' + n + '</button>').join('') +
      (b.ramp && b.ramp.door ? '<span class="stil" style="font-size:0.72rem;">gezet door ' + esc(b.ramp.door) + '</span>' : '');
    const t = b.totalen;
    $('#rampKpis').innerHTML =
      '<div class="rkpi"><b style="color:var(--groen);">' + t.eenhedenVrij + '</b><span>eenheden vrij</span></div>' +
      '<div class="rkpi"><b style="color:var(--rtg-leesgoud,var(--gold));">' + t.eenhedenIngezet + '</b><span>ingezet</span></div>' +
      '<div class="rkpi"><b style="color:var(--groen);">' + t.beddenVrij + '</b><span>bedden vrij</span></div>' +
      '<div class="rkpi"><b>' + t.sehWachtend + '</b><span>SEH wacht</span></div>' +
      '<div class="rkpi"><b style="color:var(--rood);">' + t.meldingenOpen + '</b><span>open meldingen</span></div>';
    let h = '';
    if (b.korpsen.length) h += '<div style="margin-top:0.5rem;"><b style="font-size:0.8rem;">Korpsen</b>' + b.korpsen.map(k =>
      '<div class="melding" style="padding:0.4rem 0;">' + esc(k.naam) + ' · ' + k.vrij + ' vrij / ' + k.inzet + ' ingezet' +
      (k.perSoort.length ? ' <span class="stil">(' + k.perSoort.map(p => p.vrij + ' ' + p.soort).join(', ') + ')</span>' : '') + '</div>').join('') + '</div>';
    if (b.ziekenhuizen.length) h += '<div style="margin-top:0.5rem;"><b style="font-size:0.8rem;">Ziekenhuizen</b>' + b.ziekenhuizen.map(z =>
      '<div class="melding" style="padding:0.4rem 0;">' + esc(z.naam) + ' · ' + z.beddenVrij + '/' + z.beddenTotaal + ' bedden vrij · SEH: ' + z.sehWachtend + ' wacht</div>').join('') + '</div>';
    if (b.defensie.length) h += '<div style="margin-top:0.5rem;"><b style="font-size:0.8rem;">Defensie</b>' + b.defensie.map(d =>
      '<div class="melding" style="padding:0.4rem 0;">' + esc(d.naam) + ' · ' + d.gevechtsgereed + ' gevechtsgereed, ' + d.beperkt + ' beperkt · ' + d.gewonden + ' gewonden</div>').join('') + '</div>';
    $('#rampDetail').innerHTML = h;
    document.querySelectorAll('[data-nvl]').forEach(x => x.addEventListener('click', async () => {
      try {
        const r = await api('keten/rampbeeld/schaal', { niveau: x.dataset.nvl });
        // bij afschalen naar normaal komt het naoefening-rapport meteen mee
        if (r.evaluatie) toonRapport(r.evaluatie);
        laadRamp();
      } catch (e) { alert(e.message); }
    }));
  }
  $('#coordKnop').addEventListener('click', async () => {
    $('#coordUit').textContent = 'De coordinator denkt mee…';
    try { const r = await api('keten/rampbeeld/ai', {}); $('#coordUit').textContent = r.antwoord; }
    catch (e) { $('#coordUit').textContent = e.message; }
  });
  function toonRapport(ev) {
    const m = ev.meldingen, e = ev.evacuaties;
    $('#rapportUit').innerHTML =
      '<div class="melding" style="padding:0.5rem 0;"><b>Meldingen</b>: ' + m.totaal + ' (prio 1: ' + m.perPrio[1] + ', 2: ' + m.perPrio[2] + ', 3: ' + m.perPrio[3] + '), ' + m.bemand + ' bemand.' +
      (m.gemAanrijMin != null ? ' Gem. aanrijtijd ' + m.gemAanrijMin + ' min.' : '') +
      (m.gemAfhandelMin != null ? ' Gem. afhandeltijd ' + m.gemAfhandelMin + ' min' + (m.langsteAfhandelMin != null ? ' (langste ' + m.langsteAfhandelMin + ' min)' : '') + '.' : '') + '</div>' +
      '<div class="melding" style="padding:0.5rem 0;"><b>Evacuaties</b>: ' + e.totaal +
      (e.totaal ? ' (' + Object.entries(e.perTriage).map(function(t){return t[1]+' '+t[0];}).join(', ') + ')' : '') + '.</div>' +
      '<div class="melding" style="padding:0.5rem 0;"><b>Knelpunten</b><ul style="margin:0.3rem 0 0 1rem;">' + ev.knelpunten.map(function(k){return '<li>'+esc(k)+'</li>';}).join('') + '</ul></div>';
  }
  $('#rapportKnop').addEventListener('click', async () => {
    $('#rapportUit').textContent = 'Rapport opstellen…';
    try { toonRapport(await api('keten/rampbeeld/evaluatie', {})); }
    catch (e) { $('#rapportUit').textContent = e.message; }
  });

  function start() {
    $('#vLogin').hidden = true;
    $('#vBord').hidden = false;
    $('#noodKnop').hidden = false;
    laad().then(laadKeten).then(laadRamp).catch(e => { $('#vLogin').hidden = false; $('#vBord').hidden = true; $('#lFout').textContent = e.message; token = ''; });
  }
  /* ---------- de poort als GESPREK met Rahul ----------
     Korpscode, dan wie u bent, dan uw pincode. Hij haalt onderweg dezelfde
     lijst op en belt aan bij dezelfde routes als de knoppenversie in deel 1
     (/api/supplier/roster en /login); die blijft eronder staan als vangnet.
     Er gaat niets van dit gesprek naar een taalmodel en Rahul beslist niets:
     de server zegt ja of nee. Dit blok staat HIER, aan het eind, omdat de
     delen van deze bundel middenin een functie kunnen eindigen -- en dan
     draait het pas na het inloggen, wat precies te laat is. */
  let staflijst = [];
  (function poort(){
    const doos = document.querySelector('#vLogin .kaart');
    if (!doos || !window.RTGPoort || !window.RTGPoort.gesprek) return;
    const gesprek = document.createElement('div');
    doos.parentNode.insertBefore(gesprek, doos);
    doos.hidden = true;
    window.RTGPoort.gesprek(gesprek, {
      groet: 'Meldkamer. Goed dat u er bent.',
      wacht: 'Een ogenblik, ik meld u aan.',
      stappen: [
        { sleutel: 'code', vraag: 'Van welk korps bent u?', plho: 'bijv. GUARDIA',
          type: 'text', maxlength: 20,
          doe: async (a) => {
            const d = await api('roster', { code: String(a.code).toUpperCase() });
            staflijst = d.staff || [];
            if (!staflijst.length) throw new Error('Dat korps heeft nog niemand op de lijst staan.');
          } },
        { sleutel: 'staffId', vraag: 'En wie bent u?', type: 'keuze',
          opties: () => staflijst.map(m => ({ waarde: m.id, label: m.name + ' (' + (m.func || m.role) + ')' })) },
        { sleutel: 'pin', vraag: 'Uw pincode, dan bent u binnen.', plho: 'PIN',
          type: 'password', inputmode: 'numeric', maxlength: 8 }
      ],
      klaar: async (a) => {
        const d = await api('login', { code: String(a.code).toUpperCase(), staffId: Number(a.staffId), pin: a.pin });
        token = d.token;
        try { sessionStorage.setItem('rtg_meldkamer_token', token); } catch (e) {}
        start();
      }
    });
  })();

  /* Meenemen (shared/uitvoer.js): het bord is een lijst meldingen met eigen
     velden -- prioriteit, wat er gemeld is, waar, en waar hij nu staat. Die
     kolommen gaan mee; de knoppenrij eronder is bediening, geen gegeven. Een
     bijstandsverzoek van een ander korps staat er als zodanig bij, want op
     het bord staat het ook zo. */
  if (window.RTGUitvoer) RTGUitvoer.bron(() => {
    if (!korps) return null;
    const rij = [...(korps.bijstand || []).map(m => ({ ...m, bij: true })), ...(korps.meldingen || [])];
    if (!rij.length) return null;
    return {
      naam: 'meldingen',
      kolommen: ['prioriteit', 'melding', 'plek', 'status', 'herkomst'],
      rijen: rij.map(m => ['P' + m.prio, m.tekst || '', m.plek || '', m.status || '',
        m.bij ? 'bijstandsverzoek' : 'eigen meldkamer'])
    };
  });

  setInterval(() => { if (!$('#vBord').hidden && !document.hidden) laad().catch(() => {}); }, 20000);
  if (token) start();
})();
