/* ============================================================================
   DE KANT VAN WIE EEN KWESTIE INBRENGT.

   Vier handelingen: inbrengen, de eigen kwesties lezen, een uitkomst openen, en
   zelf stoppen. De sleutel komt altijd uit de sessie (routes/democratie/), nooit
   uit het verzoek, en een lid ziet en raakt alleen wat bij zijn eigen
   inbrengersnummers hoort -- ook een kwestie waar hij via een samenvoeging
   volger van werd.

   `mijn` is het BEWEZEN LEESPAD van de terugkoppeling: zodra een eindstand
   vastligt, staat hij hier, in dezelfde vastlegging. */
'use strict';

const { schoon } = require('../util');
const { EINDSTANDEN } = require('./eindstanden');

function maakLid({ kaart, kijk, zoek, schrijver, koppeling, vastleggen, publiek, wek, ontvangersVan, crypto }) {
  const nieuwId = () => 'KW-' + crypto.randomBytes(3).toString('hex').toUpperCase();

  async function inbreng(sleutel, b) {
    const onderwerp = schoon(b.onderwerp, 600);
    if (onderwerp.length < 10) return { status: 400, error: 'Vertel in minstens tien tekens wat er speelt.' };
    const gebied = schoon(b.gebied, 80) || null;
    let k = null;
    const mis = await vastleggen(() => {
      const kw = kaart();
      let id = nieuwId();
      while (kw[id]) id = nieuwId();
      const inbrenger = koppeling.koppel(sleutel);
      k = schrijver.nieuw({ id, inbrenger, onderwerp, gebied });
      kw[id] = k;
    });
    if (mis) return mis;
    return { status: 200, ok: true, kwestie: publiek(k, [k.inbrenger]) };
  }

  function mijn(sleutel) {
    const refs = koppeling.nummersVan(sleutel);
    const lijst = Object.values(kijk())
      .filter(k => ontvangersVan(k).some(ref => refs.includes(ref)))
      .sort((a, b) => String(b.at).localeCompare(String(a.at)))
      .map(k => publiek(k, refs));
    return { ok: true, kwesties: lijst, eindstanden: EINDSTANDEN };
  }

  async function eigenHandeling(sleutel, id, werk) {
    const k = zoek(id);
    const refs = k ? koppeling.nummersVan(sleutel).filter(ref => ontvangersVan(k).includes(ref)) : [];
    if (!k || !refs.length) return { status: 404, error: 'Die kwestie staat niet op uw naam.' };
    return werk(k, refs);
  }

  /* De uitkomst zelf openen: de derde trede van de terugkoppeling. */
  const gezien = (sleutel, id) => eigenHandeling(sleutel, id, async (k, refs) => {
    const mis = await vastleggen(() => { for (const ref of refs) schrijver.trede(k, ref, 'gezien'); });
    return mis || { ok: true, kwestie: publiek(k, refs) };
  });

  const intrek = (sleutel, id) => eigenHandeling(sleutel, id, async (k, refs) => {
    if (!refs.includes(k.inbrenger)) return { status: 403, error: 'Alleen wie de kwestie inbracht, kan hem intrekken.' };
    /* Wie volgt, is door een samenvoeging bij deze kwestie gekomen en heeft er
       zelf belang bij. Intrekken zou HUN kwestie afsluiten als "ingetrokken",
       zonder naam en zonder reden. */
    if ((k.volgers || []).length) {
      return { status: 409, error: 'Anderen volgen deze kwestie ook; u kunt hem niet voor hen afsluiten. Het kantoor kan hem afsluiten, met een reden.' };
    }
    const fout = schrijver.toetsEindstand(k, { stand: 'ingetrokken' }, true);
    if (fout) return fout;
    const mis = await vastleggen(() => {
      schrijver.sluit(k, 'de inbrenger', { stand: 'ingetrokken', toelichting: null }, ontvangersVan(k));
      schrijver.trede(k, k.inbrenger, 'gezien');
    });
    if (mis) return mis;
    await wek(k);
    return { ok: true, kwestie: publiek(k, refs) };
  });

  return { inbreng, mijn, gezien, intrek };
}

module.exports = { maakLid };
