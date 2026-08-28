/* RTMAIL (deelmodule): het postvak zelf -- mappen, labels, favorieten,
   sluimeren en zoeken.

   WAAROM DIT EEN EIGEN LAAG IS EN NIET IN rtmail.js STAAT. Tot nu toe kende een
   bericht maar EEN toestand: gelezen of niet. Dat werkte zolang post alleen
   binnenkwam. Zodra iemand hem opbergt, een etiket geeft of laat sluimeren,
   krijgt hetzelfde bericht twee toestanden -- een bij de afzender en een bij de
   ontvanger -- en dan is "een vlaggetje op het bericht" gewoon fout.

   DE FOUT DIE HIER WORDT VOORKOMEN. Een bericht tussen twee postvakken van dit
   huis is EEN rij in de opslag. Zou het opbergen als `m.map = 'archief'` op die
   rij staan, dan verdwijnt hij bij de archivering door de ontvanger OOK uit de
   verzonden-map van de afzender. Daarom hangt de toestand hier per BUS:

       m.vak = { 'goudenpanter': { map, labels, favoriet, sluimert }, ... }

   De sleutel is de bus-sleutel uit rtmail-adres.js (het linkerdeel zonder
   streepjes), dezelfde die bepaalt of post aankomt. Zo blijft er ook na een
   overstap van RTG Pass naar Lifestyle Pass EEN postvak, met EEN archief.

   WAT HIER BEWUST NIET IN ZIT: een map die post ONZICHTBAAR maakt voor het
   bestuur. Prullenbak is een MAP, geen vernietiging -- wat er echt uitgaat,
   gaat via het bewaarbeleid en laat een spoor na (kern/rtmail-bestuur.js). Een
   mailsysteem waarin "weg" soms echt weg is en soms niet, is bij een juridisch
   onderzoek onbruikbaar. */
const adresLaag = require('./rtmail-adres');

const MAPPEN = ['in', 'archief', 'prullenbak'];
const MAX_LABELS = 12;

module.exports = ({ db, save, rtmail }) => {
  const store = () => {
    if (!db.data.rtmail || !Array.isArray(db.data.rtmail.berichten)) db.data.rtmail = { berichten: [] };
    return db.data.rtmail;
  };
  const bus = (adres) => {
    const o = adresLaag.ontleed(adres);
    return o.binnenshuis ? String(o.lokaal || '').replace(/[.-]/g, '') : String(o.adres || '');
  };
  const schoon = (s, n) => String(s == null ? '' : s).replace(/[<>]/g, '').trim().slice(0, n || 40);

  /* De toestand van EEN bericht in EEN postvak. Maakt hem aan bij de eerste
     handeling; een bericht waar nooit iets mee is gedaan draagt dus ook geen
     lege administratie mee. */
  function vakVan(m, adres, maken) {
    const k = bus(adres);
    if (!k) return null;
    if (!m.vak || typeof m.vak !== 'object') { if (!maken) return null; m.vak = {}; }
    if (!m.vak[k]) { if (!maken) return null; m.vak[k] = { map: 'in', labels: [], favoriet: false, sluimert: null }; }
    return m.vak[k];
  }

  /* Waar staat dit bericht voor dit postvak? Zonder administratie is dat 'in'
     voor ontvangen post en 'uit' voor verzonden post -- afgeleid, niet
     opgeslagen, want anders zou elk oud bericht eerst gemigreerd moeten worden. */
  function mapVan(m, adres) {
    const v = vakVan(m, adres, false);
    if (v && v.map) return v.map;
    return adresLaag.zelfdeBus(m.naar, adres) ? 'in' : 'uit';
  }

  // Sluimeren is voorbij zodra de tijd om is; dat rekenen we uit en slaan we
  // niet op, zodat er geen wekker hoeft te lopen die een keer kan uitvallen.
  const sluimertNog = (v, nu) => !!(v && v.sluimert && v.sluimert > nu);

  /* Mag dit adres bij dit bericht? Ontvanger EN afzender mogen erbij -- de een
     voor zijn postvak, de ander voor zijn verzonden map. Iemand anders nooit. */
  function mijn(m, adres) {
    return adresLaag.zelfdeBus(m.naar, adres) || adresLaag.zelfdeBus(m.van, adres);
  }
  function zoekBericht(id, adres) {
    const m = store().berichten.find(x => x.id === id);
    if (!m) return { error: 'Dit bericht bestaat niet.' };
    if (!mijn(m, adres)) return { error: 'Dit bericht staat niet in dit postvak.' };
    return { m };
  }

  const publiek = (m, adres, nu) => {
    const v = vakVan(m, adres, false);
    return Object.assign({}, rtmail.publiek ? rtmail.publiek(m) : m, {
      vak: undefined,
      map: mapVan(m, adres),
      labels: (v && v.labels) || [],
      favoriet: !!(v && v.favoriet),
      sluimert: sluimertNog(v, nu) ? v.sluimert : null
    });
  };

  /* Een lijst uit een map. `in` verbergt wat sluimert (dat is de hele belofte
     van sluimeren) en toont het weer zodra de tijd om is. */
  function lijst(adres, { map = 'in', label = '', limit = 60 } = {}) {
    const nu = new Date().toISOString();
    const mp = MAPPEN.includes(map) ? map : (map === 'uit' ? 'uit' : 'in');
    const lab = schoon(label, 40).toLowerCase();
    const uit = [];
    for (const m of store().berichten) {
      if (!mijn(m, adres)) continue;
      if (mapVan(m, adres) !== mp) continue;
      const v = vakVan(m, adres, false);
      if (mp === 'in' && sluimertNog(v, nu)) continue;
      if (lab && !((v && v.labels) || []).some(x => x.toLowerCase() === lab)) continue;
      uit.push(publiek(m, adres, nu));
      if (uit.length >= Math.max(1, Math.min(200, limit))) break;
    }
    return uit;
  }

  // De tellingen naast de mappen. Sluimerende post telt niet mee in 'in', want
  // anders staat er een getal bij een map waar niets te zien is.
  function tellingen(adres) {
    const nu = new Date().toISOString();
    const t = { in: 0, ongelezen: 0, uit: 0, archief: 0, prullenbak: 0, sluimert: 0, favoriet: 0 };
    for (const m of store().berichten) {
      if (!mijn(m, adres)) continue;
      const v = vakVan(m, adres, false);
      const mp = mapVan(m, adres);
      if (mp === 'in' && sluimertNog(v, nu)) { t.sluimert++; continue; }
      if (t[mp] != null) t[mp]++;
      if (mp === 'in' && !m.gelezen && adresLaag.zelfdeBus(m.naar, adres)) t.ongelezen++;
      if (v && v.favoriet) t.favoriet++;
    }
    return t;
  }

  /* Verplaatsen. Naar 'in' terugzetten wist meteen het sluimeren -- anders
     haalt iemand een bericht uit het archief en blijft het onzichtbaar. */
  function verplaats(adres, id, map) {
    const r = zoekBericht(id, adres);
    if (r.error) return r;
    if (!MAPPEN.includes(map)) return { error: 'Deze map bestaat niet.' };
    const v = vakVan(r.m, adres, true);
    if (!v) return { error: 'Dit postvak is niet te bepalen.' };
    v.map = map;
    if (map === 'in') v.sluimert = null;
    save();
    return { ok: true, id, map };
  }

  function etiket(adres, id, label, aan) {
    const r = zoekBericht(id, adres);
    if (r.error) return r;
    const l = schoon(label, 40);
    if (!l) return { error: 'Geef een etiket op.' };
    const v = vakVan(r.m, adres, true);
    if (!v) return { error: 'Dit postvak is niet te bepalen.' };
    v.labels = (v.labels || []).filter(x => x.toLowerCase() !== l.toLowerCase());
    if (aan !== false) {
      if (v.labels.length >= MAX_LABELS) return { error: 'Meer dan ' + MAX_LABELS + ' etiketten op een bericht wordt onleesbaar.' };
      v.labels.push(l);
    }
    save();
    return { ok: true, id, labels: v.labels };
  }

  function ster(adres, id, aan) {
    const r = zoekBericht(id, adres);
    if (r.error) return r;
    const v = vakVan(r.m, adres, true);
    if (!v) return { error: 'Dit postvak is niet te bepalen.' };
    v.favoriet = aan !== false;
    save();
    return { ok: true, id, favoriet: v.favoriet };
  }

  /* Sluimeren: het bericht verdwijnt uit 'in' tot een tijdstip. Een tijdstip in
     het verleden weigeren we -- dat zou een sluimering zijn die niets doet, en
     dan denkt iemand dat het gelukt is. */
  function sluimer(adres, id, tot) {
    const r = zoekBericht(id, adres);
    if (r.error) return r;
    const t = new Date(tot);
    if (isNaN(t.getTime())) return { error: 'Dat is geen tijdstip.' };
    if (t.toISOString() <= new Date().toISOString()) return { error: 'Sluimeren tot een moment in het verleden doet niets.' };
    const v = vakVan(r.m, adres, true);
    if (!v) return { error: 'Dit postvak is niet te bepalen.' };
    v.sluimert = t.toISOString();
    if (v.map !== 'in') v.map = 'in';   // sluimeren betekent: komt terug in de inbox
    save();
    return { ok: true, id, sluimert: v.sluimert };
  }

  /* Zoeken. BINNEN EEN POSTVAK, altijd -- de filter op `mijn()` staat vóór de
     tekstvergelijking en niet erna, zodat een zoekopdracht nooit een bericht
     kan aanraken waar dit adres niets te zoeken heeft. */
  function zoek(adres, vraag, { map = '', limit = 40 } = {}) {
    const q = String(vraag == null ? '' : vraag).trim().toLowerCase().slice(0, 120);
    if (!q) return { error: 'Waar zoekt u naar?' };
    const nu = new Date().toISOString();
    const woorden = q.split(/\s+/).filter(Boolean).slice(0, 6);
    const uit = [];
    for (const m of store().berichten) {
      if (!mijn(m, adres)) continue;
      if (map && mapVan(m, adres) !== map) continue;
      const v = vakVan(m, adres, false);
      const hooi = [m.van, m.naar, m.onderwerp, m.tekst, m.soort, ((v && v.labels) || []).join(' ')]
        .join(' ').toLowerCase();
      if (!woorden.every(w => hooi.includes(w))) continue;
      uit.push(publiek(m, adres, nu));
      if (uit.length >= Math.max(1, Math.min(100, limit))) break;
    }
    return { ok: true, vraag: q, aantal: uit.length, berichten: uit };
  }

  return { MAPPEN, lijst, tellingen, verplaats, etiket, ster, sluimer, zoek, mapVan, mijn, publiek, bus };
};
