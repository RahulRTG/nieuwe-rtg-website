/* HET INLOGGESPREK VERHUIST, HET WORDT NIET NAGEBOUWD.

   Voor het inloggen is de werktafel het inlogscherm: de bank staat er en de
   werkvloer draagt #gate -- Rahuls gesprek met de zin, het veld #agIn, het
   wachtwoord en het herstel (app-main-04/05). Dat blok in de werktafel nabouwen
   zou een tweede inlog zijn: twee plekken die hetzelfde beweren, en de ene
   raakt achter. We verplaatsen daarom het BESTAANDE element. Dezelfde knoop,
   dus elke getElementById('gate') en elke luisteraar blijft werken.

   Dit staat apart omdat het op de kritieke weg zit. Waar de poort vandaan kwam
   wordt onthouden, en bij het opruimen van de werktafel gaat hij terug -- zonder
   dat verdwijnt het inloggesprek mét de werktafel en kan er niemand meer naar
   binnen. Dat is geen fout die je pas in productie wilt zien, en daarom bewaakt
   test/werktafel.e2e.js hem met een eigen bewering. */
(function(w,d){
  'use strict';
  w.RTGCommandInlogpoort=function(){
    var ouder=null,buur=null;
    return{
      naar:function(vak){
        var g=d.getElementById('gate');if(!g||!vak)return;
        // alleen de EERSTE keer onthouden: een tweede verhuizing zou anders de
        // werkvloer als thuis noteren, en dan is er geen weg terug meer
        if(!ouder){ouder=g.parentNode;buur=g.nextSibling}
        vak.appendChild(g);
      },
      terug:function(){
        var g=d.getElementById('gate');if(!g||!ouder)return;
        ouder.insertBefore(g,buur);ouder=null;buur=null;
      }
    };
  };
})(window,document);
