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
                  typen -- en daarom alleen een EXTRA blokkade (dezelfde naam
                  tekent niet af), nooit een doorlaat: een gedeelde code met een
                  getypte naam tekent niets af (zie onder).

   ZONDER IDENTITEIT GAAT DE DEUR DICHT (AUTHORITY.md B2, besluit van de
   eigenaar, 23 september 2026). Eerst stond hier het omgekeerde: kende de toets
   geen van beide mensen, dan liet hij door met graad `onbekend`, omdat de
   organisatiecontrole bij een externe uitgever al scheidt. Dat is precies het
   gat waar de regel voor bestaat -- een inzending zonder mens erachter kan van
   iedereen zijn, ook van wie hem nu aftekent. `onbekend` is geen `ja`
   (CONTROLPLANE.md: ONBEKEND is geen WEIGEREN, maar ook geen TOESTAAN). Wat er
   blijft: de GRAAD van de scheiding staat in het dossier (`bewezen` of
   `opgegeven`), en een scheiding die op een ingetypte naam rust, leest niet als
   een die op twee identiteiten rust (BESTUUR.md: elke bewering draagt een
   bewijsgraad). De weg eromheen staat in de weigering: zend opnieuw in met een
   persoonlijke inlog.
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
  /* ALLE SLEUTELS VAN DE INZENDER (11 oktober 2026). Een werkplek draagt er twee
     -- het personeelsnummer EN de ledensleutel -- en het kantoor op naam kent
     alleen de tweede. Vergeleek deze toets alleen `id` (het personeelsnummer),
     dan zond een mens in als medewerker en tekende hij af als kantoormens. */
  const ids = inz ? [inz.id].concat(Array.isArray(inz.ids) ? inz.ids : []).filter(Boolean).map(String) : [];
  /* EN ALLEEN IN DEZELFDE SLEUTELRUIMTE (N2, 11 oktober 2026). `staff:K:9` en
     `user-42` zijn niet gelijk, maar dat bewijst niets: het kunnen twee namen
     van dezelfde mens zijn -- precies de inzendingen van voor `ids` bestond.
     Zonder een sleutel van de inzender in de ruimte van de tekenaar is de
     scheiding niet vast te stellen, en dan is het nooit `bewezen`. */
  const ruimte = (k) => (/^user-\d+$/.test(String(k)) ? 'lid' : (/^staff:/.test(String(k)) ? 'staff' : 'anders'));
  // `anders` is geen ruimte maar het ontbreken ervan: twee onbekende vormen bewijzen niets
  const sleutelBekend = !!(doorKey && ruimte(doorKey) !== 'anders' && ids.some(k => ruimte(k) === ruimte(doorKey)));
  const naamBekend = !!(inz && inz.naam && doorNaam);

  if (doorKey && ids.includes(String(doorKey))) {
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
  /* EEN GETYPTE NAAM IS GEEN TWEEDE HANDTEKENING (besluit van de eigenaar,
     11 oktober 2026). Hier stond een tak die doorliet op twee VERSCHILLENDE
     namen, met graad `opgegeven`: de gedeelde kantoorcode plus een willekeurige
     naam in `door` publiceerde dan een app. Een opgegeven naam, een bestaande
     sessie en een bewezen identiteit zijn drie verschillende dingen, en alleen
     de laatste mag een tweede paar ogen heten. Zonder sleutel aan de kant van
     wie tekent, gaat de deur dus dicht -- met de weg erheen. De graad blijft
     staan als BESCHRIJVING van wat er lag, niet als vergunning. Zonder naam EN
     zonder sleutel valt het hieronder in `geen-identiteit`, ook dicht. */
  if (naamBekend && !doorKey) {
    return { mag: false, graad: 'opgegeven', code: 'geen-tweede-mens',
      reden: 'Een ingetypte naam is geen handtekening: met de gedeelde kantoorcode is niet vast te stellen wie er tekent. Log in op naam met uw eigen RTG-account (kantoorrol) en teken dan af.' };
  }
  /* De tekenaar IS bekend, de inzending niet: dan moet de INZENDING opnieuw,
     niet de handtekening. */
  if (doorKey) {
    return { mag: false, graad: 'onbekend', code: 'geen-identiteit',
      reden: 'Uw handtekening op naam is in orde, maar deze INZENDING draagt geen persoon die met uw inlog te vergelijken is: niet vast te stellen of u iemand anders bent dan de inzender. Laat de uitgever de app opnieuw inzenden met een persoonlijke inlog.' };
  }
  return { mag: false, graad: 'onbekend', code: 'geen-identiteit',
    reden: 'Van de inzender of de ondertekenaar is geen persoon bekend, dus niet vast te stellen of dit twee verschillende mensen zijn. Laat de uitgever opnieuw inzenden met een persoonlijke inlog, en teken af met uw eigen account op naam -- een getypte naam is geen handtekening.' };
}

module.exports = { toets, normNaam };
