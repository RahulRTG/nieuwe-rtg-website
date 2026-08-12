/* Spellen (deelmodule): de lobby: de INITS-tabel, een potje starten, een
   vriend uitnodigen, antwoorden, de matchmaking (random tegenstander in de
   eigen wereld en leeftijdslaag) en het eigen spellenoverzicht. Krijgt de
   gedeelde context een keer bij het opstarten vanuit kern/spellen.js. */
module.exports = (ctx) => {
  const { db, save, crypto, zijnVrienden, codenaamVan, sseToCustomer, isGeblokkeerd, socialZoek, sociaalRate, volwassen,
    rid, nu, S, SPEL, SOORTEN, TEAMS, wereldFout, leeftijdFout, nudge, schud, beurtDoor, opschonen, klok, beleid,
    INITS, klasgenotenVan } = ctx;
  const uitnodigen = require('./uitnodigen')({ zijnVrienden, socialZoek, isGeblokkeerd, klasgenotenVan });
  function spelStart(potje) {
    potje.status = 'bezig'; potje.beurt = 0;
    /* DE STAD DIE AL WAT HEEFT MEEGEMAAKT (fase C). Hij wordt op het potje
       gestempeld VOOR de init, zodat het spel hem gewoon kan lezen -- een
       spelmodule krijgt bewust geen `db` (zie spelCtx in ../spellen.js), dus de
       enige eerlijke weg is dat de wereld hem meegeeft. Geen stad, geen
       geheugen, en dan begint een campagne zoals hij altijd al begon. */
    if (ctx.stadsgeheugen && potje.variant && potje.variant.stad)
      potje.stadsgeheugen = ctx.stadsgeheugen.voor(potje.variant.stad);
    INITS[potje.soort](potje);
    // de eerste beurt begint nu; zonder tempo doet dit niets
    if (klok) klok.zetKlok(potje);
  }
  // 30 Seconden speel je met twee teams van twee; Proost alleen met 18+
  function spelGrootte(soort, grootte) {
    const s = SPEL[soort];
    return Math.min(s.max, Math.max(s.min || 2, Number(grootte) || 2));
  }
  /* Speelt dit potje in teams? Dat staat in de descriptor van het spel, niet
     als spelnaam hier: 'altijd' is een spel dat niet anders KAN (30 Seconden,
     twee teams van twee), 'keuze' is een spel waar het mag als het potje vol
     zit en de starter erom vraagt (2-tegen-2 mens-erger-je-niet). Op het
     random-pad wordt er niets gevraagd, dus daar wint 'altijd' en blijft
     'keuze' vrij spel. */
  function teamModus(soort, grootte, modus) {
    const t = SPEL[soort].teams;
    if (t === 'altijd') return 'teams';
    if (t === 'keuze' && modus === 'teams' && grootte === SPEL[soort].max) return 'teams';
    return 'vrij';
  }
  async function spelNieuw(mij, { soort, grootte, modus, vrienden, codenamen, klasgenoten, taal, wereld, tempo, context, bron, variant }) {
    opschonen();
    /* Alle toetredingsvragen in een keer, in volgorde: bestaat het spel, mag
       deze app het starten, mag DEZE speler mee. Ze stonden hier los; nu staat
       de checklist in beleid.js zodat een tweede ingang (een chat, een Game
       Night) er geen kan overslaan. De regels zelf zijn niet verhuisd -- beleid
       roept gedeeld.js aan. */
    const nee = beleid.mag(mij, soort, { wereld });
    if (nee) return nee;
    // het tempo hoort bij het spel: een reactieduel met 24 uur per beurt is
    // geen spel meer, dus dat weigert de klok op basis van `vormen`
    const tf = klok ? klok.tempoFout(soort, tempo) : null;
    if (tf) return { status: 400, error: tf };
    /* De variant, en die MAG uit het verzoek komen: hij zegt niet wie er wat
       mag maar welk spel je speelt, en de keuzelijst staat in de descriptor.
       Een verkeerde waarde is een 400 en geen stille terugval -- zie
       ./variant.js. */
    const vv = beleid.variant(soort, variant);
    if (vv.error) return vv;
    // een potje met uitnodigingen telt als EEN uitnodiging tegen het budget,
    // ook op het vriendenpad (anders is nudge-spam naar vrienden gratis)
    if (!sociaalRate(mij, 'spel-uitnodiging', 20, 3600000)) return { status: 429, error: 'Rustig aan met uitnodigen.' };
    const max = spelGrootte(soort, grootte);
    /* Wie je meeneemt, met de drie ingangen en hun eigen poorten, staat in
       ./uitnodigen.js. De fout komt hier ongewijzigd door: de reden hoort bij
       de speler aan te komen, en niet als "kan niet". */
    const wie = await uitnodigen.verzamel(mij, { vrienden, codenamen, klasgenoten }, max);
    if (wie.error) return wie;
    const uitgenodigd = wie.uitgenodigd;
    // dezelfde checklist voor iedereen die je meeneemt; een lijst mag erin,
    // zodat er hier geen tweede lus staat die de vraag net anders stelt
    const neeGasten = beleid.mag(uitgenodigd, soort, { wereld });
    if (neeGasten) return neeGasten;
    const potje = Object.assign({ id: rid(5), soort, grootte: max, modus: teamModus(soort, max, modus),
      taal: taal === 'en' ? 'en' : 'nl',
      teams: TEAMS, spelers: [mij], uitgenodigd, status: 'wacht', beurt: 0, winnaar: null, at: nu(), door: codenaamVan(mij) },
      /* De roomvelden komen uit beleid.js en niet uit het verzoek: `context`
         wordt daar tegen een gesloten lijst gelegd, want wie zijn eigen context
         mag meesturen opent straks een 18+-spel als schoolsessie. `host` is de
         starter, en die weten we hier. */
      beleid.roomVelden({ context, bron, host: mij, tempo, variant: vv.variant }));
    S().potjes[potje.id] = potje;
    save();
    uitgenodigd.forEach(v => nudge(v, potje));
    return { status: 200, ok: true, id: potje.id };
  }
  function spelAntwoord(mij, id, akkoord) {
    const p = S().potjes[id];
    if (!p || p.status !== 'wacht' || !p.uitgenodigd.includes(mij)) return { status: 404, error: 'Deze uitnodiging is er niet meer.' };
    /* Accepteren is een toetredingsmoment en gaat dus ook langs het beleid --
       maar langs de SMALLERE vraag: de leeftijdspoort geldt, de wereldpoort
       niet, want meespelen op uitnodiging kan altijd over en weer. Die
       asymmetrie staat uitgelegd in beleid.js. */
    if (akkoord === true) {
      const nee = beleid.magMeedoen(mij, p.soort);
      if (nee) return nee;
    }
    p.uitgenodigd = p.uitgenodigd.filter(x => x !== mij);
    // 30 Seconden start pas met vier (twee teams); haalt een potje zijn
    // minimum niet meer, dan verdwijnt het in plaats van kapot te starten
    const minimum = SPEL[p.soort].min || 2;
    if (akkoord === true) p.spelers.push(mij);
    if (p.spelers.length >= p.grootte || (!p.uitgenodigd.length && p.spelers.length >= minimum)) spelStart(p);
    else if (!p.uitgenodigd.length && p.spelers.length < minimum) delete S().potjes[id];
    save();
    p.spelers.forEach(sp => nudge(sp, p));
    return { status: 200, ok: true, gestart: p.status === 'bezig', geannuleerd: !S().potjes[id] && p.status !== 'bezig' };
  }
  /* Wat er per spel te KIEZEN valt, voor de lobby. Uit de descriptor en niet
     uit een lijst in de client: de schoolstof van het Quizduel is afgeleid uit
     de leerlijnen en groeit daarmee mee, dus een kopie aan de andere kant zou
     er stil op achterlopen -- en dan staat er een keuze in de app die de server
     weigert, of ontbreekt er een die wel bestaat. Alleen spellen die iets te
     kiezen hebben staan erin. */
  const spelVarianten = () => ({ status: 200, varianten: Object.fromEntries(
    Object.entries(SPEL).filter(([, s]) => s.varianten).map(([k, s]) => [k, s.varianten])) });

  function mijnSpellen(mij) {
    opschonen();
    const alle = Object.values(S().potjes);
    const mijnPotjes = alle.filter(p => p.spelers.includes(mij)).map(p => ({
      id: p.id, soort: p.soort, naam: SOORTEN[p.soort], status: p.status, modus: p.modus, taal: p.taal || 'nl',
      spelers: p.spelers.map(codenaamVan), wachtOp: p.uitgenodigd.length,
      aanZet: p.status === 'bezig' ? codenaamVan(p.spelers[p.beurt]) : null, ikAanZet: p.status === 'bezig' && p.spelers[p.beurt] === mij,
      // de klok reist mee zodat de lobby "jouw beurt, nog 18 uur" kan tonen
      klok: klok ? klok.klokStand(p) : null,
      winnaar: p.winnaar, gelijk: !!p.gelijk, at: p.at
    })).sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, 20);
    const uitnodigingen = alle.filter(p => p.status === 'wacht' && p.uitgenodigd.includes(mij)).map(p => ({
      id: p.id, soort: p.soort, naam: SOORTEN[p.soort], van: p.door, spelers: p.spelers.map(codenaamVan), modus: p.modus
    }));
    return { potjes: mijnPotjes, uitnodigingen };
  }
  /* Een potje dat METEEN begint tussen spelers die al ja hebben gezegd. Dat is
     het pad voor een toernooiwedstrijd: daar is de uitnodiging al gedaan bij
     het toernooi zelf, dus een tweede ronde accepteren zou een lege plichtpleging
     zijn. Hij loopt bewust langs dezelfde spelStart als elk ander potje -- een
     toernooipartij is een gewone partij, met alle spelregels en poorten die
     daarbij horen, en niet een tweede soort potje. */
  function potjeDirect(soort, spelers, extra) {
    const potje = Object.assign({
      id: rid(5), soort, grootte: spelers.length, modus: teamModus(soort, spelers.length),
      taal: 'nl', teams: TEAMS, spelers: spelers.slice(), uitgenodigd: [],
      status: 'wacht', beurt: 0, winnaar: null, at: nu(), door: 'toernooi'
    }, beleid.roomVelden({ context: 'hall', host: null, tempo: (extra || {}).tempo }), extra || {});
    S().potjes[potje.id] = potje;
    spelStart(potje);
    save();
    spelers.forEach(sp => nudge(sp, potje));
    return potje;
  }

  // teamModus reist mee naar buiten zodat de toets hem los kan aanspreken:
  // via de API is "vier spelers, wel of geen teams" een dure opstelling
  /* DE WACHTRIJ staat apart (./wachtrij.js) en op een echte naad: dit bestand
     gaat over een potje dat je met NAAM opzet -- uitnodigen, accepteren,
     terugkijken wat je hebt lopen -- en de wachtrij koppelt VREEMDEN. Die
     tweede heeft een eigen onderwerp (waarop splitst een rij, en waarom) dat
     hier alleen maar meelas. Hij krijgt wat de lobby al gebouwd heeft mee.

     De aanleiding was banaal en daarom het vermelden waard: dit bestand ging
     door de 10 kB-grens die scripts/check.js bewaakt, en die grens is precies
     een rem op een bestand dat twee onderwerpen gaat dragen. */
  const { spelRandom } = require('./wachtrij')({
    S, save, rid, nu, SPEL, TEAMS, beleid, klok, nudge, opschonen, spelStart, spelGrootte, teamModus
  });

  return { spelStart, spelGrootte, teamModus, potjeDirect, spelNieuw, spelAntwoord, spelRandom, mijnSpellen, spelVarianten };
};
