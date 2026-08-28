/* de demomelding: een demo is een toestand, geen terugval na een storing */
  /* DEMO IS VAN MAGNAAT, NIET VAN RTG. Hier stond `|| zoekParams.get('demo')
     === '1'`, en daarmee kon iedereen met ?demo=1 een RTG-portaal openen dat
     met verzonnen leden, reizen en Salon-berichten gevuld werd. Dat is precies
     wat RTG niet mag zijn: wat hier staat is echt, of het staat er niet.
     Magnaat is de plek waar gesimuleerd wordt (MAGNAATLAB.md), en die houdt
     zijn eigen ingang. */
  const explicieteDemo = magnaatProef;

  /* Een demo is een toestand, geen terugval na een storing. De melding stond
     altijd op het homescreen en daardoor leek ook een echte installatie een
     demo. De server vertelt nu zelf of RTG_DEMO aanstaat. Bij Magnaat en bij
     ?demo=1 is de keuze al expliciet en is geen netwerkantwoord nodig. */
  function zetDemoMelding(aan, tekst) {
    const el = document.getElementById('osDemoWet');
    if (!el) return;
    el.hidden = !aan;
    if (tekst) { el.removeAttribute('data-i18n'); el.textContent = tekst; }
  }
  if (magnaatProef) {
    zetDemoMelding(true, 'Magnaat · afgeschermde trainingskopie · geen echte klant-, geld- of productieactie');
  } else if (explicieteDemo) {
    zetDemoMelding(true);
  } else if (API.enabled) {
    fetch('/api/health').then(r => r.ok ? r.json() : null)
      .then(h => zetDemoMelding(!!(h && h.demo))).catch(() => zetDemoMelding(false));
  }
