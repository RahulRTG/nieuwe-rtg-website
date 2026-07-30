/* Boardroom van het lid, deel "bord": de LEESKANT. Wat staat er op het bord, en
   wie houdt welke knop vast.

   Een functie kan door DRIE partijen dichtgehouden worden, en het bord zegt
   precies door wie:

     RTG        de platform-schakelkast (server/functies) heeft hem globaal of
                voor jouw pas uitgezet;
     je werkgever  het bedrijf achter je werk-koppeling heeft hem dichtgezet
                (./werkbeleid -- en die kan alleen dichtzetten, nooit openen);
     de basis   hij hoort bij het toestel zelf (je wallet met je ledenpas) en
                kan sowieso niet uit.

   In alle drie de gevallen is de knop BEHEERD: zichtbaar, met de reden en de
   naam van wie hem vasthoudt, en niet te schakelen. Dat is eerlijker dan een
   schakelaar die je omzet en die niets doet -- en bij een werkgever is het meer
   dan eerlijk, het is het verschil tussen beleid en stille voogdij.

   De taal komt van de lezer mee (./talen): de labels van dit bord staan in de
   catalogus op de server, dus de pagina kan ze niet zelf vertalen. */

const { CATEGORIEEN, CAPS, PLATFORM } = require('./catalogus');
const talen = require('./talen');
const functies = require('../../functies');

module.exports = (ctx) => {
  const { db, eigen, versie, aan, standaardAan, werkbeleidDicht } = ctx;

  /* Wat de platform-schakelkast over deze functie zegt, voor DEZE doelgroep.
     Geeft null als er niets aan de hand is, anders { reden, zin }. Zonder
     doelgroep telt alleen de globale schakelaar. Een storing in de schakelkast
     mag het bord nooit onbruikbaar maken: bij twijfel niets melden. */
  function platformStand(id, doelgroep, lang) {
    const pid = PLATFORM[id];
    if (!pid) return null;
    const staat = db.data && db.data.techniek && db.data.techniek.functies;
    if (!staat) return null;
    let reden = null;
    try { reden = functies.blokkadeReden(pid, staat, { doelgroep: doelgroep || null }); } catch (e) { return null; }
    if (!reden) return null;
    return { door: 'rtg', beheerder: 'RTG', reden, zin: talen.zin(reden, lang) };
  }

  /* Wie houdt deze knop vast? RTG gaat voor: staat iets platform-breed dicht,
     dan is dat de werkelijkheid, ook als de werkgever er ook iets van vindt. */
  function beheerStand(sleutel, id, opts) {
    const o = opts || {};
    const pf = platformStand(id, o.doelgroep, o.lang);
    if (pf) return pf;
    if (typeof werkbeleidDicht === 'function' && !o.kind) {
      const w = werkbeleidDicht(sleutel, id);
      if (w) return { door: 'werkgever', beheerder: w.naam, reden: 'werk',
        zin: talen.zin('werk', o.lang) + ' (' + w.naam + ').' };
    }
    return null;
  }

  /* Het bord: functies per categorie, met hun huidige stand. opts.kind laat de
     functies weg die niet bij een beschermd kind horen (kind:false);
     opts.doelgroep bepaalt wat de platform-schakelkast erover zegt;
     opts.lang de taal van de labels. */
  function bord(sleutel, opts) {
    const o = opts || {};
    const caps = o.kind ? CAPS.filter(c => c.kind !== false) : CAPS;
    return {
      versie: versie(sleutel),
      gewijzigd: eigen(sleutel)._at || null,
      taal: talen.isNl(o.lang) ? 'nl' : String(o.lang).slice(0, 2).toLowerCase(),
      categorieen: CATEGORIEEN.map(cat => {
        const ct = talen.categorie(cat.id, cat.naam, cat.uitleg, o.lang);
        return {
          id: cat.id, naam: ct.naam, uitleg: ct.uitleg,
          functies: caps.filter(c => c.cat === cat.id).map(c => {
            const bh = beheerStand(sleutel, c.id, o);
            const ft = talen.functie(c.id, c.naam, c.uitleg, o.lang);
            return {
              id: c.id, naam: ft.naam, uitleg: ft.uitleg,
              aan: bh ? false : aan(sleutel, c.id),
              standaard: standaardAan(c),
              vast: !!c.vast,
              vastZin: c.vast ? talen.zin('vast', o.lang) : null,
              beheerd: !!bh,
              beheerdDoor: bh ? bh.door : null,
              beheerder: bh ? bh.beheerder : null,
              reden: bh ? bh.zin : null
            };
          })
        };
      }).filter(cat => cat.functies.length)
    };
  }

  return { bord, platformStand, beheerStand };
};
