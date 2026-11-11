'use strict';
/* Een klein verzamelpunt om het centrale contractregister onder zijn
   omvangsgrens te houden. Neiging en PersonalOS zijn beide uitsluitend
   persoonlijke, accountgebonden presentatielagen. */
module.exports = Object.assign({},
  require('./mutatiecontracten-neiging').CONTRACTEN,
  require('./mutatiecontracten-personalos').CONTRACTEN);
