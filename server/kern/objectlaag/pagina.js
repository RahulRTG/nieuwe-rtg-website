/* De objectlaag, deelbestand "pagina": DE OBJECTPAGINASTRUCTUUR.

   MAATSTAF.md U28: elke objectpagina draagt dezelfde structuur. Dat stond er als
   besluit, en de gemakkelijke uitvoering was geweest: schrijf de secties op in
   ONTWERP.md en tel achteraf hoeveel schermen zich eraan houden. Dat is een
   belofte met een meter erachter, en dit huis heeft geleerd wat daarmee gebeurt
   (PLATFORM.md: zeventien app-beschrijvingen beloofden functies zonder route).

   DAAROM IS DE STRUCTUUR HIER GEEN AFSPRAAK MAAR EEN SAMENSTELLING. Een scherm
   vraagt niet om een object en tekent er tien blokken omheen; het vraagt om de
   PAGINA, en die komt terug met alle tien secties, altijd in dezelfde volgorde,
   gevuld door BIJDRAGERS die zich per soort aanmelden. Een capability die
   morgen iets nieuws weet over een event, meldt zich aan als bijdrager en staat
   op elke eventpagina -- zonder dat er één scherm verandert.

   ================== VIER DINGEN DIE HIER VASTLIGGEN ==================

   1. VERBERGEN BESTAAT NIET (ADAPTIEF.md). Een sectie zonder inhoud verdwijnt
      niet; hij komt terug met een STAND die zegt waarom. `leeg` (er is hier
      niets over dit ding) is iets anders dan `nietGevraagd` (voor deze soort
      heeft niemand zich aangemeld), en dat verschil is precies wat je wil zien:
      het eerste is een feit over het object, het tweede een gat in het platform.
      Een structuur die haar eigen gaten wegvouwt, meet zichzelf nooit.

   2. ELKE BIJDRAGE DRAAGT EEN BRON EN EEN BEWIJSGRAAD (BESTUUR.md). Een regel
      op een objectpagina is een bewering, en dit huis toont geen bewering
      zonder te zeggen hoe hard zij is. `vermoed` en `gemeten` zien er dus
      anders uit, en dat begint hier en niet in de CSS.

   3. DE PAGINA BEZIT NIETS, net als de objectlaag eromheen (zie ./index.js
      regel 1). Er is geen opslag en geen schrijffunctie. Een bijdrager LEEST
      zijn eigen domein; wat hij teruggeeft is een projectie.

   4. DE SECTIES STAAN VAST EN ZIJN MET TIEN. Een eenendertigste sectie is geen
      uitbreiding maar het einde van de structuur -- dan heeft elk scherm weer
      zijn eigen indeling. Wie iets nieuws wil tonen, meldt een BIJDRAGER aan in
      een bestaande sectie. */
'use strict';

/* De tien secties, in de volgorde waarin ze op elk scherm staan. De VRAAG per
   sectie staat erbij en niet alleen de naam: een sectie waarvan niemand meer
   weet welke vraag hij beantwoordt, vult zich vanzelf met wat er toevallig
   voorhanden is. */
const SECTIES = [
  { id: 'samenvatting', naam: 'Samenvatting', vraag: 'Wat is dit, in één zin?' },
  { id: 'status', naam: 'Status', vraag: 'Waar staat het nu?' },
  { id: 'volgende', naam: 'Volgende actie', vraag: 'Wat kan of moet er nu gebeuren, en door wie?' },
  { id: 'tijdlijn', naam: 'Tijdlijn', vraag: 'Wat is er gebeurd, in welke volgorde?' },
  { id: 'betrokkenen', naam: 'Betrokkenen', vraag: 'Wie hebben hiermee te maken?' },
  { id: 'geld', naam: 'Geld', vraag: 'Wat kost het, wie betaalt, wat staat open?' },
  { id: 'documenten', naam: 'Documenten', vraag: 'Welke stukken horen erbij?' },
  { id: 'bewijs', naam: 'Bewijs', vraag: 'Waarop rust wat hier staat?' },
  { id: 'rechten', naam: 'Rechten', vraag: 'Wat mag ik hiermee, en wat mag een ander?' },
  { id: 'probleem', naam: 'Probleem oplossen', vraag: 'Het klopt niet -- waar ga ik heen?' }
];
const SECTIE_IDS = SECTIES.map(s => s.id);

/* De bewijsgraden van BESTUUR.md. `onbekend` is de veilige val: een bijdrager
   die niets zegt over de hardheid van zijn regel, krijgt hem niet cadeau. */
const GRADEN = ['onbekend', 'vermoed', 'gemeten', 'bewezen'];

function maakPagina({ objectlaag, bijdragers }) {
  const lijst = (bijdragers || []).map((b, i) => {
    for (const eis of ['id', 'sectie', 'voor', 'lever']) {
      if (!b[eis]) throw new Error('objectpagina: bijdrager ' + (b.id || i) + ' mist "' + eis + '"');
    }
    if (!SECTIE_IDS.includes(b.sectie))
      throw new Error('objectpagina: bijdrager ' + b.id + ' noemt sectie "' + b.sectie + '", en die bestaat niet');
    return b;
  });

  /* Welke bijdragers zich voor deze soort hebben aangemeld. */
  const voorSoort = (soort) => lijst.filter(b => b.voor.includes(soort) || b.voor.includes('*'));

  function pagina(key, soort, id) {
    const obj = objectlaag.object(key, soort, id);
    if (!obj) return null;
    const mee = voorSoort(soort);
    const secties = SECTIES.map(s => {
      const hier = mee.filter(b => b.sectie === s.id);
      if (!hier.length) {
        /* PUNT 1: dit is een gat in het platform en geen leegte in het object.
           Het staat er dus, met de soort erbij, zodat het te tellen is. */
        return Object.assign({}, s, { stand: 'nietGevraagd', bijdragen: [],
          uitleg: 'voor de soort "' + soort + '" heeft nog niemand zich voor deze sectie aangemeld' });
      }
      const bijdragen = [];
      for (const b of hier) {
        let uit;
        /* Een bijdrager die klapt, mag de pagina niet meenemen: dan verdwijnen
           negen goede secties door één stukke lezer. Hij wordt een STORING in
           zijn eigen sectie, zichtbaar en met naam. */
        try { uit = b.lever(obj, { key }); } catch (e) {
          bijdragen.push({ door: b.id, storing: String((e && e.message) || e), graad: 'onbekend' });
          continue;
        }
        for (const r of [].concat(uit || [])) {
          if (!r) continue;
          bijdragen.push({
            door: b.id,
            tekst: String(r.tekst || '').slice(0, 400),
            naar: r.naar || null,
            bron: r.bron || b.bron || null,
            graad: GRADEN.includes(r.graad) ? r.graad : 'onbekend',
            op: r.op || null
          });
        }
      }
      return Object.assign({}, s, {
        stand: bijdragen.length ? 'gevuld' : 'leeg',
        bijdragen,
        uitleg: bijdragen.length ? null : 'er is hier niets over dit ' + soort + ' bekend'
      });
    });
    return {
      ok: true, soort, id: obj.id, titel: obj.titel,
      secties,
      telling: {
        gevuld: secties.filter(s => s.stand === 'gevuld').length,
        leeg: secties.filter(s => s.stand === 'leeg').length,
        nietGevraagd: secties.filter(s => s.stand === 'nietGevraagd').length
      }
    };
  }

  return { pagina, SECTIES, GRADEN, bijdragers: lijst.map(b => ({ id: b.id, sectie: b.sectie, voor: b.voor })) };
}

module.exports = { maakPagina, SECTIES, SECTIE_IDS, GRADEN };
