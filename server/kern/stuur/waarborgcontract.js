/* HET WAARBORGCONTRACT -- precondities, postcondities en invarianten zonder een
   tweede capabilityregister te maken.

   De bron bestaat al: `voorwaarden`, `streefstand` en `nooit` wonen in het
   gevolgcontract van een capability. Deze module projecteert die drie velden
   naar de taal waarin een plan ze nodig heeft en controleert na uitvoering de
   invarianten tegen de bestaande effectbon. Zij kopieert of bezit dus geen
   contracten.

   VERKLAARD IS NIET GETOETST. Een voorwaarde met een bron is nog geen geslaagde
   voorcontrole en een streefstand is nog geen gemeten postconditie. Daarom
   draagt de projectie die grens letterlijk. Alleen de invariantcontrole kan
   hier een runtime-uitkomst geven, en ook die zegt NIET_MEETBAAR wanneer de
   effectbon het betreffende choke point niet kan zien. */
'use strict';

const { keur } = require('./gevolgcontract/keuring');
const { CONTRACTEN } = require('./gevolgcontract/register');
const { wegVan } = require('./gevolgcontract/nameting');

const UITKOMSTEN = Object.freeze(['BEHOUDEN', 'GESCHONDEN', 'NIET_MEETBAAR']);

function padVan(capability) {
  const ruw = String(capability || '').trim();
  const raak = ruw.match(/\/api\/[^\s?#]*/);
  return raak ? raak[0].replace(/\/$/, '') : ruw.replace(/[?#].*$/, '').replace(/\/$/, '');
}

function projecteer(capability, contracten) {
  const pad = padVan(capability);
  const c = (contracten || CONTRACTEN)[pad] || null;
  if (!c) return {
    capability: pad || null, stand: 'ONBEKEND', precondities: [], postcondities: [], invarianten: [],
    open: ['precondities', 'postcondities', 'invarianten'],
    grens: 'Er is geen gevolgcontract voor deze capability. Ontbrekende kennis is geen toestemming.'
  };

  const bezwaren = keur(c);
  const precondities = (Array.isArray(c.voorwaarden) ? c.voorwaarden : []).map(v => ({
    wat: String((v && v.wat) || ''), bron: String((v && v.bron) || ''),
    getoetst: false, reden: 'verklaard in het contract; de domeinpoort moet dit live toetsen'
  }));
  const postcondities = c.streefstand ? [{
    wat: String(c.streefstand), getoetst: false,
    reden: 'verklaarde streefstand; pas een positieve nameting maakt dit waar'
  }] : [];
  const invarianten = (Array.isArray(c.nooit) ? c.nooit : []).map(klasse => ({
    klasse, meetweg: wegVan(klasse), getoetst: false,
    reden: 'deze effectklasse mag tijdens en na de handeling niet worden waargenomen'
  }));
  const open = [];
  if (!precondities.length) open.push('precondities');
  if (!postcondities.length) open.push('postcondities');
  if (!Array.isArray(c.nooit)) open.push('invarianten');
  if (bezwaren.length) open.push('gevolgcontract-afgekeurd');

  return {
    capability: pad, stand: open.length ? 'GEDEELTELIJK' : 'VOLLEDIG',
    precondities, postcondities, invarianten, open, bezwaren,
    grens: 'Dit contract verklaart wat moet gelden; het bewijst niet dat een preconditie of ' +
      'postconditie live is getoetst. Een plan is geen toestemming en een verklaring is geen actiebewijs.'
  };
}

function meetbaarZonderWaarneming(klasse, bon) {
  const weg = wegVan(klasse);
  const dekking = (bon && bon.dekking) || {};
  if (weg === 'geen') return false;
  /* Ook in de diepe stand is een BEWOGEN maar nog niet ingedeelde collectie
     geen bewijs dat een opslaginvariant behouden bleef. De proxy zag dan wel
     exact welke collectie bewoog, maar zonder indeling weten we niet welke
     effectklasse daarbij hoort. Afwezigheid van een bekende klasse is hier dus
     onbekende dekking en geen groene nameting. */
  if (weg === 'opslag' && Array.isArray(dekking.collectiesZonderIndeling) &&
      dekking.collectiesZonderIndeling.length) return false;
  if (weg === 'opslag' && dekking.schreefOpslag === true && dekking.diep !== true) return false;
  return true;
}

function controleerInvarianten(capability, bon, contracten) {
  const contract = projecteer(capability, contracten);
  if (contract.stand === 'ONBEKEND' || contract.open.includes('gevolgcontract-afgekeurd')) {
    return {
      capability: contract.capability, stand: 'ONBEKEND', rijen: [], open: contract.open,
      reden: contract.stand === 'ONBEKEND' ? contract.grens : 'Het gevolgcontract is afgekeurd; invarianten zijn niet betrouwbaar te controleren.'
    };
  }

  const gezien = new Set(Array.isArray(bon && bon.klassen) ? bon.klassen : []);
  const rijen = contract.invarianten.map(i => {
    if (gezien.has(i.klasse)) return {
      klasse: i.klasse, meetweg: i.meetweg, uitkomst: 'GESCHONDEN',
      reden: 'de effectbon nam een klasse waar die het contract uitdrukkelijk uitsluit'
    };
    if (!meetbaarZonderWaarneming(i.klasse, bon)) return {
      klasse: i.klasse, meetweg: i.meetweg, uitkomst: 'NIET_MEETBAAR',
      reden: i.meetweg === 'geen'
        ? 'deze klasse loopt niet langs een meetbaar choke point; afwezigheid is geen bewijs'
        : Array.isArray(bon && bon.dekking && bon.dekking.collectiesZonderIndeling) &&
            bon.dekking.collectiesZonderIndeling.length
          ? 'er bewoog een collectie zonder effectindeling; afwezigheid van deze klasse is geen bewijs'
        : 'er is geschreven terwijl de effectbon niet diep genoeg kon zien welke klasse bewoog'
    };
    return { klasse: i.klasse, meetweg: i.meetweg, uitkomst: 'BEHOUDEN',
      reden: 'het relevante choke point stond aan en nam de verboden klasse niet waar' };
  });
  const geschonden = rijen.filter(r => r.uitkomst === 'GESCHONDEN');
  const nietMeetbaar = rijen.filter(r => r.uitkomst === 'NIET_MEETBAAR');
  return {
    capability: contract.capability,
    stand: geschonden.length ? 'GESCHONDEN' : (nietMeetbaar.length ? 'NIET_VOLLEDIG_MEETBAAR' : 'BEHOUDEN'),
    rijen,
    telling: { behouden: rijen.length - geschonden.length - nietMeetbaar.length,
      geschonden: geschonden.length, nietMeetbaar: nietMeetbaar.length },
    reden: geschonden.length
      ? geschonden.map(r => r.klasse).join(', ') + ' werd waargenomen ondanks de invariant'
      : nietMeetbaar.length
        ? 'geen schending waargenomen, maar ' + nietMeetbaar.length + ' invariant(en) waren niet volledig meetbaar'
        : 'alle verklaarde invarianten waren meetbaar en bleven behouden'
  };
}

module.exports = { projecteer, controleerInvarianten, padVan, UITKOMSTEN };
