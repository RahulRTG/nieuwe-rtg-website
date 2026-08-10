/* Spellen (deelmodule): DE NABESPREKING -- Rahul kijkt een afgelopen partij terug.

   TWEE DEUREN DIE ELKAAR NIET MOGEN RAKEN, en dat is de hele reden dat dit een
   eigen bestand is.

   Deur 1 is `./rahul.js`, het spelmaatje TIJDENS het potje. Die krijgt bewust
   alleen het spel, wie aan zet is en jouw vraag -- niet het bord en niet iemands
   hand. Hij KAN dus niet verklappen, en dat is een eigenschap van de code en
   niet van de prompt. Die deur verandert hier niet, in geen enkel opzicht.

   Deur 2 is deze: de nabespreking. Die leest het VERLOOP van de partij
   (./zetten.js) en ziet daarmee alles -- elke zet, van beide kanten, ook wat op
   dat moment verborgen was. Dat is precies wat een nabespreking nuttig maakt en
   precies wat hem tijdens het spelen onaanvaardbaar zou maken.

   DE REGEL DIE DIE TWEE UIT ELKAAR HOUDT: DEZE DEUR WEIGERT EEN LOPEND POTJE.
   Niet "we vragen hem geen hints te geven" en niet "de prompt zegt dat het niet
   mag" -- een harde weigering op de status. Een prompt-instructie is niet te
   toetsen; deze weigering is dat wel, met een mutatie: haal hem weg en de toets
   zakt. Zonder die regel is de nabespreking de kortste weg om tijdens je eigen
   partij het hele bord aan een AI voor te leggen.

   WIE HEM MAG OPVRAGEN staat niet hier maar in `spelReplay`: alleen wie
   meespeelde. Een kijker of een toernooigenoot krijgt niets, ook al mocht hij
   live meekijken. Die controle hoort bij het verloop en niet bij dit scherm --
   twee plekken die dezelfde vraag beantwoorden lopen uiteen.

   ONDER DE PROGRESSIEGRENS MAG DIT GEWOON, om dezelfde reden als de replay
   zelf: je eigen partij nabespreken telt niets op en vergelijkt niets met
   niemand. Er wordt ook niets van bewaard -- het antwoord komt uit het verloop
   dat er al is, en verdwijnt met dat verloop mee (dertig dagen).

   WAT RAHUL KRIJGT is de ZETTENLIJST ZOALS HIJ IS OPGESLAGEN, plus de uitslag.
   Het platform legt hem niet uit wat een zet betekent, want dat weet het niet:
   `zetten.js` slaat een zet op zoals hij binnenkwam, zonder spelkennis. Voor
   schaken is dat genoeg om over te praten (van-veld, naar-veld, om de beurt);
   voor een spel waar dat niet genoeg is, hoort dat spel later een eigen
   `gebeurtenis()` te leveren (zie GAMEHALL.md par. 11). Wat er NIET gebeurt is
   dat deze laag schaakkennis krijgt -- dan staat er een spelnaam in het
   platform, en dat is precies wat het register heeft opgeruimd.

   ZONDER API-SLEUTEL geeft dezelfde ingang een vaste, narekenbare samenvatting:
   hoeveel zetten, wie won, hoeveel zetten van jou. Dat is smal en het is waar;
   analyse verzinnen die er niet is zou erger zijn dan niets zeggen. */
module.exports = (ctx) => {
  const { S, SOORTEN, codenaamVan, anthropic, spelReplay, _KENNIS } = ctx;
  const { rahulLeadVoor } = require('../rahul');

  const MAX_ZETTEN_MEE = 120;   // wat er aan Rahul wordt voorgelegd

  async function spelNabespreking(mij, id, vraag) {
    /* DE REGEL. Een lopend potje staat altijd in `S().potjes` met status
       'bezig'; staat het er niet meer, dan is het afgelopen en opgeruimd -- het
       verloop leeft dertig dagen en overleeft het potje dus ruim. */
    const p = S().potjes[String(id || '')];
    if (p && p.status !== 'klaar')
      return { status: 409, error: 'Een partij bespreek je na afloop. Tijdens het spelen kun je Rahul om een hint vragen.' };

    // wie hem mag zien staat in het verloop zelf: alleen wie meespeelde
    const verloop = spelReplay(mij, id);
    if (verloop.error) return verloop;

    const soort = verloop.soort;
    const naam = SOORTEN[soort] || soort;
    const ik = verloop.spelers.indexOf(codenaamVan(mij));
    const mijnZetten = verloop.zetten.filter(z => z.speler === ik).length;
    const uitslag = p ? (p.gelijk ? 'gelijkspel' : (p.winnaar ? 'gewonnen door ' + p.winnaar : 'geen uitslag vastgelegd'))
      : 'de partij is opgeruimd; alleen het verloop is er nog';

    /* De kale samenvatting is de basis EN het vangnet: hij klopt altijd, ook
       zonder sleutel, en hij bevat niets wat we niet echt weten. */
    const samenvatting = naam + ': ' + verloop.zetten.length + ' zetten' +
      (verloop.afgekapt ? ' (het begin is afgekapt)' : '') +
      ', waarvan ' + mijnZetten + ' van jou. Uitslag: ' + uitslag + '.';

    const q = String(vraag || '').trim().slice(0, 300);
    if (anthropic) {
      try {
        /* Alleen de LAATSTE zetten gaan mee als er veel zijn: het eind van een
           partij is interessanter dan het begin, dezelfde afweging als de
           afkapping in zetten.js. Dat het is ingekort staat erbij, want een
           analyse van een half verloop die zich voordoet als het geheel is een
           bewering die niet klopt. */
        const mee = verloop.zetten.slice(-MAX_ZETTEN_MEE);
        const ingekort = mee.length < verloop.zetten.length;
        const regels = mee.map((z, i) => (verloop.zetten.length - mee.length + i + 1) + '. ' +
          (z.speler === ik ? 'jij' : 'tegenstander') + ': ' + JSON.stringify(z.zet)).join('\n');
        const kennis = (_KENNIS && _KENNIS[soort]) || null;
        const res = await anthropic.messages.create({
          model: 'claude-sonnet-5', max_tokens: 420,
          system: rahulLeadVoor(mij) + 'je bespreekt een AFGELOPEN partij ' + naam + ' na met de speler. ' +
            (kennis ? kennis.uitleg + ' ' : '') +
            'Je krijgt het echte verloop, dus je mag er inhoudelijk op ingaan. Drie regels: ' +
            '(1) verwijs naar CONCRETE zetnummers, zodat hij kan nakijken waar je het over hebt; ' +
            '(2) verzin niets -- weet je iets niet zeker, zeg dat dan; ' +
            '(3) kort, warm en zonder oordeel over de speler. Geen cijfer, geen ranglijst, geen vergelijking met anderen.' +
            (ingekort ? ' LET OP: je ziet alleen de laatste ' + mee.length + ' zetten; zeg dat als het uitmaakt.' : ''),
          messages: [{ role: 'user', content: (q || 'Hoe ging deze partij?') + '\n\nUitslag: ' + uitslag + '\nVerloop:\n' + regels }]
        });
        const tekst = (res.content && res.content[0] && res.content[0].text) ? res.content[0].text : '';
        if (tekst) return { status: 200, ok: true, antwoord: tekst, samenvatting, zetten: verloop.zetten.length, afgekapt: !!verloop.afgekapt };
      } catch (e) { /* val terug op de kale samenvatting */ }
    }
    return { status: 200, ok: true, antwoord: samenvatting, samenvatting,
      zetten: verloop.zetten.length, afgekapt: !!verloop.afgekapt, demo: true };
  }

  return { spelNabespreking };
};
