/* RTG Office, de sjablonen (deel 2): presenteren, vragen en schetsen.
   Deel 1 (schrijven en rekenen) staat in sjablonen.js; die voegt de twee
   delen samen tot de ene SJABLONEN. Pure inhoud, geen logica. */

module.exports = {
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
  ] } },

  /* ---- vragen ---- */
  rondvraag: { soort: 'formulier', groep: 'Algemeen', titel: 'Rondvraag na afloop', inhoud: { wijze: 'anoniem', vragen: [
    { tekst: 'Hoe waardeert u het geheel?', soort: 'schaal', opties: [] },
    { tekst: 'Wat sprong er in positieve zin uit?', soort: 'open', opties: [] },
    { tekst: 'Wat doen we de volgende keer beter?', soort: 'open', opties: [] },
    { tekst: 'Doet u de volgende keer weer mee?', soort: 'keuze', opties: ['Ja', 'Waarschijnlijk', 'Nee'] }
  ] } },
  stemming: { soort: 'formulier', groep: 'Bestuur', titel: 'Stemming over een voorstel', inhoud: { wijze: 'codenaam', vragen: [
    { tekst: 'Het voorstel', soort: 'keuze', opties: ['Voor', 'Tegen', 'Onthouding'] },
    { tekst: 'Toelichting (mag leeg blijven)', soort: 'open', opties: [] }
  ] } },

  /* ---- schetsen ---- */
  organigram: { soort: 'schets', groep: 'Bestuur', titel: 'Organigram', inhoud: { vormen: [
    { soort: 'kader', x: 500, y: 60, b: 200, h: 60, tekst: 'Directie' },
    { soort: 'pijl', x: 600, y: 120, x2: 320, y2: 220, tekst: '' },
    { soort: 'pijl', x: 600, y: 120, x2: 600, y2: 220, tekst: '' },
    { soort: 'pijl', x: 600, y: 120, x2: 880, y2: 220, tekst: '' },
    { soort: 'kader', x: 220, y: 220, b: 200, h: 60, tekst: 'Operatie' },
    { soort: 'kader', x: 500, y: 220, b: 200, h: 60, tekst: 'Financiën' },
    { soort: 'kader', x: 780, y: 220, b: 200, h: 60, tekst: 'Commercie' }
  ] } },
  stroomschema: { soort: 'schets', groep: 'Algemeen', titel: 'Stroomschema', inhoud: { vormen: [
    { soort: 'ovaal', x: 80, y: 80, b: 160, h: 60, tekst: 'Start' },
    { soort: 'pijl', x: 240, y: 110, x2: 360, y2: 110, tekst: '' },
    { soort: 'ruit', x: 360, y: 60, b: 200, h: 100, tekst: 'Akkoord?' },
    { soort: 'pijl', x: 560, y: 110, x2: 700, y2: 110, tekst: 'ja' },
    { soort: 'kader', x: 700, y: 80, b: 180, h: 60, tekst: 'Uitvoeren' },
    { soort: 'pijl', x: 460, y: 160, x2: 460, y2: 260, tekst: 'nee' },
    { soort: 'kader', x: 360, y: 260, b: 200, h: 60, tekst: 'Aanpassen' }
  ] } }
};
