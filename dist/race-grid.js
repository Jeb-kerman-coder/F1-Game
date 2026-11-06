(function(root){
'use strict';
function integer(value,min,max,fallback){const n=Number(value);return Number.isFinite(n)?Math.max(min,Math.min(max,Math.round(n))):fallback;}
function config(options={}){return{aiDifficulty:integer(options.aiDifficulty,1,100,50),gridPosition:integer(options.gridPosition,1,20,1),laps:integer(options.laps,2,15,3)};}
function slot(track,position,length=7004){const gridPosition=integer(position,1,20,1),distance=length-gridPosition*8,u=distance/length*track.length,i=Math.floor(u),t=u-i,a=track[i],b=track[(i+1)%track.length],dx=b.x-a.x,dz=b.z-a.z,l=Math.hypot(dx,dz),offset=gridPosition%2?-3:3;
 return{gridPosition,index:i,x:a.x+(b.x-a.x)*t+dz/l*offset,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t-dx/l*offset,heading:Math.atan2(dx,dz),distance,offset};
}
const api={config,slot};if(typeof module!=='undefined')module.exports=api;else root.RaceGrid=api;
})(typeof window==='undefined'?globalThis:window);
