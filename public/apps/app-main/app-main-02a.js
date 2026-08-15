  const explicieteDemo = magnaatProef || zoekParams.get('demo') === '1';

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
