/* LANDPAKKETTEN -- een land aanzetten als configuratiebundel.

   WAT DIT WEL IS: een lijst van wat er nodig is om RTG in een land te laten
   werken, met per onderdeel of het er LIGT. De munt, de voertaal en de
   schakelkaststand komen uit LANDEN.json; de fiscale kennis, de muntschaal en
   de loontabellen komen uit wat het huis al heeft (kern/fiscaal/landen.js,
   kern/payroll/valuta.js, de regelpakketten). Dit bestand kopieert die kennis
   niet -- een tweede kopie beweert binnen een jaar iets anders dan de eerste.

   WAT DIT NIET IS: naleving. Een land aanzetten betekent niet dat RTG daar
   btw-plichtig geregistreerd is, dat er een loonaangifte loopt of dat een
   toezichthouder akkoord is. Die dingen staan per pakket als MENSENWERK, ze
   blijven mensenwerk, en ze verdwijnen niet uit de uitslag als je het pakket
   activeert. Een knop die "land actief" meldt terwijl er geen btw-nummer is,
   is de duurste knop van dit hele scherm.

   EN "AANZETTEN" IS HIER KLEIN. Het activeren schrijft de per-land-standen in
   de schakelkast (die as bestond al, zie server/functies/toegang.js) en verder
   niets. Het maakt geen zaken aan, geen tarieven en geen rekeningen. Wat het
   wel doet is de STAND opleveren: dit ligt er, dat niet, en dit blijft
   mensenwerk. */
'use strict';

const fs = require('fs');
const path = require('path');

const BESTAND = path.join(__dirname, '..', '..', '..', 'LANDEN.json');

/* Ontbreekt het bestand, dan gaat deze laag NIET stilletjes op nul staan. Een
   scherm dat "geen landen" toont omdat een bestand kwijt is, leest als "we
   werken nergens". Zelfde keuze als in ./slo.js en opzet/domeingrens.js. */
let onthouden = null;
function laad() {
  try {
    const st = fs.statSync(BESTAND);
    if (onthouden && onthouden.mtimeMs === st.mtimeMs) return onthouden.norm;
    const n = JSON.parse(fs.readFileSync(BESTAND, 'utf8'));
    if (!Array.isArray(n.pakketten)) throw new Error('geen pakketten');
    onthouden = { mtimeMs: st.mtimeMs, norm: n };
    return n;
  } catch (e) {
    throw new Error('landpakket: LANDEN.json is er niet of onleesbaar (' + e.message + '). ' +
      'Dat is de bron van de landinrichting; zonder dat bestand is er niets te activeren.');
  }
}

function maakLandpakket({ db, save, journaal, fiscaal, valuta, talen, functies }) {
  function staat() {
    db.data.techniek = db.data.techniek || {};
    return (db.data.techniek.functies = db.data.techniek.functies || {});
  }
  function actieve() {
    db.data.landen = db.data.landen || {};
    return db.data.landen;
  }

  const pakketVan = (land) => laad().pakketten.find(p => p.land === String(land || '').toUpperCase()) || null;

  /* De stand per onderdeel. Elk antwoord zegt WAAR het vandaan komt, want een
     lijstje vinkjes zonder bron is niet na te lopen. */
  function onderdelen(p) {
    const uit = [];
    const f = fiscaal && fiscaal.LANDEN ? fiscaal.LANDEN[p.land] : null;
    uit.push({ wat: 'fiscale kennis', bron: 'kern/fiscaal/landen.js',
      ligt: !!f, aard: 'gemeten',
      uitleg: f ? 'btw-tarieven, minimumuurloon en werkgeverslasten bekend (peiljaar ' +
        (fiscaal.FISCAAL_PEILJAAR || '?') + ')' : 'dit land staat niet in de fiscale tabel' });

    const munt = valuta && typeof valuta.keurValuta === 'function' ? valuta.keurValuta(p.valuta) : null;
    const muntOk = !(munt && munt.error) && (!valuta || typeof valuta.decimalenVan !== 'function' ||
      valuta.decimalenVan(p.valuta) != null);
    uit.push({ wat: 'munt', bron: 'kern/payroll/valuta.js', ligt: !!muntOk, aard: 'gemeten',
      uitleg: p.valuta + ' met ' + (valuta && valuta.decimalenVan ? valuta.decimalenVan(p.valuta) : '?') +
        ' decimalen in de kleinste eenheid' });

    /* De talen worden bij het KIJKEN opgehaald en niet bij het bouwen: een
       taal die vanmiddag wordt aangezet, hoort vanmiddag te tellen. */
    const t = typeof talen === 'function' ? talen() : talen;
    const actief = t && Array.isArray(t.actief) ? t.actief : [];
    uit.push({ wat: 'voertaal', bron: 'db.data.talen', ligt: actief.includes(p.taal), aard: 'gemeten',
      uitleg: actief.includes(p.taal) ? p.taal + ' is een actieve taal'
        : p.taal + ' staat niet in de actieve talen (' + actief.join(', ') + ')' });

    const st = staat();
    const dicht = Object.keys(st).filter(id => st[id] && st[id].perLand && st[id].perLand[p.land] === false);
    uit.push({ wat: 'schakelkast', bron: 'server/functies (per-land-as)', ligt: true, aard: 'gemeten',
      uitleg: dicht.length ? dicht.length + ' functie(s) staan hier dicht: ' + dicht.join(', ')
        : 'geen enkele functie staat in dit land dicht' });
    return uit;
  }

  function stand(land) {
    const norm = laad();
    if (!land) {
      return {
        pakketten: norm.pakketten.map(p => ({ land: p.land, naam: p.naam, valuta: p.valuta, taal: p.taal,
          actief: !!actieve()[p.land], mensenwerk: p.mensenwerk.length })),
        let: norm.let, vastgelegd: norm.vastgelegd, bestand: 'LANDEN.json'
      };
    }
    const p = pakketVan(land);
    if (!p) return { error: 'Geen landpakket voor ' + land + '.', status: 404 };
    const del = onderdelen(p);
    const a = actieve()[p.land] || null;
    return {
      land: p.land, naam: p.naam, valuta: p.valuta, taal: p.taal,
      onderdelen: del, ontbreekt: del.filter(d => !d.ligt).map(d => d.wat),
      mensenwerk: p.mensenwerk, actief: a,
      klaar: del.every(d => d.ligt),
      let: norm.let,
      waarschuwing: 'ook als hierboven alles ligt, is dit land niet "in orde": de mensenwerk-lijst ' +
        'blijft staan en verdwijnt niet door te activeren.'
    };
  }

  /* Activeren: de per-land-standen in de schakelkast zetten. Verder niets, en
     dat is met opzet -- zie de kop. */
  function activeer(land, door) {
    const p = pakketVan(land);
    if (!p) return { error: 'Geen landpakket voor ' + land + '.', status: 404 };
    const st = staat();
    const gezet = [];
    for (const id of (Array.isArray(p.sluit) ? p.sluit : [])) {
      if (functies && functies.OP_ID && !functies.OP_ID[id]) continue;
      const cur = (st[id] = st[id] || {});
      cur.perLand = cur.perLand || {};
      cur.perLand[p.land] = false;
      gezet.push(id);
    }
    actieve()[p.land] = { at: new Date().toISOString(), door: String(door || 'onbekend'), gezet };
    save();
    if (journaal) {
      journaal.noteer({ actie: 'landpakket geactiveerd', actor: door, niveau: 'hand',
        objectType: 'land', objectId: p.land,
        reden: gezet.length + ' functie(s) dicht; ' + p.mensenwerk.length + ' punten blijven mensenwerk' });
    }
    return Object.assign(stand(p.land), { zojuistGezet: gezet });
  }

  function terug(land, door) {
    const p = pakketVan(land);
    if (!p) return { error: 'Geen landpakket voor ' + land + '.', status: 404 };
    const a = actieve()[p.land];
    if (!a) return { error: 'Dat land staat niet aan.', status: 404 };
    const st = staat();
    for (const id of (a.gezet || [])) {
      if (st[id] && st[id].perLand) delete st[id].perLand[p.land];
    }
    delete actieve()[p.land];
    save();
    if (journaal) journaal.noteer({ actie: 'landpakket teruggedraaid', actor: door, niveau: 'hand',
      objectType: 'land', objectId: p.land, reden: 'de per-land-standen zijn weer weg' });
    return stand(p.land);
  }

  return { stand, activeer, terug, pakketVan, laad };
}

module.exports = { maakLandpakket, laad, BESTAND };
