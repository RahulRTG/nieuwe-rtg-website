/* ============================================================================
   VOLTOOIPROEF: MIJN ONDERNEMING (link:onderneming, /apps/onderneming.html).

   De belofte van het scherm: een ondernemer begint met een werktitel, kiest een
   rechtsvorm, werkt het oprichtingsproject af, laat zijn idee doorrekenen, legt
   zijn plan vast en schrijft zich in -- en het staat er morgen nog, op zijn
   naam en op die van niemand anders.

   Een vers RTG-lid is de ondernemer; dit is de fase van voor de zaak, dus er
   komt geen kantoor of leverancier aan te pas. Alle routes zijn die van het
   scherm zelf (api(...) onder /api/onderneming/).
   ========================================================================== */
'use strict';
const { nieuwLid } = require('../voltooiwereld');

const MIJN = '/api/onderneming/mijn';
const NIEUW = '/api/onderneming/nieuw';
const RECHTSVORM = '/api/onderneming/rechtsvorm';
const OPRICHTING_ZET = '/api/onderneming/oprichting/zet';
const OPRICHTING = '/api/onderneming/oprichting';
const DAGBEELD = '/api/onderneming/dagbeeld';
const INTAKE = '/api/onderneming/intake';
const VERKENNING = '/api/onderneming/verkenning';
const PLAN = '/api/onderneming/plan/vastleggen';
const INGESCHREVEN = '/api/onderneming/ingeschreven';
const KAS = '/api/onderneming/kas/saldo';

const IDEE = { branche: 'koffie', wat: 'Koffiebar met eigen branding', doelgroep: 'Forensen', plaats: 'Utrecht',
  prijs: 4, kostprijs: 1.2, verwachtPerMaand: 3000, vasteLasten: 4000 };

async function loop(w, stap) {
  const merk = 'O' + Date.now().toString(36).slice(-5);
  const L = await nieuwLid(w, 'ond');
  const mijn = async (tok) => ((((await w.post(MIJN, {}, tok || L.token)).data) || {}).ondernemingen) || [];
  const metNaam = async (naam, tok) => (await mijn(tok)).filter((o) => o.naam === naam);
  const hoofd = 'Koffie ' + merk;
  let id = null;

  /* ---------------- voltooibaar ---------------- */
  await stap('voltooibaar', 'het lid begint een onderneming met alleen een werktitel; ze staat op zijn naam in de fase idee', async () => {
    const r = await w.post(NIEUW, { naam: hoofd, idem: 'nieuw-' + merk }, L.token);
    id = r.data && r.data.onderneming && r.data.onderneming.id;
    const o = await metNaam(hoofd);
    return { klopt: r.status === 200 && o.length === 1 && o[0].id === id && o[0].fase === 'idee',
      ziet: 'nieuw ' + r.status + ', ' + o.length + ' op zijn naam, fase ' + (o[0] && o[0].fase) };
  });

  await stap('voltooibaar', 'hij kiest de eenmanszaak; het oprichtingsproject krijgt zijn stappen en hij vinkt er een af', async () => {
    const leeg = await w.post(OPRICHTING, { id }, L.token);
    const r = await w.post(RECHTSVORM, { id, rechtsvorm: 'eenmanszaak' }, L.token);
    const voor = await w.post(OPRICHTING, { id }, L.token);
    const eerste = voor.data.stappen[0];
    const z = await w.post(OPRICHTING_ZET, { id, stap: eerste.id, klaar: true }, L.token);
    const na = await w.post(OPRICHTING, { id }, L.token);
    return { klopt: leeg.data.stand === 'geen-rechtsvorm' && r.status === 200 && voor.data.totaal >= 3 && z.status === 200 && na.data.gedaan === 1,
      ziet: 'zonder vorm "' + leeg.data.stand + '", rechtsvorm ' + r.status + ', stappen ' + voor.data.totaal + ', gedaan ' + na.data.gedaan };
  });

  await stap('voltooibaar', 'hij vult zijn idee in en de verkenning rekent het door; daarna legt hij het plan vast', async () => {
    const i = await w.post(INTAKE, { id, idee: IDEE, persoon: { urenPerWeek: 40 } }, L.token);
    const v = await w.post(VERKENNING, { id }, L.token);
    let p = await w.post(PLAN, { id }, L.token);
    /* Een plan met blokkerend advies vraagt het scherm om te bevestigen;
       bevestigen is een keuze van het lid, en die legt het scherm vast. */
    if (p.status === 409) p = await w.post(PLAN, { id, tochDoorzetten: true }, L.token);
    const sim = v.data && v.data.simulatie;
    const o = (await metNaam(hoofd))[0];
    return { klopt: i.status === 200 && v.status === 200 && !!sim && !sim.error && p.status === 200 && o.feiten.plan === true,
      ziet: 'intake ' + i.status + ', simulatie ' + (sim && sim.error ? 'FOUT ' + sim.error : 'rekent') + ', plan ' + p.status };
  });

  await stap('voltooibaar', 'hij legt zijn KvK-inschrijving en kassaldo vast; het dagbeeld groet hem in een verdere fase', async () => {
    const k = await w.post(INGESCHREVEN, { id, kvk: '9' + merk.slice(1).replace(/\D/g, '1').padEnd(7, '0').slice(0, 7) }, L.token);
    const s = await w.post(KAS, { id, bedrag: 2500 }, L.token);
    const d = await w.post(DAGBEELD, { id }, L.token);
    return { klopt: k.status === 200 && !!k.data.onderneming.kvk && s.status === 200 && s.data.saldo.bedrag === 2500 && d.status === 200 && d.data.fase !== 'idee',
      ziet: 'kvk ' + k.status + ', saldo ' + (s.data && s.data.saldo && s.data.saldo.bedrag) + ', fase ' + (d.data && d.data.fase) };
  });

  await stap('voltooibaar', 'een ander lid ziet deze onderneming niet en wijzigt er niets aan', async () => {
    const B = await nieuwLid(w, 'ondb');
    const r = await w.post(RECHTSVORM, { id, rechtsvorm: 'bv' }, B.token);
    const d = await w.post(DAGBEELD, { id }, B.token);
    const k = await w.post(KAS, { id, bedrag: 1 }, B.token);
    const o = (await metNaam(hoofd))[0];
    return { klopt: (await mijn(B.token)).length === 0 && r.status === 404 && d.status === 404 && k.status === 404 && o.rechtsvorm && o.rechtsvorm.id !== 'bv',
      ziet: 'rechtsvorm ' + r.status + ', dagbeeld ' + d.status + ', kas ' + k.status + '; rechtsvorm blijft ' + (o.rechtsvorm && o.rechtsvorm.id) };
  });

  await stap('voltooibaar', 'zonder sessie leest of schrijft niemand iets: beide geven 401 met een melding', async () => {
    const l = await w.post(MIJN, {});
    const s = await w.post(NIEUW, { naam: 'Anoniem' });
    return { klopt: l.status === 401 && s.status === 401 && !!(l.data && l.data.error) && !!(s.data && s.data.error),
      ziet: 'lezen ' + l.status + ', schrijven ' + s.status };
  });

  /* ---------------- persistent ---------------- */
  await w.herstart();
  await stap('persistent', 'na een nette herstart staat de onderneming er een keer, met vorm, plan en inschrijving', async () => {
    const o = await metNaam(hoofd);
    return { klopt: o.length === 1 && !!o[0].kvk && o[0].feiten.plan === true && o[0].rechtsvorm && o[0].rechtsvorm.id === 'eenmanszaak',
      ziet: o.length + ' onderneming, kvk ' + (o[0] && o[0].kvk) + ', vorm ' + (o[0] && o[0].rechtsvorm && o[0].rechtsvorm.id) };
  });
  await stap('persistent', 'na opnieuw inloggen staat de afgevinkte oprichtingsstap er nog, en het saldo in de opslag', async () => {
    const tok = (await w.post('/api/auth/login', { login: L.email, password: L.wachtwoord })).data.token;
    const op = await w.post(OPRICHTING, { id }, tok);
    /* Het saldo heeft zonder zaak nog geen leesroute (de kas rekent pas met
       een zaak); daarom de opslag zelf. */
    const rij = (w.collectie('ondernemingen') || []).find((x) => x.id === id) || {};
    return { klopt: op.status === 200 && op.data.gedaan === 1 && JSON.stringify(rij).includes('2500'),
      ziet: 'gedaan ' + (op.data && op.data.gedaan) + ', saldo in de opslag ' + JSON.stringify(rij).includes('2500') };
  });
  await stap('persistent', 'een read-only lezer vindt de onderneming in de opslag', async () => {
    const plek = w.vindInOpslag(hoofd);
    return { klopt: plek.length >= 1, ziet: plek.map((p) => p.bestand + '/' + p.tabel + (p.sleutel ? ':' + p.sleutel : '')).join(', ') || 'nergens' };
  });

  /* ---------------- herstelbaar ---------------- */
  await stap('herstelbaar', 'een dubbele tik op "Begin een onderneming" maakt er een', async () => {
    const naam = 'Dubbel ' + merk;
    const [a, b] = await w.dubbel(NIEUW, { naam, idem: 'dub-' + merk }, L.token);
    const n = (await metNaam(naam)).length;
    return { klopt: a.status === 200 && b.status === 200 && n === 1, ziet: 'tikken ' + a.status + '/' + b.status + ', aantal ' + n };
  });
  await stap('herstelbaar', 'een afgebroken "Begin", daarna opnieuw met dezelfde sleutel: een onderneming', async () => {
    const naam = 'Half ' + merk;
    const half = await w.afgebroken(NIEUW, { naam, idem: 'half-' + merk }, L.token);
    const opnieuw = await w.post(NIEUW, { naam, idem: 'half-' + merk }, L.token);
    const n = (await metNaam(naam)).length;
    return { klopt: opnieuw.status === 200 && n === 1,
      ziet: 'afgebroken (' + (half.afgebroken ? 'client gaf op' : 'status ' + half.status) + '), opnieuw ' + opnieuw.status + ', aantal ' + n };
  });
  await stap('herstelbaar', 'een crash direct na het aanmaken: na de herstart is er een, en de herhaling hoort dat', async () => {
    const naam = 'Stroom ' + merk;
    const r = await w.post(NIEUW, { naam, idem: 'crash-' + merk }, L.token);
    await w.crash();
    const opnieuw = await w.post(NIEUW, { naam, idem: 'crash-' + merk }, L.token);
    const n = await metNaam(naam);
    return { klopt: r.status === 200 && opnieuw.status === 200 && opnieuw.data.herhaald === true && n.length === 1 && n[0].id === r.data.onderneming.id,
      ziet: 'na SIGKILL ' + opnieuw.status + ' herhaald=' + (opnieuw.data && opnieuw.data.herhaald) + ', aantal ' + n.length };
  });
  await stap('herstelbaar', 'een dubbele tik op een oprichtingsstap laat hem een keer afgevinkt', async () => {
    const voor = await w.post(OPRICHTING, { id }, L.token);
    const tweede = voor.data.stappen.find((s) => !s.klaar);
    const [a, b] = await w.dubbel(OPRICHTING_ZET, { id, stap: tweede.id, klaar: true }, L.token);
    const na = await w.post(OPRICHTING, { id }, L.token);
    return { klopt: a.status === 200 && b.status === 200 && na.data.gedaan === voor.data.gedaan + 1,
      ziet: 'tikken ' + a.status + '/' + b.status + ', gedaan ' + voor.data.gedaan + ' -> ' + na.data.gedaan };
  });
}

module.exports = {
  functie: 'link:onderneming',
  ingang: '/apps/onderneming.html',
  persona: 'ondernemer',
  belofte: 'een ondernemer begint met een werktitel, kiest een rechtsvorm, werkt de oprichting af, rekent zijn idee door en schrijft zich in; dat staat na een herstart en een crash precies een keer op zijn naam, en een ander lid komt er niet aan',
  grens: 'De proef loopt de routes van het scherm, niet het scherm zelf. Alleen de fase voor de zaak: de aanvraag bij RTG, het koppelen aan een bestaande zaak en de werkruimte zijn niet beproefd. Het KvK-nummer wordt niet bij de KvK nagegaan (dat doet RTG ook niet). Geen Redis of PostgreSQL.',
  loop
};
