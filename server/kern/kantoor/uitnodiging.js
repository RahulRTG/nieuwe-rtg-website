/* DE KANTOORUITNODIGING -- AUTHORITY.md fase 2, en sinds 27 september 2026
   een credential volgens het releasebeleid (office.kantooruitnodiging, B9).

   Besluit van de eigenaar (23 september 2026): de gedeelde code koppelt geen
   kantoorrol meer. Een uitnodiging bewijst WIE er koppelt:

     - OP NAAM: aan een sleutel gebonden, en alleen die sleutel verzilvert hem;
     - EENMALIG: max_gebruik 1, en de claim staat in een collectietransactie,
       dus twee instances kunnen hem niet allebei verzilveren;
     - ZEVEN DAGEN geldig, met issuer/doel/scope;
     - 128 BIT (KU.<32 hex, ../bearercode.js), alleen als hash bewaard en
       constant-time gezocht; kaal alleen in het antwoord op de uitgifte;
     - INTREKBAAR door de eigenaar, en een nieuwe uitgifte voor dezelfde sleutel
       IS de rotatie: de open uitnodiging wordt daarbij ingetrokken.

   Uitnodigingen van voor de migratie hebben alleen een ongenaamruimde hash van
   een code van circa 50 bit en openen niets meer; de eigenaar geeft opnieuw uit.

   Wat hier NIET gebeurt: een recht verlenen. Een verzilverde uitnodiging levert
   precies de kantoorrol, niet meer. */
'use strict';

const GELDIG_DAGEN = 7;
const DAG = 86400000;
const DOEL = 'kantoorrol-koppelen';
const SCOPE = Object.freeze(['kantoor.koppel']);
const VORM = /^KU\.[0-9A-F]{32}$/i;
const FOUT = { status: 401, error: 'Deze uitnodiging is niet geldig voor uw account, al gebruikt of verlopen.' };

function maakUitnodiging({ db, save, crypto, nu, bewerkCollectie }) {
  const tijd = nu || Date.now;
  const iso = () => new Date(tijd()).toISOString();
  const bearer = require('../bearercode')({ crypto, namespace: 'office.kantooruitnodiging', nu: iso });
  const eigen = require('../eigencollectie')({ db, domein: 'kern/kantoor/uitnodiging',
    bezit: { kantoorUitnodigingen: 'lijst', kantoorKoppelwegen: 'kaart' } });
  const transactie = werk => {
    if (typeof bewerkCollectie !== 'function') return { status: 503, error: 'De kantooruitnodiging is niet bedraad in deze server.' };
    eigen.bak('kantoorUitnodigingen'); // een lege collectie is een lijst en geen kaart
    return bewerkCollectie('kantoorUitnodigingen', l => {
      if (!Array.isArray(l)) throw new Error('kantoorUitnodigingen hoort een lijst te zijn');
      return werk(l);
    });
  };
  // constant-time over de hele lijst; een verkeerd gevormde code wordt niet eens gehasht
  const zoek = (l, code) => VORM.test(String(code || '').trim()) ? bearer.vind(l, code, u => u.toegang && u.toegang.code_hash) : null;
  const stand = u => !u.toegang ? 'ongeldig' : u.toegang.gebruik >= u.toegang.max_gebruik ? 'gebruikt'
    : u.toegang.ingetrokken_at ? 'ingetrokken' : bearer.reden(u.toegang) === 'verlopen' ? 'verlopen' : 'open';

  /* Een nieuwe uitnodiging voor een sleutel; een open uitnodiging voor dezelfde
     sleutel wordt in dezelfde transactie ingetrokken (dat is de rotatie). */
  function maak({ voorKey, codenaam, door }) {
    if (!/^user-\d+$/.test(String(voorKey || '')))
      return { status: 400, error: 'Een uitnodiging hangt aan een persoonlijke RTG-inlog.' };
    return transactie(l => {
      for (const u of l) if (u.voorKey === voorKey && u.toegang && !u.toegang.ingetrokken_at && u.toegang.gebruik < 1)
        bearer.intrekken(u.toegang, door || 'eigenaar', 'vervangen door een nieuwe uitnodiging');
      const id = 'uitn_' + crypto.randomBytes(8).toString('hex');
      const g = bearer.maak({ prefix: 'KU', issuer: 'rtg.kantoor.eigenaar', doel: DOEL, scope: SCOPE,
        onderwerp: { soort: 'kantooruitnodiging', id, voorKey }, geldigMs: GELDIG_DAGEN * DAG, maxGebruik: 1 });
      l.push({ id, voorKey, codenaam: codenaam || null, door: door || null, toegang: g.toegang,
        gemaakt: g.toegang.issued_at, verloopt: g.toegang.expires_at });
      if (l.length > 2000) l.splice(0, l.length - 2000);
      return { ok: true, id, code: g.code, verloopt: g.toegang.expires_at,
        let: 'Deze code wordt maar een keer getoond. Geef hem op een veilige manier aan de medewerker.' };
    });
  }

  /* Verzilveren: alleen door de sleutel waarvoor hij is gemaakt, een keer, en
     binnen de vervaldatum. Een foute poging zegt niet WELKE voorwaarde viel. De
     proef leest de werkkopie en verbruikt niets: de tweede factor komt nog. */
  function magVerzilveren(u, key) {
    return !!(u && u.voorKey === key && u.toegang && u.toegang.onderwerp && u.toegang.onderwerp.id === u.id &&
      u.toegang.onderwerp.voorKey === key && !bearer.reden(u.toegang, { doel: DOEL, scope: SCOPE }));
  }
  function verzilver(key, code, opties) {
    if (opties && opties.proef) return magVerzilveren(zoek(eigen.kijk('kantoorUitnodigingen') || [], code), key) ? { ok: true } : FOUT;
    return transactie(l => {
      const u = zoek(l, code);
      if (!magVerzilveren(u, key)) return FOUT;
      bearer.gebruik(u.toegang);
      return { ok: true };
    });
  }

  function intrek(id, door) {
    return transactie(l => {
      const u = l.find(x => x && x.id === String(id || ''));
      if (!u || !u.toegang) return { status: 404, error: 'Deze uitnodiging bestaat niet.' };
      if (u.toegang.gebruik >= u.toegang.max_gebruik) return { status: 409, error: 'Deze uitnodiging is al gebruikt; ontkoppel de kantoorrol in plaats daarvan.' };
      bearer.intrekken(u.toegang, door || 'eigenaar', 'ingetrokken door de eigenaar');
      return { ok: true, id: u.id, stand: stand(u) };
    });
  }

  /* De schaduw van fase 2: langs welke weg de kantoorrol werd gekoppeld. */
  function telWeg(weg) {
    const k = eigen.bak('kantoorKoppelwegen');
    k[weg] = (k[weg] || 0) + 1;
    save();
  }

  function overzicht() {
    return {
      uitnodigingen: (eigen.kijk('kantoorUitnodigingen') || []).slice(-100).reverse().map(u => ({ id: u.id,
        codenaam: u.codenaam, gemaakt: u.gemaakt, verloopt: u.verloopt, stand: stand(u),
        toegang: bearer.publiek(u.toegang) })),
      koppelwegen: Object.assign({ gedeeldeCode: 0, gedeeldeCodeGeweigerd: 0, uitnodiging: 0 }, eigen.kijk('kantoorKoppelwegen') || {}),
      uitleg: 'Sinds 23 september 2026 koppelt de gedeelde kantoorcode geen kantoorrol meer aan een account (besluit ' +
        'van de eigenaar); gedeeldeCode telt de koppelingen van daarvoor, gedeeldeCodeGeweigerd de pogingen erna.'
    };
  }

  return { maak, verzilver, intrek, telWeg, overzicht, GELDIG_DAGEN };
}

module.exports = { maakUitnodiging };
