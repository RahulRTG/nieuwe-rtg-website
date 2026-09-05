/* Autoritatieve lifecycle van de TravelOS-boarding-pass.

   Iedere mutatie loopt door `bewerkCollectie('luchthaven')`. In PostgreSQL
   betekent dat één advisory lock + row lock + commit, zodat twee instances
   nooit allebei dezelfde check-in, rotatie of loungeclaim kunnen winnen. De
   callback blijft synchroon; de opslaglaag publiceert pas na een geslaagde
   commit. */
'use strict';

module.exports = ({ db, bewerkCollectie, crypto,
  nu = () => new Date().toISOString(), vandaag = () => new Date().toISOString().slice(0, 10) }) => {
  const t = require('./boarding-pass-toegang')({ crypto, nu });

  function metLuchthaven(werk) {
    const pasToe = bron => {
      const l = t.luchthaven(bron);
      const gemigreerd = t.migreerLegacy(l);
      return werk(l, gemigreerd);
    };
    if (typeof bewerkCollectie !== 'function')
      throw new Error('De boarding-passcollectietransactie ontbreekt.');
    return bewerkCollectie('luchthaven', pasToe);
  }

  const actiefVlucht = v => v && !['vertrokken', 'afgerond', 'geannuleerd'].includes(v.status);
  function vluchtReden(v) {
    if (!v) return 'vlucht-ontbreekt';
    if (v.status === 'geannuleerd') return 'vlucht-geannuleerd';
    if (v.status === 'vertrokken' || v.status === 'afgerond') return 'vlucht-gesloten';
    if (v.datum !== vandaag()) return 'verkeerde-reisdag';
    return null;
  }
  function passPubliek(b, v) {
    return { id: b.pass_id, naam: b.codenaam, vlucht: v.nummer,
      bestemming: v.bestemming, datum: v.datum, tijd: v.tijd,
      gate: v.gate, stoel: b.stoel };
  }
  function boekingPubliek(l, b) {
    const v = t.vindVlucht(l, b.vluchtId);
    if (!v) return null;
    return { id: b.id, status: b.status, stoel: b.stoel, pass: t.publiek(b),
      vluchtId: v.id,
      koffers: l.koffers.filter(k => k.boekingId === b.id)
        .map(k => ({ tag: k.tag, status: k.status, band: k.band })) };
  }
  function hoogsteRotatie(b) {
    return Math.max(0, Number(b.toegang && b.toegang.rotatie) || 0,
      ...t.historie(b).map(x => Number(x && x.rotatie) || 0));
  }
  function bewaarOudeToegang(b, actor, reden) {
    if (!b.toegang) return;
    t.bearer.intrekken(b.toegang, actor, reden);
    if (!Array.isArray(b.pass_historie)) b.pass_historie = [];
    b.pass_historie.push(b.toegang);
    if (b.pass_historie.length > 24) b.pass_historie.splice(0, b.pass_historie.length - 24);
    b.toegang = null;
  }

  function boek({ key, codenaam, vluchtId }) {
    return metLuchthaven(l => {
      const v = t.vindVlucht(l, vluchtId);
      if (!v || v.soort !== 'vertrek') return { status: 404, error: 'Vlucht niet gevonden.' };
      if (!['gepland', 'inchecken'].includes(v.status))
        return { status: 409, error: 'Deze vlucht is niet meer te boeken (' + v.status + ').' };
      if (l.boekingen.some(b => b.key === key && b.vluchtId === v.id && b.status !== 'geannuleerd'))
        return { status: 409, error: 'Je staat al op deze vlucht.' };
      const b = { id: t.nieuwId('bk'), vluchtId: v.id, key,
        codenaam: String(codenaam || 'Reiziger').slice(0, 60), status: 'geboekt',
        stoel: null, koffers: 0, pass_id: null, toegang: null,
        pass_historie: [], pass_claims: [], at: nu() };
      l.boekingen.unshift(b);
      if (l.boekingen.length > 50000) l.boekingen.length = 50000;
      return { status: 200, ok: true, boekingId: b.id, vluchtId: v.id, statusBoeking: b.status };
    });
  }

  function incheck({ key, boekingId, koffers }) {
    return metLuchthaven(l => {
      const b = t.vindBoeking(l, boekingId, key);
      if (!b) return { status: 404, error: 'Boeking niet gevonden.' };
      const v = t.vindVlucht(l, b.vluchtId);
      if (!v) return { status: 404, error: 'Vlucht niet gevonden.' };
      if (v.status === 'gepland') return { status: 409, error: 'Het inchecken voor ' + v.nummer + ' is nog niet open.' };
      if (v.status !== 'inchecken') return { status: 409, error: 'Het inchecken voor ' + v.nummer + ' is gesloten (' + v.status + ').' };
      if (b.status === 'ingecheckt') return { status: 409,
        error: 'Je bent al ingecheckt. De eenmalige code wordt niet opnieuw getoond; roteer de pass als zij verloren is.' };
      if (b.status !== 'geboekt') return { status: 409, error: 'Deze boeking kan niet worden ingecheckt (' + b.status + ').' };
      const stoelen = l.boekingen.filter(x => x.vluchtId === v.id && x.stoel).length;
      b.stoel = (Math.floor(stoelen / 6) + 1) + 'ABCDEF'[stoelen % 6];
      b.status = 'ingecheckt';
      b.koffers = Math.min(3, Math.max(0, Math.round(Number(koffers) || 0)));
      const tags = [];
      for (let i = 0; i < b.koffers; i++) {
        const kf = { tag: 'RTG-' + crypto.randomBytes(8).toString('hex').toUpperCase(),
          vluchtId: v.id, boekingId: b.id, codenaam: b.codenaam,
          status: 'ingecheckt', band: null, at: nu() };
        l.koffers.unshift(kf); tags.push(kf.tag);
      }
      if (l.koffers.length > 100000) l.koffers.length = 100000;
      const gemaakt = t.maakToegang(b, v, hoogsteRotatie(b) + 1);
      b.toegang = gemaakt.toegang;
      return { status: 200, ok: true, eenmalig: true,
        pass: Object.assign({ code: gemaakt.code, eenmalig: true }, passPubliek(b, v),
          { toegang: t.publiek(b), koffers: tags }) };
    });
  }

  function roteer({ key, boekingId, verwachteRotatie }) {
    return metLuchthaven(l => {
      const b = t.vindBoeking(l, boekingId, key);
      if (!b) return { status: 404, error: 'Boeking niet gevonden.' };
      const v = t.vindVlucht(l, b.vluchtId);
      if (b.status !== 'ingecheckt' || !actiefVlucht(v) || vluchtReden(v))
        return { status: 409, error: 'Voor deze boeking kan geen boarding pass worden uitgegeven.' };
      const rotatie = hoogsteRotatie(b);
      if (!Number.isSafeInteger(Number(verwachteRotatie)) || Number(verwachteRotatie) !== rotatie)
        return { status: 409, error: 'De boarding pass is intussen gewijzigd. Vernieuw Mijn vluchten.' };
      bewaarOudeToegang(b, t.lidHash(key), 'boarding pass geroteerd');
      const gemaakt = t.maakToegang(b, v, rotatie + 1);
      b.toegang = gemaakt.toegang;
      return { status: 200, ok: true, eenmalig: true,
        pass: Object.assign({ code: gemaakt.code, eenmalig: true }, passPubliek(b, v),
          { toegang: t.publiek(b) }) };
    });
  }

  function intrekken({ key, boekingId, verwachteRotatie }) {
    return metLuchthaven(l => {
      const b = t.vindBoeking(l, boekingId, key);
      if (!b) return { status: 404, error: 'Boeking niet gevonden.' };
      const rotatie = hoogsteRotatie(b);
      if (!Number.isSafeInteger(Number(verwachteRotatie)) || Number(verwachteRotatie) !== rotatie)
        return { status: 409, error: 'De boarding pass is intussen gewijzigd. Vernieuw Mijn vluchten.' };
      if (!b.toegang || b.toegang.ingetrokken_at)
        return { status: 200, ok: true, herhaald: true, pass: t.publiek(b) };
      t.bearer.intrekken(b.toegang, t.lidHash(key), 'lid heeft boarding pass ingetrokken');
      return { status: 200, ok: true, pass: t.publiek(b) };
    });
  }

  const { controleerEnClaim, loungeIn } = require('./boarding-pass-consumers')({
    t, metLuchthaven, nu, vluchtReden, passPubliek
  });

  function annuleerVlucht({ vluchtId, actor }) {
    return metLuchthaven(l => {
      const v = t.vindVlucht(l, vluchtId);
      if (!v) return { status: 404, error: 'Vlucht niet gevonden.' };
      if (!actiefVlucht(v)) return { status: 409, error: 'Deze vlucht is al ' + v.status + '.' };
      const refs = [];
      v.status = 'geannuleerd';
      for (const b of l.boekingen) if (b.vluchtId === v.id && b.status !== 'geannuleerd') {
        refs.push({ key: b.key, id: b.id });
        if (b.toegang) t.bearer.intrekken(b.toegang, actor || 'vluchtleiding', 'vlucht geannuleerd');
        b.status = 'geannuleerd';
      }
      return { status: 200, ok: true, vluchtId: v.id, refs };
    });
  }

  function mijnUit(l, key) {
    const boekingen = [];
    for (const b of l.boekingen.filter(x => x.key === key).slice(0, 20)) {
      const p = boekingPubliek(l, b);
      if (p) boekingen.push(p);
    }
    return { ok: true, boekingen };
  }
  function mijn(key) {
    const l = db.data.luchthaven && typeof db.data.luchthaven === 'object'
      ? db.data.luchthaven : { vluchten: [], boekingen: [], koffers: [] };
    return mijnUit(l, key);
  }
  const mijnVeilig = key => metLuchthaven(l => mijnUit(l, key));
  const migreerAlles = () => metLuchthaven((_l, aantal) => ({ gewijzigd: aantal > 0, aantal }));

  return { boek, incheck, roteer, intrekken, controleerEnClaim, loungeIn,
    annuleerVlucht, mijn, mijnVeilig, migreerAlles, boekingPubliek,
    nieuwBoekingId: () => t.nieuwId('bk'), toegang: t };
};
