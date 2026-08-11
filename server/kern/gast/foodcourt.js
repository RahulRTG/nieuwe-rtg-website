/* Hospitality Guest OS (deelmodule): DE FOODCOURT -- één mandje, meer keukens.

   NIET TE VERWARREN MET `kern/foodcourt.js`. Dat is het reserveerplein: alle
   restaurants op een rij met hun vrije tijdsloten, in de stijl van een
   reserveerplatform. Dit bestand gaat over BESTELLEN bij meer loketten
   tegelijk. Twee producten, dezelfde marktnaam, nul gedeelde code -- en dat is
   goed zo. Ik heb overwogen ze samen te voegen; er bleek niets te delen.

   WAT DIT WEL EN NIET IS. Het lag voor de hand om "foodcourt" een veertiende
   verkoopkanaal te maken. Dat is het niet. Wie in een foodcourt bestelt, haalt
   af -- bij drie loketten tegelijk. Het kanaal is dus gewoon `afhaal`; wat er
   nieuw aan is, is dat één mandje bij MEER ZAKEN tegelijk landt.

   EN DAAR ZIT DE HELE MOEILIJKHEID. Elke zaak heeft zijn eigen keuken, zijn
   eigen kassa, zijn eigen omzet en zijn eigen boekhouding. Eén rekening over
   drie zaken zou betekenen dat de ene zaak de bestelling van de andere op zijn
   scherm ziet en in zijn dagcijfers krijgt. Dus: PER ZAAK EEN REKENING, precies
   zoals wanneer de gast er los had besteld -- en daarbovenop één ding dat
   zegt dat ze bij elkaar horen.

   DAT ENE DING IS EEN VELD, GEEN TWEEDE ADMINISTRATIE. Elke rekening krijgt
   hetzelfde `mandjeId`. "Mijn foodcourt-bestelling" is dan een zoekvraag over
   bestaande rekeningen en geen nieuwe opslag die uit de pas kan lopen met wat
   de zaken zien (LAT-regel 4). Hetzelfde trucje als `gastId` bij bezorging.

   ATOMAIR PER ZAAK, NIET OVER ZAKEN. Binnen een zaak gaat het mandje in zijn
   geheel door of helemaal niet -- dat regelt de orderlaag al, en het moet ook,
   want de allergie hoort bij het hele mandje. Over zaken heen kan dat NIET:
   is de sushi weg terwijl de pizza al bij de keuken ligt, dan valt die pizza
   niet meer terug te halen. Het antwoord zegt daarom per zaak wat er gelukt is
   en wat niet. Doen alsof alles is teruggedraaid terwijl er een keuken aan het
   werk is, is de ene leugen die je hier niet wilt. */
'use strict';

module.exports = ({ db, save, schoon, crypto, horeca, orderlaag, buitenshuis, naad }) => {
  const { isVan } = naad;   // dezelfde eigendomsvraag als bij bezorgen: kern/gast/naad.js
  const { H, nu, totaal, openstaand } = horeca;

  const nieuwMandje = () => 'fc' + crypto.randomBytes(5).toString('hex');

  /* Alle rekeningen van één mandje, over de zaken heen. Loopt over de zaken en
     niet over een index: de rekeningen zijn de waarheid, en een index die
     ernaast staat kan verouderen. */
  function rekeningenVan(mandjeId, handle) {
    const uit = [];
    for (const [zaakcode, doos] of Object.entries(db.data.horeca || {})) {
      for (const r of Object.values(doos.rekeningen || {})) {
        if (r.mandjeId !== mandjeId) continue;
        if (handle && !isVan(r, handle)) continue;   // niet andermans mandje
        uit.push({ zaakcode, rekening: r });
      }
    }
    return uit;
  }

  /* Het beeld van een heel mandje: per zaak wat er staat, en één totaal. De
     gast ziet één bestelling; de zaken zien elk de hunne. */
  function mandjeBeeld(mandjeId, handle, naamVan) {
    const delen = rekeningenVan(mandjeId, handle).map(({ zaakcode, rekening }) => {
      const t = totaal(rekening);
      return {
        zaak: zaakcode, naam: naamVan ? naamVan(zaakcode) : zaakcode,
        rekeningId: rekening.id, status: rekening.status,
        afhaalcode: rekening.afhaal ? rekening.afhaal.code : null,
        tijd: rekening.afhaal ? rekening.afhaal.tijd : null,
        regels: (rekening.regels || []).map(r => ({ naam: r.naam, aantal: r.aantal, centen: r.centen,
          stand: r.stand, bevestiging: r.bevestiging || null })),
        totaal: t.teBetalen, openstaand: openstaand(rekening),
        klaar: (rekening.regels || []).length > 0 &&
          (rekening.regels || []).every(r => r.stand === 'klaar' || r.stand === 'uitgegeven')
      };
    });
    return {
      mandjeId,
      delen: delen.sort((a, b) => String(a.naam).localeCompare(String(b.naam))),
      totaal: delen.reduce((t, d) => t + d.totaal, 0),
      openstaand: delen.reduce((t, d) => t + d.openstaand, 0),
      /* "Alles klaar" is niet hetzelfde als "de laatste is klaar": in een
         foodcourt sta je te wachten tot het LANGZAAMSTE loket klaar is, en dat
         is precies wat een gast wil weten voordat hij gaat lopen. */
      allesKlaar: delen.length > 0 && delen.every(d => d.klaar)
    };
  }

  /* Bestellen bij meer zaken tegelijk. `perZaak` is een kaart van zaakcode naar
     items; de aanroeper heeft ze al gegroepeerd en levert per zaak de kaart en
     de zaak zelf aan, zodat deze module niets van leveranciers hoeft te weten. */
  function bestel(mandjeId, handle, perZaak, { allergie, idem, apparaat, tijd }) {
    const id = mandjeId || nieuwMandje();
    const uitkomsten = [];
    for (const { zaakcode, items, kaartVan } of perZaak) {
      const lop = buitenshuis.lopende(zaakcode, 'afhaal', handle);
      if (lop.error) { uitkomsten.push({ zaak: zaakcode, ok: false, error: lop.error, code: lop.code }); continue; }
      const rek = lop.rekening;
      rek.mandjeId = id;
      /* DE SLEUTEL GAAT ONGEWIJZIGD DOOR, en dat is nagemeten in plaats van
         aangenomen. Hier stond eerst `idem + ':' + zaakcode`, met de redenering
         dat dezelfde sleutel bij het tweede loket anders als "al gedaan" zou
         gelden. Een mutatie die dat achtervoegsel weghaalde liet geen enkele
         toets zakken -- want de idempotentiekaart staat AL per zaak
         (`H(zaakcode).idem` in order.js), dus twee loketten delen hem nooit.
         Het achtervoegsel verdedigde tegen iets wat niet kan gebeuren, en een
         verdediging die niets doet leest als een regel die wel iets doet. Wie
         hem terugzet: meet eerst of de kaart nog per zaak staat. */
      const uit = orderlaag.bestel(zaakcode, rek, lop.deelnemer, {
        items, allergie, apparaat, kaartVan, idem: idem || null
      });
      if (uit.error) {
        uitkomsten.push({ zaak: zaakcode, ok: false, error: uit.error, code: uit.code, item: uit.item });
        continue;
      }
      buitenshuis.zetAfhaal(rek, { tijd, datum: null, opmerking: null });
      orderlaag.audit(rek, { actor: handle, bron: 'gast', apparaat, wat: 'foodcourt', naar: id });
      uitkomsten.push({ zaak: zaakcode, ok: true, toegevoegd: uit.toegevoegd,
        bevestiging: uit.bevestiging || null, afhaalcode: rek.afhaal.code, rekeningId: rek.id });
    }
    save();
    return { mandjeId: id, uitkomsten,
      gelukt: uitkomsten.filter(u => u.ok).length,
      mislukt: uitkomsten.filter(u => !u.ok).length };
  }

  /* Mijn lopende foodcourt-mandjes. Bewust op handle en niet op een lijst die
     ergens wordt bijgehouden: wie een rekening heeft, heeft een mandje. */
  function mijne(handle, { limiet = 10 } = {}) {
    const ids = new Map();
    for (const doos of Object.values(db.data.horeca || {})) {
      for (const r of Object.values(doos.rekeningen || {})) {
        if (!r.mandjeId || !isVan(r, handle)) continue;
        const eerder = ids.get(r.mandjeId);
        if (!eerder || String(r.geopendAt) > eerder) ids.set(r.mandjeId, String(r.geopendAt));
      }
    }
    return [...ids.entries()].sort((a, b) => b[1].localeCompare(a[1])).slice(0, limiet).map(([id]) => id);
  }

  return { nieuwMandje, rekeningenVan, mandjeBeeld, bestel, mijne };
};
