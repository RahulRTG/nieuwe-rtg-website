/* ============================================================================
   VOLTOOIPROEF: VANDAAG (link:vandaag, /apps/life.html).

   De belofte, in de woorden van kern/life.js en de lagen eronder: het ene
   scherm van de dag, uit lagen die het lid al had. Een gewoonte afvinken is een
   tik die hem aanzet en dezelfde tik die hem weer uitzet (geen "toch niet"-
   knop); een meting is een getal per dag met zijn herkomst; de dagcheck-in
   bewaart hoe het lid erbij zit en geeft geen tip als de grens aanslaat; en de
   noodkaart toont het lid ZELF -- er is geen route waarmee een ander hem
   opvraagt. Niets hiervan telt een reeks die omhoog moet.

   DE ONTVANGER is het lid zelf op een ander toestel (een nieuwe sessie): dit
   zijn dagboeken die het account niet verlaten, en dat is het ontwerp.
   ========================================================================== */
'use strict';
const { nieuwLid, inloggen } = require('../voltooiwereld');

const LIFE = '/api/life';
const GEWOONTEN = '/api/gewoonten';
const MAAK = '/api/gewoonten/maak';
const TIK = '/api/gewoonten/tik';
const REEKS = '/api/gewoonten/reeks';
const STOP = '/api/gewoonten/stop';
const METINGEN = '/api/metingen';
const METING_ZET = '/api/metingen/zet';
const METING_WEG = '/api/metingen/weg';
const GEMOED = '/api/gemoed';
const GEMOED_ZET = '/api/gemoed/zet';
const GEMOED_WEG = '/api/gemoed/weg';
const NOODKAART = '/api/noodkaart';
const NOOD_ZET = '/api/noodkaart/zet';
const NOOD_WEG = '/api/noodkaart/weg';

const geen5xx = (r) => r && r.status > 0 && r.status < 500;
const vandaag = () => new Date().toISOString().slice(0, 10);
const morgen = () => new Date(Date.now() + 86400000).toISOString().slice(0, 10);

async function loop(w, stap) {
  const merk = 'vd' + Date.now().toString(36);
  const lid = await nieuwLid(w, 'vdg');
  const T = lid.token;
  const gewoonten = async (tok) => ((((await w.post(GEWOONTEN, {}, tok || T)).data) || {}).gewoonten || []);
  const mijne = async (tok) => (await gewoonten(tok)).filter((g) => String(g.naam).includes(merk));
  const slaap = async (tok) => (((((await w.post(METINGEN, {}, tok || T)).data) || {}).beeld || {}).slaap || {});
  const kaart = async (tok) => ((await w.post(NOODKAART, {}, tok || T)).data) || {};
  let wandelen = null;

  await stap('voltooibaar', 'het lid zet een gewoonte neer; zonder naam wordt hij geweigerd met de vraag erbij', async () => {
    const leeg = await w.post(MAAK, { naam: '' }, T);
    const r = await w.post(MAAK, { naam: 'Wandelen ' + merk, waarom: 'frisse lucht' }, T);
    wandelen = r.data && r.data.gewoonte;
    return { klopt: leeg.status === 400 && /vaker doen/.test(leeg.data.error) && r.status === 200 && !!wandelen && !!wandelen.id && wandelen.vandaagGedaan === false,
      ziet: 'leeg: ' + leeg.status + ' (' + (leeg.data && leeg.data.error) + '); maken ' + r.status };
  });

  await stap('voltooibaar', 'een tik vinkt vandaag af, een dag die nog moet komen wordt geweigerd, en dezelfde tik zet hem weer uit', async () => {
    const aan = await w.post(TIK, { id: wandelen.id, op: vandaag() }, T);
    const later = await w.post(TIK, { id: wandelen.id, op: morgen() }, T);
    const uit = await w.post(TIK, { id: wandelen.id, op: vandaag() }, T);
    const dagenAan = (aan.data && aan.data.gewoonte && aan.data.gewoonte.dagen) || [];
    const dagenUit = (uit.data && uit.data.gewoonte && uit.data.gewoonte.dagen) || [];
    const weer = await w.post(TIK, { id: wandelen.id, op: vandaag() }, T);
    return { klopt: aan.status === 200 && dagenAan.includes(vandaag()) && later.status === 400 && uit.status === 200 && !dagenUit.includes(vandaag()) && weer.status === 200,
      ziet: 'aan: ' + dagenAan.length + ' dag(en); morgen: ' + later.status + ' (' + (later.data && later.data.error) + '); uit: ' + dagenUit.length + ' dag(en)' };
  });

  await stap('voltooibaar', 'een meting: 7,5 uur slaap staat als vandaag met de herkomst "zelf"; meer dan een nacht lang wordt geweigerd', async () => {
    const r = await w.post(METING_ZET, { onderwerp: 'slaap', waarde: 7.5 }, T);
    const teveel = await w.post(METING_ZET, { onderwerp: 'slaap', waarde: 30 }, T);
    const onbekend = await w.post(METING_ZET, { onderwerp: 'bloeddruk', waarde: 1 }, T);
    const b = (r.data && r.data.beeld) || {};
    return { klopt: r.status === 200 && b.vandaag === 7.5 && (b.herkomsten || []).includes('zelf') && teveel.status === 400 && onbekend.status === 404,
      ziet: 'vandaag ' + b.vandaag + ' ' + b.eenheid + ' via ' + (b.herkomsten || []).join(',') + '; te veel: ' + teveel.status + ', onbekend: ' + onbekend.status };
  });

  await stap('voltooibaar', 'de dagcheck-in: een stemming die niet bestaat wordt geweigerd, "goed" staat daarna als vandaag ingevuld', async () => {
    const fout = await w.post(GEMOED_ZET, { stemming: 'fantastisch' }, T);
    const r = await w.post(GEMOED_ZET, { stemming: 'goed', notitie: 'rustige dag ' + merk }, T);
    const g = ((await w.post(GEMOED, {}, T)).data) || {};
    return { klopt: fout.status === 400 && r.status === 200 && r.data.mag === true && g.vandaagIngevuld && g.vandaagIngevuld.stemming === 'goed',
      ziet: 'fout: ' + fout.status + ' (' + (fout.data && fout.data.error) + '); vandaag: ' + (g.vandaagIngevuld && g.vandaagIngevuld.stemming) };
  });

  await stap('voltooibaar', 'de noodkaart: het lid zet een contact en wat er nodig is, en de kaart staat aan -- met de uitleg dat hij hem zelf toont', async () => {
    const r = await w.post(NOOD_ZET, { contactNaam: 'Zus ' + merk, contactTel: '0612345678', watNodig: 'Insuline in de koelkast', aan: true }, T);
    const k = r.data || {};
    return { klopt: r.status === 200 && k.bestaat === true && k.kaart.aan === true && k.kaart.contactNaam === 'Zus ' + merk && /zelf/.test(k.uitleg || ''),
      ziet: 'bestaat ' + k.bestaat + ', aan ' + (k.kaart && k.kaart.aan) + ', contact ' + (k.kaart && k.kaart.contactNaam) };
  });

  await stap('voltooibaar', 'het ene scherm van de dag laadt met de lagen erin', async () => {
    const r = await w.post(LIFE, {}, T);
    return { klopt: r.status === 200 && !!r.data && typeof r.data === 'object', ziet: 'life ' + r.status + ' (' + Object.keys(r.data || {}).slice(0, 6).join(',') + ')' };
  });

  /* ---------------- persistent ---------------- */
  const voorG = JSON.stringify(await mijne());
  const voorS = JSON.stringify(await slaap());
  const voorK = JSON.stringify((await kaart()).kaart);
  await w.herstart();
  await stap('persistent', 'na een nette herstart staan de gewoonte met zijn afvinkdag, de meting en de noodkaart er nog, gelijk', async () => {
    const g = JSON.stringify(await mijne()), s = JSON.stringify(await slaap()), k = JSON.stringify((await kaart()).kaart);
    return { klopt: g === voorG && s === voorS && k === voorK && JSON.parse(g).length === 1 && JSON.parse(g)[0].dagen.length === 1,
      ziet: 'gewoonte ' + (g === voorG ? 'gelijk' : 'ANDERS') + ', meting ' + (s === voorS ? 'gelijk' : 'ANDERS') + ', noodkaart ' + (k === voorK ? 'gelijk' : 'ANDERS') };
  });
  await stap('persistent', 'een nieuwe sessie (een ander toestel) leest hetzelfde', async () => {
    const C = await inloggen(w, lid);
    const g = await mijne(C), s = await slaap(C), k = (await kaart(C)).kaart;
    return { klopt: g.length === 1 && g[0].dagen.includes(vandaag()) && s.vandaag === 7.5 && k.contactNaam === 'Zus ' + merk,
      ziet: g.length + ' gewoonte, slaap ' + s.vandaag + ', contact ' + k.contactNaam };
  });
  await stap('persistent', 'de gewoonte, de check-in en de noodkaart staan in de opslag zelf (gelezen buiten de server om)', async () => {
    const g = w.vindInOpslag('Wandelen ' + merk), n = w.vindInOpslag('rustige dag ' + merk), k = w.vindInOpslag('Zus ' + merk);
    return { klopt: g.length >= 1 && n.length >= 1 && k.length >= 1,
      ziet: 'gewoonte in ' + g.map((p) => p.sleutel || p.tabel).join(',') + '; check-in in ' + n.map((p) => p.sleutel || p.tabel).join(',') + '; noodkaart in ' + k.map((p) => p.sleutel || p.tabel).join(',') };
  });

  /* ---------------- herstelbaar ---------------- */
  await stap('herstelbaar', 'dubbeltik op "gewoonte toevoegen": een gewoonte, niet twee', async () => {
    const lijf = { naam: 'Lezen ' + merk, waarom: '' };
    const [a, b] = await w.dubbel(MAAK, lijf, T);
    const n = (await gewoonten()).filter((g) => g.naam === lijf.naam).length;
    return { klopt: a.status === 200 && geen5xx(b) && n === 1, ziet: 'antwoorden ' + a.status + '/' + b.status + ', ' + n + ' gewoonte(n)' };
  });
  await stap('herstelbaar', 'een afgebroken verzoek en daarna opnieuw: precies een gewoonte', async () => {
    const lijf = { naam: 'Water ' + merk, waarom: '' };
    const half = await w.afgebroken(MAAK, lijf, T);
    const opnieuw = await w.post(MAAK, lijf, T);
    const n = (await gewoonten()).filter((g) => g.naam === lijf.naam).length;
    return { klopt: opnieuw.status === 200 && n === 1, ziet: 'afgebroken (' + (half.afgebroken ? 'client gaf op' : 'status ' + half.status) + '), opnieuw ' + opnieuw.status + ', ' + n + ' gewoonte(n)' };
  });
  await stap('herstelbaar', 'een crash direct na een meting: het getal staat er na de herstart', async () => {
    const r = await w.post(METING_ZET, { onderwerp: 'water', waarde: 6 }, T);
    await w.crash();
    const b = (((((await w.post(METINGEN, {}, T)).data) || {}).beeld || {}).water) || {};
    return { klopt: r.status === 200 && b.vandaag === 6, ziet: 'meting ' + r.status + ', na SIGKILL vandaag ' + b.vandaag };
  });
  await stap('herstelbaar', 'een crash direct na het weghalen van de noodkaart en het stoppen van de gewoonte: weg blijft weg -- ook op schijf', async () => {
    const a = await w.post(NOOD_WEG, {}, T);
    const s = await w.post(STOP, { id: wandelen.id }, T);
    await w.crash();
    const k = await kaart();
    const g = (await gewoonten()).find((x) => x.id === wandelen.id);
    const tweede = await w.post(NOOD_WEG, {}, T);
    return { klopt: a.status === 200 && s.status === 200 && k.bestaat === false && !g && tweede.status === 404 && w.vindInOpslag('Zus ' + merk).length === 0,
      ziet: 'weghalen ' + a.status + ', stoppen ' + s.status + ', na SIGKILL bestaat ' + k.bestaat + ', gewoonte ' + (g ? 'STAAT ER NOG' : 'weg') + ', nog eens weghalen ' + tweede.status };
  });
  await stap('herstelbaar', 'de meting en de check-in van vandaag weghalen, en nog eens: de tweede keer zegt eerlijk dat er niets staat', async () => {
    const m = await w.post(METING_WEG, { onderwerp: 'slaap', op: vandaag() }, T);
    const m2 = await w.post(METING_WEG, { onderwerp: 'slaap', op: vandaag() }, T);
    const c = await w.post(GEMOED_WEG, { op: vandaag() }, T);
    const c2 = await w.post(GEMOED_WEG, { op: vandaag() }, T);
    return { klopt: m.status === 200 && m2.status === 404 && c.status === 200 && c2.status === 404 && (await slaap()).vandaag === null,
      ziet: 'meting ' + m.status + '/' + m2.status + ', check-in ' + c.status + '/' + c2.status };
  });
  await stap('herstelbaar', 'de reeksteller aan en uit zetten gooit geen afvinkdag weg', async () => {
    const lezen = (await gewoonten()).find((g) => g.naam === 'Lezen ' + merk);
    await w.post(TIK, { id: lezen.id, op: vandaag() }, T);
    const aan = await w.post(REEKS, { id: lezen.id, aan: true }, T);
    const uit = await w.post(REEKS, { id: lezen.id, aan: false }, T);
    const na = (await gewoonten()).find((g) => g.id === lezen.id);
    return { klopt: aan.status === 200 && uit.status === 200 && !!na && (na.dagen || []).includes(vandaag()) && na.reeksAan === false,
      ziet: 'reeks aan ' + aan.status + ', uit ' + uit.status + ', dagen ' + (na && na.dagen ? na.dagen.length : 0) };
  });
}

module.exports = {
  functie: 'link:vandaag',
  ingang: '/apps/life.html',
  persona: 'lid',
  belofte: 'een lid houdt zijn dag bij op een scherm: een gewoonte afvinken (en weer uitzetten), een meting met herkomst, een dagcheck-in zonder tip als de grens aanslaat, en een noodkaart die alleen hij zelf toont',
  grens: 'De proef loopt over de routes die het scherm aanroept, niet door het scherm zelf. De medicatie, de toestellen en de veiligheidskring die het scherm meeleest, hebben hier geen schakel (de kring staat in het scenario van RTG Veilig). De grens van de dagcheck-in (een notitie die om hulp vraagt) is niet uitgelokt; de dagcoach (/api/dag) is een modelvraag en is niet gelopen. Er is geen Redis of PostgreSQL in de wereld.',
  loop
};
