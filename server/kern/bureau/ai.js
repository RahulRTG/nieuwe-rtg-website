/* Het Privekantoor, deelbestand "ai": Rahul als router.

   Apart van ./index.js omdat het het enige stuk is dat NAAR BUITEN praat -- naar
   het model -- en omdat index.js er anders over de tien KB gaat. Wat hier staat
   is de systeemprompt en de terugval; de rest van het kantoor werkt zonder.

   DE BELANGRIJKSTE REGEL STAAT NIET IN DE PROMPT MAAR IN DE CODE ERNAAST: Rahul
   kan niets bevestigen. Hij heeft geen enkele functie die een zaak op 'geregeld'
   zet -- die zit in cases-bureau.js en is alleen vanaf de kantoor-kant te
   bereiken. De zin in de prompt herhaalt dat alleen voor de lezer.

   Gemount via ./index.js. */
'use strict';

module.exports = (ctx) => {
  const { anthropic, schoon, nuBeeld, graaf, delegatie } = ctx;

  /* Rahul in het Privékantoor. Hij is hier de ROUTER, niet de uitvoerder: hij
     leest de situatie, zegt wat hij ziet en noteert wat u wilt. Wat hij niet
     doet -- en dit staat zowel in de systeemprompt als in de code eromheen --
     is iets bevestigen. Een boeking, een tafel, een toegang: die bevestigt een
     mens achter het bureau (cases.js), en Rahul kan die functie niet aanroepen.

     De context die hij meekrijgt is het NU-beeld en de delegatiestand, want dat
     is precies wat het antwoord anders maakt: bij L4 op vervoer mag hij zeggen
     "dat regelen wij", bij L2 hoort hij te zeggen "dat leggen wij u voor". */
  async function bureauAI(key, vraag) {
    const q = schoon(vraag, 500);
    const beeld = nuBeeld(key, graaf(key));
    const del = delegatie(key);
    const magZelf = del.domeinen.filter(d => d.niveau >= 3).map(d => d.naam.toLowerCase());
    /* Deze zin gaat naar het lid en niet alleen naar het model, dus hij is
       geschreven en niet met haakjes in elkaar gezet: "1 zaak/zaken lopen" is
       geen u-vorm. */
    const t = beeld.tellingen;
    const stuk = (n, een, veel) => n + ' ' + (n === 1 ? een : veel);
    const delen = [];
    if (t.beslissingen) delen.push(stuk(t.beslissingen, 'beslissing', 'beslissingen') + ' voor u');
    if (t.achterstallig) delen.push(stuk(t.achterstallig, 'punt', 'punten') + ' achterstallig');
    if (t.dezeWeek) delen.push(stuk(t.dezeWeek, 'punt', 'punten') + ' deze week');
    if (t.lopend) delen.push(stuk(t.lopend, 'zaak', 'zaken') + ' in behandeling');
    const samenvatting = beeld.kop + '. ' +
      (delen.length ? delen.join(', ') + '. ' : 'Er staat niets open. ') +
      (magZelf.length ? 'U heeft ons mandaat gegeven voor: ' + magZelf.join(', ') + '.'
        : 'Wij hebben voor geen enkel onderwerp een uitvoerend mandaat; alles gaat langs u.');

    if (anthropic && q) {
      try {
        const res = await anthropic.messages.create({
          model: 'claude-sonnet-5', max_tokens: 400,
          system: require('../rahul').rahulLeadVoor(key) +
            'U bent het Privékantoor van dit Lifestyle Pass-lid: hun chef de bureau. Spreek het lid consequent aan met "u". ' +
            'Voorkomend, discreet, to the point, geen opsmuk. U bent de ROUTER: u leest de situatie, u zegt wat u ziet en u noteert. ' +
            'U bevestigt NOOIT een boeking, tafel, toegang, levering of prijs -- dat doet een van onze mensen, en u zegt dat er eerlijk bij. ' +
            'U verzint geen partners, bedragen of namen. Waar het lid ons een uitvoerend mandaat gaf mag u zeggen dat wij het oppakken; ' +
            'waar dat mandaat er niet is, zegt u dat u het ter goedkeuring voorlegt. Over gezondheid en nalatenschap adviseert u niet en ' +
            'schakelt u niemand in: daarover beslist het lid zelf. Situatie nu (privé): ' + samenvatting,
          messages: [{ role: 'user', content: q }]
        });
        const tekst = res.content && res.content[0] && res.content[0].text;
        if (tekst) return { status: 200, ok: true, antwoord: tekst, kop: beeld.kop };
      } catch (e) { /* val terug op het vaste antwoord hieronder */ }
    }
    return { status: 200, ok: true, demo: true, kop: beeld.kop,
      antwoord: 'Tot uw dienst. ' + samenvatting +
        ' Zegt u wat u geregeld wilt hebben, dan leg ik er een zaak voor aan en pakt een van onze mensen het persoonlijk op. ' +
        'Bevestigen doe ik pas als het rond is.' };
  }


  return { bureauAI };
};
