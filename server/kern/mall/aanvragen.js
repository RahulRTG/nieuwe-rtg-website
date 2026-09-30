'use strict';
/* De vraagkant blijft eigendom van Mall. Een aanvraag is geen boeking of
   betaling. De gekozen zaak ontvangt blijvend werk; het lid ziet haar antwoord. */
const levensloop = require('./aanvraag-acties');
const MAX_OPEN_PER_LID = 10, MAX_REACTIES = 25;
const { DAGEN_GELDIG } = levensloop;
module.exports = ctx => {
  const { db, crypto, plek } = ctx;
  const vastleggen = require('../../lib/duurzaam')({ ...ctx, bron: 'mall-aanvraag' });
  const { VERDIEPINGEN, GENRE_VERDIEPING } = require('./aanbodvorm');
  const eigenC = require('../eigencollectie')({ db, domein: 'kern/mall/aanvragen', bezit: { mallAanvragen: 'lijst' } });
  const kijk = () => eigenC.kijk('mallAanvragen');
  const schoon = (v, n) => String(v == null ? '' : v).replace(/[<>]/g, '').trim().slice(0, n);
  const nu = () => new Date().toISOString();
  const opdracht = (actor, actie, data) => require('node:crypto').createHash('sha256')
    .update(JSON.stringify([actor, actie, data.versie, data.code, data.tekst, data.prijs, data.wat, data.plek, data.wanneer, data.budget, data.verdieping])).digest('hex');
  const open = a => a.status === 'open' && !levensloop.verlopen(a);
  const vind = (key, id) => kijk().find(a => a.id === String(id || '') && a.key === key);
  function past(a, s) {
    return a.verdieping === GENRE_VERDIEPING[s.type] && plek.bedient({
      plek: plek.plekVan({ stad: s.city, land: s.country, punt: s.loc }), bereik: plek.bereikVan(s)
    }, a.plek);
  }
  function publiek(a, actor) {
    const eigen = actor.key === a.key;
    return { id: a.id, wat: a.wat, verdieping: a.verdieping, plek: a.plek.stad,
      wanneer: a.wanneer, budget: a.budget, status: levensloop.verlopen(a) ? 'verlopen' : a.status,
      statusLabel: levensloop.verlopen(a) ? 'Verlopen' : ({ open: 'Wacht op reacties', gegund: 'Wacht op behandeling',
        in_behandeling: 'In behandeling', afgerond: 'Antwoord ontvangen', gesloten: 'Ingetrokken' }[a.status] || a.status),
      van: eigen ? 'u' : a.codename, eigenaar: levensloop.eigenaar(a)?.zaak || null,
      versie: levensloop.versie(a), acties: levensloop.acties(a, actor),
      resultaat: eigen || levensloop.eigenaar(a)?.code === actor.code ? a.resultaat || null : null, verloop: (a.verloop || []).filter(v => eigen || v.door === actor.code || v.door === 'lid'),
      reacties: (a.reacties || []).filter(r => eigen || r.code === actor.code).map(r => ({
        code: r.code, zaak: r.zaak, tekst: r.tekst, prijs: r.prijs, at: r.at,
        gekozen: !!r.gekozen, ingetrokken: !!r.ingetrokken
      })), aantalReacties: (a.reacties || []).filter(r => !r.ingetrokken).length, at: a.at, bij: a.bij || a.at };
  }
  function aanvraagVelden(data) {
    const wat = schoon(data.wat, 300), plaats = schoon(data.plek, 40);
    if (wat.length < 5) return { status: 400, error: 'Schrijf kort wat u zoekt.' };
    if (!VERDIEPINGEN.some(v => v.id === data.verdieping)) return { status: 400, error: 'Kies waar dit bij hoort, zodat alleen de juiste zaken uw vraag zien.' };
    if (!plaats) return { status: 400, error: 'Geef de plaats op waar het moet gebeuren.' };
    return { wat, verdieping: data.verdieping, plek: plek.plekVan({ stad: plaats }),
      wanneer: /^\d{4}-\d{2}-\d{2}$/.test(String(data.wanneer || '')) ? data.wanneer : null,
      budget: Math.max(0, Math.round(Number(data.budget) || 0)) || null };
  }
  async function schrijfAanvraag(a, actor, actie, werk, tekst) {
    // PostgreSQL levert een copy-on-write proxy; de bron is uitsluitend JSON-data.
    const voor = JSON.parse(JSON.stringify(a));
    const fout = await vastleggen(() => { werk(); levensloop.noteer(a, actor, actie, tekst); });
    if (fout) { for (const k of Object.keys(a)) delete a[k]; Object.assign(a, voor); return fout; }
    return { ok: true, aanvraag: publiek(a, actor) };
  }
  async function plaats(key, codename, data = {}) {
    const v = aanvraagVelden(data); if (v.error) return v;
    const sleutel = schoon(data.sleutel, 100);
    const inhoud = JSON.stringify(v);
    const eerder = sleutel && kijk().find(a => a.key === key && a.sleutel === sleutel);
    if (eerder) return eerder.inhoud === inhoud ? { ok: true, aanvraag: publiek(eerder, { key }) }
      : { status: 409, error: 'Deze verzendsleutel hoort bij een andere aanvraag.' };
    if (kijk().filter(a => a.key === key && open(a)).length >= MAX_OPEN_PER_LID)
      return { status: 409, error: 'Sluit eerst een van uw tien open aanvragen.' };
    // Geen stille verdringing van oudere aanvragen: terugvinden hoort bij de lus.
    if (kijk().length >= 5000) return { status: 503, error: 'Nieuwe aanvragen zijn tijdelijk niet beschikbaar. Uw eerdere werk blijft bewaard.' };
    const a = { id: crypto.randomBytes(10).toString('hex'), key, codename: codename || 'Lid',
      ...v, sleutel, inhoud, status: 'open', versie: 1, reacties: [], verloop: [], at: nu() };
    const lijst = eigenC.bak('mallAanvragen');
    const fout = await vastleggen(() => lijst.unshift(a));
    if (fout) { lijst.splice(lijst.indexOf(a), 1); return fout; }
    return { ok: true, aanvraag: publiek(a, { key }) };
  }
  function mijn(key, beleid) { return { ok: true, aanvragen: kijk().filter(a => a.key === key).map(a => publiek(a, { key, beleid })) }; }
  async function lidActie(key, id, actie, data = {}, beleid) {
    const a = vind(key, id); if (!a) return { status: 404, error: 'Aanvraag niet gevonden.' };
    const actor = { key, beleid };
    // Alleen een exacte herhaling van de laatste opdracht is zonder tweede gevolg.
    if (data.versie != null && a.laatste === opdracht(key, actie, data)) return { ok: true, aanvraag: publiek(a, actor) };
    const fout = levensloop.controle(a, actor, actie, data); if (fout) return fout;
    let v, reactie;
    if (actie === 'wijzig') { v = aanvraagVelden(data); if (v.error) return v; }
    if (actie === 'kies') {
      reactie = a.reacties.find(r => r.code === data.code && !r.ingetrokken);
      if (!reactie) return { status: 404, error: 'Deze reactie is niet beschikbaar.' };
    }
    if (actie === 'heropen' && kijk().filter(x => x.key === key && open(x) && x !== a).length >= MAX_OPEN_PER_LID)
      return { status: 409, error: 'Sluit eerst een van uw tien open aanvragen.' };
    const r = await schrijfAanvraag(a, actor, actie, () => {
      a.laatste = opdracht(key, actie, data);
      if (actie === 'sluit') { a.status = 'gesloten'; a.reacties.forEach(x => { x.gekozen = false; }); }
      if (actie === 'kies') { a.status = 'gegund'; a.reacties.forEach(x => { x.gekozen = x === reactie; }); }
      if (actie === 'wijzig' || actie === 'heropen') {
        if (v) Object.assign(a, v);
        a.status = 'open'; a.at = nu(); a.resultaat = null;
        a.reacties.forEach(x => { x.gekozen = false; x.ingetrokken = true; });
      }
    });
    if (actie === 'kies' && r.ok) r.opmerking = reactie.zaak + ' ziet uw keuze in de werklijst. Er is nog niets geboekt of betaald.';
    return r;
  }
  function voorZaak(s, beleid) {
    const lijst = kijk().filter(a => (open(a) && past(a, s)) || a.reacties.some(r => r.code === s.code));
    return { ok: true, verdieping: GENRE_VERDIEPING[s.type] || null, bereik: plek.bereikVan(s),
      aanvragen: lijst.map(a => publiek(a, { code: s.code, past: past(a, s), beleid })), aantal: lijst.length,
      opmerking: 'Vragen binnen uw werkgebied en aanvragen waarop uw zaak heeft gereageerd.' };
  }
  function zaakActie(s, id, actie, data = {}, beleid) {
    const a = kijk().find(x => x.id === String(id || ''));
    if (!a) return { status: 404, error: 'Aanvraag niet gevonden.' };
    if (!(open(a) && past(a, s)) && !a.reacties.some(r => r.code === s.code))
      return { status: 403, error: 'Deze aanvraag valt buiten uw vak of werkgebied.' };
    const actor = { code: s.code, past: past(a, s), beleid };
    if (data.versie != null && a.laatste === opdracht(s.code, actie, data)) return { ok: true, aanvraag: publiek(a, actor) };
    const fout = levensloop.controle(a, actor, actie, data); if (fout) return fout;
    const tekst = schoon(data.tekst, 400), prijs = Math.max(0, Math.round(Number(data.prijs) || 0)) || null;
    if (['reageer', 'afronden', 'teruggeven'].includes(actie) && tekst.length < 3)
      return { status: 400, error: 'Schrijf een toelichting die het lid kan terugvinden.' };
    const eigen = a.reacties.find(r => r.code === s.code);
    if (actie === 'reageer' && !eigen && a.reacties.length >= MAX_REACTIES)
      return { status: 409, error: 'Deze aanvraag heeft het maximum aantal reacties.' };
    return schrijfAanvraag(a, actor, actie, () => {
      a.laatste = opdracht(s.code, actie, data);
      if (actie === 'reageer') {
        const r = { code: s.code, zaak: s.name, tekst, prijs, at: nu(), gekozen: false, ingetrokken: false };
        if (eigen) Object.assign(eigen, r); else a.reacties.push(r);
      }
      if (actie === 'intrekken') eigen.ingetrokken = true;
      if (actie === 'aanvaard') a.status = 'in_behandeling';
      if (actie === 'afronden') { a.status = 'afgerond'; a.resultaat = { tekst, door: s.name, at: nu() }; }
      if (actie === 'teruggeven') { a.status = 'open'; a.at = nu(); eigen.gekozen = false; eigen.ingetrokken = true; }
    }, tekst);
  }
  const api = { plaats, mijn, voorZaak, lidActie, zaakActie,
    sluit: (key, id, data, beleid) => lidActie(key, id, 'sluit', data, beleid),
    kies: (key, id, code, data = {}, beleid) => lidActie(key, id, 'kies', { ...data, code }, beleid),
    reageer: (s, id, data, beleid) => zaakActie(s, id, 'reageer', data, beleid),
    onbeantwoord: () => kijk().filter(a => open(a) && !a.reacties.some(r => !r.ingetrokken)),
    MAX_OPEN_PER_LID, DAGEN_GELDIG };
  ctx.aanvragen = api; return { mallAanvragen: api };
};
module.exports.MAX_OPEN_PER_LID = MAX_OPEN_PER_LID;
module.exports.DAGEN_GELDIG = DAGEN_GELDIG;
