/* HET OPSLAGCONTRACT VAN DE ISOLATIELAAG -- de enige deur naar db.data.

   Vierde domein achter een contract, na payroll, concern en veiligheid. Dezelfde
   discipline en met opzet niet dezelfde code: OBJECTMODEL.json en
   DEVELOPERCLOUD.md par. 2 zeggen allebei dat een gedeeld type gevonden moet
   worden en niet verklaard. Wat gedeeld wordt is de vorm van het gesprek, niet
   een basisklasse.

   WAT HIER NIET IN ZIT, EN DAT IS DE BELANGRIJKSTE REGEL VAN DIT BESTAND: de
   stand van het HUIS. Die woont in db.data.techniek.incidentcontrole.modus en
   blijft daar. Hem hierheen kopiëren zou een tweede waarheid maken over dezelfde
   stand, en dan zeggen twee schermen op een dag iets anders over of het platform
   in isolatie staat. De dragerlaag LEEST die stand en bezit hem niet.

   DE SLEUTELS ZIJN CODENAMEN EN GEEN NAMEN. Een tak `identiteit` is een kaart
   van codenaam naar stand. Wie hier een e-mailadres of een lidnummer als sleutel
   neerzet, heeft van de beveiligingslaag een tweede ledenadministratie gemaakt --
   en die staat dan buiten de kluis. */
'use strict';

const NIET_GEBOUWD = {
  huisstand: 'woont in db.data.techniek.incidentcontrole en blijft daar; twee plekken voor één stand ' +
    'is hoe twee schermen iets anders gaan zeggen.',
  bewaartermijn: 'een ontsluitverzoek is een beveiligingsspoor en hoort te blijven; hoe lang precies ' +
    'is een besluit van de eigenaar en geen getal om hier te verzinnen.',
  schema: 'geen. Vier takken tegelijk een schema geven vraagt per tak een eigen ronde, en een half ' +
    'schema keurt goed wat het niet kent.'
};

const REGISTER = {
  organisatie:   { soort: 'kaart', wat: 'stand per organisatiecode' },
  identiteit:    { soort: 'kaart', wat: 'stand per codenaam' },
  sessie:        { soort: 'kaart', wat: 'stand per sessiesleutel' },
  apparaat:      { soort: 'kaart', wat: 'stand per apparaatsleutel' },
  ontsluitingen: { soort: 'lijst', wat: 'lopende en afgeronde ontsluitverzoeken, nieuwste eerst' },
  spoor:         { soort: 'lijst', wat: 'elke zetting van een stand, groeit aan en wordt nooit herschreven' }
};

const WORTEL = 'isolatie';

module.exports = function maakOpslag({ db }) {
  if (!db || !db.data) throw new Error('isolatie/opslag: zonder db.data is er niets om te bewaren');

  function wortel() {
    const huidig = db.data[WORTEL];
    if (!huidig || typeof huidig !== 'object' || Array.isArray(huidig)) db.data[WORTEL] = {};
    return db.data[WORTEL];
  }
  function klopt(naam, waarde) {
    return REGISTER[naam].soort === 'lijst' ? Array.isArray(waarde)
      : (waarde && typeof waarde === 'object' && !Array.isArray(waarde));
  }
  function eis(naam) {
    if (!REGISTER[naam]) throw new Error('isolatie/opslag: "' + naam + '" staat niet in het register. ' +
      'Zet hem erbij met zijn soort en wat erin zit, of gebruik een tak die bestaat.');
  }
  function tak(naam) {
    eis(naam);
    const w = wortel();
    if (!klopt(naam, w[naam])) w[naam] = REGISTER[naam].soort === 'lijst' ? [] : {};
    return w[naam];
  }
  function zetTak(naam, waarde) {
    eis(naam);
    if (!klopt(naam, waarde)) throw new Error('isolatie/opslag: "' + naam + '" hoort een ' +
      REGISTER[naam].soort + ' te zijn; er werd iets anders neergezet.');
    wortel()[naam] = waarde;
    return waarde;
  }
  return { tak, zetTak, wortel, REGISTER, NIET_GEBOUWD };
};

module.exports.REGISTER = REGISTER;
module.exports.NIET_GEBOUWD = NIET_GEBOUWD;
module.exports.WORTEL = WORTEL;
