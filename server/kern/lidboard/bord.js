/* Boardroom van het lid, deel "bord": de LEESKANT. Wat staat er op het bord, en
   wat zegt de platform-schakelkast erover.

   De platform-brug is het stuk dat dit bord eerlijk houdt. Zet RTG een functie
   platform-breed uit, of voor jouw pas, dan is de knop op jouw bord een knop
   naar niets: hij staat "aan", je zet hem om, en er verandert niets aan wat je
   ervaart. Daarom vraagt het bord de schakelkast (server/functies) hoe het er
   werkelijk voor staat en toont hij zo'n functie als BEHEERD: zichtbaar, met de
   reden erbij, en niet te schakelen. Zien wat er is, ook als het niet van jou
   afhangt -- dat is eerlijker dan een schakelaar die liegt. */

const { CATEGORIEEN, CAPS, PLATFORM } = require('./catalogus');
const functies = require('../../functies');

const PLATFORM_ZIN = {
  globaal: 'Tijdelijk uitgeschakeld door RTG.',
  pas: 'Voor jouw pas uitgeschakeld door RTG.',
  land: 'In jouw land uitgeschakeld door RTG.',
  persoon: 'Voor jouw account uitgeschakeld door RTG.',
  genre: 'Voor dit genre uitgeschakeld door RTG.'
};

module.exports = (ctx) => {
  const { db, eigen, versie, aan, standaardAan } = ctx;

  /* Wat de platform-schakelkast over deze functie zegt, voor DEZE doelgroep.
     Geeft null als er niets aan de hand is, anders { reden, zin }. Zonder
     doelgroep telt alleen de globale schakelaar. Een storing in de schakelkast
     mag het bord nooit onbruikbaar maken: bij twijfel niets melden. */
  function platformStand(id, doelgroep) {
    const pid = PLATFORM[id];
    if (!pid) return null;
    const staat = db.data && db.data.techniek && db.data.techniek.functies;
    if (!staat) return null;
    let reden = null;
    try { reden = functies.blokkadeReden(pid, staat, { doelgroep: doelgroep || null }); } catch (e) { return null; }
    if (!reden) return null;
    return { reden, zin: PLATFORM_ZIN[reden] || PLATFORM_ZIN.globaal };
  }

  /* Het bord: functies per categorie, met hun huidige stand. opts.kind laat de
     functies weg die niet bij een beschermd kind horen (kind:false);
     opts.doelgroep bepaalt wat de platform-schakelkast erover zegt. */
  function bord(sleutel, opts) {
    const o = opts || {};
    const caps = o.kind ? CAPS.filter(c => c.kind !== false) : CAPS;
    return {
      versie: versie(sleutel),
      gewijzigd: eigen(sleutel)._at || null,
      categorieen: CATEGORIEEN.map(cat => ({
        id: cat.id, naam: cat.naam, uitleg: cat.uitleg,
        functies: caps.filter(c => c.cat === cat.id).map(c => {
          const pf = platformStand(c.id, o.doelgroep);
          return {
            id: c.id, naam: c.naam, uitleg: c.uitleg,
            aan: pf ? false : aan(sleutel, c.id),
            standaard: standaardAan(c),
            vast: !!c.vast,
            beheerd: !!pf,
            reden: pf ? pf.zin : null
          };
        })
      })).filter(cat => cat.functies.length)
    };
  }

  return { bord, platformStand };
};
