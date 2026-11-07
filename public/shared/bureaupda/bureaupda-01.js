/* DE BUREAU-PDA -- één scherm voor de drie ontwerpbureaus van de kantoren.

   WAT HIER IS SAMENGEVOEGD EN WAAROM. Er stonden drie apps: studio-pda (198
   regels), hardware-pda (199) en architect-pda (184). Na het normaliseren van
   de bureaunaam verschilden ze onderling 54 tot 73 regels -- en dat waren geen
   drie ontwerpen maar één ontwerp dat drie keer was gekopieerd en daarna uit
   elkaar gelopen:

     - de studio kreeg de nieuwe deelmenu-stijl voor de disciplinerij, de
       architect bleef op de oude pillen staan;
     - de studio nam elf kolommen mee bij het uitvoeren, de hardware zeven en
       de architect acht -- met verschillende namen voor hetzelfde;
     - de architect laadde /shared/deur.js in de kop, de andere twee in de body.

   Dat is precies wat LAT.md regel 4 beschrijft: dezelfde waarheid op drie
   plekken loopt uiteen, zeker en meestal zonder dat iets klaagt. Wie een van de
   drie verbeterde, verbeterde de andere twee niet.

   WAT WÉL PER BUREAU VERSCHILT staat hieronder als GEGEVEN, niet als code: de
   naam, de brief-hint, de twee velden die het concept samenvatten, en de
   kolommen van het register. Een vierde bureau is een regel in deze tabel.

   DE DRIE PADEN BLIJVEN BESTAAN. /apps/studio-pda.html en de andere twee zijn
   nog steeds echte apps met een eigen gids-ingang en een eigen deur; ze zijn
   alleen dun geworden. Er waren links naar (kantoren.html wijst er drie keer
   heen) en er staat een toets op hun deur (test/kantoordeuren.e2e.js), dus ze
   vervangen door een doorverwijzing zou werk kapotmaken om iets op te ruimen
   wat niemand stoorde. */
(function (w) {
  'use strict';
  if (w.RTGBureauPDA) return;

  /* De drie bureaus. `velden` zijn de twee eigenschappen waarmee dit vak een
     concept samenvat -- bij een voertuig zegt het silhouet en de aandrijving
     wat het is, bij een gebouw de typologie en de constructie. */
  var BUREAUS = {
    studio: {
      pad: 'studio', ey: 'RTG Ontwerpstudio', titel: 'Studio PDA',
      brief: 'Brief: sfeer, gebruik, aandrijving',
      velden: ['silhouet', 'aandrijving'],
      kolommen: ['naam', 'discipline', 'status', 'huis', 'collectie', 'silhouet', 'aandrijving', 'kleuren', 'kritiek', 'aangemaakt', 'bijgewerkt'],
      rij: function (o, c) {
        return [o.naam || '', o.disciplineLabel || o.discipline || '', o.status || '', o.huis || '', o.collectie || '',
          c.silhouet || '', c.aandrijving || '', (c.kleuren || []).map(function (k) { return k.naam; }).join(', '),
          o.kritiek || '', String(o.at || '').slice(0, 10), String(o.updatedAt || '').slice(0, 10)];
      }
    },
    hardware: {
      pad: 'hardware', ey: 'RTG Hardwarelab', titel: 'Hardware PDA',
      brief: 'Brief: gebruik, formaat, aansluitingen',
      velden: ['behuizing', 'chip'],
      kolommen: ['datum', 'naam', 'discipline', 'status', 'huis', 'behuizing', 'chip'],
      rij: function (o, c) {
        return [String(o.at || '').slice(0, 10), o.naam || '', o.disciplineLabel || o.discipline || '',
          o.status || '', o.huis || '', c.behuizing || '', c.chip || ''];
      }
    },
    architect: {
      pad: 'architect', ey: 'RTG Architectenbureau', titel: 'Architect PDA',
      brief: 'Brief: ligging, sfeer, gebruik',
      velden: ['typologie', 'constructie'],
      kolommen: ['naam', 'discipline', 'project', 'huis', 'status', 'typologie', 'constructie', 'aangemaakt'],
      rij: function (o, c) {
        return [o.naam || '', o.disciplineLabel || o.discipline || '', o.collectie || '', o.huis || '',
          o.status || '', c.typologie || '', c.constructie || '', String(o.at || '').slice(0, 10)];
      }
    }
  };

  var esc = function (t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  };

  w.RTGBureauPDA = { BUREAUS: BUREAUS, esc: esc };
})(window);
