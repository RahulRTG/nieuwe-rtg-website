/* Mobility OS (datamodule): de voertuigcatalogus.

   EEN VOERTUIGMODEL, NIET ZESTIEN. Een helikopter en een taxibus delen alles
   wat er toe doet -- ze hebben een capaciteit, een bestuurder, papieren met een
   einddatum, een locatie en een beschikbaarheid. Wat ze NIET delen staat hier
   per categorie, als uitbreiding op datzelfde model. Een aparte technische
   wereld per voertuigsoort betekent dat elke nieuwe soort de dispatch, de
   matching en het grootboek opnieuw moet leren; zo is het een rij erbij.

   Per categorie:
   - laag:      weg | rail | water | lucht  (bepaalt welke papieren logisch zijn)
   - module:    welke vervoersmodule aan moet staan voor dit voertuig
   - boeking:   direct | aanvraag | ervaring  (zie hieronder)
   - plaatsen:  standaardcapaciteit; per voertuig te overschrijven
   - bagage:    standaard aantal koffers
   - papieren:  documenten die MOETEN gelden voor het voertuig inzetbaar is
   - bemanning: hoeveel mensen er minstens aan boord horen te werken
   - rolstoel:  of de categorie standaard rolstoeltoegankelijk is

   DE DRIE BOEKINGSVORMEN zijn geen cosmetiek. 'direct' gaat vanzelf naar een
   chauffeur. 'aanvraag' krijgt altijd een mens ertussen (helikopter, jet, boot)
   -- daar hangt een exploitantvergunning, een weersminimum en een namenlijst
   aan, en niets daarvan mag een automaat besluiten. 'ervaring' is een oldtimer
   of een paard en wagen: je koopt geen verplaatsing maar een uur. */

const CATEGORIEEN = {
  // ---- weg, direct boekbaar ----
  auto:        { naam: 'Auto', laag: 'weg', module: 'ride_hailing', boeking: 'direct', plaatsen: 4, bagage: 2, bemanning: 1,
                 papieren: ['kenteken', 'verzekering', 'apk'] },
  taxi:        { naam: 'Taxi', laag: 'weg', module: 'ride_hailing', boeking: 'direct', plaatsen: 4, bagage: 3, bemanning: 1,
                 papieren: ['kenteken', 'verzekering', 'apk', 'taxivergunning', 'boordcomputer'] },
  taxibus:     { naam: 'Taxibus', laag: 'weg', module: 'ride_hailing', boeking: 'direct', plaatsen: 8, bagage: 8, bemanning: 1,
                 papieren: ['kenteken', 'verzekering', 'apk', 'taxivergunning', 'boordcomputer'] },
  rolstoelbus: { naam: 'Rolstoelbus', laag: 'weg', module: 'wheelchair_transport', boeking: 'direct', plaatsen: 6, bagage: 4, bemanning: 1,
                 rolstoel: true, papieren: ['kenteken', 'verzekering', 'apk', 'taxivergunning', 'rolstoelkeuring'] },
  shuttlebus:  { naam: 'Shuttlebus', laag: 'weg', module: 'corporate_shuttles', boeking: 'direct', plaatsen: 16, bagage: 16, bemanning: 1,
                 papieren: ['kenteken', 'verzekering', 'apk', 'busvergunning'] },
  touringcar:  { naam: 'Touringcar', laag: 'weg', module: 'event_transport', boeking: 'aanvraag', plaatsen: 50, bagage: 50, bemanning: 1,
                 papieren: ['kenteken', 'verzekering', 'apk', 'busvergunning', 'tachograaf'] },
  limousine:   { naam: 'Limousine', laag: 'weg', module: 'ride_hailing', boeking: 'direct', plaatsen: 6, bagage: 4, bemanning: 1,
                 papieren: ['kenteken', 'verzekering', 'apk', 'taxivergunning'] },
  fiets:       { naam: 'Fiets', laag: 'weg', module: 'ride_hailing', boeking: 'direct', plaatsen: 1, bagage: 0, bemanning: 0, papieren: [] },
  scooter:     { naam: 'Scooter', laag: 'weg', module: 'ride_hailing', boeking: 'direct', plaatsen: 1, bagage: 0, bemanning: 0,
                 papieren: ['kenteken', 'verzekering'] },

  // ---- weg, als ervaring ----
  oldtimer:    { naam: 'Oldtimer', laag: 'weg', module: 'experience_transport', boeking: 'ervaring', plaatsen: 4, bagage: 1, bemanning: 1,
                 papieren: ['kenteken', 'verzekering', 'apk'] },
  tuktuk:      { naam: 'Tuktuk', laag: 'weg', module: 'experience_transport', boeking: 'ervaring', plaatsen: 3, bagage: 1, bemanning: 1,
                 papieren: ['kenteken', 'verzekering'] },
  paardwagen:  { naam: 'Paard en wagen', laag: 'weg', module: 'experience_transport', boeking: 'ervaring', plaatsen: 6, bagage: 0, bemanning: 1,
                 papieren: ['verzekering', 'dierenwelzijn'] },
  golfkar:     { naam: 'Golfkar', laag: 'weg', module: 'experience_transport', boeking: 'ervaring', plaatsen: 4, bagage: 1, bemanning: 1,
                 papieren: ['verzekering'] },
  sneeuwscooter: { naam: 'Sneeuwscooter', laag: 'weg', module: 'experience_transport', boeking: 'ervaring', plaatsen: 2, bagage: 0, bemanning: 1,
                 papieren: ['verzekering'] },
  offroad:     { naam: 'Offroadvoertuig', laag: 'weg', module: 'experience_transport', boeking: 'ervaring', plaatsen: 5, bagage: 2, bemanning: 1,
                 papieren: ['kenteken', 'verzekering', 'apk'] },

  // ---- rail ----
  tram:        { naam: 'Tram', laag: 'rail', module: 'public_transport_planner', boeking: 'direct', plaatsen: 120, bagage: 0, bemanning: 1,
                 rolstoel: true, papieren: ['railtoelating', 'verzekering'] },
  metro:       { naam: 'Metro', laag: 'rail', module: 'public_transport_planner', boeking: 'direct', plaatsen: 400, bagage: 0, bemanning: 1,
                 rolstoel: true, papieren: ['railtoelating', 'verzekering'] },
  trein:       { naam: 'Trein', laag: 'rail', module: 'public_transport_planner', boeking: 'direct', plaatsen: 500, bagage: 0, bemanning: 2,
                 rolstoel: true, papieren: ['railtoelating', 'verzekering'] },
  bus:         { naam: 'Bus', laag: 'weg', module: 'public_transport_planner', boeking: 'direct', plaatsen: 60, bagage: 0, bemanning: 1,
                 rolstoel: true, papieren: ['kenteken', 'verzekering', 'apk', 'busvergunning'] },

  // ---- water ----
  veerboot:    { naam: 'Veerboot', laag: 'water', module: 'public_transport_planner', boeking: 'direct', plaatsen: 300, bagage: 100, bemanning: 3,
                 rolstoel: true, papieren: ['zeebrief', 'verzekering', 'veiligheidscertificaat'] },
  watertaxi:   { naam: 'Watertaxi', laag: 'water', module: 'boat_transport', boeking: 'aanvraag', plaatsen: 8, bagage: 4, bemanning: 1,
                 papieren: ['zeebrief', 'verzekering', 'vaarbewijs'] },
  jacht:       { naam: 'Jacht of speedboot', laag: 'water', module: 'boat_transport', boeking: 'aanvraag', plaatsen: 12, bagage: 8, bemanning: 2,
                 papieren: ['zeebrief', 'verzekering', 'vaarbewijs', 'veiligheidscertificaat'] },

  // ---- lucht ----
  helikopter:  { naam: 'Helikopter', laag: 'lucht', module: 'helicopter_charter', boeking: 'aanvraag', plaatsen: 5, bagage: 3, bemanning: 1,
                 papieren: ['registratie', 'luchtwaardigheid', 'verzekering', 'exploitantvergunning'] },
  vliegtuig:   { naam: 'Klein vliegtuig', laag: 'lucht', module: 'aircraft_charter', boeking: 'aanvraag', plaatsen: 8, bagage: 6, bemanning: 2,
                 papieren: ['registratie', 'luchtwaardigheid', 'verzekering', 'exploitantvergunning'] },
  privejet:    { naam: 'Privejet', laag: 'lucht', module: 'aircraft_charter', boeking: 'aanvraag', plaatsen: 12, bagage: 12, bemanning: 2,
                 papieren: ['registratie', 'luchtwaardigheid', 'verzekering', 'exploitantvergunning'] },

  bijzonder:   { naam: 'Ander bijzonder voertuig', laag: 'weg', module: 'experience_transport', boeking: 'ervaring', plaatsen: 4, bagage: 1, bemanning: 1,
                 papieren: ['verzekering'] }
};

// energie- en brandstofsoorten; puur een keuzelijst, geen gedrag
const ENERGIE = ['elektrisch', 'hybride', 'benzine', 'diesel', 'waterstof', 'lpg', 'kerosine', 'spierkracht', 'wind', 'geen'];
// waar een voertuig voor ingezet mag worden; hangt vast aan de modules
const RITSOORTEN = ['direct', 'gepland', 'gedeeld', 'pendel', 'school', 'medisch', 'evenement', 'luchthaven', 'charter', 'ervaring'];

/* Fail-fast: een categorie die naar een module wijst die niet bestaat levert
   een voertuig op dat nooit inzetbaar wordt, zonder dat iets klaagt. */
const { OP_ID } = require('./modulecatalogus');
for (const [id, c] of Object.entries(CATEGORIEEN)) {
  if (!OP_ID[c.module]) throw new Error('mobiliteit/voertuigcatalogus: categorie ' + id + ' wijst naar onbekende module ' + c.module);
  if (!['direct', 'aanvraag', 'ervaring'].includes(c.boeking))
    throw new Error('mobiliteit/voertuigcatalogus: categorie ' + id + ' heeft een onbekende boekingsvorm ' + c.boeking);
}

module.exports = { CATEGORIEEN, ENERGIE, RITSOORTEN };
