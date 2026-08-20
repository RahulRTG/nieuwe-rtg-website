/* Sociale laag (deelmodule): de RTFoundation-kant: verplichte onboarding,
   dezelfde vriendenlaag (met ouderakkoord voor kinderen), snaps/verhalen,
   de live-stream, bellen en het ouder-toezicht op kindcontacten. Gemount
   vanuit routes/social.js op de gedeelde kern. */
module.exports = (sctx) => {
  /* TWEE POORTEN, EEN KEER. Ze staan hier en niet in elk deelbestand, want het
     zijn twee besluiten en geen twee regels code: hoor je bij dit gezin, en ben
     je oud genoeg om zelf contacten te leggen. Toen de linkdeur erbij kwam
     (LINK.md) zou dit de tweede kopie zijn geworden, en dan lopen de woorden --
     en op een dag de grens -- uit elkaar (LAT.md regel 4).

     Ze blijven ECHTE MIDDLEWARE en geen aanroep binnenin: bij elke route staat
     zichtbaar welke deuren hij heeft, voor een lezer en voor scripts/check.js
     regel 28, die een poort in een wrapper niet ziet.

     (In dit huis staat gezinsPoort ook in baby.js, tiener.js, welzijn.js en
     levenband.js. Die gaan over andere lagen en blijven waar ze staan; dit
     halveert het aantal kopieen binnen de sociale laag, meer niet.) */
  function gezinsPoort(req, res, next) {
    const sess = sctx.rtfSociaal(req, res);   // antwoordt zelf met 403 als er niets klopt
    if (!sess) return;
    req.gezinslid = sess;
    next();
  }
  /* Het kind hoort te lezen WAAROM dit dicht staat, en overal met dezelfde
     woorden: bij zoeken, bij verbinden, bij de pin en sinds RTG Link ook bij het
     scannen. Dit is geen dubbelop bovenop de kern -- die weigert al -- maar het
     antwoord dat het scherm nodig heeft. */
  function nietBeschermd(req, res, next) {
    if (req.gezinslid.beschermd) return res.status(403).json({ error: 'Je ouder of verzorger voegt vrienden voor je toe.' });
    next();
  }
  const gctx = { ...sctx, gezinsPoort, nietBeschermd };

  /* De vrienden- en toezichtlaag staan als deelmodules in gezinnen/;
     hier alleen de mounts. */
  require('./gezinnen/vrienden')(gctx);
  require('./gezinnen/pin')(gctx);
  require('./gezinnen/link')(gctx);
  require('./gezinnen/toezicht')(gctx);
};
