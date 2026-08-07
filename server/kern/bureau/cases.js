/* Het Privekantoor, deelbestand "cases": een verzoek wordt een dossier.

   Het oude concierge-verzoek was een titel met een status. Dat werkt voor "boek
   een tafel" en breekt bij "mijn moeder wordt 70, doe iets bijzonders" -- want
   dat is geen verzoek maar een project met een budget, een team, een reeks
   beslissingen en een tijdlijn. Een case dus.

   DRIE SOORTEN, omdat ze echt anders lopen:

     regulier   het dagelijkse werk. Loopt langs de delegatie-engine: mag het
                kantoor dit zelf, dan gaat het meteen in uitvoering; zo niet,
                dan wordt het een beslissing voor het lid.
     bijzonder  het onmogelijke verzoek. Gaat ALTIJD naar een mens en vraagt
                ALTIJD om akkoord, ongeacht de delegatiestand -- want wat niet
                routine is, kan per definitie niet onder een routineafspraak
                vallen. Dit is waar een duur kantoor zich onderscheidt van een
                abonnement, en juist daar is automatisch doorstomen verkeerd.
     warroom    er is iets misgegaan en er moet nu iemand bellen. Slaat de
                budgetvraag over: bij een incident is de vraag niet wat het kost.

   WAT DIT BESTAND NIET MAG, en dat is de merkregel uit CLAUDE.md in code: de
   status 'geregeld' kan hier alleen worden gezet door de KANTOOR-kant, door een
   mens achter het concierge-bureau. Geen enkele route van het lid en geen enkel
   AI-antwoord kan hem zetten. Een boeking is pas bevestigd als een mens hem
   bevestigd heeft, en dat is geen tekst in een systeemprompt maar een functie
   die de andere kant niet kan aanroepen.

   Gemount via ./index.js. */
'use strict';

/* De keten. `eind` betekent: hier houdt de case op te leven en telt hij nergens
   meer als open. */
const STATUSSEN = [
  { s: 'genoteerd', label: 'Genoteerd' },
  { s: 'in voorbereiding', label: 'In voorbereiding' },
  { s: 'wacht op uw akkoord', label: 'Wacht op uw akkoord' },
  { s: 'in uitvoering', label: 'In uitvoering' },
  { s: 'geregeld', label: 'Geregeld', eind: true },
  { s: 'afgewezen', label: 'Niet gelukt', eind: true },
  { s: 'ingetrokken', label: 'Ingetrokken', eind: true }
];
const EINDSTATUS = new Set(STATUSSEN.filter(x => x.eind).map(x => x.s));
// alleen de kantoor-kant mag hier komen; zie de kop van dit bestand
const KANTOOR_STATUSSEN = ['in voorbereiding', 'in uitvoering', 'geregeld', 'afgewezen'];

const SOORTEN = ['regulier', 'bijzonder', 'warroom'];

/* Wie eraan werkt. Dit zijn ROLLEN, geen namen: het systeem wijst een stoel aan
   en niet een persoon, want een naam op een scherm die er in het echt niet is,
   is precies de belofte die wij niet doen. */
const SPECIALIST = {
  reizen: 'Reisspecialist',
  vervoer: 'Vervoer & onderhoud',
  huishouden: 'Household manager',
  gelegenheden: 'Hospitality & events',
  gezelschap: 'Staf & planning',
  collectie: 'Sourcing & collecties',
  kring: 'Attenties',
  filantropie: 'Filantropie-adviseur',
  vermogen: 'Family office',
  gezondheid: 'Persoonlijk assistent',
  nalatenschap: 'Persoonlijk assistent'
};

/* Domeinen waarvan een case het kantoor NOOIT bereikt. Dezelfde twee die in
   delegatie.js een dak van 1 en 0 hebben, en in de graaf op 'besloten' staan.
   Drie bestanden, één regel -- en dat is geen dubbeling maar dezelfde grens die
   op drie plekken iets anders moet doen: niet delegeren, niet tonen, niet
   doorsturen. */
const BESLOTEN_DOMEIN = new Set(['gezondheid', 'nalatenschap']);

module.exports = (ctx) => {
  const { db, save, nu, rid, schoon, liveCodename, notify, beoordeel } = ctx;

  /* C() maakt de lijst aan en is dus alleen voor SCHRIJVERS. lees() raakt niets
     aan en is voor lezers.

     Dat onderscheid is er niet voor de netheid. Het Privékantoor projecteert bij
     elk schermbezoek, en `cases(key)` zit in die leesweg -- met alleen C() zou
     één blik op het overzicht een lege `cases: []` in het dossier schrijven van
     ieder lid dat ooit heeft gekeken. De toets die dat aanwees stond er al
     ("de graaf schrijft niets terug"); hij zakte, en dit is de oorzaak en niet
     het symptoom. */
  function C(key) {
    if (!db.data.lifestyle) db.data.lifestyle = {};
    if (!db.data.lifestyle[key]) db.data.lifestyle[key] = {};
    const l = db.data.lifestyle[key];
    if (!Array.isArray(l.cases)) l.cases = [];
    return l.cases;
  }
  function lees(key) {
    const alle = db.data && db.data.lifestyle;
    const l = (alle && alle[key]) || {};
    return Array.isArray(l.cases) ? l.cases : [];
  }

  const openCase = c => !EINDSTATUS.has(c.status);

  function teamVoor(soort, domein) {
    const team = [{ rol: 'Lead Rechterhand' }];
    const s = SPECIALIST[domein];
    if (s) team.push({ rol: s });
    if (soort === 'bijzonder') team.push({ rol: 'Sourcing-specialist' });
    if (soort === 'warroom') team.push({ rol: 'Incidentcoördinator' });
    return team;
  }

  function stap(c, status, notitie, door) {
    c.status = status;
    c.tijdlijn.push({ op: nu(), status, notitie: schoon(notitie, 300), door });
    if (c.tijdlijn.length > 200) c.tijdlijn.shift();
  }

  /* Een case openen. Hier valt de beslissing of het kantoor zelf mag doorpakken,
     en dat gebeurt precies één keer -- bij het aanmaken, met de stand van dat
     moment. Wie later zijn delegatie verruimt, verruimt niet met terugwerkende
     kracht wat er al ter goedkeuring ligt. */
  function caseOpen(key, b) {
    const titel = schoon(b.titel, 120);
    if (!titel) return { status: 400, error: 'Waarmee kunnen wij u van dienst zijn?' };
    const soort = SOORTEN.includes(b.soort) ? b.soort : 'regulier';
    const domein = schoon(b.domein, 40) || 'huishouden';
    const cases = C(key);
    if (cases.filter(openCase).length >= 60)
      return { status: 400, error: 'Er lopen veel zaken voor u. Wij ronden er graag eerst een paar met u af.' };

    const bedrag = Math.max(0, Math.min(1e11, Math.round(Number(b.bedragCenten) || 0)));
    /* De warroom vraagt niet naar geld en de bijzondere case gaat altijd langs
       een mens; alleen het reguliere werk loopt langs de delegatie-engine. */
    const oordeel = soort === 'regulier' ? beoordeel(key, domein, bedrag)
      : { niveau: null, magZelf: false, meldVooraf: false,
        reden: soort === 'warroom'
          ? 'Een incident: wij zetten er direct mensen op en vragen u pas om een besluit als dat nodig is.'
          : 'Een bijzonder verzoek gaat altijd langs een van onze mensen; u houdt het laatste woord.' };

    const c = {
      id: rid(), titel, wat: schoon(b.wat, 1200), soort, domein,
      bedragCenten: bedrag, at: nu(), status: 'genoteerd',
      besloten: BESLOTEN_DOMEIN.has(domein),
      delegatie: { niveau: oordeel.niveau, magZelf: !!oordeel.magZelf, reden: oordeel.reden },
      team: teamVoor(soort, domein),
      knopen: (Array.isArray(b.knopen) ? b.knopen : []).slice(0, 40).map(x => schoon(x, 80)).filter(Boolean),
      beslissing: { nodig: false, gegeven: '', op: '' },
      tijdlijn: []
    };
    stap(c, 'genoteerd', 'Uw verzoek staat genoteerd.', 'systeem');

    if (soort === 'warroom') {
      stap(c, 'in uitvoering', 'Wij hebben een incidentteam aangewezen; een van onze mensen neemt contact met u op.', 'systeem');
    } else if (oordeel.magZelf) {
      stap(c, 'in uitvoering', oordeel.reden, 'systeem');
    } else {
      c.beslissing.nodig = true;
      stap(c, 'wacht op uw akkoord', oordeel.reden, 'systeem');
    }
    /* Een besloten case blijft binnen: hij komt niet op het bureau en krijgt dus
       ook geen team dat hem zou zien. */
    if (c.besloten) c.team = [{ rol: 'U zelf' }];

    cases.unshift(c);
    if (cases.length > 300) cases.length = 300;
    save();
    return { status: 200, ok: true, zaak: c };
  }

  /* Het lid beslist. Dit is de enige plek waar een case van "wacht op uw
     akkoord" af komt, en het lid is de enige die hem mag aanroepen. */
  function caseBeslis(key, id, akkoord) {
    const c = lees(key).find(x => x.id === id);
    if (!c) return { status: 404, error: 'Deze zaak vinden wij niet terug.' };
    if (!c.beslissing.nodig || c.beslissing.gegeven) return { status: 400, error: 'Hier ligt geen besluit voor u klaar.' };
    c.beslissing.gegeven = akkoord ? 'akkoord' : 'afgewezen';
    c.beslissing.op = nu();
    c.beslissing.nodig = false;
    if (akkoord) stap(c, 'in uitvoering', 'U gaf akkoord. Wij pakken het op.', 'lid');
    else stap(c, 'ingetrokken', 'U besloot hiervan af te zien.', 'lid');
    save();
    return { status: 200, ok: true, zaak: c };
  }

  function caseIntrek(key, id) {
    const c = lees(key).find(x => x.id === id);
    if (!c) return { status: 404, error: 'Deze zaak vinden wij niet terug.' };
    if (EINDSTATUS.has(c.status)) return { status: 400, error: 'Deze zaak is al afgerond.' };
    c.beslissing.nodig = false;
    stap(c, 'ingetrokken', 'Op uw verzoek ingetrokken.', 'lid');
    save();
    return { status: 200, ok: true };
  }

  function cases(key) {
    const alle = lees(key);
    return {
      status: 200,
      zaken: alle,
      open: alle.filter(openCase).length,
      beslissingen: alle.filter(c => c.beslissing.nodig).length,
      statussen: STATUSSEN, soorten: SOORTEN
    };
  }

  /* De kantoor-kant (het bureau waar een mens de keten doorloopt) woont in
     ./cases-bureau.js. Hij krijgt de gedeelde staat mee in plaats van hem na te
     bouwen: een tweede `openCase` zou op een dag iets anders "open" noemen dan
     deze. */
  const bureau = require('./cases-bureau')({ db, save, liveCodename, notify,
    lees, stap, openCase, KANTOOR_STATUSSEN, SOORTEN });

  return { caseOpen, caseBeslis, caseIntrek, cases,
    bureauDesk: bureau.bureauDesk, bureauVoortgang: bureau.bureauVoortgang,
    CASE_STATUSSEN: STATUSSEN, CASE_SOORTEN: SOORTEN, caseLijst: lees, caseOpenTest: openCase };
};
