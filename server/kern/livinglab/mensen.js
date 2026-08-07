/* RTF Living Lab, deel "mensen": deelnemers en hun rollen. De vragen die
   bewoners zelf aandragen staan in ./themas.js -- dat is de trechter vóór een
   studie en gaat over mensen die nog geen deelnemer zijn.

   DE SCHEIDING, en waarom dit meer is dan een codenaam.

   Het platform draait al op codenamen: de echte naam staat in de kluis
   (server/accounts.js), het operationele werk op een sleutel. Dat is genoeg voor
   een boeking. Voor onderzoek is het dat niet, want daar is de KOPPELING zelf
   het gevoelige feit: dat iemand meedoet aan een studie over schuldhulp zegt
   alles, ook zonder zijn naam.

   Daarom drie lagen in plaats van twee:

     alias      een pseudoniem dat ALLEEN binnen deze ene studie bestaat. Twee
                studies geven dezelfde persoon twee verschillende aliassen, dus
                ze zijn niet naast elkaar te leggen.
     koppel     de tabel alias -> Foundation-sleutel. Staat in een EIGEN
                collectie (db.data.livingLabKoppel), niet in de studieboom, en
                geen enkele studie-route leest hem. Zo kan een dossier niet per
                ongeluk de koppeling meesturen.
     gescheiden bij risicoklasse hoog en hoger wordt er GEEN koppelrij
                geschreven. Dan bestaat de link nergens in het systeem; de
                deelnemer houdt zijn labpas en dat is de enige handle. Dat is
                geen strengere afscherming van dezelfde gegevens -- die gegevens
                zijn er dan gewoon niet.

   De prijs staat er eerlijk bij: bij een gescheiden studie kan het lab een
   deelnemer niet terugvinden vanuit zijn Foundation-profiel. Dat is de bedoeling.
   Intrekken van toestemming werkt via de labpas die de deelnemer zelf heeft. */
'use strict';

const kader = require('./kader');

module.exports = (ctx) => {
  const { nu, rid, schoon, code, S, K, audit, vindStudie, save, studie: st } = ctx;

  // uit dezelfde CSPRNG als de rest van de map: een pseudoniem dat te raden is,
  // is bij een gescheiden studie het enige wat de deelnemer nog beschermt.
  const alias = () => 'BW-' + rid().slice(0, 6).toUpperCase();

  /* Een alias die binnen deze studie nog niet bestaat. De lus is begrensd: bij
     een volle ruimte liever een nette fout dan een oneindige lus. */
  function versAlias(s) {
    for (let i = 0; i < 200; i++) { const a = alias(); if (!s.dossier.deelnemers.some(p => p.alias === a)) return a; }
    return null;
  }

  /* ---------- deelnemers ----------
     `sleutel` is optioneel: een bewoner hoeft geen Foundation-account te hebben
     om mee te doen. Wie er wel een heeft, wordt gekoppeld -- behalve bij een
     gescheiden studie, waar die koppeling met opzet niet ontstaat. */
  function deelnemerBij(id, b, wie) {
    const s = vindStudie(id); if (!s) return { status: 404, error: 'Dit onderzoek bestaat niet.' };
    b = b || {};
    const rol = kader.rol(b.rol);
    if (!rol) return { status: 400, error: 'Kies een geldige rol.' };
    if (s.dossier.deelnemers.length >= 2000) return { status: 400, error: 'Dit onderzoek zit vol.' };
    const e = s.dossier.ethiek;
    /* De ethische poort staat hier ook, niet alleen op de cyclusstap. Wie via
       een andere weg een deelnemer toevoegt (een import, een AI-opdracht) moet
       op dezelfde muur stuiten; een poort die maar op één route staat, is een
       poort met een omweg ernaast. */
    const gebrek = ctx.ethiek.gebreken(s);
    if (gebrek.length) return { status: 409, error: 'Nog geen deelnemers: ' + gebrek[0], gebreken: gebrek };
    if (e.toestemming.regime !== 'geen' && !b.toestemming)
      return { status: 400, error: 'Deze studie werkt met ' + e.toestemming.regime + 'e toestemming; leg vast dat de deelnemer die heeft gegeven.' };
    if (e.toestemming.ouderlijk && b.minderjarig && !b.ouderlijk)
      return { status: 400, error: 'Voor een minderjarige deelnemer is ouderlijke toestemming nodig.' };

    const a = versAlias(s);
    if (!a) return { status: 500, error: 'Kon geen vrij pseudoniem maken; probeer het opnieuw.' };
    const gescheiden = st.isGescheiden(s);
    const p = { id: rid(), alias: a, rol: rol.rol, pas: code('LABPAS'),
      toestemming: e.toestemming.regime === 'geen' ? 'niet nodig' : (b.ouderlijk ? 'ouderlijk' : 'gegeven'),
      minderjarig: !!b.minderjarig, punten: 0, badges: [], at: nu() };
    /* Het paspoort koppelen VOORDAT de deelnemer erin staat: bij een gescheiden
       studie weigert ./spel.js dat, en dan hoort er ook geen halve deelnemer
       achter te blijven. */
    const koppel = ctx.spel.koppelPaspoort(p, schoon(b.paspoort, 40), gescheiden);
    if (koppel.error) return koppel;
    s.dossier.deelnemers.push(p);
    const sleutel = schoon(b.sleutel, 80);
    if (sleutel && !gescheiden) K().push({ alias: a, studieId: s.id, sleutel, at: nu() });
    audit(s.labId, 'mens.bij', wie, s.id, rol.rol + (gescheiden ? ' (gescheiden: geen koppeling vastgelegd)' : ''));
    s.dossier.logboek.unshift({ id: rid(), tekst: 'Deelnemer ' + a + ' toegevoegd als ' + rol.naam + '.', wie: schoon(wie, 80) || 'lab', at: nu() });
    save();
    // de pas gaat EEN keer over de lijn, bij het aanmaken; daarna staat hij
    // alleen nog gehasht-noch-getoond in het dossier voor wie hem al heeft.
    return { ok: true, deelnemer: { id: p.id, alias: p.alias, rol: p.rol, pas: p.pas, toestemming: p.toestemming } };
  }

  /* Toestemming intrekken. Dit is de kant waar de scheiding zich moet bewijzen:
     het werkt op de ALIAS, dus ook bij een gescheiden studie waar niemand weet
     wie erachter zit. De observaties van deze deelnemer gaan mee weg -- dat is
     wat intrekken betekent. Wat blijft is een auditregel dat er iets weg is, met
     het aantal, want een intrekking die geen spoor achterlaat is niet te
     controleren en een spoor mét inhoud is de intrekking ongedaan maken. */
  function deelnemerWeg(id, b, wie) {
    const s = vindStudie(id); if (!s) return { status: 404, error: 'Dit onderzoek bestaat niet.' };
    b = b || {};
    const a = schoon(b.alias, 40);
    const p = s.dossier.deelnemers.find(x => x.alias === a);
    if (!p) return { status: 404, error: 'Deze deelnemer staat niet op dit onderzoek.' };
    const eigen = s.dossier.observaties.filter(o => o.door === a).length;
    s.dossier.observaties = s.dossier.observaties.filter(o => o.door !== a);
    s.dossier.deelnemers = s.dossier.deelnemers.filter(x => x.alias !== a);
    const voor = K().length;
    db_koppelWeg(a, s.id);
    audit(s.labId, 'mens.weg', wie, s.id, a + ': ' + eigen + ' observaties gewist, ' + (voor - K().length) + ' koppelrij(en) gewist');
    s.dossier.logboek.unshift({ id: rid(), tekst: 'Deelnemer ' + a + ' trok zich terug; zijn ' + eigen + ' observaties zijn gewist.', wie: schoon(wie, 80) || 'lab', at: nu() });
    save();
    return { ok: true, gewist: eigen };
  }
  function db_koppelWeg(a, studieId) {
    const over = K().filter(k => !(k.alias === a && k.studieId === studieId));
    K().length = 0; for (const k of over) K().push(k);
  }

  /* De labpas: waarmee een bewoner zijn eigen onderzoek opent. Geeft terug wie
     hij is BINNEN welke studie -- nooit meer dan dat. */
  function opPas(pas) {
    const p = String(pas || '').trim().toUpperCase();
    if (p.length < 8) return null;
    for (const s of S().studies) {
      const d = s.dossier.deelnemers.find(x => x.pas === p);
      if (d) return { studieId: s.id, labId: s.labId, alias: d.alias, rol: d.rol };
    }
    return null;
  }

  function rolZet(id, b, wie) {
    const s = vindStudie(id); if (!s) return { status: 404, error: 'Dit onderzoek bestaat niet.' };
    b = b || {};
    const p = s.dossier.deelnemers.find(x => x.alias === schoon(b.alias, 40));
    if (!p) return { status: 404, error: 'Deze deelnemer staat niet op dit onderzoek.' };
    const rol = kader.rol(b.rol);
    if (!rol) return { status: 400, error: 'Kies een geldige rol.' };
    /* Tekenbevoegdheid komt uit het labregister, niet uit een rol die je jezelf
       geeft. Wie hier "toezichthouder" wordt zonder in dat register te staan,
       kan dus nog steeds niets tekenen -- ./ethiek.js kijkt daar en niet hier. */
    p.rol = rol.rol;
    audit(s.labId, 'mens.rol', wie, s.id, p.alias + ' -> ' + rol.rol);
    save();
    return { ok: true, deelnemer: { alias: p.alias, rol: p.rol } };
  }

  return { deelnemerBij, deelnemerWeg, opPas, rolZet };
};
