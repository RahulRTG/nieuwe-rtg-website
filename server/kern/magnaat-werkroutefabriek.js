/* Automatische volledige trainingswerkroutes uit de Capability Graph.

   Iedere routefamilie wordt een startbaar synthetisch dossier. De speler opent
   het werkelijk gevonden RTG-scherm, kiest een werkelijk gevonden API-actie,
   legt intake, controle en overdracht vast en krijgt pas daarna een spel-effect.
   Geen stap roept het productie-endpoint aan; de route bewaart uitsluitend in
   de geïsoleerde Magnaat-wereld. */
'use strict';

function spelvormVan(w) {
  const bron = [w.familie, w.naam, w.kantoor && w.kantoor.id].join(' ').toLowerCase();
  if (/pay|bank|betaal|factuur|geld|privacy|toestemming|techniek|beveilig|sso/.test(bron)) return 'controle';
  if (/bericht|chat|sociaal|support|service|balie/.test(bron)) return 'gesprek';
  if (/reis|rit|mob|ticket|hotel|arrival|vracht/.test(bron)) return 'planning';
  if (/foundation|rtf|leren|school|onderzoek/.test(bron)) return 'impact';
  return 'operatie';
}

function actieLabel(actie) {
  const pad = String(actie.route || '').replace(/^\/api\//, '').replace(/\//g, ' › ');
  return String(actie.methode || 'ACTIE') + ' · ' + pad;
}

function maak(w) {
  const schermPad = w.app && /^\/apps\/[^?#]+\.html$/.test(w.app.pad || '')
    ? w.app.pad : '/apps/app.html';
  const acties = (w.acties || []).map(actieLabel);
  const actieOpties = acties.length ? acties : ['CONTROLEREN · ' + String(w.familie || 'codefamilie')];
  return {
    id: w.id,
    naam: w.naam,
    afdeling: w.kantoor.id,
    afdelingNaam: w.kantoor.naam,
    rol: w.rol,
    codeFamilies: [w.familie],
    schermPaden: [schermPad],
    spelvorm: spelvormVan(w),
    veiligheidsniveau: w.risico,
    automatisch: true,
    briefing: 'Behandel een synthetisch dossier voor ' + w.naam + '. Gebruik het echte RTG-scherm en de gevonden codeacties, maar raak nooit productiegegevens.',
    stappen: [
      {
        soort: 'software', doel: 'scherm:' + schermPad, schermPad,
        schermNaam: (w.app && w.app.naam) || 'RTG OS',
        vraag: 'Open het gekoppelde RTG-scherm in de afgeschermde kantoorcomputer.',
        uitleg: 'Het echte scherm is geopend met geïsoleerde opslag en zonder API-, formulier- of apparaatverkeer.'
      },
      {
        soort: 'formulier', vraag: 'Leg de intake en bevoegdheid vast.',
        uitleg: 'Het dossier heeft nu een doel, prioriteit en minimale gegevensset.',
        velden: [
          { id: 'doel', label: 'Doel van het dossier', type: 'tekst', verplicht: true, min: 12, max: 220, placeholder: 'Wat moet aantoonbaar worden bereikt?' },
          { id: 'prioriteit', label: 'Prioriteit', type: 'keuze', verplicht: true, opties: ['Normaal', 'Vandaag', 'Kritiek onder menselijk toezicht'] },
          { id: 'bevoegd', label: 'Rol, doelbinding en minimale gegevens gecontroleerd', type: 'vink', verplicht: true }
        ]
      },
      {
        soort: 'formulier', vraag: 'Voer de gekozen codeactie uit in de trainingskopie.',
        uitleg: 'De gekozen codeactie en onderbouwing staan in het synthetische werklog.',
        velden: [
          { id: 'codeactie', label: 'Gevonden codeactie', type: 'keuze', verplicht: true, opties: actieOpties },
          { id: 'onderbouwing', label: 'Waarom past deze actie?', type: 'tekst', verplicht: true, min: 12, max: 260, placeholder: 'Koppel de actie aan doel, risico en verwacht resultaat.' },
          { id: 'synthetisch', label: 'Alle invoer is synthetisch; productie is niet aangeroepen', type: 'vink', verplicht: true }
        ]
      },
      {
        soort: 'formulier', vraag: 'Controleer resultaat en grensgevallen.',
        uitleg: 'Werking, afwijking en herstelpad zijn gecontroleerd.',
        velden: [
          { id: 'resultaat', label: 'Waargenomen resultaat', type: 'tekst', verplicht: true, min: 12, max: 260, placeholder: 'Wat veranderde in het oefendossier?' },
          { id: 'grens', label: 'Grensgeval of foutpad', type: 'tekst', verplicht: true, min: 10, max: 220, placeholder: 'Wat mag niet stil misgaan?' },
          { id: 'dubbel', label: 'Resultaat en productiegrens dubbel gecontroleerd', type: 'vink', verplicht: true }
        ]
      },
      {
        soort: 'formulier', vraag: 'Draag over en sluit aantoonbaar af.',
        uitleg: 'Eigenaar, volgende controle en afsluitbewijs zijn vastgelegd.',
        velden: [
          { id: 'eigenaar', label: 'Volgende eigenaar', type: 'keuze', verplicht: true, opties: [w.rol, w.kantoor.naam + '-coördinator', 'Boardroom-regisseur'] },
          { id: 'volgende', label: 'Volgend controlemoment', type: 'keuze', verplicht: true, opties: ['Direct', 'Binnen één dienst', 'Voor de volgende economische dag'] },
          { id: 'afsluiting', label: 'Afsluitbewijs', type: 'tekst', verplicht: true, min: 16, max: 300, placeholder: 'Resultaat, eigenaar, risico en volgende stap.' }
        ]
      }
    ]
  };
}

function bouw(workflows) {
  return (Array.isArray(workflows) ? workflows : []).map(maak);
}

module.exports = { bouw, maak };
