'use strict';

module.exports=(kern,hulp)=>{
  kern.workLoopSource=require('../bedrijf/loop-source')({db:hulp.db,bewerkCollectie:hulp.bewerkCollectie});
  const leerhuis=require('../kern/leerhuis').maakLeerhuis({db:hulp.db,save:hulp.save});
  const academyLoopSource=require('../kern/leerhuis/loop-source')({db:hulp.db,bewerkCollectie:hulp.bewerkCollectie,leerhuis});
  kern.loopFabric=require('../kern/loop-fabric')({db:hulp.db,bewerkCollectie:hulp.bewerkCollectie,
    livingWorld:kern.livingWorld,workSource:kern.workLoopSource,academySource:academyLoopSource});
};
