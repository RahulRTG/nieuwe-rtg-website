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
     scope       per productvorm (world / academy / classic) waar de regel
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

/* De drie productvormen. Het zijn er drie omdat het drie verwachtingen zijn
   (MAGNAAT.md par. 1); ze delen straks EEN economische kern, maar vandaag niet. */
const SCOPES = {
  world: 'Magnaat World -- de economie (Quick, Campaign, Living World): server/kern/spellen/magnaat/ zonder het bord',
  academy: 'het Oefenkantoor -- server/kern/magnaatwereld.js met de motor server/kern/magnaat-economie.js',
  classic: 'Magnaat Classic -- het bordspel: server/kern/spellen/magnaat/bord.js en bordspel.js'
};

const MAP = 'server/kern/spellen/magnaat';
/* World is de hele magnaatmap behalve het bord. Als lijst en niet als glob,
   zodat de meter bij een nieuw bestand in die map niet stil blind wordt: hij
   leest de map zelf (zie `bestanden` in scripts/magnaatgrondwet.js). */
const WORLD_CODE = { map: MAP, zonder: ['bord.js', 'bordspel.js'] };

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
      academy: {
        autoriteit: 'server/kern/magnaat-economie.js, het journaal',
        handhaver: [{ bestand: 'server/kern/magnaat-economie.js', citaat: 'function boek(e, sleutel, omschrijving, regels, labels = [])' }],
        toets: [{ bestand: 'test/magnaat-economie.test.js', naam: 'de openingsbalans en iedere economische journaalpost zijn exact in balans' }],
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
      academy: { autoriteit: 'geen: er is geen urenmodel', handhaver: 'NIEMAND', toets: 'NIEMAND' }
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
          { bestand: MAP + '/weergave.js', citaat: 'geld: rond(st.geld[mij] || 0),' },
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
      academy: {
        autoriteit: 'server/kern/magnaat-economie.js, de marktstap',
        handhaver: [{ bestand: 'server/kern/magnaat-economie.js', citaat: 'Math.min(b.vraagVandaag, b.capaciteitVandaag, b.voorraad)' }],
        toets: 'NIEMAND'
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
      academy: {
        autoriteit: 'server/kern/magnaat-economie.js, het journaal',
        handhaver: [{ bestand: 'server/kern/magnaat-economie.js', citaat: "throw new Error('Ongebalanceerde journaalpost geweigerd: '" }],
        toets: [{ bestand: 'test/magnaat-economie.test.js', naam: 'de openingsbalans en iedere economische journaalpost zijn exact in balans', bewijst: 'post.regels.length >= 2' }]
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
      academy: { autoriteit: 'server/kern/magnaat-economie.js', handhaver: 'NIEMAND', toets: 'NIEMAND' }
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
      academy: { autoriteit: 'geen: bij tekort volgt automatisch een noodlening', handhaver: 'NIEMAND', toets: 'NIEMAND' }
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
      academy: {
        autoriteit: 'server/kern/magnaat-economie.js, de idempotentiesleutel van boek()',
        handhaver: [{ bestand: 'server/kern/magnaat-economie.js', citaat: "if (!sleutel) throw new Error('Een economische boeking vereist een idempotentiesleutel.');" }],
        toets: [{ bestand: 'test/magnaat-economie.test.js', naam: 'een herhaald commando verwerkt nooit tweemaal dezelfde economische dag' }]
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
      academy: {
        autoriteit: 'server/kern/magnaat-economie.js, het journaal',
        handhaver: 'NIEMAND', toets: 'NIEMAND',
        schending: {
          bestanden: ['server/kern/magnaat-economie.js'],
          patroon: '\\.length\\s*=\\s*MAX_JOURNAAL',
          wat: 'het journaal is een ringbuffer: boven MAX_JOURNAAL vallen de oudste boekingen eraf'
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
      academy: {
        autoriteit: 'server/kern/magnaat-economie.js',
        handhaver: [{ bestand: 'server/kern/magnaat-economie.js', citaat: 'versie: VERSIE, mutatieVersie: 0' }],
        toets: [{ bestand: 'test/magnaat-economie.test.js', naam: 'dezelfde beginsituatie en besluiten geven reproduceerbaar dezelfde economie' }],
        deels: 'alleen een motorversie; geen regelversie, datasetversie of aanmaakmoment'
      }
    },
    migratie: 'Een wereldkop in de kern met alle zes velden, vastgelegd bij het aanmaken en nooit meer gewijzigd.',
    faalwijze: 'Een onderzoeker kan een wereld niet opnieuw draaien, of draait hem op andere regels zonder het te weten.'
  }
];

module.exports = { FAMILIES, SCOPES, REGELS, WORLD_CODE };
