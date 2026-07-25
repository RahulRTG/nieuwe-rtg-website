/* RTG Office, de sjablonen: een vliegende start voor het werk dat op een
   kantoorvloer echt gedaan wordt. Pure inhoud, geen logica.

   Elk sjabloon draagt een groep, zodat de kiezer op het scherm ze ordent in
   plaats van er een lange lijst van te maken. De cijfersjablonen staan met
   formules erin (=SOM, =GEM); de opmaak zegt per cel of het een kop, een
   geldbedrag, een percentage of een gewoon getal is, zodat een blad er
   meteen uitziet als een blad en niet als los tekstwerk. */

const SJABLONEN = {
  /* ---- schrijven ---- */
  memo: { soort: 'tekst', groep: 'Bestuur', titel: 'Directiememo', inhoud: { tekst:
    '<h1>Memo</h1><p><b>Aan:</b> <br><b>Van:</b> <br><b>Datum:</b> <br><b>Betreft:</b> </p>' +
    '<h2>Kern</h2><p>Waar gaat dit over, in twee zinnen.</p>' +
    '<h2>Achtergrond</h2><p></p>' +
    '<h2>Voorstel</h2><ol><li></li></ol>' +
    '<h2>Gevraagd besluit</h2><p>Wat vragen we, van wie, voor wanneer.</p>' } },
  notulen: { soort: 'tekst', groep: 'Bestuur', titel: 'Notulen', inhoud: { tekst:
    '<h1>Notulen</h1><p><b>Datum:</b> · <b>Voorzitter:</b> · <b>Notulist:</b> </p>' +
    '<p><b>Aanwezig:</b> </p><p><b>Afwezig met bericht:</b> </p>' +
    '<h2>1. Opening en vaststelling agenda</h2><p></p>' +
    '<h2>2. Besluiten</h2><ul><li></li></ul>' +
    '<h2>3. Actiepunten</h2><ol><li>Wie · wat · wanneer</li></ol>' +
    '<h2>4. Rondvraag en sluiting</h2><p></p>' } },
  brief: { soort: 'tekst', groep: 'Algemeen', titel: 'Zakelijke brief', inhoud: { tekst:
    '<p>[Uw naam of zaak]<br>[Adres]<br>[Postcode en plaats]</p>' +
    '<p>[Geadresseerde]<br>[Adres]</p><p>[Plaats], [datum]</p>' +
    '<p><b>Betreft:</b> </p><p>Geachte ,</p><p><br></p>' +
    '<p>Met vriendelijke groet,</p><p><br><br>[Naam]<br>[Functie]</p>' } },
  termsheet: { soort: 'tekst', groep: 'Commercieel', titel: 'Term sheet (niet-bindend)', inhoud: { tekst:
    '<h1>Term sheet</h1><p><i>Niet-bindend, met uitzondering van geheimhouding en exclusiviteit. ' +
    'Onder voorbehoud van due diligence en definitieve documentatie.</i></p>' +
    '<h2>Partijen</h2><p></p><h2>Transactie</h2><p></p>' +
    '<h2>Waardering en bedrag</h2><p></p><h2>Voorwaarden vooraf</h2><ul><li></li></ul>' +
    '<h2>Governance</h2><p></p><h2>Exclusiviteit en looptijd</h2><p></p>' +
    '<h2>Geheimhouding</h2><p></p><h2>Toepasselijk recht</h2><p></p>' } },
  dd: { soort: 'tekst', groep: 'Juridisch', titel: 'Due-diligence checklist', inhoud: { tekst:
    '<h1>Due-diligence checklist</h1><p>Per onderdeel: opgevraagd, ontvangen, beoordeeld, bevinding.</p>' +
    '<h2>Vennootschappelijk</h2><ul><li>Statuten en uittreksel</li><li>Aandeelhoudersregister</li><li>Besluiten AVA en bestuur</li></ul>' +
    '<h2>Financieel</h2><ul><li>Jaarrekeningen drie jaar</li><li>Tussentijdse cijfers</li><li>Bankconvenanten</li></ul>' +
    '<h2>Contracten</h2><ul><li>Top-10 klanten</li><li>Top-10 leveranciers</li><li>Change-of-control-clausules</li></ul>' +
    '<h2>Personeel</h2><ul><li>Arbeidsovereenkomsten</li><li>Pensioenregeling</li><li>Lopende geschillen</li></ul>' +
    '<h2>Naleving en risico</h2><ul><li>Vergunningen</li><li>Privacy en gegevensverwerking</li><li>Verzekeringen</li></ul>' } },
  projectplan: { soort: 'tekst', groep: 'Algemeen', titel: 'Projectplan', inhoud: { tekst:
    '<h1>Projectplan</h1><h2>Aanleiding</h2><p></p><h2>Doel en resultaat</h2><p></p>' +
    '<h2>Afbakening</h2><p>Wel in scope · niet in scope.</p>' +
    '<h2>Aanpak en fasering</h2><ol><li></li></ol>' +
    '<h2>Team en rollen</h2><p></p><h2>Planning en mijlpalen</h2><p></p>' +
    '<h2>Budget</h2><p></p><h2>Risico\'s en beheersing</h2><ul><li></li></ul>' } },

  /* ---- rekenen ---- */
  begroting: { soort: 'blad', groep: 'Financieel', titel: 'Jaarbegroting', inhoud: { cellen: {
    A1: 'Post', B1: 'Q1', C1: 'Q2', D1: 'Q3', E1: 'Q4', F1: 'Jaar',
    A2: 'Omzet', F2: '=SOM(B2:E2)',
    A3: 'Inkoopwaarde', F3: '=SOM(B3:E3)',
    A4: 'Brutomarge', B4: '=B2-B3', C4: '=C2-C3', D4: '=D2-D3', E4: '=E2-E3', F4: '=SOM(B4:E4)',
    A6: 'Personeel', F6: '=SOM(B6:E6)',
    A7: 'Huisvesting', F7: '=SOM(B7:E7)',
    A8: 'Marketing', F8: '=SOM(B8:E8)',
    A9: 'Overig', F9: '=SOM(B9:E9)',
    A10: 'Totaal kosten', B10: '=SOM(B6:B9)', C10: '=SOM(C6:C9)', D10: '=SOM(D6:D9)', E10: '=SOM(E6:E9)', F10: '=SOM(B10:E10)',
    A12: 'Resultaat', B12: '=B4-B10', C12: '=C4-C10', D12: '=D4-D10', E12: '=E4-E10', F12: '=F4-F10'
  }, opmaak: {
    A1: 'kop', B1: 'kop', C1: 'kop', D1: 'kop', E1: 'kop', F1: 'kop',
    A4: 'kop', A10: 'kop', A12: 'kop',
    B2: 'geld', C2: 'geld', D2: 'geld', E2: 'geld', F2: 'geld',
    B3: 'geld', C3: 'geld', D3: 'geld', E3: 'geld', F3: 'geld',
    B4: 'geld', C4: 'geld', D4: 'geld', E4: 'geld', F4: 'geld',
    B6: 'geld', C6: 'geld', D6: 'geld', E6: 'geld', F6: 'geld',
    B7: 'geld', C7: 'geld', D7: 'geld', E7: 'geld', F7: 'geld',
    B8: 'geld', C8: 'geld', D8: 'geld', E8: 'geld', F8: 'geld',
    B9: 'geld', C9: 'geld', D9: 'geld', E9: 'geld', F9: 'geld',
    B10: 'geld', C10: 'geld', D10: 'geld', E10: 'geld', F10: 'geld',
    B12: 'geld', C12: 'geld', D12: 'geld', E12: 'geld', F12: 'geld'
  }, rijen: 16, kolommen: 7 } },
  kasstroom: { soort: 'blad', groep: 'Financieel', titel: 'Kasstroom, 13 weken', inhoud: { cellen: {
    A1: 'Week', B1: 'Beginsaldo', C1: 'Ontvangsten', D1: 'Uitgaven', E1: 'Eindsaldo',
    A2: '1', E2: '=B2+C2-D2',
    A3: '2', B3: '=E2', E3: '=B3+C3-D3',
    A4: '3', B4: '=E3', E4: '=B4+C4-D4',
    A5: '4', B5: '=E4', E5: '=B5+C5-D5',
    A7: 'Totaal in', C7: '=SOM(C2:C5)',
    A8: 'Totaal uit', D8: '=SOM(D2:D5)'
  }, opmaak: {
    A1: 'kop', B1: 'kop', C1: 'kop', D1: 'kop', E1: 'kop', A7: 'kop', A8: 'kop',
    B2: 'geld', C2: 'geld', D2: 'geld', E2: 'geld',
    B3: 'geld', C3: 'geld', D3: 'geld', E3: 'geld',
    B4: 'geld', C4: 'geld', D4: 'geld', E4: 'geld',
    B5: 'geld', C5: 'geld', D5: 'geld', E5: 'geld',
    C7: 'geld', D8: 'geld'
  }, rijen: 20, kolommen: 6 } },
  kpi: { soort: 'blad', groep: 'Financieel', titel: 'Maandcijfers en KPI', inhoud: { cellen: {
    A1: 'KPI', B1: 'Doel', C1: 'Werkelijk', D1: 'Verschil', E1: 'Score',
    A2: 'Omzet', D2: '=C2-B2', E2: '=C2/B2',
    A3: 'Brutomarge', D3: '=C3-B3', E3: '=C3/B3',
    A4: 'Nieuwe klanten', D4: '=C4-B4', E4: '=C4/B4',
    A5: 'Verloop personeel', D5: '=C5-B5', E5: '=C5/B5',
    A6: 'Klanttevredenheid', D6: '=C6-B6', E6: '=C6/B6'
  }, opmaak: {
    A1: 'kop', B1: 'kop', C1: 'kop', D1: 'kop', E1: 'kop',
    B2: 'geld', C2: 'geld', D2: 'geld', E2: 'procent',
    B3: 'geld', C3: 'geld', D3: 'geld', E3: 'procent',
    E4: 'procent', E5: 'procent', E6: 'procent'
  }, rijen: 14, kolommen: 6 } },
  factuurblad: { soort: 'blad', groep: 'Algemeen', titel: 'Factuurregels', inhoud: { cellen: {
    A1: 'Omschrijving', B1: 'Aantal', C1: 'Prijs', D1: 'Regel',
    D2: '=B2*C2', D3: '=B3*C3', D4: '=B4*C4',
    C6: 'Subtotaal', D6: '=SOM(D2:D4)',
    C7: 'Btw 21%', D7: '=D6*0,21',
    C8: 'Totaal', D8: '=D6+D7'
  }, opmaak: {
    A1: 'kop', B1: 'kop', C1: 'kop', D1: 'kop', C6: 'kop', C7: 'kop', C8: 'kop',
    C2: 'geld', C3: 'geld', C4: 'geld',
    D2: 'geld', D3: 'geld', D4: 'geld', D6: 'geld', D7: 'geld', D8: 'geld'
  }, rijen: 16, kolommen: 6 } },
  weekplan: { soort: 'blad', groep: 'Algemeen', titel: 'Weekplanning', inhoud: { cellen: {
    A1: 'Dag', B1: 'Ochtend', C1: 'Middag', D1: 'Avond',
    A2: 'Maandag', A3: 'Dinsdag', A4: 'Woensdag', A5: 'Donderdag', A6: 'Vrijdag', A7: 'Zaterdag', A8: 'Zondag'
  }, opmaak: { A1: 'kop', B1: 'kop', C1: 'kop', D1: 'kop' }, rijen: 12, kolommen: 5 } },

  /* ---- presenteren ---- */
  boardpack: { soort: 'presentatie', groep: 'Bestuur', titel: 'Bestuursvergadering', inhoud: { dias: [
    { indeling: 'titel', titel: 'Bestuursvergadering', tekst: '[Datum] · [Plaats]', notitie: 'Welkom, vaststellen agenda.' },
    { indeling: 'punten', titel: 'Agenda', tekst: 'Cijfers\nOperatie\nBesluiten\nRondvraag', notitie: '' },
    { indeling: 'cijfer', titel: 'De maand in een cijfer', tekst: 'Zet hier het cijfer dat de maand samenvat.', notitie: 'Noem eerst het cijfer, dan de duiding.' },
    { indeling: 'twee', titel: 'Wat ging goed / wat niet', tekst: 'Goed:\n\nNiet:', notitie: '' },
    { indeling: 'punten', titel: 'Gevraagde besluiten', tekst: 'Besluit 1\nBesluit 2', notitie: 'Per besluit: wie, wat, wanneer.' }
  ] } },
  investering: { soort: 'presentatie', groep: 'Commercieel', titel: 'Investeringsvoorstel', inhoud: { dias: [
    { indeling: 'titel', titel: 'Investeringsvoorstel', tekst: '[Onderwerp] · [Bedrag]', notitie: '' },
    { indeling: 'punten', titel: 'De vraag', tekst: 'Wat vragen we\nWaarvoor\nWanneer', notitie: '' },
    { indeling: 'twee', titel: 'Business case', tekst: 'Kosten:\n\nOpbrengsten:', notitie: 'Terugverdientijd expliciet noemen.' },
    { indeling: 'cijfer', titel: 'Terugverdientijd', tekst: '[maanden]', notitie: '' },
    { indeling: 'punten', titel: 'Risico\'s', tekst: 'Risico en beheersing per punt', notitie: '' },
    { indeling: 'citaat', titel: 'Het besluit', tekst: 'Wat vragen we de vergadering nu te besluiten?', notitie: '' }
  ] } },
  pitch: { soort: 'presentatie', groep: 'Commercieel', titel: 'Pitch', inhoud: { dias: [
    { indeling: 'titel', titel: 'De titel van uw verhaal', tekst: 'Wie u bent, in een zin.', notitie: '' },
    { indeling: 'punten', titel: 'Het probleem', tekst: 'Wat lost u op, en voor wie?', notitie: '' },
    { indeling: 'punten', titel: 'De oplossing', tekst: 'Hoe u het oplost; een zin per punt.', notitie: '' },
    { indeling: 'cijfer', titel: 'De markt', tekst: '[bedrag of aantal]', notitie: '' },
    { indeling: 'citaat', titel: 'De vraag', tekst: 'Wat heeft u nodig van de zaal?', notitie: '' }
  ] } }
};

module.exports = { SJABLONEN };
