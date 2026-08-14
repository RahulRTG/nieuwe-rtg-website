/* De API-poort, deelbestand "controle": het oordeel bij ELK verzoek.

   ./apipoort.js gaat over BEHEER -- wat er ooit achter de poort mag (de
   toelating), en wie er een sleutel krijgt. Dit bestand doet iets anders: het
   staat in het pad van elk binnenkomend verzoek en zegt ja of nee. Dat is een
   andere soort code, met andere eisen:

   - HIJ MAG NIETS LEKKEN. De vergelijking van de sleutel loopt via veiligGelijk
     en niet via !==: een vergelijking die bij het eerste verschillende teken
     stopt, verraadt hoe ver een gok goed was.
   - HIJ MOET ALTIJD EEN REDEN GEVEN. Elke nee draagt een status en een zin.
     401 onbekend of ingetrokken, 403 buiten de scope of niet in de toelating,
     410 uitgefaseerd (met de datum die vooraf is aangekondigd), 429 quotum op
     (met wanneer het weer mag). Een poort die alleen "nee" zegt, laat een
     koppeling gokken -- en dan gokt hij, elk uur opnieuw.
   - HIJ TELT MEE OP DE OPSLAG. De emmer is het uur sinds 1970 en staat in de
     opslag, dus een herstart wist het quotum niet.

   Krijgt van ./apipoort.js wat hij nodig heeft; hij kiest niets zelf. */
'use strict';
const { nu: klokNu } = require('../../lib/klok');

module.exports = ({ vak, save, hash, veiligGelijk, binnenToelating, kort, UUR }) => {

  /* ---------- de controle, voor de middleware ---------- */

  function apiSleutelOk(aangeboden, pad, methode, tijd) {
    const t = typeof tijd === 'number' ? tijd : klokNu();
    const m = /^RTG-([a-z0-9-]{4,12})\.(.+)$/i.exec(String(aangeboden || ''));
    if (!m) return { ok: false, status: 401, reden: 'geen geldige sleutel meegegeven' };
    const s = vak().sleutels[m[1]];
    if (!s) return { ok: false, status: 401, reden: 'onbekende sleutel' };
    if (s.ingetrokken) return { ok: false, status: 401, reden: 'deze sleutel is ingetrokken' };
    if (s.vervalt && Date.parse(s.vervalt) < t) return { ok: false, status: 401, reden: 'deze sleutel is verlopen' };
    /* veiligGelijk en niet !==: een vergelijking die bij het eerste
       verschillende teken stopt, lekt hoe ver een gok goed was. Overal elders
       in dit huis staat veiligGelijk; hier dus ook. */
    if (!veiligGelijk(hash(m[2], s.zout), s.hash)) {
      s.geweigerd++; save();
      return { ok: false, status: 401, reden: 'sleutel klopt niet' };
    }

    const p = String(pad || '');
    const scope = s.scopes.find(sc => (p === sc.pad || p.startsWith(sc.pad + '/')) &&
      sc.methoden.includes(String(methode || 'GET').toUpperCase()));
    if (!scope) return { ok: false, status: 403, reden: 'buiten de scope van deze sleutel', sleutel: s.id };

    const toel = binnenToelating(p);
    if (!toel) return { ok: false, status: 403, reden: 'dit pad staat niet (meer) in de toelating', sleutel: s.id };
    if (toel.uitfasering && Date.parse(toel.uitfasering) < t) {
      return { ok: false, status: 410, sleutel: s.id,
        reden: 'dit pad is uitgefaseerd per ' + toel.uitfasering + ' en is aangekondigd voordat hij stopte' };
    }

    /* Het quotum. De emmer is het uur sinds 1970; hij staat in de opslag, dus
       een herstart wist hem niet. */
    const emmer = Math.floor(t / UUR);
    if (s.teller.uur !== emmer) s.teller = { uur: emmer, n: 0 };
    if (s.teller.n >= s.quotaPerUur) {
      s.geweigerd++;
      save();
      return { ok: false, status: 429, sleutel: s.id,
        reden: 'quotum van ' + s.quotaPerUur + ' verzoeken per uur is op',
        herstartOver: Math.ceil(((emmer + 1) * UUR - t) / 1000) };
    }
    s.teller.n++;
    s.laatst = new Date(t).toISOString();
    save();
    return {
      ok: true, sleutel: s.id, naam: s.naam, versie: toel.versie,
      rest: s.quotaPerUur - s.teller.n,
      uitfasering: toel.uitfasering || null
    };
  }

  return { apiSleutelOk };
};
