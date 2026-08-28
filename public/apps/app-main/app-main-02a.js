/* de trainingsmelding: een proef is een toestand, geen terugval na een storing */
  /* TRAINING IS VAN MAGNAAT, NIET VAN RTG. Alleen de afgeschermde Magnaat-kopie
     mag verzonnen leden, reizen en Salon-berichten laden. */
  const magnaatKopie = magnaatProef;

  /* Een demo is een toestand, geen terugval na een storing. De melding stond
     altijd op het homescreen en daardoor leek ook een echte installatie een
     demo. Alleen Magnaat kiest de trainingskopie expliciet. */
  function zetDemoMelding(aan, tekst) {
    const el = document.getElementById('osDemoWet');
    if (!el) return;
    el.hidden = !aan;
    if (tekst) { el.removeAttribute('data-i18n'); el.textContent = tekst; }
  }
  if (magnaatProef) {
    zetDemoMelding(true, 'MAGNAAT TEST · geïsoleerde trainingskopie · geen echte klant-, geld- of productieactie');
  }
