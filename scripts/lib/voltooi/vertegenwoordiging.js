/* ============================================================================
   VOLTOOIPROEF: HET TEAM OM MIJ HEEN (link:vertegenwoordiging,
   /apps/vertegenwoordiging.html).

   De belofte van het scherm: een lid bepaalt zelf wie namens hem mag handelen
   en waarin. Hij zet een eigen grens, ziet vooraf wat een voorstel werkelijk
   zou mogen (de simulatie), aanvaardt, leest in zijn spoor wat er namens hem
   gebeurde, en trekt per direct in. Niemand anders kan dat voor hem doen.

   De client is een lid wiens identiteit RTG zag (A3, met de geboortedatum van
   het document): de 18+-poort van dit domein eist dat, en terecht. De
   vertegenwoordiger is een vers lid; zijn voorstel en zijn handeling lopen
   over /voorstel en /handel, de twee deuren van de andere kant.
   ========================================================================== */
'use strict';
const { nieuwLid, geverifieerdLid, KANTOORWERELD } = require('../voltooiwereld');

const LIJST = '/api/vertegenwoordiging/bevoegdheden';
const MIJN = '/api/vertegenwoordiging/mijn';
const GRENS = '/api/vertegenwoordiging/grens';
const SIMULATIE = '/api/vertegenwoordiging/simulatie';
const AANVAARD = '/api/vertegenwoordiging/aanvaard';
const INTREK = '/api/vertegenwoordiging/intrek';
const VOORSTEL = '/api/vertegenwoordiging/voorstel';
const HANDEL = '/api/vertegenwoordiging/handel';

const MAG = 'aanbod.ontvangen', OOK = 'agenda.voorbereiden', NOOIT = 'contract.opstellen';
const tot = () => new Date(Date.now() + 90 * 86400000).toISOString();

async function loop(w, stap) {
  const C = await geverifieerdLid(w, 'vtgc');
  const V = await nieuwLid(w, 'vtgv');
  const codenaam = ((await w.post('/api/member/connections', {}, C.token)).data || {}).codename;
  const mijn = async (tok) => ((await w.post(MIJN, {}, tok || C.token)).data) || {};
  const voorstel = () => w.post(VOORSTEL, { client: codenaam, hoedanigheid: 'zaakwaarnemer', bevoegdheden: [MAG, OOK, NOOIT], tot: tot() }, V.token);
  let id = null;

  /* ---------------- voltooibaar ---------------- */
  await stap('voltooibaar', 'het lid opent zijn team: de gesloten lijst met wat NOOIT kan, en een leeg team', async () => {
    const l = await w.post(LIJST, {}, C.token);
    const m = await mijn();
    return { klopt: l.status === 200 && l.data.bevoegdheden.some((b) => b.sleutel === MAG) && l.data.nooit.length >= 5 &&
      Array.isArray(m.team) && m.team.length === 0 && m.volwassen === true,
      ziet: 'lijst ' + l.status + ' (' + (l.data && l.data.bevoegdheden.length) + ' bevoegdheden), team ' + (m.team && m.team.length) + ', volwassen ' + m.volwassen };
  });

  await stap('voltooibaar', 'hij zet zijn eigen grens: contracten opstellen geeft hij aan niemand', async () => {
    const r = await w.post(GRENS, { bevoegdheden: [NOOIT] }, C.token);
    const m = await mijn();
    return { klopt: r.status === 200 && m.grens.includes(NOOIT), ziet: 'grens ' + r.status + ': ' + (m.grens || []).join(',') };
  });

  await stap('voltooibaar', 'een vertegenwoordiger stelt een machtiging voor; de simulatie toont wat er door de grens afvalt', async () => {
    const v = await voorstel();
    id = v.data && v.data.machtiging && v.data.machtiging.id;
    const m = await mijn();
    const s = await w.post(SIMULATIE, { id }, C.token);
    const kan = ((s.data && s.data.kan) || []).map((b) => b.sleutel);
    const af = ((s.data && s.data.afgevallen) || []).map((b) => b.sleutel);
    return { klopt: v.status === 200 && m.team.some((x) => x.id === id && x.stand === 'voorgesteld') && s.status === 200 &&
      kan.includes(MAG) && !kan.includes(NOOIT) && af.includes(NOOIT),
      ziet: 'voorstel ' + v.status + ', simulatie ' + s.status + ': kan ' + kan.join(',') + '; valt af ' + af.join(',') };
  });

  await stap('voltooibaar', 'hij aanvaardt; de vertegenwoordiger handelt binnen en buiten de machtiging, en beide staan in zijn spoor', async () => {
    const a = await w.post(AANVAARD, { id }, C.token);
    const binnen = await w.post(HANDEL, { id, bevoegdheid: MAG, wat: 'Aanbod van een zaal' }, V.token);
    const buiten = await w.post(HANDEL, { id, bevoegdheid: NOOIT, wat: 'Contract opstellen' }, V.token);
    const m = await mijn();
    const machtiging = m.team.find((x) => x.id === id);
    const log = (m.log || []).filter((r) => r.soort === 'handeling');
    return { klopt: a.status === 200 && machtiging.stand === 'actief' && !machtiging.bevoegdheden.some((b) => b.sleutel === NOOIT) &&
      binnen.status === 200 && buiten.status === 403 && log.some((r) => r.gelukt === true && r.bevoegdheid === MAG) &&
      log.some((r) => r.gelukt === false && r.bevoegdheid === NOOIT),
      ziet: 'aanvaard ' + a.status + ', binnen ' + binnen.status + ', buiten ' + buiten.status + ', spoor ' + log.length + ' handelingen' };
  });

  await stap('bevoegd', 'een derde lid simuleert, aanvaardt of trekt deze machtiging niet in, en ziet haar niet', async () => {
    const D = await nieuwLid(w, 'vtgd');
    const s = await w.post(SIMULATIE, { id }, D.token);
    const i = await w.post(INTREK, { id }, D.token);
    const h = await w.post(HANDEL, { id, bevoegdheid: MAG }, D.token);
    const d = await mijn(D.token);
    const m = await mijn();
    return { klopt: s.status === 404 && i.status === 404 && h.status === 404 && d.team.length === 0 && d.ikSta.length === 0 &&
      m.team.find((x) => x.id === id).stand === 'actief',
      ziet: 'simulatie ' + s.status + ', intrekken ' + i.status + ', handelen ' + h.status + '; machtiging blijft ' + m.team.find((x) => x.id === id).stand };
  });

  await stap('voltooibaar', 'hij trekt per direct in; daarna wordt een handeling geweigerd', async () => {
    const i = await w.post(INTREK, { id, reden: 'Klus afgerond' }, C.token);
    const h = await w.post(HANDEL, { id, bevoegdheid: MAG }, V.token);
    const m = await mijn();
    return { klopt: i.status === 200 && m.team.find((x) => x.id === id).stand === 'ingetrokken' && h.status === 403,
      ziet: 'intrekken ' + i.status + ', stand ' + m.team.find((x) => x.id === id).stand + ', handelen daarna ' + h.status };
  });

  await stap('voltooibaar', 'zonder sessie leest of schrijft niemand iets: beide geven 401 met een melding', async () => {
    const l = await w.post(MIJN, {});
    const s = await w.post(GRENS, { bevoegdheden: [] });
    return { klopt: l.status === 401 && s.status === 401 && !!(l.data && l.data.error) && !!(s.data && s.data.error),
      ziet: 'lezen ' + l.status + ', schrijven ' + s.status };
  });

  /* ---------------- persistent ---------------- */
  await w.herstart();
  await stap('persistent', 'na een nette herstart staan grens, ingetrokken machtiging en spoor er nog', async () => {
    const m = await mijn();
    const x = m.team.find((q) => q.id === id);
    return { klopt: m.grens.includes(NOOIT) && !!x && x.stand === 'ingetrokken' && m.log.filter((r) => r.soort === 'handeling').length === 3,
      ziet: 'grens ' + m.grens.join(',') + ', machtiging ' + (x && x.stand) + ', ' + m.log.length + ' spoorregels' };
  });
  await stap('persistent', 'de vertegenwoordiger logt opnieuw in en ziet bij "ik sta voor" dezelfde ingetrokken machtiging', async () => {
    const tok = (await w.post('/api/auth/login', { login: V.email, password: V.wachtwoord })).data.token;
    const m = await mijn(tok);
    const x = (m.ikSta || []).find((q) => q.id === id);
    return { klopt: !!x && x.stand === 'ingetrokken', ziet: 'ik sta voor: ' + (x ? x.stand : 'WEG') };
  });
  await stap('persistent', 'een read-only lezer vindt de machtiging en het spoor in de opslag', async () => {
    const plek = w.vindInOpslag(id);
    return { klopt: plek.length >= 1, ziet: plek.map((p) => p.bestand + '/' + p.tabel + (p.sleutel ? ':' + p.sleutel : '')).join(', ') || 'nergens' };
  });

  /* ---------------- herstelbaar ---------------- */
  let tweede = null;
  await stap('herstelbaar', 'een dubbele tik op "Aanvaarden" aanvaardt een keer en schrijft een spoorregel', async () => {
    const v = await voorstel();
    tweede = v.data.machtiging.id;
    const [a, b] = await w.dubbel(AANVAARD, { id: tweede }, C.token);
    const m = await mijn();
    const regels = m.log.filter((r) => r.soort === 'aanvaard' && r.machtigingId === tweede).length;
    return { klopt: [a, b].some((x) => x.status === 200) && [a, b].every((x) => x.status === 200 || x.status === 409) && regels === 1 &&
      m.team.find((x) => x.id === tweede).stand === 'actief',
      ziet: 'tikken ' + a.status + '/' + b.status + ', ' + regels + ' aanvaard-regel' };
  });
  await stap('herstelbaar', 'een afgebroken "grens bewaren", daarna opnieuw: de grens staat er een keer', async () => {
    const lijf = { bevoegdheden: [NOOIT, OOK] };
    const half = await w.afgebroken(GRENS, lijf, C.token);
    const opnieuw = await w.post(GRENS, lijf, C.token);
    const m = await mijn();
    const x = m.team.find((q) => q.id === tweede);
    return { klopt: opnieuw.status === 200 && m.grens.join(',') === [NOOIT, OOK].sort().join(',') && !x.bevoegdheden.some((b) => b.sleutel === OOK),
      ziet: 'afgebroken (' + (half.afgebroken ? 'client gaf op' : 'status ' + half.status) + '), grens ' + m.grens.join(',') +
        ', lopende machtiging versmald tot ' + x.bevoegdheden.map((b) => b.sleutel).join(',') };
  });
  await stap('herstelbaar', 'een crash direct na intrekken: na de herstart blijft hij ingetrokken, en opnieuw intrekken zegt dat', async () => {
    const i = await w.post(INTREK, { id: tweede }, C.token);
    await w.crash();
    const opnieuw = await w.post(INTREK, { id: tweede }, C.token);
    const h = await w.post(HANDEL, { id: tweede, bevoegdheid: MAG }, V.token);
    const m = await mijn();
    return { klopt: i.status === 200 && opnieuw.status === 409 && /al ingetrokken/.test(opnieuw.data.error) && h.status === 403 &&
      m.team.find((x) => x.id === tweede).stand === 'ingetrokken' && m.log.filter((r) => r.soort === 'ingetrokken' && r.machtigingId === tweede).length === 1,
      ziet: 'na SIGKILL: opnieuw ' + opnieuw.status + ', handelen ' + h.status + ', stand ' + m.team.find((x) => x.id === tweede).stand };
  });
}

module.exports = {
  functie: 'link:vertegenwoordiging',
  ingang: '/apps/vertegenwoordiging.html',
  persona: 'lid',
  omgeving: KANTOORWERELD,
  belofte: 'een lid bepaalt zelf wie namens hem mag handelen: eigen grens, simulatie vooraf, aanvaarden, spoor en intrekken per direct; dat staat na een herstart en een crash, en een derde komt er niet aan',
  grens: 'De proef loopt de routes van het scherm, niet het scherm zelf; het voorstel en de handeling lopen over de routes van de vertegenwoordiger. De client is door een kantoormedewerker op naam geverifieerd (A3). Het jeugdbestuur (voogd) en plafonds op bedragen zijn niet beproefd. Geen Redis of PostgreSQL.',
  loop
};
