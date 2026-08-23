/* De trainingsmelding bestaat uitsluitend in Magnaat. De echte app kent geen
   queryparameter, health-status of netwerkfout die voorbeelddata kan openen. */
  function zetDemoMelding(aan, tekst) {
    const el = document.getElementById('osDemoWet');
    if (!el) return;
    el.hidden = !aan;
    if (tekst) { el.removeAttribute('data-i18n'); el.textContent = tekst; }
  }
  if (magnaatProef) {
    zetDemoMelding(true, 'MAGNAAT TEST · geïsoleerde trainingskopie · geen echte klant-, geld- of productieactie');
  }
