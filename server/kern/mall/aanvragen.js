/* RTG Mall, deelbestand "aanvragen": DE VRAAGKANT.

   Een zoekmachine kan alleen vinden wat er staat. "Ik heb morgen een fotograaf
   nodig op Ibiza van 14:00 tot 18:00" levert nul treffers zolang geen fotograaf
   zichzelf heeft aangemeld -- en die nul is geen antwoord maar een gemiste
   markt. Een lid plaatst hier zijn vraag; de zaken die hem kunnen bedienen zien
   hem en reageren.

   DRIE DINGEN DIE DIT BEWUST NIET DOET:

   1. Geen veiling. Zaken reageren met wat zij kunnen en wat het kost; er is
      geen aftellende klok en geen "nog 2 plekken". Dat zijn de patronen die
      CLAUDE.md verbiedt, en ze horen hier het minst thuis: wie een loodgieter
      zoekt is al gehaast genoeg.
   2. Geen automatische gunning. Het lid kiest zelf, of kiest niet. Een aanvraag
      die niets oplevert vervalt gewoon.
   3. Geen adres in de open aanvraag. Een zaak ziet de plek en wat er nodig is,
      niet waar iemand woont; het lid deelt zelf wat het wil zodra het een
      reactie kiest. Een openstaande vraag is voor meerdere zaken zichtbaar, en
      dan hoort er niet in te staan wanneer iemand niet thuis is.

   WIE ZIET WELKE AANVRAAG. Alleen zaken die hem kunnen bedienen: het genre moet
   passen bij de gevraagde verdieping, en de plek moet binnen het servicegebied
   van de zaak vallen (kern/mall/plek.js). Zo krijgt een kapper in Haarlem geen
   loodgietersklus op Ibiza in zijn scherm. */

const MAX_OPEN_PER_LID = 10;
const MAX_REACTIES = 25;
const DAGEN_GELDIG = 30;

module.exports = (ctx) => {
  const { db, save, crypto, plek } = ctx;
  const nu = () => new Date().toISOString();
  const schoon = (v, n) => String(v == null ? '' : v).replace(/[<>]/g, '').trim().slice(0, n);
  const isDatum = (d) => /^\d{4}-\d{2}-\d{2}$/.test(String(d || ''));
  const { VERDIEPINGEN } = require('./aanbodvorm');
  const { GENRE_VERDIEPING } = require('./aanbodvorm');

  function bak() {
    if (!Array.isArray(db.data.mallAanvragen)) db.data.mallAanvragen = [];
    return db.data.mallAanvragen;
  }
  const verlopen = (a) => (Date.now() - new Date(a.at).getTime()) > DAGEN_GELDIG * 86400000;
  const open = (a) => a.status === 'open' && !verlopen(a);

  /* Een lid plaatst een vraag. De verdieping bepaalt wie hem ziet; zonder
     verdieping zou elke zaak alles krijgen en is het scherm binnen een week
     een prullenbak die niemand meer opent. */
  function plaatsAanvraag(key, codename, data) {
    data = data || {};
    const lijst = bak();
    const mijnOpen = lijst.filter(a => a.key === key && open(a)).length;
    if (mijnOpen >= MAX_OPEN_PER_LID) return { status: 409, error: 'U heeft al ' + MAX_OPEN_PER_LID + ' openstaande aanvragen. Sluit er eerst een.' };
    const wat = schoon(data.wat, 300);
    if (wat.length < 5) return { status: 400, error: 'Schrijf kort wat u zoekt.' };
    const verdieping = VERDIEPINGEN.some(v => v.id === data.verdieping) ? data.verdieping : null;
    if (!verdieping) return { status: 400, error: 'Kies waar dit bij hoort, zodat alleen de juiste zaken uw vraag zien.' };
    const plaatsNaam = schoon(data.plek, 40);
    if (!plaatsNaam) return { status: 400, error: 'Geef de plaats op waar het moet gebeuren.' };
    const a = {
      id: crypto.randomBytes(5).toString('hex'),
      key, codename: codename || 'Lid',
      wat, verdieping,
      plek: plek.plekVan({ stad: plaatsNaam }),
      wanneer: isDatum(data.wanneer) ? data.wanneer : null,
      budget: Math.max(0, Math.round(Number(data.budget) || 0)) || null,
      status: 'open', reacties: [], at: nu()
    };
    lijst.unshift(a);
    db.data.mallAanvragen = lijst.slice(0, 5000);
    save();
    return { ok: true, aanvraag: publiekeAanvraag(a, true) };
  }

  // de vorm voor het lid (eigen) of voor een zaak (zonder de sleutel van het lid)
  function publiekeAanvraag(a, eigen) {
    return {
      id: a.id, wat: a.wat, verdieping: a.verdieping,
      plek: a.plek.stad, wanneer: a.wanneer, budget: a.budget,
      status: verlopen(a) ? 'verlopen' : a.status,
      van: eigen ? 'u' : a.codename,
      reacties: (a.reacties || []).map(r => ({
        code: r.code, zaak: r.zaak, tekst: r.tekst, prijs: r.prijs, at: r.at,
        gekozen: !!r.gekozen
      })),
      aantalReacties: (a.reacties || []).length,
      at: a.at
    };
  }

  function mijn(key) {
    return { ok: true, aanvragen: bak().filter(a => a.key === key).slice(0, 50).map(a => publiekeAanvraag(a, true)) };
  }

  function sluit(key, id) {
    const a = bak().find(x => x.id === String(id || '') && x.key === key);
    if (!a) return { status: 404, error: 'Aanvraag niet gevonden.' };
    a.status = 'gesloten';
    save();
    return { ok: true, aanvraag: publiekeAanvraag(a, true) };
  }

  /* Het lid kiest een reactie. Er wordt NIETS geboekt en niets betaald: de zaak
     krijgt te horen dat zij het mag doen en neemt vanaf daar contact op via de
     gewone weg. Doen alsof dit een boeking is, zou een afspraak beloven die
     niemand heeft bevestigd. */
  function kies(key, id, code) {
    const a = bak().find(x => x.id === String(id || '') && x.key === key);
    if (!a) return { status: 404, error: 'Aanvraag niet gevonden.' };
    const r = (a.reacties || []).find(x => x.code === String(code || ''));
    if (!r) return { status: 404, error: 'Deze reactie staat niet bij uw aanvraag.' };
    a.reacties.forEach(x => { x.gekozen = x.code === r.code; });
    a.status = 'gegund';
    save();
    return { ok: true, aanvraag: publiekeAanvraag(a, true),
      opmerking: r.zaak + ' krijgt bericht en neemt contact met u op. Er is nog niets geboekt of betaald.' };
  }

  /* Wat een zaak te zien krijgt: alleen open aanvragen in haar eigen vak en
     binnen haar servicegebied. Een zaak zonder passend genre ziet er geen. */
  function aanvragenVoorZaak(s) {
    const mijnVerdieping = GENRE_VERDIEPING[s.type] || null;
    const bereik = plek.bereikVan(s);
    const mijnPlek = plek.plekVan({ stad: s.city, land: s.country, punt: s.loc });
    const past = (a) => {
      if (!mijnVerdieping || a.verdieping !== mijnVerdieping) return false;
      // hergebruikt exact de bereikregel van de Mall zelf
      return plek.bedient({ plek: mijnPlek, bereik }, a.plek);
    };
    const lijst = bak().filter(a => open(a) && past(a));
    return {
      ok: true,
      verdieping: mijnVerdieping,
      bereik,
      aanvragen: lijst.slice(0, 50).map(a => publiekeAanvraag(a, false)),
      aantal: lijst.length,
      opmerking: mijnVerdieping
        ? 'Aanvragen uit ' + (VERDIEPINGEN.find(v => v.id === mijnVerdieping) || {}).label + ' binnen uw werkgebied.'
        : 'Uw genre hoort nog bij geen enkele verdieping, dus u ziet hier geen aanvragen. Meld dat, dan hoort het genre erbij.'
    };
  }

  /* Een zaak reageert. Een reactie per zaak per aanvraag: wie zich bedenkt
     wijzigt zijn eigen reactie in plaats van er een tweede naast te zetten. */
  function reageerOpAanvraag(s, id, data) {
    data = data || {};
    const a = bak().find(x => x.id === String(id || ''));
    if (!a || !open(a)) return { status: 404, error: 'Deze aanvraag staat niet meer open.' };
    const zicht = aanvragenVoorZaak(s);
    if (!zicht.aanvragen.some(x => x.id === a.id)) return { status: 403, error: 'Deze aanvraag valt buiten uw vak of werkgebied.' };
    const tekst = schoon(data.tekst, 400);
    if (tekst.length < 3) return { status: 400, error: 'Schrijf kort wat u kunt bieden.' };
    if (!Array.isArray(a.reacties)) a.reacties = [];
    if (a.reacties.length >= MAX_REACTIES && !a.reacties.some(r => r.code === s.code))
      return { status: 409, error: 'Deze aanvraag heeft het maximum aantal reacties.' };
    const prijs = Math.max(0, Math.round(Number(data.prijs) || 0)) || null;
    const bestaand = a.reacties.find(r => r.code === s.code);
    if (bestaand) { bestaand.tekst = tekst; bestaand.prijs = prijs; bestaand.at = nu(); }
    else a.reacties.push({ code: s.code, zaak: s.name, tekst, prijs, at: nu(), gekozen: false });
    save();
    return { ok: true, aanvraag: publiekeAanvraag(a, false) };
  }

  /* Wat er gevraagd wordt en niet geleverd: aanvragen zonder een enkele
     reactie, per verdieping en plaats. Dit is de eerlijkste vorm van
     marktinformatie die er is -- iemand heeft de moeite genomen het te vragen
     en kreeg niets. Voedt de kansenlaag (kern/mall/vraagbeeld.js). */
  function onbeantwoord() {
    return bak().filter(a => open(a) && !(a.reacties || []).length);
  }

  const api = { plaats: plaatsAanvraag, mijn, sluit, kies, voorZaak: aanvragenVoorZaak,
    reageer: reageerOpAanvraag, onbeantwoord, MAX_OPEN_PER_LID, DAGEN_GELDIG };
  ctx.aanvragen = api;
  return { mallAanvragen: api };
};

module.exports.MAX_OPEN_PER_LID = MAX_OPEN_PER_LID;
module.exports.DAGEN_GELDIG = DAGEN_GELDIG;
