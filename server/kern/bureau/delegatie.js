/* Het Privekantoor, deelbestand "delegatie": hoeveel mag het kantoor zelf?

   Dit is het scharnier van het hele product. Een privekantoor dat voor alles
   toestemming moet vragen is een duurdere manier om zelf alles te regelen; een
   kantoor dat alles zelf mag is een blanco cheque. Wat ertussen zit is geen
   gevoel maar een instelling, en die staat hier.

   VIJF NIVEAUS, per domein apart in te stellen:

     L0  informeren        wij vertellen het u, verder niets
     L1  aanbevelen        wij zeggen wat wij zouden doen
     L2  voorbereiden      wij regelen alles tot de handtekening; u tekent
     L3  uitvoeren         wij doen het, binnen uw grens, en melden het vooraf
     L4  autonoom          routine gaat vanzelf; u leest het in het logboek

   En daarbij een GRENS in euro's per domein. "Onderhoud aan mijn auto's tot
   EUR 2.500 zonder mij lastig te vallen" is L3 met een grens van 250.000 cent.
   Een auto van drie ton valt daar niet onder en wordt dus een beslissing, ook
   al staat het domein op L3. Het niveau zegt WAT wij mogen, de grens zegt HOE
   VER.

   HET DAK IS NIET INSTELBAAR. Elk domein heeft een maximum dat het lid niet kan
   ophogen, ook niet als het dat zelf wil. Gezondheid komt niet boven "aanbevelen"
   en de nalatenschap niet boven "informeren". Dat is geen betutteling maar de
   merkregel uit CLAUDE.md, hard gemaakt: de AI mag nooit zelf toegang of een
   toezegging verlenen, en over deze twee onderwerpen beslist een mens -- het lid
   -- altijd zelf.

   Het dak wordt bij LEZEN toegepast en niet alleen bij schrijven. Dat is met
   opzet: zou een dak later omlaag gaan, dan is een eerder opgeslagen L4 vanaf dat
   moment meteen begrensd, in plaats van stil te blijven gelden tot iemand het
   veld nog eens opslaat. Regel 1 van de lat -- de oorzaak zit in de waarde die
   wordt gebruikt, niet in de waarde die ooit is ingevoerd.

   Gemount via ./index.js. */
'use strict';

const NIVEAUS = [
  { n: 0, sleutel: 'informeren', label: 'Alleen informeren', uitleg: 'Wij houden u op de hoogte en doen verder niets.' },
  { n: 1, sleutel: 'aanbevelen', label: 'Aanbevelen', uitleg: 'Wij zeggen wat wij zouden doen; u doet het.' },
  { n: 2, sleutel: 'voorbereiden', label: 'Voorbereiden', uitleg: 'Wij regelen alles tot uw akkoord; u tekent.' },
  { n: 3, sleutel: 'uitvoeren', label: 'Uitvoeren binnen uw grens', uitleg: 'Wij voeren uit tot uw bedrag en melden het vooraf.' },
  { n: 4, sleutel: 'autonoom', label: 'Autonoom bij routine', uitleg: 'Routine loopt door; u leest het terug in het logboek.' }
];

/* De domeinen, met hun dak. De volgorde is die van het instelscherm: van wat je
   het makkelijkst uit handen geeft naar wat je nooit uit handen geeft. */
const DOMEINEN = [
  { id: 'huishouden', naam: 'Huis en huishouden', dak: 4 },
  { id: 'vervoer', naam: 'Vervoer en onderhoud', dak: 4 },
  { id: 'kring', naam: 'Relaties en attenties', dak: 4 },
  { id: 'reizen', naam: 'Reizen', dak: 3 },
  { id: 'gelegenheden', naam: 'Gelegenheden en gasten', dak: 3 },
  { id: 'gezelschap', naam: 'Gezelschap en staf', dak: 3 },
  { id: 'collectie', naam: 'Collecties', dak: 3 },
  { id: 'filantropie', naam: 'Filantropie', dak: 2 },
  { id: 'vermogen', naam: 'Vermogen', dak: 2 },
  { id: 'gezondheid', naam: 'Gezondheid', dak: 1 },
  { id: 'nalatenschap', naam: 'Nalatenschap', dak: 0 }
];
const DOMEIN = new Map(DOMEINEN.map(d => [d.id, d]));

/* Standaard staat alles op voorbereiden zonder grens. Een vers kantoor doet dus
   NIETS zonder akkoord. Dat is de veilige kant om op te beginnen: vertrouwen
   wordt gegeven, niet aangenomen. */
const STANDAARD_NIVEAU = 2;
// tien miljoen euro; een grens hoger dan dit is een typefout, geen wens
const GRENS_PLAFOND = 1000000000;

module.exports = (ctx) => {
  const { db, save, nu } = ctx;

  function D(key) {
    if (!db.data.lifestyle) db.data.lifestyle = {};
    if (!db.data.lifestyle[key]) db.data.lifestyle[key] = {};
    const l = db.data.lifestyle[key];
    if (!l.delegatie || typeof l.delegatie !== 'object') l.delegatie = { per: {}, log: [] };
    if (!l.delegatie.per || typeof l.delegatie.per !== 'object') l.delegatie.per = {};
    if (!Array.isArray(l.delegatie.log)) l.delegatie.log = [];
    return l.delegatie;
  }

  /* De geldende stand van een domein: opgeslagen waarde, teruggebracht tot het
     dak. Dit is de enige functie die de rest mag gebruiken -- wie zelf in
     `per[domein]` kijkt, kijkt langs het dak heen. */
  function standVan(d, domein) {
    const def = DOMEIN.get(domein);
    if (!def) return null;
    const opg = (d.per || {})[domein] || {};
    const gewenst = Number.isFinite(opg.niveau) ? opg.niveau : STANDAARD_NIVEAU;
    const niveau = Math.max(0, Math.min(def.dak, gewenst));
    return {
      domein,
      naam: def.naam,
      niveau,
      dak: def.dak,
      // zichtbaar maken WAAROM iets lager staat dan ingesteld; anders lijkt het
      // scherm de invoer van het lid te negeren
      begrensd: gewenst > def.dak,
      grensCenten: Math.max(0, Math.min(GRENS_PLAFOND, Math.round(Number(opg.grensCenten) || 0))),
      op: opg.op || ''
    };
  }

  function delegatie(key) {
    const d = D(key);
    return {
      status: 200,
      domeinen: DOMEINEN.map(x => standVan(d, x.id)),
      niveaus: NIVEAUS,
      log: d.log.slice(0, 40)
    };
  }

  function delegatieZet(key, b) {
    const def = DOMEIN.get(String(b.domein || ''));
    if (!def) return { status: 400, error: 'Onbekend domein.' };
    const gevraagd = Math.round(Number(b.niveau));
    if (!Number.isFinite(gevraagd) || gevraagd < 0 || gevraagd > 4) return { status: 400, error: 'Kies een niveau van 0 tot 4.' };
    if (gevraagd > def.dak) {
      return { status: 400, error: 'Voor ' + def.naam.toLowerCase() + ' gaat het niet verder dan "' +
        NIVEAUS[def.dak].label + '". Over dit onderwerp beslist u zelf.' };
    }
    const d = D(key);
    const grens = Math.max(0, Math.min(GRENS_PLAFOND, Math.round(Number(b.grensCenten) || 0)));
    const oud = standVan(d, def.id);
    d.per[def.id] = { niveau: gevraagd, grensCenten: grens, op: nu() };
    /* Een delegatiewijziging is geen voorkeurtje: hij bepaalt wat er de volgende
       maand zonder uw handtekening gebeurt. Dus staat hij in een logboek dat het
       lid kan teruglezen, met de oude stand erbij. */
    d.log.unshift({ op: nu(), domein: def.id, naam: def.naam,
      van: oud.niveau, naar: gevraagd, grensVan: oud.grensCenten, grensNaar: grens });
    if (d.log.length > 200) d.log.length = 200;
    save();
    return { status: 200, ok: true, stand: standVan(d, def.id) };
  }

  /* HET OORDEEL. Elke case loopt hierlangs, en het antwoord bepaalt of er een
     handtekening nodig is. Eén plek, zodat de regel niet per soort verzoek
     opnieuw wordt bedacht. */
  function beoordeel(key, domein, centen) {
    const d = D(key);
    const st = standVan(d, domein);
    if (!st) return { niveau: STANDAARD_NIVEAU, magZelf: false, reden: 'Onbekend domein: wij vragen u om akkoord.' };
    const bedrag = Math.max(0, Math.round(Number(centen) || 0));
    const eur = c => '€ ' + Math.round(c / 100).toLocaleString('nl-NL');

    if (st.niveau <= 1) {
      return { niveau: st.niveau, grensCenten: st.grensCenten, magZelf: false, meldVooraf: false,
        reden: st.niveau === 0
          ? 'U wilt over ' + st.naam.toLowerCase() + ' alleen geïnformeerd worden.'
          : 'Over ' + st.naam.toLowerCase() + ' doen wij een aanbeveling; u beslist.' };
    }
    if (st.niveau === 2) {
      return { niveau: 2, grensCenten: st.grensCenten, magZelf: false, meldVooraf: false,
        reden: 'Wij bereiden het voor en leggen het u ter goedkeuring voor.' };
    }
    if (bedrag > st.grensCenten) {
      return { niveau: st.niveau, grensCenten: st.grensCenten, magZelf: false, meldVooraf: false,
        reden: 'Dit is ' + eur(bedrag) + ' en uw grens voor ' + st.naam.toLowerCase() + ' is ' +
          eur(st.grensCenten) + '. Wij vragen u om akkoord.' };
    }
    return { niveau: st.niveau, grensCenten: st.grensCenten, magZelf: true, meldVooraf: st.niveau === 3,
      reden: st.niveau === 3
        ? 'Binnen uw grens van ' + eur(st.grensCenten) + '. Wij melden het u en voeren uit.'
        : 'Routine binnen uw grens van ' + eur(st.grensCenten) + '. U leest het terug in het logboek.' };
  }

  return { delegatie, delegatieZet, beoordeel, delegatieStand: (key, dom) => standVan(D(key), dom),
    DELEGATIE_DOMEINEN: DOMEINEN, DELEGATIE_NIVEAUS: NIVEAUS };
};
