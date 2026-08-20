/* School (deelmodule): het Attention OS -- een lijst per dag voor de leraar.

   Een schoolsysteem heeft de neiging om zevenenvijftig meldingen te maken uit
   vijf hoeken van zichzelf, en dan is de optelsom onbruikbaar: alles is even
   belangrijk, dus niets. Hier staat er een lijst, in drie bakken:

     nu          -- er wacht een mens, en het kan niet tot morgen;
     vandaag     -- voor het eind van de dag;
     kan wachten -- het staat er, maar het loopt niet weg.

   De indeling komt uit een REGEL en niet uit een gevoel. Wat in "nu" staat,
   staat daar omdat een kind de hulplijn heeft gebruikt of omdat de klas vandaag
   nog niet is afgetekend -- niet omdat iets rood mag kleuren.

   Drie grenzen die deze lijst eerlijk houden:

   1. ER STAAT GEEN INHOUD OVER EEN KIND IN. Een regel zegt WAT er wacht en
      HOEVEEL, en wijst naar het scherm waar het hoort. Geen namen, geen tekst
      van een melding, geen cijfers. Een aandachtslijst die de noodkreet van een
      kind citeert, wordt gelezen door iedereen die over een schouder meekijkt.
   2. ER WORDT NIETS BEWAARD. Deze module krijgt geen save en schrijft niets:
      de lijst wordt telkens uitgerekend. Er is dus geen geschiedenis van hoe
      snel een leraar zijn lijst leegwerkt, en die kan er later ook niet
      stilletjes bij komen -- werkdruk is hulp en geen beoordeling.
   3. EEN SOORT IS EEN REGEL. Niet een regel per melding maar een regel per
      soort, met het aantal erbij. Twaalf niet-becijferde toetsen zijn een taak
      en geen twaalf taken. */
/* De tijd komt uit de tijdmachine en niet van het besturingssysteem: anders
   is dit bestand niet te beproeven op schrikkeldag, zomertijd of een verlopen
   termijn. Zie server/lib/klok.js. */
const { datum } = require('../lib/klok');
const MAX_PER_BAK = 6;

module.exports = (sctx) => {
  const { router, S, eigenVeld, klasVan, presentieLijst, rapporten } = sctx;
  const dag = () => datum().toISOString().slice(0, 10);

  /* Elke bron levert hoogstens EEN regel: wat, hoeveel, waarom, en waar het
     hoort. De volgorde binnen een bak is de volgorde hieronder; er wordt niet
     gesorteerd op zwaarte, want dan is de bovenste regel een oordeel. */
  function regels(k, sch) {
    const vandaag = dag();
    const hulp = (k.hulplijn || []).filter(m => m.status === 'open');
    const presentieVandaag = (presentieLijst && sch ? presentieLijst(sch) : [])
      .filter(p => p.klasCode === k.code && p.datum === vandaag).length;
    const nakijken = (k.toetsen || []).reduce((n, t) => n + Object.values(t.werk || {})
      .filter(w => w.klaar && !w.becijferd).length, 0);
    const deadlineVandaag = (k.huiswerk || []).filter(h => h.deadline === vandaag).length;
    const patronen = Object.values(k.patronen || {})
      .reduce((n, perDoel) => n + Object.values(perDoel).filter(r => r.aantal >= 3).length, 0);
    const leerlingen = (k.leerlingen || []).length;
    // rapporten hangen aan de SCHOOL en niet aan de klas; alleen die van deze klas tellen
    const concepten = (rapporten && sch ? rapporten(sch) : []).filter(r => r.klasCode === k.code && !r.vastgesteld).length;

    return {
      nu: [
        hulp.filter(m => m.acuut).length && { wat: 'De hulplijn staat open', aantal: hulp.filter(m => m.acuut).length,
          waarom: 'Een kind heeft zelf om hulp gevraagd en gaf aan dat het niet kan wachten.', waarheen: 'hulplijn' },
        (leerlingen && !presentieVandaag) && { wat: 'Vandaag is er nog geen presentie', aantal: 1,
          waarom: 'Zonder aftekening weet niemand wie er is, en dat is juist op een dag zelf nodig.', waarheen: 'presentie' }
      ],
      vandaag: [
        hulp.filter(m => !m.acuut).length && { wat: 'De hulplijn staat open', aantal: hulp.filter(m => !m.acuut).length,
          waarom: 'Een kind heeft om hulp gevraagd.', waarheen: 'hulplijn' },
        nakijken && { wat: 'Ingeleverd toetswerk zonder cijfer', aantal: nakijken,
          waarom: 'De leerling ziet de uitslag pas als u het cijfer heeft gegeven.', waarheen: 'toetsen' },
        deadlineVandaag && { wat: 'Huiswerk dat vandaag afloopt', aantal: deadlineVandaag,
          waarom: 'Vandaag is de dag die u er zelf bij hebt gezet.', waarheen: 'huiswerk' }
      ],
      kanWachten: [
        patronen && { wat: 'Denkpatronen die vaak langskwamen', aantal: patronen,
          waarom: 'Drie keer of vaker hetzelfde denken vraagt eerder om een korte uitleg dan om meer sommen.', waarheen: 'denkfout' },
        concepten && { wat: 'Rapporten in concept', aantal: concepten,
          waarom: 'Een concept gaat nergens heen tot u het vaststelt.', waarheen: 'rapport' }
      ]
    };
  }

  router.post('/school/aandacht', (req, res) => {
    const k = klasVan(req, res); if (!k) return;
    const sch = k.schoolCode ? eigenVeld(S(), k.schoolCode) : null;
    const r = regels(k, sch);
    const schoon = (rij) => rij.filter(Boolean).slice(0, MAX_PER_BAK);
    res.json({ ok: true, klas: { code: k.code, naam: k.naam },
      nu: schoon(r.nu), vandaag: schoon(r.vandaag), kanWachten: schoon(r.kanWachten),
      uitleg: 'Een regel per soort met het aantal erbij, en niets over een kind zelf. Dit is een werklijst; er wordt niet bijgehouden hoe snel u hem leeg heeft.' });
  });
};
