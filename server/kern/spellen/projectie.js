/* Spellen (deelmodule): DE PROJECTIEKAMER -- een potje op een gedeeld scherm.

   Zes mensen in een vakantiehuis, een televisie, en zes telefoons. Dat is waar
   30 Seconden voor gemaakt is, en het is precies het spel dat tot nu toe als
   enige NIET op een scherm kon (zie ./zicht.js).

   DE VRAAG DIE EERST BEANTWOORD MOET WORDEN IS: WAT IS DAT SCHERM? Een lid met
   een sessie? Dan staat er een ingelogd RTG-account op een televisie in een
   vakantiehuis of een hotellobby, en blijft dat daar staan. Het antwoord is
   nee, en dat is de hele opzet van dit bestand:

     EEN SCHERM IS EEN PROJECTIE, GEEN DEELNEMER.

   Het heeft geen sessie, geen sleutel en geen identiteit. Het krijgt uitsluitend
   `zicht.publiek(p, st)` en het kan NIETS terugsturen -- geen zet, geen chat,
   geen antwoord. Er is dus ook niets te stelen: wie de code heeft, ziet wat
   iedereen in de kamer toch al ziet.

   Dat sluit de 30 Seconden-lekkage STRUCTUREEL. De kaart zit niet in de laag
   die een scherm ontvangt, dus het kan hem niet krijgen -- dat is iets anders
   dan hem niet sturen. Een spel zonder `zicht.publiek` heeft hier helemaal
   geen kamer; Proost bijvoorbeeld niet, en met opzet: die poort is 18+ en een
   projectie heeft geen leeftijd.

   DE CODE IS DE SLEUTEL, en daarom is hij begrensd op vier manieren:

   1. ALLEEN EEN SPELER opent hem, voor een potje waarin hij zelf meespeelt.
   2. HIJ VERLOOPT -- na twee uur, of eerder als het potje klaar is. Een code
      die blijft werken is een televisie die morgen nog meekijkt.
   3. HIJ IS NIET TE RADEN: acht hexadecimale tekens uit crypto (32 bits). Dat
      is bewust niet meer: hij wordt op een scherm getypt of gescand. De rem
      hieronder is wat brute kracht tegenhoudt, niet de lengte.
   4. ER IS ER EEN PER POTJE. Nog een keer openen geeft dezelfde kamer terug
      zolang hij leeft, zodat een gastheer die twee keer tikt niet twee codes
      in omloop brengt.

   WAT ER NIET IN ZIT: koppelen van telefoons. Die spelen gewoon in hun eigen
   app mee, zoals ze al deden -- de kamer is alleen het GEDEELDE beeld. Een
   scanflow die een telefoon aan een scherm bindt (shared/scanner.js kan dat)
   hoort bij Game Night en niet hier; dan koppel je mensen aan een SESSIE en
   dat is een ander onderwerp met andere vragen. */
module.exports = (ctx) => {
  const { S, save, crypto, nu, SPEL, SOORTEN, ZICHT, codenaamVan } = ctx;

  const DUUR_MS = 2 * 3600000;   // twee uur, en korter als het potje eerder klaar is

  function P() {
    const s = S();
    if (!s.projectie) s.projectie = {};
    return s.projectie;
  }

  /* Opruimen gebeurt bij elke aanraking en niet met een eigen tijdklok: het
     zijn er weinig, ze leven kort, en een tak die alleen groeit als iemand hem
     gebruikt hoeft niet apart geveegd te worden. */
  function schoon() {
    const p = P(), t = Date.now();
    for (const [code, k] of Object.entries(p))
      if (new Date(k.tot).getTime() < t || !S().potjes[k.potje]) delete p[code];
  }

  /* Een kamer openen. Alleen een speler van dit potje, en alleen als het spel
     een projectieweergave HEEFT -- die vraag is dezelfde als "mag dit spel op
     een scherm", en hij wordt hier niet tweede keer beantwoord maar bij de
     weergave opgehaald. */
  function projectieOpen(mij, id) {
    schoon();
    const potje = S().potjes[String(id || '')];
    if (!potje || !potje.spelers.includes(mij)) return { status: 404, error: 'Dit potje bestaat niet (meer).' };
    if (potje.status === 'klaar') return { status: 409, error: 'Dit potje is klaar.' };
    if (!ZICHT[potje.soort] || !ZICHT[potje.soort].publiek)
      return { status: 400, error: 'Dit spel hoort niet op een gedeeld scherm.' };

    // een per potje: twee keer tikken brengt geen tweede code in omloop
    const bestaand = Object.entries(P()).find(([, k]) => k.potje === potje.id);
    if (bestaand) return { status: 200, ok: true, code: bestaand[0], tot: bestaand[1].tot };

    const code = crypto.randomBytes(4).toString('hex').toUpperCase();
    P()[code] = { potje: potje.id, door: mij, at: nu(), tot: new Date(Date.now() + DUUR_MS).toISOString() };
    save();
    return { status: 200, ok: true, code, tot: P()[code].tot };
  }

  /* Wat het scherm ziet. GEEN sessie, GEEN sleutel: de code is het hele bewijs.
     Er komt dan ook niets terug wat niet al in de kamer te zien is -- de
     spelers staan er met hun codenaam in, zoals ze ook in het potje staan. */
  function projectieStand(code) {
    schoon();
    const k = P()[String(code || '').trim().toUpperCase()];
    if (!k) return { status: 404, error: 'Deze code doet het niet (meer).' };
    const p = S().potjes[k.potje];
    if (!p) return { status: 404, error: 'Deze code doet het niet (meer).' };
    const uit = {
      status: 200, spel: p.soort, naam: SOORTEN[p.soort] || p.soort,
      spelers: p.spelers.map(codenaamVan), beurt: p.beurt, teams: p.teams.slice(0, p.spelers.length),
      modus: p.modus, klaar: p.status === 'klaar', winnaar: p.winnaar || null, tot: k.tot
    };
    // de publieke laag, en verder niets: wat hier niet in zit KAN het scherm niet krijgen
    if (p.status !== 'wacht' && p.staat) uit.staat = ZICHT[p.soort].publiek(p, p.staat);
    return uit;
  }

  /* De kamer dichtdoen. Elke speler mag dat -- wie aan tafel zit en het beeld
     niet wil, hoeft niet eerst de gastheer te zoeken. */
  function projectieSluit(mij, id) {
    const potje = S().potjes[String(id || '')];
    if (!potje || !potje.spelers.includes(mij)) return { status: 404, error: 'Dit potje bestaat niet (meer).' };
    for (const [code, k] of Object.entries(P())) if (k.potje === potje.id) delete P()[code];
    save();
    return { status: 200, ok: true };
  }

  // welke spellen er uberhaupt een kamer kunnen hebben; de lobby toont dat
  const projectieSpellen = () => Object.keys(SPEL).filter(k => ZICHT[k] && ZICHT[k].publiek);

  return { projectieOpen, projectieStand, projectieSluit, projectieSpellen, _DUUR_MS: DUUR_MS };
};
