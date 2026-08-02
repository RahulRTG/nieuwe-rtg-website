# RTG en de Nederlandse markt: chat, bellen, horeca, vervoer

*Opgesteld 2 augustus 2026. De cijfers hieronder zijn op die datum live
opgezocht; elke bewering draagt zijn bron. Wat inschatting is, staat er
eerlijk bij als inschatting. Dit document adviseert; de eigenaar beslist.*

## De strategie in een zin

Begin waar de klant al een rekening betaalt die hem boos maakt (horeca),
gebruik chat en bellen als functies binnen die dienst in plaats van als
product ertegenover WhatsApp, en bouw vervoer als shuttle van dezelfde
horecaklant, niet als Uber-concurrent. De rest van het platform is voorraad,
geen aanbod: de uitrolfases in de schakelkast zetten precies dit aan
(FASE_FUNDAMENT is letterlijk "een stad, een sector diep").

## 1. Horeca: de ingang

**De markt is groot genoeg en de pijn heeft een prijskaartje.**

- Nederland telt begin Q3 2026 zo'n 81.840 horecabedrijven, waarvan 16.680
  restaurants ([Ondernemersplein/CBS](https://ondernemersplein.overheid.nl/feiten-en-cijfers/factsheet-horeca/),
  [companydata.com](https://companydata.com/world/hospitality/)).
- Thuisbezorgd rekent 12 tot 15 procent commissie als de zaak zelf bezorgt,
  en 25 tot 35 procent met bezorging erbij; het tarief verschilt per zaak en
  stad en is meermaals verhoogd ([Cashdesk](https://www.cashdesk.nl/prijsverhoging-thuisbezorgd-gevolgen-restaurant/),
  [o-z.nl](https://www.o-z.nl/eten-en-drinken/wat-betalen-restaurants-aan-thuisbezorgd/),
  [Frituurwereld](https://www.frituurwereld.nl/thuisbezorgd-verhoogt-commissie-zeker-niet-voor-het-laatst/)).
  Rekenvoorbeeld: een zaak met 15.000 euro bezorgomzet per maand betaalt bij
  14 procent ruim 2.100 euro per maand. Dat is de rekening waar het
  RTG-gesprek mee opent.
- Kassasystemen kosten in de praktijk 35 tot 150 euro per maand per zaak;
  Lightspeed Restaurant zit op 69 euro per maand plus eenmalig zo'n 700 euro
  hardware ([Horecatweepuntnul](https://horecatweepuntnul.nl/kassasysteem-horeca-prijzen/),
  [prijzen Lightspeed](https://horecatweepuntnul.nl/wat-kost-een-lightspeed-horeca-kassasysteem/)).
  De gangbare stapel (kassa + reserveren + bestelzuil + personeelsrooster)
  is drie of vier losse abonnementen; RTG vervangt die stapel met een.

**Wat RTG al heeft dat de concurrentie mist:** tafelplan, tafelticket en
afrekenen, keukenbord en bedieningskaart, voorraadtelling, verspilling,
menu-analyse en receptadvies zitten in een systeem, en het draait op
codenamen (privacy by design als verkoopargument, niet als bijzin).

**Eerlijk over de tegenstand:** Lightspeed, unTill en MplusKASSA zijn de
gevestigde keuzes in de Nederlandse horeca 2026
([vergelijking](https://www.mpluskassa.nl/nieuws/wat-is-het-beste-kassasysteem-voor-kleine-horeca-in-2026-vergelijk-de-7-populairste-systemen)),
met hardware, support en installateurs. RTG wint daar niet op features maar
op prijs, op een systeem in plaats van vier, en op het eigen bestelkanaal
tegen vaste prijs in plaats van commissie.

**Eerste stap:** drie zaken die de eigenaar persoonlijk kent, gratis, in
ruil voor eerlijke feedback. Niet verkopen; leren.

## 2. Vervoer: shuttle, geen Uber

Ride-hailing in Nederland is kapitaalintensief, tweezijdig (geen chauffeurs
zonder ritten en andersom) en gereguleerd (taxivergunning, chauffeurskaart,
boordcomputer). Dat gevecht is met Uber en Bolt niet te winnen en hoeft ook
niet: wat in de code staat (rides met een vaste statusketen, toewijzing van
vrije chauffeur en voertuig, ETA, nette meldingen) is een shuttle-systeem
voor zaken met eigen vervoer. Hotel naar Schiphol, venue naar huis. Die
markt draait vandaag op WhatsApp en een Excel-lijst, heeft geen
netwerkeffect nodig, en het is dezelfde klant als onder punt 1. Volgorde:
pas aanbieden zodra een zaak al betaalt voor de horeca-kant.

## 3. Chat en bellen: functies, geen producten

WhatsApp is in Nederland de facto standaard; een berichtenmarkt is
winner-take-all en elke Europese uitdager van het afgelopen decennium is
daarop gestrand (inschatting, geen bron nodig: de begraafplaats is
openbaar). RTG-chat en RTG-bellen winnen waar ze context hebben die
WhatsApp niet heeft: gast naar zaak, personeel onderling op de vloer,
gast naar chauffeur, en alles op codenaam. Zo verkoop je ze ook: als reden
waarom de horeca-klant nergens anders heen kan, niet als aparte app.

Technische voorwaarde voor de eerste betalende klant: er is STUN maar geen
TURN-server. Zonder TURN mislukt een deel van de gesprekken op mobiele
netwerken en achter bedrijfsfirewalls stil. Een coturn-server is klein werk
en hoort voor de eerste klant te staan, niet erna.

## 4. De juridische randen (voor go-live, niet erna)

1. **De naam "RTG Bank" kan niet.** Wft artikel 3:7 verbiedt het woord
   "bank" (of vertalingen ervan) in naam of bedrijfsvoering zonder
   bankvergunning; DNB kan ontheffing verlenen maar die moet je dan hebben
   ([DNB, verbod woord bank](https://www.dnb.nl/voor-de-sector/open-boek-toezicht/thema-s/vergunningaanvraag-en-notificatie-markttoegang/verbod-woord-bank/)).
   De app-gids belooft bovendien "sparen en krediet". Hernoemen en
   herformuleren voor er een klant of toezichthouder meekijkt.
2. **RTG Pay met saldi is elektronisch geld.** Vergunningplicht bij DNB;
   de wettelijke beslistermijn is drie maanden maar loopt pas vanaf een
   volledige aanvraag en duurt in de praktijk langer
   ([DNB, duur aanvraag](https://www.dnb.nl/voor-de-sector/open-boek-toezicht/sectoren/elektronischgeldinstellingen/vergunning-elektronischgeldinstellingen-overzichtspagina/duur-vergunningaanvraag/)).
   Er is een route voor klein beginnen: vrijstelling voor kleine
   e-geldinstellingen bij maximaal 5 miljoen euro gemiddeld uitstaand
   e-geld, maximaal 150 euro per rekening, registratie in het openbare
   DNB-register en een jaarlijkse rapportage
   ([DNB, vrijstelling](https://www.dnb.nl/voor-de-sector/open-boek-toezicht/sectoren/elektronischgeldinstellingen/vergunning-elektronischgeldinstellingen-overzichtspagina/vrijstelling-vergunningplicht/)).
   Zolang Stripe de rail is en RTG geen saldi aanhoudt, speelt dit niet;
   het saldo-ontwerp van RTG Pay maakt het WEL actueel. Een uur betaald
   Wft-advies voor de precieze kwalificatie is de goedkoopste verzekering
   van dit hele document. Dit is taak 23 op de lijst.
3. **De 30 procent naar de RTFoundation** is een handelspraktijk zodra hij
   in marketing staat: aantoonbaar maken (ANBI overwegen, jaarlijkse
   verantwoording publiceren).

## Wat dit document niet weet

De prijs die RTG gaat vragen, of er een team en kapitaal is, en de
onderhandelde (niet-gepubliceerde) commissies van individuele zaken bij de
bezorgplatforms. De genoemde percentages zijn publieke bandbreedtes; een
individuele zaak kan erboven of eronder zitten. Dit document is voorlichting
voor de eigen besluitvorming, geen juridisch of fiscaal advies.
