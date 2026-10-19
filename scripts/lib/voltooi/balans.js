/* ============================================================================
   VOLTOOIPROEF: BALANS (link:balans, /apps/geld.html#balans).

   De belofte van de stand (apps/geld/balansb.js): "Uw werk-privebalans, geen
   boekhouding: het weekbeeld en de adviezen van Rahul. Rust hoort erbij." De
   kern zegt erbij wat er NIET gebeurt (kern/balans.js): "het beeld komt uit
   wat er al is (de agenda, het grootboek); er wordt niets nieuws over het lid
   vastgelegd." De stand roept een route aan, /api/balans, letterlijk.

   DE AGENDA IS DE BRON, en die vult de proef langs de agendaroutes
   (/api/agenda/toevoegen, /wijzig): de weg waarlangs het lid of Rahul (op
   verzoek, kop van routes/balans.js) een afspraak zet. Dat is de voorbereiding;
   de bewering gaat over wat /api/balans ervan maakt. Persistent en herstelbaar
   meten daarom twee dingen: het beeld blijft gelijk zolang de agenda gelijk
   blijft, en de stand zelf schrijft nooit iets weg -- ook niet bij een dubbele
   tik, een afgebroken verzoek of een crash.

   De recepten "op dit toestel" (Toestelkluis) gaan niet over de lijn en zijn
   hier dus niet te meten; dat is bewijs 2 (het scherm), niet deze proef.
   ========================================================================== */
'use strict';
const { nieuwLid, inloggen } = require('../voltooiwereld');

const BALANS = '/api/balans';
const AGENDA_ZET = '/api/agenda/toevoegen';
const AGENDA_WIJZIG = '/api/agenda/wijzig';
const DAG = 86400000;
/* Dezelfde dagen als kern/balans.js (weekBeeld): vandaag en de zes erna, in UTC. */
const dag = (i) => new Date(Date.now() + i * DAG).toISOString().slice(0, 10);

async function loop(w, stap) {
  const merk = 'bl' + Date.now().toString(36);
  const A = await nieuwLid(w, 'bla');
  const B = await nieuwLid(w, 'blb');
  const balans = async (tok) => w.post(BALANS, {}, tok || A.token);
  const beeld = async (tok) => (((await balans(tok)).data) || {}).beeld || {};
  /* Wat de stand in de opslag zou kunnen raken: alle kv-rijen behalve de
     sessies en toestellen, die elke ingelogde aanroep bijwerkt. */
  const stilte = () => JSON.stringify(w.opslag('store.db', "SELECT key, val FROM kv WHERE deleted = 0 AND key NOT LIKE '%essie%' AND key NOT LIKE '%sessions%' ORDER BY key"));
  let eerste = null;

  /* ---------------- voltooibaar ---------------- */
  await stap('voltooibaar', 'een lid met een lege agenda ziet zeven lege dagen en hoort dat de week ademt', async () => {
    const r = await balans();
    const b = r.data && r.data.beeld;
    const advies = (r.data && r.data.adviezen) || [];
    return { klopt: r.status === 200 && b.dagen.length === 7 && b.dagen[0] === dag(0) && b.vrijeDagen === 7 && /ademt/.test(advies[0].tekst) && advies.length <= 4,
      ziet: 'status ' + r.status + ', ' + (b && b.vrijeDagen) + ' vrije dagen, advies "' + (advies[0] && advies[0].tekst.slice(0, 50)) + '"' };
  });

  await stap('voltooibaar', 'met een afspraak op elke dag en vier avonden ziet het lid geen lege dag meer, en Rahul raadt een rustdag aan', async () => {
    for (let i = 0; i < 7; i++) {
      const r = await w.post(AGENDA_ZET, { titel: 'Afspraak ' + merk + ' ' + i, datum: dag(i), tijd: i < 4 ? '20:00' : '10:00' }, A.token);
      if (r.status !== 200) throw new Error('agenda toevoegen lukte niet (' + r.status + ')');
    }
    const r = await balans();
    const b = r.data.beeld, advies = r.data.adviezen.map((a) => a.tekst).join(' | ');
    return { klopt: b.vrijeDagen === 0 && b.perDag.every((n) => n === 1) && b.avonden === 4 &&
      /geen enkele lege dag/.test(advies) && /4 avonden/.test(advies),
      ziet: b.vrijeDagen + ' vrije dagen, ' + b.avonden + ' avonden; ' + advies.slice(0, 110) };
  });

  await stap('voltooibaar', 'een afgevinkte afspraak telt niet meer mee: die dag is weer vrij', async () => {
    const lijst = ((await w.post('/api/agenda/mijn-lijst', {}, A.token)).data || {}).items || [];
    const morgen = lijst.find((x) => x.datum === dag(1) && x.titel.startsWith('Afspraak ' + merk));
    const r = await w.post(AGENDA_WIJZIG, { id: morgen.id, gedaan: true }, A.token);
    eerste = (await balans()).data;
    const b = eerste.beeld;
    return { klopt: r.status === 200 && b.vrijeDagen === 1 && b.perDag[1] === 0, ziet: 'afvinken ' + r.status + ', ' + b.vrijeDagen + ' vrije dag, morgen ' + b.perDag[1] };
  });

  await stap('voltooibaar', 'het weekbeeld bekijken legt niets nieuws over het lid vast, zoals de kern belooft', async () => {
    const voor = stilte();
    for (let i = 0; i < 3; i++) await balans();
    const na = stilte();
    return { klopt: voor === na && !w.collectie('balans'), ziet: voor === na ? 'opslag onveranderd na drie keer kijken' : 'de opslag veranderde door alleen te kijken' };
  });

  await stap('voltooibaar', 'een ANDER lid ziet zijn eigen lege week en niets van de afspraken van dit lid; zonder inlog geen beeld', async () => {
    const r = await balans(B.token);
    const zonder = await w.post(BALANS, {}, null);
    const lijf = JSON.stringify(r.data || {});
    return { klopt: r.status === 200 && r.data.beeld.vrijeDagen === 7 && !lijf.includes(merk) && zonder.status === 401 && !!(zonder.data && zonder.data.error),
      ziet: 'B: ' + r.data.beeld.vrijeDagen + ' vrije dagen; zonder inlog ' + zonder.status + ' (' + (zonder.data && zonder.data.error) + ')' };
  });

  /* ---------------- persistent ---------------- */
  await w.herstart();
  await stap('persistent', 'na een nette herstart geeft de stand hetzelfde weekbeeld en dezelfde adviezen', async () => {
    const r = (await balans()).data || {};
    return { klopt: JSON.stringify(r.beeld) === JSON.stringify(eerste.beeld) && JSON.stringify(r.adviezen) === JSON.stringify(eerste.adviezen),
      ziet: (r.beeld && r.beeld.vrijeDagen) + ' vrije dag, ' + (r.beeld && r.beeld.avonden) + ' avonden' };
  });

  await stap('persistent', 'een read-only lezer vindt de bron van het beeld (de agenda) onder dit lid in de opslag, en geen balansrij', async () => {
    const plekken = w.vindInOpslag('Afspraak ' + merk).map((v) => v.sleutel || v.tabel);
    return { klopt: plekken.includes('agendas') && !w.collectie('balans'), ziet: 'afspraken in ' + [...new Set(plekken)].join(', ') };
  });

  await stap('persistent', 'na de herstart logt het lid opnieuw in en ziet in een nieuwe sessie dezelfde week', async () => {
    const tok = await inloggen(w, A);
    const b = await beeld(tok);
    return { klopt: b.vrijeDagen === 1 && b.perDag.join() === (await beeld()).perDag.join(), ziet: 'nieuwe sessie, ' + b.vrijeDagen + ' vrije dag' };
  });

  /* ---------------- herstelbaar ---------------- */
  await stap('herstelbaar', 'een dubbele tik op verversen geeft twee keer hetzelfde beeld en schrijft niets', async () => {
    const voor = stilte();
    const [a, b] = await w.dubbel(BALANS, {}, A.token);
    return { klopt: a.status === 200 && b.status === 200 && JSON.stringify(a.data.beeld) === JSON.stringify(b.data.beeld) && stilte() === voor,
      ziet: 'tikken ' + a.status + '/' + b.status + ', beelden gelijk: ' + (JSON.stringify(a.data.beeld) === JSON.stringify(b.data.beeld)) };
  });

  await stap('herstelbaar', 'een afgebroken verzoek laat niets half achter: het volgende beeld is gewoon hetzelfde', async () => {
    const voor = await beeld();
    const half = await w.afgebroken(BALANS, {}, A.token);
    const na = await beeld();
    return { klopt: JSON.stringify(voor) === JSON.stringify(na),
      ziet: 'afgebroken (' + (half.afgebroken ? 'client gaf op' : 'status ' + half.status) + '), daarna ' + na.vrijeDagen + ' vrije dag' };
  });

  await stap('herstelbaar', 'na een crash staat de week er nog precies zo: de bron is duurzaam en de stand rekent opnieuw', async () => {
    const voor = await beeld();
    await w.crash();
    const na = await beeld();
    return { klopt: JSON.stringify(voor) === JSON.stringify(na) && na.vrijeDagen === 1, ziet: 'na SIGKILL: ' + na.vrijeDagen + ' vrije dag, ' + na.avonden + ' avonden' };
  });
}

module.exports = {
  functie: 'link:balans',
  ingang: '/apps/geld.html#balans',
  persona: 'lid',
  belofte: 'een lid ziet zijn komende week uit zijn eigen agenda, met eerlijke adviezen over rust en avonden, zonder dat RTG er iets nieuws over hem vastlegt -- een ander lid ziet er niets van, en het beeld blijft gelijk na een herstart, een dubbele tik, een afgebroken verzoek en een crash',
  grens: 'De agenda wordt gevuld langs /api/agenda/*, niet door Rahul in een gesprek. Het eet- en uitgaanspatroon uit het grootboek, het zorgprofiel, de vraagknoppen naar de chat en de recepten in de Toestelkluis zijn hier niet beproefd; de proef loopt de route van de stand, niet de stand zelf. Het weekbeeld rekent in UTC-dagen: een run over middernacht UTC heen verschuift de week.',
  loop
};
