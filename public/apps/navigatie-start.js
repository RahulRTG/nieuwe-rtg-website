/* RTG Navigatie: de plek en de start. Eerst de eerste fix (of een eerlijke
   poort), dan de kaart. De stand staat in window.RTGNav (navigatie-kern.js);
   status, poort, lagen en melden staan in navigatie-bediening.js. */
(() => {
  'use strict';
  const N = window.RTGNav, { $, S, api, toon, token, landVan } = N;
  const haalStatus = () => N.haalStatus(), haalFlits = () => N.haalFlits();
  const canvas = $('#kaart');

  /* ---- gps: jouw echte positie (blijft op het toestel) ----
     Je positie is hier de hele functie, dus de app vraagt erom (plek.js) en
     gaat door zonder plek als je nee zegt. NA het parsen, want plek.js laadt
     met defer. `wachtNogOpPlek`: komt de fix pas na het opgeven, dan bouwen
     we alsnog. */
  let stopVolgen = null, opPlek = null, opGeenPlek = null;
  document.addEventListener('DOMContentLoaded', () => {
    if (!window.RTGPlek || !window.isSecureContext) { if (opGeenPlek) opGeenPlek('geen-veilige-verbinding'); return; }
    stopVolgen = RTGPlek.volg(plek => {
      const eerste = !S.hier;
      S.hier = { lat: plek.lat, lng: plek.lng }; S.land = landVan(S.hier);
      if (S.kaartData) N.bouwPinnen();
      if (S.navigerend && S.naar && Date.now() - S.laatsteHerberekening > 30000) {
        S.laatsteHerberekening = Date.now(); N.berekenRoute();
      }
      // de eerste fix is het startsein: hiervoor viel er niets te bouwen
      if (eerste && opPlek) { const f = opPlek; opPlek = null; opGeenPlek = null; f(); }
      else if (eerste && S.wachtNogOpPlek) {
        S.wachtNogOpPlek = false;
        toon('#poort', false); $('#poortReden').textContent = '';
        initialiseerKaart();
      }
    }, {
      waarom: 'Om je de weg te wijzen moet ik weten waar je bent. Je locatie blijft op je toestel; RTG bewaart hem niet.',
      /* Wachten op een antwoord dat er al is: "nu niet" komt meteen door, niet
         pas na de time-out van twaalf seconden. */
      geenPlek: reden => { const f = opGeenPlek; opGeenPlek = null; opPlek = null; if (f) f(reden); }
    });
    // het toestel blijft niet peilen als niemand kijkt
    window.addEventListener('pagehide', () => { if (stopVolgen) stopVolgen(); });
  });

  /* ---- start ---- */
  N.initialiseerKaart = initialiseerKaart;
  async function initialiseerKaart() {
    if (S.kaartBegonnen || !S.hier) return;
    const r = await api('kaart', { lat: S.hier.lat, lng: S.hier.lng });
    if (r.status !== 200) {
      await haalStatus();                       // de badge hoort hetzelfde te zeggen als de poort
      $('#poortReden').textContent = r.body.error || 'Log eerst in via de app.';
      toon('#poort', true);
      return;
    }
    S.kaartBegonnen = true; S.kaartData = r.body; N.P.ref = S.kaartData.ref; S.land = landVan(N.P.ref); N.P.cosRef = Math.cos(N.P.ref.lat * Math.PI / 180);
    await haalStatus(); N.grootte();
    N.R = Drie.maakRenderer ? Drie.maakRenderer(canvas, {}) : null;
    if (N.R) { N.bouwStad(); await haalFlits(); N.bouwPinnen(); N.bouwRoute(); N.teken(); $('#badge3d').textContent = '3D'; }
    else { $('#badge3d').textContent = '2D'; await haalFlits(); N.teken2D(); }
    /* PAS HIER: berekenRoute() heeft een vertrekpunt nodig. */
    if (N.meegegeven) {
      $('#zoek').value = N.meegegeven.naam;
      await N.kiesBestemming(N.meegegeven);
    }
  }
  window.addEventListener('resize', N.grootte);
  (async () => {
    if (!token) { toon('#poort', true); return; }
    /* Wachten op de eerste plek in plaats van er een te verzinnen. */
    if (!S.hier) {
      const uitslag = await new Promise(klaar => {
        opPlek = () => klaar({ plek: true });
        opGeenPlek = reden => klaar({ plek: false, reden });
        setTimeout(() => { if (opPlek || opGeenPlek) { opPlek = null; opGeenPlek = null; klaar({ plek: false, reden: 'geen-antwoord' }); } }, 12000);
      });
      if (!uitslag.plek) {
        /* "Niet beschikbaar" is drie verschillende dingen. */
        $('#poortReden').textContent = {
          'niet-toegestaan': 'Uw locatie is niet vrijgegeven. Kies zelf uw vertrekpunt; RTG verzint nooit waar u bent.',
          'toestel-weigert': 'Uw toestel geeft geen locatie af. Kies zelf uw vertrekpunt; RTG verzint nooit waar u bent.',
          'geen-gps': 'Dit toestel kent geen locatiebepaling. Kies zelf uw vertrekpunt; RTG verzint nooit waar u bent.',
          'geen-veilige-verbinding': 'Zonder beveiligde verbinding geeft de browser geen locatie af. Kies zelf uw vertrekpunt.'
        }[uitslag.reden] || 'Locatie is niet beschikbaar. Kies veilig zelf uw vertrekpunt; RTG verzint nooit waar u bent.';
        $('#liveBadge').textContent = 'Locatie onbekend';
        $('#manualStart').hidden = false;
        $('#poortKaarten').hidden = false;
        toon('#poort', true);
        S.wachtNogOpPlek = true;                  // komt hij alsnog, dan bouwen we alsnog
        return;
      }
    }
    await initialiseerKaart();
  })();
})();
