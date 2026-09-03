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
   stap die het systeem zelf kan afvinken is geen stap.

   `uitgevoerd` zegt of de stap ECHT WORDT GECONTROLEERD of alleen afgetekend.
   Dat onderscheid stond er niet, en dat was de duurste stille aanname van deze
   laag: de zwaarste eis werd afgetekend met een vrije tekst uit het verzoek, dus
   wie een sessie had overgenomen tekende hem af met het woord "proef". Waar
   `uitgevoerd` false is, staat de REDEN erbij -- een aftekening zonder reden ziet
   er van buiten precies zo uit als een controle. */
const STAPPEN = Object.freeze({
  reden:        { wie: 'de aanvrager', wat: 'een concrete reden van minimaal 8 tekens', uitgevoerd: true },
  passkey:      { wie: 'server/webauthn', wat: 'een geslaagde WebAuthn-bevestiging, buiten deze module',
                  uitgevoerd: true },
  apparaat:     { wie: 'de sessie', wat: 'de handeling komt van een apparaat dat al vertrouwd was',
                  uitgevoerd: false,
                  nietUitgevoerd: 'RTG heeft geen register van vertrouwde toestellen en de sessie draagt ' +
                    'geen toestelsleutel. Deze stap wordt daarom afgetekend en niet gecontroleerd.' },
  wachttijd:    { wie: 'de klok', wat: 'een afkoelperiode waarin het verzoek zichtbaar openstaat',
                  uitgevoerd: true },
  tweedePaarOgen: { wie: 'een tweede mens', wat: 'een andere actor dan de aanvrager keurt goed',
                  uitgevoerd: true }
});

/* HET DOEL WAARAAN EEN PASSKEY-CEREMONIE WORDT GEBONDEN, op een plek.

   kern/webauthn-stapop.js bewaart ELKE stap-op-ceremonie onder hetzelfde
   voorvoegsel `stapop:`, en het `doel` is een vrije string. Het doel IS dus de
   enige scheiding tussen features -- niet het toeval dat een rtgid-koppel er
   anders uitziet dan een ontsluitverzoek. Vandaar het naamsvoorvoegsel, en
   vandaar dat de SOORT erin staat: een assertie voor `passkey` mag nooit in een
   toekomstige `apparaat`-stap glijden. */
function doelVoor(verzoekId, soort) {
  return 'isolatie:ontsluiting:' + String(verzoekId || '') + ':' + String(soort || '');
}

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
function eisenVoor({ drager, van, naar, tweedeMens, passkeyMogelijk }) {
  const stap = ordening.verlaagt(van, naar);
  if (!stap.verlaagt) {
    return { verlaagt: false, eisen: [], waarom: 'dit verstrengt of laat gelijk; verhogen kent geen ceremonie' };
}
  const eisen = ['reden'];
  /* DE PASSKEY-EIS HANGT AAN EEN GETELD GEGEVEN, nooit aan het verzoek.

     Dezelfde afweging als bij het tweede paar ogen hieronder, en om dezelfde
     reden: een eiser die de aanvrager niet kan halen maakt het platform na een
     incident onherstelbaar. Een eigenaar zonder passkey zou de huis-ceremonie
     dan nooit meer rondkrijgen. `passkeyMogelijk` wordt daarom GETELD door de
     laag erboven (kern/webauthn.js telt de credentials van dit account) en komt
     nooit uit het lijf van het verzoek -- zou de aanvrager het mogen meesturen,
     dan kiest hij zelf of hij een passkey nodig heeft.

     `undefined` telt hier als "wel mogelijk": een aanroeper die het gegeven niet
     levert, mag de eis niet per ongeluk wegnemen. Alleen een uitgesproken
     `false` opent de nooduitgang. */
  const geenPasskey = passkeyMogelijk === false;
  if (!geenPasskey) eisen.push('passkey');
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
  const geenTweedeMens = vierOgenLaag && tweedeMens === false;
  if (vierOgenLaag && !geenTweedeMens) eisen.push('tweedePaarOgen');

  /* TWEE REDENEN VOOR EEN NOODONTSLUITING, EN ZE BLIJVEN UIT ELKAAR.

     Er is nu meer dan een grond waarop een eis kan wegvallen, en die in een
     boolean persen zou precies de stille samenvoeging zijn die dit huis elders
     verbiedt: "noodontsluiting: true" zegt dan niet meer WAAROM, terwijl een
     ontsluiting zonder tweede mens iets heel anders is dan een zonder passkey.
     `alleen` blijft bestaan en wordt AFGELEID uit de lijst -- de lijst is de
     waarheid, de boolean is het gemak. */
  const gronden = [];
  if (geenTweedeMens) gronden.push({ grond: 'geenTweedeMens',
    waarom: 'er is buiten de aanvrager niemand met de bevoegdheid om dit goed te keuren' });
  if (geenPasskey) gronden.push({ grond: 'geenPasskey',
    waarom: 'aan dit account hangt geen passkey; een eis die niemand kan halen maakt het platform ' +
      'onherstelbaar en wordt in de praktijk omzeild' });
  const alleen = gronden.length > 0;
  return {
    verlaagt: true, zeker: stap.zeker, eisen, alleen, gronden,
    alleenWaarom: alleen
      ? gronden.map(g => g.waarom).join('; ') + '. De ontsluiting gaat door als NOODONTSLUITING: ' +
        'hij wordt gemerkt, gemeld en blijft in het spoor staan.'
      : null,
    wachttijdMinuten: eisen.includes('wachttijd') ? WACHTTIJD_MINUTEN[drager] : 0,
    waarom: stap.zeker
      ? 'dit verlaagt de stand van ' + van + ' naar ' + naar
      : 'deze overgang is niet te ordenen en telt daarom als de zwaarste verlaging'
};
}

module.exports = { STAPPEN, WACHTTIJD_MINUTEN, doelVoor, eisenVoor };
