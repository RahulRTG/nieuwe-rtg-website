/* HOE KWAMEN LEDEN BIJ RTG (het aanmeldkanaal) -- besluit C6 van de eigenaar (27 september 2026).

   Twee bronnen, allebei optioneel: een VRAAG bij het aanmelden (een vaste lijst
   kanalen) en een CAMPAGNECODE in de link (?c=...). Wat hier bewaard wordt is
   geen herkomst per lid maar een TELLING per maand: kanaal plus een, campagne
   plus een. Er staat dus nergens dat dit lid via die campagne kwam -- niet in de
   operationele data, niet in de kluis, niet in een log.

   DAT IS DE PRIVACYVORM, EN HIJ IS STRUCTUREEL. "Nooit per lid zichtbaar" is geen
   belofte die een scherm moet houden: er is geen rij om te tonen. En omdat er geen
   lid in staat, is er bij vergetelheid ook niets te wissen. De prijs is dat CAC en
   behoud per kanaal niet per cohort te volgen zijn; dat is gekozen en niet gemist.

   Tellingen komen naar buiten langs de groepspoort (bedrijfsmaat/poort.js): de
   kanalen zijn vaste namen (secundaire onderdrukking), een campagnecode kan wel
   iets zeggen en gaat onder de grens op in "Overige". Na dertien maanden valt een
   maand weg.

   DE NAAM. `herkomst` is in dit huis bezet -- kern/herkomst.js gaat over waar een
   GEGEVEN vandaan komt, en zeven andere modules dragen het woord ook. Dit heet
   daarom het aanmeldkanaal. */
'use strict';

const NAAM = 'aanmeldkanaalTelling';
const KANALEN = Object.freeze(['vriend', 'werkgever', 'campagne', 'zoeken', 'sociaal', 'anders']);
/* De woorden bij de vraag op het welkomstscherm. Ze staan HIER en nergens anders:
   het scherm krijgt ze mee met de registratie, zodat er geen tweede lijst ontstaat. */
const LABELS = Object.freeze({ vriend: 'Via iemand die ik ken', werkgever: 'Via mijn werk', campagne: 'Via een advertentie',
  zoeken: 'Zelf gezocht', sociaal: 'Via sociale media', anders: 'Anders' });
const CODE = /^[a-z0-9][a-z0-9-]{1,31}$/;
const BEWAAR_MAANDEN = 13;
const { groepeer } = require('./bedrijfsmaat/poort');

/* Een campagnecode die in het register van RTG staat (kern/rtgcampagne.js, C12)
   telt onder ZIJN kanaal; een onbekende code blijft onder 'campagne' vallen, zoals
   voordien. `campagneKanaal` komt binnen, zodat dit domein het register niet kent. */
module.exports = ({ db, save, nu, campagneKanaal }) => {
  const eigen = require('./eigencollectie')({ db, domein: 'kern/aanmeldkanaal', bezit: { [NAAM]: 'kaart' } });
  const klok = () => (typeof nu === 'function' ? nu() : new Date().toISOString());

  /* Een aanmelding tellen. Wat niet klopt wordt NIET geteld en niet gerepareerd:
     een onbekend kanaal wordt geen "anders", want dan meet "anders" de fouten. */
  function tel({ kanaal, campagne } = {}) {
    const k = kanaal == null || kanaal === '' ? null : String(kanaal);
    const c = campagne == null || campagne === '' ? null : String(campagne).trim().toLowerCase();
    if (k != null && !KANALEN.includes(k)) return { geteld: false, reden: 'onbekend kanaal' };
    if (c != null && !CODE.test(c)) return { geteld: false, reden: 'ongeldige campagnecode' };
    if (k == null && c == null) return { geteld: false, reden: 'niets opgegeven' };
    const maand = klok().slice(0, 7);
    const kaart = eigen.bak(NAAM);
    const m = kaart[maand] || (kaart[maand] = { kanalen: {}, campagnes: {}, totaal: 0 });
    const geregistreerd = c && typeof campagneKanaal === 'function' ? campagneKanaal(c) : null;
    const kan = k || geregistreerd || 'campagne';
    m.kanalen[kan] = (m.kanalen[kan] || 0) + 1;
    if (c) m.campagnes[c] = (m.campagnes[c] || 0) + 1;
    m.totaal += 1;
    ruimKanaalOp(kaart, maand);
    save();
    return { geteld: true };
  }

  function ruimKanaalOp(kaart, maand) {
    const [j, mm] = maand.split('-').map(Number);
    const grens = new Date(Date.UTC(j, mm - BEWAAR_MAANDEN, 1)).toISOString().slice(0, 7);
    for (const m of Object.keys(kaart)) if (m < grens) delete kaart[m];
  }

  /* De telling van een maand, langs de groepspoort. Lezen maakt niets aan. */
  function stand(maand) {
    const m = /^\d{4}-\d{2}$/.test(String(maand || '')) ? String(maand) : klok().slice(0, 7);
    const r = eigen.kijk(NAAM)[m] || { kanalen: {}, campagnes: {}, totaal: 0 };
    return { maand: m,
      kanalen: groepeer(KANALEN.map(k => ({ naam: k, aantal: r.kanalen[k] || 0 })), { benoemd: true }),
      campagnes: groepeer(Object.entries(r.campagnes).map(([naam, aantal]) => ({ naam, aantal }))),
      dektNiet: ['Alleen wie de vraag beantwoordde of via een link met een campagnecode kwam; de rest staat nergens.',
        'Een telling per maand en geen herkomst per lid: behoud of kosten per kanaal zijn daaruit niet te volgen.'] };
  }

  const keuzes = () => KANALEN.map(id => ({ id, label: LABELS[id] }));

  return { aanmeldkanaalTel: tel, aanmeldkanaalStand: stand, aanmeldkanaalKeuzes: keuzes, AANMELDKANALEN: KANALEN };
};
