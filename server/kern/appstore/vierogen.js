/* ============================================================================
   DE VIER-OGENREGEL, OP DE MENS -- wie inzendt, tekent niet af.

   GRENS 2 STOND OP DE ORGANISATIE EN DAT WAS NIET GENOEG. ./besluit.js weigert
   een handtekening van de eigen org: een uitgever tekent zijn eigen inzending
   niet af. Bij een externe partij is dat de hele scheiding -- die heeft geen
   kantoorinlog. Bij RTG's EIGEN uitgever is het niets: dezelfde mens bouwt de
   app, zendt hem in, en zit in het kantoor dat hem aftekent. Dan is de
   organisatiecontrole een formaliteit die precies de situatie doorlaat waarvoor
   hij bedoeld was.

   DAAROM DEZE LAAG, EN WAAROM HIJ APART STAAT. Het is een BESLUIT over twee
   identiteiten en niet over bytes; het hoort te beproeven zonder server, zonder
   bundel en zonder kantoorsessie -- dezelfde reden als kern/economie/firewall.js.

   HIJ VERGELIJKT TWEE DINGEN, EN ALLE TWEE MOETEN ZE KLOPPEN OM DOOR TE MOGEN.

     de sleutel   een stabiel handvat van de mens: het personeelsnummer van de
                  inzender, of de sessiesleutel van een persoonlijke uitgever.
                  Dit is de harde vergelijking; hij kan alleen ja of nee zeggen
                  als BEIDE kanten er een hebben.
     de naam      wat er op de handtekening staat. Zwakker -- namen zijn te
                  typen -- maar het is het enige dat werkt wanneer het kantoor
                  op een gedeelde code binnenkomt.

   WAT HIJ NIET DOET: de deur dichtgooien wanneer geen van beide bekend is. Dat
   is een echte afweging en hij staat hier hardop. Fail-closed zou hier betekenen
   dat elke kantoorsessie zonder persoonlijke inlog niets meer kan aftekenen --
   ook bij een externe uitgever, waar de organisatiecontrole al doet wat hij moet
   doen. Wat er wel gebeurt: het besluit draagt de GRAAD van de scheiding
   (`bewezen` of `opgegeven`), en die staat in het dossier. Een scheiding die op
   een ingetypte naam rust, hoort niet te lezen als een scheiding die op twee
   identiteiten rust (BESTUUR.md: elke bewering draagt een bewijsgraad).
   ========================================================================== */
'use strict';

/* Namen normaliseren voor de vergelijking: hoofdletters, dubbele spaties en
   een punt achteraan zijn geen andere mens. Verder wordt er niets slims
   geprobeerd -- "S. van RTG" en "Sam van RTG" zijn hier twee namen, en dat is
   beter dan een gokkende vergelijking die soms de verkeerde tegenhoudt. */
const normNaam = (n) => String(n == null ? '' : n).toLowerCase().replace(/\s+/g, ' ').replace(/\.$/, '').trim();

/* Geeft { mag, reden, graad }. `graad` zegt hoe hard de scheiding is
   vastgesteld, ook wanneer hij MAG. */
function toets({ inzender, doorKey, doorNaam }) {
  const inz = inzender && typeof inzender === 'object' ? inzender : null;
  const sleutelBekend = !!(inz && inz.id && doorKey);
  const naamBekend = !!(inz && inz.naam && doorNaam);

  if (sleutelBekend && String(inz.id) === String(doorKey)) {
    return { mag: false, graad: 'bewezen', code: 'zelfde-mens',
      reden: 'Deze inzending is door dezelfde persoon ingezonden. Wie een app inzendt, tekent hem niet af -- ook niet als hij namens RTG in het kantoor zit. Laat een andere collega de keuring doen.' };
  }
  if (naamBekend && normNaam(inz.naam) === normNaam(doorNaam)) {
    return { mag: false, graad: 'opgegeven', code: 'zelfde-naam',
      reden: 'De naam onder deze handtekening is dezelfde als die van de inzender. Wie een app inzendt, tekent hem niet af; laat een andere collega de keuring doen.' };
  }
  if (sleutelBekend) {
    return { mag: true, graad: 'bewezen',
      reden: 'De inzender en de ondertekenaar zijn twee verschillende mensen, en dat is aan hun inlog vastgesteld.' };
  }
  if (naamBekend) {
    return { mag: true, graad: 'opgegeven',
      reden: 'De namen verschillen. Dat is vastgesteld op wat er is ingetypt en niet op twee inlogs; de scheiding is dus opgegeven en niet bewezen.' };
  }
  return { mag: true, graad: 'onbekend',
    reden: 'Van de inzender of de ondertekenaar is geen persoon bekend. Er is dus niet vast te stellen of dit twee verschillende mensen zijn; alleen dat het twee verschillende organisaties zijn.' };
}

module.exports = { toets, normNaam };
