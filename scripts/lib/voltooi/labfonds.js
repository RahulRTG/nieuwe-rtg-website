/* ============================================================================
   VOLTOOIPROEF: LAB-FONDS (link:labfonds, /apps/geld.html#labfonds).

   De belofte, in de woorden van kern/labfonds.js: leden zamelen samen in voor
   het RTF Onderzoekslab, per locatie een eigen pot; wat er met de pot
   gebeurt, beslissen de leden GEZAMENLIJK met een scheidsrechter die op
   eerlijkheid en de omgeving let. Routes letterlijk uit apps/geld/labfondsb.js.

   WAT HIER NIET GEBEURT: er beweegt geen euro. Een bijdrage is een toezegging
   in het fondsgrootboek (kop van routes/labfonds.js). De proef meet dus dat
   een toezegging precies een keer in de pot landt -- ook bij een dubbele tik,
   een afgebroken verzoek en een crash -- en dat alleen de indiener de stemming
   over zijn voorstel sluit. Het fonds is gedeeld: de pot van een plek is voor
   ieder lid zichtbaar, maar de eigen bijdrage is van het lid zelf.
   ========================================================================== */
'use strict';
const { nieuwLid, inloggen } = require('../voltooiwereld');

const OVERZICHT = '/api/labfonds/overzicht';
const DONEER = '/api/labfonds/doneer';
const VOORSTEL = '/api/labfonds/voorstel/maak';
const STEM = '/api/labfonds/stem';
const BESLIS = '/api/labfonds/beslis';
const PLEK = 'amsterdam';

async function loop(w, stap) {
  const merk = 'lf' + Date.now().toString(36);
  const A = await nieuwLid(w, 'lfa');
  const B = await nieuwLid(w, 'lfb');
  const ov = async (tok) => (await w.post(OVERZICHT, {}, tok || A.token)).data || {};
  const plek = (o) => (o.locaties || []).find((l) => l.id === PLEK) || {};
  const opslagPlek = () => ((w.collectie('labFonds') || {}).locaties || {})[PLEK] || {};
  let voorstel = null;

  /* ---------------- voltooibaar ---------------- */
  await stap('voltooibaar', 'een lid opent het fonds: de locaties met hun pot, en zelf nog niets bijgedragen', async () => {
    const o = await ov();
    return { klopt: (o.locaties || []).length >= 3 && !!plek(o).id && o.mijnBijdrage === 0,
      ziet: (o.locaties || []).length + ' locaties, eigen bijdrage ' + o.mijnBijdrage };
  });

  await stap('voltooibaar', 'A zegt 25 euro toe aan Amsterdam: de pot en de eigen bijdrage gaan precies zoveel omhoog', async () => {
    const voor = plek(await ov());
    const r = await w.post(DONEER, { locId: PLEK, bedrag: 25, idem: merk + '-eerste' }, A.token);
    const o = await ov();
    return { klopt: r.status === 200 && plek(o).pot - voor.pot === 25 && o.mijnBijdrage === 25 && plek(o).mijnBijdrage === 25,
      ziet: 'toezeggen ' + r.status + ', pot +' + (plek(o).pot - voor.pot) + ', eigen bijdrage ' + o.mijnBijdrage };
  });

  await stap('voltooibaar', 'minder dan een euro en een onbekende plek worden geweigerd met de reden, en de pot blijft', async () => {
    const voor = plek(await ov()).pot;
    const klein = await w.post(DONEER, { locId: PLEK, bedrag: 0.5, idem: merk + '-klein' }, A.token);
    const nergens = await w.post(DONEER, { locId: 'atlantis-' + merk, bedrag: 5, idem: merk + '-nergens' }, A.token);
    return { klopt: klein.status === 400 && /minimaal/.test(klein.data.error) && nergens.status === 404 && plek(await ov()).pot === voor,
      ziet: 'te klein ' + klein.status + ' (' + (klein.data && klein.data.error) + '), onbekend ' + nergens.status };
  });

  await stap('voltooibaar', 'A dient een voorstel in voor de pot; de scheidsrechter geeft meteen een oordeel en A stemt zelf voor', async () => {
    const r = await w.post(VOORSTEL, { locId: PLEK, titel: 'Bomen ' + merk,
      doel: 'Tien bomen langs de gracht, geplant met de buurt en twee jaar onderhouden.', bedrag: 20, idem: merk + '-voorstel' }, A.token);
    voorstel = r.data && r.data.voorstel;
    return { klopt: r.status === 200 && !!voorstel && voorstel.status === 'open' && voorstel.voor === 1 && !!voorstel.scheids,
      ziet: 'indienen ' + r.status + ', scheidsrechter ' + (voorstel && voorstel.scheids && voorstel.scheids.oordeel) };
  });

  await stap('voltooibaar', 'B stemt voor; B ziet het voorstel, maar niet A\'s bijdrage als de zijne, en kan de stemming niet sluiten', async () => {
    const st = await w.post(STEM, { id: voorstel.id, keuze: 'voor' }, B.token);
    const oB = await ov(B.token);
    const sluit = await w.post(BESLIS, { id: voorstel.id }, B.token);
    const v = (oB.voorstellen || []).find((x) => x.id === voorstel.id) || {};
    return { klopt: st.status === 200 && v.voor === 2 && v.mijnStem === 'voor' && oB.mijnBijdrage === 0 &&
      sluit.status === 403 && /indiende/.test(sluit.data.error) && v.status === 'open',
      ziet: 'stem ' + st.status + ', ' + v.voor + ' voor; B eigen bijdrage ' + oB.mijnBijdrage + ', sluiten door B ' + sluit.status };
  });

  await stap('voltooibaar', 'A sluit de stemming: toegekend, de pot gaat 20 euro omlaag; nog eens sluiten kan niet', async () => {
    const voor = plek(await ov());
    const r = await w.post(BESLIS, { id: voorstel.id }, A.token);
    const nog = await w.post(BESLIS, { id: voorstel.id }, A.token);
    const na = plek(await ov());
    const b = r.data && r.data.voorstel && r.data.voorstel.besluit;
    return { klopt: r.status === 200 && b && b.toegekend === true && voor.pot - na.pot === 20 && na.uitgekeerd - voor.uitgekeerd === 20 && nog.status === 409,
      ziet: 'besluit ' + r.status + ' (' + (b && b.reden) + '), pot -' + (voor.pot - na.pot) + ', nog eens ' + nog.status };
  });

  await stap('voltooibaar', 'uitgelogd ziet niemand het fonds en zegt niemand iets toe: 401, met een zin', async () => {
    const o = await w.post(OVERZICHT, {}, null);
    const d = await w.post(DONEER, { locId: PLEK, bedrag: 5, idem: merk + '-uit' }, null);
    return { klopt: o.status === 401 && d.status === 401 && !!(d.data && d.data.error),
      ziet: 'overzicht ' + o.status + ', toezeggen ' + d.status + ' (' + (d.data && d.data.error) + ')' };
  });

  /* ---------------- persistent ---------------- */
  await w.herstart();
  const stand = plek(await ov());
  await stap('persistent', 'na een nette herstart staat de eigen bijdrage er nog, en het voorstel is niet meer open', async () => {
    const o = await ov();
    return { klopt: o.mijnBijdrage === 25 && !(o.voorstellen || []).some((x) => x.id === voorstel.id),
      ziet: 'eigen bijdrage ' + o.mijnBijdrage + ', open voorstellen ' + (o.voorstellen || []).length };
  });

  await stap('persistent', 'een read-only lezer vindt de bijdrage, het besluit en de stand van de pot in de opslag', async () => {
    const f = w.collectie('labFonds') || {};
    const mijn = (f.bijdragen || []).filter((b) => b.idem === merk + '-eerste');
    const v = (f.voorstellen || []).find((x) => x.id === voorstel.id) || {};
    return { klopt: mijn.length === 1 && mijn[0].centen === 2500 && v.status === 'toegekend' && Math.round(opslagPlek().pot) === Math.round(stand.pot * 100),
      ziet: mijn.length + ' bijdrage, voorstel ' + v.status + ', pot op schijf ' + opslagPlek().pot + ' cent' };
  });

  await stap('persistent', 'na de herstart logt A opnieuw in en ziet in een nieuwe sessie dezelfde eigen bijdrage', async () => {
    const tok = await inloggen(w, A);
    const o = await ov(tok);
    return { klopt: o.mijnBijdrage === 25, ziet: 'nieuwe sessie, eigen bijdrage ' + o.mijnBijdrage };
  });

  /* ---------------- herstelbaar ---------------- */
  await stap('herstelbaar', 'een dubbele tik op Toezeggen (dezelfde sleutel, tegelijk) legt de bijdrage een keer in de pot', async () => {
    const voor = await ov();
    const [a, b] = await w.dubbel(DONEER, { locId: PLEK, bedrag: 7, idem: merk + '-dubbel' }, A.token);
    const na = await ov();
    return { klopt: a.status === 200 && b.status === 200 && na.mijnBijdrage - voor.mijnBijdrage === 7 && plek(na).pot - plek(voor).pot === 7,
      ziet: 'tikken ' + a.status + '/' + b.status + ', eigen bijdrage +' + (na.mijnBijdrage - voor.mijnBijdrage) };
  });

  await stap('herstelbaar', 'een dubbele tik op Indienen (dezelfde sleutel, tegelijk) dient een voorstel een keer in', async () => {
    const lijf = { locId: PLEK, titel: 'Bankjes ' + merk, doel: 'Vier bankjes aan het water, gemaakt van hout uit de buurt.', bedrag: 2, idem: merk + '-dubbelvoorstel' };
    const [a, b] = await w.dubbel(VOORSTEL, lijf, A.token);
    const open = ((await ov()).voorstellen || []).filter((v) => v.titel === lijf.titel);
    return { klopt: a.status === 200 && b.status === 200 && open.length === 1, ziet: 'tikken ' + a.status + '/' + b.status + ', ' + open.length + ' voorstel(len)' };
  });

  await stap('herstelbaar', 'een afgebroken toezegging, daarna opnieuw met dezelfde sleutel: een keer in de pot', async () => {
    const voor = await ov();
    const half = await w.afgebroken(DONEER, { locId: PLEK, bedrag: 3, idem: merk + '-half' }, A.token);
    const opnieuw = await w.post(DONEER, { locId: PLEK, bedrag: 3, idem: merk + '-half' }, A.token);
    const na = await ov();
    return { klopt: opnieuw.status === 200 && na.mijnBijdrage - voor.mijnBijdrage === 3,
      ziet: 'afgebroken (' + (half.afgebroken ? 'client gaf op' : 'status ' + half.status) + '), opnieuw ' + opnieuw.status + ', eigen bijdrage +' + (na.mijnBijdrage - voor.mijnBijdrage) };
  });

  await stap('herstelbaar', 'een crash direct na een toezegging, daarna dezelfde tik opnieuw: niet verloren en niet verdubbeld', async () => {
    const voor = await ov();
    const r = await w.post(DONEER, { locId: PLEK, bedrag: 9, idem: merk + '-crash' }, A.token);
    await w.crash();
    const opnieuw = await w.post(DONEER, { locId: PLEK, bedrag: 9, idem: merk + '-crash' }, A.token);
    const na = await ov();
    return { klopt: r.status === 200 && opnieuw.status === 200 && na.mijnBijdrage - voor.mijnBijdrage === 9,
      ziet: 'toegezegd ' + r.status + ', na SIGKILL ' + opnieuw.status + (opnieuw.data && opnieuw.data.herhaald ? ' (herhaald)' : '') + ', eigen bijdrage +' + (na.mijnBijdrage - voor.mijnBijdrage) };
  });
}

module.exports = {
  functie: 'link:labfonds',
  ingang: '/apps/geld.html#labfonds',
  persona: 'lid',
  belofte: 'leden zeggen samen geld toe aan de pot van een plek, dienen een voorstel in en beslissen gezamenlijk met de scheidsrechter; alleen de indiener sluit de stemming, de eigen bijdrage is van het lid zelf, en een dubbele tik, een afgebroken verzoek of een crash legt een toezegging nooit twee keer in de pot',
  grens: 'Er beweegt geen geld: een bijdrage is een toezegging in het fondsgrootboek. De gezinsdeur (/api/rtf/labfonds/*), de financiering per onderzoek en de AI-verrijking zijn hier niet beproefd; de proef loopt de routes van de stand, niet de stand zelf, en kent geen Redis of PostgreSQL.',
  loop
};
