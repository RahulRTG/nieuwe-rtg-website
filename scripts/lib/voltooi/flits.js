/* ============================================================================
   VOLTOOIPROEF: RTG FLITS (link:flits, /apps/flits.html).

   De belofte, in de woorden van kern/flits.js: leden melden onderweg met een
   tik wat ze zien, en wie eraan komt rijden wordt op tijd gewaarschuwd. Een
   tweede melding van dezelfde soort binnen 300 meter is een bevestiging en
   geen nieuwe melding; "klopt nog" verlengt, drie keer "weg" haalt hem eraf.
   In landen waar flitsermeldingen verboden zijn, worden ze geweigerd. Geen
   punten, geen scores, geen ranglijst.

   VIER LEDEN, en dat is nodig: een melder, en drie anderen die stemmen. Een lid
   alleen kan de melding van een ander niet weghalen -- daar zijn er drie
   verschillende voor nodig, en twee keer stemmen door hetzelfde lid telt
   een keer. Elke melder meldt hooguit een keer per twintig seconden; de proef
   verdeelt de meldingen daarom over de leden en wacht waar het moet.
   ========================================================================== */
'use strict';
const { nieuwLid, inloggen, KANTOORWERELD } = require('../voltooiwereld');

const ROND = '/api/flits/rond';
const MELD = '/api/flits/meld';
const STEM = '/api/flits/stem';
const VOORUIT = '/api/flits/vooruit';

const plek = (n) => ({ lat: 38.94 + n * 0.007, lng: 1.39, land: 'ES' });
const geen5xx = (r) => r && r.status > 0 && r.status < 500;
const pauze = () => new Promise((r) => setTimeout(r, 21000));

async function loop(w, stap) {
  const A = await nieuwLid(w, 'fla');
  const B = await nieuwLid(w, 'flb');
  const C = await nieuwLid(w, 'flc');
  const D = await nieuwLid(w, 'fld');
  const E = await nieuwLid(w, 'fle');
  let T = A.token;
  const rond = async (p, tok) => ((((await w.post(ROND, p, tok || T)).data) || {}).meldingen || []);
  const metId = async (id, p, tok) => (await rond(p, tok)).find((m) => m.id === id) || null;
  let flitser = null, file = null;

  /* ---------------- voltooibaar ---------------- */
  await stap('voltooibaar', 'het rondom-beeld is eerlijk over zijn bron en kent de soorten, zonder punten of ranglijst', async () => {
    const r = await w.post(ROND, plek(0), T);
    const tekst = JSON.stringify(r.data);
    return { klopt: r.status === 200 && Array.isArray(r.data.meldingen) && /eigen netwerk/.test(r.data.bron) && r.data.soorten.length >= 5 &&
      r.data.flitsToegestaan === true && !/punten"|score|ranglijst/i.test(tekst.replace(r.data.bron, '')),
      ziet: r.status + ', ' + r.data.meldingen.length + ' meldingen, bron: ' + r.data.bron.slice(0, 60) };
  });

  await stap('voltooibaar', 'een flitser melden in Frankrijk wordt geweigerd met de reden; een file daar mag wel', async () => {
    const f = await w.post(MELD, { soort: 'flitser', lat: 48.85, lng: 2.35, land: 'FR' }, C.token);
    const ok = await w.post(MELD, { soort: 'file', lat: 48.85, lng: 2.35, land: 'FR' }, C.token);
    return { klopt: f.status === 403 && /wettelijk niet toegestaan/.test(f.data.error) && ok.status === 200,
      ziet: 'flitser ' + f.status + ' (' + (f.data && f.data.error || '').slice(0, 60) + '), file ' + ok.status };
  });

  await stap('voltooibaar', 'het lid meldt een flitser; een ander lid in de buurt ziet hem, op codenaam', async () => {
    const m = await w.post(MELD, Object.assign({ soort: 'flitser' }, plek(0)), T);
    flitser = m.data && m.data.melding;
    const b = flitser && await metId(flitser.id, plek(0), B.token);
    return { klopt: m.status === 200 && !!b && b.soort === 'flitser' && !!b.door && !JSON.stringify(b).includes('Voltooilid') && !JSON.stringify(b).includes(A.email),
      ziet: 'melden ' + m.status + ', B ziet ' + (b ? b.naam + ' door ' + b.door + ' op ' + b.afstandKm + ' km' : 'NIETS') };
  });

  await stap('voltooibaar', 'een tweede lid meldt dezelfde flitser vlakbij: dat is een bevestiging, geen tweede melding', async () => {
    const p = plek(0);
    const m = await w.post(MELD, { soort: 'flitser', lat: p.lat + 0.001, lng: p.lng, land: 'ES' }, D.token);
    const daar = (await rond(p)).filter((x) => x.soort === 'flitser' && x.afstandKm < 0.3);
    return { klopt: m.status === 200 && m.data.bevestigd === true && m.data.melding.id === flitser.id && daar.length === 1 && daar[0].bevestigingen === 1,
      ziet: 'melden ' + m.status + (m.data && m.data.bevestigd ? ' als bevestiging' : ' als NIEUW') + ', ' + daar.length + ' flitser, ' + (daar[0] && daar[0].bevestigingen) + ' bevestiging' };
  });

  await stap('voltooibaar', '"klopt nog" van een ander lid telt; twee keer stemmen door hetzelfde lid telt een keer', async () => {
    const a = await w.post(STEM, { id: flitser.id, klopt: true }, B.token);
    const b = await w.post(STEM, { id: flitser.id, klopt: true }, B.token);
    const m = await metId(flitser.id, plek(0));
    return { klopt: a.status === 200 && b.status === 200 && b.data.al === true && m && m.bevestigingen === 2,
      ziet: 'stemmen ' + a.status + '/' + b.status + (b.data && b.data.al ? ' (al gestemd)' : '') + ', ' + (m && m.bevestigingen) + ' bevestigingen' };
  });

  await stap('voltooibaar', 'een melder bevestigt zijn eigen melding niet: "klopt" geeft een 403 met een zin, en opnieuw melden vlakbij is een herhaling', async () => {
    const s0 = (await metId(flitser.id, plek(0))).bevestigingen;
    const k = await w.post(STEM, { id: flitser.id, klopt: true }, T);
    await pauze();
    const p = plek(0);
    const m = await w.post(MELD, { soort: 'flitser', lat: p.lat + 0.0005, lng: p.lng, land: 'ES', idem: 'vp-flits-zelf' }, T);
    const s1 = (await metId(flitser.id, plek(0))).bevestigingen;
    return { klopt: k.status === 403 && /eigen melding/.test(k.data.error) && m.status === 200 && m.data.herhaald === true && m.data.melding.id === flitser.id && s1 === s0,
      ziet: 'zelf stemmen ' + k.status + ' (' + (k.data && k.data.error) + '), opnieuw melden ' + m.status + (m.data && m.data.herhaald ? ' als herhaling' : m.data && m.data.bevestigd ? ' ALS BEVESTIGING' : '') + ', bevestigingen ' + s0 + ' -> ' + s1 };
  });

  await stap('voltooibaar', 'een file melden en drie verschillende leden zeggen "weg": dan pas is hij van de kaart, niet na een of twee', async () => {
    const m = await w.post(MELD, Object.assign({ soort: 'file' }, plek(2)), B.token);
    file = m.data && m.data.melding;
    const een = await w.post(STEM, { id: file.id, klopt: false }, A.token);
    const naEen = await metId(file.id, plek(2));
    await w.post(STEM, { id: file.id, klopt: false }, A.token);
    const naDubbel = await metId(file.id, plek(2));
    await w.post(STEM, { id: file.id, klopt: false }, C.token);
    const drie = await w.post(STEM, { id: file.id, klopt: false }, D.token);
    const weg = await metId(file.id, plek(2));
    return { klopt: m.status === 200 && een.status === 200 && !!naEen && !!naDubbel && drie.data.weg === true && !weg,
      ziet: 'file ' + m.status + '; na 1 stem ' + (naEen ? 'staat hij' : 'WEG') + ', na een dubbele stem van hetzelfde lid ' + (naDubbel ? 'staat hij' : 'WEG') + ', na 3 leden ' + (weg ? 'STAAT HIJ NOG' : 'weg') };
  });

  await stap('voltooibaar', 'de vooruitblik voor de stad geeft het uurbeeld, en een gast mag niet melden', async () => {
    const v = await w.post(VOORUIT, { stad: 'Ibiza' }, T);
    const G = await nieuwLid(w, 'flg', 'guest');
    const g = await w.post(MELD, Object.assign({ soort: 'file' }, plek(5)), G.token);
    return { klopt: v.status === 200 && Array.isArray(v.data.uurbeeld) && g.status === 403 && /voor leden/.test(g.data.error),
      ziet: 'vooruit ' + v.status + ' (' + (v.data.uurbeeld || []).length + ' uren), gast ' + g.status + ' (' + (g.data && g.data.error) + ')' };
  });

  /* ---------------- persistent ---------------- */
  const voor = JSON.stringify(await metId(flitser.id, plek(0)));
  await w.herstart();

  await stap('persistent', 'na een nette herstart staat de flitser er nog, met zijn bevestigingen', async () => {
    const na = JSON.stringify(await metId(flitser.id, plek(0)));
    return { klopt: voor !== 'null' && na === voor, ziet: na === voor ? 'gelijk' : 'ANDERS: ' + na };
  });

  await stap('persistent', 'een nieuwe sessie ziet hetzelfde, en de weggestemde file blijft weg', async () => {
    T = await inloggen(w, A);
    const na = JSON.stringify(await metId(flitser.id, plek(0)));
    const f = await metId(file.id, plek(2));
    return { klopt: na === voor && !f, ziet: (na === voor ? 'flitser gelijk' : 'ANDERS') + ', file ' + (f ? 'TERUG' : 'weg') };
  });

  await stap('persistent', 'de melding staat in de opslag, met melder en bevestigers (de stem van B, de melding van D) als sleutel en niet als naam of e-mailadres', async () => {
    const rij = (w.collectie('flitsMeldingen') || []).find((m) => m.id === flitser.id);
    const tekst = JSON.stringify(rij || {});
    return { klopt: !!rij && rij.bevestigingen === 2 && (rij.stemmers || []).length === 2 && !!rij.melder && !tekst.includes(A.email) && !tekst.includes(B.email) && !tekst.includes('Voltooilid'),
      ziet: rij ? 'gevonden, ' + rij.bevestigingen + ' bevestigingen, ' + (rij.stemmers || []).length + ' bevestigers, melder als sleutel ' + !!rij.melder : 'NIET GEVONDEN' };
  });

  /* ---------------- herstelbaar ---------------- */
  await stap('herstelbaar', 'dubbeltik op melden: een melding op de kaart', async () => {
    await pauze();
    const [a, b] = await w.dubbel(MELD, Object.assign({ soort: 'ongeval' }, plek(3)), C.token);
    const n = (await rond(plek(3))).filter((m) => m.soort === 'ongeval' && m.afstandKm < 0.3).length;
    return { klopt: geen5xx(a) && geen5xx(b) && (a.status === 200 || b.status === 200) && n === 1, ziet: 'antwoorden ' + a.status + '/' + b.status + ', ' + n + ' melding' };
  });

  await stap('herstelbaar', 'dubbeltik op "klopt nog": een bevestiging erbij, niet twee', async () => {
    const voorB = (await metId(flitser.id, plek(0))).bevestigingen;
    const [a, b] = await w.dubbel(STEM, { id: flitser.id, klopt: true }, C.token);
    const na = (await metId(flitser.id, plek(0))).bevestigingen;
    return { klopt: geen5xx(a) && geen5xx(b) && na === voorB + 1, ziet: 'antwoorden ' + a.status + '/' + b.status + ', bevestigingen ' + voorB + ' -> ' + na };
  });

  await stap('herstelbaar', 'een afgebroken melding en opnieuw: precies een melding', async () => {
    await pauze();
    const lijf = Object.assign({ soort: 'object', idem: 'vp-flits-half' }, plek(4));
    const half = await w.afgebroken(MELD, lijf, D.token);
    const opnieuw = await w.post(MELD, lijf, D.token);
    const n = (await rond(plek(4))).filter((m) => m.soort === 'object' && m.afstandKm < 0.3).length;
    return { klopt: opnieuw.status === 200 && n === 1,
      ziet: 'afgebroken (' + (half.afgebroken ? 'client gaf op' : 'status ' + half.status) + '), opnieuw ' + opnieuw.status + (opnieuw.data && opnieuw.data.herhaald ? ' (herhaling van dezelfde tik)' : '') + ', ' + n + ' melding' };
  });

  await stap('herstelbaar', 'een crash direct na een stem: de bevestiging staat er na de herstart, en die stemmer telt niet nog een keer', async () => {
    const voorB = (await metId(flitser.id, plek(0))).bevestigingen;
    const s = await w.post(STEM, { id: flitser.id, klopt: true }, E.token);
    await w.crash();
    const na = (await metId(flitser.id, plek(0))).bevestigingen;
    const weer = await w.post(STEM, { id: flitser.id, klopt: true }, E.token);
    const daarna = (await metId(flitser.id, plek(0))).bevestigingen;
    return { klopt: s.status === 200 && na === voorB + 1 && weer.data.al === true && daarna === na,
      ziet: 'stem ' + s.status + ', na SIGKILL ' + na + ' (was ' + voorB + '), opnieuw stemmen ' + (weer.data && weer.data.al ? 'telt niet' : 'TELT') + ', nu ' + daarna };
  });
}

module.exports = {
  functie: 'link:flits',
  ingang: '/apps/flits.html',
  persona: 'lid',
  omgeving: KANTOORWERELD,
  belofte: 'een lid meldt met een tik wat hij onderweg ziet en wie in de buurt is ziet het op codenaam; een melding vlakbij van dezelfde soort door een ander is een bevestiging, een melder bevestigt zichzelf nooit, "klopt nog" verlengt, drie verschillende leden halen hem weg, en in landen waar het verboden is wordt een flitser geweigerd -- ook na een herstart, een dubbele tik, een afgebroken verzoek en een crash',
  grens: 'De proef loopt de routes van het scherm, niet het scherm zelf. De chauffeurskant (/api/staff/flits/*) en het verlopen van een melding op zijn houdbaarheid (dat vraagt een klok die vooruit kan) zijn niet gelopen. Officiele flitserdata is er niet; het beeld komt van het eigen netwerk. Er is geen Redis of PostgreSQL in de wereld.',
  loop
};
