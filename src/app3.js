/* ========== 灯箱 ========== */
let LB=null;
function openLightbox(id){
 const e=S.entries.find(x=>x.id===id);if(!e)return;
 if(!LB){const ov=document.createElement('div');ov.className='overlay lb';ov.innerHTML=`<div class="lb-stage"><div class="zoom-stage"><img alt="" draggable="false"></div>
  <div class="lb-top"><span id="lbCount" class="glass-dark"></span><span class="glass-dark keys">滚轮缩放 · 拖拽平移 · 双击放大 · ←/→ 切换 · Esc 关闭</span></div>
  <button class="lb-nav prev glass-dark" title="上一张 (←)">‹</button><button class="lb-nav next glass-dark" title="下一张 (→)">›</button>
  <div class="lb-tools glass-dark"><button data-z="out" title="缩小 (-)">－</button><span class="pct">100%</span><button data-z="in" title="放大 (+)">＋</button><span class="sep"></span><button data-z="fit" title="适应窗口 (0)">适应</button><button data-z="1" title="原始尺寸 (1)">1:1</button></div></div>
  <div class="lb-panel"></div><button class="icon-btn close-x glass-dark" title="关闭 (Esc)">✕</button>`;
  document.body.appendChild(ov);
  const img=$('.zoom-stage img',ov);
  const z=new Zoomer($('.zoom-stage',ov),img,zz=>$('.pct',ov).textContent=zz.pct()+'%');
  const api={el:ov,kind:'lb',close(){ov.remove();const i=modalStack.indexOf(api);if(i>=0)modalStack.splice(i,1);LB=null},
   onKey(k){if(['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName))return;
    if(k.key==='ArrowLeft'){k.preventDefault();navLB(-1)}else if(k.key==='ArrowRight'){k.preventDefault();navLB(1)}
    else if(k.key==='+'||k.key==='=')z.zoomAt(z.s*1.25);else if(k.key==='-')z.zoomAt(z.s/1.25);else if(k.key==='0')z.reset();else if(k.key==='1')z.actual()}};
  LB={api,z,img,ov,id};modalStack.push(api);
  $('.prev',ov).onclick=()=>navLB(-1);$('.next',ov).onclick=()=>navLB(1);$('.close-x',ov).onclick=()=>api.close();
  $('.lb-tools',ov).onclick=ev=>{const k=ev.target.dataset.z;if(k==='in')z.zoomAt(z.s*1.25);else if(k==='out')z.zoomAt(z.s/1.25);else if(k==='fit')z.reset();else if(k==='1')z.actual()};
  img.onload=()=>$('.pct',ov).textContent=z.pct()+'%';
  $('.lb-panel',ov).addEventListener('click',async ev=>{const a=ev.target.closest('[data-lb]')?.dataset.lb;if(!a||!LB)return;const id=LB.id;
   if(a==='edit')openEntryForm([id]);
   else if(a==='best')toggleBest(id);
   else if(a==='del'){const list=lbList();const i=list.findIndex(x=>x.id===id);if(await deleteEntry(id)){const nl=list.filter(x=>x.id!==id);if(!nl.length)LB.api.close();else{LB.id=nl[Math.min(i,nl.length-1)].id;refreshLightbox(true)}}}
   else if(a==='dl'){const en=S.entries.find(x=>x.id===id);const aEl=document.createElement('a');aEl.href=urlOf(en);aEl.download=en.fileName||(en.model+'.png');document.body.appendChild(aEl);aEl.click();aEl.remove()}
   else if(a==='pick'){if(S.picked.has(id))S.picked.delete(id);else if(S.picked.size<4)S.picked.add(id);else toast('最多同时对比 4 张');renderMain();refreshLightbox()}});
 }
 LB.id=id;refreshLightbox(true);
}
function lbList(){const e=S.entries.find(x=>x.id===LB?.id);return e?sortEntries(entriesOf(e.setId)):[]}
function navLB(d){const l=lbList();if(l.length<2)return;const i=l.findIndex(x=>x.id===LB.id);LB.id=l[(i+d+l.length)%l.length].id;refreshLightbox(true)}
function refreshLightbox(resetZoom){
 if(!LB)return;const e=S.entries.find(x=>x.id===LB.id);if(!e){LB.api.close();return}
 const l=lbList();const i=l.findIndex(x=>x.id===e.id);const best=computeBest(entriesOf(e.setId));const s=S.sets.find(x=>x.id===e.setId)||{};
 if(LB.img.getAttribute('src')!==urlOf(e)){LB.img.src=urlOf(e);LB.img.style.animation='none';void LB.img.offsetWidth;LB.img.style.animation=''}if(resetZoom)LB.z.reset();
 $('#lbCount').textContent=`${i+1} / ${l.length} · ${s.title||''}`;
 const kv=parseParams(e.params);
 const metric=(k,v,hl,tag)=>`<div class="metric ${hl?'hl':''}"><div class="k">${k}</div><div class="v">${v}</div>${hl?`<div class="tagline">✓ ${tag}</div>`:''}</div>`;
 $('.lb-panel',LB.ov).innerHTML=`<div class="row">${e.best?'<span class="badge gold">🏆 本组最佳</span>':''}${s.sample?'<span class="badge warn">示例数据</span>':''}</div>
  <h2>${esc(e.model||'未命名模型')}</h2><div class="prov">${esc(e.provider||'未填写平台')}</div>${stars(e.score,'lg')}${best.score.has(e.id)?' <span class="badge" style="color:var(--good);background:var(--goodbg)">本组最高分</span>':''}
  <div class="metrics">${metric('成本 / 张',fmtCost(e),best.cheap.has(e.id),'本组最便宜')}${metric('生成耗时',fmtTime(e.time),best.fast.has(e.id),'本组最快')}
   ${metric('分辨率',fmtRes(e)+`<div class="hint">${mp(e)}</div>`,best.res.has(e.id),'本组最高')}${metric('画面比例',aspect(e))}</div>
  <div class="sec"><h3>默认设置 / 参数</h3>${kv?`<table class="kv">${kv.map(([k,v])=>`<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join('')}</table>`:`<div class="txt">${esc(e.params||'—')}</div>`}</div>
  ${e.pros?`<div class="sec pros"><h3>👍 优点</h3><div class="txt">${esc(e.pros)}</div></div>`:''}
  ${e.cons?`<div class="sec cons"><h3>👎 缺点</h3><div class="txt">${esc(e.cons)}</div></div>`:''}
  ${e.notes?`<div class="sec"><h3>📝 备注</h3><div class="txt">${esc(e.notes)}</div></div>`:''}
  <div class="sec"><h3>提示词</h3>${clampBox('lb:prompt',s.prompt||'—',2)}</div>${s.negative?`<div class="sec"><h3>反向提示词</h3>${clampBox('lb:neg',s.negative,1)}</div>`:''}
  <div class="sec hint">文件：${esc(e.fileName||'—')}</div>
  <div class="lb-actions"><button class="btn primary" data-lb="edit">✎ 编辑信息</button><button class="btn" data-lb="best">${e.best?'取消最佳':'🏆 设为最佳'}</button><button class="btn" data-lb="pick">${S.picked.has(e.id)?'✓ 已加入对比':'⇆ 加入对比'}</button><button class="btn" data-lb="dl">⬇ 下载原图</button><button class="btn danger" data-lb="del">🗑 删除</button></div>`;
 fixClamps(LB.ov);
}

/* ========== 并排对比 ========== */
function openCompare(ids){
 const es=ids.map(id=>S.entries.find(e=>e.id===id)).filter(Boolean);if(es.length<2)return;
 const best=computeBest(entriesOf(es[0].setId));
 const ov=document.createElement('div');ov.className='overlay cmp';
 const cols=es.length===4&&innerWidth<1400?2:es.length;
 ov.innerHTML=`<div class="cmp-bar"><b>⇆ 并排对比（${es.length} 张）</b><label><input type="checkbox" id="cmpSync" checked> 同步缩放 / 平移</label><button class="btn sm" id="cmpReset">重置视图</button><span class="hint">滚轮缩放 · 拖拽平移 · 双击放大</span><div class="spacer"></div><button class="btn" data-close>关闭 (Esc)</button></div>
 <div class="cmp-grid" style="grid-template-columns:repeat(${cols},minmax(0,1fr))">${es.map(e=>`<div class="cmp-pane ${e.best?'is-best':''}"><div class="cmp-head"><b>${e.best?'🏆 ':''}${esc(e.model)}</b>${stars(e.score)}<span class="chip ${best.cheap.has(e.id)?'hl':''}">💰 ${fmtCost(e)}</span><span class="chip ${best.fast.has(e.id)?'hl':''}">⚡ ${fmtTime(e.time)}</span><span class="chip ${best.res.has(e.id)?'hl':''}">🔍 ${fmtRes(e)}</span></div>
  <div class="cmp-stage"><div class="zoom-stage"><img src="${urlOf(e)}" alt="" draggable="false"></div></div></div>`).join('')}</div>`;
 document.body.appendChild(ov);
 const zs=[];const sync=$('#cmpSync',ov);
 $$('.cmp-stage .zoom-stage',ov).forEach(st=>{zs.push(new Zoomer(st,$('img',st),z=>{if(sync.checked)zs.forEach(o=>o!==z&&o.set(z))}))});
 const api={el:ov,kind:'cmp',close(){ov.remove();const i=modalStack.indexOf(api);if(i>=0)modalStack.splice(i,1)}};
 modalStack.push(api);
 ov.addEventListener('click',e=>{if(e.target.closest('[data-close]'))api.close()});
 $('#cmpReset',ov).onclick=()=>zs.forEach(z=>z.reset());
}

/* ========== 模型库 ========== */
async function saveModel(m,quiet){m={...m,name:String(m.name).trim()};if(!m.name)return;const old=modelByName(m.name);if(old&&old.name!==m.name)await idb.del('models',old.name);
 await idb.put('models',m);S.models=S.models.filter(x=>x.name.toLowerCase()!==m.name.toLowerCase());S.models.push(m);renderDatalist();if(!quiet)toast('模型库已更新')}
function openModelLib(){
 const m=showModal({wide:true,title:'📚 模型库',body:'<div id="libBody"></div>',footer:`<button class="btn danger" id="libWipe" style="margin-right:auto">清空全部数据…</button><button class="btn" id="libFromEntries">从已有记录收集模型</button><button class="btn primary" id="libAdd">＋ 添加模型</button>`});
 const draw=()=>{const ms=[...S.models].sort((a,b)=>a.name.localeCompare(b.name,'zh-Hans'));
  $('#libBody',m.el).innerHTML=`<p class="hint">保存常用模型的平台、默认成本和默认参数。之后添加图片时，文件名或模型名匹配到这里的模型会自动填写。</p>
  ${ms.length?`<div class="tbl-wrap"><table class="lib-table"><thead><tr><th>模型</th><th>平台</th><th>默认成本</th><th>默认参数</th><th>出图记录</th><th></th></tr></thead><tbody>${ms.map(x=>`<tr style="cursor:default"><td><b>${esc(x.name)}</b></td><td>${esc(x.provider||'—')}</td><td class="num">${fmtCost(x)}</td><td class="params">${esc(x.params||'—')}</td><td>${S.entries.filter(e=>(e.model||'').toLowerCase()===x.name.toLowerCase()).length}</td><td style="white-space:nowrap"><button class="btn sm" data-me="${esc(x.name)}">编辑</button> <button class="btn sm danger" data-md="${esc(x.name)}">删除</button></td></tr>`).join('')}</tbody></table></div>`:'<div class="empty" style="margin:30px auto"><p>模型库还是空的。填写出图信息时勾选「保存到模型库」即可自动加入，或点下方「添加模型」。</p></div>'}`};
 draw();
 $('#libBody',m.el).onclick=async ev=>{const ed=ev.target.dataset.me,dl=ev.target.dataset.md;
  if(ed)editModel(modelByName(ed),draw);
  if(dl&&confirm(`从模型库删除「${dl}」？（不会影响已有的出图记录）`)){await idb.del('models',dl);S.models=S.models.filter(x=>x.name!==dl);renderDatalist();draw()}};
 $('#libAdd',m.el).onclick=()=>editModel(null,draw);
 $('#libFromEntries',m.el).onclick=async()=>{let n=0;for(const e of S.entries){if(e.model&&!modelByName(e.model)){await saveModel({name:e.model,provider:e.provider,cost:e.cost,currency:e.currency,params:e.params},true);n++}}draw();toast(n?`已收集 ${n} 个模型`:'没有新的模型')};
 $('#libWipe',m.el).onclick=async()=>{if(!confirm('将清空本浏览器中所有对比组、图片和模型库！建议先「导出」备份。确定继续？'))return;if(!confirm('再次确认：真的清空全部数据吗？'))return;
  for(const s of ['sets','entries','models'])await idb.clear(s);urls.forEach(u=>URL.revokeObjectURL(u));urls.clear();S.sets=[];S.entries=[];S.models=[];S.cur=null;m.close();renderAll();toast('已清空')};
}
function editModel(x,after){const isNew=!x;x=x||{name:'',provider:'',cost:null,currency:'$',params:''};
 const m=showModal({title:isNew?'添加模型':'编辑模型',body:`<form class="form" id="mf"><label>模型名称 *<input name="name" value="${esc(x.name)}"></label><label>平台 / 服务商<input name="provider" value="${esc(x.provider)}"></label>
  <div class="g2"><label>默认成本（每张）<input name="cost" type="number" step="any" min="0" value="${x.cost??''}"></label><label>单位<select name="currency">${CURRENCIES.map(c=>`<option value="${c}" ${(x.currency||'$')===c?'selected':''}>${c==='$'?'$ 美元':c==='¥'?'¥ 人民币':c}</option>`).join('')}</select></label></div>
  <label>默认设置 / 参数 <small>每行「键: 值」</small><textarea name="params" rows="4">${esc(x.params)}</textarea></label></form>`,footer:`<button class="btn" data-close>取消</button><button class="btn primary" id="mfSave">保存</button>`});
 $('#mfSave',m.el).onclick=async()=>{const d=Object.fromEntries(new FormData($('#mf',m.el)));if(!d.name.trim()){toast('请填写模型名称');return}
  if(!isNew&&d.name.trim()!==x.name){await idb.del('models',x.name);S.models=S.models.filter(y=>y.name!==x.name)}
  await saveModel({name:d.name.trim(),provider:d.provider.trim(),cost:numOrNull(d.cost),currency:d.currency,params:d.params.trim()});m.close();after&&after()};
}

/* ========== 导出 / 导入 ========== */
const blobToDataURL=b=>new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=()=>rej(r.error);r.readAsDataURL(b)});
function dataURLToBlob(u){const i=u.indexOf(',');const h=u.slice(0,i),d=u.slice(i+1);const mime=(h.match(/data:([^;,]+)/)||[])[1]||'image/png';const bin=atob(d);const a=new Uint8Array(bin.length);for(let k=0;k<bin.length;k++)a[k]=bin.charCodeAt(k);return new Blob([a],{type:mime})}
async function exportAll(){
 if(!S.sets.length){toast('还没有数据可导出');return}toast('正在打包导出…');
 const entries=[];for(const e of S.entries){const {blob,...rest}=e;entries.push({...rest,image:blob?await blobToDataURL(blob):null})}
 const data={app:'image-model-compare',version:SCHEMA,exportedAt:new Date().toISOString(),sets:S.sets,entries,models:S.models};
 const b=new Blob([JSON.stringify(data)],{type:'application/json'});const d=new Date();const p=n=>String(n).padStart(2,'0');
 const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=`图像模型对比_备份_${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.json`;document.body.appendChild(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(a.href),10000);toast(`已导出 ${S.sets.length} 组 / ${S.entries.length} 张图（${(b.size/1048576).toFixed(1)} MB）`)}
$('#importFile').addEventListener('change',async ev=>{const f=ev.target.files[0];ev.target.value='';if(!f)return;
 let data;try{data=JSON.parse(await f.text())}catch(e){alert('文件不是有效的 JSON：'+e.message);return}
 if(data.app!=='image-model-compare'||!Array.isArray(data.sets)){alert('这不是本工具导出的备份文件。');return}
 if(!confirm(`将导入 ${data.sets.length} 组、${(data.entries||[]).length} 张图、${(data.models||[]).length} 个模型。\n已存在的相同记录会被覆盖，其他数据保留（合并导入）。继续？`))return;
 try{for(const s of data.sets)await idb.put('sets',s);
  const ver=Number(data.version)||1;
  for(const e of data.entries||[]){const {image,...rest}=e;const obj=migrateEntry({...rest,blob:image?dataURLToBlob(image):null},ver);dropUrl(obj.id);await idb.put('entries',obj)}
  for(const m of data.models||[])await idb.put('models',migrateModel(m));
  await idb.put('meta',{key:'seeded',value:true});
  [S.sets,S.entries,S.models]=await Promise.all([idb.all('sets'),idb.all('entries'),idb.all('models')]);
  if(data.sets[0])S.cur=data.sets[0].id;pref.set('cur',S.cur);S.picked.clear();renderAll();toast(`导入完成：${data.sets.length} 组 / ${(data.entries||[]).length} 张图`)}
 catch(e){console.warn(e);alert('导入失败：'+e.message)}});

/* ========== 数据版本 / 迁移 ==========
 v1：评分 1–5，含 seed/steps；v2：评分 1–10，去掉 seed/steps */
const SCHEMA=2;
function migrateEntry(e,from){if(from<2&&e.score)e.score=Math.min(10,Math.round(e.score*2));delete e.seed;delete e.steps;return e}
function migrateModel(m){delete m.steps;delete m.seed;return m}
async function migrateDB(){const sv=(await idb.get('meta','schema'))?.value||1;if(sv>=SCHEMA)return;
 for(const e of S.entries){migrateEntry(e,sv);await idb.put('entries',e)}
 for(const m of S.models){migrateModel(m);await idb.put('models',m)}
 await idb.put('meta',{key:'schema',value:SCHEMA});if(S.entries.length)console.info('数据已升级到 v'+SCHEMA)}

/* ========== 示例数据 ========== */
function rng(seed){return()=>(seed=(seed*16807)%2147483647)/2147483647}
function placeholder(w,h,hA,hB,label,seed){const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d');const r=rng(seed);
 const gr=g.createLinearGradient(0,0,w,h);gr.addColorStop(0,`hsl(${hA} 75% 52%)`);gr.addColorStop(1,`hsl(${hB} 70% 18%)`);g.fillStyle=gr;g.fillRect(0,0,w,h);
 for(let i=0;i<22;i++){const x=r()*w,y=r()*h,rad=(0.04+r()*0.22)*Math.min(w,h);const rg=g.createRadialGradient(x,y,0,x,y,rad);rg.addColorStop(0,`hsla(${Math.round(hA+r()*80)%360},90%,70%,${(0.25+r()*0.4).toFixed(2)})`);rg.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=rg;g.beginPath();g.arc(x,y,rad,0,Math.PI*2);g.fill()}
 g.strokeStyle='rgba(255,255,255,.08)';g.lineWidth=1;for(let x=0;x<w;x+=64){g.beginPath();g.moveTo(x,0);g.lineTo(x,h);g.stroke()}for(let y=0;y<h;y+=64){g.beginPath();g.moveTo(0,y);g.lineTo(w,y);g.stroke()}
 const fs=Math.round(Math.min(w,h)/11);g.fillStyle='rgba(0,0,0,.4)';g.fillRect(0,h/2-fs*1.3,w,fs*2.6);g.fillStyle='#fff';g.textAlign='center';g.textBaseline='middle';
 g.font=`bold ${fs}px sans-serif`;g.fillText(label,w/2,h/2-fs*0.3);g.font=`${Math.round(fs*0.42)}px sans-serif`;g.fillText(`示例占位图 · ${w}×${h}`,w/2,h/2+fs*0.75);
 return new Promise(res=>c.toBlob(res,'image/jpeg',0.85))}
async function seedSample(){
 const s={id:'sample-set',title:'示例数据 · 雨夜霓虹街头的橘猫',prompt:'一只胖乎乎的橘猫安静地坐在雨夜霓虹灯下的东京小巷里，湿漉漉的石板地面倒映着粉紫色与青色的招牌灯光，远处有模糊的行人撑着透明雨伞，雨丝在灯光中清晰可见。电影感光线，35mm 胶片质感，轻微颗粒，浅景深，猫的胡须和毛发细节清晰，整体色调偏冷，画面安静而略带孤独感，高细节，构图居中偏下。',negative:'模糊, 低清晰度, 多余的肢体, 畸形的爪子, 文字水印, 签名, 过度锐化, 塑料质感, 卡通风格, 画面噪点过多, 过曝',date:today(),tags:['示例数据','演示'],notes:'这是自动生成的示例数据：图片是本地绘制的渐变占位图，模型名、价格、耗时、评分等数值全部是虚构的，仅用于演示功能。看完后可点右上「删除此组」移除，不会再自动出现。',createdAt:Date.now(),sample:true};
 const D=[
  ['示例模型 Alpha','示例平台 A',1024,1024,20,260,0.03,'$',8.4,7,'质量: 标准\n风格: 默认\n采样器: DPM++ 2M\nCFG: 7','构图稳，色彩干净（示例）','雨滴细节一般（示例）',false],
  ['示例模型 Beta','示例平台 B',1344,768,300,230,0.04,'$',15.2,9,'质量: high\n比例: 16:9\n风格化: 100','光影最有电影感（示例）','偶尔多一只爪子（示例）',true],
  ['示例模型 Gamma','示例平台 C',896,1152,140,200,0.08,'¥',4.1,5,'模式: 极速\n提示词扩写: 开启','速度快、便宜（示例）','细节偏糊（示例）',false],
  ['示例模型 Delta','示例平台 A',1536,1536,50,320,0.12,'$',32.5,8,'质量: 超清\n放大: 2x','分辨率最高（示例）','慢、贵（示例）',false],
  ['示例模型 Epsilon','示例平台 D',1216,832,190,280,5,'积分',21.0,4,'风格: 动漫\n强度: 0.8','风格化强（示例）','不够写实（示例）',false],
  ['示例模型 Zeta','本地部署（示例）',1024,1024,100,170,0,'$',46.8,6,'采样器: Euler a\nCFG: 5.5\nLoRA: 无','免费、可控（示例）','需要本地显卡，较慢（示例）',false]];
 await idb.put('sets',s);S.sets.push(s);let o=0;
 for(const d of D){const blob=await placeholder(d[2],d[3],d[4],d[5],d[0],o*97+13);
  const e={id:'sample-'+o,setId:s.id,order:++o,model:d[0],provider:d[1],blob,mime:'image/jpeg',fileName:`sample_${o}.jpg`,width:d[2],height:d[3],aspect:'',cost:d[6],currency:d[7],time:d[8],score:d[9],params:d[10],pros:d[11],cons:d[12],notes:'示例数据，数值为虚构',best:d[13],createdAt:Date.now()};
  await idb.put('entries',e);S.entries.push(e)}
 S.cur=s.id}

/* ========== 示例数据管理 / 使用帮助 ========== */
async function clearSamples(){const ids=S.sets.filter(s=>s.sample).map(s=>s.id);if(!ids.length)return;
 for(const e of S.entries.filter(e=>ids.includes(e.setId))){await idb.del('entries',e.id);dropUrl(e.id)}
 for(const id of ids)await idb.del('sets',id);
 S.entries=S.entries.filter(e=>!ids.includes(e.setId));S.sets=S.sets.filter(s=>!ids.includes(s.id));
 if(ids.includes(S.cur)){S.cur=sortedSets()[0]?.id||null;pref.set('cur',S.cur)}S.picked.clear();renderAll();toast('已清除示例数据（可在「使用帮助」里重新加载）')}
async function reloadSamples(){if(S.sets.some(s=>s.id==='sample-set')){selectSet('sample-set');return}await seedSample();selectSet('sample-set');toast('已加载示例数据')}
function openHelp(first){
 const hasSample=S.sets.some(s=>s.sample);
 const m=showModal({wide:true,title:first?'👋 欢迎使用图像模型对比台':'使用帮助',onClose:()=>pref.set('welcomed',true),body:`<div class="help">
  <p class="help-lead">同一个提示词交给 5 个、10 个图像模型生成后，用这里把出图<b>并排比较</b>：画质、成本、速度、分辨率、默认参数、评分，一目了然。</p>
  <div class="steps">
   <div class="step"><div class="step-n">1</div><h3>新建对比组</h3><p>点右上「＋ 新建对比组」，粘贴你给所有模型用的<b>同一段提示词</b>（反向提示词、标签、备注可选）。</p></div>
   <div class="step"><div class="step-n">2</div><h3>拖入各模型的出图</h3><p>一次拖入多张图片（或点「添加图片」、Ctrl+V 粘贴）。文件名会自动填成模型名，分辨率自动读取；再逐张填写成本（默认美元，自动折算人民币）、耗时、参数和 1–10 分评分。</p></div>
   <div class="step"><div class="step-n">3</div><h3>对比 & 结论</h3><p><b>网格</b>看图，<b>表格</b>比数据（自动高亮最便宜 / 最快 / 最高清 / 最高分），<b>点图片</b>看大图和完整信息，勾选 2–4 张<b>并排对比</b>并同步缩放。</p></div>
  </div>
  <div class="help-note"><span>🔒</span><div><b>数据只保存在你自己的浏览器里</b>（IndexedDB），不会上传到任何服务器。不同网址 / 不同浏览器之间的数据互不相通，清除浏览器数据会丢失。请用右上「导出」定期备份为 JSON 文件，换电脑时「导入」即可。</div></div>
  <div class="help-keys"><span><kbd>←</kbd><kbd>→</kbd> 大图中切换模型</span><span><kbd>滚轮</kbd> 缩放</span><span><kbd>双击</kbd> 放大 / 还原</span><span><kbd>1</kbd> 原始尺寸</span><span><kbd>0</kbd> 适应窗口</span><span><kbd>Esc</kbd> 关闭</span></div>
  <p class="hint">开源项目（MIT）· <a href="https://github.com/Bin0754/image-model-compare" target="_blank" rel="noopener">GitHub：Bin0754/image-model-compare</a> · 可 Fork 后用 GitHub Pages 部署自己的版本。</p>
 </div>`,footer:`${hasSample?'<button class="btn" id="helpClear" style="margin-right:auto">清除示例数据</button>':'<button class="btn" id="helpSample" style="margin-right:auto">加载示例数据</button>'}<button class="btn" id="helpNew">＋ 新建对比组</button><button class="btn primary" data-close>开始使用</button>`});
 $('#helpNew',m.el).onclick=()=>{m.close();openSetForm()};
 const hc=$('#helpClear',m.el);if(hc)hc.onclick=()=>{m.close();clearSamples()};
 const hs=$('#helpSample',m.el);if(hs)hs.onclick=()=>{m.close();reloadSamples()};
}

/* ========== 启动 ========== */
(async function init(){
 try{db=await openDB()}catch(e){$('#main').innerHTML=`<div class="empty"><div class="big">⚠️</div><h2>无法打开本地数据库</h2><p>浏览器禁用了 IndexedDB（可能是无痕模式或隐私设置）。请用普通窗口的 Chrome / Edge / Firefox 打开。</p><p class="hint">${esc(e&&e.message)}</p></div>`;return}
 [S.sets,S.entries,S.models]=await Promise.all([idb.all('sets'),idb.all('entries'),idb.all('models')]);
 if(!(await idb.get('meta','seeded'))){await seedSample();await idb.put('meta',{key:'seeded',value:true});await idb.put('meta',{key:'schema',value:SCHEMA})}
 else await migrateDB();
 if(!S.sets.find(s=>s.id===S.cur))S.cur=sortedSets()[0]?.id||null;
 renderAll();
 if(!pref.get('welcomed',false))openHelp(true);
 window.__ready=true;
 if(navigator.storage&&navigator.storage.persist)navigator.storage.persist().catch(()=>{});
})();
