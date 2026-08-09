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

   HET AANTAL IS EEN MACHT VAN TWEE. Vier of acht spelers, want een knockout
   met vijf deelnemers vraagt vrijloten, en een vrijlot is een wedstrijd die
   iemand wint zonder te spelen. Dat kan later; het weglaten is eerlijker dan
   het half doen.

   WAAR HET STAAT. `db.data.spelToernooien`, op het hoogste niveau en niet
   genest onder `spellen`: de bewaarmotor leest `db.data[tak]`, dus genest zou
   deze tak buiten het bewaarbeleid vallen en op de lijst `zonderBeleid()`
   belanden. De termijn staat in server/bewaarbeleid.js. */
module.exports = (ctx) => {
  const { db, save, rid, nu, codenaamVan, isGeblokkeerd, SPEL, SOORTEN, schud, potjeDirect, leeftijdFout, nudge } = ctx;

  const MAAT = [4, 8];          // machten van twee; zie de kop
  const MAX = 2000;             // harde bovengrens op schijf, los van de termijn

  function T() {
    if (!Array.isArray(db.data.spelToernooien)) db.data.spelToernooien = [];
    return db.data.spelToernooien;
  }
  const vind = (id) => T().find(t => t.id === id) || null;

  /* De weergave voor een deelnemer: codenamen, nooit sleutels naar buiten
     behalve die van jezelf -- je hebt ze niet nodig om te kijken, en een
     toernooibord is iets wat meer mensen zien dan een potje. */
  function toon(t, mij) {
    return {
      id: t.id, naam: t.naam, soort: t.soort, spel: SOORTEN[t.soort] || t.soort,
      status: t.status, ronde: t.ronde, maat: t.maat,
      spelers: t.spelers.map(codenaamVan),
      wachtOp: t.uitgenodigd.length,
      ikDoeMee: t.spelers.includes(mij),
      uitgenodigd: t.uitgenodigd.includes(mij),
      winnaar: t.winnaar ? codenaamVan(t.winnaar) : null,
      paren: (t.paren || []).map(p => ({
        a: codenaamVan(p.a), b: codenaamVan(p.b),
        potje: (p.a === mij || p.b === mij) ? p.potje : null,   // alleen je eigen partij open je
        winnaar: p.winnaar ? codenaamVan(p.winnaar) : null
      })),
      at: t.at
    };
  }

  function toernooiNieuw(mij, { soort, naam, maat, spelers }) {
    if (!SPEL[soort]) return { status: 400, error: 'Onbekend spel.' };
    /* Alleen spellen die met twee gespeeld kunnen worden: een knockout zet
       twee namen tegenover elkaar. 30 Seconden (minimaal vier) kan dus niet,
       en dat zegt de descriptor -- er staat hier geen spelnaam. */
    if ((SPEL[soort].min || 2) > 2) return { status: 400, error: 'Dit spel kan niet een tegen een, dus er kan geen knockout mee.' };
    const m = MAAT.includes(Number(maat)) ? Number(maat) : 4;
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
      soort, maat: m, door: mij, vorm: 'knockout', status: 'wacht', ronde: 0,
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
    t.spelers = schud(t.spelers.slice());
    t.ronde = 1;
    maakRonde(t, t.spelers);
  }

  function maakRonde(t, door) {
    t.paren = [];
    for (let i = 0; i < door.length; i += 2) {
      const a = door[i], b = door[i + 1];
      const potje = potjeDirect(t.soort, [a, b], { toernooi: t.id });
      t.paren.push({ a, b, potje: potje.id, winnaar: null });
    }
  }

  /* Een potje uit dit toernooi is klaar. Dit hangt aan dezelfde plek waar de
     uitslag wordt vastgelegd, zodat er geen tweede moment is waarop een
     toernooi kan blijven hangen. Een gelijkspel bestaat in een knockout niet:
     dan telt de speler die als eerste in het paar stond, en dat staat hier met
     zoveel woorden omdat het een KEUZE is en geen natuurwet -- de eerlijker
     variant (opnieuw spelen) vraagt een beslissing over hoe vaak. */
  function toernooiPotjeKlaar(potje) {
    if (!potje || !potje.toernooi) return null;
    const t = vind(potje.toernooi);
    if (!t || t.status !== 'bezig') return null;
    const paar = (t.paren || []).find(p => p.potje === potje.id);
    if (!paar || paar.winnaar) return null;

    const winnaarNaam = potje.winnaar;
    const gewonnen = potje.spelers.filter(k => String(winnaarNaam || '').split(' & ').includes(codenaamVan(k)));
    paar.winnaar = potje.gelijk || !gewonnen.length ? paar.a : gewonnen[0];

    if (t.paren.some(p => !p.winnaar)) { save(); return t; }

    const door = t.paren.map(p => p.winnaar);
    if (door.length === 1) {
      t.status = 'klaar';
      t.winnaar = door[0];
      t.paren = t.paren.slice();
    } else {
      t.ronde++;
      maakRonde(t, door);
    }
    save();
    t.spelers.forEach(sp => { try { nudge(sp, { id: potje.id, soort: t.soort }); } catch (e) {} });
    return t;
  }

  function mijnToernooien(mij) {
    const alle = T().filter(t => t.spelers.includes(mij) || t.uitgenodigd.includes(mij));
    return { status: 200, toernooien: alle.slice(-20).reverse().map(t => toon(t, mij)) };
  }
  function toernooiStaat(mij, id) {
    const t = vind(id);
    if (!t || (!t.spelers.includes(mij) && !t.uitgenodigd.includes(mij)))
      return { status: 404, error: 'Dit toernooi bestaat niet (meer).' };
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

  return { toernooiNieuw, toernooiAntwoord, toernooiPotjeKlaar, mijnToernooien, toernooiStaat, toernooiVergeet, _MAAT: MAAT };
};
