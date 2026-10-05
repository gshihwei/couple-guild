import { addJournal, addPetEvent, saveState } from './state.js';
import { getCoat, getPersonality } from './cats.js';

const W = 1280, H = 720;
const WORLD_W = 3600, WORLD_H = 2400;
const SCENE_OX = 1140, SCENE_OY = 770;
const PLAYER_SPEED = 145;
const CAMERA_AHEAD_Y = 42;
const CAMERA_EASE = 10;
const INTERACT_RANGE = 105;
const clamp = (v,min,max)=>Math.max(min,Math.min(max,v));
const dist = (a,b)=>Math.hypot(a.x-b.x,a.y-b.y);

const OBSTACLES = [
  {x:SCENE_OX+160,y:SCENE_OY+25,w:285,h:150},
  {x:SCENE_OX+850,y:SCENE_OY+20,w:265,h:145},
  {x:SCENE_OX+610,y:SCENE_OY+215,w:100,h:215},
  {x:SCENE_OX+220,y:SCENE_OY+385,w:900,h:90},
  {x:110,y:980,w:230,h:120},
  {x:2940,y:820,w:240,h:125},
  {x:2590,y:1320,w:210,h:100},
];

const INTERACTABLES = [
  {id:'board', type:'board', x:SCENE_OX+595, y:SCENE_OY+230, label:'公會委託板', hint:'查看與接受委託'},
  {id:'guild-npc', type:'npc', x:SCENE_OX+445, y:SCENE_OY+215, label:'公會管家', hint:'聊聊公會任務'},
  {id:'shop-npc', type:'npc-shop', x:SCENE_OX+790, y:SCENE_OY+210, label:'雜貨商', hint:'看看商店'},
  {id:'guild-house', type:'house', x:SCENE_OX+300, y:SCENE_OY+185, label:'公會之家', hint:'這是你們的家'},
];

export class TownGame {
  constructor(canvas, state, callbacks) {
    this.canvas=canvas; this.ctx=canvas.getContext('2d'); this.state=state; this.cb=callbacks;
    this.keys=new Set(); this.joy={x:0,y:0}; this.time=0; this.lastPetBrain=0; this.lastSave=0;
    this.camera={x:0,y:0}; this.interactionTarget=null; this.interactionPulse=0; this.floaters=[]; this.dialogueTimer=0;
    this.playerFacing='down'; this.walkFrame=0;
    this.catImages={fly:new Image(),hu:new Image()};
    this.catImages.fly.src='/assets/fly.png'; this.catImages.hu.src='/assets/hu.png';
    this.resize(); window.addEventListener('resize',()=>this.resize());
    this.canvas.tabIndex=0; this.canvas.setAttribute('role','application');
    const movement=new Set(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight']);
    const keyDown=e=>{ const code=e.code||'', key=(e.key||'').toLowerCase(); if(movement.has(code)){this.keys.add(code);this.keys.add(key);e.preventDefault();} if(code==='KeyE'||key==='e'){e.preventDefault();this.interactNearest();} };
    const keyUp=e=>{this.keys.delete(e.code||'');this.keys.delete((e.key||'').toLowerCase());};
    document.addEventListener('keydown',keyDown,{capture:true}); document.addEventListener('keyup',keyUp,{capture:true}); window.addEventListener('blur',()=>this.keys.clear());
    this.canvas.addEventListener('pointerdown',e=>{this.canvas.focus(); this.pointerInteract(e);});
    requestAnimationFrame(t=>this.loop(t));
  }

  resize(){ const dpr=Math.min(devicePixelRatio||1,2), r=this.canvas.getBoundingClientRect(); this.canvas.width=Math.round(r.width*dpr); this.canvas.height=Math.round(r.height*dpr); this.scaleX=this.canvas.width/W; this.scaleY=this.canvas.height/H; }
  setJoystick(x,y){this.joy.x=clamp(x,-1,1);this.joy.y=clamp(y,-1,1);}
  loop(ts){const dt=Math.min(.04,(ts-(this._last||ts))/1000);this._last=ts;this.time=ts;this.update(dt);this.draw();requestAnimationFrame(t=>this.loop(t));}

  worldPoint(e){const r=this.canvas.getBoundingClientRect();return{x:(e.clientX-r.left)/r.width*W+this.camera.x,y:(e.clientY-r.top)/r.height*H+this.camera.y};}
  pointerInteract(e){const p=this.worldPoint(e);for(const cat of Object.values(this.state.cats)){if(dist(cat,p)<48){if(this.nearPlayer(cat)){this.cb.openPet(cat.id);}else this.cb.notify(`${cat.name}還在遠處，走近一點再互動。`);return;}} const target=this.nearestInteractableAt(p);if(target&&dist(this.state.player,target)<INTERACT_RANGE)this.performInteraction(target);}

  update(dt){
    const p=this.state.player; let x=0,y=0;
    if(this.keys.has('KeyW')||this.keys.has('w')||this.keys.has('ArrowUp')||this.keys.has('arrowup'))y-=1;
    if(this.keys.has('KeyS')||this.keys.has('s')||this.keys.has('ArrowDown')||this.keys.has('arrowdown'))y+=1;
    if(this.keys.has('KeyA')||this.keys.has('a')||this.keys.has('ArrowLeft')||this.keys.has('arrowleft'))x-=1;
    if(this.keys.has('KeyD')||this.keys.has('d')||this.keys.has('ArrowRight')||this.keys.has('arrowright'))x+=1;
    if(!x&&!y){x=this.joy.x;y=this.joy.y;}
    const moving=!!(x||y), len=Math.hypot(x,y)||1;
    if(moving){ if(Math.abs(x)>Math.abs(y))this.playerFacing=x<0?'left':'right'; else this.playerFacing=y<0?'up':'down'; this.walkFrame+=dt*9; this.movePlayer(x/len*PLAYER_SPEED*dt,y/len*PLAYER_SPEED*dt); }
    else this.walkFrame=0;

    const q=this.state.partner,a=this.time/5200;q.x=SCENE_OX+755+Math.cos(a)*100;q.y=SCENE_OY+430+Math.sin(a*1.35)*70;
    if(this.time-this.lastPetBrain>2200){this.lastPetBrain=this.time;this.decideCat();}
    for(const cat of Object.values(this.state.cats))this.updateCat(cat,dt);

    const targetCamX=clamp(p.x-W/2,0,WORLD_W-W),targetCamY=clamp(p.y-H/2-CAMERA_AHEAD_Y,0,WORLD_H-H),ease=1-Math.exp(-dt*CAMERA_EASE);
    this.camera.x+=(targetCamX-this.camera.x)*ease;this.camera.y+=(targetCamY-this.camera.y)*ease;
    this.interactionTarget=this.findNearestInteractable();this.interactionPulse=(this.interactionPulse+dt)%2;
    this.updateFloaters(dt);
    if(this.time-this.lastSave>3000){this.lastSave=this.time;saveState(this.state);}
  }

  movePlayer(dx,dy){const p=this.state.player; const nextX={...p,x:clamp(p.x+dx,90,WORLD_W-90)}; if(!this.collides(nextX))p.x=nextX.x; const nextY={...p,y:clamp(p.y+dy,150,WORLD_H-150)}; if(!this.collides(nextY))p.y=nextY.y;}
  collides(actor){const r=16;return OBSTACLES.some(o=>actor.x+r>o.x&&actor.x-r<o.x+o.w&&actor.y+r>o.y&&actor.y-r<o.y+o.h);}
  nearestInteractableAt(p){return INTERACTABLES.reduce((best,i)=>!best||dist(i,p)<dist(best,p)?i:best,null);}
  findNearestInteractable(){const p=this.state.player;let best=null,bestD=Infinity;for(const i of INTERACTABLES){const d=dist(i,p);if(d<INTERACT_RANGE&&d<bestD){best=i;bestD=d;}}return best;}
  nearPlayer(cat){return dist(cat,this.state.player)<100||dist(cat,this.state.partner)<100;}
  interactNearest(){const target=this.findNearestInteractable();if(target)this.performInteraction(target);else {const cat=Object.values(this.state.cats).find(c=>this.nearPlayer(c));if(cat)this.cb.openPet(cat.id);else this.cb.notify('附近沒有可以互動的東西。');}}
  performInteraction(target){
    if(target.type==='board'){
      this.state.taskBoardVisits=(this.state.taskBoardVisits||0)+1;
      addJournal(this.state,'📜','查看公會委託板','你回到委託板，準備接受新任務或回報完成的委託。');
      saveState(this.state);
      this.cb.openTasks('board');
      this.cb.notify('📜 委託板：可以接新任務，也可以回報已完成的委託。');
      this.showDialogue('委託板', '看看今天有沒有適合兩個人的小冒險吧！');
      return;
    }
    if(target.type==='npc'){
      this.cb.openTasks('npc');
      this.cb.notify('👋 公會管家：想接任務的話，委託板就在旁邊喔。');
      this.showDialogue('公會管家', '想接任務的話，去旁邊的委託板看看吧！');
      return;
    }
    if(target.type==='npc-shop'){this.cb.openShop();this.cb.notify('🏪 雜貨商：今天想補充什麼？');this.showDialogue('雜貨商', '罐頭、玩具都有，慢慢挑。');return;}
    if(target.type==='house'){this.cb.notify('🏠 公會之家：兩個人的小基地。');this.showDialogue('公會之家', '歡迎回家。今天也辛苦啦。');addJournal(this.state,'🏠','回到公會之家','你在熟悉的小屋前停了一下。');saveState(this.state);}
  }

  decideCat(){const choices=[this.state.player,this.state.partner];for(const cat of Object.values(this.state.cats)){const personality=getPersonality(cat),r=Math.random();if(cat.energy<18){cat.state='sleep';cat.target=null;continue;}if(cat.hunger>75&&Math.random()<personality.hunger){cat.state='hungry';cat.target=choices[Math.random()<.5?0:1];continue;}if(r<personality.approach){cat.target=choices[Math.random()<.55?0:1];cat.state='follow';}else if(r<personality.approach+personality.wander){cat.target=null;cat.state='wander';}else{cat.target=null;cat.state='idle';}}}
  updateCat(cat,dt){const speed=cat.state==='sleep'?0:cat.state==='follow'||cat.state==='hungry'?58:34;if(cat.state==='follow'||cat.state==='hungry'){const t=cat.target;if(t){const dx=t.x-cat.x,dy=t.y-cat.y,d=Math.hypot(dx,dy);if(d>58){cat.x+=dx/d*speed*dt;cat.y+=dy/d*speed*dt;}else if(Math.random()<.0025){this.cb.notify(cat.state==='hungry'?`${cat.name}：喵～ 想吃飯了。`:`${cat.name}跑到你身邊撒嬌。`);addPetEvent(this.state,`${cat.name}跑去找人撒嬌。`);}}}else if(cat.state==='wander'){cat.x+=Math.cos(this.time/1700+cat.id.length)*speed*.35*dt;cat.y+=Math.sin(this.time/2100+cat.id.length*2)*speed*.35*dt;}cat.x=clamp(cat.x,100,WORLD_W-100);cat.y=clamp(cat.y,190,WORLD_H-150);cat.hunger=clamp(cat.hunger+dt*.25,0,100);cat.energy=clamp(cat.energy+(cat.state==='sleep'?dt*2:-dt*.15),10,100);}

  interactPet(id,action){const cat=this.state.cats[id];if(!cat)return;if(!this.nearPlayer(cat)){this.cb.notify(`${cat.name}跑太遠了，靠近一點再互動。`);return;}if(action==='feed'){if(this.state.food<=0){this.cb.notify('貓罐頭吃完啦，先去商店補貨。');return;}this.state.food--;cat.hunger=clamp(cat.hunger-40,0,100);cat.energy=clamp(cat.energy+8,0,100);cat.state='idle';addPetEvent(this.state,`${cat.name}吃飽了，開始舔毛。`);addJournal(this.state,'🍖',`${cat.name}吃飯`,`你餵了${cat.name}一份罐頭。`);this.cb.notify(`${cat.name}：呼嚕呼嚕…… 🍖`);this.addFloater(cat.x,cat.y-55,'🍖 好吃！');}if(action==='play'){cat.energy=clamp(cat.energy-10,0,100);cat.hunger=clamp(cat.hunger+8,0,100);cat.state='wander';if(Math.random()<.1){addPetEvent(this.state,`${cat.name}玩到一半突然不玩了。`);this.cb.notify(`${cat.name}突然走掉了 XD`);}else{addPetEvent(this.state,`${cat.name}今天玩得很開心。`);addJournal(this.state,'🎾',`${cat.name}玩耍`,`陪${cat.name}玩了一下。`);this.cb.notify(`${cat.name}開心地追著玩具跑！`);this.addFloater(cat.x,cat.y-55,'🎾 好好玩！');}}if(action==='pet'){const bite=Math.random()<getPersonality(cat).bite;if(bite){cat.mood='今天不想被摸';addPetEvent(this.state,`🦷 ${cat.name}突然咬了一口 XD`);addJournal(this.state,'🦷',`${cat.name}咬人`,`剛剛明明還在呼嚕，結果突然咬了一口。`);this.cb.notify(`🦷 ${cat.name}：「喀。」突然咬了一口 XD`);this.addFloater(cat.x,cat.y-55,'🦷 喀！');}else{cat.mood='正在呼嚕';addPetEvent(this.state,`${cat.name}被摸得很開心。`);this.cb.notify(`${cat.name}：呼嚕呼嚕 ❤️`);this.addFloater(cat.x,cat.y-55,'❤️ 呼嚕');}}saveState(this.state);this.cb.refresh();}

  draw(){const c=this.ctx;c.setTransform(this.scaleX,0,0,this.scaleY,0,0);c.clearRect(0,0,W,H);c.save();c.translate(-this.camera.x,-this.camera.y);this.drawWorld(c);this.drawCharacter(c,this.state.partner,true);this.drawCharacter(c,this.state.player,false);for(const cat of Object.values(this.state.cats))this.drawCat(c,cat);this.drawNPCs(c);this.drawInteractionMarker(c);this.drawFloaters(c);c.restore();}
  drawWorld(c){c.fillStyle='#b8d1b7';c.fillRect(0,0,WORLD_W,WORLD_H);for(let y=0;y<WORLD_H;y+=40)for(let x=0;x<WORLD_W;x+=40){c.fillStyle=((x/40+y/40)%2?'#b6ceb5':'#c1d7be');c.fillRect(x,y,40,40);}c.fillStyle='#92bcb7';c.fillRect(0,330,820,WORLD_H-660);c.fillStyle='#a6c6ae';c.fillRect(2780,180,WORLD_W-2780,WORLD_H-360);c.fillStyle='#d3c39f';c.fillRect(1340,0,150,WORLD_H);c.fillStyle='#d8c8a8';c.fillRect(0,1120,WORLD_W,120);c.save();c.translate(SCENE_OX,SCENE_OY);c.fillStyle='#96c4c2';c.fillRect(-920,-620,1840,70);c.fillStyle='#a8d2cf';for(let x=-920;x<920;x+=36)c.fillRect(x,-590,22,3);c.fillStyle='#e6d8bb';c.beginPath();c.ellipse(660,430,430,235,0,0,Math.PI*2);c.fill();c.strokeStyle='rgba(113,95,61,.28)';c.lineWidth=4;c.stroke();c.fillStyle='#d9c9a8';c.fillRect(610,215,100,215);c.fillRect(220,385,900,90);this.drawHouse(c,160,95,285,135,'公會之家','#7a8fb1');this.drawHouse(c,850,90,265,130,'雜貨商店','#ce9e63');this.drawBoard(c,500,185);this.drawPlot(c,480,80,280,78);this.drawPlot(c,1120,270,100,130);for(const [x,y] of [[90,270],[1160,250],[230,575],[1020,570]])this.drawLamp(c,x,y);for(const [x,y] of [[180,505],[1080,490]])this.drawBench(c,x,y);for(const [x,y,s] of [[60,100,1.1],[1140,110,.9],[80,620,.85],[1200,620,1.15],[350,250,.65],[945,500,.6]])this.drawTree(c,x,y,s);c.fillStyle='#aac0bb';c.beginPath();c.arc(660,430,48,0,Math.PI*2);c.fill();c.fillStyle='#84b3b1';c.beginPath();c.arc(660,430,35,0,Math.PI*2);c.fill();c.fillStyle='#fff0c2';c.beginPath();c.arc(660,430,7,0,Math.PI*2);c.fill();c.fillStyle='#5c5a4b';c.font='700 16px ui-rounded,system-ui';c.textAlign='center';c.fillText('星光旅團中央廣場',660,115);c.restore();for(const [x,y,s] of [[260,520,1.3],[520,1520,1.1],[2920,520,1.0],[3100,1650,1.35],[800,1980,1.2],[2500,2050,1.0],[100,1900,.9]])this.drawTree(c,x,y,s);this.drawHouse(c,110,980,230,120,'河畔小屋','#8c9aa6');this.drawHouse(c,2940,820,240,125,'旅行者之家','#b48768');this.drawBoard(c,2600,1360);}
  drawHouse(c,x,y,w,h,label,roof){c.fillStyle='#f5ecd8';c.fillRect(x,y,w,h);c.fillStyle=roof;c.beginPath();c.moveTo(x-12,y);c.lineTo(x+w/2,y-72);c.lineTo(x+w+12,y);c.closePath();c.fill();c.fillStyle='#8d6e5a';c.fillRect(x+w/2-24,y+70,48,60);c.fillStyle='#9fc8c5';c.fillRect(x+28,y+45,48,38);c.fillRect(x+w-76,y+45,48,38);c.fillStyle='#5f6b62';c.font='700 13px ui-rounded,system-ui';c.textAlign='center';c.fillText(label,x+w/2,y+h+22);}
  drawBoard(c,x,y){c.fillStyle='#7a5639';c.fillRect(x,y,190,76);c.fillStyle='#c39b67';c.fillRect(x+12,y+10,166,52);c.strokeStyle='#6b4b32';c.strokeRect(x+12,y+10,166,52);c.fillStyle='#fff1cb';c.font='700 15px ui-rounded,system-ui';c.textAlign='center';c.fillText('📜 公會委託板',x+95,y+42);c.fillStyle='#6b4b32';c.fillRect(x+95,y+76,8,45);}
  drawPlot(c,x,y,w,h){c.fillStyle='#7f9d73';c.fillRect(x,y,w,h);for(let yy=y+8;yy<y+h-4;yy+=24)for(let xx=x+8;xx<x+w-8;xx+=30){c.fillStyle=['#6f8d62','#809b66','#8fa66d'][(xx/30+yy/24)%3|0];c.fillRect(xx,yy,16,10);}}
  drawLamp(c,x,y){c.fillStyle='#655641';c.fillRect(x-4,y-55,8,55);c.fillStyle='#fff0c9';c.beginPath();c.arc(x,y-65,15,0,Math.PI*2);c.fill();c.fillStyle='#836d4f';c.beginPath();c.arc(x,y-65,6,0,Math.PI*2);c.fill();}
  drawBench(c,x,y){c.fillStyle='#8d6d4d';c.fillRect(x,y,72,10);c.fillRect(x,y+22,72,8);c.fillRect(x+5,y+29,7,20);c.fillRect(x+60,y+29,7,20);}
  drawTree(c,x,y,s){c.fillStyle='#6e523d';c.fillRect(x-7*s,y+24*s,14*s,34*s);c.fillStyle='#7da16f';for(const [dx,dy,r] of [[0,0,34],[28,6,28],[-26,8,28],[6,26,26]]){c.beginPath();c.arc(x+dx*s,y+dy*s,r*s,0,Math.PI*2);c.fill();}}

  drawNPCs(c){this.drawNPC(c,SCENE_OX+445,SCENE_OY+215,'公會管家','#fff1d8','#9a6a57');this.drawNPC(c,SCENE_OX+790,SCENE_OY+210,'雜貨商','#d9edcf','#6c815f');}
  drawNPC(c,x,y,name,shirt,apron){const bob=Math.sin(this.time/350+x)*1.2;c.save();c.translate(x,y+bob);c.fillStyle='rgba(46,61,50,.18)';c.beginPath();c.ellipse(0,20,18,7,0,0,Math.PI*2);c.fill();c.fillStyle=shirt;c.fillRect(-13,-2,26,25);c.fillStyle=apron;c.fillRect(-7,2,14,20);c.fillStyle='#c58f63';c.beginPath();c.arc(0,-14,12,0,Math.PI*2);c.fill();c.fillStyle='#5b4038';c.beginPath();c.arc(0,-19,12,Math.PI,Math.PI*2);c.fill();c.fillStyle='#fff4dd';c.fillRect(-9,14,7,12);c.fillRect(2,14,7,12);c.restore();c.fillStyle='#314238';c.font='800 10px ui-rounded,system-ui';c.textAlign='center';c.fillText(name,x,y-35);}
  drawCharacter(c,ch,isPartner){const moving=this.state.player===ch&&(this.keys.size>0||Math.hypot(this.joy.x,this.joy.y)>.1),step=moving?Math.sin(this.walkFrame*2)*2.2:0,bob=moving?Math.abs(Math.sin(this.walkFrame*2))*1.2:Math.sin(this.time/260+(isPartner?1:0))*1.2;c.save();c.translate(ch.x,ch.y+bob);c.fillStyle='rgba(46,61,50,.18)';c.beginPath();c.ellipse(0,20,18,7,0,0,Math.PI*2);c.fill();c.fillStyle=ch.shirt;c.fillRect(-12,-2,24,25);c.fillStyle=ch.skin;c.beginPath();c.arc(0,-14,12,0,Math.PI*2);c.fill();c.fillStyle='#4b3b36';c.beginPath();c.arc(-2,-20,11,Math.PI,Math.PI*2);c.fill();c.fillStyle='#f6eedf';c.fillRect(-9-step,14+Math.max(0,step),7,12);c.fillRect(2+step,14+Math.max(0,-step),7,12);c.restore();c.fillStyle='#2f4138';c.font='700 11px ui-rounded,system-ui';c.textAlign='center';c.fillText(ch.name,ch.x,ch.y-33);}
  drawCat(c,cat){const coat=getCoat(cat),bob=cat.state==='sleep'?0:Math.sin(this.time/190+cat.x)*1.7,near=this.nearPlayer(cat),sprite=cat.coat==='custom'?this.catImages[cat.id]:null;c.save();c.translate(cat.x,cat.y+bob);c.fillStyle='rgba(47,56,45,.16)';c.beginPath();c.ellipse(0,18,20,7,0,0,Math.PI*2);c.fill();if(sprite&&sprite.complete&&sprite.naturalWidth){const h=88,r=sprite.naturalWidth/sprite.naturalHeight,w=h*r;c.drawImage(sprite,-w/2,-h+18,w,h);}else{c.fillStyle=coat.base;c.beginPath();c.roundRect(-17,-10,34,30,12);c.fill();c.fillStyle=coat.dark;c.beginPath();c.arc(-7,-5,8,0,Math.PI*2);c.fill();c.fillStyle=coat.patch;c.beginPath();c.arc(9,4,7,0,Math.PI*2);c.fill();c.fillStyle='#2d342f';c.beginPath();c.arc(-7,0,2.4,0,Math.PI*2);c.arc(7,0,2.4,0,Math.PI*2);c.fill();c.fillStyle='#c98888';c.beginPath();c.arc(0,7,3,0,Math.PI*2);c.fill();}c.restore();c.fillStyle='#514d45';c.font='800 10px ui-rounded,system-ui';c.textAlign='center';c.fillText(cat.name,cat.x,cat.y-48);if(near&&Math.floor(this.time/800)%2===0){c.fillStyle='#ffcad2';c.font='18px system-ui';c.fillText('♥',cat.x+30,cat.y-30);}if(cat.state==='hungry'){c.fillStyle='#fff1c6';c.font='16px system-ui';c.fillText('🍖',cat.x,cat.y-62);}if(cat.state==='sleep'){c.fillStyle='#fff1c6';c.font='13px system-ui';c.fillText('Zzz',cat.x+24,cat.y-34);}}
  addFloater(x,y,text){this.floaters.push({x,y,text,life:1});}
  updateFloaters(dt){for(const f of this.floaters){f.y-=28*dt;f.life-=dt;}this.floaters=this.floaters.filter(f=>f.life>0);}
  drawFloaters(c){for(const f of this.floaters){c.save();c.globalAlpha=Math.max(0,f.life);c.fillStyle='#fff8df';c.font='900 13px ui-rounded,system-ui';c.textAlign='center';c.strokeStyle='rgba(45,57,49,.45)';c.lineWidth=3;c.strokeText(f.text,f.x,f.y);c.fillText(f.text,f.x,f.y);c.restore();}}
  drawInteractionMarker(c){const t=this.interactionTarget;if(!t)return;const y=t.y-48+Math.sin(this.interactionPulse*Math.PI)*3;const active=(this.state.tasks||[]).filter(x=>x.status==='accepted').length;const ready=(this.state.tasks||[]).filter(x=>x.status==='open').length;const label=t.type==='board'&&active?`E  ${t.label} · ${active}件可回報`:t.type==='board'&&ready?`E  ${t.label} · ${ready}件新委託`:`E  ${t.label}`;c.fillStyle='rgba(255,250,237,.94)';c.beginPath();c.roundRect(t.x-105,y-22,210,28,12);c.fill();c.fillStyle='#34493f';c.font='800 11px ui-rounded,system-ui';c.textAlign='center';c.fillText(label,t.x,y-4);c.fillStyle='#68766e';c.font='9px ui-rounded,system-ui';c.fillText(t.hint,t.x,y+10);}
}
