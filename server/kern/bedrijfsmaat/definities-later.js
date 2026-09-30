/* DE DEFINITIES VAN 28 SEPTEMBER 2026 EN LATER (C12 en verder), in dezelfde vorm
   als ./definities.js, waar ze in DEFINITIES worden opgenomen. Een datum per dag,
   want `besloten` is een datum en geen versie. */
'use strict';

const dDag = (dag) => (c, versie, regel, waarom) => Object.freeze({ versie, besloten: dag + ' september 2026, door de eigenaar (C' + c + ')',
  herkomst: 'mens', regel, waarom });
const d28 = dDag(28), d29 = dDag(29), d30 = dDag(30);

module.exports = {
  campagne: d28(12, 1, 'Een campagne is een benoemde linkcode met een begin en een einde, onder precies een kanaal. Haar ' +
    'uitgave is wat Financien per maand voor haar boekt, een deel van de kanaalpost; haar effect het aantal nieuwe leden ' +
    'dat met haar code binnenkwam in dezelfde maand, onder tien leden geen getal.',
    'Geen klikken en geen attributie: wie de link zag en later zelf zocht telt niet mee, dus het effect is een ondergrens.'),
  margePerLid: d29(15, 1, 'De MARGE PER LID is per pas de afgesproken maandbijdrage van die pas (lijstprijs maal aantal, of de som van ' +
    'de lopende contracten) min wat de leden van die pas het huis die maand kostten, gedeeld door ALLE leden van die pas -- ook wie ' +
    'niets gebruikte. Onder tien leden geen getal; een contractuele pas met leden zonder contract krijgt er ook geen.',
    'Per pas, omdat de pas met elke meting meereist en de kostenlaag geen identiteit hoeft op te zoeken; alle leden, omdat een ' +
    'lid dat niets gebruikt ook bijdraagt.'),
  geoLand: d29(16, 1, 'Het LAND van een lid is het land dat hij bij zijn account opgaf; niet gecontroleerd, en geteld per land langs ' +
    'de groepspoort, met kleine landen samen onder Overige.', 'De gegevens staan er al; een naam van een land mag niemand verraden.'),
  geoStad: d29(16, 1, 'De STAD van een lid is de woonplaats die hij in de intake (onboarding) opgaf; niet gecontroleerd, en geteld per ' +
    'stad langs de groepspoort, met kleine plaatsen samen onder Overige.', 'Een stad zegt meer over een mens dan een land, dus Overige begint vroeg.'),
  zakenPerGenre: d29(17, 1, 'Een zaak telt in een maand als zij TOEGELATEN is (niet geschorst of beeindigd) en in die maand minstens een ' +
    'verzoek door haar eigen deur deed; geteld per genre, onder vijf zaken geen getal.', 'Gebruik meten, geen aanmeldingen.'),
  contractVerlengd: d29(18, 1, 'Een contract is VERLENGD als het na zijn einddatum doorloopt (stilzwijgend of uitdrukkelijk). De maat is het ' +
    'aandeel verlengd van de contracten die in de maand op hun beslismoment kwamen (verlengd plus geeindigd); onder tien geen getal.',
    'Meetbaar uit de contractmotor, zonder iets extra van het lid te vragen.'),
  transactievolume: d29(19, 1, 'Het TRANSACTIEVOLUME is wat zaken in de maand via RTG Pay ontvingen, zonder btw: de subtotalen van de ' +
    'facturen met betaalwijze RTG, in de wereld commercieel en nooit als omzet van RTG; onder vijf zaken geen getal.',
    'Zonder btw, zodat het naast de andere geldmaten kan staan.'),
  toelating: d30(20, 1, 'De TOELATING van zaken is het aantal aanmeldingen met een bedrijf per stand (in behandeling, geaccepteerd, ' +
    'klaargezet, afgewezen) plus de mediane doorlooptijd in dagen van aanvraag tot besluit over de besluiten van de maand; onder ' +
    'vijf zaken geen getal.', 'Of het kantoor bijhoudt: de omvang van de rij en hoe lang een zaak wacht.'),
  contractGeeindigd: d30(21, 1, 'CONTRACT GEEINDIGD is het aandeel van de contracten die aan het begin van de maand liepen en in de maand ' +
    'GEEINDIGD bereikten; geteld per contract en niet per lid, onder tien geen getal.',
    'Meetbaar uit de contractmotor zonder een contract eerst aan een codenaam te koppelen.'),
  btwRtg: d30(22, 1, 'De BTW VAN RTG is een voorbereiding per kwartaal: de lidmaatschapstermijnen die in het kwartaal vervielen, zonder btw, ' +
    'maal het standaardtarief; klasse advies, en RTG dient nooit zelf in.', 'Een mens die aangifte doet, begint niet bij nul.')
};
