/* Routes mogen functionele CSS bijladen, maar Heritage blijft het laatste
   materiaalblad. De helper verplaatst alleen de bestaande link. */
  if (!window.RTGHeritageOrder && !document.getElementById('rtgHeritageOrderJs') &&
      !document.querySelector('script[src^="/shared/rtg-heritage-order.js"]')) {
    var heritageOrderScript = document.createElement('script');
    heritageOrderScript.id = 'rtgHeritageOrderJs';
    heritageOrderScript.src = '/shared/rtg-heritage-order.js';
    heritageOrderScript.async = false;
    (document.head || document.documentElement).appendChild(heritageOrderScript);
  }
