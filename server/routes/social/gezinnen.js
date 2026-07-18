/* Sociale laag (deelmodule): de RTFoundation-kant: verplichte onboarding,
   dezelfde vriendenlaag (met ouderakkoord voor kinderen), snaps/verhalen,
   de live-stream, bellen en het ouder-toezicht op kindcontacten. Gemount
   vanuit routes/social.js op de gedeelde kern. */
module.exports = (sctx) => {
  /* De vrienden- en toezichtlaag staan als deelmodules in gezinnen/;
     hier alleen de mounts. */
  require('./gezinnen/vrienden')(sctx);
  require('./gezinnen/toezicht')(sctx);
};
