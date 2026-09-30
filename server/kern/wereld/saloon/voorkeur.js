'use strict';
/* Alleen gebruikerskeuzes wonen hier. Publicaties blijven bij hun bron. */
const BRONNEN = Object.freeze([
  { id: 'sociaal', naam: 'Mensen en communities' },
  { id: 'nieuws', naam: 'Journalistiek' },
  { id: 'makers', naam: 'Makers en media' },
  { id: 'plekken', naam: 'Zaken en plekken' },
  { id: 'livingworld', naam: 'Living World' },
  { id: 'persoonlijk', naam: 'Mijn reizen', prive: true }
]);
const IDS = BRONNEN.map(x => x.id);
const VORMEN = ['overzicht', 'agenda', 'bewaard'];
function schoonSaloonKeuzes(o = {}) {
  return {
    bronnen: Array.isArray(o.bronnen) ? IDS.filter(x => o.bronnen.includes(x)) : IDS.filter(x => x !== 'persoonlijk'),
    zoek: String(o.zoek || '').trim().slice(0, 100),
    plaats: String(o.plaats || '').trim().slice(0, 60),
    vorm: VORMEN.includes(o.vorm) ? o.vorm : 'overzicht',
    bewaard: Array.isArray(o.bewaard) ? [...new Set(o.bewaard.filter(x => typeof x === 'string'
      && x.length <= 240 && /^[a-z]+:/.test(x)))].slice(-200) : []
  };
}
module.exports = ({ haal, schrijf }) => {
  const lees = key => schoonSaloonKeuzes(haal(key) || {});
  function zet(key, invoer) {
    const voor = lees(key);
    const na = schoonSaloonKeuzes({ ...voor, ...(invoer || {}), bewaard: voor.bewaard });
    const actie = invoer && invoer.bewaar;
    if (actie && typeof actie.id === 'string') {
      na.bewaard = schoonSaloonKeuzes({ bewaard: actie.aan === true ? voor.bewaard.concat(actie.id)
        : voor.bewaard.filter(x => x !== actie.id) }).bewaard;
    }
    schrijf(key, na);
    return na;
  }
  return { lees, zet };
};
module.exports.BRONNEN = BRONNEN;
module.exports.schoon = schoonSaloonKeuzes;
