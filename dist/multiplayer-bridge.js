// Composes with the race renderer/physics hooks without editing Time Attack.
(()=>{'use strict';
const api=window.Multiplayer={active:false,car:null,scene:null,onFrame:null,beforeStep:null},T=window.THREE,Renderer=T.WebGLRenderer,step=Physics.step;
Physics.step=function(car,input,dt){if(api.active){api.car=car;if(api.beforeStep?.(car,input,dt)===false)return car;}return step(car,input,dt);};
T.WebGLRenderer=class extends Renderer{constructor(o){super(o);const draw=this.render.bind(this);this.render=(s,c)=>{api.scene=s;draw(s,c);if(api.active)api.onFrame?.(s,c);};}};
})();
