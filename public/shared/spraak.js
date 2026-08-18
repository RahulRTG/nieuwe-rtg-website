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
   de knop een rode stip; daarna weer een microfoon.

   DE KNOP KOMT LEEG UIT DE MARKUP EN KREEG PAS EEN ICOON BIJ DE EERSTE KLIK.
   Alle vier de aanroepers geven een <button> zonder inhoud mee; het icoon werd
   gezet in de result-, end- en error-afhandeling en nergens anders. Wie niet
   klikte zag dus niets, en op muziek.html mat die knop 0x0: onzichtbaar,
   onraakbaar, en toch in de tabvolgorde met de naam "Spraaksturing: zeg wat u
   wilt horen". Dat is dezelfde vorm als de iOS-pil van eerder deze week. De
   koppeling zet het rusticoon nu meteen, en alleen als de knop leeg is -- een
   aanroeper die zijn eigen beeld meegeeft, houdt dat. */
(function (w) {
  'use strict';
  const SR = w.SpeechRecognition || w.webkitSpeechRecognition;

  /* De twee gezichten van de knop, een keer opgeschreven. Ze stonden drie keer
     uitgetypt, en dan gaat er ooit een van de drie afwijken. */
  const MIC = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M6 11a6 6 0 0 0 12 0M12 17v3"/></svg>';
  const STIP = '<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="12" r="6"/></svg>';

  /* En de knop zelf een ondergrens, om dezelfde reden als de iOS-pil: niet elk
     scherm dat spraak.js laadt geeft die knop een maat. Op muziek.html stond hij
     op 0 breed. Alleen min-*, dus een scherm dat hem al opmaakt merkt er niets van. */
  function maatEenmalig() {
    if (!w.document || w.document.getElementById('rtg-spraak-maat')) return;
    var st = w.document.createElement('style');
    st.id = 'rtg-spraak-maat';
    st.textContent = '[data-spraakknop]{min-width:24px;min-height:24px;' +
      'display:inline-flex;align-items:center;justify-content:center;}';
    (w.document.head || w.document.documentElement).appendChild(st);
  }

  function koppel(knop, opties) {
    if (!knop || !opties || typeof opties.opTekst !== 'function') return;
    if (!SR) { knop.hidden = true; return; }
    knop.setAttribute('data-spraakknop', '');
    maatEenmalig();
    if (!knop.innerHTML.trim()) knop.innerHTML = MIC;
    knop.addEventListener('click', () => {
      try {
        const rec = new SR();
        rec.lang = (opties.taal && opties.taal()) || (document.documentElement.lang === 'en' ? 'en-US' : 'nl-NL');
        rec.interimResults = false;
        rec.maxAlternatives = 1;
        knop.innerHTML = STIP;
        rec.addEventListener('result', ev => {
          const zin = (((ev.results[0] || [])[0] || {}).transcript || '').trim();
          if (zin) opties.opTekst(zin);
        });
        rec.addEventListener('end', () => { knop.innerHTML = MIC; });
        rec.addEventListener('error', ev => {
          knop.innerHTML = MIC;
          /* Een microfoon die niet MAG is iets anders dan een zin die niet
             verstaan wordt, en het onderscheid stond hier niet. De mediapoort
             (shared/media.js) noemt de oorzaak en zet hem in beeld; alleen als
             het echt aan het verstaan lag, valt de app terug op haar eigen hint. */
          if (w.RTGMedia && w.RTGMedia.spraak(ev && ev.error)) return;
          if (opties.nietVerstaan) opties.nietVerstaan();
        });
        rec.start();
      } catch (e) { if (opties.kanNiet) opties.kanNiet(); }
    });
  }

  w.Spraak = { kan: !!SR, koppel };
})(window);
