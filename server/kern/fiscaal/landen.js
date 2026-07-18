/* Fiscaal (deelmodule): pure data. De btw- en lastentabellen per land
   (LANDEN), de vaste boekhoudcategorieen (FIN_CAT) en de zzp-regimes per
   land (ZZP). Werk het peiljaar en de tabellen elk jaar bij; de rekenende
   functies staan in kern/fiscaal.js. */
const FISCAAL_PEILJAAR = 2025;
const LANDEN = {
  NL: { naam: 'Nederland', alcoholLeeftijd: 18, tarieven: { eten: 9, drank: 21, logies: 9, vervoer: 9, jet: 0, standaard: 21 },
    lasten: 0.28, vakantiegeld: 0.08, uurloonMin: 14.06,
    aangifte: 'Btw-aangifte per kwartaal (of maandelijks), loonaangifte maandelijks bij de Belastingdienst.',
    extra: 'Toeristenbelasting verschilt per gemeente (Amsterdam 12,5% op logies). Eten en niet-alcoholische dranken 9%, alcohol 21%.',
    zakelijk: { horeca: 'Btw op eten en drinken in een horecagelegenheid is NIET aftrekbaar; de kosten zelf zijn wel opvoerbaar.',
      logies: 'Btw op een zakelijke overnachting (9%) is aftrekbaar.',
      vervoer: 'Btw op taxi en openbaar vervoer (9%) is aftrekbaar bij zakelijk gebruik.',
      jet: 'Internationaal personenvervoer valt onder het 0%-tarief; er is dus geen btw om terug te vorderen.' } },
  BE: { naam: 'Belgie', alcoholLeeftijd: 18, tarieven: { eten: 12, drank: 21, logies: 6, vervoer: 6, jet: 0, standaard: 21 },
    lasten: 0.27, vakantiegeld: 0.092, uurloonMin: 12.11,
    aangifte: 'Btw-aangifte per maand of kwartaal; DIMONA-melding voor elk personeelslid voor de eerste werkdag.',
    extra: 'Restaurantdiensten 12%, dranken 21%; de witte kassa (GKS) is verplicht in de horeca boven de omzetdrempel.',
    zakelijk: { horeca: 'Btw op restaurantkosten is niet aftrekbaar; de kosten zijn voor 69% aftrekbaar in de vennootschapsbelasting.',
      logies: 'Btw op een zakelijke hotelovernachting (6%) is aftrekbaar.',
      vervoer: 'Btw op personenvervoer (6%) is beperkt aftrekbaar.',
      jet: 'Internationaal personenvervoer valt onder het 0%-tarief.' } },
  DE: { naam: 'Duitsland', alcoholLeeftijd: 18, tarieven: { eten: 19, drank: 19, logies: 7, vervoer: 7, jet: 0, standaard: 19 },
    lasten: 0.21, vakantiegeld: 0, uurloonMin: 12.82,
    aangifte: 'Umsatzsteuer-Voranmeldung per maand of kwartaal via ELSTER; loonaangifte maandelijks.',
    extra: 'Eten in het restaurant 19%, afhaal en bezorging 7%. Hotelovernachting 7%, maar het ontbijt 19%: gesplitst factureren.',
    zakelijk: { horeca: 'Bewirtungskosten: 70% aftrekbaar als kosten; de btw is volledig aftrekbaar met een correct Bewirtungsbeleg.',
      logies: 'Btw op de overnachting (7%) is aftrekbaar; het ontbijt staat apart op 19%.',
      vervoer: 'Btw op taxiritten tot 50 km (7%) is aftrekbaar.',
      jet: 'Internationaal personenvervoer valt onder het 0%-tarief.' } },
  FR: { naam: 'Frankrijk', alcoholLeeftijd: 18, tarieven: { eten: 10, drank: 20, logies: 10, vervoer: 10, jet: 0, standaard: 20 },
    lasten: 0.42, vakantiegeld: 0, uurloonMin: 11.88,
    aangifte: 'TVA per maand (regime reel) of per kwartaal; taxe de sejour per overnachting per gemeente.',
    extra: 'Eten en niet-alcoholische dranken 10%, alcohol 20%. Werkgeverslasten horen bij de hoogste van Europa.',
    zakelijk: { horeca: 'TVA op zakelijke maaltijden is aftrekbaar met een factuur op bedrijfsnaam.',
      logies: 'TVA op hotelkosten voor eigen werknemers is NIET aftrekbaar; voor genodigden wel.',
      vervoer: 'TVA op personenvervoer is niet aftrekbaar.',
      jet: 'Internationaal personenvervoer valt onder het 0%-tarief.' } },
  ES: { naam: 'Spanje', alcoholLeeftijd: 18, tarieven: { eten: 10, drank: 21, logies: 10, vervoer: 10, jet: 0, standaard: 21 },
    lasten: 0.30, vakantiegeld: 0, uurloonMin: 8.87,
    aangifte: 'IVA per kwartaal (modelo 303) met een jaaroverzicht (modelo 390); loonaangifte maandelijks.',
    extra: 'Horeca en hotels 10%; alcohol in de winkel 21%, als onderdeel van de horecadienst 10%.',
    zakelijk: { horeca: 'IVA op zakelijke maaltijden is aftrekbaar met een volledige factuur (factura completa).',
      logies: 'IVA op zakelijke overnachtingen is aftrekbaar.',
      vervoer: 'IVA op vervoer is aftrekbaar bij zakelijk gebruik.',
      jet: 'Internationaal personenvervoer valt onder het 0%-tarief.' } },
  JP: { naam: 'Japan', alcoholLeeftijd: 20, tarieven: { eten: 10, drank: 10, logies: 10, vervoer: 10, jet: 0, standaard: 10 },
    lasten: 0.16, vakantiegeld: 0, uurloonMin: 6.7,
    aangifte: 'Consumption tax (10%) jaarlijks of per kwartaal; sinds 2023 is een qualified invoice vereist voor aftrek.',
    extra: 'Ter plaatse eten 10%, afhaal 8%. Accommodation tax per stad (sommige steden heffen per persoon per nacht).',
    zakelijk: { horeca: 'Consumption tax op zakelijke maaltijden is aftrekbaar met een qualified invoice.',
      logies: 'Consumption tax op het hotel is aftrekbaar; de accommodation tax is een kostenpost.',
      vervoer: 'Consumption tax op taxiritten is aftrekbaar met een qualified invoice.',
      jet: 'Internationaal personenvervoer valt onder het 0%-tarief.' } }
};

/* ---- de boekhouding van de zaak: btw per genre, personeelskosten, cadeaukaarten ---- */
const FIN_CAT = { eten: 'Eten (keuken)', drank: 'Dranken (bar)', logies: 'Logies', vervoer: 'Personenvervoer', jet: 'Internationaal vervoer', dienst: 'Diensten & producten' };

/* ---- zzp-belastingtool (Business Pass) ----
   Indicatieve berekening voor zelfstandigen per land. Nederland volledig
   (ondernemersaftrek, MKB-vrijstelling, schijven, heffingskortingen, KOR);
   overige landen met het regime en een indicatieve effectieve heffing. */
const ZZP = {
  NL: { regime: 'Eenmanszaak / zzp',
    zelfstandigenaftrek: 2470, startersaftrek: 2123, mkbVrijstelling: 0.127,
    schijven: [[38441, 0.3582], [76817, 0.3748], [Infinity, 0.495]],
    ahk: { max: 3068, afbouwVanaf: 24813, afbouw: 0.06337 },
    arbeidskorting: { max: 5599, afbouwVanaf: 43071, afbouw: 0.0651 },
    korGrens: 20000,
    regels: ['Urencriterium: minimaal 1.225 uur per jaar ondernemen geeft recht op de zelfstandigenaftrek.',
      'MKB-winstvrijstelling: 12,7% van de winst na ondernemersaftrek is vrijgesteld.',
      'KOR: onder € 20.000 omzet per jaar kunt u vrijstelling van btw aanvragen.',
      'Reserveer daarnaast voor de inkomensafhankelijke bijdrage Zvw (~5,26% tot het maximum).'] },
  BE: { regime: 'Zelfstandige in hoofdberoep', simpel: 0.42,
    regels: ['Sociale bijdragen: ~20,5% van het netto belastbaar inkomen, per kwartaal vooruit.',
      'Progressieve personenbelasting van 25% tot 50%, belastingvrije som ~€ 10.910.'] },
  DE: { regime: 'Freiberufler / Einzelunternehmen', simpel: 0.35,
    regels: ['Grundfreibetrag € 12.096; daarboven progressief 14% tot 42% (45% Spitzensteuersatz).',
      'Freiberufler betalen geen Gewerbesteuer; een Gewerbe boven € 24.500 winst wel.'] },
  FR: { regime: 'Micro-entrepreneur (BNC)', simpel: 0.30,
    regels: ['Micro-regime tot € 77.700 omzet voor diensten: sociale lasten ~21,2% van de omzet.',
      'Optioneel versement liberatoire: inkomstenbelasting als vast percentage direct bij de bron.'] },
  ES: { regime: 'Autonomo', simpel: 0.32,
    regels: ['Maandelijkse cuota op basis van de werkelijke inkomsten (tabel per tranche).',
      'IRPF progressief 19% tot 47%; kwartaalvoorschot van 20% via modelo 130.'] },
  JP: { regime: 'Kojin jigyo (eenmanszaak)', simpel: 0.25,
    regels: ['De blauwe aangifte (aoiro shinkoku) geeft tot ¥ 650.000 extra aftrek.',
      'Nationale inkomstenbelasting 5% tot 45%, plus ~10% lokale inkomstenbelasting.'] }
};

/* De rekenende laag: draagt db en de reken-helpers (centen, btwSplit). */

module.exports = { FISCAAL_PEILJAAR, LANDEN, FIN_CAT, ZZP };
