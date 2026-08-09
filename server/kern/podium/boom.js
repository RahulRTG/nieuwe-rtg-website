/* RTG Podium, deelbestand "boom": DE RELAY-BOOM -- wie geeft de stream aan wie
   door.

   'bron' is de maker; elke andere knoop is een kijker die het beeld van zijn
   ouder ontvangt en aan hoogstens FANOUT kinderen doorgeeft. De ouder wordt in
   de breedte gekozen (de plek dichtst bij de bron met nog ruimte), zodat de
   boom ondiep blijft en de vertraging laag. Zo draagt een kanaal onbeperkt veel
   kijkers zonder mediaserver: elke kijker helpt de volgende.

   Dit is een eigen onderwerp -- het gaat over verbindingen en niet over
   kanalen, geld of zones -- en staat daarom los van kern/podium/index.js.
   Krijgt alleen wat het nodig heeft, geen db en geen save: de boom hangt aan
   het kanaalobject dat de aanroeper al vasthoudt. */
const FANOUT = 4;

module.exports = ({ verseKijkers, sseToCustomer, codenaamVan, nu }) => {
  // de key om signalen heen te sturen (bron -> de maker)
  const ouderKeyVan = (k, key) => {
    const o = (k.boom || {})[key];
    return o ? (o.ouder === 'bron' ? k.key : o.ouder) : k.key;
  };
  function kiesOuder(k, key) {
    const verse = new Set(verseKijkers(k));
    const kinderenVan = (van) => Object.keys(k.boom || {}).filter(kk => kk !== key && verse.has(kk) && k.boom[kk].ouder === van);
    const rij = ['bron'];
    while (rij.length) {
      const n = rij.shift();
      const kids = kinderenVan(n);
      if (kids.length < FANOUT) return n;
      for (const c of kids) rij.push(c);
    }
    return 'bron';
  }
  /* Hang een (nieuwe of te herkoppelen) kijker onder een ouder en laat die
     ouder aanbieden. Bij de bron is de ouder de maker zelf. */
  function koppel(k, key) {
    k.boom = k.boom || {};
    const ouder = kiesOuder(k, key);
    k.boom[key] = { ouder, at: nu() };
    const doel = ouder === 'bron' ? k.key : ouder;
    sseToCustomer(doel, 'podium', { kind: 'kijker', kanaalId: k.id, van: key, codenaam: codenaamVan(key) });
    return ouder;
  }
  // ruim vertrokken kijkers uit de boom en herkoppel wezen (hun ouder is weg)
  function herstelBoom(k) {
    if (!k.boom) return;
    const verse = new Set(verseKijkers(k));
    for (const kk of Object.keys(k.boom)) if (!verse.has(kk)) delete k.boom[kk];
    for (const kk of Object.keys(k.boom)) {
      const o = k.boom[kk].ouder;
      if (o !== 'bron' && !verse.has(o)) koppel(k, kk);
    }
  }
  return { ouderKeyVan, kiesOuder, koppel, herstelBoom, FANOUT };
};
module.exports.FANOUT = FANOUT;
