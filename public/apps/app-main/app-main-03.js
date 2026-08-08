    const s = pasStem();
    return s === 'business' ? business : s === 'lifestyle' ? lifestyle : rtg;
  }
  const STEMKOPPEN = [
    ['gate.title', true,
      'Zo, daar ben je.<br>Je pas, <em>altijd</em> op zak.',
      'Welkom.<br>Zaken, <em>strak</em> geregeld.',
      'Welkom thuis.<br>Uw wereld, <em>altijd</em> bij de hand.'],
    ['gate.deck', false,
      'Boeken, betalen met één tik, je eigen AI en De Salon. Alles draait op je codenaam, niet op je echte naam. Zo hoort het.',
      'Reizen, betalingen en je AI-boekhouder in één app, alles op codenaam. Efficiënt, discreet, zonder gedoe.',
      'Uw reizen, uw concierge en De Salon, verzameld in één stille app. Alles op uw codenaam; uw echte naam blijft van u.'],
    ['app.v.trip', false, 'Jouw reis.', 'Je reizen.', 'Uw reis.'],
    ['app.v.trip.note', false,
      'Wijzigen of toevoegen? Eén berichtje aan je AI is genoeg.',
      'Wijzigen of toevoegen? Meld het je AI; het staat direct in de agenda.',
      'Een wens? Fluister het uw AI; het wordt geregeld.'],
    ['app.v.pay.sub', false,
      'Eén tik, Face ID. Alles op je codenaam, zoals het hoort.',
      'Eén tik, Face ID. Elke betaling strak geboekt, op codenaam.',
      'Eén tik, Face ID. Uw betalingen dragen uw codenaam, niet uw naam.'],
    ['app.v.ai.sub', false,
      'Hij regelt het. Eén ja is genoeg.',
      'Hij regelt het en boekt het meteen in. Eén ja is genoeg.',
      'Uw wens is aan één woord genoeg.'],
    ['app.v.salon.sub', false,
      'Posts verschijnen 7 dagen na verblijf, voor je veiligheid.',
      'Posts verschijnen 7 dagen na verblijf, voor je veiligheid.',
      'Uw posts verschijnen 7 dagen na verblijf, voor uw veiligheid.']
  ];
  function stemKoppen(){
    if (lang() === 'en') return;
    const i = pasStem() === 'business' ? 1 : pasStem() === 'lifestyle' ? 2 : 0;
    STEMKOPPEN.forEach(rij => {
      const el = document.querySelector('[data-i18n="' + rij[0] + '"], [data-i18n-html="' + rij[0] + '"]');
      if (!el) return;
      if (rij[1]) el.innerHTML = rij[2 + i]; else el.textContent = rij[2 + i];
    });
    const ai = document.getElementById('aiTitle');
    if (ai) ai.textContent = ['Jouw AI.', 'Je AI.', 'Uw AI.'][i];
  }
  // meteen: de poort spreekt de taal van de gekozen ingang (?pas=...)
  stemKoppen();

  /* De poort is een gesprek met Rahul (zie app-main-06): inloggen, aanmelden en
     wachtwoord-herstel gaan alle drie via dat gesprek. De oude formulieren
     (loginForm/regForm/forgotForm/resetForm met hun wisselknoppen) staan niet
     meer in app.html; hun afhandeling hoort hier dus ook niet meer te staan. Wat
     blijft, zijn de LINKS uit de e-mail: die komen los van de poort binnen. */
  (function bevestigEmailLink(){
    const token = new URLSearchParams(location.search).get('verify');
    if (!token) return;
    API.call('/auth/verify-email', { token })
      .then(() => toast(T('gate.verified','Uw e-mailadres is bevestigd.')))
      .catch(() => toast(T('gate.verifyfail','Bevestigingslink ongeldig of verlopen.')))
      // alleen ?verify= uit het adres halen; ?reset= NIET aanraken, want de poort
      // van Rahul (app-main-04/05) leest die parameter hierna zelf nog
      .finally(() => history.replaceState(null, '', location.pathname + (vastePas ? '?pas=' + vastePas : '')));
  })();

  async function login(tier, cred){
    if (cred){
      if (API.enabled){
        try {
          const data = cred.register
            ? await API.call('/auth/register', { name: cred.name, email: cred.u, phone: cred.phone, geboortedatum: cred.geboortedatum, password: cred.p, tier: cred.tier, pasApp: vastePas || undefined })
            : await API.call('/auth/login', { login: cred.u, password: cred.p, pasApp: vastePas || undefined });
          API.token = data.token;
          applyState(data.state);           // user = het echte account
          tier = user.tier;
          // uw account weet zelf bij welke pas hij hoort: zonder ?pas= (of in
          // de verkeerde pas-app) opent meteen de juiste app, zoals de
          // leeftijdskeuze dat bij de RTFoundation doet
          const doelPas = user.tier === 'guest' ? 'rtg' : user.tier;
          const magHier = vastePas ? (vastePas === 'rtg' ? ['rtg', 'guest'] : [vastePas]) : [];
          if (!magHier.includes(user.tier) && ['rtg', 'lifestyle', 'business'].includes(doelPas)){
            try { localStorage.setItem('rtg_member_token', API.token); } catch (e2) {}
            location.replace(pasAdres(doelPas));
            return;
          }
        } catch (e) { toast(e.message || 'Onjuiste inloggegevens.'); return; }
      } else {
        if (!(String(cred.u).trim().toLowerCase() === 'rahul' && cred.p === 'Imran')){
          toast('Onjuiste inloggegevens.'); return;
        }
        tier = 'business'; user = {...PERSONAS[tier]};
      }
    } else {
      user = {...PERSONAS[tier]};
      if (API.enabled){
        try {
          const data = await API.call('/login', {tier, pasApp: vastePas || undefined});
          API.token = data.token;
          applyState(data.state);
        } catch (e) { API.enabled = false; }
      }
    }
    if (!API.live) creatorLikes = ({rtg:320, lifestyle:680, business:210})[tier] || 0;
    if (API.live) try { localStorage.setItem('rtg_member_token', API.token); } catch(e){}
    $('#gate').style.display = 'none';
    $('#app').classList.add('active');
    renderAll();
    if (API.live && window.RTGRealtime){
      RTGRealtime.start(API.token, { onSync: syncScope, onChange: renderBell, onSocial: opSociaal, onCall: opBelsignaal, onBezorg: opBezorg, onOntmoetSignaal: opOntmoetSignaal });
    }
    loadSocial();
    checkOnboarding(); laadAgendaLid();
  }

  // Blijf ingelogd: met een bewaard token slaat de app het startscherm over.
  // De sessie weet zelf bij welke pas hij hoort: zonder ?pas= (of in de
  // verkeerde pas-app) sturen we meteen door naar de juiste app.
  async function restoreSession(){
    if (!API.enabled) return;
    let t = null; try { t = localStorage.getItem('rtg_member_token'); } catch(e){}
    if (!t) return;
