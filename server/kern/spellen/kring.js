/* Spellen (deelmodule): DE KRING. Wie kun je buiten een potje om al bereiken?

   Deze vraag stond op twee plekken -- bij het praten in een potje en bij het
   uitnodigen voor een team -- en dat is er een te veel. Een kring die op twee
   plekken wordt beantwoord gaat uiteen zodra er een groep bijkomt, en dan is
   de ene deur ruimer dan de andere zonder dat iemand dat besloten heeft. Hij
   staat daarom hier, een keer.

   DRIE SOORTEN NABIJHEID, en ze zijn geen van drieën vrijblijvend:

   1. VRIENDEN. Een bevestigde verbinding, van twee kanten geaccepteerd.
   2. KLASGENOTEN. Beschermde tieners zijn onvindbaar via de codenaam-zoeker;
      hun klas is een door school en ouders bevestigde kring en vaak de enige
      die ze hebben. Zonder deze regel zou De Arena de app zijn waar juist
      niemand met elkaar mag praten.
   3. HETZELFDE GEZIN. Twee profielen onder dezelfde gezinscode delen een
      huishouden en een RTF-account. Dit ontbrak, en dat viel pas op door het
      na te meten: een ouder en een kind die samen dammen kregen geen chat,
      want ze zijn geen "vrienden" (dat is een andere laag) en geen
      klasgenoten. Een huishouden is een sterkere kring dan allebei.

   EN EEN BLOKKADE WEEGT ALTIJD ZWAARDER, aan beide kanten. Wie jou heeft
   geblokkeerd hoeft niet te dulden dat je hem via een spel alsnog bereikt, en
   andersom hoor jij niet in een ruimte te staan met iemand die je zelf hebt
   weggezet. */
module.exports = (ctx) => {
  const { zijnVrienden, klasgenotenVan, isGeblokkeerd } = ctx;

  // 'rtf:<gezinscode>:<profielId>' -- alleen de gezinscode telt hier
  const GEZIN = /^rtf:([^:]+):/;
  function zelfdeGezin(a, b) {
    const ga = GEZIN.exec(String(a || '')), gb = GEZIN.exec(String(b || ''));
    return !!(ga && gb && ga[1] === gb[1]);
  }

  function bereikbaar(a, b) {
    if (!a || !b || a === b) return false;
    if (isGeblokkeerd(a, b) || isGeblokkeerd(b, a)) return false;
    if (zelfdeGezin(a, b)) return true;
    if (zijnVrienden(a, b)) return true;
    return klasgenotenVan(a).some(kg => kg.key === b);
  }

  /* ELK PAAR, en niet "iedereen die ik ken". In een gedeelde ruimte praat B ook
     tegen C: een controle die alleen naar de eigen kant kijkt zet twee vreemden
     bij elkaar in een kamer door ze allebei uit te nodigen. Bij zes spelers
     zijn dat vijftien vragen, een keer per keer dat iemand de ruimte opent. */
  function elkPaarKent(mensen) {
    for (let i = 0; i < mensen.length; i++)
      for (let j = i + 1; j < mensen.length; j++)
        if (!bereikbaar(mensen[i], mensen[j])) return false;
    return true;
  }

  return { bereikbaar, elkPaarKent, zelfdeGezin };
};
