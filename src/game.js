import { addJournal, addPetEvent, saveState } from './state.js';
import { getCoat, getPersonality, setCatAnimation } from './cats.js';

const W = 1280, H = 720;
const WORLD_W = 1280, WORLD_H = 720;
const SCENE_OX = 0, SCENE_OY = 0;
const V050_SX = 1280 / 1672;
const V050_SY = 720 / 941;
const PLAYER_SPEED = 145;
const CAMERA_AHEAD_Y = 42;
const CAMERA_EASE = 10;
const INTERACT_RANGE = 105;
const clamp = (v,min,max)=>Math.max(min,Math.min(max,v));
const dist = (a,b)=>Math.hypot(a.x-b.x,a.y-b.y);

const OBSTACLES = [
  {x:440,y:205,w:190,h:115},
  {x:890,y:145,w:300,h:190},
  {x:790,y:515,w:270,h:145},
  {x:0,y:515,w:270,h:205},
];

const INTERACTABLES = [
  {id:'board', type:'board', x:610, y:275, label:'公會委託板', hint:'查看與接受委託'},
  {id:'guild-npc', type:'npc', x:535, y:245, label:'公會管家', hint:'聊聊公會任務'},
  {id:'shop-npc', type:'npc-shop', x:930, y:315, label:'雜貨商', hint:'看看商店'},
  {id:'guild-house', type:'house', x:350, y:390, label:'公會之家', hint:'這是你們的家'},
];

export class TownGame {
  constructor(canvas, state, callbacks) {
    this.canvas=canvas; this.ctx=canvas.getContext('2d'); this.state=state; this.cb=callbacks;
    this.keys=new Set(); this.joy={x:0,y:0}; this.time=0; this.lastPetBrain=0; this.lastSave=0;
    this.camera={x:0,y:0}; this.interactionTarget=null; this.interactionPulse=0; this.floaters=[]; this.dialogueTimer=0;
    this.playerFacing='down'; this.walkFrame=0; this.npcBrainAt=0; this.npcMotion={steward:0,merchant:0};
    this.actorVisuals=new Map();
    this.catImages={fly:new Image(),hu:new Image()};
    this.catImages.fly.src='/assets/fly.png'; this.catImages.hu.src='/assets/hu.png';
    this.worldArt=new Image(); this.worldArt.src='/assets/town-plaza.svg';
    this.referenceArt=new Image(); this.referenceArt.src='/assets/v050/reference-live-bg.png';
    this.v050Sprites={player:new Image(),partner:new Image(),cat1:new Image(),cat2:new Image()};
    this.v050Sprites.player.src='/assets/v050/player.png';
    this.v050Sprites.partner.src='/assets/v050/partner.png';
    this.v050Sprites.cat1.src='/assets/v050/cat1.png';
    this.v050Sprites.cat2.src='/assets/v050/cat2.png';
    this.resize(); window.addEventListener('resize',()=>this.resize());
    this.canvas.tabIndex=0; this.canvas.setAttribute('role','application');
    const movement=new Set(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight']);
    const isTextInput=el=>{
      if(!el) return false;
      if(el.isContentEditable) return true;
      const tag=(el.tagName||'').toLowerCase();
      if(tag==='textarea' || tag==='select') return true;
      if(tag==='input'){
        const type=(el.type||'text').toLowerCase();
        return !['button','submit','reset','checkbox','radio','range','file','color','hidden'].includes(type);
      }
      return !!el.closest?.('input,textarea,select,[contenteditable="true"]');
    };
    const keyDown=e=>{
      if(isTextInput(e.target)){ this.keys.clear(); return; }
      const code=e.code||'', key=(e.key||'').toLowerCase();
      if(movement.has(code)){this.keys.add(code);this.keys.add(key);e.preventDefault();}
      if(code==='KeyE'||key==='e'){e.preventDefault();this.interactNearest();}
    };
    const keyUp=e=>{
      this.keys.delete(e.code||'');
      this.keys.delete((e.key||'').toLowerCase());
    };
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

    const q=this.state.partner;if(!q.remote){const a=this.time/5200;q.x=705+Math.cos(a)*48;q.y=398+Math.sin(a*1.35)*28;}
    if(this.time-this.lastPetBrain>1800){this.lastPetBrain=this.time;this.decideCat();}
    for(const cat of Object.values(this.state.cats))this.updateCat(cat,dt);
    this.updateNPCs(dt);

    const targetCamX=0,targetCamY=0,ease=1-Math.exp(-dt*CAMERA_EASE);
    this.camera.x+=(targetCamX-this.camera.x)*ease;this.camera.y+=(targetCamY-this.camera.y)*ease;
    this.interactionTarget=this.findNearestInteractable();this.interactionPulse=(this.interactionPulse+dt)%2;
    this.updateFloaters(dt);
    if(this.state.settings?.reducedMotion) this.interactionPulse=0;
    if(this.time-this.lastSave>3000){this.lastSave=this.time;saveState(this.state);}
  }

  movePlayer(dx,dy){const p=this.state.player; const nextX={...p,x:clamp(p.x+dx,90,WORLD_W-90)}; if(!this.collides(nextX))p.x=nextX.x; const nextY={...p,y:clamp(p.y+dy,150,WORLD_H-150)}; if(!this.collides(nextY))p.y=nextY.y;}
  collides(actor){const r=16;return OBSTACLES.some(o=>actor.x+r>o.x&&actor.x-r<o.x+o.w&&actor.y+r>o.y&&actor.y-r<o.y+o.h);}
  nearestInteractableAt(p){return INTERACTABLES.reduce((best,i)=>!best||dist(i,p)<dist(best,p)?i:best,null);}
  findNearestInteractable(){const p=this.state.player;let best=null,bestD=Infinity;for(const i of INTERACTABLES){const d=dist(i,p);if(d<INTERACT_RANGE&&d<bestD){best=i;bestD=d;}}return best;}
  nearPlayer(cat){return [this.state.player,this.state.partner,...Object.values(this.state.remotePlayers||{})].some(p=>p&&dist(cat,p)<100);}
  interactNearest(){const target=this.findNearestInteractable();if(target)this.performInteraction(target);else {const cat=Object.values(this.state.cats).find(c=>this.nearPlayer(c));if(cat)this.cb.openPet(cat.id);else this.cb.notify('附近沒有可以互動的東西。');}}
  nearestCat(){const cats=Object.values(this.state.cats||{});let best=null,bestD=Infinity;for(const cat of cats){const d=dist(cat,this.state.player);if(d<bestD){best=cat;bestD=d;}}return best;}
  interactNearestCat(action){const cat=this.nearestCat();if(!cat){this.cb.notify('附近沒有貓咪。');return;}if(!this.nearPlayer(cat)){this.cb.notify(`${cat.name}還在遠處，走近一點再互動。`);return;}this.interactPet(cat.id,action);}
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


  updateNPCs(dt){
    const ns=this.state.npcState || (this.state.npcState={});
    const routes={steward:{home:{x:SCENE_OX+445,y:SCENE_OY+215},radius:52,speed:22},merchant:{home:{x:SCENE_OX+960,y:SCENE_OY+210},radius:42,speed:16}};
    for(const [id,r] of Object.entries(routes)){
      const n=ns[id] || (ns[id]={...r.home,mood:'巡視中'});
      const phase=this.time/2600+(id==='merchant'?1.7:0);
      const target={x:r.home.x+Math.cos(phase)*r.radius,y:r.home.y+Math.sin(phase*1.15)*r.radius*.55};
      const dx=target.x-n.x,dy=target.y-n.y,d=Math.hypot(dx,dy)||1;
      if(d>5){n.x+=dx/d*r.speed*dt;n.y+=dy/d*r.speed*dt;}
      n.mood=id==='steward'?(d>20?'巡視公會':'整理委託'):(d>18?'補充貨架':'招呼客人');
    }
  }

  decideCat(){
    const choices=[this.state.player,this.state.partner,...Object.values(this.state.remotePlayers||{})].filter(Boolean);
    for(const cat of Object.values(this.state.cats)){
      if(cat.animationUntil&&this.time<cat.animationUntil)continue;
      const personality=getPersonality(cat),r=Math.random();
      if(cat.energy<18){cat.state='sleep';cat.target=null;cat.wanderTarget=null;setCatAnimation(cat,'sleep',this.time);continue;}
      if(cat.hunger>75&&Math.random()<personality.hunger){cat.state='hungry';cat.target=choices[Math.floor(Math.random()*choices.length)];cat.wanderTarget=null;setCatAnimation(cat,'walk',this.time);continue;}
      if(r<personality.approach){cat.target=choices[Math.floor(Math.random()*choices.length)];cat.wanderTarget=null;cat.state='follow';setCatAnimation(cat,'walk',this.time);}
      else if(r<personality.approach+personality.wander){cat.target=null;cat.wanderTarget={x:260+Math.random()*760,y:250+Math.random()*360};cat.state='wander';setCatAnimation(cat,'walk',this.time);}
      else{cat.target=null;cat.wanderTarget=null;cat.state='idle';setCatAnimation(cat,'idle',this.time);}
    }
  }
  updateCat(cat,dt){
    if(cat.animationUntil&&this.time<cat.animationUntil){if(['pet','eat','play','bite'].includes(cat.animation))return;}
    else if(cat.animationUntil){cat.animationUntil=0;cat.actionText='';if(cat.state==='idle')setCatAnimation(cat,'idle',this.time);}
    const speed=cat.state==='sleep'?0:cat.state==='follow'||cat.state==='hungry'?58:34;
    if(cat.state==='follow'||cat.state==='hungry'){
      const t=cat.target;
      if(t){const dx=t.x-cat.x,dy=t.y-cat.y,d=Math.hypot(dx,dy);if(d>58){cat.facing=Math.abs(dx)>Math.abs(dy)?(dx<0?'left':'right'):dy<0?'up':'down';cat.x+=dx/d*speed*dt;cat.y+=dy/d*speed*dt;}else if(Math.random()<.0025){this.cb.notify(cat.state==='hungry'?`${cat.name}：喵～ 想吃飯了。`:`${cat.name}跑到你身邊撒嬌。`);addPetEvent(this.state,`${cat.name}跑去找人撒嬌。`);setCatAnimation(cat,'pet',this.time);}}
    }else if(cat.state==='wander'){
      setCatAnimation(cat,'walk',this.time);
      const t=cat.wanderTarget||{x:260+Math.random()*760,y:250+Math.random()*360};cat.wanderTarget=t;
      const dx=t.x-cat.x,dy=t.y-cat.y,d=Math.hypot(dx,dy)||1;
      if(d<14) cat.wanderTarget={x:260+Math.random()*760,y:250+Math.random()*360};
      else{cat.facing=Math.abs(dx)>Math.abs(dy)?(dx<0?'left':'right'):dy<0?'up':'down';cat.x+=dx/d*speed*dt;cat.y+=dy/d*speed*dt;}
    }
    if(cat.state==='sleep')setCatAnimation(cat,'sleep',this.time);
    cat.x=clamp(cat.x,140,1140);cat.y=clamp(cat.y,220,610);cat.hunger=clamp(cat.hunger+dt*.25,0,100);cat.energy=clamp(cat.energy+(cat.state==='sleep'?dt*2:-dt*.15),10,100);
  }

  interactPet(id,action){const cat=this.state.cats[id];if(!cat)return;if(!this.nearPlayer(cat)){this.cb.notify(`${cat.name}跑太遠了，靠近一點再互動。`);return;}if(action==='feed'){if(this.state.food<=0){this.cb.notify('貓罐頭吃完啦，先去商店補貨。');return;}this.state.food--;cat.hunger=clamp(cat.hunger-40,0,100);cat.energy=clamp(cat.energy+8,0,100);cat.state='idle';setCatAnimation(cat,'eat',this.time);addPetEvent(this.state,`${cat.name}吃飽了，開始舔毛。`);addJournal(this.state,'🍖',`${cat.name}吃飯`,`你餵了${cat.name}一份罐頭。`);this.cb.notify(`${cat.name}：呼嚕呼嚕…… 🍖`);this.addFloater(cat.x,cat.y-55,'🍖 好吃！');}if(action==='play'){cat.energy=clamp(cat.energy-10,0,100);cat.hunger=clamp(cat.hunger+8,0,100);cat.state='wander';setCatAnimation(cat,'play',this.time);if(Math.random()<.1){addPetEvent(this.state,`${cat.name}玩到一半突然不玩了。`);this.cb.notify(`${cat.name}突然走掉了 XD`);}else{addPetEvent(this.state,`${cat.name}今天玩得很開心。`);addJournal(this.state,'🎾',`${cat.name}玩耍`,`陪${cat.name}玩了一下。`);this.cb.notify(`${cat.name}開心地追著玩具跑！`);this.addFloater(cat.x,cat.y-55,'🎾 好好玩！');}}if(action==='pet'){const bite=Math.random()<getPersonality(cat).bite;if(bite){cat.mood='今天不想被摸';cat.state='idle';setCatAnimation(cat,'bite',this.time);addPetEvent(this.state,`🦷 ${cat.name}突然咬了一口 XD`);addJournal(this.state,'🦷',`${cat.name}咬人`,`剛剛明明還在呼嚕，結果突然咬了一口。`);this.cb.notify(`🦷 ${cat.name}：「喀。」突然咬了一口 XD`);this.addFloater(cat.x,cat.y-55,'🦷 喀！');}else{cat.mood='正在呼嚕';cat.state='idle';setCatAnimation(cat,'pet',this.time);addPetEvent(this.state,`${cat.name}被摸得很開心。`);this.cb.notify(`${cat.name}：呼嚕呼嚕 ❤️`);this.addFloater(cat.x,cat.y-55,'❤️ 呼嚕');}}saveState(this.state);this.cb.refresh();}

  draw(){
    const c=this.ctx;
    c.setTransform(this.scaleX,0,0,this.scaleY,0,0);
    c.clearRect(0,0,W,H);
    if(document.getElementById('app')?.classList.contains('v050-layered-mode')){
      if(this.referenceArt.complete && this.referenceArt.naturalWidth){
        c.drawImage(this.referenceArt,0,0,W,H);
        this.drawV050Actors(c);
        this.drawV050Interaction(c);
        this.drawFloaters(c);
      }else{ c.fillStyle='#17344a'; c.fillRect(0,0,W,H); }
      return;
    }
    c.save();c.translate(-this.camera.x,-this.camera.y);this.drawWorld(c);for(const rp of Object.values(this.state.remotePlayers||{})){if(rp?.remote)this.drawCharacter(c,rp,true);}if(this.state.partner?.remote && !(this.state.remotePlayers&&Object.keys(this.state.remotePlayers).length))this.drawCharacter(c,this.state.partner,true);this.drawCharacter(c,this.state.player,false);for(const cat of Object.values(this.state.cats))this.drawCat(c,cat);this.drawNPCs(c);this.drawInteractionMarker(c);this.drawFloaters(c);c.restore();
  }

  drawV050Actors(c){
    const drawSprite=(img,x,y,scale=1,flip=false,bob=0,breath=1)=>{
      if(!img?.complete||!img.naturalWidth)return;
      const w=img.naturalWidth*V050_SX*scale*breath, h=img.naturalHeight*V050_SY*scale;
      c.save(); c.translate(x,y+bob); c.scale(flip?-1:1,1); c.globalAlpha=.99;
      c.drawImage(img,-w/2,-h,w,h); c.restore();
    };
    const actorVisual=(id,actor,local=false)=>{
      const prev=this.actorVisuals.get(id)||{x:actor.x,y:actor.y,renderX:actor.x,renderY:actor.y,frame:0,dir:'down',lastMove:0};
      const dx=actor.x-prev.x,dy=actor.y-prev.y;
      const moved=local ? (this.keys.size>0||Math.hypot(this.joy.x,this.joy.y)>.1) : Math.hypot(dx,dy)>.2;
      if(moved){
        prev.frame+=.18;
        prev.lastMove=this.time;
        if(Math.abs(dx)>Math.abs(dy))prev.dir=dx<0?'left':'right';
        else if(Math.abs(dy)>.1)prev.dir=dy<0?'up':'down';
      }else prev.frame*=.84;
      const follow=.28;
      prev.renderX=local?actor.x:prev.renderX+(actor.x-prev.renderX)*follow;
      prev.renderY=local?actor.y:prev.renderY+(actor.y-prev.renderY)*follow;
      prev.x=actor.x; prev.y=actor.y; this.actorVisuals.set(id,prev);
      return {moved,prev};
    };
    const actors=[];
    const p=this.state.player;
    const pv=actorVisual('player',p,true);
    actors.push({kind:'player',id:'player',actor:p,visual:pv,img:this.v050Sprites.player,scale:1,name:p.name||document.getElementById('playerName')?.textContent||'我'});
    const q=this.state.partner;
    if(q){const qv=actorVisual('partner',q,false);actors.push({kind:'partner',id:'partner',actor:q,visual:qv,img:this.v050Sprites.partner,scale:.98,name:q.name||'另一半'});}
    for(const rp of Object.values(this.state.remotePlayers||{})){
      if(!rp?.remote)continue;
      const id=rp.user_id||rp.name||'remote';
      const rv=actorVisual(id,rp,false);
      actors.push({kind:'remote',id,actor:rp,visual:rv,img:this.v050Sprites.partner,scale:.98,name:rp.name||rp.display_name||'隊友'});
    }
    for(const cat of Object.values(this.state.cats||{})){
      const cv=actorVisual(cat.id,cat,false);
      const img=cat.id==='fly'?this.v050Sprites.cat1:this.v050Sprites.cat2;
      actors.push({kind:'cat',id:cat.id,actor:cat,visual:cv,img,scale:.165,name:cat.name});
    }
    actors.sort((a,b)=>(a.actor.y||0)-(b.actor.y||0));
    for(const a of actors){
      const {actor,visual}=a;
      const dir=visual.prev.dir||'down';
      const walking=visual.moved && a.kind!=='cat';
      const step=walking?Math.sin(visual.prev.frame*2.4):0;
      const bob=a.kind==='cat'
        ? (actor.animation==='play'?Math.abs(Math.sin(this.time/90))*4:actor.animation==='sleep'?0:Math.sin(this.time/260+(a.id==='hu'?1:0))*1.2)
        : (walking?Math.abs(Math.sin(visual.prev.frame*2.4))*1.7:Math.sin(this.time/520+a.id.length)*.55);
      const breath=a.kind==='cat'?1:(walking?1:1+Math.sin(this.time/850+a.id.length)*.012);
      const x=visual.prev.renderX,y=visual.prev.renderY;

      // Grounding shadow: always below the feet/paws.
      c.save();
      c.fillStyle='rgba(31,43,37,.22)';
      c.beginPath();
      c.ellipse(x,y+5,a.kind==='cat'?18:20,a.kind==='cat'?6:7,0,0,Math.PI*2);
      c.fill();
      c.restore();

      drawSprite(a.img,x,y,a.scale,dir==='left',bob+step*.35,breath);

      // Unified RPG nameplate: every live actor uses the same label style below the feet/paws.
      c.save();
      c.textAlign='center';
      c.font='900 10px ui-rounded,system-ui';
      const label=String(a.name||'').slice(0,10);
      const width=Math.max(48,c.measureText(label).width+20);
      const top=y+10;
      c.fillStyle='rgba(55,51,43,.94)';
      c.beginPath();
      c.roundRect(x-width/2,top,width,22,11);
      c.fill();
      c.fillStyle='#fff8e9';
      c.fillText(label,x,top+15);
      if(a.kind==='player'||a.kind==='partner'||a.kind==='remote'){
        c.fillStyle='#4fc78b';
        c.beginPath();
        c.arc(x+width/2-8,top+11,3,0,Math.PI*2);
        c.fill();
      }
      c.restore();
    }
  }
  drawV050Interaction(c){
    const t=this.interactionTarget;if(!t)return;
    const x=t.x,y=t.y-62,pulse=Math.sin(this.time/220)*2;
    c.save(); c.translate(x,y+pulse); c.fillStyle='rgba(20,34,46,.96)'; c.strokeStyle='rgba(255,255,255,.96)'; c.lineWidth=3;
    c.beginPath(); c.roundRect(-66,-28,132,54,18); c.fill(); c.stroke();
    c.fillStyle='#fff'; c.font='900 17px system-ui'; c.textAlign='center'; c.fillText('E  互動',0,7);
    c.fillStyle='rgba(20,34,46,.96)'; c.beginPath();c.moveTo(-10,26);c.lineTo(0,38);c.lineTo(10,26);c.closePath();c.fill(); c.restore();
  }
  drawWorld(c){
    // V0.4.4: illustrated RPG town scene. The world stays large, while the
    // camera reveals a richly layered local plaza instead of a flat tile map.
    c.fillStyle='#6f9868'; c.fillRect(0,0,WORLD_W,WORLD_H);
    for(let y=0;y<WORLD_H;y+=64) for(let x=0;x<WORLD_W;x+=64){
      c.fillStyle=((x/64+y/64)%2?'#79a16f':'#71996a'); c.fillRect(x,y,64,64);
    }
    // distant river district
    c.fillStyle='#4f9eb1'; c.fillRect(0,250,620,WORLD_H-480);
    for(let y=300;y<WORLD_H-260;y+=76){
      c.strokeStyle='rgba(190,242,235,.42)'; c.lineWidth=6; c.lineCap='round';
      c.beginPath(); c.moveTo(30+(y%4)*18,y); c.quadraticCurveTo(130,y-12,240,y+2); c.stroke();
      c.beginPath(); c.moveTo(310,y+30); c.quadraticCurveTo(430,y+18,560,y+34); c.stroke();
    }
    // town roads beyond the plaza
    this.drawRoad(c,1340,0,180,WORLD_H,'vertical');
    this.drawRoad(c,0,1110,WORLD_W,155,'horizontal');
    this.drawRoad(c,540,620,1120,112,'horizontal');
    this.drawRoad(c,980,0,112,860,'vertical');
    this.drawRoad(c,1840,520,112,820,'vertical');
    this.drawBridge(c,650,780,190,92,'horizontal');
    this.drawBridge(c,650,1580,190,92,'horizontal');

    // Main illustrated plaza.
    c.save(); c.translate(SCENE_OX,SCENE_OY);
    if(this.worldArt.complete && this.worldArt.naturalWidth){
      c.drawImage(this.worldArt,0,0,1320,760);
    }else{
      c.fillStyle='#d7c29a'; c.fillRect(0,0,1320,760);
    }
    // A few animated environmental details keep the still art alive.
    const pulse=.5+.5*Math.sin(this.time/650);
    c.fillStyle=`rgba(255,239,177,${.10+.08*pulse})`;
    for(const [x,y] of [[310,265],[1190,285],[475,577],[1030,582]]) c.beginPath(),c.arc(x,y,28+6*pulse,0,Math.PI*2),c.fill();
    // warm foreground petals / grass flecks
    for(let i=0;i<28;i++){
      const x=45+(i*83)%1220, y=120+(i*137)%620;
      c.fillStyle=i%2?'rgba(244,196,101,.7)':'rgba(238,145,158,.62)';
      c.beginPath(); c.arc(x,y,2.5+(i%3),0,Math.PI*2); c.fill();
    }
    c.restore();

    // Peripheral landmarks give the world the same lived-in density as the reference.
    for(const [x,y,s] of [[260,520,1.25],[520,1520,1.08],[2920,520,1.0],[3100,1650,1.3],[800,1980,1.15],[2500,2050,1.0],[100,1900,.9]]) this.drawTree(c,x,y,s);
    this.drawHouse(c,110,980,230,120,'河畔小屋','#7896a2');
    this.drawHouse(c,2940,820,240,125,'旅行者之家','#b37d61');
    this.drawHouse(c,2420,1580,260,125,'木工坊','#8c765c');
    this.drawBoard(c,2600,1360);
  }

  drawRoad(c,x,y,w,h,dir='horizontal'){
    c.fillStyle='#d9c7a4'; c.fillRect(x,y,w,h);
    c.fillStyle='rgba(255,248,222,.45)';
    if(dir==='horizontal'){ for(let xx=x+18;xx<x+w;xx+=52)c.fillRect(xx,y+h/2-2,28,4); }
    else { for(let yy=y+18;yy<y+h;yy+=52)c.fillRect(x+w/2-2,yy,4,28); }
    c.strokeStyle='rgba(112,91,61,.12)'; c.lineWidth=2; c.strokeRect(x,y,w,h);
  }
  drawBridge(c,x,y,w,h,dir='horizontal'){
    c.fillStyle='#7d6047'; c.fillRect(x,y,w,h);
    for(let xx=x+10;xx<x+w;xx+=28){c.fillStyle='#a37d58';c.fillRect(xx,y+8,18,h-16);}
    c.strokeStyle='#5e4836';c.lineWidth=4;c.strokeRect(x,y,w,h);
    c.fillStyle='#e9d9b5';c.fillRect(x,y+h/2-4,w,8);
  }
  drawStonePath(c,x1,y1,x2,y2,width){
    c.save(); c.strokeStyle='#e8dcc2'; c.lineWidth=width; c.lineCap='round'; c.beginPath(); c.moveTo(x1,y1); c.lineTo(x2,y2); c.stroke();
    c.strokeStyle='rgba(120,104,78,.16)'; c.lineWidth=2; c.stroke(); c.restore();
  }
  drawFlowerPatch(c,x,y,w,h){
    for(let i=0;i<Math.floor(w*h/550);i++){const px=x+(i*37)%w,py=y+(i*61)%h;c.fillStyle=i%3===0?'#e9a3a5':i%3===1?'#f1c86d':'#d8a8e2';c.beginPath();c.arc(px,py,3,0,Math.PI*2);c.fill();c.fillStyle='#66855c';c.fillRect(px-1,py+3,2,7);}
  }
  drawHouse(c,x,y,w,h,label,roof){c.fillStyle='#f5ecd8';c.fillRect(x,y,w,h);c.fillStyle=roof;c.beginPath();c.moveTo(x-12,y);c.lineTo(x+w/2,y-72);c.lineTo(x+w+12,y);c.closePath();c.fill();c.fillStyle='#8d6e5a';c.fillRect(x+w/2-24,y+70,48,60);c.fillStyle='#9fc8c5';c.fillRect(x+28,y+45,48,38);c.fillRect(x+w-76,y+45,48,38);c.fillStyle='#5f6b62';c.font='700 13px ui-rounded,system-ui';c.textAlign='center';c.fillText(label,x+w/2,y+h+22);}
  drawBoard(c,x,y){c.fillStyle='#7a5639';c.fillRect(x,y,190,76);c.fillStyle='#c39b67';c.fillRect(x+12,y+10,166,52);c.strokeStyle='#6b4b32';c.strokeRect(x+12,y+10,166,52);c.fillStyle='#fff1cb';c.font='700 15px ui-rounded,system-ui';c.textAlign='center';c.fillText('📜 公會委託板',x+95,y+42);c.fillStyle='#6b4b32';c.fillRect(x+95,y+76,8,45);}
  drawPlot(c,x,y,w,h){c.fillStyle='#7f9d73';c.fillRect(x,y,w,h);for(let yy=y+8;yy<y+h-4;yy+=24)for(let xx=x+8;xx<x+w-8;xx+=30){c.fillStyle=['#6f8d62','#809b66','#8fa66d'][(xx/30+yy/24)%3|0];c.fillRect(xx,yy,16,10);}}
  drawLamp(c,x,y){c.fillStyle='#655641';c.fillRect(x-4,y-55,8,55);c.fillStyle='#fff0c9';c.beginPath();c.arc(x,y-65,15,0,Math.PI*2);c.fill();c.fillStyle='#836d4f';c.beginPath();c.arc(x,y-65,6,0,Math.PI*2);c.fill();}
  drawBench(c,x,y){c.fillStyle='#8d6d4d';c.fillRect(x,y,72,10);c.fillRect(x,y+22,72,8);c.fillRect(x+5,y+29,7,20);c.fillRect(x+60,y+29,7,20);}
  drawTree(c,x,y,s){c.fillStyle='#6e523d';c.fillRect(x-7*s,y+24*s,14*s,34*s);c.fillStyle='#7da16f';for(const [dx,dy,r] of [[0,0,34],[28,6,28],[-26,8,28],[6,26,26]]){c.beginPath();c.arc(x+dx*s,y+dy*s,r*s,0,Math.PI*2);c.fill();}}

  drawNPCs(c){const ns=this.state.npcState||{}; const a=ns.steward||{x:SCENE_OX+445,y:SCENE_OY+215,mood:'巡視中'}, b=ns.merchant||{x:SCENE_OX+960,y:SCENE_OY+210,mood:'整理商品'}; this.drawNPC(c,a.x,a.y,'公會管家','#fff1d8','#9a6a57',a.mood);this.drawNPC(c,b.x,b.y,'雜貨商','#d9edcf','#6c815f',b.mood);}
  drawNPC(c,x,y,name,shirt,apron,mood=''){const bob=Math.sin(this.time/350+x)*1.2;c.save();c.translate(x,y+bob);c.scale(1.18,1.18);c.fillStyle='rgba(46,61,50,.18)';c.beginPath();c.ellipse(0,20,18,7,0,0,Math.PI*2);c.fill();c.fillStyle=shirt;c.fillRect(-13,-2,26,25);c.fillStyle=apron;c.fillRect(-7,2,14,20);c.fillStyle='#c58f63';c.beginPath();c.arc(0,-14,12,0,Math.PI*2);c.fill();c.fillStyle='#5b4038';c.beginPath();c.arc(0,-19,12,Math.PI,Math.PI*2);c.fill();c.fillStyle='#fff4dd';c.fillRect(-9,14,7,12);c.fillRect(2,14,7,12);c.restore();c.fillStyle='#314238';c.font='800 10px ui-rounded,system-ui';c.textAlign='center';c.fillText(name,x,y-35); if(mood){c.fillStyle='#68766e';c.font='700 8px ui-rounded,system-ui';c.fillText(mood,x,y-47);} }
  drawCharacter(c,ch,isPartner){
    const id=ch.user_id||(isPartner?'partner':'player');
    const local=this.state.player===ch;
    const prev=this.actorVisuals.get(id);
    const dx=prev?ch.x-prev.x:0, dy=prev?ch.y-prev.y:0;
    const moved=local ? (this.keys.size>0||Math.hypot(this.joy.x,this.joy.y)>.1) : Math.hypot(dx,dy)>.35;
    const visual=prev||{x:ch.x,y:ch.y,frame:0,dir:'down'};
    if(moved){
      visual.frame+=0.22;
      if(Math.abs(dx)>Math.abs(dy)) visual.dir=dx<0?'left':'right';
      else if(Math.abs(dy)>0.1) visual.dir=dy<0?'up':'down';
    }else visual.frame=0;
    visual.x=ch.x; visual.y=ch.y; this.actorVisuals.set(id,visual);

    const walk=moved?Math.sin(visual.frame*Math.PI)*3.8:0;
    const bob=moved?Math.abs(Math.sin(visual.frame*Math.PI))*1.8:Math.sin(this.time/320+(isPartner?1:0))*0.7;
    const dir=visual.dir||'down';
    const skin=ch.skin|| (isPartner?'#d29a70':'#e2ad7b');
    const hair=isPartner?'#3b2c31':'#6b4435';
    const shirt=isPartner?'#d96f72':'#557c67';
    const accent=isPartner?'#f2b6aa':'#f0bd68';

    c.save();
    c.translate(ch.x,ch.y+bob);
    c.scale(1.55,1.55);

    // soft contact shadow
    c.fillStyle='rgba(44,49,43,.22)';
    c.beginPath(); c.ellipse(0,31,25,9,0,0,Math.PI*2); c.fill();

    if(dir==='up'){
      // back-facing adventurer
      c.fillStyle='#49362f'; c.beginPath(); c.ellipse(0,-18,16,14,0,0,Math.PI*2); c.fill();
      c.fillStyle=shirt; c.beginPath(); c.roundRect(-17,-5,34,34,10); c.fill();
      c.fillStyle=accent; c.fillRect(-10,1,20,4);
      c.fillStyle='#f1d3b4'; c.fillRect(-11,26,8,15); c.fillRect(3,26,8,15);
      c.fillStyle='#51413d'; c.fillRect(-12,40,10,4); c.fillRect(2,40,10,4);
      c.fillStyle=accent; c.beginPath(); c.roundRect(-21,-2,6,18,3); c.fill();
    } else if(dir==='left'||dir==='right'){
      const side=dir==='left'?-1:1;
      // legs behind body
      c.fillStyle='#f1d3b4'; c.fillRect(-11-walk,23,8,16); c.fillRect(3+walk,23,8,16);
      c.fillStyle='#51413d'; c.fillRect(-13-walk,38,11,5); c.fillRect(2+walk,38,11,5);
      // torso / coat
      c.fillStyle=shirt; c.beginPath(); c.roundRect(-16,-4,32,31,10); c.fill();
      c.fillStyle=accent; c.fillRect(side*7,-1,6,24);
      c.fillStyle='rgba(255,255,255,.38)'; c.fillRect(-11,-1,22,3);
      // head + hair
      c.fillStyle=skin; c.beginPath(); c.arc(side*1,-18,15,0,Math.PI*2); c.fill();
      c.fillStyle=hair; c.beginPath(); c.arc(side*1,-23,16,Math.PI,Math.PI*2); c.fill();
      c.fillRect(side*11,-25,5,12);
      c.fillStyle='#2e2728'; c.beginPath(); c.arc(side*12,-18,2.4,0,Math.PI*2); c.fill();
      // arm
      c.fillStyle=skin; c.beginPath(); c.roundRect(side*13,-1,7,20,4); c.fill();
    } else {
      // legs / shoes
      c.fillStyle='#f1d3b4'; c.fillRect(-11-walk,23,8,16); c.fillRect(3+walk,23,8,16);
      c.fillStyle='#51413d'; c.fillRect(-13-walk,38,11,5); c.fillRect(2+walk,38,11,5);
      // body
      c.fillStyle=shirt; c.beginPath(); c.roundRect(-17,-4,34,31,11); c.fill();
      c.fillStyle=accent; c.beginPath(); c.roundRect(-8,0,16,24,5); c.fill();
      c.fillStyle='rgba(255,255,255,.42)'; c.fillRect(-11,-1,22,3);
      // arms with subtle swing
      c.fillStyle=skin; c.beginPath(); c.roundRect(-23,0,7,20+walk*.5,4); c.fill();
      c.beginPath(); c.roundRect(16,0,7,20-walk*.5,4); c.fill();
      // head
      c.fillStyle=skin; c.beginPath(); c.arc(0,-19,15.5,0,Math.PI*2); c.fill();
      // hair silhouette + bangs
      c.fillStyle=hair; c.beginPath(); c.arc(0,-25,17,Math.PI,Math.PI*2); c.fill();
      c.fillRect(-16,-25,5,12); c.fillRect(11,-25,5,12);
      if(isPartner){
        c.fillRect(-19,-19,6,23); c.fillRect(13,-19,6,23);
        c.fillStyle='#ef9da8'; c.beginPath(); c.arc(-17,-12,3,0,Math.PI*2); c.arc(17,-12,3,0,Math.PI*2); c.fill();
      } else {
        c.fillStyle=hair; c.beginPath(); c.moveTo(-12,-28); c.lineTo(-4,-37); c.lineTo(0,-28); c.lineTo(7,-37); c.lineTo(13,-27); c.closePath(); c.fill();
      }
      // eyes / blush / smile
      c.fillStyle='#2f2728'; c.beginPath(); c.arc(-5,-18,2.4,0,Math.PI*2); c.arc(5,-18,2.4,0,Math.PI*2); c.fill();
      c.fillStyle='rgba(232,116,126,.55)'; c.beginPath(); c.arc(-9,-12,3,0,Math.PI*2); c.arc(9,-12,3,0,Math.PI*2); c.fill();
      c.strokeStyle='#754c49'; c.lineWidth=1.6; c.beginPath(); c.arc(0,-12,4,0.15,Math.PI-0.15); c.stroke();
      // scarf / collar
      c.fillStyle=accent; c.beginPath(); c.roundRect(-9,-6,18,6,3); c.fill();
    }

    // tiny adventurer accessory / guild token
    c.fillStyle=accent; c.beginPath(); c.arc(-17,-1,4,0,Math.PI*2); c.fill();
    c.fillStyle='#fff1bc'; c.beginPath(); c.arc(-17,-1,1.6,0,Math.PI*2); c.fill();
    c.restore();

    // readable RPG nameplate
    const plateW=Math.max(78,Math.min(118,(ch.name||'玩家').length*14+28));
    c.fillStyle='rgba(255,250,237,.94)';
    c.beginPath(); c.roundRect(ch.x-plateW/2,ch.y-72,plateW,21,11); c.fill();
    c.fillStyle='#263b34'; c.font='900 11px ui-rounded,system-ui'; c.textAlign='center'; c.fillText(ch.name||'玩家',ch.x,ch.y-57);
    if(ch.remote){c.fillStyle='#43c98b';c.beginPath();c.arc(ch.x+plateW/2-9,ch.y-61,4,0,Math.PI*2);c.fill();}
  }
  drawCat(c,cat){const coat=getCoat(cat),anim=cat.animation||cat.state||'idle',t=this.time/1000,phase=(cat.id==='fly'?0:.9),near=this.nearPlayer(cat),sprite=cat.coat==='custom'?this.catImages[cat.id]:null;let bob=0,sx=1,sy=1,rot=0;if(anim==='walk'){bob=Math.abs(Math.sin(t*10+phase))*3;sx=1+Math.sin(t*10+phase)*.025;sy=1-Math.sin(t*10+phase)*.035;}else if(anim==='eat'){bob=Math.sin(t*16+phase)*1.5;sx=1+.05*Math.sin(t*12);sy=1-.06*Math.sin(t*12);}else if(anim==='play'){bob=Math.abs(Math.sin(t*12+phase))*7;rot=Math.sin(t*8+phase)*.08;sx=1.06;sy=.94;}else if(anim==='pet'){bob=Math.sin(t*7+phase)*2;sx=1+.04*Math.sin(t*8);sy=1+.02*Math.sin(t*8);}else if(anim==='bite'){rot=Math.sin(t*26+phase)*.13;sx=1.08;sy=.92;}else if(anim==='sleep'){bob=Math.sin(t*2+phase)*1.2;sy=.94;sx=1.03;}else bob=Math.sin(t*3+phase)*1.3;c.save();c.translate(cat.x,cat.y+bob);c.rotate(rot);c.scale(sx,sy);c.fillStyle='rgba(47,56,45,.16)';c.beginPath();c.ellipse(0,18,20,7,0,0,Math.PI*2);c.fill();if(sprite&&sprite.complete&&sprite.naturalWidth){const h=108,r=sprite.naturalWidth/sprite.naturalHeight,w=h*r;c.drawImage(sprite,-w/2,-h+18,w,h);}else{c.fillStyle=coat.base;c.beginPath();c.roundRect(-17,-10,34,30,12);c.fill();c.fillStyle=coat.dark;c.beginPath();c.arc(-7,-5,8,0,Math.PI*2);c.fill();c.fillStyle=coat.patch;c.beginPath();c.arc(9,4,7,0,Math.PI*2);c.fill();c.fillStyle='#2d342f';c.beginPath();c.arc(-7,0,2.4,0,Math.PI*2);c.arc(7,0,2.4,0,Math.PI*2);c.fill();c.fillStyle='#c98888';c.beginPath();c.arc(0,7,3,0,Math.PI*2);c.fill();}c.restore();c.fillStyle='#514d45';c.font='800 10px ui-rounded,system-ui';c.textAlign='center';c.fillText(cat.name,cat.x,cat.y-48);if(near&&Math.floor(this.time/800)%2===0){c.fillStyle='#ffcad2';c.font='18px system-ui';c.fillText('♥',cat.x+30,cat.y-30);}if(cat.state==='hungry'){c.fillStyle='#fff1c6';c.font='16px system-ui';c.fillText('🍖',cat.x,cat.y-62);}if(anim==='sleep'){c.fillStyle='#fff1c6';c.font='13px system-ui';c.fillText('Zzz',cat.x+24,cat.y-34);}if(['pet','eat','play','bite'].includes(anim)&&cat.actionText){c.fillStyle='#fff7df';c.font='17px system-ui';c.fillText(cat.actionText,cat.x+30,cat.y-35);}}
  addFloater(x,y,text){this.floaters.push({x,y,text,life:1});}
  updateFloaters(dt){for(const f of this.floaters){f.y-=28*dt;f.life-=dt;}this.floaters=this.floaters.filter(f=>f.life>0);}
  drawFloaters(c){for(const f of this.floaters){c.save();c.globalAlpha=Math.max(0,f.life);c.fillStyle='#fff8df';c.font='900 13px ui-rounded,system-ui';c.textAlign='center';c.strokeStyle='rgba(45,57,49,.45)';c.lineWidth=3;c.strokeText(f.text,f.x,f.y);c.fillText(f.text,f.x,f.y);c.restore();}}
  drawInteractionMarker(c){const t=this.interactionTarget;if(!t)return;const y=t.y-48+Math.sin(this.interactionPulse*Math.PI)*3;const active=(this.state.tasks||[]).filter(x=>x.status==='accepted').length;const ready=(this.state.tasks||[]).filter(x=>x.status==='open').length;const label=t.type==='board'&&active?`E  ${t.label} · ${active}件可回報`:t.type==='board'&&ready?`E  ${t.label} · ${ready}件新委託`:`E  ${t.label}`;c.fillStyle='rgba(255,250,237,.94)';c.beginPath();c.roundRect(t.x-105,y-22,210,28,12);c.fill();c.fillStyle='#34493f';c.font='800 11px ui-rounded,system-ui';c.textAlign='center';c.fillText(label,t.x,y-4);c.fillStyle='#68766e';c.font='9px ui-rounded,system-ui';c.fillText(t.hint,t.x,y+10);}
}
