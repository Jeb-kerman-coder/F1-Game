(function(root){
'use strict';
const LIMIT=80/3.6,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function project(points,x,z){let best={d:Infinity};for(let i=0;i<points.length-1;i++){const a=points[i],b=points[i+1],dx=b.x-a.x,dz=b.z-a.z,l2=dx*dx+dz*dz,u=clamp(((x-a.x)*dx+(z-a.z)*dz)/l2,0,1),px=a.x+u*dx,pz=a.z+u*dz,d=Math.hypot(x-px,z-pz);if(d<best.d){const length=Math.sqrt(l2);best={i,u,d,x:px,z:pz,y:a.y+(b.y-a.y)*u,grade:(b.y-a.y)/length,heading:Math.atan2(dx,dz),rx:dz/length,rz:-dx/length,side:((x-px)*dz-(z-pz)*dx)/length,s:a.s+(b.s-a.s)*u};}}return best;}
function at(route,s){const p=route.points;s=clamp(s,0,route.length);let i=0;while(i<p.length-2&&p[i+1].s<s)i++;const a=p[i],b=p[i+1],u=(s-a.s)/(b.s-a.s),dx=b.x-a.x,dz=b.z-a.z,l=Math.hypot(dx,dz);return{x:a.x+u*dx,y:a.y+u*(b.y-a.y),z:a.z+u*dz,s,heading:Math.atan2(dx,dz),grade:(b.y-a.y)/l,rx:dz/l,rz:-dx/l};}
function create(T,raw,nearestTrack){
 const distances=[0];for(let i=1;i<raw.length;i++)distances.push(distances[i-1]+Math.hypot(raw[i].x-raw[i-1].x,raw[i].z-raw[i-1].z));
 const anchorIndices=[0,19,28,29,30,33,40,43,46],anchors=anchorIndices.map(i=>[distances[i],nearestTrack(raw[i].x,raw[i].z).y]);
 const h=[],d=[],m=[];for(let i=0;i<anchors.length-1;i++){h[i]=anchors[i+1][0]-anchors[i][0];d[i]=(anchors[i+1][1]-anchors[i][1])/h[i];}m[0]=d[0];m[anchors.length-1]=d[d.length-1];for(let i=1;i<anchors.length-1;i++)m[i]=d[i-1]*d[i]<=0?0:3*(h[i-1]+h[i])/((2*h[i]+h[i-1])/d[i-1]+(h[i]+2*h[i-1])/d[i]);
 function height(s){let i=0;while(i<anchors.length-2&&s>anchors[i+1][0])i++;const u=clamp((s-anchors[i][0])/h[i],0,1),u2=u*u,u3=u2*u;return(2*u3-3*u2+1)*anchors[i][1]+(u3-2*u2+u)*h[i]*m[i]+(-2*u3+3*u2)*anchors[i+1][1]+(u3-u2)*h[i]*m[i+1];}
 const curve=new T.CatmullRomCurve3(raw.map((p,i)=>new T.Vector3(p.x,height(distances[i]),p.z)),false,'centripetal');curve.arcLengthDivisions=12000;curve.updateArcLengths();const count=550,points=[];let s=0;
 for(let i=0;i<count;i++){const p=curve.getPointAt(i/(count-1));if(i)s+=Math.hypot(p.x-points[i-1].x,p.z-points[i-1].z);points.push({x:p.x,y:p.y,z:p.z,s});}
 const route={points,length:s,width:3.6,limitStart:project(points,raw[19].x,raw[19].z).s,limitEnd:project(points,raw[33].x,raw[33].z).s};route.team=at(route,400);route.teamBounds={minX:-28,maxX:3.6,minZ:-10,maxZ:10};
 route.entry=at(route,0);route.exit=at(route,s);return route;
}
function local(route,x,z){const t=route.team,dx=x-t.x,dz=z-t.z,c=Math.cos(t.heading),s=Math.sin(t.heading);return{x:c*dx-s*dz,z:s*dx+c*dz};}
function world(route,x,z){const t=route.team,c=Math.cos(t.heading),s=Math.sin(t.heading);return{x:t.x+c*x+s*z,y:t.y+t.grade*z,z:t.z-s*x+c*z};}
function surface(route,x,z){const p=project(route.points,x,z),q=local(route,x,z);if(q.x>=-28&&q.x< -3&&Math.abs(q.z)<10)return{...p,y:route.team.y+route.team.grade*q.z,grade:route.team.grade,heading:route.team.heading,kind:q.x< -12?'garage':'apron'};if(p.s>=250&&p.s<=580&&p.side>=-12&&p.side< -3.6)return{...p,kind:'apron'};if(p.d<=route.width+.2)return{...p,kind:'lane'};return null;}
function alignment(route,car){const q=local(route,car.x,car.z),headingError=Math.atan2(Math.sin(car.heading-route.team.heading),Math.cos(car.heading-route.team.heading));return{...q,headingError,aligned:Math.abs(headingError)<=Math.PI/10,inside:Math.abs(q.x+8.5)<=1.4&&q.z>=-2.5&&q.z<=1.2,slow:car.v<=3};}
function crosses(route,s,a,b,width=4.5){const g=at(route,s),fx=Math.sin(g.heading),fz=Math.cos(g.heading),da=(a.x-g.x)*fx+(a.z-g.z)*fz,db=(b.x-g.x)*fx+(b.z-g.z)*fz;if(da>=0||db<0||db-da<1e-8)return false;const u=-da/(db-da),x=a.x+u*(b.x-a.x),z=a.z+u*(b.z-a.z);return Math.abs((x-g.x)*g.rx+(z-g.z)*g.rz)<=width;}
function controller(route){
 const state={mode:'track',limited:false,rollingTime:0,rollPhase:null,releaseArmed:false,from:null,visits:0};
 function reset(){Object.assign(state,{mode:'track',limited:false,rollingTime:0,rollPhase:null,releaseArmed:false,from:null,visits:0});}
 function before(car,input,dt){
  if(state.mode==='rolling'){
   if(input.throttle<.1)state.releaseArmed=true;
   state.rollingTime+=dt;const q=local(route,state.from.x,state.from.z);
   if(state.rollingTime<.75){state.rollPhase='jacks';const u=state.rollingTime/.75,ease=u*u*(3-2*u),angle=Math.atan2(Math.sin(route.team.heading-state.from.heading),Math.cos(route.team.heading-state.from.heading));car.x=state.from.x;car.z=state.from.z;car.heading=state.from.heading+angle*ease;}
   else{
    state.rollPhase='moving';const u=clamp((state.rollingTime-.75)/5.45,0,1),t=u*u*(3-2*u),v=1-t;
    // Backwards departure from the parallel stop, then a curved crew-guided
    // roll into the garage. The nose follows the opposite of the push path.
    const p0=q,p1={x:q.x,z:q.z-6},p2={x:-15,z:0},p3={x:-21,z:0};
    const x=v*v*v*p0.x+3*v*v*t*p1.x+3*v*t*t*p2.x+t*t*t*p3.x,z=v*v*v*p0.z+3*v*v*t*p1.z+3*v*t*t*p2.z+t*t*t*p3.z;
    const dx=3*v*v*(p1.x-p0.x)+6*v*t*(p2.x-p1.x)+3*t*t*(p3.x-p2.x),dz=3*v*v*(p1.z-p0.z)+6*v*t*(p2.z-p1.z)+3*t*t*(p3.z-p2.z),p=world(route,x,z);
    car.x=p.x;car.z=p.z;car.heading=route.team.heading+Math.atan2(-dx,-dz);
    if(u>=1){state.mode='garage';state.rollPhase=null;state.visits++;}
   }
   car.v=0;car.yaw=car.slip=car.g=0;car.steer*=.96;return true;
  }
  if(state.mode==='garage'){car.v=0;if(input.throttle<.1)state.releaseArmed=true;if(input.throttle>.2&&state.releaseArmed){state.mode='departing';state.releaseArmed=false;}else return true;}
  if(state.limited)car.v=Math.min(car.v,LIMIT);return false;
 }
 function after(car,previous,input){let event=null;const p=project(route.points,car.x,car.z),q=local(route,car.x,car.z);
  if(!state.limited&&crosses(route,route.limitStart,previous,car)){state.limited=true;state.mode='lane';event='LIMITER ON · 80 KM/H';}
  if(state.limited&&crosses(route,route.limitEnd,previous,car)){state.limited=false;state.mode='exit';event='PIT EXIT · LIMITER OFF';}
  if(state.limited)car.v=Math.min(car.v,LIMIT);
  if(state.mode==='track'&&p.d<4&&p.s>5&&p.s<route.limitStart)state.mode='entry';
  if(state.mode==='entry'&&p.d>10)state.mode='track';
  if(state.mode==='departing'&&q.x> -3)state.mode='lane';
  const a=alignment(route,car);if(state.mode==='lane'&&state.limited&&a.inside&&a.aligned&&a.slow){state.mode='rolling';state.rollPhase='jacks';state.rollingTime=0;state.releaseArmed=input.throttle<.1;state.from={x:car.x,z:car.z,heading:car.heading};car.v=0;event='TEAM CONNECTED · JACKS ON';}
  if(state.mode==='exit'&&p.s>route.length-4&&p.d>3)state.mode='track';
  // Keep the car inside the garage opening when departing under manual control.
  if(q.x< -12&&q.x> -30&&Math.abs(q.z)<13){const cx=Math.max(-26.3,q.x),cz=clamp(q.z,-7.3,7.3);if(cx!==q.x||cz!==q.z){const fixed=world(route,cx,cz);car.x=fixed.x;car.z=fixed.z;car.v=0;}}
  return event;
 }
 return{state,reset,before,after};
}
const api={LIMIT,project,at,create,local,world,surface,crosses,alignment,controller};if(typeof module!=='undefined')module.exports=api;else root.PitLane=api;
})(typeof window==='undefined'?globalThis:window);
