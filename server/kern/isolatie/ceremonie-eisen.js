/* WAT EEN CEREMONIE VRAAGT -- de stappen, de klok en de afweging erachter.

   Los van ./ontsluiting.js omdat het twee verschillende dingen zijn: dat bestand
   voert de ceremonie UIT (aanvragen, aftekenen, afmaken, afbreken) en dit bepaalt
   wat zij VRAAGT. De tweede is een beleidsvraag met een lange onderbouwing en de
   eerste een toestandsmachine; ze schuiven elk om hun eigen reden, en samen in
   een bestand betekent dat elke beleidswijziging de toestandsmachine aanraakt.

   Deze module is PUUR: dezelfde overgang geeft altijd hetzelfde antwoord, zodat
   een scherm de eisen vooraf kan tonen. Een mens die pas halverwege hoort dat er
   een tweede paar ogen bij moet, wacht voor niets. */
'use strict';

const ordening = require('./ordening');

/* De stappen die een ceremonie kan eisen. Elk met wie hem levert, want een
   stap die het systeem zelf kan afvinken is geen stap. */
const STAPPEN = Object.freeze({
  reden:        { wie: 'de aanvrager', wat: 'een concrete reden van minimaal 8 tekens' },
  passkey:      { wie: 'server/webauthn', wat: 'een geslaagde WebAuthn-bevestiging, buiten deze module' },
  apparaat:     { wie: 'de sessie', wat: 'de handeling komt van een apparaat dat al vertrouwd was' },
  wachttijd:    { wie: 'de klok', wat: 'een afkoelperiode waarin het verzoek zichtbaar openstaat' },
  tweedePaarOgen: { wie: 'een tweede mens', wat: 'een andere actor dan de aanvrager keurt goed' }
});

/* Hoe lang de afkoelperiode duurt, per drager.

   WAAROM HET HUIS ER GEEN HEEFT, EN DAT IS DE OMGEKEERDE VOLGORDE VAN WAT JE
   VERWACHT. De eerste opzet gaf het huis de LANGSTE wachttijd -- een uur -- want
   het raakt iedereen. Dat is de verkeerde redenering, en ze is duur: een
   wachttijd op het HERSTEL van het platform is een zelf toegebrachte storing.
   Wie na een vals alarm een uur moet wachten voor RTG weer draait, zet de
   isolatiestand de volgende keer niet aan. Dan is de knop er wel en gebruikt
   niemand hem, en dat is precies wat BESTUUR.md grens 6.10 wil voorkomen.

   Waar een wachttijd VOOR is: een echte eigenaar de tijd geven om te merken dat
   iemand anders zijn beveiliging aan het openzetten is. Voor het huis en voor
   een organisatie doet een TWEEDE MENS dat werk beter en meteen -- die kijkt en
   ziet het, in plaats van dat er een klok loopt waar niemand naar kijkt. Het
   huis en de organisatie ruilen de wachttijd dus in voor vier ogen; de dragers
   daaronder hebben geen tweede mens en houden de klok. */
const WACHTTIJD_MINUTEN = Object.freeze({ huis: 0, organisatie: 0, identiteit: 10, sessie: 0, apparaat: 0 });

/* `tweedeMens` zegt of er BUITEN de aanvrager iemand is die mag goedkeuren.
   De aanroeper weet dat (hij kent de toegangslijst); deze module niet, en hem
   laten raden zou de zwaarste eis van de hele laag op een gok zetten. */
function eisenVoor({ drager, van, naar, tweedeMens }) {
  const stap = ordening.verlaagt(van, naar);
  if (!stap.verlaagt) {
    return { verlaagt: false, eisen: [], waarom: 'dit verstrengt of laat gelijk; verhogen kent geen ceremonie' };
}
  const eisen = ['reden', 'passkey'];
  const zwaar = !stap.zeker || String(van) === 'isolatie' || String(van) === 'beschermd';
  if (zwaar) eisen.push('apparaat');
  if ((WACHTTIJD_MINUTEN[drager] || 0) > 0 && zwaar) eisen.push('wachttijd');
  /* VIER OGEN WAAR EEN TWEEDE MENS BESTAAT, EN EEN EERLIJK MERK WAAR NIET.

     Dit is de scherpste afweging van de hele laag, en de eerste versie had hem
     fout. Die eiste een tweede paar ogen voor het huis, punt. In een opstelling
     met één eigenaar is die eis nooit te halen -- en dan is het platform na een
     incident ONHERSTELBAAR. Dat is geen strenge beveiliging maar een storing
     die je zelf hebt ingebouwd, en het is erger dan wat de eis moest voorkomen.

     Een eis die niemand kan halen, wordt bovendien altijd omzeild: iemand maakt
     een tweede account om zichzelf goed te keuren, en dan is het vier-ogen-
     principe een formaliteit MET een extra sleutel die rondslingert.

     Dus: bestaat er een tweede bevoegde mens, dan is hij verplicht. Bestaat hij
     aantoonbaar niet, dan gaat de ontsluiting door als NOODONTSLUITING -- met
     een merk dat blijft staan, een kritieke melding en een regel in het spoor.
     De waarde zit hier niet in het tegenhouden maar in het niet kunnen
     verbergen. En het is geen keuze van de aanvrager: hij levert het gegeven
     niet, de laag erboven telt het. */
  const vierOgenLaag = drager === 'huis' || drager === 'organisatie';
  const alleen = vierOgenLaag && tweedeMens === false;
  if (vierOgenLaag && !alleen) eisen.push('tweedePaarOgen');
  return {
    verlaagt: true, zeker: stap.zeker, eisen, alleen,
    alleenWaarom: alleen
      ? 'er is buiten de aanvrager niemand met de bevoegdheid om dit goed te keuren. De ontsluiting ' +
        'gaat door als NOODONTSLUITING: hij wordt gemerkt, gemeld en blijft in het spoor staan.'
      : null,
    wachttijdMinuten: eisen.includes('wachttijd') ? WACHTTIJD_MINUTEN[drager] : 0,
    waarom: stap.zeker
      ? 'dit verlaagt de stand van ' + van + ' naar ' + naar
      : 'deze overgang is niet te ordenen en telt daarom als de zwaarste verlaging'
};
}

module.exports = { STAPPEN, WACHTTIJD_MINUTEN, eisenVoor };
