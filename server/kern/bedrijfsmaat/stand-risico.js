/* RISICO: BETALINGEN WAARVAN DE AFLOOP NIET VASTSTAAT (bedrijfsmaat
   risico.betalingen-onbekend).

   De telling bestaat al en wordt hier niet opnieuw bedacht: kern/betaalwaarheid/
   hervat.js `openstaand()` is wat de veegronde en de reconciliatie ook lezen.
   Onbekend is daar een betaling die bij een provider is gestart, geen
   providerreferentie heeft en niet definitief betaald is -- de kaart kan al
   belast zijn, en RTG weet het niet. Die definitie is van de betaalwaarheid; deze
   maat telt haar alleen, en neemt de escalaties en de betalingen die een mens
   moet nakijken ernaast mee, want die drie samen zijn het risico.

   Er zitten geen mensen in deze telling (betalingen, geen leden), dus geen
   groepspoort; wel een reden als de betaalwaarheid er niet is, en nooit een nul
   omdat niemand keek. */
'use strict';

const REGEL = Object.freeze({ versie: 1, herkomst: 'code',
  regel: 'Een betaling is ONBEKEND als zij bij een provider is gestart, geen providerreferentie heeft en niet definitief ' +
    'betaald is (kern/betaalwaarheid/hervat.js). Naast het aantal staan het bedrag, de escalaties en de betalingen die ' +
    'een mens moet nakijken.' });

module.exports = ({ maat, betalingen }) => {
  let o = null;
  try { o = typeof betalingen === 'function' ? betalingen() : null; } catch (e) { o = null; }
  const uit = !o || !Number.isInteger(o.onbekend)
    ? { stand: 'NIET_UIT_TE_REKENEN', waarde: null, waarom: 'De betaalwaarheid is niet beschikbaar; er is niet gekeken.' }
    : { stand: 'TOONBAAR', waarde: o.onbekend, eenheid: 'betalingen', onbekendeCenten: o.onbekendeCenten,
      escalatie: o.escalatie, controleNodig: o.controleNodig, oudsteOpenAt: o.oudsteAt };
  return maat('risico.betalingen-onbekend', REGEL, uit,
    ['Alleen inkomende betalingen van de betaalwaarheid; uitgaande opdrachten (kern/betaalopdracht) hebben hun eigen overzicht.',
      'Een stand van nu, geen verloop over de maand.']);
};
