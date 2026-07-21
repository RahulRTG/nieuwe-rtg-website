/* Gedeelde hulpjes voor de genre-kernen (verzorging, clubs, ...):
   tijd- en datumvormen, id's en pasnummers, lijst-caps en de bak-fabriek
   die per zaak een eigen opslag met demo-inhoud aanmaakt. */

const MAX_LIJST = 200;
const TIJD = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATUM = /^\d{4}-\d{2}-\d{2}$/;

const maakHulp = ({ db, save, crypto }) => {
  const nu = () => new Date().toISOString();
  return {
    nu,
    vandaag: () => nu().slice(0, 10),
    id: p => p + crypto.randomBytes(3).toString('hex'),
    pas: p => p + '-' + crypto.randomBytes(2).toString('hex').toUpperCase(),
    cap: (lijst, max) => { if (lijst.length > max) lijst.length = max; },
    bak: (naam, maker) => (code) => {
      if (!db.data[naam]) db.data[naam] = {};
      if (!db.data[naam][code]) { db.data[naam][code] = maker(); save(); }
      return db.data[naam][code];
    },
    plusMin: (tijd, minuten) => {
      const t = Number(tijd.slice(0, 2)) * 60 + Number(tijd.slice(3)) + minuten;
      return String(Math.floor(t / 60) % 24).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0');
    }
  };
};

module.exports = { MAX_LIJST, TIJD, DATUM, maakHulp };
