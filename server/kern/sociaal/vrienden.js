/* Sociaal (deelmodule): de vriendenlaag over beide werelden heen: zoeken,
   verbinden (met voogd-goedkeuring voor kinderen), DM en ouder-meekijk.
   Krijgt de gedeelde context een keer bij het opstarten vanuit kern/sociaal.js. */
module.exports = (ctx) => {
  /* De verbind- en contactlaag draaien als deelmodules op de gedeelde
     context; er is geen kruisgebruik tussen de twee. */
  const deelVerbinden = require('./vrienden/verbinden')(ctx);
  const deelContact = require('./vrienden/contact')(ctx);
  return { ...deelVerbinden, ...deelContact };
};
