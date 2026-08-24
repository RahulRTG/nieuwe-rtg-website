/* DE CONTROLERONDE -- de knop "Controleer", en de eerlijkheid die eronder hoort.

   WAT EEN PROEF HIER IS. Een controle die het ding werkelijk UITVOERT en kijkt
   wat eruit komt: een sonderonde die aanklopt, een hashketen die opnieuw wordt
   nagerekend, een gegevensscan die opnieuw loopt, een back-upmap die opnieuw
   wordt opengemaakt. Niet: een waarde uit een tabel lezen die er toch al stond.

   EN HET BELANGRIJKSTE: VOOR DE MEESTE DIENSTEN BESTAAT ZO'N PROEF NIET, EN DAN
   ZEGT DEZE RONDE DAT. Betalen bewijzen betekent betalen. Een boeking bewijzen
   betekent boeken. Dit huis doet dat niet met het geld of de reis van een lid om
   een scherm groen te krijgen -- CLAUDE.md verbiedt zelfs de suggestie dat een
   boeking verwerkt zou zijn. Een controleronde op zo'n vermogen levert daarom
   `bewijzend: false` op, en het vermogen komt niet hoger dan wat de meting al
   zei. Dat is de hele reden dat dit bestand een eigen kop heeft: de verleiding
   is om "gecontroleerd" te schrijven op een ronde die niets heeft gedaan.

   ELKE CONTROLE VANGT ZIJN EIGEN STORING. Een proef die zelf omvalt, meldt dat
   als bevinding; hij laat de ronde niet klappen. Anders is de uitslag van een
   half gelukte ronde "er ging iets mis" in plaats van "twee van de drie klopten
   en de derde kon niet draaien". */
'use strict';

const klok = require('../../lib/klok');

/* Per bron: is er iets te DOEN, en bewijst dat wat? `bewijst: false` betekent
   niet "onbelangrijk" maar "dit verandert de bewijsgraad niet". */
const PROEVEN = {
  sonde: { wat: 'de reizen uit SLO.json aflopen en kijken wat er terugkomt', bewijst: true },
  journaal: { wat: 'de hashketen van het journaal opnieuw narekenen', bewijst: true },
  kwaliteit: { wat: 'de gegevens opnieuw scannen op wezen en dubbele sleutels', bewijst: true },
  backup: { wat: 'de laatste dagback-up opnieuw opendoen en natellen', bewijst: true },
  meting: { bewijst: false,
    waarom: 'verkeer is niet na te bootsen zonder het te veroorzaken. Een nepverzoek van onszelf zou ' +
      'de teller vullen die we daarna aflezen, en dan meet dit scherm zijn eigen knop.' },
  schakelaars: { bewijst: false,
    waarom: 'een schakelaar uitlezen is geen proef: hij zegt dat de deur open staat, niet dat er ' +
      'iemand achter zit.' },
  slo: { bewijst: false,
    waarom: 'de servicedoelen rekenen over een venster dat er al is; er valt niets te draaien dat het ' +
      'venster eerlijk verandert.' }
};

async function draaiProef(v, { sonde, journaal, kwaliteit, backup, dataDir }) {
  const gedaan = [], nietGedaan = [], bevindingen = [];

  const doe = async (bron, werk) => {
    const p = PROEVEN[bron];
    if (!p || !p.bewijst) {
      nietGedaan.push({ bron, waarom: (p && p.waarom) || 'voor deze bron bestaat geen controle' });
      return;
    }
    try {
      const r = await werk();
      gedaan.push({ bron, wat: p.wat, uitslag: r.zin });
      if (!r.goed) bevindingen.push({ bron, wat: r.zin });
    } catch (e) {
      /* Een proef die niet kon draaien is GEEN geslaagde proef, en ook geen
         bewijs van een storing. Hij is een bevinding op zichzelf. */
      gedaan.push({ bron, wat: p.wat, uitslag: 'kon niet draaien: ' + e.message });
      bevindingen.push({ bron, wat: 'deze controle kon niet draaien (' + e.message + ')' });
    }
  };

  for (const bron of v.bronnen) {
    if (bron === 'sonde') await doe('sonde', async () => {
      const r = await sonde.draai({});
      if (r && r.error) throw new Error(r.error);
      return { goed: r.gelukt === r.van_totaal,
        zin: r.gelukt + ' van ' + r.van_totaal + ' reizen gelukt, gemeten van ' + r.van };
    });
    else if (bron === 'journaal') await doe('journaal', () => {
      const c = journaal.controleer();
      return { goed: !!c.heel, zin: c.heel ? 'de keten is heel over ' + c.regels + ' regels'
        : 'de keten breekt bij ' + c.bij + ': ' + c.waarom };
    });
    else if (bron === 'kwaliteit') await doe('kwaliteit', () => {
      const k = kwaliteit.meet();
      return { goed: !k.tel.defecten, zin: k.tel.defecten + ' harde defecten over ' + k.gemeten.objecten + ' objecten' };
    });
    else if (bron === 'backup') await doe('backup', () => {
      const b = backup.lees(dataDir);
      if (!b.er) return { goed: false, zin: b.reden };
      const mankeert = Array.isArray(b.mankeert) ? b.mankeert : (b.mankeert ? [b.mankeert] : []);
      return { goed: !mankeert.length,
        zin: mankeert.length ? 'de back-up van ' + b.dag + ' mankeert: ' + mankeert.slice(0, 3).join('; ')
          : 'de back-up van ' + b.dag + ' is compleet' };
    });
    else await doe(bron, null);
  }

  const bewijzend = gedaan.length > 0;
  const uitslag = !bewijzend
    ? 'niets gecontroleerd: voor dit vermogen bestaat geen proef die het echt uitvoert'
    : bevindingen.length ? bevindingen.length + ' ding(en) gevonden' : 'alles klopt';

  return { gedaan, nietGedaan, bevindingen, bewijzend, uitslag };
}

/* ---------- de gedraaide proef als BEWIJSSTUK ----------
   Een proef is het enige dat een vermogen op `bewezen` kan krijgen, en alleen
   als hij BEWIJZEND was. En hij verloopt: buiten zijn houdbaarheid levert hij
   geen oordeel meer, maar "moet opnieuw worden vastgesteld" met de datum van de
   vorige ronde erbij. Niet rood -- onbekend. Vervallen bewijs is geen bewijs,
   en dat is iets anders dan een storing. */
function vanProef(v, p) {
  if (!p) return null;
  const uren = (klok.nu() - Date.parse(p.at)) / 3600000;
  if (uren > v.proefHoudbaarUren) {
    return { bron: 'proef', graad: 'onbekend', oordeel: null, at: p.at, moetOpnieuw: true,
      vervallen: { was: p.bewijzend ? 'bewezen' : 'gemeten', urenOud: Math.round(uren),
        houdbaarUren: v.proefHoudbaarUren },
      zin: 'de laatste controleronde is van ' + String(p.at).slice(0, 16).replace('T', ' ') + ', ' +
        Math.round(uren) + ' uur oud; de houdbaarheid is ' + v.proefHoudbaarUren + ' uur',
      zegtNiet: 'Vervallen bewijs is geen bewijs. Dit zegt niet dat er iets stuk is; het zegt dat we ' +
        'het nu niet weten.' };
  }
  /* EEN RONDE DIE NIETS UITVOERDE, OORDEELT NIET. Dit stond er eerst wél, en
     het gaf precies de leugen waar deze hele laag tegen is: op een verse server
     zette een controleronde op "betalen" -- die niets kón doen -- dat vermogen
     van "niet vast te stellen" op "in orde". Een knop die groen maakt door hem
     in te drukken. De ronde blijft staan als GEBEURTENIS (er is op iemands naam
     gekeken, met een datum), maar zonder oordeel en zonder graad. */
  if (!p.bewijzend) {
    return { bron: 'proef', graad: 'onbekend', oordeel: null, at: p.at, door: p.door,
      getallen: { gedaan: 0, nietGedaan: p.nietGedaan.length },
      zin: 'er is op ' + String(p.at).slice(0, 16).replace('T', ' ') + ' een controleronde gevraagd door ' +
        p.door + ', en die kon niets uitvoeren',
      zegtNiet: 'Voor dit vermogen bestaat geen proef die het echt doet. Deze regel zegt dat er is ' +
        'gekeken, en niets over of het werkt.' };
  }
  return { bron: 'proef', graad: 'bewezen', at: p.at, door: p.door,
    oordeel: p.bevindingen.length ? 'let op' : 'in orde',
    getallen: { gedaan: p.gedaan.length, nietGedaan: p.nietGedaan.length, bevindingen: p.bevindingen.length },
    zin: p.uitslag + ' (' + p.gedaan.length + ' controle(s) door ' + p.door + ')',
    zegtNiet: 'Een proef bewijst wat hij heeft gedaan en niets daarbuiten.' };
}

module.exports = { PROEVEN, draaiProef, vanProef };
