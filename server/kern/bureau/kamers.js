/* Het Privekantoor, deelbestand "kamers": de twintig werelden.

   Een privekantoor beslaat een heel leven, en dat leven valt uiteen in werelden:
   het huis, de reizen, het vervoer, de kring, het vermogen, wat er na u komt. Dit
   bestand is de plattegrond.

   DE STATUS WORDT AFGELEID EN NIET BEWEERD. Elke kamer noemt de apps die hem
   vullen; heeft hij er geen, dan staat hij op "in aanbouw" en zegt het scherm dat
   ook. Er is dus geen veld waarin iemand "ingericht" kan typen voor een kamer die
   leeg is. Dat is regel 6 van de lat -- een belofte in tekst is een belofte in
   code -- toegepast op de plattegrond zelf: de enige manier om een kamer
   ingericht te krijgen is er een app achter zetten.

   `test/bureau.test.js` trekt het door: elk pad hieronder moet als bestand
   bestaan. Een kamer die naar een pagina wijst die er niet is, is een gesloten
   deur met een bordje erop, en dat is precies het soort belofte dat een
   twintigduizend-euro-propositie niet kan hebben.

   VIER KAMERS STAAN BEWUST LEEG. Beveiliging, reputatie, persoonlijke inkoop en
   dieren horen bij dit product maar bestaan hier nog niet. Ze staan er wél op de
   plattegrond, met "in aanbouw" erbij. Weglaten zou netter ogen en zou het lid
   een kleiner kantoor voorspiegelen dan het idee is; een lege kamer tonen die
   leeg heet, is eerlijker dan een kamer verzwijgen.

   Gemount via ./index.js. */
'use strict';

// pas: welke pas de app zelf vraagt. 'lifestyle' = onderdeel van deze suite,
// 'rtg' = een algemene RTG-app die deze wereld ook bedient.
const K = (id, naam, wat, kamers, apps) => ({ id, naam, wat, kamers, apps });

const KAMERS = [
  K('prive', 'Private Office', 'Uw zaken, uw beslissingen, uw correspondentie en het logboek van wat er voor u geregeld is.',
    ['cases'], [{ naam: 'Zaken & beslissingen', url: '/apps/lifestyle.html', pas: 'lifestyle' },
      { naam: 'Logboek', url: '/apps/logboek.html', pas: 'lifestyle' }]),
  K('vermogen', 'Family Office', 'Wat u bezit, wat het waard is, wie het verzekert en wanneer het opnieuw bekeken moet worden.',
    ['vermogen'], [{ naam: 'Bezittingenregister', url: '/apps/lifestyle.html', pas: 'lifestyle' },
      { naam: 'Balans', url: '/apps/balans.html', pas: 'rtg' }]),
  K('huishouden', 'Household Office', 'Uw huizen en hun huishouding: staf, taken, onderhoud en wat er speelt in en om huis.',
    ['huishouden'], [{ naam: 'Maison', url: '/apps/maison.html', pas: 'lifestyle' }]),
  K('reizen', 'Travel Office', 'Reizen van begin tot eind: draaiboek, verblijven, documenten en het programma per dag.',
    ['reizen'], [{ naam: 'Reisboek', url: '/apps/reisboek.html', pas: 'lifestyle' },
      { naam: 'Vluchten', url: '/apps/vluchten.html', pas: 'rtg' }]),
  K('vervoer', 'Mobility Office', 'Toestellen, vaartuigen en wagens: waar ze staan, wanneer ze gekeurd moeten en wat ze kosten.',
    ['vervoer'], [{ naam: 'Hangar', url: '/apps/hangar.html', pas: 'lifestyle' },
      { naam: 'Logboek', url: '/apps/logboek.html', pas: 'lifestyle' }]),
  K('zakelijk', 'Executive Office', 'Uw professionele kant: netwerk, boardroom, facturen en de zakelijke agenda.',
    [], [{ naam: 'RTG Zakelijk', url: '/apps/zakelijk.html', pas: 'lifestyle' },
      { naam: 'Boardroom', url: '/apps/boardroom.html', pas: 'rtg' }]),
  K('kring', 'Social Office', 'De mensen om u heen: uw clubs, uw relaties en de momenten die u niet wilt missen.',
    ['kring'], [{ naam: 'Cercle', url: '/apps/cercle.html', pas: 'lifestyle' },
      { naam: 'Attenties', url: '/apps/attenties.html', pas: 'lifestyle' },
      { naam: 'Rendez-vous', url: '/apps/rendezvous.html', pas: 'lifestyle' }]),
  K('gelegenheden', 'Events Office', 'Van een diner tot een besloten feest: locatie, gasten, menu en de avond zelf.',
    ['gelegenheden'], [{ naam: 'Table', url: '/apps/table.html', pas: 'lifestyle' }]),
  K('gezondheid', 'Health Office', 'Afspraken en uw persoonlijke dossier. Besloten: dit blijft bij u.',
    ['gezondheid'], [{ naam: 'Gezondheid & welzijn', url: '/apps/lifestyle.html', pas: 'lifestyle' },
      { naam: 'Vitaal', url: '/apps/vitaal.html', pas: 'rtg' }]),
  K('onderwijs', 'Education Office', 'Scholen, opleidingen en wat de kinderen nodig hebben.',
    [], [{ naam: 'RTG School', url: '/apps/rtgschool.html', pas: 'rtg' }]),
  K('collectie', 'Culture Office', 'Uw kelder, uw garderobe en uw verzamelingen: wat u heeft en in welke staat.',
    ['collectie'], [{ naam: 'Cellier', url: '/apps/cellier.html', pas: 'lifestyle' },
      { naam: 'Garde-robe', url: '/apps/garderobe.html', pas: 'lifestyle' }]),
  K('gezelschap', 'Staff Office', 'Uw vaste mensen: wie ze zijn, wat er is afgesproken en welke documenten lopen.',
    ['gezelschap', 'staf'], [{ naam: 'Entourage', url: '/apps/entourage.html', pas: 'lifestyle' },
      { naam: 'Maison', url: '/apps/maison.html', pas: 'lifestyle' }]),
  K('filantropie', 'Philanthropy Office', 'Wat u geeft, aan wie, en wat het daar doet.',
    ['filantropie'], [{ naam: 'Mecenaat', url: '/apps/mecenaat.html', pas: 'lifestyle' },
      { naam: 'RTFoundation', url: '/apps/foundation/vrienden.html', pas: 'rtg' }]),
  K('juridisch', 'Legal Office', 'Dossiers, contracten en de afstemming met uw advocaat of notaris.',
    [], [{ naam: 'Juridisch', url: '/apps/juridisch.html', pas: 'rtg' }]),
  K('fiscaal', 'Tax Office', 'Documenten, deadlines en de afstemming met uw accountant. Uw fiscalist beslist.',
    [], [{ naam: 'Belastingkantoor', url: '/apps/belastingkantoor.html', pas: 'rtg' }]),
  K('nalatenschap', 'Legacy Office', 'Uw wensen, uw documenten en uw vertrouwenspersonen. Besloten: dit blijft bij u.',
    ['nalatenschap'], [{ naam: 'Nalatenschap', url: '/apps/nalatenschap.html', pas: 'lifestyle' }]),
  // ---- de vier die er nog niet zijn; zie de kop van dit bestand ----
  K('beveiliging', 'Security Office', 'Fysieke beveiliging, reisrisico en digitale veiligheid, met één ingang bij een incident.', [], []),
  K('reputatie', 'Reputation Office', 'Pers, publieke optredens en wat er online over u staat.', [], []),
  K('inkoop', 'Personal Commerce', 'Persoonlijke inkoop en sourcing: van een cadeau tot een stuk dat nergens te koop is.', [], []),
  K('dieren', 'Pet Office', 'Uw dieren: verzorging, reizen, afspraken en documenten.', [], [])
];

module.exports = (ctx) => {
  const { samenvatting } = ctx;

  /* De plattegrond met de stand van dit lid erop. `status` volgt uit de apps
     (zie de kop), `gevuld` uit de graaf: een kamer kan ingericht zijn en toch
     leeg, en dat is iets anders dan in aanbouw. Het scherm zegt dat verschil
     hardop, want "u heeft hier nog niets staan" nodigt uit en "wij hebben dit
     nog niet gebouwd" is een excuus. */
  function kamers(key, voorafG) {
    const sam = samenvatting(key, voorafG);
    return {
      status: 200,
      kamers: KAMERS.map(k => {
        const telling = k.kamers.reduce((s, naam) => {
          const c = sam.perKamer[naam];
          return { knopen: s.knopen + (c ? c.knopen : 0), waarde: s.waarde + (c ? c.waarde : 0), termijnen: s.termijnen + (c ? c.termijnen : 0) };
        }, { knopen: 0, waarde: 0, termijnen: 0 });
        return Object.assign({}, k, {
          status: k.apps.length ? 'ingericht' : 'in aanbouw',
          gevuld: telling.knopen > 0,
          knopen: telling.knopen, waarde: telling.waarde, termijnen: telling.termijnen
        });
      }),
      ingericht: KAMERS.filter(k => k.apps.length).length,
      inAanbouw: KAMERS.filter(k => !k.apps.length).length
    };
  }

  return { kamers, BUREAU_KAMERS: KAMERS };
};
