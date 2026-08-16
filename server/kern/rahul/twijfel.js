/* Bij twijfel doet Rahul NIETS. Dan vraagt hij door tot hij het honderd
   procent begrijpt.

   Waarom dit een eigen module is en niet één zinnetje in de prompt: een regel
   in een prompt is een verzoek. Juist bij twijfel is een model geneigd om
   alsnog iets te doen -- het "helpt" liever dan dat het een vraag stelt, en
   een half begrepen opdracht ziet er van binnen precies hetzelfde uit als een
   goed begrepen opdracht. Daarom staat de regel hier twee keer:

   1. als TWIJFELREGELS in de system prompt en in de doe-lus;
   2. als gedragsrem in de tool-lus (kern/stuur/lus.js): de tool `doe` heeft een
      verplicht veld `zeker`. Zet het model dat niet op true, dan wordt de
      actie niet voorgesteld en krijgt het model een antwoord terug dat het
      eerst moet vragen. Zo is "ik weet het zeker" een expliciete daad in
   plaats van een aanname. Dit is geen beveiligingsbesluit: de server-allowlist
   en de aparte menselijke bevestiging blijven de echte autorisatiegrens.

   Het verschil in de praktijk: "boek een taxi" zonder tijd, zonder bestemming
   en zonder te weten voor wie, is geen opdracht maar een begin van een
   gesprek. Doorvragen kost tien seconden; een verkeerd geboekte taxi kost
   geld, tijd en vertrouwen. */

const TWIJFELREGELS = [
  'BIJ TWIJFEL DOE JE NIETS. Twijfel je ook maar een beetje over wat er gevraagd wordt, over welke ' +
  'van meerdere dingen bedoeld is, over een tijd, een bedrag, een plek, een datum of over voor wie ' +
  'iets is, dan voer je NIETS uit. Je stelt dan een vraag. En nog een, als het nodig is, tot je het ' +
  'honderd procent begrijpt. Pas dan doe je iets.',

  'Vraag kort en concreet, en hooguit twee dingen tegelijk. Vraag alleen naar wat je echt nog nodig ' +
  'hebt om te handelen; ga niet alles nalopen wat je al weet. Kun je het antwoord zelf uit de gegevens ' +
  'halen die je al hebt, dan vraag je het niet.',

  'Doorvragen is nooit een teken dat je het niet snapt en je verontschuldigt je er dus ook niet voor. ' +
  'Je zegt gewoon wat je nog wilt weten. Een gokje dat toevallig goed uitpakt is slechter dan een ' +
  'vraag, want de volgende keer pakt het gokje verkeerd uit.',

  'Een uitzondering is er niet, ook niet als iemand haast heeft of aandringt. Bij haast vraag je ' +
  'sneller en korter, maar je vraagt.'
];

/* Het antwoord dat de tool-lus teruggeeft als het model iets wil doen zonder
   zichzelf zeker te verklaren. Dat is geen fout maar een aanwijzing: dit is
   het moment om te vragen, niet om te doen. */
const POORT_ANTWOORD = {
  gedaan: false,
  vraagEerst: true,
  uitleg: 'Niet uitgevoerd: je hebt niet aangegeven dat je het zeker weet. Stel eerst een korte, ' +
    'concrete vraag aan de gebruiker over wat je nog niet weet, en voer de actie pas uit als het ' +
    'antwoord er is. Zet dan zeker=true en zet in "begrepen" in een zin wat je gaat doen.'
};

/* De controle zelf. `zeker` moet expliciet true zijn EN er moet in "begrepen"
   staan wat de bedoeling is; dat tweede voorkomt dat zeker=true een reflex
   wordt die overal wordt meegestuurd. */
function magDoen(invoer) {
  const i = invoer || {};
  if (i.zeker !== true) return { ok: false, ...POORT_ANTWOORD };
  const begrepen = String(i.begrepen || '').trim();
  if (begrepen.length < 8) {
    return { ok: false, gedaan: false, vraagEerst: true,
      uitleg: 'Niet uitgevoerd: zet in "begrepen" in een korte zin wat je precies gaat doen en voor wie. ' +
        'Kun je dat niet opschrijven, dan weet je het nog niet zeker genoeg en hoor je te vragen.' };
  }
  return { ok: true };
}

module.exports = { TWIJFELREGELS, POORT_ANTWOORD, magDoen };
