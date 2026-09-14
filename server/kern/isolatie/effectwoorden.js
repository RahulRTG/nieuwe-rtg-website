/* DE WOORDENLIJST -- de dertien effecten, en verder niets.

   Hij staat apart omdat twee modules hem nodig hebben en ze elkaar anders in een
   kring vragen: ./effecten.js bepaalt welke effecten een PAD draagt en
   ./standsluiting.js welke een STAND dichtzet, en die tweede moet "alles behalve
   lezen" kunnen zeggen. Met de lijst in de eerste was dat een require-lus.

   Dat een woordenlijst zijn eigen bestand krijgt is hier geen overdaad maar de
   vorm die OS.md par. 4 vraagt: een grammatica hoort te bestaan los van wie hem
   gebruikt, anders wordt de eerste gebruiker stilzwijgend de eigenaar. */
'use strict';

/* ---------------------------------------------------------------------------
   DE WOORDENLIJST. Dertien effecten, en elk van hen beantwoordt de vraag "wat
   kan een aanvaller hiermee bereiken" en niet "in welk scherm zit dit".
   ------------------------------------------------------------------------ */
const EFFECTEN = Object.freeze({
  LEZEN_EIGEN:               'gegevens van de aanroeper zelf ophalen',
  SCHRIJVEN_EIGEN:           'gegevens van de aanroeper zelf wijzigen',
  SCHRIJVEN_ANDERMANS:       'gegevens wijzigen die van iemand anders zijn',
  EXTERN_BEREIKEN:           'een tweede persoon buiten RTG bereiken: mail, sms, publiceren, delen',
  VERTROUWENSRELATIE_AANGAAN:'een nieuwe blijvende koppeling: integratie, sleutel, webhook, apparaat, uitnodiging',
  RECHT_VERLENEN:            'iemand meer laten mogen dan daarvoor',
  IDENTITEIT_WIJZIGEN:       'wie iemand is of hoe hij binnenkomt',
  GELD_BEWEGEN:              'een bedrag verplaatsen, vastleggen of uitbetalen',
  BULK_UITVOER:              'veel gegevens tegelijk naar buiten',
  DERDENCODE_UITVOEREN:      'code draaien die niet van RTG is',
  ONVERTROUWDE_BYTES:        'bytes ontleden die van buiten komen: bestand, document, beeld',
  BEVEILIGING_VERZWAKKEN:    'een grens, stand, uitzondering of sleutel losser maken',
  UITGAANDE_AANROEP:         'zelf een verbinding naar buiten opzetten',
  /* DE VIER VAN 13 SEPTEMBER 2026. Ze zijn erbij gekomen omdat de dertien hierboven voor
     ISOLATIE zijn gebouwd ("wat kan een aanvaller hiermee bereiken") en daarmee vier
     klassen niet konden uitdrukken die een CAUSALE laag wel nodig heeft. Zonder die vier
     moest de kantoor-bankkant kiezen tussen een werkwoord dat er bijna op leek en geen
     werkwoord -- en het eerste is semantiek verzinnen op de plek waar dat niet mag.

     LEES DE GRENS ERBIJ IN ./standsluiting.js: `isolatie` sluit alles behalve LEZEN_EIGEN,
     dus deze vier gaan daar vanzelf dicht (fail-closed, en dat is de goede richting).
     `beschermd` sluit een EXPLICIETE lijst, en daar is per werkwoord over besloten -- die
     besluiten staan bij BESCHERMD_SLUIT en niet hier. */
  LEZEN_ANDERMANS:           'gegevens van iemand anders ophalen',
  PLAFOND_WIJZIGEN:          'een limiet, plafond of ruimte veranderen: het maakt iets mogelijk zonder het te doen',
  VOORSTEL_MAKEN:            'iets klaarzetten dat een tweede mens nog moet bevestigen; verandert zelf niets',
  CONFIGUREREN:              'een instelling of stand zetten die niet zelf een grens losser maakt'
});
const NAMEN = Object.freeze(Object.keys(EFFECTEN));

module.exports = { EFFECTEN, NAMEN };
