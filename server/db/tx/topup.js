/* ============================================================================
   HET VENSTER BIJVULLEN UIT HET GROOTBOEK, BIJ HET OPSTARTEN.

   Het grootboek heeft alles; de kv-blob is maar een VENSTER van de recentste
   items. Loopt die blob achter -- een crash binnen het trage-flush-venster, een
   herstart middenin een schrijfronde -- dan hoort de start dat gat te dichten.

   HIER STOND `recent(soort, 500)`, EEN KEER, EN DAAR BLEEF HET BIJ. Waren er
   meer dan vijfhonderd regels uit de blob weg, dan bleven de oudere in het
   grootboek staan en kwamen ze nooit terug in het venster. Het getal stond
   bovendien los van de vraag die ertoe doet: hoe groot HOORT het venster van
   deze collectie te zijn (TX_RAM_*)?

   NU PAGINEERT HIJ DOOR, en hij stopt op de plek waar dat mag: zodra een
   bladzijde niets nieuws meer oplevert, of zodra het venster vol is (ramMax).

   WAAROM DIE STOPREGEL KLOPT, en dat is de kern van dit bestand. De kv-blob
   wordt in ZIJN GEHEEL weggeschreven -- een JSON van de hele collectie, atomisch
   vervangen. Er bestaat dus geen half geschreven blob: je hebt de nieuwe of de
   oude. Een oude blob is een momentopname van eerder, en die mist per definitie
   de NIEUWSTE regels, nooit een stuk uit het midden. Rijen komen hier
   nieuwste-eerst terug, dus een gat zit altijd aan de voorkant, en een bladzijde
   die niets nieuws meer geeft betekent dat de rest er al is.

   WAAROM ER NIET EERST GETELD WORDT. De verleiding is `count(*)` per collectie
   en dan precies `min(ramMax, totaal) - venster` rijen halen: exact, en op een
   kloppend venster nul leeswerk. Maar op de maten waar dit huis op mikt is die
   telling zelf het dure deel -- een count over miljoenen rijen kost seconden, en
   dat zou bij ELKE start gebeuren, ook (juist) als er niets aan de hand is. De
   bladzijderegel hierboven kost in het normale geval precies wat de oude versie
   kostte (een bladzijde), en leest alleen door wanneer er echt iets ontbreekt.
   Dat is de goede kant om op te betalen.

   EEN EIGEN BESTAND en geen blok in ./ledger.js: die staat vol met de VEEGronde
   (het venster leegdruppelen naar het grootboek), en dit is de omgekeerde
   beweging op een heel ander moment. Met deze uitleg erbij ging ledger.js
   bovendien over de 10 kB-grens uit keuringsregel 13.
   ========================================================================== */
'use strict';

const TOPUP_BROK = Math.max(1, Number(process.env.TX_TOPUP_BROK || 500));
const adem = () => new Promise(r => setImmediate(r));

/* Nieuwste eerst, zoals unshift. `at` is een ISO-tekst bij vier collecties en
   een getal in milliseconden bij payBoekingen. Binnen EEN collectie is die vorm
   consistent, en in allebei sorteert de tekstvergelijking gelijk aan de tijd --
   een epoch in milliseconden is tot het jaar 2286 dertien cijfers lang. */
const nieuwsteEerst = (a, b) => String((b && b.at) || '').localeCompare(String((a && a.at) || ''));

/* `achter` komt als FUNCTIE binnen en niet als waarde: de achterkant wordt pas
   gezet als het grootboek start, en een waarde die bij het bouwen wordt
   uitgelezen zou hier voor altijd null blijven. */
/* WAT DE RONDE TERUGGEEFT, en waarom dat er is. Per collectie: hoeveel rijen er
   uit het grootboek zijn GELEZEN en hoeveel er zijn TERUGGEZET. Het tweede is
   het resultaat, het eerste de prijs -- en die prijs is de helft van deze
   reparatie: op een venster dat al klopt hoort hij een bladzijde te lezen en
   niet door te pagineren tot ramMax. Zonder dit getal is dat een bewering
   zonder meter, en test/txledger-sqlite-rit.js rekent hem na. */
module.exports = ({ db, achter, COLLECTIES, NAMEN, TX_SOORT, sleutelVan, lees }) =>
  async function vensterTopUp(log) {
    const warn = m => { if (log && log.warn) log.warn(m); };
    const verslag = {};
    const kant = achter();
    if (!kant || !db.data) return verslag;
    for (const naam of NAMEN) {
      try {
        const arr = Array.isArray(db.data[naam]) ? db.data[naam] : (db.data[naam] = []);
        const ramMax = COLLECTIES[naam].ramMax;
        const bekend = new Set(arr.map(t => t && sleutelVan(naam, t)).filter(x => x != null));
        const missend = [];
        let gelezen = 0;
        for (let off = 0; arr.length + missend.length < ramMax && off < ramMax; off += TOPUP_BROK) {
          const rijen = await kant.recent(TX_SOORT[naam], Math.min(TOPUP_BROK, ramMax - off), off);
          if (!rijen.length) break;             // het grootboek is op
          gelezen += rijen.length;
          const voor = missend.length;
          for (const t of lees(rijen)) {
            const k = sleutelVan(naam, t);
            if (k == null || bekend.has(k)) continue;
            bekend.add(k); missend.push(t);
            if (arr.length + missend.length >= ramMax) break;
          }
          if (missend.length === voor) break;   // deze bladzijde gaf niets nieuws: de rest staat er al
          await adem();                         // de event-loop even teruggeven
        }
        verslag[naam] = { gelezen, teruggezet: missend.length };
        if (!missend.length) continue;

        /* Samenvoegen EN sorteren, niet alleen vooraan plakken. Vooraan plakken
           nam aan dat wat ontbreekt ook het nieuwste is; dat is bij EEN bladzijde
           nog waar en over meerdere bladzijden niet meer. Alleen in dit
           herstelpad, dus een normale start herschikt niets. */
        const samen = missend.concat(arr);
        samen.sort(nieuwsteEerst);
        db.data[naam] = samen.slice(0, ramMax);
        console.log('[tx] ' + missend.length + ' ' + naam + ' uit het grootboek teruggezet in het venster (kv liep achter); ' +
          gelezen + ' rijen gelezen, venster nu ' + db.data[naam].length + '.');
      } catch (e) { warn('[db] venster-top-up ' + naam + ' mislukt: ' + e.message); }
    }
    return verslag;
  };
