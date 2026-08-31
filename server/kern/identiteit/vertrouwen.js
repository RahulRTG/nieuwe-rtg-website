/* ============================================================================
   DE VERTROUWENSSTAND -- afgeleid uit harde feiten, en nergens bewaard.

   DE KEUZE DIE HIERONDER LIGT (MIJNRTG.md, besluit 31 augustus 2026): deze
   stand rust ALLEEN op wat al bewezen is over de sessie zelf. Geen
   locatiesprongen, geen gedrag, geen tijdstip. Dat scheelt signaal, en dat is
   met open ogen betaald: gedrag meewegen vraagt een gedragslogboek per lid, en
   dat is precies wat dit huis elders bewust niet bijhoudt.

   HIJ WORDT NIET OPGESLAGEN, en dat is geen detail maar de kern. Een afgeleide
   waarde die je bewaart, is een tweede waarheid die veroudert: de sessie zegt
   dan "sterk" terwijl het toestel er inmiddels uit ligt. Vandaar dat het veld
   `vertrouwen` uit kern/identiteit/sessievelden.js is GEHAALD in plaats van
   gevuld -- niemand schreef het, en een veld dat niemand vult is een belofte
   die niemand nakomt. De stand wordt berekend op het moment dat iemand hem
   vraagt, uit claims die er dan zijn.

   DE REGEL DIE HEM EERLIJK HOUDT: een conclusie is nooit harder dan haar
   zachtste premisse. Rust de stand op een toestelbinding die `vermoed` is, dan
   is de stand zelf ook hoogstens `vermoed`. Zonder die regel ontstaat precies
   het samengestelde groene cijfer dat LAT-regel 11 verbiedt -- drie halve
   zekerheden die samen als een hele lezen.

   EN HET IS GEEN SCORE. Er komt geen getal en geen percentage uit; er komt een
   STAND met de gronden eronder. Een mens die "72" leest, weet niet of hij iets
   moet doen. Wie leest "alleen iets dat u weet; er is geen bezit aangetoond"
   weet dat wel.
   ========================================================================== */
'use strict';

const { GRADEN } = require('./sessievelden');

/* De vier standen, van zwak naar sterk. Ze zeggen WAT er is aangetoond en niet
   hoe goed iemand het doet -- vandaar geen rapportcijfers en geen kleuren met
   een oordeel erin. `onbekend` is een eersteklas stand: "wij hebben nooit
   vastgelegd waarmee deze sessie ontstond" is iets anders dan "zwak".

   `bezit` en `kennis` zijn de twee klassieke factoren, en de volgorde is niet
   willekeurig: iets dat u WEET is over te dragen (af te kijken, te phishen, te
   vertellen), iets dat u HEBT niet. */
const STANDEN = {
  onbekend: { rang: 0, naam: 'Onbekend',
    uitleg: 'Van deze sessie is niet vastgelegd waarmee zij tot stand kwam.' },
  kennis: { rang: 1, naam: 'Alleen kennis',
    uitleg: 'Deze sessie steunt op iets dat u weet. Dat is over te dragen: af te kijken, te phishen of te vertellen.' },
  /* TWEE FACTOREN, MAAR ALLEBEI OVER TE DRAGEN. Een TOTP-code komt uit een
     geheim dat RTG ook heeft, en een mens kan hem voorlezen aan wie erom vraagt.
     Dat is aantoonbaar beter dan een wachtwoord alleen -- en het is niet
     hetzelfde als een passkey, waar dit huis de private helft nooit heeft
     gezien. Deze trede bestaat om dat verschil niet weg te poetsen: hem onder
     `bezit` scharen zou een groen vinkje zijn dat phishing niet tegenhoudt. */
  tweefactor: { rang: 2, naam: 'Twee factoren',
    uitleg: 'Naast uw wachtwoord is een code uit uw authenticator gecontroleerd. Twee drempels in plaats van een -- maar allebei van de soort die u kunt doorvertellen, dus phishing werkt hier nog.' },
  bezit: { rang: 3, naam: 'Bezit aangetoond',
    uitleg: 'Er is bezit van een sleutel of een toestel aangetoond, en dat is niet over te dragen.' },
  gebonden: { rang: 4, naam: 'Bezit en binding',
    uitleg: 'Er is sleutelbezit aangetoond en het token van deze sessie zit aan die sleutel vast. Een gestolen token alleen levert niets op.' }
};

/* Wat er met opzet NIET meeweegt, met de reden per regel. Deze lijst gaat mee
   naar het scherm: een stand die zwijgt over wat hij niet bekeek, laat een mens
   denken dat hij alles bekeek. */
const NIET_MEEGEWOGEN = [
  { wat: 'Waar u vandaan komt',
    reden: 'Daarvoor zou elke sessie een landcode uit uw IP-adres moeten dragen, en een sessie repliceert over een bus. Dat is bewust niet gebouwd.' },
  { wat: 'Uw gedrag: tempo, tijdstip, volgorde',
    reden: 'Dat vraagt een gedragslogboek per lid. Dit huis houdt tellers bij en geen journaal van wat u doet.' },
  { wat: 'Hoe lang deze sessie al open staat',
    reden: 'Ouderdom bewijst niets over wie u bent. Er staat wel bij wanneer zij voor het laatst is gezien, zodat u het zelf kunt wegen.' }
];

const graadRang = (g) => GRADEN.indexOf(g);

/* DE STAND, uit de stand-per-veld die het sessieregister al oplevert.

   Hij leest `stand` (graad per veld) en niet de rauwe context: zo kan deze laag
   nooit iets zien wat het scherm niet ziet, en kan er geen tweede lezing van
   dezelfde claim ontstaan. */
function standVan(perVeld, soort) {
  const v = perVeld || {};
  const auth = v.authenticator || { graad: 'onbekend' };
  const toestel = v.toestel || { graad: 'onbekend' };
  const sleutel = v.sleutelbinding || { graad: 'onbekend' };

  const gronden = [];
  const dragend = [];          // de velden waar de STAND op rust
  let stand = 'onbekend';

  if (auth.graad === 'onbekend') {
    gronden.push({ feit: 'Waarmee ingelogd', staat: 'niet vastgelegd',
      betekenis: 'Zonder dit is er niets om op te bouwen.' });
  } else {
    const bezitAuth = auth.graad === 'bewezen';
    const tweeFactoren = /\+totp/.test(String(soort || ''));
    stand = bezitAuth ? 'bezit' : (tweeFactoren ? 'tweefactor' : 'kennis');
    dragend.push(auth);
    gronden.push({ feit: 'Waarmee ingelogd', staat: soortNaam(soort, bezitAuth),
      betekenis: bezitAuth
        ? 'Een sleutel heeft ondertekend; dat is bezit en niet over te dragen.'
        : (tweeFactoren
          ? 'Een wachtwoord EN een code uit uw authenticator zijn gecontroleerd. Beide zijn door te vertellen, dus dit is twee drempels en geen phishingbestendigheid.'
          : 'Een gedeeld geheim is gecontroleerd. Dat is kennis, en kennis is over te dragen.') });
  }

  /* Een bewezen toestelbinding tilt een kennis-sessie naar `bezit`: het toestel
     heeft aangetoond dat het een sleutel bezit die het niet kan verlaten. Hij
     tilt niet verder, want binding van het TOKEN is een aparte stap. */
  if (toestel.graad === 'bewezen') {
    if (STANDEN[stand].rang < STANDEN.bezit.rang) stand = 'bezit';
    dragend.push(toestel);
    gronden.push({ feit: 'Toestelbinding', staat: 'bewezen',
      betekenis: 'Dit toestel heeft een sleutel die het niet kan verlaten.' });
  } else {
    gronden.push({ feit: 'Toestelbinding', staat: toestel.graad,
      betekenis: 'Zonder binding weet RTG niet op welk toestel deze sessie draait.' });
  }

  if (sleutel.graad === 'bewezen' && STANDEN[stand].rang >= STANDEN.bezit.rang) {
    stand = 'gebonden';
    dragend.push(sleutel);
    gronden.push({ feit: 'Sleutelbinding', staat: 'bewezen',
      betekenis: 'Zware handelingen vragen een bezitsbewijs; een gestolen token alleen komt er niet door.' });
  } else {
    gronden.push({ feit: 'Sleutelbinding', staat: sleutel.graad,
      betekenis: 'Het token van deze sessie is niet aan een sleutel gebonden.' });
  }

  /* DE ZACHTSTE PREMISSE BEPAALT DE GRAAD. Rust de stand op iets dat `vermoed`
     is, dan is de stand zelf hoogstens `vermoed` -- ook al klinkt "bezit en
     binding" hard. Zonder deze regel lezen drie halve zekerheden samen als een
     hele, en dat is precies het samengestelde cijfer dat hier niet mag. */
  let graad = 'onbekend';
  if (dragend.length) {
    graad = dragend.reduce((laagst, d) =>
      (graadRang(d.graad) < graadRang(laagst) ? d.graad : laagst), 'bewezen');
  }

  return {
    stand, naam: STANDEN[stand].naam, uitleg: STANDEN[stand].uitleg,
    graad,
    /* Waarom de graad is wat hij is -- zonder dit lijkt een `vermoed`-stand een
       willekeurige voorzichtigheid in plaats van een gevolg. */
    graadReden: !dragend.length
      ? 'Er is niets vastgesteld om deze stand op te baseren.'
      : (graad === 'bewezen'
        ? 'Alles waar deze stand op rust, is cryptografisch aangetoond.'
        : 'Deze stand is nooit harder dan het zwakste feit eronder, en dat is ' + graad + '.'),
    gronden, nietMeegewogen: NIET_MEEGEWOGEN
  };
}

function soortNaam(soort, bezit) {
  if (soort === 'wachtwoord+totp') return 'wachtwoord en authenticator';
  if (soort === 'passkey') return 'passkey';
  if (soort === 'wachtwoord') return 'wachtwoord';
  if (soort === 'sleutelwoorden') return 'sleutelwoorden';
  if (soort === 'overdracht') return 'overgedragen sessie';
  return bezit ? 'sleutelbezit' : 'gedeeld geheim';
}

module.exports = { standVan, STANDEN, NIET_MEEGEWOGEN };
