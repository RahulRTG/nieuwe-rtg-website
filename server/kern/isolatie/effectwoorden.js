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
  UITGAANDE_AANROEP:         'zelf een verbinding naar buiten opzetten'
});
const NAMEN = Object.freeze(Object.keys(EFFECTEN));

module.exports = { EFFECTEN, NAMEN };
