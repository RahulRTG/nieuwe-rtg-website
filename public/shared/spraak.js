/* Spraak: een microfoonknop, een gesproken zin eruit. Een motor voor alle
   apps (leden-app, PDA), zodat de spraaklogica maar op een plek leeft.

   Gebruik:
     Spraak.koppel(knop, {
       opTekst: zin => { ... },        // verplicht: de verstane zin
       taal: () => 'nl-NL',            // optioneel: anders de paginataal
       nietVerstaan: () => { ... },    // optioneel: toon een vriendelijke hint
       kanNiet: () => { ... }          // optioneel: browser kan geen spraak
     });

   Zonder browserondersteuning verdwijnt de knop stilletjes (hidden), dus
   de apps hoeven nergens zelf te detecteren. Tijdens het luisteren wordt
   de knop een rode stip; daarna weer een microfoon. */
(function (w) {
  'use strict';
  const SR = w.SpeechRecognition || w.webkitSpeechRecognition;

  function koppel(knop, opties) {
    if (!knop || !opties || typeof opties.opTekst !== 'function') return;
    if (!SR) { knop.hidden = true; return; }
    knop.addEventListener('click', () => {
      try {
        const rec = new SR();
        rec.lang = (opties.taal && opties.taal()) || (document.documentElement.lang === 'en' ? 'en-US' : 'nl-NL');
        rec.interimResults = false;
        rec.maxAlternatives = 1;
        knop.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="12" r="6"/></svg>';
        rec.addEventListener('result', ev => {
          const zin = (((ev.results[0] || [])[0] || {}).transcript || '').trim();
          if (zin) opties.opTekst(zin);
        });
        rec.addEventListener('end', () => { knop.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M6 11a6 6 0 0 0 12 0M12 17v3"/></svg>'; });
        rec.addEventListener('error', () => {
          knop.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M6 11a6 6 0 0 0 12 0M12 17v3"/></svg>';
          if (opties.nietVerstaan) opties.nietVerstaan();
        });
        rec.start();
      } catch (e) { if (opties.kanNiet) opties.kanNiet(); }
    });
  }

  w.Spraak = { kan: !!SR, koppel };
})(window);
