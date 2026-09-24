/* ============================================================================
   DE MAGNAAT-GRONDWET, ALS VERKLARING DIE EEN METER KAN NALOPEN.

   MAGNAAT.md zegt in gewone taal wat economische waarheid in Magnaat is. Dit
   bestand zegt per regel WIE dat afdwingt, en in welke vorm dat na te lopen is.
   Het beweert niets zonder bewijs: scripts/magnaatgrondwet.js zoekt elk citaat
   letterlijk op in de CODE (commentaar telt niet -- een zin die belooft dat
   iets veilig is, dwingt niets af), zoekt elke toets op naam op, en telt de
   schendingen zelf. De stand van een regel wordt daaruit BEREKEND en staat
   hier nergens: wie hem hier zou kunnen invullen, kon hem ook mooier maken.

   VORM PER REGEL
     id          M-001 ... ; de negentien stichtingsregels houden hun nummer,
                 nieuwe regels krijgen een nummer in hun familie (M-1xx ...).
     familie     sleutel uit FAMILIES; de klasse, los van het nummer.
     invariant   de zin die altijd waar moet zijn. Staat woordelijk in
                 MAGNAAT.md; test/magnaatgrondwet.test.js zakt als die twee
                 uit elkaar lopen.
     scope       per productvorm (world / motor / academy / classic) waar de regel
                 vandaag geldt:
                   autoriteit  welk onderdeel de waarheid bezit
                   handhaver   [{ bestand, citaat }] of 'NIEMAND'
                   toets       [{ bestand, naam, bewijst? }] of 'NIEMAND'
                               `bewijst` is een stukje code dat in de toets
                               moet staan: een toets met de goede NAAM die
                               het ding niet controleert, telt niet.
                   schending   { bestanden, patroon, wat } -- een telling van
                               code die de regel vandaag breekt. Boven nul is
                               de scope VIOLATION, wat er verder ook staat.
                   deels       een reden waarom deze scope hooguit PARTIAL is
                               terwijl handhaver en toets er wel staan.
     migratie    wat er nog om moet
     faalwijze   wat er gebeurt als de regel breekt

   NIEMAND IS EEN GELDIGE HANDHAVER. Het is de eerlijke stand van een regel die
   bedoeld is maar door niets wordt tegengehouden, en hij wordt zo geteld:
   ABSENT. Een scope die er niet is, staat er niet in -- er wordt geen scope
   verzonnen om een regel groen te laten lijken.
   ========================================================================== */
'use strict';

const FAMILIES = {
  'M-0': { naam: 'Economische waarheid', over: 'geld, grootboek, eigendom, voorraad' },
  'M-1': { naam: 'Marktwaarheid', over: 'prijzen, vraag, aanbod, transacties, concurrentie' },
  'M-2': { naam: 'Mens- en werkwaarheid', over: 'tijd, arbeid, vaardigheden, beschikbaarheid' },
  'M-3': { naam: 'Informatiewaarheid', over: 'kennis, voorspellingen, onzekerheid, oorzaak' },
  'M-4': { naam: 'Wereldwaarheid', over: 'tijd, plaatsen, bevolking, voortgang zonder speler' },
  'M-5': { naam: 'Ondernemingswaarheid', over: 'bedrijven, contracten, belangen, insolventie' },
  'M-6': { naam: 'Simulatie-integriteit', over: 'seed, versie, herhaling, determinisme' },
  'M-7': { naam: 'AI-grens', over: 'wat Rahul wel en niet bepaalt' },
  'M-8': { naam: 'Spelzuiverheid', over: 'geen verborgen geldinjecties, geen rubber-banding, gelijke regels' },
  'M-9': { naam: 'Privacy en veiligheid', over: 'geen woonadressen, synthetische personen, scheiding echt/spel' }
};

/* Drie productvormen en de ene economische autoriteit eronder. De producten
   zijn er drie omdat het drie verwachtingen zijn (MAGNAAT.md par. 1). De motor
   is sinds ronde A1 een eigen scope: wat daar geldt, geldt voor elke consument
   die op hem draait -- vandaag het Oefenkantoor, na A2 ook World. */
const SCOPES = {
  world: 'Magnaat World -- de economie (Quick, Campaign, Living World): server/kern/spellen/magnaat/ zonder het bord',
  motor: 'de economische motor -- server/kern/magnaat-economische-motor/, het economische model van het Oefenkantoor boven het grootboek',
  grootboek: 'het grootboek -- server/kern/magnaat-grootboek/, de ene boekhoudautoriteit onder elke Magnaat-economie (MAGNAAT.md, ronde A2.0)',
  academy: 'het Oefenkantoor -- server/kern/magnaatwereld.js en zijn adapter server/kern/magnaat-oefeneconomie.js',
  classic: 'Magnaat Classic -- het bordspel: server/kern/spellen/magnaat/bord.js en bordspel.js'
};

const MAP = 'server/kern/spellen/magnaat';
/* World is de hele magnaatmap behalve het bord. Als lijst en niet als glob,
   zodat de meter bij een nieuw bestand in die map niet stil blind wordt: hij
   leest de map zelf (zie `bestanden` in scripts/magnaatgrondwet.js). */
/* boekhouding.js staat er met opzet ook buiten: dat is de ENE weg waarlangs World
   sinds ronde A2.3 een saldo schrijft -- na een boeking in het grootboek, met
   hetzelfde bedrag. Een mutatie daar is de projectie en geen schending. */
const WORLD_CODE = { map: MAP, zonder: ['bord.js', 'bordspel.js', 'boekhouding.js'] };

/* EEN SCHENDING, EENMAAL GESCHREVEN. Twee regels (M-001 en M-005) wijzen naar
   dezelfde vondst: in World wordt een saldo rechtstreeks verhoogd of verlaagd.
   Dat is een vondst die twee regels breekt, en hij telt bij allebei -- maar het
   patroon staat hier een keer, zodat de twee tellingen niet uit elkaar lopen. */
const DIRECTE_SALDOMUTATIE = {
  bestanden: WORLD_CODE,
  patroon: '\\bgeld\\s*\\[[^\\]]+\\]\\s*[-+*/]?=(?!=)',
  wat: 'een saldo dat rechtstreeks wordt gezet, verhoogd of verlaagd (st.geld[h] += ...), zonder journaalpost'
};
const BUDGET_BUITEN_GROOTBOEK = {
  bestanden: ['server/kern/magnaatwereld.js'],
  patroon: '\\.virtueelBudget\\s*[-+]?=(?!=)',
  wat: 'spelgeld dat als beloning wordt bijgeschreven buiten het grootboek van de motor om'
};

const REGELS = [
  {
    id: 'M-001', familie: 'M-0',
    invariant: 'Geld heeft altijd herkomst: elke verandering van een saldo is terug te voeren op een geboekte gebeurtenis.',
    scope: {
      world: {
        autoriteit: 'geen: het saldo zelf (st.geld) is de waarheid',
        handhaver: 'NIEMAND', toets: 'NIEMAND',
        schending: DIRECTE_SALDOMUTATIE
      },
      grootboek: {
        autoriteit: 'server/kern/magnaat-grootboek/, het journaal',
        handhaver: [{ bestand: 'server/kern/magnaat-grootboek/boeken.js', citaat: 'function boek(p, sleutel, soort, omschrijving, regels, labels = [])' }],
        toets: [{ bestand: 'test/magnaat-economie.test.js', naam: 'de openingsbalans en iedere economische journaalpost zijn exact in balans' }]
      },
      motor: {
        autoriteit: 'het grootboek; de motor boekt alleen via zijn functies',
        handhaver: [{ bestand: 'server/kern/magnaat-economische-motor/index.js', citaat: 'Object.assign(m, grootboek);' }],
        toets: [{ bestand: 'test/magnaat-grootboek.test.js', naam: '2. de motor boekt nergens buiten het grootboek om' }]
      },
      academy: {
        autoriteit: 'server/kern/magnaatwereld.js (spelerbudget)',
        handhaver: 'NIEMAND', toets: 'NIEMAND',
        schending: BUDGET_BUITEN_GROOTBOEK
      }
    },
    migratie: 'World gaat op de economische kern draaien (ronde A2/A4): een saldo wordt een projectie van het journaal. In het Oefenkantoor gaat de beloning via een journaalpost of verlaat hij het geldbegrip.',
    faalwijze: 'Op de vraag "waar kwam deze 312 vandaan?" is geen antwoord; een fout in een spelregel maakt of vernietigt geld zonder spoor.'
  },
  {
    id: 'M-002', familie: 'M-2',
    invariant: 'Tijd kan niet dubbel worden besteed: een uur van een actor is op hetzelfde wereldmoment hooguit een keer ingezet.',
    scope: {
      world: { autoriteit: 'geen: er is geen urenmodel', handhaver: 'NIEMAND', toets: 'NIEMAND' },
      motor: { autoriteit: 'geen: er is geen urenmodel', handhaver: 'NIEMAND', toets: 'NIEMAND' }
    },
    migratie: 'Een tijd- en capaciteitsboek in de kern (vertical slice V2); contractcapaciteit wordt bij het tekenen gereserveerd in plaats van achteraf naar rato verdeeld.',
    faalwijze: 'Een speler levert aan drie klanten tegelijk met dezelfde uren; tekorten verschijnen pas bij afrekening, verdeeld over iedereen.'
  },
  {
    id: 'M-003', familie: 'M-3',
    invariant: 'Geen actor bezit informatie die hij niet heeft verkregen: een beslissing gebruikt alleen wat die actor kan weten.',
    scope: {
      world: {
        autoriteit: 'server/kern/spellen/magnaat/weergave.js',
        handhaver: [
          { bestand: MAP + '/weergave.js', citaat: 'geld: euroTonen(st.geld[mij] || 0),' },
          { bestand: MAP + '/weergave.js', citaat: 'return (st.contracten || []).filter(c => partij(c, h))' }
        ],
        toets: [
          { bestand: 'test/spelmagnaat.test.js', naam: 'bij de economie zijn de boeken van een ander niet van jou' },
          { bestand: 'test/spelveiling.test.js', naam: "niemand ziet andermans bod, ook niet in de publieke of kijkerweergave" }
        ],
        deels: 'geldt voor wat SPELERS te zien krijgen; er zijn nog geen NPC-bedrijven, dus voor beslissende niet-spelers bestaat er geen informatiemodel'
      }
    },
    migratie: 'Een informatiemotor: wat iedere actor weet is toestand, en een NPC beslist alleen daarop (M-3xx).',
    faalwijze: 'Een tegenstander reageert op een prijs of kas die hij niet kan kennen; het spel voelt vals.'
  },
  {
    id: 'M-004', familie: 'M-0',
    invariant: 'Voorraad kan niet negatief worden.',
    scope: {
      motor: {
        autoriteit: 'server/kern/magnaat-economische-motor/markt.js, de marktstap',
        handhaver: [{ bestand: 'server/kern/magnaat-economische-motor/markt.js', citaat: 'Math.min(b.vraagVandaag, b.capaciteitVandaag, b.voorraad)' }],
        toets: [{ bestand: 'test/magnaat-economische-motor.test.js', naam: '5. 10.000+ gebeurtenissen: projectie klopt, journaal volledig, beslissen leest niet, herhaling gelijk', bewijst: 'b.voorraad >= 0' }]
      }
    },
    migratie: 'Een toets die verkopen tegen voorraad afzet (de bestaande toets draagt voorraad in zijn naam maar controleert alleen vraag en capaciteit); World krijgt voorraad pas met de kern.',
    faalwijze: 'Er wordt verkocht wat er niet is; omzet zonder goederen.'
  },
  {
    id: 'M-005', familie: 'M-0',
    invariant: 'Een transactie heeft minimaal twee economische zijden, en debet is gelijk aan credit.',
    scope: {
      world: {
        autoriteit: 'geen: er is geen journaal',
        handhaver: 'NIEMAND', toets: 'NIEMAND',
        schending: DIRECTE_SALDOMUTATIE
      },
      grootboek: {
        autoriteit: 'server/kern/magnaat-grootboek/, het journaal',
        handhaver: [{ bestand: 'server/kern/magnaat-grootboek/boeken.js', citaat: "throw new Error('Ongebalanceerde journaalpost geweigerd: '" }],
        toets: [
          { bestand: 'test/magnaat-economie.test.js', naam: 'de openingsbalans en iedere economische journaalpost zijn exact in balans', bewijst: 'post.regels.length >= 2' },
          { bestand: 'test/magnaat-grootboek.test.js', naam: '3. een consument zonder dagen of bedrijven kan boeken, bevestigen, herstellen en verifieren', bewijst: '/Ongebalanceerde/' }
        ]
      },
      motor: {
        autoriteit: 'het grootboek; de motor boekt alleen via zijn functies',
        handhaver: [{ bestand: 'server/kern/magnaat-economische-motor/index.js', citaat: 'Object.assign(m, grootboek);' }],
        toets: [{ bestand: 'test/magnaat-grootboek.test.js', naam: '2. de motor boekt nergens buiten het grootboek om' }]
      }
    },
    migratie: 'Zelfde weg als M-001: World boekt via de kern. De geldpompmeter blijft ernaast staan tot de eigenschapstoetsen er zijn.',
    faalwijze: 'Geld verschijnt of verdwijnt aan een kant; de totalen kloppen alleen nog binnen een ruismarge.'
  },
  {
    id: 'M-006', familie: 'M-8',
    invariant: 'NPC-bedrijven en spelers vallen onder dezelfde economische kernregels.',
    scope: {
      world: { autoriteit: 'geen: er zijn geen NPC-bedrijven', handhaver: 'NIEMAND', toets: 'NIEMAND' },
      motor: { autoriteit: 'server/kern/magnaat-economische-motor/', handhaver: 'NIEMAND', toets: 'NIEMAND' }
    },
    migratie: 'Een NPC is een actor in de kern met een eigen beslisser; de kern kent geen apart pad voor NPC\'s. Een toets zet een speler en een NPC in dezelfde situatie en eist dezelfde boekingen.',
    faalwijze: 'NPC\'s krijgen stilletjes gratis krediet of voorraad; spelers verliezen van een tegenstander die niet echt concurreert.'
  },
  {
    id: 'M-007', familie: 'M-7',
    invariant: 'AI mag economische toestand verklaren, nooit verzinnen.',
    scope: {
      world: { autoriteit: 'de motor; er zit vandaag geen model in Magnaat', handhaver: 'NIEMAND', toets: 'NIEMAND' },
      academy: { autoriteit: 'de motor; uitleg is vaste tekst', handhaver: 'NIEMAND', toets: 'NIEMAND' }
    },
    migratie: 'Zodra Rahul in Magnaat verschijnt: de AI krijgt alleen leestoegang op toestand (STATE -> UITLEG) en een toets eist dat geen AI-pad een boeking kan maken.',
    faalwijze: '"De AI besluit dat je 5 miljoen verdiend hebt."'
  },
  {
    id: 'M-008', familie: 'M-8',
    invariant: 'Er bestaat geen verborgen score op een mens: elk cijfer over een speler is voor die speler zichtbaar met zijn opbouw.',
    scope: {
      world: { autoriteit: 'server/kern/spellen/magnaat/weergave.js (kredietprofiel)', handhaver: 'NIEMAND', toets: 'NIEMAND' },
      academy: { autoriteit: 'server/kern/magnaatwereld.js (xp, reputatie)', handhaver: 'NIEMAND', toets: 'NIEMAND' }
    },
    migratie: 'Een toets die elk veld over een speler in de staat afzet tegen wat die speler te zien krijgt.',
    faalwijze: 'Een onzichtbaar getal bepaalt kansen, prijzen of tegenstanders.'
  },
  {
    id: 'M-009', familie: 'M-9',
    invariant: 'Geen woonadres is speelbaar bezit: alles met een woonfunctie valt uit de kaart.',
    scope: {
      world: {
        autoriteit: 'scripts/kaart-import.js, de importeur van de kaart',
        handhaver: [{ bestand: 'scripts/kaart-import.js', citaat: "if (doelen.includes('woonfunctie')) return { weg: 'woonfunctie' };" }],
        toets: 'NIEMAND'
      }
    },
    migratie: 'Een toets die een woonfunctie-object door de importeur haalt en eist dat het wegvalt.',
    faalwijze: 'Iemands huis wordt een kavel in een spel.'
  },
  {
    id: 'M-010', familie: 'M-5',
    invariant: 'Faillissement vernietigt geen geld zonder tegenpost; het is een proces en geen drempel.',
    scope: {
      world: { autoriteit: 'geen: failliet gaan bestaat in World niet, een negatief saldo kost rente', handhaver: 'NIEMAND', toets: 'NIEMAND' },
      motor: { autoriteit: 'geen: bij tekort volgt automatisch een noodlening (geldstromen.js)', handhaver: 'NIEMAND', toets: 'NIEMAND' }
    },
    migratie: 'Een insolventieproces in de kern: liquiditeitsdruk, achterstand, herstructurering, afwikkeling -- elke stap geboekt, verliezen bij schuldeisers volgens de regels.',
    faalwijze: 'Een bedrijf verdwijnt en neemt geld mee dat nergens meer staat, of het leeft eeuwig door op nooit aflopende noodleningen.'
  },
  {
    id: 'M-011', familie: 'M-5',
    invariant: 'Een contractverplichting is tijdgebonden toestand: zij begint en eindigt op een wereldmoment.',
    scope: {
      world: {
        autoriteit: 'server/kern/spellen/magnaat/handel-acties.js en maand-contracten.js',
        handhaver: [
          { bestand: MAP + '/handel-acties.js', citaat: 'c.eindMaand = st.maand + c.looptijd;' },
          { bestand: MAP + '/maand-contracten.js', citaat: "if (st.maand + 1 >= c.eindMaand) c.status = 'afgelopen';" }
        ],
        toets: [
          { bestand: 'test/spelhandel.test.js', naam: 'een contract kan niet langer lopen dan de campagne, en de rondes zijn eindig' },
          { bestand: 'test/spelhandel.test.js', naam: 'de afkoopsom loopt nooit op tot meer dan de resterende looptijd' }
        ]
      }
    },
    migratie: 'Contracten verhuizen mee naar de kern; hun begin en eind worden gebeurtenissen in het journaal.',
    faalwijze: 'Een verplichting loopt eeuwig door of verdwijnt halverwege.'
  },
  {
    id: 'M-012', familie: 'M-3',
    invariant: 'Een voorspelling is geen feit: een vooruitblik draagt een andere stand dan een uitkomst tot hij is gerealiseerd.',
    scope: {
      academy: {
        autoriteit: 'server/kern/magnaat-economenlab-training.js',
        handhaver: [{ bestand: 'server/kern/magnaat-economenlab-training.js', citaat: "status: 'wacht-op-realisatie'" }],
        toets: [{ bestand: 'test/magnaat-economenlab.test.js', naam: 'de volgende dag ijkt de forecast en maakt de trainingsscore definitief' }]
      },
      world: { autoriteit: 'geen: World kent nog geen vooruitblik', handhaver: 'NIEMAND', toets: 'NIEMAND' }
    },
    migratie: 'Een vooruitblik in World wordt een eigen soort toestand naast het journaal, nooit een boeking.',
    faalwijze: 'Een verwachting verschijnt als saldo; een speler plant op geld dat er niet is.'
  },
  {
    id: 'M-013', familie: 'M-3',
    invariant: 'Correlatie is geen causaliteit: een uitleg noemt alleen oorzaken die de motor werkelijk heeft doorgerekend.',
    scope: {
      world: { autoriteit: 'geen', handhaver: 'NIEMAND', toets: 'NIEMAND' },
      academy: { autoriteit: 'server/kern/magnaat-economenlab-rapport.js', handhaver: 'NIEMAND', toets: 'NIEMAND' }
    },
    migratie: 'Elke uitleg verwijst naar gebeurtenis-id\'s uit de causale keten; een toets eist dat een genoemde oorzaak als gebeurtenis bestaat.',
    faalwijze: 'De uitleg klinkt overtuigend en is verzonnen; een speler leert de verkeerde les.'
  },
  {
    id: 'M-014', familie: 'M-4',
    invariant: 'Een speler die offline is, stopt de wereld niet.',
    scope: {
      world: {
        autoriteit: 'server/kern/spellen/magnaat/economie.js, het bijrekenen op de klok',
        handhaver: [{ bestand: MAP + '/economie.js', citaat: 'let stappen = Math.floor((nu - st.gerekendTot) / st.maandMs);' }],
        toets: [{ bestand: 'test/spelmagnaat.test.js', naam: 'bijrekenen is deterministisch: tien maanden in een keer of tien los' }]
      }
    },
    migratie: 'Blijft; de klok verhuist mee naar de kern (Time Engine).',
    faalwijze: 'Iedereen wacht op de traagste speler; een permanente wereld staat stil.'
  },
  {
    id: 'M-015', familie: 'M-8',
    invariant: 'Spelbalans mag het grootboek nooit vervalsen: geen speler of spelregel maakt waarde uit het niets.',
    scope: {
      world: {
        autoriteit: 'server/kern/spellen/magnaat/handel.js (prijsband) en scripts/magnaat-pomp.js',
        handhaver: [
          { bestand: MAP + '/handel.js', citaat: 'const PRIJSBAND = [0.4, 2.0];' },
          { bestand: 'scripts/magnaat-pomp.js', citaat: 'RUIS' }
        ],
        toets: [
          { bestand: 'test/spelhandel.test.js', naam: 'geen enkel scenario van de geldpomp-keuring maakt waarde uit het niets' },
          { bestand: 'test/spelbank.test.js', naam: 'geen van de zes financieringsroutes maakt waarde uit het niets' },
          { bestand: 'test/magnaat-rtgketen.test.js', naam: '2. geen enkel pompscenario maakt waarde uit het niets' }
        ],
        deels: 'de pompmeter kent alleen de scenario\'s die erin geschreven zijn, en vergelijkt totalen binnen een ruismarge; er is nog geen eigenschapstoets over willekeurige reeksen transacties'
      },
      academy: {
        autoriteit: 'server/kern/magnaatwereld.js (spelerbudget)',
        handhaver: 'NIEMAND', toets: 'NIEMAND',
        schending: BUDGET_BUITEN_GROOTBOEK
      }
    },
    migratie: 'Eigenschapstoetsen over duizenden willekeurige transacties (debet = credit, geen onverklaarde creatie, geen dubbele gebeurtenis, herhaling geeft dezelfde eindstaat); de beloning in het Oefenkantoor gaat via het grootboek of verlaat het geldbegrip.',
    faalwijze: 'Een volgorde van acties die de speler rijk maakt zonder dat iemand armer wordt.'
  },
  {
    id: 'M-016', familie: 'M-0',
    invariant: 'Eigendom is exclusief: een bezit is op hetzelfde wereldmoment van hooguit een eigenaar en wordt niet tweemaal overgedragen.',
    scope: {
      world: {
        autoriteit: 'server/kern/spellen/magnaat/veiling-acties.js en aandeel.js',
        handhaver: [
          { bestand: MAP + '/veiling-acties.js', citaat: "return { status: 409, error: 'Dat kavel staat al in de veiling.' }" },
          { bestand: MAP + '/aandeel.js', citaat: 'const MAX_DEEL = 49;' }
        ],
        toets: [
          { bestand: 'test/spelveiling.test.js', naam: 'een gewonnen kavel is van de winnaar, en van niemand anders' },
          { bestand: 'test/spelveiling.test.js', naam: 'een kavel dat in de veiling staat is niet ondertussen te grijpen' },
          { bestand: 'test/spelaandeel.test.js', naam: 'meer dan de helft van een zaak kun je niet weggeven' }
        ]
      }
    },
    migratie: 'Eigendom wordt een register in de kern, met overdracht als geboekte gebeurtenis.',
    faalwijze: 'Twee spelers bezitten hetzelfde kavel, of een aandeel wordt twee keer verkocht.'
  },
  {
    id: 'M-017', familie: 'M-6',
    invariant: 'Iedere economische mutatie heeft een gebeurtenisidentiteit: opnieuw verwerken levert geen tweede economisch resultaat op.',
    scope: {
      grootboek: {
        autoriteit: 'server/kern/magnaat-grootboek/, de idempotentiesleutel in het journaal',
        handhaver: [
          { bestand: 'server/kern/magnaat-grootboek/boeken.js', citaat: "if (!sleutel) throw new Error('Een economische boeking vereist een idempotentiesleutel.');" },
          { bestand: 'server/kern/magnaat-grootboek/opslag.js', citaat: "throw new Error('Journaal weigert: sleutel '" }
        ],
        toets: [
          { bestand: 'test/magnaat-economie.test.js', naam: 'een herhaald commando verwerkt nooit tweemaal dezelfde economische dag' },
          { bestand: 'test/magnaat-economische-motor.test.js', naam: '9. dezelfde wereld en dezelfde handelingen geven dezelfde gebeurtenissen, id voor id' }
        ]
      },
      world: { autoriteit: 'geen: een spelactie draagt geen gebeurtenis-id', handhaver: 'NIEMAND', toets: 'NIEMAND' }
    },
    migratie: 'Elke spelactie wordt een gebeurtenis met een id; ook voorraad, belangen, contracten, loon en eigendom (niet alleen geld).',
    faalwijze: 'Een dubbelklik of een herstart na een storing boekt dezelfde verkoop twee keer.'
  },
  {
    id: 'M-018', familie: 'M-6',
    invariant: 'Historie is alleen aanvullen: een economische gebeurtenis wordt nooit achteraf herschreven of weggegooid, een correctie is een nieuwe gebeurtenis.',
    scope: {
      grootboek: {
        autoriteit: 'server/kern/magnaat-grootboek/opslag.js, het journaal in de eigen collectie magnaatJournaal',
        handhaver: [
          { bestand: 'server/kern/magnaat-grootboek/opslag.js', citaat: "throw new Error('Journaal weigert: volgnummer '" },
          { bestand: 'server/kern/magnaat-grootboek/opslag.js', citaat: 'Object.freeze(g);' }
        ],
        toets: [
          { bestand: 'test/magnaat-economische-motor.test.js', naam: '3. het journaal vult alleen aan: geen gat, geen dubbel, geen inkorten, niets herschrijven' },
          { bestand: 'test/magnaat-economische-motor.test.js', naam: '5. 10.000+ gebeurtenissen: projectie klopt, journaal volledig, beslissen leest niet, herhaling gelijk', bewijst: "alles[0].sleutel, 'opening:rtg'" }
        ],
        /* Het oude patroon (een ringbuffer op MAX_JOURNAAL) plus elke andere
           manier om de lijst gebeurtenissen korter te maken. */
        schending: {
          bestanden: { map: 'server/kern/magnaat-grootboek', zonder: [] },
          patroon: 'gebeurtenissen\\.(?:splice|shift|pop)\\(|gebeurtenissen\\.length\\s*=(?!=)|\\.length\\s*=\\s*MAX_JOURNAAL',
          wat: 'een journaal dat korter wordt: een afkapping, een ringbuffer of een weggehaalde gebeurtenis'
        }
      },
      world: { autoriteit: 'geen: er is geen gebeurtenishistorie, alleen maandverslagen', handhaver: 'NIEMAND', toets: 'NIEMAND' }
    },
    migratie: 'Het journaal krijgt opslag die groeit (of een afgesloten periode met een openingsbalans die het verleden samenvat en bewaart), nooit een afkapping.',
    faalwijze: 'Een herhaling vanaf het begin kan niet meer: de eerste boekingen zijn weg.'
  },
  {
    id: 'M-019', familie: 'M-6',
    invariant: 'Wereldregels zijn versiegebonden: een wereld draagt wereld-id, seed, regelversie, motorversie, datasetversie en aanmaakmoment.',
    scope: {
      world: {
        autoriteit: 'server/kern/spellen/magnaat/economie.js',
        handhaver: [{ bestand: MAP + '/economie.js', citaat: "seed: 'magnaat-'+potje.id" }],
        toets: [{ bestand: 'test/spelmagnaat.test.js', naam: 'bijrekenen is deterministisch: tien maanden in een keer of tien los' }],
        deels: 'de seed volgt uit het potje-id, maar er wordt geen regel-, motor- of datasetversie bij de wereld bewaard'
      },
      grootboek: {
        autoriteit: 'server/kern/magnaat-grootboek/, elke gebeurtenis',
        handhaver: [
          { bestand: 'server/kern/magnaat-grootboek/boeken.js', citaat: 'wereld: g.wereld, volgnummer: p.boekVolgorde, soort, oorzaak,' },
          { bestand: 'server/kern/magnaat-grootboek/boeken.js', citaat: 'regelVersie: g.versies.regel, motorVersie: g.versies.motor,' }
        ],
        toets: [
          { bestand: 'test/magnaat-economie.test.js', naam: 'dezelfde beginsituatie en besluiten geven reproduceerbaar dezelfde economie' },
          { bestand: 'test/magnaat-economische-motor.test.js', naam: '9. dezelfde wereld en dezelfde handelingen geven dezelfde gebeurtenissen, id voor id' }
        ],
        deels: 'elke gebeurtenis draagt wereld-id, volgnummer, regel- en motorversie; er is nog geen seed, datasetversie of aanmaakmoment als wereldkop (ronde A4)'
      }
    },
    migratie: 'Een wereldkop in de kern met alle zes velden, vastgelegd bij het aanmaken en nooit meer gewijzigd.',
    faalwijze: 'Een onderzoeker kan een wereld niet opnieuw draaien, of draait hem op andere regels zonder het te weten.'
  },
  {
    /* Ronde A2.1, een harde regel van de eigenaar: het grootboek rondt nooit
       af. Wanneer en hoe een bedrag wordt afgerond kan economisch betekenis
       hebben, dus dat is domeinbeleid en gebeurt een keer, voor er geboekt
       wordt. */
    id: 'M-020', familie: 'M-0',
    invariant: 'Geld is een geheel aantal eurocenten: het grootboek rondt nooit af en weigert elk ander bedrag, en een economische gebeurtenis wordt een keer afgerond voordat er geboekt wordt, zodat beide kanten exact hetzelfde bedrag dragen.',
    scope: {
      grootboek: {
        autoriteit: 'server/kern/magnaat-grootboek/geld.js',
        handhaver: [{ bestand: 'server/kern/magnaat-grootboek/geld.js', citaat: "if (typeof n !== 'number' || !Number.isSafeInteger(n) || n < 0) {" }],
        toets: [{ bestand: 'test/magnaat-grootboek.test.js', naam: '5. het grootboek accepteert alleen gehele, niet-negatieve eurocenten en rondt nooit af', bewijst: "'1234'" }]
      },
      world: {
        autoriteit: 'server/kern/spellen/magnaat/centen.js, de ene plek waar World een bedrag tot geld maakt',
        handhaver: [
          { bestand: MAP + '/centen.js', citaat: 'const uit = Math.round(Number(cent.toFixed(6)));' },
          { bestand: MAP + '/maand-contracten.js', citaat: 'betaling[c.id] = naarCenten(H.afwikkelen(c,' }
        ],
        toets: [
          { bestand: 'test/magnaat-world-geld.test.js', naam: '4. na elke stap is elk monetair veld een geheel aantal eurocenten', bewijst: 'Number.isSafeInteger(houder[veld])' },
          { bestand: 'test/magnaat-world-geld.test.js', naam: '5. een contractbetaling draagt aan beide kanten exact hetzelfde bedrag', bewijst: 'niet gevoelig voor de volgorde van afronden' }
        ]
      }
    },
    migratie: 'Geen voor World en het grootboek: sinds ronde A2.1 rekent World in hele eurocenten en wordt een gebeurtenis een keer afgerond. Wat nog rest is dat World zijn geld nog niet via het grootboek boekt (A2.3 t/m A2.9).',
    faalwijze: 'De betaler betaalt 10,01 en de ontvanger krijgt 10,00: een cent ontstaat of verdwijnt uit het niets.'
  },
  {
    /* De eerste regel met een familienummer. Hij kwam uit ronde A1: de motor is
       losgemaakt uit het Oefenkantoor, en dat mag niet stil terugkruipen. De
       toets hield het al vast; als grondwetregel telt de meter het zelf, en een
       terugval is een VIOLATION die de ratel tegenhoudt. */
    id: 'M-601', familie: 'M-6',
    invariant: 'De economische motor kent geen consument en het grootboek kent geen domein: de afhankelijkheid loopt alleen van consument naar motor naar grootboek.',
    scope: {
      motor: {
        autoriteit: 'server/kern/magnaat-economische-motor/index.js: wat per wereld verschilt komt binnen via profiel en haken',
        handhaver: [
          { bestand: 'server/kern/magnaat-economische-motor/index.js', citaat: 'const m = { wereld, profiel, wereldState, opslag, save, haken,' },
          { bestand: 'server/kern/magnaat-economische-motor/index.js', citaat: 'keurProfiel(profiel);' }
        ],
        toets: [
          { bestand: 'test/magnaat-economische-motor.test.js', naam: '2. de motor kent het Oefenkantoor niet, en leunt er ook niet op', bewijst: 'TOEGESTAAN' }
        ],
        /* Dezelfde woorden en dezelfde toegestane requires als toets 2, zodat
           meter en toets niet uit elkaar lopen. Gelezen zonder commentaar: een
           uitleg die het Oefenkantoor NOEMT is geen afhankelijkheid. */
        schending: {
          bestanden: { map: 'server/kern/magnaat-economische-motor', zonder: [] },
          vlaggen: 'i',
          patroon: 'praktijk|oefen|missie|economenlab|magnaatwereld|academy|spelvorm|functieId|[\'"]rtg[\'"]|\\btaak\\b' +
            '|require\\(\\s*[\'"](?!\\.\\/[a-z-]+[\'"]|\\.\\.\\/magnaat-grootboek(?:\\/geld)?[\'"]|\\.\\.\\/magnaat-motorklant[\'"]|\\.\\.\\/eigencollectie[\'"]|\\.\\.\\/\\.\\.\\/lib\\/klok[\'"])',
          wat: 'de motor noemt een consument (Oefenkantoor, Academy, missie, spelvorm) of laadt iets buiten zichzelf, het grootboek, zijn Rust-client, de opslagdeclaratie en de klok'
        }
      },
      /* Het grootboek eronder mag nog minder weten: ook geen markt, bedrijf of
         spel. Dezelfde woorden als test/magnaat-grootboek.test.js toets 1. */
      grootboek: {
        autoriteit: 'server/kern/magnaat-grootboek/index.js: soorten, versies en periode komen van de consument',
        handhaver: [{ bestand: 'server/kern/magnaat-grootboek/index.js', citaat: "if (!soorten || typeof soorten !== 'object') throw new Error('Het grootboek vereist de lijst gebeurtenissoorten.');" }],
        toets: [{ bestand: 'test/magnaat-grootboek.test.js', naam: '1. het grootboek kent geen domein en laadt niets buiten zichzelf en de opslag', bewijst: 'TOEGESTAAN' }],
        schending: {
          bestanden: { map: 'server/kern/magnaat-grootboek', zonder: [] },
          vlaggen: 'i',
          patroon: 'oefen|praktijk|missie|economenlab|academy|spelvorm|markt|bedrij|profiel|schok|restaurant|toerist|kavel|vestiging|[\'"]rtg[\'"]' +
            '|require\\(\\s*[\'"](?!\\.\\/[a-z-]+[\'"]|\\.\\.\\/eigencollectie[\'"])',
          wat: 'het grootboek noemt een domein (Oefenkantoor, markt, bedrijf, spel) of laadt iets buiten zichzelf en de opslagdeclaratie'
        }
      }
    },
    migratie: 'Geen: dit is de stand na ronde A1. Bij A2 komt World erbij als tweede consument, via de boekhoudkant van de motor en niet via het marktmodel van het Oefenkantoor.',
    faalwijze: 'Een wijziging voor het Oefenkantoor verandert stil de economie van elke wereld die op de motor draait.'
  }
];

module.exports = { FAMILIES, SCOPES, REGELS, WORLD_CODE };
