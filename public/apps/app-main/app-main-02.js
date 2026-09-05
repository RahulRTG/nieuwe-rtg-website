/* de API-laag van de app: elke aanroep met token, taal en foutafhandeling */
    if (!API.token) return;
    try {
      const res = await fetch('/api' + pad, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + API.token }, body: JSON.stringify(body || {}) });
      if (!res.ok) throw new Error('fout');
      const blob = await res.blob();
      // het eigen toestel als opslag: elke download krijgt stil een kopie in
      // de Toestelkluis (OPFS), zodat het exemplaar van het lid lokaal blijft
      if (window.Toestelkluis) Toestelkluis.bewaar(filename, blob).catch(() => {});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch(e){ toast(T('fin.dlfout','Downloaden lukte niet.')); }
  }

  // API-client uit de gedeelde app-shell (public/shared/appshell.js).
  const API = RTGApp.maakAPI({ foutTekst: 'API-fout' });
  let magnaatProef = false;
  // Een 403 met kyc:true (bijv. een gratis lid dat RTG Pay gebruikt zonder
  // paspoort) laat Rahul meteen de paspoort-stap van de onboarding tonen.
  const _apiCall = API.call.bind(API);
  API.call = function (pad, body) {
    return _apiCall(pad, body).catch(function (e) {
      if (e && e.data && e.data.kyc && typeof checkOnboarding === 'function') { try { checkOnboarding(); } catch (x) {} }
      throw e;
    });
  };

  function applyState(state){
    if (!state) return;
    if (state.user) user = state.user;
    if (state.invoices) invoices = state.invoices;
    if (state.trip) trip = state.trip;
    if (state.posts) posts = state.posts;
    if (typeof state.creatorLikes === 'number') creatorLikes = state.creatorLikes;
    if (state.myApplications) myApps = state.myApplications;
    if (state.foundation) rtf = state.foundation;
  }

  /* Meenemen: de app kent zijn eigen model, dus geeft hij dat door in plaats
     van de gedeelde laag naar het scherm te laten raden. Facturen zijn hier het
     ding dat een lid meeneemt naar zijn eigen boekhouding: nummer, bedrag, btw
     en afboekcode staan al op het scherm, dus staan ze ook in het bestand.
     'termijn' heet geen datum, want dat is het niet: het model houdt hier een
     zin bij ("Vervalt 1 augustus 2026"), en er wordt geen datum verzonnen die
     de app niet heeft. */
  if (window.RTGUitvoer) RTGUitvoer.bron(function () {
    if (!invoices || !invoices.length) return null;
    return {
      naam: 'facturen',
      kolommen: ['factuurnummer', 'omschrijving', 'netto', 'bijdrage', 'btw', 'totaal', 'status', 'termijn', 'afboekcode'],
      rijen: invoices.map(function (i) {
        return [i.id || '', i.desc || '', i.netto || 0, i.bijdrage || 0, i.btw || 0,
          (i.netto || 0) + (i.bijdrage || 0), i.status || '', i.date || '', i.afboekcode || ''];
      })
    };
  });

  // verse state van de server (bijv. na volgen, claimen of stemmen op De Salon)
  async function refreshState(){
    try { applyState((await API.call('/state')).state); } catch(e){}
  }

  let toastTimer;
  function toast(msg){
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 3000);
  }

  function canEngage(p){
    if (typeof p.canEngage === 'boolean') return p.canEngage;
    if (user.tier === 'rtg') return p.tier === 'rtg';
    return true;
  }

  /* ---------- login & tabs ----------
     De poort zelf is een gesprek met Rahul (app-main-06); die roept login()
     aan met de gegevens uit het gesprek. De oude keuzeknoppen per pas
     ([data-login]) en de kop boven het registratieformulier bestaan niet meer,
     dus staat er hier ook geen bediening meer voor. De gratis laag blijft wat
     hij was: alleen na aanmelden met een paspoort, nooit een anonieme sessie. */

  /* ---------- eigen app per pas, geen brede app ----------
     Elke betaalde pas heeft zijn eigen ingang (pas-rtg/lifestyle/business.html)
     die hier binnenkomt met ?pas=. Dan wordt dit DE app van die pas: het
     manifest (eigen naam en icoon op het beginscherm) wisselt mee, de poort
     toont alleen de eigen ingang, en de server weigert inloggegevens van een
     andere pas. De gratis laag heeft GEEN eigen app: die speelt mee in de
     RTG-app, met minder functies. ZONDER ?pas= bestaat er geen brede app
     meer: dan is dit alleen een keuzescherm dat naar de pas-apps verwijst. */
  const zoekParams = new URLSearchParams(location.search);
  /* app.html heeft het bearer-fragment vóór ieder extern script uit het adres
     gehaald. Neem het nu uit die korte geheugenoverdracht over en wis ook de
     globale verwijzing; niets wordt in local/sessionStorage bewaard. */
  let wervingscode = String(window.__RTG_WERVING_CODE || '').trim().toUpperCase();
  try { delete window.__RTG_WERVING_CODE; } catch (e) { window.__RTG_WERVING_CODE = null; }
  magnaatProef = zoekParams.get('magnaat') === '1';
  if (magnaatProef) API.enabled = false;
  let vastePas = zoekParams.get('pas');
  if (vastePas === 'guest') vastePas = 'rtg'; // gratis speelt in de RTG-app
  if (!['rtg','lifestyle','business'].includes(vastePas)) vastePas = null;
  // vangnet voor oude e-maillinks zonder pas: die landen in de RTG-app
  if (!vastePas && (zoekParams.get('verify') || zoekParams.get('reset'))) vastePas = 'rtg';

  /* HET DOORSTUREN NAAR DE JUISTE PAS-APP MAG DE REST VAN HET ADRES NIET OPETEN.

     Hieronder sturen twee plekken door naar de eigen app van de pas, en allebei
     bouwden ze het nieuwe adres op als pathname + '?pas=' + doelPas. Daarmee
     ging ELKE andere parameter verloren -- en juist daar komen onze e-maillinks
     binnen. De pin-herstellink (/apps/app.html?pinherstel=SLEUTEL) heeft geen
     ?pas=, dus restoreSession stuurde meteen door naar ?pas=<tier> en de sleutel
     was weg voordat /shared/pinherstel.js hem kon opvangen. Resultaat: de link
     uit de mail deed niets, en er was geen weg terug naar je pin.

     Hetzelfde gold stil voor ?verify= en ?reset= van een lid dat GEEN RTG-pas
     heeft: het vangnet hierboven zet die op 'rtg', waarna de omleiding naar de
     eigen pas-app hun token alsnog weggooide.

     Dus: we nemen het hele adres mee en wisselen alleen de pas om. */
  const pasAdres = (doelPas) => {
    const p = new URLSearchParams(location.search);
    p.set('pas', doelPas);
    return location.pathname + '?' + p.toString() + location.hash;
  };

  /* Een aanvraag van de publieke website reist uitsluitend in het fragment
     (#aanvraag=...), niet in queryparameters. Een fragment wordt niet naar de
     webserver gestuurd en belandt daardoor niet in toegangslogs. De app leest
     alleen de eigen, versie-1 envelop, begrenst elk veld en bewaart hem enkel
     in dit browservenster totdat de ingelogde app-lijn hem heeft aangenomen. */
  function websiteAanvraagUitAdres(){
    const raw = new URLSearchParams(location.hash.replace(/^#/, '')).get('aanvraag');
    if (!raw || raw.length > 6000) return null;
    try {
      const basis = raw.replace(/-/g, '+').replace(/_/g, '/');
      const binair = atob(basis + '='.repeat((4 - basis.length % 4) % 4));
      const bytes = Uint8Array.from(binair, teken => teken.charCodeAt(0));
      const data = JSON.parse(new TextDecoder().decode(bytes));
      if (!data || data.version !== 1 || data.source !== 'rtravelgroup.store') return null;
      const veld = (waarde, grens) => String(waarde || '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, grens);
      const aanvraag = {
        name: veld(data.name, 80), email: veld(data.email, 180), phone: veld(data.phone, 30),
        requirement: veld(data.requirement, 100), message: veld(data.message, 500)
      };
      return aanvraag.name && aanvraag.email && aanvraag.requirement && aanvraag.message ? aanvraag : null;
    } catch(e){ return null; }
  }
  let websiteAanvraag = websiteAanvraagUitAdres();
  if (vastePas){
    const ml = document.getElementById('manifestLink');
    if (ml) ml.href = '/manifests/pas-' + vastePas + '.webmanifest';
    const tl = document.getElementById('touchLink');
    if (tl) tl.href = '/icons/pas-' + vastePas + '-192.png';
    document.title = { rtg:'RTG Pass', lifestyle:'RTG Lifestyle Pass', business:'RTG Business Pass' }[vastePas];
  } else {

    // de ene poort: het scherm blijft kaal (alleen inloggen, aanmelden en
    // wachtwoord vergeten). Log in en uw account opent vanzelf de juiste
    // pas-app (RTG, Lifestyle of Business); aanmelden maakt een RTG-account.
    document.title = 'RTG, log in';
    const ml = document.getElementById('manifestLink');
    if (ml) ml.remove(); // een keuzescherm installeer je niet als app
  }
