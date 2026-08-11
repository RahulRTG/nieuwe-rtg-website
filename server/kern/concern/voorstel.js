/* CONCERN (deelmodule): DOCUMENT INTELLIGENCE EN DISCOVERY. Stap 9.

   WAT UIT EEN DOCUMENT KOMT IS EEN VOORSTEL, NOOIT EEN FEIT. Dat is de hele
   module in een zin, en het is wet 4 en wet 5 tegelijk uit CONCERN.md: de AI
   mag juridische gegevens extraheren, vergelijken, structureren en signaleren
   -- zij mag nooit juridische geldigheid VERZINNEN.

   Daarom schrijft dit bestand niets. Het leest een tekst, zegt wat het denkt te
   herkennen, en geeft dat terug als een lijst kandidaten die elk apart moeten
   worden BEVESTIGD. Pas bij die bevestiging ontstaat er een feit, en dan met
   bron `document` -- de bron die in ./bron.js expliciet is omschreven als "uit
   een document gehaald EN door een mens bevestigd". Die formulering stond daar
   al voordat deze module bestond, en zij wachtte precies hierop.

   HET IS NIET SLIM, EN DAT IS EERLIJKER DAN DOEN ALSOF. De herkenning is
   patroonwerk: een KvK-nummer is acht cijfers, een Nederlands BTW-nummer heeft
   een vaste vorm, een rechtsvorm is een woord uit een gesloten lijst. Waar een
   AI-sleutel aanwezig is kan die het beter, maar de UITKOMST verandert
   daardoor niet van soort: het blijft een voorstel dat een mens aanvinkt. Een
   betere extractie maakt de lijst korter, niet zekerder.

   ELKE KANDIDAAT DRAAGT ZIJN VINDPLAATS. "BTW-nummer NL001234567B01" zonder
   het zinsdeel waar het stond, is niet na te kijken -- en aanvinken zonder te
   kunnen nakijken is precies het blind bevestigen dat deze opzet wil
   voorkomen.

   DISCOVERY WERKT ANDERSOM EN MET DEZELFDE GRENS: uit wat RTG al WEET (de
   onderneming, de zaken, het personeel) een structuurvoorstel bouwen, zodat
   iemand met een bestaand bedrijf niet alles overtypt. Ook dat is een voorstel:
   het "wow, dit stond al klaar"-effect mag nooit betekenen dat er iets is
   vastgelegd wat niemand heeft gezien. */
'use strict';

const RV = require('../onderneming/rechtsvorm');

/* De patronen. Bewust conservatief: liever iets missen dan iets verzinnen --
   een gemist nummer typt iemand over, een verzonnen nummer wordt bevestigd. */
const PATRONEN = [
  { soort: 'registratie', label: 'Registratienummer (KvK)',
    re: /\b(?:kvk|handelsregister|kamer van koophandel)\D{0,20}(\d{8})\b/gi, groep: 1 },
  { soort: 'fiscaal', label: 'BTW-nummer', sleutel: 'btw',
    re: /\b(NL\s?\d{9}\s?B\s?\d{2})\b/gi, groep: 1 },
  { soort: 'fiscaal', label: 'BTW-nummer (EU)', sleutel: 'btw',
    re: /\b((?:BE|DE|FR|ES|IT|LU|AT|PT)\s?\d{8,12})\b/g, groep: 1 },
  { soort: 'zetel', label: 'Statutaire zetel',
    re: /\b(?:statutair(?:e)? (?:gevestigd te|zetel)|gevestigd te)\s*:?\s*([A-Z][\w' -]{2,40})/gi, groep: 1 }
];

/* Een datum in de vormen die in aktes staan. Los van PATRONEN omdat hij niet
   op zichzelf een feit is maar bij een ander feit hoort. */
const MAANDEN = { januari: '01', februari: '02', maart: '03', april: '04', mei: '05', juni: '06',
  juli: '07', augustus: '08', september: '09', oktober: '10', november: '11', december: '12' };

function datumUit(tekst) {
  const iso = tekst.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (iso) return iso[0];
  const nl = tekst.match(/\b(\d{1,2})[-/](\d{1,2})[-/](\d{4})\b/);
  if (nl) return nl[3] + '-' + String(nl[2]).padStart(2, '0') + '-' + String(nl[1]).padStart(2, '0');
  const woord = tekst.match(new RegExp('\\b(\\d{1,2})\\s+(' + Object.keys(MAANDEN).join('|') + ')\\s+(\\d{4})\\b', 'i'));
  if (woord) return woord[3] + '-' + MAANDEN[woord[2].toLowerCase()] + '-' + String(woord[1]).padStart(2, '0');
  return null;
}

module.exports = (ctx) => {
  const { crypto, schoon, entiteitVind, entiteitBeeld, tijdZet, tijdVandaag,
    ondernemingVind, vestigingAlleVanEntiteit, findSupplier } = ctx;

  function bak() {
    if (!ctx.db.data.concern || typeof ctx.db.data.concern !== 'object') ctx.db.data.concern = {};
    if (!ctx.db.data.concern.voorstellen || typeof ctx.db.data.concern.voorstellen !== 'object')
      ctx.db.data.concern.voorstellen = {};
    return ctx.db.data.concern.voorstellen;
  }

  /* Het zinsdeel rond een treffer, zodat een mens kan nakijken waar het vandaan
     komt. Zestig tekens aan weerszijden is genoeg om een regel te herkennen en
     te weinig om een heel document te lekken in een lijst met kandidaten. */
  const rondom = (tekst, i, lengte) =>
    ('…' + tekst.slice(Math.max(0, i - 60), i + lengte + 60).replace(/\s+/g, ' ').trim() + '…');

  /* ---- LEZEN: van tekst naar kandidaten ---- */
  function voorstelLees(e, tekst, opties) {
    const t = String(tekst || '');
    if (t.trim().length < 20) {
      return { status: 400, error: 'Er staat te weinig tekst in dit document om iets uit te halen.' };
    }
    if (t.length > 200000) return { status: 400, error: 'Dit document is te groot (max 200.000 tekens).' };

    const kandidaten = [];
    const gezien = new Set();
    const zet = (k) => {
      const sleutel = k.soort + ':' + k.waarde;
      if (gezien.has(sleutel)) return;
      gezien.add(sleutel);
      kandidaten.push(Object.assign({ id: 'kan_' + crypto.randomBytes(4).toString('hex') }, k));
    };

    for (const p of PATRONEN) {
      p.re.lastIndex = 0;
      let m;
      while ((m = p.re.exec(t)) !== null) {
        const waarde = String(m[p.groep]).replace(/\s+/g, '').trim();
        if (!waarde) continue;
        zet({ soort: p.soort, label: p.label, waarde,
          sleutel: p.sleutel || null, vindplaats: rondom(t, m.index, m[0].length) });
        if (kandidaten.length > 60) break;
      }
    }

    /* De rechtsvorm uit een gesloten lijst; nooit uit een gok. De langste match
       wint, anders herkent "besloten vennootschap" zich als "vennootschap". */
    const laag = t.toLowerCase();
    let besteVorm = null;
    for (const [id, v] of Object.entries(RV.RECHTSVORMEN)) {
      const woord = String(v.label).toLowerCase().replace(/\s*\(.*?\)\s*/g, '').trim();
      if (woord.length > 3 && laag.includes(woord) && (!besteVorm || woord.length > besteVorm.woord.length)) {
        besteVorm = { id, label: v.label, woord };
      }
    }
    if (besteVorm) zet({ soort: 'rechtsvorm', label: 'Rechtsvorm', waarde: besteVorm.id,
      toon: besteVorm.label, vindplaats: rondom(t, laag.indexOf(besteVorm.woord), besteVorm.woord.length) });

    const d = datumUit(t);
    if (d) zet({ soort: 'datum', label: 'Datum in het document', waarde: d,
      vindplaats: rondom(t, t.indexOf(d.slice(0, 4)) >= 0 ? t.indexOf(d.slice(0, 4)) : 0, 10),
      /* Een datum is GEEN feit op zichzelf: hij hoort bij een ander gegeven.
         Daarom staat hij erbij als voorstel voor de ingangsdatum en niet als
         iets wat je los kunt bevestigen. */
      alleenAlsIngang: true });

    const v = {
      id: 'vst_' + crypto.randomBytes(6).toString('hex'),
      entiteit: e.id, bron: schoon((opties || {}).bestand, 160) || 'document',
      at: new Date().toISOString(),
      kandidaten
    };
    bak()[v.id] = v;
    ctx.save();

    return { ok: true, voorstel: { id: v.id, bron: v.bron, kandidaten },
      /* De zin die op het scherm hoort te staan, en die de hele grens draagt. */
      kop: 'Gevonden uit document, bevestig',
      grens: 'Hier is nog niets vastgelegd. Wat u aanvinkt wordt een gegeven met bron "document"; wat u laat staan verdwijnt.',
      leeg: kandidaten.length === 0
        ? 'Wij herkennen hier niets met zekerheid. Dat betekent niet dat het document niets bevat -- alleen dat wij liever niets voorstellen dan iets verzinnen.'
        : null };
  }

  /* ---- BEVESTIGEN: van kandidaat naar feit ----
     Per stuk, en alleen wat de mens heeft aangewezen. Er is met opzet geen
     "bevestig alles"-ingang in de kern: dat zou het aanvinken tot een formaliteit
     maken, en dan is de bevestiging geen bevestiging meer. */
  function voorstelBevestig(e, voorstelId, keuzes, wie) {
    const v = bak()[String(voorstelId || '')];
    if (!v || v.entiteit !== e.id) return { status: 404, error: 'Dit voorstel bestaat niet.' };
    const gekozen = Array.isArray(keuzes) ? keuzes : [];
    if (!gekozen.length) return { status: 400, error: 'Er is niets aangevinkt.' };

    const uit = [], mislukt = [];
    const ingang = (v.kandidaten.find(k => k.soort === 'datum') || {}).waarde || undefined;

    for (const id of gekozen) {
      const k = v.kandidaten.find(x => x.id === id);
      if (!k) { mislukt.push({ id, error: 'onbekende kandidaat' }); continue; }
      if (k.alleenAlsIngang) continue;   // een datum is geen zelfstandig feit
      const r = tijdZet(e.id, k.soort, {
        waarde: k.waarde, sleutel: k.sleutel || (k.soort === 'registratie' ? e.land + ':' + k.waarde : undefined),
        van: ingang,
        bronSoort: 'document', bronDetail: v.bron, wie,
        extra: k.soort === 'registratie' ? { land: e.land, register: null } : null
      });
      if (r.ok) uit.push(r.feit); else mislukt.push({ id, error: r.error });
    }
    v.bevestigd = new Date().toISOString();
    ctx.save();
    return { ok: true, vastgelegd: uit.length, feiten: uit, mislukt,
      uitleg: uit.length + ' gegeven(s) vastgelegd met bron "document". Wat u niet aanvinkte is niet bewaard.' };
  }

  return Object.assign({ voorstelLees, voorstelBevestig },
    require('./discovery')(ctx));
};
