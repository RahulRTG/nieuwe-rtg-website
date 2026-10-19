/* ============================================================================
   VOLTOOIPROEF: HET SAMENWERKINGSPORTAAL (link:rtfportaal, /apps/foundation/os-portaal.html).

   De belofte van het scherm: een partnerstichting, een gemeente of een lokale
   ondernemer opent met de code die het RTF-kantoor uitgaf zijn eigen dossier:
   de stichting haar afspraken en projecten, de gemeente uitsluitend getelde
   cijfers (geen dossier, geen naam, geen hulpvraag), de ondernemer wat zijn
   aanbod deed. Elke code opent precies EEN dossier.

   DE WERELD. Het landelijke bestuur opent Zwolle, zet de modules voor gemeenten
   en ondernemers aan, en geeft drie codes uit langs het kantoor; een tweede
   stichting is de kruisproef. De persona van deze rij is het gezin: de ouder
   die voor de buurtstichting de code beheert, met zijn eigen account.

   ALLEEN LEZEN, EN DAT BEPAALT HERSTELBAAR: zie ./rtfbuurt.js.

   EEN OPEN SCHAKEL, EN HIER EEN BOTSING TUSSEN TWEE BESLUITEN. De kop van
   routes/rtfos/portalen.js zegt dat deze drie "geen RTG-account hebben en er
   ook geen horen te krijgen: ze zijn geen lid, ze werken samen". Het besluit
   van 19 oktober 2026 zegt dat gebruiken een account vraagt. Welke van de twee
   hier geldt, beslist de eigenaar; tot dan blijft de stap open.
   ========================================================================== */
'use strict';
const { eigenaarSessie } = require('../voltooiwereld');
const { GEZINSWERELD, accountGezin, openStad } = require('../voltooigezin');

const PARTNER = '/api/rtfos/portaal/partner';
const GEMEENTE = '/api/rtfos/portaal/gemeente';
const ONDERNEMER = '/api/rtfos/portaal/ondernemer';

async function loop(w, stap) {
  const merk = Date.now().toString(36);
  const stad = await openStad(w, 'Zwolle');
  const K = stad.kantoor;
  for (const vlag of ['municipal_reporting', 'business_sponsorships']) await w.post('/api/rtfos/stad/module', { id: stad.id, vlag, aan: true }, K);
  const p = ((await w.post('/api/rtfos/partner/maak', { stad: stad.id, naam: 'Stichting De Wilg ' + merk, doel: 'Buurtwerk in De Wilg' }, K)).data || {}).partner || {};
  const q = ((await w.post('/api/rtfos/partner/maak', { stad: stad.id, naam: 'Stichting Het Anker ' + merk, doel: 'Schuldhulp' }, K)).data || {}).partner || {};
  const g = ((await w.post('/api/rtfos/gemeente/maak', { stad: stad.id, naam: 'Gemeente Zwolle' }, K)).data || {}).gemeente || {};
  const o = ((await w.post('/api/rtfos/ondernemer/maak', { stad: stad.id, naam: 'Bakkerij Brood ' + merk, branche: 'bakkerij' }, K)).data || {}).ondernemer || {};
  const aanbod = await w.post('/api/rtfos/ondernemer/aanbod', { id: o.id, soort: 'producten', ritme: 'wekelijks', wat: 'Twintig broden voor de voedselbank', aantal: 20, waarde: 60 }, K);
  if (!p.code || !q.code || !g.code || !o.code || aanbod.status !== 200) throw new Error('de codes uitgeven lukte niet');
  const ouder = await accountGezin(w, 'portaal');
  const lees = (pad, code) => w.post(pad, { code }, ouder.token);
  const beeld = async () => JSON.stringify([(await lees(PARTNER, p.code)).data, (await lees(GEMEENTE, g.code)).data, (await lees(ONDERNEMER, o.code)).data]);
  let eerste = null;

  /* ---------------- voltooibaar ---------------- */
  await stap('voltooibaar', 'de stichting opent met haar code haar dossier: naam, stand, doel en de vijf afspraken over wie wat doet', async () => {
    const r = await lees(PARTNER, p.code);
    const d = (r.data && r.data.partner) || {};
    const a = d.afspraken || {};
    return { klopt: r.status === 200 && d.naam === p.naam && d.status === 'aangemeld' && ['geld', 'vrijwilligers', 'persoonsgegevens', 'aansprakelijk', 'rapportage'].every((k) => !!a[k]),
      ziet: r.status + ': ' + d.naam + ', ' + d.status + ', afspraken ' + Object.keys(a).join('/') };
  });

  await stap('voltooibaar', 'de gemeente opent met haar code alleen getelde cijfers, en "niet gemeten" staat er als niet gemeten en niet als nul', async () => {
    const r = await lees(GEMEENTE, g.code);
    const d = r.data || {};
    return { klopt: r.status === 200 && d.gemeente && d.gemeente.naam === 'Gemeente Zwolle' && d.bereik && d.bereik.gemeten === false && d.doelen && d.doelen.gemeten === false,
      ziet: r.status + ': bereik gemeten ' + (d.bereik && d.bereik.gemeten) + ', doelen gemeten ' + (d.doelen && d.doelen.gemeten) };
  });

  await stap('voltooibaar', 'de ondernemer opent met zijn code zijn aanbod en wat het deed, met de waarde als schatting', async () => {
    const r = await lees(ONDERNEMER, o.code);
    const d = r.data || {};
    const a = (d.aanbod || [])[0] || {};
    return { klopt: r.status === 200 && /Twintig broden/.test(a.wat || '') && a.ritme === 'wekelijks' && d.impact && d.impact.aanbiedingen === 1 && d.impact.benut === 0,
      ziet: r.status + ': ' + (d.aanbod || []).length + ' aanbod (' + a.wat + '), ' + (d.impact && d.impact.benut) + ' benut' };
  });

  await stap('voltooibaar', 'een code die niemand uitgaf opent niets, en zegt waar je een code vandaan haalt', async () => {
    const r = await lees(PARTNER, 'RTFP-BESTAATNIET');
    return { klopt: r.status === 404 && /kantoor/i.test((r.data && r.data.error) || ''), ziet: r.status + ' (' + (r.data && r.data.error) + ')' };
  });

  /* Bevoegdheid. */
  await stap('voltooibaar', 'bevoegdheid: zonder account opent het portaal niets (401)', async () => {
    const r = await w.post(PARTNER, { code: p.code });
    return { klopt: r.status === 401, ziet: 'met de code maar zonder account: ' + r.status + (r.status === 200 ? ' (de code is de enige sleutel: besluit van de eigenaar nodig)' : '') };
  });

  await stap('voltooibaar', 'bevoegdheid: elke code opent alleen zijn eigen dossier -- de tweede stichting ziet de eerste niet, en een gemeentecode is geen partnercode', async () => {
    const b = await lees(PARTNER, q.code);
    const t = JSON.stringify(b.data || {});
    const fout = await lees(PARTNER, g.code);
    const omgekeerd = await lees(GEMEENTE, p.code);
    return { klopt: b.status === 200 && t.includes('Het Anker') && !t.includes('De Wilg') && fout.status === 404 && omgekeerd.status === 404,
      ziet: 'tweede stichting ' + b.status + ' (ziet de eerste ' + t.includes('De Wilg') + '), gemeentecode bij partner ' + fout.status + ', partnercode bij gemeente ' + omgekeerd.status };
  });

  await stap('voltooibaar', 'bevoegdheid: het gemeenteportaal draagt geen naam, geen codenaam en geen dossier, en het partnerportaal geen IBAN of KvK', async () => {
    const gm = JSON.stringify((await lees(GEMEENTE, g.code)).data || {});
    const pa = JSON.stringify((await lees(PARTNER, p.code)).data || {});
    return { klopt: !/codenaam|dossier"|"naam":"[A-Z][a-z]+ [A-Z][a-z]+ [0-9A-F]{4}"/.test(gm) && !/iban|kvk|rsin|bestuurders/i.test(pa),
      ziet: 'gemeente ' + gm.length + ' tekens, partner ' + pa.length + ' tekens, zonder persoons- of bankvelden' };
  });

  /* ---------------- persistent ---------------- */
  eerste = await beeld();
  await w.herstart();
  await stap('persistent', 'na een nette herstart openen dezelfde drie codes precies hetzelfde', async () => {
    const na = await beeld();
    return { klopt: na === eerste, ziet: 'beeld ' + (na === eerste ? 'gelijk' : 'ANDERS') };
  });

  await stap('persistent', 'een read-only lezer vindt de drie dossiers in de opslag van RTF', async () => {
    const a = w.vindInOpslag('Stichting De Wilg ' + merk), b = w.vindInOpslag('Bakkerij Brood ' + merk), c = w.vindInOpslag(g.code);
    return { klopt: a.length > 0 && b.length > 0 && c.length > 0, ziet: 'stichting ' + a.length + ', ondernemer ' + b.length + ', gemeentecode ' + c.length + ' vindplaats(en)' };
  });

  await stap('persistent', 'wat het kantoor na de herstart aan het dossier verandert, ziet de stichting meteen', async () => {
    /* De kantoorsessie overleeft een herstart niet (de eigenaar logt opnieuw
       in); de dossiers wel, en daar gaat deze stap over. */
    const z = await w.post('/api/rtfos/partner/zet', { id: p.id, doel: 'Buurtwerk en huiswerkklas in De Wilg' }, await eigenaarSessie(w));
    const d = ((await lees(PARTNER, p.code)).data || {}).partner || {};
    return { klopt: z.status === 200 && /huiswerkklas/.test(d.doel || ''), ziet: 'zetten ' + z.status + ', doel nu "' + d.doel + '"' };
  });

  /* ---------------- herstelbaar ---------------- */
  eerste = await beeld();
  await stap('herstelbaar', 'een dubbele tik op Openen geeft twee keer hetzelfde dossier en schrijft niets', async () => {
    const voor = JSON.stringify(w.collectie('rtfos'));
    const [a, b] = await w.dubbel(ONDERNEMER, { code: o.code }, ouder.token);
    const na = JSON.stringify(w.collectie('rtfos'));
    return { klopt: a.status === 200 && b.status === 200 && JSON.stringify(a.data) === JSON.stringify(b.data) && voor === na,
      ziet: 'tikken ' + a.status + '/' + b.status + ', opslag ' + (voor === na ? 'onaangeroerd' : 'GERAAKT') };
  });

  await stap('herstelbaar', 'een afgebroken verzoek en daarna opnieuw: hetzelfde dossier', async () => {
    const half = await w.afgebroken(GEMEENTE, { code: g.code }, ouder.token);
    const na = await beeld();
    return { klopt: na === eerste, ziet: 'afgebroken (' + (half.afgebroken ? 'client gaf op' : 'status ' + half.status) + '), beeld ' + (na === eerste ? 'gelijk' : 'ANDERS') };
  });

  await stap('herstelbaar', 'na een crash openen de codes hetzelfde, met de wijziging van het kantoor erin', async () => {
    await w.crash();
    const na = await beeld();
    return { klopt: na === eerste && na.includes('huiswerkklas'), ziet: 'na SIGKILL beeld ' + (na === eerste ? 'gelijk' : 'ANDERS') };
  });
}

module.exports = {
  functie: 'link:rtfportaal',
  ingang: '/apps/foundation/os-portaal.html',
  persona: 'gezin',
  omgeving: GEZINSWERELD,
  belofte: 'een partnerstichting, gemeente of ondernemer opent met de code van het kantoor zijn eigen dossier -- de gemeente alleen getelde cijfers -- en elke code opent precies een dossier',
  grens: 'De proef loopt over de routes die het scherm aanroept, niet door het scherm zelf. Het scherm leest alleen; herstelbaar is hier dat niets schrijft. De codes geeft het landelijke bestuur langs het kantoor uit; een partner op actief (met overeenkomst in het dossier) en de genootschapsroutes lopen hier niet mee. Het portaal vraagt geen account; dat staat als open bevoegdheidsstap en vraagt een besluit. Er is geen Redis of PostgreSQL in de wereld.',
  loop
};
