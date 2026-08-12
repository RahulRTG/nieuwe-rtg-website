/* Werkruimte-inzicht, deelbestand "graaf": de VORM van het geheel.

   ./inzicht.js gaat over ZOEKEN en over het DOSSIER van een object: geef me
   alles wat bij dit ding hoort. Dit bestand kijkt een niveau hoger -- niet naar
   een object maar naar de verhoudingen tussen de soorten.

   TWEE ANTWOORDEN, EN HET VERSCHIL ERTUSSEN IS DE HELE WINST:

     samenhang  de kaart. Welke soorten er zijn en welke naar elkaar verwijzen.
     wandel     wat ligt er twee stappen verderop -- de vraag die een mens
                stelt en die geen enkele zoekopdracht beantwoordt.

   NIET GEMETEN IS IETS ANDERS DAN GEEN SAMENHANG, en dat is de regel die deze
   laag eerlijk houdt. Onder de meetgrens staan soorten ZONDER randen in de
   kaart, met die woorden erbij. Een randenkaart die bij drie rijen al lijnen
   trekt, verkoopt toeval als structuur.

   Krijgt dezelfde sctx als ./inzicht.js. */
'use strict';

module.exports = (sctx) => {
  const { app, db, schoon, werkPoort } = sctx;

  /* Het werkjournaal in de vorm die object.js van een journaal verwacht. Geen
     tweede journaal: dit leest w.journaal, dat de modules zelf al vullen.

     De regel wordt op `waarover` gevonden en dus op ID en niet op soort -- het
     journaal legt de soort niet vast. Ids zijn per werkruimte willekeurig, dus
     in de praktijk wijst dat goed; het staat hier omdat de aanroeper het hoort
     te weten en niet omdat het onschuldig is. */
  function journaalVan(w) {
    return {
      overObject(type, id) {
        const sleutel = String(id);
        return (w.journaal || [])
          .filter(j => j && String(j.waarover || '') === sleutel)
          .map(j => ({ at: j.at, actie: j.wat, actor: j.wie, reden: j.reden || null,
            niveau: null, uitslag: null, id: j.id }));
      }
    };
  }

  /* HOE HARD IS DE SAMENHANG VAN EEN MENS? De afhankelijkhedenscan meldt per rij
     het VELD waarop hij matchte, en dat veld verklapt precies wat we willen
     weten: `wieId` en `eigenaarId` zijn sleutels (exact), `wie` en `eigenaar`
     zijn namen (kan een naamgenoot zijn). Sinds bedrijf/wieis.js dragen nieuwe
     rijen dat id, dus dit getal hoort te krimpen -- en zolang het niet nul is,
     staat er hoeveel van dit dossier nog op een gok rust. */
  function hardheid(d) {
    const rijen = (d.afhankelijkheden || []).flatMap(gr => gr.rijen || []);
    const opId = rijen.filter(r => /Id$/.test(String(r.via || ''))).length;
    const opNaam = rijen.length - opId;
    return { gevonden: { opId, opNaam,
      let: opNaam
        ? opNaam + ' van de ' + rijen.length + ' getoonde rijen zijn op NAAM gevonden en kunnen van een naamgenoot zijn; ' + opId + ' via een lid-id, en die zijn exact. Kijk per rij naar "via".'
        : 'Alle getoonde rijen zijn via een lid-id gevonden; er zit geen naamgok in.' } };
  }

  /* De hele laag van één verzoek. `g` komt uit werkPoort, dus de werkruimte en
     de rechten zijn al bewezen voordat hier iets wordt gebouwd. */
  function laagVoor(g) {
    const register = maakWerkRegister(g.w.code, g.rechten);
    const kwaliteit = maakKwaliteit({ db, register });
    const graaf = maakGraaf({ db, register, kwaliteit });
    return { register, kwaliteit, graaf };
  }

  /* ---------- de samenhang: de vorm van het geheel ---------- */
  app.post('/api/bedrijf/samenhang', (req, res) => {
    const g = werkPoort(req, res); if (!g) return;
    const { register, graaf, kwaliteit } = laagVoor(g);
    const vorm = graaf.vorm();
    const klein = vorm.knopen.filter(k => k.aantal > 0 && k.aantal < MEETGRENS).map(k => k.type);
    res.json({ ok: true, vorm,
      kwaliteit: kwaliteit.meet(),
      nietGemeten: klein,
      let: klein.length
        ? 'Van ' + klein.join(', ') + ' zijn er te weinig rijen om een verwijzing te MOGEN meten. Die soorten staan daarom zonder randen in de kaart: niet gemeten, en dat is iets anders dan geen samenhang.'
        : 'De randen zijn gemeten uit de gegevens. Een soort zonder randen staat in "losse" en dat is een uitslag, geen fout.',
      soorten: zoeklaag.bereik(register) });
  });

  /* ---------- wandelen: wat ligt er twee stappen verderop ---------- */
  app.post('/api/bedrijf/wandel', (req, res) => {
    const g = werkPoort(req, res); if (!g) return;
    const { graaf } = laagVoor(g);
    const type = schoon(req.body.type, 30);
    const id = schoon(req.body.id, 64);
    if (!type || !id) return res.status(400).json({ error: 'Waarvandaan: geef een soort en een id.' });
    const uit = graaf.wandel(type, id, req.body.diepte);
    if (uit.error) return res.status(uit.status || 404).json({ error: uit.error });
    res.json(Object.assign({ ok: true }, uit, {
      let: 'De wandeling loopt alleen door soorten waar u recht op heeft. Een pad dat via een gesloten module loopt, is hier niet onzichtbaar afgesneden -- het bestaat in dit register niet.'
    }));
  });

};
