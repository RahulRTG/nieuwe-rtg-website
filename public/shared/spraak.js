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
        knop.textContent = '🔴';
        rec.addEventListener('result', ev => {
          const zin = (((ev.results[0] || [])[0] || {}).transcript || '').trim();
          if (zin) opties.opTekst(zin);
        });
        rec.addEventListener('end', () => { knop.textContent = '🎤'; });
        rec.addEventListener('error', () => {
          knop.textContent = '🎤';
          if (opties.nietVerstaan) opties.nietVerstaan();
        });
        rec.start();
      } catch (e) { if (opties.kanNiet) opties.kanNiet(); }
    });
  }

  w.Spraak = { kan: !!SR, koppel };
})(window);
