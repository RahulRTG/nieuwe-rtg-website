/* Kern-module "bureau": Het Privékantoor -- de ENE app van de Lifestyle Pass.

   Waarom dit bestaat. De Lifestyle Pass had veertien premium-apps, elk netjes
   op zichzelf: Maison wist van uw huis, Hangar van uw toestel, Entourage van uw
   chauffeur, Reisboek van uw visum. Veertien tegels, veertien dossiers, veertien
   keer zelf de verbanden leggen. Bij zesenveertig euro per maand is dat een
   rijke app-verzameling. Bij twintigduizend is het huiswerk.

   Wat een privékantoor doet is niet meer apps leveren maar de verbanden leggen:
   "wij gaan in augustus zes weken weg" raakt het huis, de staf, de auto's, de
   dieren, de post, de agenda en drie paspoorten, en dat hoort ú niet uit te
   zoeken. Dus is dit één app op één levenscontext, met vier onderdelen die de
   veertien apps aan elkaar knopen:

     ./graaf.js       de Life Graph -- alles wat u heeft, wie het bezit, wie het
                      mag zien en wanneer het aandacht vraagt. Een PROJECTIE op
                      de bestaande dossiers, geen tweede opslag.
     ./termijnen.js   de Control Tower -- alle datums uit al die apps in vier
                      vensters, plus het venster dat nergens bestond:
                      achterstallig.
     ./delegatie.js   hoeveel het kantoor zelf mag, per domein, met een grens in
                      euro's en een dak dat u niet kunt ophogen.
     ./cases.js       een verzoek als dossier, met team, tijdlijn en één plek
                      waar een MENS bevestigt.
     ./nu.js          de Situation Room: één kop, en de regels die hem waarmaken.
     ./kamers.js      de twintig werelden, met eerlijk erbij welke er nog niet
                      zijn.

   De veertien apps blijven bestaan en blijven de plek waar u dingen INVULT. Dit
   kantoor is de plek waar ze samenkomen. Dat is met opzet de goedkoopste vorm:
   geen datamigratie, geen tweede waarheid, en een app die stuk kan zonder de
   rest mee te nemen.

   Gemount vanuit opzet/kernlaag3.js, achter dezelfde pas-poort als de rest van
   de suite (routes/member/bureau.js). */
'use strict';

module.exports = ({ db, save, crypto, anthropic, liveCodename, notify, bezitZet }) => {
  const nu = () => new Date().toISOString();
  const rid = () => crypto.randomBytes(4).toString('hex');
  const schoon = (t, n) => String(t == null ? '' : t).replace(/[<>]/g, '').trim().slice(0, n || 200);
  const vandaag = () => new Date().toISOString().slice(0, 10);

  const graafMod = require('./graaf')({ db, vandaag });
  const termijnenMod = require('./termijnen')({ graaf: graafMod.graaf });
  const delegatieMod = require('./delegatie')({ db, save, nu });
  const kamersMod = require('./kamers')({ samenvatting: graafMod.samenvatting });
  /* De orkestratie kent de zaken en de zaken kennen de orkestratie: die knoop
     wordt hier doorgehakt met een late verwijzing. `casesMod` bestaat nog niet
     als deze regel draait, maar raakvlak() wordt pas aangeroepen als alles
     staat -- en zo hoeft geen van beide de ander na te bouwen. */
  const orkMod = require('./orkestratie')({ graaf: graafMod.graaf,
    cases: (k) => casesMod.cases(k), beoordeel: delegatieMod.beoordeel, rid,
    inAanbouw: kamersMod.inAanbouw });
  const casesMod = require('./cases')({ db, save, nu, rid, schoon, liveCodename, notify,
    beoordeel: delegatieMod.beoordeel, deelopdrachten: orkMod.deelopdrachten, bezitZet });
  const nuMod = require('./nu')({ tower: termijnenMod.tower, cases: casesMod.cases,
    samenvatting: graafMod.samenvatting, graaf: graafMod.graaf });
  const twinMod = require('./twin')({ db, save, nu, rid, schoon,
    isDatum: d => /^\d{4}-\d{2}-\d{2}$/.test(String(d || '')) });
  const briefMod = require('./briefing')({ nuBeeld: nuMod.nuBeeld, tower: termijnenMod.tower,
    cases: casesMod.cases, graaf: graafMod.graaf });

  const aiMod = require('./ai')({ anthropic, schoon, nuBeeld: nuMod.nuBeeld,
    graaf: graafMod.graaf, delegatie: delegatieMod.delegatie });
  const bureauAI = aiMod.bureauAI;

  /* Het openingsscherm van de app: de kop uit de Situation Room, de tower op
     één regel per venster, de plattegrond en hoeveel er in de graaf staat. Eén
     aanroep, want dit is één scherm -- vier losse aanroepen zouden vier keer
     dezelfde graaf bouwen. */
  function bureauOverzicht(key) {
    /* EEN graaf, vijf lezers. Dit stond hier eerst als vijf losse aanroepen die
       er ieder een bouwden; op een vol dossier (15.000 knopen) kostte dat scherm
       daardoor 134 ms in plaats van 27. De graaf gaat nu als argument mee, en
       niet via een cache -- een cache zou moeten weten wanneer een ANDERE app
       (Maison, Hangar, Cellier) iets heeft geschreven, en die vraag goed
       beantwoorden is moeilijker dan het probleem waard is. Doorgeven kan niet
       verouderen. */
    const g = graafMod.graaf(key);
    const t = termijnenMod.tower(key, g);
    const beeld = nuMod.nuBeeld(key, g, t);
    return {
      status: 200,
      naam: liveCodename ? liveCodename(key) : '',
      kop: beeld.kop, ernst: beeld.ernst, regels: beeld.regels, tellingen: beeld.tellingen,
      vensters: t.vensters.map(v => ({ sleutel: v.sleutel, label: v.label, aantal: v.aantal })),
      achterstallig: t.achterstallig.length,
      kamers: kamersMod.kamers(key, g).kamers,
      graaf: graafMod.samenvatting(key, g)
    };
  }

  /* EEN naam in de kern, niet vierentwintig.

     De andere modules hier zetten elk van hun functies los in `kern`, en dat
     werkt prima bij vijf. Bij vierentwintig maakt het de kern zo breed dat de
     meter `kernBreedte` erop aanslaat -- terecht: elke naam die een route kan
     aanraken is een naam die iemand ergens anders per ongeluk kan aanraken. De
     boardroom deed dit al goed (`kern.lidboard`), en dit kantoor is precies zo'n
     samenhangend geheel. Dus: EEN eigenschap, met de app erin.

     De route-module doet er `const { ... } = kern.bureau;` mee en merkt verder
     niets. */
  return {
    bureau: {
      overzicht: bureauOverzicht, ai: bureauAI,
      nu: nuMod.nuBeeld, knoop: nuMod.knoopDetail,
      tower: termijnenMod.tower, termijnen: termijnenMod.termijnenAlle,
      graaf: graafMod.graafVoor, graafSamenvatting: graafMod.samenvatting,
      // alleen voor de toets; zie de staart van ./graaf.js
      knoopFabriek: graafMod.knoop,
      delegatie: delegatieMod.delegatie, delegatieZet: delegatieMod.delegatieZet,
      beoordeel: delegatieMod.beoordeel,
      kamers: kamersMod.kamers,
      raakvlak: orkMod.raakvlak, briefing: briefMod.bureauBriefing,
      twin: twinMod.twin, twinRuimte: twinMod.twinRuimte, twinRuimteWeg: twinMod.twinRuimteWeg,
      twinInstallatie: twinMod.twinInstallatie, twinInstallatieWeg: twinMod.twinInstallatieWeg,
      twinBeurt: twinMod.twinBeurt,
      cases: casesMod.cases, caseOpen: casesMod.caseOpen,
      caseBeslis: casesMod.caseBeslis, caseIntrek: casesMod.caseIntrek,
      KAMERS: kamersMod.BUREAU_KAMERS,
      DOMEINEN: delegatieMod.DELEGATIE_DOMEINEN,
      NIVEAUS: delegatieMod.DELEGATIE_NIVEAUS,
      CASE_SOORTEN: casesMod.CASE_SOORTEN
    },
    /* De KANTOOR-kant staat apart, en dat is geen indeling maar een grens.

       Zat hij in `kern.bureau`, dan had routes/office/ toegang tot de graaf, het
       mandaat en de zaken van elk lid -- en dan is "het bureau ziet geen
       besloten kamers" een afspraak in plaats van een muur. Nu krijgt het
       kantoor precies twee functies: de wachtrij zien, en er een stap in zetten.
       Alles wat het niet nodig heeft, kan het niet bereiken.

       Dat het hierdoor twee kern-namen zijn in plaats van een, is de prijs. Die
       staat als bewuste verruiming in NORM.json. */
    bureauBalie: {
      desk: casesMod.bureauDesk, voortgang: casesMod.bureauVoortgang
    }
  };
};
