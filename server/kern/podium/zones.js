/* RTG Podium, deelbestand "zones": DEZELFDE MOTOR, VERSCHILLENDE WERELDEN.

   Het Podium was één product achter één deur: geverifieerd paspoort en 18 jaar,
   voor iedereen die wilde kijken. Dat maakte de hele voorziening onbruikbaar
   voor alles wat níét die deur nodig heeft -- een schoolstream, een
   productlancering, een concert, een besloten coachingsessie -- terwijl de
   techniek eronder (de relay-boom, de chat, RTG Pay, de goedkeuring door een
   mens) voor al die dingen dezelfde is.

   Een kanaal hoort daarom in precies één ZONE, en de zone draagt het beleid:
   wie er mag kijken, wie er mag zenden, hoe er verdiend mag worden, of hij in
   de gedeelde lijst staat, en welke wachtrij van het kantoor hem behandelt.

   WAAROM 18+ EEN EIGEN ZONE IS EN GEEN CATEGORIE. Als "18+" een genre naast
   "koken" is, dan lekt het overal doorheen: in de lijst, in de zoekresultaten,
   in een aanbeveling, in een melding, in een schermafdruk die iemand op zijn
   werk maakt. Als het een eigen zone is, is het een eigen index met een eigen
   deur -- en dan is "niet lekken" een eigenschap van de code in plaats van een
   belofte van de redactie. Zie test/podiumzones.test.js: een kanaal uit die
   zone is niet te zien, niet op te vragen en niet te bereiken zonder de deur.

   DE VERHUIZING VAN WAT ER AL STOND. Elk bestaand kanaal is aangemeld toen het
   Podium ALS GEHEEL achter de 18+-deur zat. Die kanalen gaan daarom naar zone
   'beperkt': niet omdat hun inhoud dat is, maar omdat dat de deur is waar ze nu
   achter staan. Niemand wint of verliest daarmee toegang -- precies de eis die
   test/podiumzones.test.js als eerste vastlegt. Verhuizen naar een andere zone
   is een besluit van een mens bij het kantoor, zoals alles hier.

   WAAR DE ZAKENWERELD AAN HANGT. Zone 'zaak' controleert niet zelf wie waar
   werkt: dat weet de personeelsadministratie al (accounts.staffPositions, de
   koppeling waarmee ook de werk-app meekomt bij het inloggen). Er is hier geen
   tweede ledenlijst per bedrijf gebouwd, en dus ook geen lijst die kan gaan
   afwijken (LAT.md regel 4). Zie test/podiumzaak.test.js: wie nergens werkt,
   wie ergens ANDERS werkt en wie geen leiding heeft, krijgen alle drie een
   ander antwoord -- en dat verschil is het bewijs dat de controle op het
   kanaal zit en niet alleen op de deur van de wereld.

   EN WAT DE VERKOOPWERELD NIET DOET. Zone 'handel' verplaatst geld (RTG Pay,
   dezelfde route als een cadeau) en legt een bestelling bij de maker neer. RTG
   bezorgt niets: geen adres, geen verzending, geen retourregeling. De maker zet
   daarom op elke productkaart hoe de koper het krijgt. Zolang dat zo is, mag
   het scherm ook niets anders beloven (LAT.md regel 6). Staat in TAKEN.md. */
'use strict';

const ZONES = {
  open: {
    naam: 'Live', omschrijving: 'Open voor alle leden: gaming, muziek, praten, sport, les.',
    kijken: { lid: true }, zenden: { goedkeuring: true },
    geld: ['cadeau'], index: 'gedeeld', wachtrij: 'open'
  },
  creator: {
    naam: 'Creator', omschrijving: 'Voor makers met een club eromheen: maandabonnement en cadeaus.',
    kijken: { lid: true }, zenden: { goedkeuring: true },
    geld: ['cadeau', 'abonnement'], index: 'gedeeld', wachtrij: 'open'
  },
  evenement: {
    naam: 'Events', omschrijving: 'Concert, wedstrijd of premiere op een kaartje. Wie geen kaartje heeft, komt er niet in.',
    kijken: { lid: true, kaartje: true }, zenden: { goedkeuring: true },
    geld: ['kaartje', 'cadeau'], index: 'gedeeld', wachtrij: 'open'
  },
  besloten: {
    naam: 'Besloten', omschrijving: 'Een op een, een kleine groep, coaching. Alleen wie de maker uitnodigt.',
    kijken: { lid: true, uitnodiging: true }, zenden: { goedkeuring: true },
    geld: ['cadeau'], index: 'geen', wachtrij: 'open'
  },
  beperkt: {
    naam: '18+', omschrijving: 'Een afgescheiden wereld met een eigen deur, eigen lijst en eigen wachtrij.',
    kijken: { lid: true, geverifieerd: true, minLeeftijd: 18 },
    zenden: { goedkeuring: true, geverifieerd: true, minLeeftijd: 18 },
    geld: ['cadeau', 'abonnement'], index: 'apart', wachtrij: 'beperkt'
  },
  zaak: {
    naam: 'Business', omschrijving: 'Interne uitzending van een organisatie: town hall, training, aandeelhouders. Alleen wie er werkt komt binnen.',
    kijken: { lid: true, organisatie: true }, zenden: { organisatie: true, leiding: true },
    /* Geen geld. Een town hall die fooien aanneemt van het eigen personeel is
       geen town hall; en een training verkoopt hier geen kaartjes -- dat is
       een evenement en dus een andere zone. */
    geld: [], index: 'geen', wachtrij: 'zaak'
  },
  handel: {
    naam: 'Commerce', omschrijving: 'Live verkopen: productkaarten met een prijs en voorraad, afrekenen tijdens de uitzending.',
    kijken: { lid: true }, zenden: { goedkeuring: true },
    geld: ['cadeau', 'verkoop'], index: 'gedeeld', wachtrij: 'open'
  }
};

const STANDAARD = 'open';
// wat een kanaal krijgt dat nog van voor de zones is: de deur waar het achter stond
const ERFENIS = 'beperkt';

const zoneVan = (k) => (k && ZONES[k.zone] ? k.zone : ERFENIS);
const zoneMag = (zoneId) => (ZONES[zoneId] && !ZONES[zoneId].dicht ? ZONES[zoneId] : null);

/* De poort per zone. `lat` levert de twee harde controles die dit huis al had:
   is dit een echt account, en is het geverifieerd en oud genoeg. De rest van de
   eisen (kaartje, uitnodiging) hangt aan het KANAAL en staat daarom in
   magKanaal hieronder. */
function maakZonePoort({ lat, zakenVan }) {
  /* Bij welke organisaties hoort dit lid, en waar heeft hij de leiding? Komt
     uit de personeelsadministratie die het huis al heeft (accounts.
     staffPositions via kern/podium/index.js) -- geen tweede lijst hier. */
  const zaken = (key) => (zakenVan ? zakenVan(key) : []);
  function magZone(key, zoneId) {
    const z = ZONES[zoneId];
    if (!z) return { ok: false, reden: 'Deze zone bestaat niet.' };
    if (z.dicht) return { ok: false, reden: z.dicht, dicht: true };
    const eis = z.kijken || {};
    if (eis.geverifieerd || eis.minLeeftijd) {
      const p = lat(key, eis.minLeeftijd || 0);
      if (!p.ok) return p;
    } else if (eis.lid) {
      const p = lat(key, 0, { alleenAccount: true });
      if (!p.ok) return p;
    }
    if (eis.organisatie && !zaken(key).length)
      return { ok: false, reden: 'Deze wereld is van organisaties; u werkt nergens waar RTG van weet.' };
    return { ok: true };
  }

  /* Zenden is een aparte vraag dan kijken: in de 18+-zone moet ook de MAKER
     geverifieerd zijn, en in een zakenzone hoort een privepersoon niet te
     kunnen uitzenden. Waar de eisen gelijk zijn, valt hij op magZone terug. */
  function magZenden(key, zoneId) {
    const z = ZONES[zoneId];
    if (!z) return { ok: false, reden: 'Deze zone bestaat niet.' };
    if (z.dicht) return { ok: false, reden: z.dicht, dicht: true };
    const eis = z.zenden || {};
    if (eis.geverifieerd || eis.minLeeftijd) {
      const p = lat(key, eis.minLeeftijd || 0);
      if (!p.ok) return p;
    } else {
      const p = lat(key, 0, { alleenAccount: true });
      if (!p.ok) return p;
    }
    if (eis.organisatie) {
      const mijne = zaken(key);
      if (!mijne.length) return { ok: false, reden: 'Alleen vanuit een organisatie waar u werkt.' };
      /* Een interne uitzending start niet zomaar iemand: dat is de leiding.
         Anders kan elke medewerker een "town hall" beginnen waar de hele zaak
         in kan kijken. */
      if (eis.leiding && !mijne.some(z2 => z2.leiding))
        return { ok: false, reden: 'Een interne uitzending start de leiding van de zaak.' };
    }
    return { ok: true };
  }

  /* De deur van EEN KANAAL: eerst de zone, daarna wat alleen dit kanaal weet.
     De maker komt altijd bij zijn eigen kanaal -- anders kan hij zijn eigen
     besloten sessie niet openen. */
  function magKanaal(key, k) {
    const zoneId = zoneVan(k);
    const basis = magZone(key, zoneId);
    if (!basis.ok) return basis;
    if (k && k.key === key) return { ok: true, maker: true };
    const eis = (ZONES[zoneId].kijken) || {};
    if (eis.uitnodiging && !((k.genodigd || []).includes(key)))
      return { ok: false, reden: 'Dit is een besloten kanaal; de maker nodigt uit.' };
    if (eis.kaartje && !kaartjeGeldig(k, key))
      return { ok: false, reden: 'Hiervoor heeft u een kaartje nodig.', kaartje: true };
    if (eis.organisatie && !zaken(key).some(z2 => z2.code === k.zaakCode))
      return { ok: false, reden: 'Deze uitzending is van een organisatie waar u niet werkt.' };
    return { ok: true };
  }

  const kaartjeGeldig = (k, key) => {
    const tot = ((k && k.kaartjes) || {})[key];
    return !!tot && new Date(tot).getTime() > Date.now();
  };

  /* Mag er in deze zone op deze manier geld lopen? Een town hall neemt geen
     fooien aan, en een gratis kanaal verkoopt geen kaartjes. Eén tabel, en elke
     betaalroute vraagt hem -- anders staat de regel in de tekst en niet in de
     code (LAT.md regel 6). */
  const geldMag = (k, vorm) => ((ZONES[zoneVan(k)] || {}).geld || []).includes(vorm);

  return { magZone, magZenden, magKanaal, geldMag, kaartjeGeldig };
}

/* Wat een lid van de zones te zien krijgt: naam, uitleg, of hij open is, en
   waarom niet. Zonder die reden is een dichte deur niet te onderscheiden van
   een deur die er niet is. */
function zoneLijst(key, poort) {
  return Object.keys(ZONES).map((id) => {
    const z = ZONES[id];
    const k = poort.magZone(key, id);
    const zend = poort.magZenden(key, id);
    return { id, naam: z.naam, omschrijving: z.omschrijving,
      geld: z.geld, index: z.index,
      kijken: k.ok, kijkReden: k.ok ? null : k.reden,
      zenden: zend.ok, zendReden: zend.ok ? null : zend.reden,
      dicht: !!z.dicht };
  });
}

module.exports = { ZONES, STANDAARD, ERFENIS, zoneVan, zoneMag, maakZonePoort, zoneLijst };
