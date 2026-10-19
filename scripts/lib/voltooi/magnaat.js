/* ============================================================================
   VOLTOOIPROEF: MAGNAAT WERELD (link:magnaat, /apps/magnaat.html).

   De belofte van het scherm: een lid leert ondernemen door echt te doen -- hij
   pakt een dossier uit zijn dagdienst op, opent het juiste RTG-scherm in de
   trainingskopie, beantwoordt de operationele keuzes, en wat hij verdient
   (punten, reputatie, virtueel kapitaal) blijft van hem.

   De speler is een lid wiens identiteit RTG zag (A3); de routes zijn die van
   het scherm (api(...) onder /api/member/magnaat/). Het openen van het
   RTG-scherm in de trainingskopie is in de browser een iframe; hier is het de
   handeling die het scherm daarna stuurt (/taak/handeling met de sleutel van
   dat scherm), precies wat de server controleert.
   ========================================================================== */
'use strict';
const { nieuwLid, geverifieerdLid, KANTOORWERELD } = require('../voltooiwereld');

const OVERZICHT = '/api/member/magnaat/overzicht';
const START = '/api/member/magnaat/taak/start';
const HANDELING = '/api/member/magnaat/taak/handeling';
const ANTWOORD = '/api/member/magnaat/taak/antwoord';

async function loop(w, stap) {
  const L = await geverifieerdLid(w, 'mag');
  const post = (pad, lijf, tok) => w.post(pad, lijf, tok || L.token);
  const speler = async (tok) => ((await post(OVERZICHT, {}, tok)).data || {}).speler || {};
  /* Het volgende open dossier van de dagdienst, zoals het scherm het aanbiedt. */
  const volgend = async (tok) => ((await speler(tok)).dienst.dossiers || []).find((d) => d.status === 'open');
  /* Een dossier oppakken en het RTG-scherm openen: de taak staat daarna op de
     eerste keuzevraag. */
  async function begin(tok) {
    const d = await volgend(tok);
    const s = await post(START, { functieId: d.functieId, apparaat: 'computer' }, tok);
    if (s.status !== 200) throw new Error('het dossier ging niet open (' + s.status + ': ' + (s.data && s.data.error) + ')');
    const h = await post(HANDELING, { taakId: s.data.taak.id, handeling: s.data.taak.huidig.doel }, tok);
    if (h.status !== 200) throw new Error('het RTG-scherm openen telde niet (' + h.status + ')');
    return h.data.taak;
  }
  /* Een keuze beantwoorden, met de stap erbij zoals het scherm hem toont. */
  const antwoord = (taak, keuze, tok) => post(ANTWOORD, { taakId: taak.id, keuze, stap: taak.stap }, tok);
  async function maakAf(taak, tok) {
    let t = taak;
    while (t.status === 'bezig') {
      const r = await antwoord(t, 0, tok);
      if (r.status !== 200) throw new Error('een keuze telde niet (' + r.status + ': ' + (r.data && r.data.error) + ')');
      t = r.data.taak;
    }
    return t;
  }
  let eerste = null, na = null;

  /* ---------------- voltooibaar ---------------- */
  await stap('voltooibaar', 'de speler opent Magnaat: startkapitaal, geen punten, en een dagdienst met open dossiers', async () => {
    const s = await speler();
    const open = (s.dienst && s.dienst.dossiers || []).filter((d) => d.status === 'open').length;
    return { klopt: s.xp === 0 && s.voltooid === 0 && s.virtueelBudget > 0 && open >= 1,
      ziet: 'xp ' + s.xp + ', budget ' + s.virtueelBudget + ', ' + open + ' open dossiers' };
  });

  await stap('voltooibaar', 'hij pakt een dossier op en moet eerst het juiste RTG-scherm openen; een ander scherm telt niet', async () => {
    const d = await volgend();
    const s = await post(START, { functieId: d.functieId, apparaat: 'computer' });
    eerste = s.data && s.data.taak;
    const vroeg = await antwoord(eerste, 0);
    const fout = await post(HANDELING, { taakId: eerste.id, handeling: 'tab:bestaat-niet' });
    const goed = await post(HANDELING, { taakId: eerste.id, handeling: eerste.huidig.doel });
    eerste = goed.data && goed.data.taak;
    return { klopt: s.status === 200 && vroeg.status === 409 && fout.status === 400 && goed.status === 200 && eerste.stap === 1,
      ziet: 'start ' + s.status + ', antwoord te vroeg ' + vroeg.status + ', verkeerd scherm ' + fout.status + ', juist scherm ' + goed.status };
  });

  await stap('voltooibaar', 'hij beantwoordt de keuzes; het dossier is klaar en zijn punten en kapitaal groeien', async () => {
    const voor = await speler();
    const t = await maakAf(eerste);
    na = await speler();
    return { klopt: t.status === 'klaar' && na.voltooid === 1 && na.xp === voor.xp + t.punten && na.virtueelBudget > voor.virtueelBudget &&
      (na.dienst.dossiers.find((d) => d.functieId === t.functieId) || {}).status === 'klaar',
      ziet: 'dossier ' + t.status + ', xp ' + voor.xp + ' -> ' + na.xp + ', voltooid ' + na.voltooid };
  });

  await stap('voltooibaar', 'een tweede speler beantwoordt, opent of ziet de dossiers van de eerste niet', async () => {
    const B = await nieuwLid(w, 'magb');
    const t = await begin();
    const a = await post(ANTWOORD, { taakId: t.id, keuze: 0, stap: t.stap }, B.token);
    const h = await post(HANDELING, { taakId: t.id, handeling: 'x' }, B.token);
    const b = await speler(B.token);
    const zelf = await speler();
    return { klopt: a.status === 404 && h.status === 404 && b.xp === 0 && b.voltooid === 0 && !b.actieveTaak &&
      zelf.actieveTaak && zelf.actieveTaak.stap === t.stap,
      ziet: 'antwoord ' + a.status + ', handeling ' + h.status + ', B heeft xp ' + b.xp + '; de taak van A blijft op stap ' + (zelf.actieveTaak && zelf.actieveTaak.stap) };
  });

  /* ---------------- persistent ---------------- */
  await w.herstart();
  await stap('persistent', 'na een nette herstart staan punten, voltooid dossier en de lopende opdracht er nog', async () => {
    const s = await speler();
    return { klopt: s.xp === na.xp && s.voltooid === 1 && !!s.actieveTaak && s.actieveTaak.status === 'bezig',
      ziet: 'xp ' + s.xp + ', voltooid ' + s.voltooid + ', lopend ' + (s.actieveTaak && s.actieveTaak.stap) };
  });
  await stap('persistent', 'na opnieuw inloggen speelt hij de lopende opdracht af waar hij was', async () => {
    const tok = (await w.post('/api/auth/login', { login: L.email, password: L.wachtwoord })).data.token;
    const s = await speler(tok);
    const t = await maakAf(s.actieveTaak, tok);
    const n = await speler(tok);
    na = n;
    return { klopt: t.status === 'klaar' && n.voltooid === 2, ziet: 'nieuwe sessie: dossier ' + t.status + ', voltooid ' + n.voltooid };
  });
  await stap('persistent', 'een read-only lezer vindt zijn voltooide dossiers in de opslag', async () => {
    const plek = w.vindInOpslag('taak-voltooid');
    return { klopt: plek.length >= 1, ziet: plek.map((p) => p.bestand + '/' + p.tabel + (p.sleutel ? ':' + p.sleutel : '')).join(', ') || 'nergens' };
  });

  /* ---------------- herstelbaar ---------------- */
  await stap('herstelbaar', 'een dubbele tik op "Start dossier" opent een opdracht', async () => {
    const d = await volgend();
    const [a, b] = await w.dubbel(START, { functieId: d.functieId, apparaat: 'computer' }, L.token);
    const s = await speler();
    const ids = new Set([a, b].filter((x) => x.data && x.data.taak).map((x) => x.data.taak.id));
    const t = s.actieveTaak;
    if (t) await post(HANDELING, { taakId: t.id, handeling: t.huidig.doel });
    return { klopt: [a, b].some((x) => x.status === 200) && [a, b].every((x) => x.status === 200 || x.status === 409) && ids.size === 1 && !!t,
      ziet: 'tikken ' + a.status + '/' + b.status + ', ' + ids.size + ' opdracht' };
  });
  await stap('herstelbaar', 'een afgebroken antwoord, daarna opnieuw: de opdracht gaat een stap verder en niet twee', async () => {
    const t = (await speler()).actieveTaak;
    const half = await w.afgebroken(ANTWOORD, { taakId: t.id, keuze: 0, stap: t.stap }, L.token);
    const opnieuw = await post(ANTWOORD, { taakId: t.id, keuze: 0, stap: t.stap });
    const n = (await speler()).actieveTaak || (await speler()).recent.find((x) => x.id === t.id);
    return { klopt: [200, 409].includes(opnieuw.status) && n.stap === t.stap + 1,
      ziet: 'afgebroken (' + (half.afgebroken ? 'client gaf op' : 'status ' + half.status) + '), opnieuw ' + opnieuw.status + ', stap ' + t.stap + ' -> ' + n.stap };
  });
  await stap('herstelbaar', 'een crash direct na het laatste antwoord: na de herstart is het dossier een keer geteld', async () => {
    const t = (await speler()).actieveTaak;
    const voor = await speler();
    const klaar = await maakAf(t);
    const vlak = await speler();
    await w.crash();
    const opnieuw = await post(ANTWOORD, { taakId: t.id, keuze: 0, stap: klaar.stappen - 1 });
    const s = await speler();
    return { klopt: klaar.status === 'klaar' && s.voltooid === voor.voltooid + 1 && s.xp === vlak.xp && opnieuw.status === 409,
      ziet: 'na SIGKILL: voltooid ' + s.voltooid + ', xp ' + s.xp + ' (voor de crash ' + vlak.xp + '), herhaling ' + opnieuw.status };
  });
}

module.exports = {
  functie: 'link:magnaat',
  ingang: '/apps/magnaat.html',
  persona: 'lid',
  omgeving: KANTOORWERELD,
  belofte: 'een lid pakt een dossier uit zijn dagdienst op, opent het juiste RTG-scherm in de trainingskopie en beantwoordt de keuzes; wat hij verdient blijft van hem na een herstart en een crash, telt een keer, en een andere speler komt er niet aan',
  grens: 'De proef loopt de routes van het scherm, niet het scherm zelf: het openen van het RTG-scherm in de iframe is hier de handeling die het scherm daarna stuurt. Alleen de dagdienst met keuzedossiers; de teamkamer, de economie, de controlekamer, de partnertraining en Oudwijk zijn niet beproefd. Geen Redis of PostgreSQL.',
  loop
};
