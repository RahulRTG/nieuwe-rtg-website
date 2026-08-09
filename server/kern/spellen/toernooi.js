/* Spellen (deelmodule): toernooien -- een knockout over de bestaande spellen.

   EEN TOERNOOI IS EEN BEGRENSD EVENEMENT, GEEN STAND. Het begint, het eindigt,
   en er blijft geen ranglijst van over. Daarom valt het NIET onder de
   progressiegrens: ook onder de 18+-poort mag je een toernooitje spelen. Wat
   daar al niet gebeurt gebeurt hier ook niet -- de uitslagen van de partijen
   landen alleen in de blijvende log voor wie binnen de grens valt, en dat
   regelt uitslagen.js zelf. De Arena mag dus een schoolkampioenschap houden
   zonder dat er iets van blijft hangen. Dat volgt uit de bestaande regel in
   plaats van er een tweede naast te zetten.

   EEN TOERNOOIPARTIJ IS EEN GEWONE PARTIJ. Elke wedstrijd is een echt potje
   dat via `potjeDirect` langs dezelfde `spelStart` gaat als elk ander potje,
   met alle spelregels, poorten en views die daarbij horen. Er is geen tweede
   soort potje met eigen regels -- dat zou betekenen dat elke spelmotor van het
   bestaan van toernooien moet weten.

   TWEE VORMEN, EN DE ORGANISATOR KIEST. `knockout` (vier of acht spelers, een
   macht van twee -- een knockout met vijf vraagt vrijloten, en een vrijlot is
   een wedstrijd die iemand wint zonder te spelen) of `roundrobin` (drie tot
   acht, iedereen tegen iedereen, punten: winst 3, gelijk 1).

   EEN GELIJKSPEL IN EEN KNOCKOUT WORDT OVERGESPEELD, tot er een winnaar is.
   Dat is de eerlijkste variant en ook de onbegrensdste: bij Woordduel kan een
   reeks remises lang duren. Onbegrensd is hier niet hetzelfde als eeuwig --
   een verlaten wedstrijd verloopt na dertig dagen (`opschonen`) en een
   toernooi zelf na negentig (`bewaarbeleid.js`). Verdwijnt het potje van een
   openstaande wedstrijd, dan breekt het toernooi af met `afgebroken: true` in
   plaats van voor altijd op een uitslag te wachten die nooit komt.

   WAAR HET STAAT. `db.data.spelToernooien`, op het hoogste niveau en niet
   genest onder `spellen`: de bewaarmotor leest `db.data[tak]`, dus genest zou
   deze tak buiten het bewaarbeleid vallen en op de lijst `zonderBeleid()`
   belanden. De termijn staat in server/bewaarbeleid.js. */
module.exports = (ctx) => {
  const { db, save, rid, nu, codenaamVan, isGeblokkeerd, SPEL, SOORTEN, schud, potjeDirect, leeftijdFout, nudge } = ctx;

  /* Het SCHEMA (welke vormen en maten er zijn, wie tegen wie speelt, en de
     stand) staat in ./toernooi-schema.js. Dit bestand gaat over de LEVENSLOOP:
     aanmaken, aanzeggen, een uitslag verwerken, opruimen. */
  const { MAAT, PUNT, vormVan, maatVan, maakAlleParen, maakRonde, standVan, controleerVastgelopen, loot, toon } =
    require('./toernooi-schema')({ save, potjeDirect, schud, codenaamVan, SOORTEN });
  const MAX = 2000;             // harde bovengrens op schijf, los van de termijn

  function T() {
    if (!Array.isArray(db.data.spelToernooien)) db.data.spelToernooien = [];
    return db.data.spelToernooien;
  }
  const vind = (id) => T().find(t => t.id === id) || null;

  function toernooiNieuw(mij, { soort, naam, maat, spelers, vorm }) {
    if (!SPEL[soort]) return { status: 400, error: 'Onbekend spel.' };
    const v = vormVan(vorm);
    /* Alleen spellen die met twee gespeeld kunnen worden: een knockout zet
       twee namen tegenover elkaar. 30 Seconden (minimaal vier) kan dus niet,
       en dat zegt de descriptor -- er staat hier geen spelnaam. */
    if ((SPEL[soort].min || 2) > 2) return { status: 400, error: 'Dit spel kan niet een tegen een, dus er kan geen knockout mee.' };
    const m = maatVan(v, maat);
    const lf = leeftijdFout(soort, mij);
    if (lf) return { status: 403, error: lf };

    const uitgenodigd = [];
    for (const k of (Array.isArray(spelers) ? spelers : [])) {
      if (k === mij || uitgenodigd.includes(k)) continue;
      if (isGeblokkeerd(mij, k)) return { status: 403, error: 'Dit contact is niet beschikbaar.' };
      const vf = leeftijdFout(soort, k);
      if (vf) return { status: 403, error: vf };
      uitgenodigd.push(k);
    }
    if (uitgenodigd.length !== m - 1)
      return { status: 400, error: 'Een toernooi van ' + m + ' vraagt precies ' + (m - 1) + ' medespelers.' };

    const t = { id: rid(5), naam: String(naam || '').slice(0, 60) || (SOORTEN[soort] + '-toernooi'),
      soort, maat: m, door: mij, vorm: v, status: 'wacht', ronde: 0,
      spelers: [mij], uitgenodigd, paren: [], winnaar: null, at: nu() };
    const lijst = T();
    lijst.push(t);
    if (lijst.length > MAX) lijst.splice(0, lijst.length - MAX);
    save();
    return { status: 200, ok: true, id: t.id };
  }

  function toernooiAntwoord(mij, id, akkoord) {
    const t = vind(id);
    if (!t || t.status !== 'wacht' || !t.uitgenodigd.includes(mij))
      return { status: 404, error: 'Deze uitnodiging is er niet meer.' };
    t.uitgenodigd = t.uitgenodigd.filter(x => x !== mij);
    if (akkoord === true) t.spelers.push(mij);
    /* Zegt iemand nee, dan gaat het toernooi NIET door met een gat: een
       knockout met een oneven veld vraagt een vrijlot, en dat is een wedstrijd
       die iemand wint zonder te spelen. Liever eerlijk annuleren. */
    if (t.spelers.length === t.maat) start(t);
    else if (!t.uitgenodigd.length) { t.status = 'klaar'; t.afgezegd = true; }
    save();
    return { status: 200, ok: true, gestart: t.status === 'bezig', afgezegd: !!t.afgezegd };
  }

  // de loting en de eerste ronde
  function start(t) {
    t.status = 'bezig';
    t.ronde = 1;
    loot(t);
  }

  /* Een potje uit dit toernooi is klaar. Dit hangt aan dezelfde plek waar de
     uitslag wordt vastgelegd, zodat er geen tweede moment is waarop een
     toernooi kan blijven hangen. */
  function toernooiPotjeKlaar(potje) {
    if (!potje || !potje.toernooi) return null;
    const t = vind(potje.toernooi);
    if (!t || t.status !== 'bezig') return null;
    const paar = (t.paren || []).find(p => p.potje === potje.id);
    if (!paar || paar.winnaar || paar.gelijk) return null;

    const gewonnen = potje.spelers.filter(k => String(potje.winnaar || '').split(' & ').includes(codenaamVan(k)));
    const remise = !!potje.gelijk || !gewonnen.length;

    if (remise && t.vorm === 'knockout') {
      /* OVERSPELEN TOT ER EEN WINNAAR IS. De eerlijkste variant, en de
         onbegrensdste: bij Woordduel kan een reeks remises lang duren. Dat is
         een bewuste keuze en geen omissie. Onbegrensd is hier niet eeuwig --
         een verlaten wedstrijd verloopt na dertig dagen en het toernooi zelf
         na negentig. */
      paar.overgespeeld = (paar.overgespeeld || 0) + 1;
      paar.potje = potjeDirect(t.soort, [paar.a, paar.b], { toernooi: t.id }).id;
      save();
      return t;
    }
    if (remise) paar.gelijk = true; else paar.winnaar = gewonnen[0];

    if ((t.paren || []).some(p => !p.winnaar && !p.gelijk)) { save(); return t; }

    if (t.vorm === 'roundrobin') {
      const stand = standVan(t);
      // gelijk aan de top blijft gelijk: er is geen tweede criterium bedacht,
      // en er een verzinnen zou een winnaar aanwijzen die niemand heeft afgesproken
      t.status = 'klaar';
      t.winnaar = (stand.length > 1 && stand[0].punten === stand[1].punten) ? null : (stand[0] || {}).key || null;
      t.gedeeld = t.winnaar === null;
    } else {
      const door = t.paren.map(p => p.winnaar);
      if (door.length === 1) { t.status = 'klaar'; t.winnaar = door[0]; }
      else { t.ronde++; maakRonde(t, door); }
    }
    save();
    t.spelers.forEach(sp => { try { nudge(sp, { id: potje.id, soort: t.soort }); } catch (e) {} });
    return t;
  }

  function mijnToernooien(mij) {
    const potjes = (db.data.spellen || {}).potjes || {};
    T().forEach(t => controleerVastgelopen(t, potjes));
    const alle = T().filter(t => t.spelers.includes(mij) || t.uitgenodigd.includes(mij));
    return { status: 200, toernooien: alle.slice(-20).reverse().map(t => toon(t, mij)) };
  }
  function toernooiStaat(mij, id) {
    const t = vind(id);
    if (!t || (!t.spelers.includes(mij) && !t.uitgenodigd.includes(mij)))
      return { status: 404, error: 'Dit toernooi bestaat niet (meer).' };
    controleerVastgelopen(t, (db.data.spellen || {}).potjes || {});
    return { status: 200, toernooi: toon(t, mij) };
  }

  /* Een lid dat zich laat verwijderen. Net als bij de potjes: zijn sleutel mag
     nergens blijven staan. Een lopend toernooi zonder hem is niet af te maken
     (een knockout met een gat), dus dat vervalt; bij een afgelopen toernooi
     blijft de uitslag staan met zijn plek als `(verwijderd)`. */
  function toernooiVergeet(key) {
    if (!key) return;
    const over = [];
    for (const t of T()) {
      const meedoen = t.spelers.includes(key) || t.uitgenodigd.includes(key);
      if (!meedoen) { over.push(t); continue; }
      if (t.status !== 'klaar') continue;             // lopend of wachtend: vervalt
      t.spelers = t.spelers.map(k => k === key ? null : k);
      t.uitgenodigd = t.uitgenodigd.filter(k => k !== key);
      if (t.winnaar === key) t.winnaar = null;
      t.paren = (t.paren || []).map(p => ({
        a: p.a === key ? null : p.a, b: p.b === key ? null : p.b, potje: null,
        winnaar: p.winnaar === key ? null : p.winnaar
      }));
      if (t.spelers.some(k => k)) over.push(t);        // niemand meer over: helemaal weg
    }
    db.data.spelToernooien = over;
    save();
  }

  return { toernooiNieuw, toernooiAntwoord, toernooiPotjeKlaar, mijnToernooien, toernooiStaat, toernooiVergeet, _MAAT: MAAT, _standVan: standVan };
};
