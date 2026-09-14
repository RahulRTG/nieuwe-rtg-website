/* HET INZAGEJOURNAAL, DE LEESKANT -- lezen, verantwoorden, bewijzen.

   Los van ./inzagelog.js langs een naad in het ONDERWERP en niet alleen in de
   bytes: daar wordt het spoor GESCHREVEN (en sinds 13 september 2026 kan dat
   schrijven weigeren), hier wordt het gelezen en nagerekend. De twee halves
   hebben verschillende lezers -- een betrokkene die vraagt wie in zijn dossier
   keek, en een beheerder die wil weten of de keten ongemoeid is -- en ze delen
   niets behalve de rij zelf.

   DIE RIJ KOMT ALS ARGUMENT BINNEN en wordt hier niet opgehaald. Zou dit
   bestand zijn eigen `rij()` hebben, dan waren er twee plekken die weten waar
   het journaal woont, en de eerste die uit de pas loopt doet dat stil (LAT.md
   regel 4).

   WAT DEZE KANT NIET KAN ZEGGEN, en dat hoort erbij. controleer() ziet wat er
   BINNEN het journaal niet klopt; wie de nieuwste regels weggooit houdt een
   kloppende keten over. Daar is alleen een eerder naar buiten gebracht ANKER
   tegen bestand -- zie ./lib/keten.js. En de rij is begrensd (MAX): een keten
   bewijst de integriteit van wat er STAAT en zegt niets over wat eraf viel.
   Integriteit en retentie zijn twee eigenschappen, en de ene wordt hier
   makkelijk voor de andere aangezien. */
'use strict';

const { verifieer, top } = require('./lib/keten');
const { verankerPunt, verifieerTegenAnker } = require('./lib/keten-anker');
const { nu } = require('./lib/klok');

/* `rij` is een FUNCTIE en geen array: het journaal wordt onderweg aangevuld, en
   een eenmalig meegegeven array zou een momentopname van het opstartmoment
   zijn. */
module.exports = ({ rij, bewaardagen, afgekapt }) => {
  /* De termijn komt van de SCHRIJFKANT mee en staat hier niet als getal. Twee
     plekken die weten hoe lang dit huis bewaart, lopen uiteen zodra er een
     verandert, en dan vertelt het scherm iets anders dan de opslag doet
     (LAT.md regel 4). */
  const DAGEN = Number(bewaardagen) || null;
  const gevallen = () => { try { return Number(afgekapt && afgekapt()) || 0; } catch (e) { return 0; } };

  /* Lezen. Alleen voor de eigenaar/toezicht (de aanroepende route bewaakt dat),
     en voor een betrokkene die vraagt wie in zijn dossier heeft gekeken. */
  function lijst({ overId, doorId, max } = {}) {
    let l = rij();
    if (overId != null) {
      const s = String(overId);
      l = l.filter(r => String(r.overId) === s || (Array.isArray(r.overIds) && r.overIds.indexOf(s) >= 0));
    }
    if (doorId != null) l = l.filter(r => String(r.doorId) === String(doorId));
    return l.slice(0, Math.min(Number(max) || 200, 1000));
  }

  /* Wat een betrokkene zelf mag zien over inzage in ZIJN dossier (AVG art. 15).
     Zonder de kijker bij naam te noemen: dat is de persoonsdata van een ander,
     en die staat niet automatisch open voor de een omdat de ander vraagt. Wel
     de functie, de reden en het moment -- dat is waar de vraag over gaat. */
  /* DE BELOFTE REIST MEE MET HET ANTWOORD, en dat is besluit 6 in zijn kleinste
     vorm. Een kale lijst laat het scherm raden wat zij betekent, en het scherm
     raadt dan "dit is alles" -- terwijl het "dit is alles binnen de termijn" is.
     Wie hier straks een zin omheen zet, hoeft die niet zelf te verzinnen. */
  function voorBetrokkene(overId) {
    const regels = lijst({ overId, max: 200 }).map(r => ({ at: r.at, waarom: r.waarom, bron: r.bron }));
    const tekort = gevallen();
    return {
      regels,
      bewaardagen: DAGEN,
      belofte: DAGEN
        ? 'U ziet wie er in uw dossier keek, over de afgelopen ' + DAGEN + ' dagen.'
        : 'De bewaartermijn van dit journaal is hier niet vast te stellen.',
      /* NUL IS HIER EEN UITSPRAAK EN GEEN LEEG VELD: het zegt dat de noodrem
         nooit heeft gebeten, en dus dat de termijn de hele belofte draagt. */
      volledig: tekort === 0,
      tekort: tekort === 0 ? null :
        'Er zijn ' + tekort + ' regel(s) door de noodrem afgevallen vóór hun termijn; ' +
        'over die periode is dit overzicht niet volledig.'
    };
  }

  /* IS HET SPOOR ONGEMOEID? De keten nalopen, zodat een beheerder die een regel
     heeft weggehaald of bijgesteld op een aanwijsbaar punt opvalt. Zie
     server/lib/keten.js voor wat dit wel en niet tegenhoudt -- kort: stille
     wijziging wel, een vastberaden beheerder pas als de top naar buiten gaat. */
  function controleer() { return verifieer(rij()); }

  /* De top van de keten: het ene getal dat periodiek naar een gescheiden systeem
     moet om het verleden echt vast te zetten. */
  function ketenTop() { return top(rij()); }

  /* HET ANKER. controleer() ziet wat er BINNEN het journaal niet klopt; wie de
     nieuwste regels weggooit houdt een kloppende keten over. Alleen een eerder
     naar buiten gebracht anker ziet dat -- zie server/lib/keten.js.

     anker()      maak de momentopname die weggezet moet worden (buiten dit huis).
     tegenAnker() reken af met een anker dat eerder is weggezet. */
  function anker() { return verankerPunt(rij()); }
  function tegenAnker(a) { return verifieerTegenAnker(rij(), a); }

  function samenvatting() {
    const l = rij();
    const grens = nu() - 7 * 24 * 3600 * 1000;
    const week = l.filter(r => Date.parse(r.at) >= grens);
    const tekort = gevallen();
    const oudste = l.length ? l[l.length - 1].at : null;
    return {
      totaal: l.length,
      week: week.length,
      zonderReden: l.filter(r => r.waarom === 'GEEN REDEN OPGEGEVEN').length,
      keten: controleer(),
      /* DE BEWARING, HARDOP. `afgekapt` boven nul betekent dat de noodrem heeft
         gebeten en de belofte dus NIET wordt waargemaakt -- een zichtbaar tekort
         in plaats van een gat dat niemand kan vinden. Verjaarde regels staan er
         met opzet niet bij: die zijn de termijn die werkt, geen verlies. */
      bewaring: {
        dagen: DAGEN,
        oudsteRegel: oudste,
        afgekaptDoorNoodrem: tekort,
        volledig: tekort === 0
      },
      recent: l.slice(0, 10)
    };
  }

  return { lijst, voorBetrokkene, samenvatting, controleer, ketenTop, anker, tegenAnker };
};
