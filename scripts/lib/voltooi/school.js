/* ============================================================================
   VOLTOOIPROEF: RTG SCHOOL (link:school, /apps/rtgschool.html).

   De belofte, in de woorden van kern/leerstof-vervolg.js: een examentraining
   van tien vragen, zoals bij een echt examen -- halverwege geen goed of fout,
   alleen de volgende vraag -- en pas aan het eind een terugblik met het juiste
   antwoord per vraag en een cijferINDICATIE die zichzelf een oefenuitslag
   noemt en geen echt cijfer. Een training hoort bij het lid en loopt door op
   een ander toestel; "leren is geen wedstrijd" (SCHOOL.md): er is geen
   ranglijst, alleen de eigen terugblik.

   DE ONTVANGER is het lid zelf op een ander toestel, midden in de training.
   ========================================================================== */
'use strict';
const { nieuwLid, inloggen } = require('../voltooiwereld');

const START = '/api/leerstof/examen';
const ANTWOORD = '/api/leerstof/examen-antwoord';
const ADVIES = '/api/onderwijs/advies';

const geen5xx = (r) => r && r.status > 0 && r.status < 500;

async function loop(w, stap) {
  const lid = await nieuwLid(w, 'sch');
  const T = lid.token;
  let eerste = null, totaal = 0;
  /* Zoals public/apps/rtgschool/examen.js: het antwoord noemt de vraag die het
     scherm toont. */
  let nr = null;
  const antwoord = async (tok, a) => {
    const r = await w.post(ANTWOORD, { antwoord: a, nr }, tok);
    if (r.status === 200 && r.data && r.data.nr) nr = r.data.nr;
    return r;
  };

  await stap('voltooibaar', 'een antwoord zonder training wordt geweigerd; een fase zonder examentraining ook; havo start met vraag 1', async () => {
    const zonder = await w.post(ANTWOORD, { antwoord: '42' }, T);
    const fout = await w.post(START, { fase: 'po-g1' }, T);
    const r = await w.post(START, { fase: 'havo' }, T);
    eerste = r.data;
    totaal = r.data && r.data.totaal;
    nr = r.data && r.data.nr;
    return { klopt: zonder.status === 400 && /Begin eerst/.test(zonder.data.error) && fout.status === 400 && r.status === 200 && r.data.nr === 1 && totaal >= 5 && !!r.data.vraag,
      ziet: 'zonder training ' + zonder.status + ', verkeerde fase ' + fout.status + '; start: vraag ' + (r.data && r.data.nr) + ' van ' + totaal };
  });

  await stap('voltooibaar', 'halverwege komt alleen de volgende vraag en geen goed of fout', async () => {
    const r = await antwoord(T, '1');
    return { klopt: r.status === 200 && r.data.nr === 2 && !!r.data.vraag && r.data.goed === undefined && r.data.klaar === undefined,
      ziet: 'vraag ' + (r.data && r.data.nr) + ', goed/fout meegestuurd: ' + (r.data && ('goed' in r.data) ? 'JA' : 'nee') };
  });

  await stap('voltooibaar', 'een antwoord op een vraag die al voorbij is telt niet, en zegt waar de leerling is', async () => {
    const r = await w.post(ANTWOORD, { antwoord: '1', nr: 1 }, T);
    return { klopt: r.status === 409 && /al beantwoord/.test(r.data.error) && /vraag 2/.test(r.data.error), ziet: r.status + ' (' + (r.data && r.data.error) + ')' };
  });

  await stap('voltooibaar', 'na de laatste vraag de terugblik: per vraag het eigen en het juiste antwoord, en een indicatie die zichzelf een oefenuitslag noemt', async () => {
    let r = null;
    for (let i = 2; i <= totaal; i++) r = await antwoord(T, '1');
    const t = r && r.data && r.data.terugblik;
    return { klopt: !!r && r.status === 200 && r.data.klaar === true && Array.isArray(t) && t.length === totaal && t.every((x) => 'juisteAntwoord' in x && 'jouwAntwoord' in x && typeof x.goed === 'boolean') && /oefenuitslag/.test(r.data.advies || '') && typeof r.data.cijferIndicatie === 'number',
      ziet: r && r.data ? r.data.goed + ' van ' + r.data.totaal + ' goed, indicatie ' + r.data.cijferIndicatie : 'geen uitslag' };
  });

  await stap('voltooibaar', 'daarna is de training voorbij: een volgend antwoord wordt weer geweigerd, en het niveau-advies laadt', async () => {
    const na = await w.post(ANTWOORD, { antwoord: '1' }, T);
    const a = await w.post(ADVIES, {}, T);
    return { klopt: na.status === 400 && a.status === 200 && !!a.data.advies, ziet: 'antwoord na afloop ' + na.status + ', advies ' + a.status };
  });

  /* ---------------- persistent ---------------- */
  const s = await w.post(START, { fase: 'vwo' }, T);
  nr = s.data && s.data.nr;
  await antwoord(T, 'a');
  const derde = await antwoord(T, 'b');
  await w.herstart();
  await stap('persistent', 'na een nette herstart loopt de training door bij dezelfde vraag', async () => {
    const r = await antwoord(T, 'c');
    return { klopt: s.status === 200 && derde.data && derde.data.nr === 3 && r.status === 200 && r.data.nr === 4, ziet: 'voor de herstart bij vraag ' + (derde.data && derde.data.nr) + ', erna antwoord gegeven en nu bij vraag ' + (r.data && r.data.nr) };
  });
  await stap('persistent', 'een nieuwe sessie (een ander toestel) zit in dezelfde training, bij dezelfde vraag', async () => {
    const C = await inloggen(w, lid);
    const r = await antwoord(C, 'd');
    return { klopt: r.status === 200 && r.data.nr === 5, ziet: 'ander toestel geeft antwoord en is nu bij vraag ' + (r.data && r.data.nr) };
  });
  await stap('persistent', 'de uitslag van de eerste training en de lopende tweede staan in de opslag zelf (gelezen buiten de server om)', async () => {
    /* Van de afgeronde havo-training blijft alleen de uitslag in de historie;
       de vwo-training loopt nog. */
    const havo = w.vindInOpslag('havo');
    const vwo = w.vindInOpslag('vwo');
    return { klopt: havo.length >= 1 && vwo.length >= 1, ziet: 'havo-uitslag in ' + havo.map((p) => p.sleutel || p.tabel).join(',') + '; lopende vwo in ' + vwo.map((p) => p.sleutel || p.tabel).join(',') };
  });

  /* ---------------- herstelbaar ---------------- */
  await stap('herstelbaar', 'dubbeltik op "antwoord": een vraag verder, niet twee, en de tweede tik hoort waar de leerling is', async () => {
    const voor = nr;
    const [a, b] = await w.dubbel(ANTWOORD, { antwoord: 'e', nr }, T);
    const goed = [a, b].filter((r) => r.status === 200);
    const ander = [a, b].find((r) => r.status !== 200);
    if (goed[0]) nr = goed[0].data.nr;
    const r = await antwoord(T, 'f');
    return { klopt: goed.length === 1 && !!ander && ander.status === 409 && r.status === 200 && r.data.nr === voor + 2,
      ziet: 'antwoorden ' + a.status + '/' + b.status + ' (' + (ander && ander.data && ander.data.error) + '), daarna van vraag ' + voor + ' naar ' + (r.data && r.data.nr) };
  });
  await stap('herstelbaar', 'een crash direct na een antwoord: de training staat na de herstart een vraag verder', async () => {
    const voor = nr;
    const r = await antwoord(T, 'g');
    await w.crash();
    const na = await antwoord(T, 'h');
    return { klopt: r.status === 200 && r.data.nr === voor + 1 && na.status === 200 && na.data.nr === voor + 2, ziet: 'voor SIGKILL van ' + voor + ' naar ' + (r.data && r.data.nr) + ', erna naar ' + (na.data && na.data.nr) };
  });
  await stap('herstelbaar', 'een crash direct na de laatste vraag: de uitslag is bewaard en de training is voorbij', async () => {
    let laatste = null;
    while (nr && nr <= totaal) { laatste = await antwoord(T, 'i'); if (laatste.status !== 200 || laatste.data.klaar) break; }
    await w.crash();
    const na = await w.post(ANTWOORD, { antwoord: 'j' }, T);
    const hist = w.vindInOpslag('vwo');
    return { klopt: !!laatste && laatste.status === 200 && laatste.data.klaar === true && na.status === 400 && hist.length >= 1, ziet: 'laatste ' + (laatste && laatste.status) + ' (klaar ' + (laatste && laatste.data && laatste.data.klaar) + '), na SIGKILL antwoord ' + na.status + ', uitslag op schijf: ' + (hist.length ? 'ja' : 'NEE') };
  });
}

module.exports = {
  functie: 'link:school',
  ingang: '/apps/rtgschool.html',
  persona: 'lid',
  belofte: 'een lid oefent een examen van tien vragen zoals bij een echt examen -- halverwege geen goed of fout -- en krijgt aan het eind een terugblik en een oefenindicatie die geen echt cijfer is; de training loopt door op een ander toestel',
  grens: 'De proef loopt over de routes die het scherm aanroept, niet door het scherm zelf. De bijles (/api/bijles) is een modelvraag en is niet gelopen; het niveau-advies is alleen geladen. De antwoorden zijn met opzet niet goed: de proef meet de loop, niet de leerstof. Er is geen Redis of PostgreSQL in de wereld.',
  loop
};
