/* Genootschap: besloten groepen van leden, met een prikbord en bijeenkomsten.

   WAAROM DIT EEN NIEUWE APP IS EN GEEN VERBOUWING.
   Het inventarisatiedocument stelde voor om Cercle de groepen-app te maken en
   de bijeenkomsten in Rendez-vous te zetten. Dat plan was op de NAMEN geschreven,
   niet op de code. In werkelijkheid is:
   - Cercle het register van je besloten societeiten: per club je lidnummer, de
     dresscode, met welke clubs er reciprociteit is en hoeveel gastpassen je nog
     hebt. Een eigen, doordacht jetset-idee.
   - Rendez-vous de besloten datingdienst van de Lifestyle Pass, met wensen,
     wederzijdse likes en een date-voorstel van Rahul.
   Beide verbouwen zou twee werkende concepten slopen om een derde te maken. De
   groepen-laag bestond echt nog niet (er is geen db.data.groepen; het bestaande
   /api/event/rsvp is de gastenlijst van een PARTNER, niet van een lid), dus die
   komt hier, in een eigen huis.

   Drie regels die dit anders maken dan een groep op Facebook:
   1. DRIE SOORTEN ZICHTBAARHEID, en geheim betekent echt geheim: een geheim
      genootschap staat in geen enkele lijst en is alleen met een uitnodiging te
      vinden. Niet "onvindbaar tenzij je de link hebt", maar niet-bestaand voor
      wie er niet in zit.
   2. GEEN GROEITRUC. Geen "leden die je misschien kent", geen suggesties, geen
      teller die om leden vraagt. Je nodigt uit wie je kent, of niemand.
   3. ALLES OP CODENAAM. Ook de beheerder ziet codenamen; er is geen route die
      een echte naam teruggeeft (die weg loopt alleen via kern/metier/bewijs.js,
      met toestemming per werkgever). */
const { keur } = require('../veilig');

module.exports = ({ db, save, codenaamVan, keyVanCodenaam, liveCodename, notify, zijnVrienden }) => {
  const NAAM_MAX = 70, OVER_MAX = 600, REGELS_MAX = 800;
  const MAX_PER_LID = 60;          // genootschappen waar je in kunt zitten
  const MAX_LEDEN = 500;
  const SOORTEN = ['openbaar', 'besloten', 'geheim'];
  const nu = () => new Date().toISOString();

  function S() {
    if (!db.data.genootschap || typeof db.data.genootschap !== 'object') db.data.genootschap = {};
    const g = db.data.genootschap;
    if (!Array.isArray(g.groepen)) g.groepen = [];
    for (const k of ['prikbord', 'bijeenkomst']) if (!g[k] || typeof g[k] !== 'object') g[k] = {};
    return g;
  }

  const groepMet = (id) => { const g = S(); return g.groepen.find(x => String(x.id) === String(id)) || null; };
  const lidRegel = (gr, key) => (gr.leden || []).find(l => l.key === key) || null;
  const isLid = (gr, key) => !!lidRegel(gr, key);
  const isBeheer = (gr, key) => { const l = lidRegel(gr, key); return !!(l && l.rol === 'beheerder'); };

  function nieuwId() {
    const g = S();
    let id = Date.now();
    while (g.groepen.some(x => x.id === id)) id++;
    return id;
  }

  async function keyVan(wie) {
    const c = String(wie || '').trim();
    if (!c || !keyVanCodenaam) return null;
    try { const t = await keyVanCodenaam(c); return (t && t.key) || null; } catch (e) { return null; }
  }

  /* Een genootschap oprichten. De oprichter is meteen beheerder; een groep zonder
     beheerder bestaat niet, want dan kan niemand hem nog opruimen. */
  function richtOp(sess, invoer) {
    const g = S();
    const v = invoer || {};
    const naam = String(v.naam || '').slice(0, NAAM_MAX).trim();
    if (!naam) return { error: 'Hoe heet het genootschap?' };
    const k = keur(naam); if (!k.ok) return { error: k.reden };
    const soort = SOORTEN.includes(v.soort) ? v.soort : 'besloten';
    const over = String(v.over || '').slice(0, OVER_MAX).trim();
    if (over) { const ko = keur(over); if (!ko.ok) return { error: ko.reden }; }
    const regels = String(v.regels || '').slice(0, REGELS_MAX).trim();
    if (regels) { const kr = keur(regels); if (!kr.ok) return { error: kr.reden }; }
    if (mijne(sess.key).length >= MAX_PER_LID) return { error: 'Je zit in het maximum aantal genootschappen.' };

    const gr = {
      id: nieuwId(), naam, soort, over, regels, at: nu(),
      leden: [{ key: sess.key, rol: 'beheerder', sinds: nu() }],
      uitnodigingen: []
    };
    g.groepen.unshift(gr);
    save();
    return { ok: true, groep: publiek(gr, sess.key) };
  }

  function pasAan(sess, id, invoer) {
    const gr = groepMet(id);
    if (!gr) return { error: 'Dit genootschap bestaat niet.' };
    if (!isBeheer(gr, sess.key)) return { error: 'Alleen een beheerder past dit aan.' };
    const v = invoer || {};
    for (const [veld, max] of [['naam', NAAM_MAX], ['over', OVER_MAX], ['regels', REGELS_MAX]]) {
      if (v[veld] === undefined) continue;
      const t = String(v[veld] || '').slice(0, max).trim();
      if (t) { const k = keur(t); if (!k.ok) return { error: k.reden }; }
      if (veld === 'naam' && !t) return { error: 'Een genootschap zonder naam kan niet.' };
      gr[veld] = t;
    }
    /* DE ZICHTBAARHEID KAN ALLEEN DICHTER, NOOIT OPENER.

       SOORTEN staat op volgorde van open naar dicht (openbaar, besloten,
       geheim), dus "dichter" is simpelweg een hogere plek in die lijst.

       Waarom deze kant op eenrichtingsverkeer is: wie zich bij een GEHEIM
       genootschap aansluit, doet dat onder die beslotenheid. Kon het bestuur
       daarna op "openbaar" klikken, dan staat diezelfde persoon opeens in een
       lijst die iedereen kan doorzoeken -- zonder dat hem iets gevraagd is, en
       zonder dat hij het merkt. Dat is precies het soort stille verschuiving
       waar het codenaam-ontwerp van dit huis tegen bedoeld is.

       Andersom is er geen bezwaar: een groep dichttrekken neemt niemand iets
       af. Wil een bestuur echt naar buiten, dan richten ze een openbaar
       genootschap op en nodigen ze hun leden uit -- dan zegt ieder zelf ja. */
    if (v.soort !== undefined && SOORTEN.includes(v.soort)) {
      const nu = SOORTEN.indexOf(gr.soort) < 0 ? SOORTEN.indexOf('besloten') : SOORTEN.indexOf(gr.soort);
      if (SOORTEN.indexOf(v.soort) < nu)
        return { error: 'Een genootschap kan alleen beslotener worden, niet opener. Wie zich onder beslotenheid aansloot, wordt niet achteraf zichtbaar.' };
      gr.soort = v.soort;
    }
    save();
    return { ok: true, groep: publiek(gr, sess.key) };
  }

  /* Uitnodigen. Bij een openbaar genootschap kan iemand zelf binnenlopen; bij
     besloten en geheim moet je uitgenodigd zijn. Een uitnodiging is een naam op
     een lijst, geen automatisch lidmaatschap: de ander zegt zelf ja. */
  async function nodigUit(sess, id, wie) {
    const gr = groepMet(id);
    if (!gr) return { error: 'Dit genootschap bestaat niet.' };
    if (!isLid(gr, sess.key)) return { error: 'Je bent hier geen lid van.' };
    if (gr.soort !== 'openbaar' && !isBeheer(gr, sess.key)) return { error: 'In dit genootschap nodigt een beheerder uit.' };
    const doel = await keyVan(wie);
    if (!doel) return { error: 'Dit lid ken ik niet.' };
    if (isLid(gr, doel)) return { error: 'Dit lid zit er al in.' };
    if ((gr.leden || []).length >= MAX_LEDEN) return { error: 'Dit genootschap is vol.' };
    if (!gr.uitnodigingen.includes(doel)) gr.uitnodigingen.push(doel);
    save();
    try { if (notify) notify(doel, 'Je bent uitgenodigd voor een genootschap: ' + gr.naam); } catch (e) {}
    return { ok: true, uitgenodigd: codenaamVan(doel) };
  }

  function tredBinnen(sess, id) {
    const gr = groepMet(id);
    if (!gr) return { error: 'Dit genootschap bestaat niet.' };
    if (isLid(gr, sess.key)) return { ok: true, al: true };
    const uitgenodigd = (gr.uitnodigingen || []).includes(sess.key);
    if (gr.soort !== 'openbaar' && !uitgenodigd) return { error: 'Dit genootschap is op uitnodiging.' };
    if ((gr.leden || []).length >= MAX_LEDEN) return { error: 'Dit genootschap is vol.' };
    gr.leden.push({ key: sess.key, rol: 'lid', sinds: nu() });
    gr.uitnodigingen = (gr.uitnodigingen || []).filter(k => k !== sess.key);
    save();
    return { ok: true, groep: publiek(gr, sess.key) };
  }

  /* Vertrekken. De laatste beheerder kan niet weg zonder eerst iemand anders
     beheerder te maken -- anders blijft er een groep achter die niemand meer
     kan opruimen. */
  function vertrek(sess, id) {
    const gr = groepMet(id);
    if (!gr) return { error: 'Dit genootschap bestaat niet.' };
    if (!isLid(gr, sess.key)) return { error: 'Je bent hier geen lid van.' };
    const beheerders = (gr.leden || []).filter(l => l.rol === 'beheerder');
    if (beheerders.length === 1 && beheerders[0].key === sess.key && gr.leden.length > 1) {
      return { error: 'Je bent de enige beheerder. Maak eerst iemand anders beheerder.' };
    }
    gr.leden = (gr.leden || []).filter(l => l.key !== sess.key);
    if (!gr.leden.length) {
      const g = S();
      g.groepen = g.groepen.filter(x => x.id !== gr.id);
      delete g.prikbord[gr.id];
      delete g.bijeenkomst[gr.id];
    }
    save();
    return { ok: true };
  }

  // Wat een lid van een genootschap ziet. Codenamen, nooit sleutels.
  function publiek(gr, key) {
    const lid = lidRegel(gr, key);
    return {
      id: gr.id, naam: gr.naam, soort: gr.soort, over: gr.over || '', regels: gr.regels || '',
      at: gr.at, leden: (gr.leden || []).length,
      mijnRol: lid ? lid.rol : null, ikBenLid: !!lid,
      uitgenodigd: !lid && (gr.uitnodigingen || []).includes(key),
      ledenlijst: lid ? (gr.leden || []).map(l => ({ codenaam: codenaamVan(l.key), rol: l.rol, sinds: l.sinds, ikZelf: l.key === key })) : []
    };
  }

  const mijne = (key) => S().groepen.filter(gr => isLid(gr, key));

  /* Mijn genootschappen, plus de uitnodigingen die er voor mij liggen. */
  function mijn(sess) {
    const key = sess.key;
    const g = S();
    return {
      ok: true,
      groepen: mijne(key).map(gr => publiek(gr, key)),
      uitnodigingen: g.groepen.filter(gr => (gr.uitnodigingen || []).includes(key)).map(gr => publiek(gr, key))
    };
  }

  /* Zoeken. Openbaar en besloten genootschappen zijn te vinden (bij besloten
     zie je dat het bestaat en wie het beheert, niet wat er staat). GEHEIM komt
     hier nooit uit: dat is het verschil tussen besloten en geheim. */
  function zoek(sess, opties) {
    const g = S();
    const o = opties || {};
    const vraag = String(o.zoek || '').trim().toLowerCase().slice(0, 60);
    const uit = [];
    for (const gr of g.groepen) {
      if (gr.soort === 'geheim' && !isLid(gr, sess.key)) continue;
      if (vraag && !(gr.naam + ' ' + (gr.over || '')).toLowerCase().includes(vraag)) continue;
      uit.push({ id: gr.id, naam: gr.naam, soort: gr.soort, over: gr.over || '',
        leden: (gr.leden || []).length, ikBenLid: isLid(gr, sess.key),
        uitgenodigd: (gr.uitnodigingen || []).includes(sess.key) });
      if (uit.length >= 40) break;
    }
    return { ok: true, groepen: uit };
  }

  return { S, groepMet, isLid, isBeheer, lidRegel, publiek, mijne,
    richtOp, pasAan, nodigUit, tredBinnen, vertrek, mijn, zoek, SOORTEN, MAX_LEDEN };
};
