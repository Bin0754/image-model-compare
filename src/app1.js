'use strict';
/* ========== 工具函数 ========== */
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,8);
const today=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
const numOrNull=v=>{if(v===''||v==null)return null;const n=Number(v);return isFinite(n)?n:null};
function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('on');clearTimeout(toast._t);toast._t=setTimeout(()=>t.classList.remove('on'),2200)}
const pref={get(k,d){try{const v=localStorage.getItem('imc.'+k);return v==null?d:JSON.parse(v)}catch(e){return d}},set(k,v){try{localStorage.setItem('imc.'+k,JSON.stringify(v))}catch(e){}}};

/* ========== IndexedDB ========== */
let db;
function openDB(){return new Promise((res,rej)=>{const r=indexedDB.open('image-model-compare',1);
 r.onupgradeneeded=()=>{const d=r.result;d.createObjectStore('sets',{keyPath:'id'});const es=d.createObjectStore('entries',{keyPath:'id'});es.createIndex('setId','setId');d.createObjectStore('models',{keyPath:'name'});d.createObjectStore('meta',{keyPath:'key'})};
 r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
const reqP=r=>new Promise((res,rej)=>{r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});
const store=(s,m='readonly')=>db.transaction(s,m).objectStore(s);
const idb={all:s=>reqP(store(s).getAll()),get:(s,k)=>reqP(store(s).get(k)),put:(s,v)=>reqP(store(s,'readwrite').put(v)),del:(s,k)=>reqP(store(s,'readwrite').delete(k)),clear:s=>reqP(store(s,'readwrite').clear())};

/* ========== 状态 ========== */
const S={sets:[],entries:[],models:[],cur:pref.get('cur',null),view:pref.get('view','grid'),sort:pref.get('sort','order'),thumb:pref.get('thumb',260),rate:pref.get('rate',7.2),q:'',picked:new Set()};
const urls=new Map();
function urlOf(e){if(!e.blob)return '';if(!urls.has(e.id))urls.set(e.id,URL.createObjectURL(e.blob));return urls.get(e.id)}
function dropUrl(id){if(urls.has(id)){URL.revokeObjectURL(urls.get(id));urls.delete(id)}}
const cur=()=>S.sets.find(s=>s.id===S.cur);
const entriesOf=id=>S.entries.filter(e=>e.setId===id);
const modelByName=n=>S.models.find(m=>m.name.toLowerCase()===String(n||'').trim().toLowerCase());

/* ========== 格式化 ========== */
const CURRENCIES=['$','¥','积分','其他'];
/* 预设模型名（模型名称下拉框中优先显示；上传时也会按文件名识别） */
const PRESET_MODELS=['gpt 2.5 sunburst','gpt 2.5 flare','nano banana 2.1','grok 2','flux 3','krea 2'];
const normName=s=>String(s||'').toLowerCase().replace(/[\s_\-.·]+/g,'');
function trimNum(n){return Number(n).toFixed(4).replace(/\.?0+$/,'')}
const fmtCNY=v=>'¥'+(v>0&&v<0.01?v.toFixed(4).replace(/0+$/,''):v.toFixed(2));
/* 成本显示（HTML）：美元自动附带人民币折算 */
function fmtCost(e,cny=true){if(e.cost==null)return '—';const c=e.currency||'$';let s=(c==='¥'||c==='$')?c+trimNum(e.cost):trimNum(e.cost)+' '+esc(c);if(cny&&c==='$')s+=` <span class="cny">≈ ${fmtCNY(costCNY(e))}</span>`;return s}
const fmtTime=t=>t==null?'—':trimNum(Math.round(t*100)/100)+'s';
const fmtRes=e=>e.width&&e.height?`${e.width}×${e.height}`:'—';
const mp=e=>e.width&&e.height?(e.width*e.height/1e6).toFixed(2)+' MP':'';
function aspectOf(w,h){if(!w||!h)return '';const r=w/h;const C=[[1,1],[4,3],[3,4],[16,9],[9,16],[3,2],[2,3],[21,9],[9,21],[5,4],[4,5],[2,1],[1,2],[7,4],[4,7],[12,5],[5,12]];
 for(const[a,b]of C)if(Math.abs(r-a/b)<0.012)return a+':'+b;const gcd=(x,y)=>y?gcd(y,x%y):x;const g=gcd(Math.round(w),Math.round(h));if(w/g<=32&&h/g<=32)return w/g+':'+h/g;return r>=1?r.toFixed(2)+':1':'1:'+(1/r).toFixed(2)}
const aspect=e=>e.aspect||aspectOf(e.width,e.height)||'—';
/* 10 分制评分条 */
function stars(n,cls=''){n=Math.round(n||0);let s='';for(let i=1;i<=10;i++)s+=`<i class="${i<=n?'on':''}"></i>`;return `<span class="score ${cls}" title="${n?n+' / 10':'未评分'}"><span class="segs">${s}</span><b>${n||'–'}</b><small>/10</small></span>`}
function parseParams(t){const lines=String(t||'').split(/\n|；|;/).map(s=>s.trim()).filter(Boolean);if(!lines.length)return null;const kv=[];
 for(const l of lines){const m=l.match(/^([^:：=]{1,40})[:：=]\s*(.*)$/);if(!m)return null;kv.push([m[1].trim(),m[2].trim()])}return kv}
function costCNY(e){if(e.cost==null)return null;if(e.currency==='¥')return e.cost;if(e.currency==='$'||!e.currency)return e.cost*(Number(S.rate)||7.2);return null}

/* 可折叠文本（提示词等） */
const expanded=new Set();
function clampBox(key,text,lines=2,cls=''){return `<div class="clampbox ${expanded.has(key)?'open':''}" style="--lines:${lines}"><div class="clamp ${cls}" title="${expanded.has(key)?'':'点击展开全文'}">${esc(text)}</div><button type="button" class="toggle" data-toggle="${esc(key)}"><span class="t-open">展开全文 ▾</span><span class="t-close">收起 ▴</span></button></div>`}
function fixClamps(root=document){requestAnimationFrame(()=>$$('.clampbox',root).forEach(b=>{if(b.classList.contains('open'))return;const c=$('.clamp',b);b.classList.toggle('short',c.scrollHeight<=c.clientHeight+2)}))}
document.addEventListener('click',ev=>{let t=ev.target.closest('[data-toggle]');
 if(!t){const c=ev.target.closest('.clampbox:not(.open):not(.short) .clamp');if(c)t=$('[data-toggle]',c.parentNode)}
 if(!t)return;ev.stopPropagation();const k=t.dataset.toggle;const b=t.closest('.clampbox');
 if(expanded.has(k))expanded.delete(k);else expanded.add(k);b.classList.toggle('open',expanded.has(k));$('.clamp',b).title=expanded.has(k)?'':'点击展开全文';if(!expanded.has(k))fixClamps(b.parentNode)},true);

/* 本组最优值 */
function computeBest(es){
 const r={cheap:new Set(),fast:new Set(),res:new Set(),score:new Set()};
 const pick=(arr,fn,dir,set)=>{const v=arr.map(e=>[e,fn(e)]).filter(x=>x[1]!=null&&!isNaN(x[1]));if(v.length<2)return;const b=dir<0?Math.min(...v.map(x=>x[1])):Math.max(...v.map(x=>x[1]));if(v.every(x=>x[1]===b))return;v.filter(x=>x[1]===b).forEach(x=>set.add(x[0].id))};
 let costFn=costCNY;
 if(!es.some(e=>costCNY(e)!=null)){const cs=new Set(es.filter(e=>e.cost!=null).map(e=>e.currency));if(cs.size===1)costFn=e=>e.cost}
 pick(es,costFn,-1,r.cheap);pick(es,e=>e.time,-1,r.fast);pick(es,e=>e.width&&e.height?e.width*e.height:null,1,r.res);pick(es,e=>e.score||null,1,r.score);
 return r}
function sortEntries(es){const k=S.sort;const a=[...es];const nl=(x,y,f)=>{const A=f(x),B=f(y);if(A==null&&B==null)return 0;if(A==null)return 1;if(B==null)return -1;return A-B};
 const fns={order:(x,y)=>(x.order||0)-(y.order||0),model:(x,y)=>String(x.model).localeCompare(String(y.model),'zh-Hans'),
  cost:(x,y)=>nl(x,y,e=>costCNY(e)??e.cost),time:(x,y)=>nl(x,y,e=>e.time),score:(x,y)=>(y.score||0)-(x.score||0),res:(x,y)=>((y.width||0)*(y.height||0))-((x.width||0)*(x.height||0)),best:(x,y)=>(y.best?1:0)-(x.best?1:0)};
 return a.sort((x,y)=>(fns[k]||fns.order)(x,y)||(x.order||0)-(y.order||0))}
const SORTS=[['order','添加顺序'],['model','模型名称'],['cost','成本 低→高'],['time','速度 快→慢'],['score','评分 高→低'],['res','分辨率 高→低'],['best','最佳优先']];

/* ========== 渲染：侧栏 ========== */
function sortedSets(){return [...S.sets].sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))||(b.createdAt||0)-(a.createdAt||0))}
function renderSidebar(){
 const q=S.q.trim().toLowerCase();
 const list=sortedSets().filter(s=>{if(!q)return true;const hay=[s.title,s.prompt,s.negative,s.notes,(s.tags||[]).join(' '),...entriesOf(s.id).map(e=>e.model+' '+(e.provider||''))].join(' ').toLowerCase();return hay.includes(q)});
 $('#setList').innerHTML=list.length?list.map(s=>{const n=entriesOf(s.id).length;return `<div class="set-item ${s.id===S.cur?'active':''}" data-set="${s.id}">
  <div class="t">${s.sample?'<span class="badge warn">示例数据</span> ':''}${esc(s.title||'未命名对比组')}</div>
  <div class="p">${esc(s.prompt||'（无提示词）')}</div>
  <div class="s"><span>📅 ${esc(s.date||'')}</span><span>🖼 ${n} 张</span>${(s.tags||[]).filter(t=>t!=='示例数据').slice(0,3).map(t=>`<span class="tag">${esc(t)}</span>`).join('')}</div></div>`}).join('')
  :`<div class="hint" style="padding:10px">${q?'没有匹配的对比组':'还没有对比组，点右上角「新建对比组」'}</div>`;
 $('#storageHint').textContent=`共 ${S.sets.length} 组 · ${S.entries.length} 张图`;
}

/* ========== 渲染：主区 ========== */
function renderMain(){
 const m=$('#main');const s=cur();
 document.documentElement.style.setProperty('--thumb',S.thumb+'px');
 if(!s){m.innerHTML=`<div class="empty"><div class="big">🖼️</div><h2>开始一次模型对比</h2><p>同一个提示词交给多个图像模型生成后，新建一个「对比组」，把所有出图一次拖进来，再填写成本、耗时、默认参数等信息即可。</p><p><button class="btn primary" data-act="newSet">＋ 新建对比组</button></p><p class="hint">也可以直接把图片拖到这个页面，会自动新建一组。</p></div>`;return}
 const all=entriesOf(s.id);const es=sortEntries(all);const best=computeBest(all);
 const animKey=s.id+'|'+S.view;m.classList.toggle('anim',renderMain._k!==animKey);renderMain._k=animKey;
 const nm=id=>esc(all.find(e=>e.id===id)?.model||'');
 const names=set=>[...set].map(nm).join('、');
 const bestE=all.filter(e=>e.best);const n=S.picked.size;const sum=[];
 if(bestE.length)sum.push(`<span class="sum-item gold"><span class="ic">🏆</span>最佳 <b>${bestE.map(e=>esc(e.model)).join('、')}</b></span>`);
 if(best.cheap.size)sum.push(`<span class="sum-item"><span class="ic">💰</span>最省 <b>${names(best.cheap)}</b></span>`);
 if(best.fast.size)sum.push(`<span class="sum-item"><span class="ic">⚡</span>最快 <b>${names(best.fast)}</b></span>`);
 if(best.res.size)sum.push(`<span class="sum-item"><span class="ic">🔍</span>最高分辨率 <b>${names(best.res)}</b></span>`);
 if(best.score.size)sum.push(`<span class="sum-item"><span class="ic">⭐</span>最高分 <b>${names(best.score)}</b></span>`);
 m.innerHTML=`<section class="set-head">
  <div class="eyebrow">Comparison · 对比组</div>
  <div class="row"><h1>${esc(s.title||'未命名对比组')}</h1>${s.sample?'<span class="badge warn">示例数据</span>':''}<div class="spacer"></div>
   <button class="btn sm" data-act="editSet">✎ 编辑组信息</button><button class="btn sm danger" data-act="delSet">🗑 删除此组</button></div>
  ${s.sample?`<div class="sample-banner"><span class="sb-ic">🧪</span><div><b>这是示例数据</b>：图片是本地绘制的占位图，模型名、价格、耗时、评分都是虚构的，只用来演示功能。</div><div class="spacer"></div><button class="btn sm" data-act="clearSamples">一键清除示例数据</button></div>`:''}
  <div class="meta-line"><span>📅 ${esc(s.date||'')}</span><span>· ${all.length} 个模型</span>${(s.tags||[]).map(t=>`<span class="tag">${esc(t)}</span>`).join('')}</div>
  <div class="prompt-box"><div class="pb-row"><div class="lbl">提示词<button class="link" data-act="copyPrompt" style="padding:0;text-align:left">复制</button></div>${clampBox(s.id+':prompt',s.prompt||'（未填写）',2,'prompt')}</div>
   ${s.negative?`<div class="pb-row"><div class="lbl">反向提示词</div>${clampBox(s.id+':neg',s.negative,1,'prompt neg')}</div>`:''}
   ${s.notes?`<div class="pb-row"><div class="lbl">备注</div>${clampBox(s.id+':notes',s.notes,1,'prompt neg')}</div>`:''}</div>
  ${sum.length?`<div class="summary">${sum.join('')}</div>`:''}
 </section>
 <div class="toolbar">
  <div class="seg"><button data-view="grid" class="${S.view==='grid'?'on':''}">▦ 网格</button><button data-view="table" class="${S.view==='table'?'on':''}">☰ 表格</button></div>
  <label>排序 <select id="sortSel">${SORTS.map(([k,v])=>`<option value="${k}" ${S.sort===k?'selected':''}>${v}</option>`).join('')}</select></label>
  ${S.view==='grid'?`<label>大小 <input type="range" id="thumbRange" min="140" max="560" step="10" value="${S.thumb}"></label>`:''}
  <label title="比较成本时把美元换算成人民币">汇率 $1 = ¥<input type="number" id="rateInput" step="0.01" min="0" value="${S.rate}"></label>
  <div class="spacer"></div>
  <button class="btn" data-act="compare" title="在图片左上角勾选 2–4 张后并排对比" ${n>=2&&n<=4?'':'disabled'}>⇆ 对比所选 (${n})</button>
  ${n?'<button class="btn sm" data-act="clearPick">清除勾选</button>':''}
  <button class="btn primary" data-act="addImages">＋ 添加图片</button>
 </div>
 <div id="content">${S.view==='grid'?gridHTML(es,best):tableHTML(es,best)}</div>`;
 fixClamps(m);
}
function gridHTML(es,best){
 return `<div class="grid ${S.picked.size?'has-picks':''}">${es.map(e=>`<div class="card ${e.best?'is-best':''} ${S.picked.has(e.id)?'picked':''}" data-id="${e.id}">
  <label class="pick" title="勾选用于并排对比"><input type="checkbox" data-pick="${e.id}" ${S.picked.has(e.id)?'checked':''}>对比</label>
  ${e.best?'<span class="best-badge">🏆 最佳</span>':''}
  <div class="thumb" data-open="${e.id}"><img src="${urlOf(e)}" alt="${esc(e.model)}" loading="lazy" draggable="false"></div>
  <div class="cap"><div class="cap-row"><span class="model" title="${esc(e.model)}">${esc(e.model||'未命名模型')}</span>${stars(e.score)}</div>
   <div class="prov">${esc(e.provider||'　')}</div>
   <div class="chips"><span class="chip ${best.cheap.has(e.id)?'hl':''}" title="成本/张">💰 ${fmtCost(e)}</span><span class="chip ${best.fast.has(e.id)?'hl':''}" title="生成耗时">⚡ ${fmtTime(e.time)}</span><span class="chip ${best.res.has(e.id)?'hl':''}" title="分辨率">🔍 ${fmtRes(e)}</span><span class="chip" title="画面比例">${aspect(e)}</span></div>
  </div><button class="btn sm edit" data-edit="${e.id}">✎ 编辑</button></div>`).join('')}
  <div class="add-card" data-act="addImages"><div class="plus">＋</div><div>拖入图片 或 点击添加</div><div class="hint">支持一次多张；文件名会预填为模型名</div></div></div>`}
function tableHTML(es,best){
 if(!es.length)return `<div class="add-card" data-act="addImages"><div class="plus">＋</div><div>这一组还没有图片，拖入或点击添加</div></div>`;
 const th=(k,label)=>`<th data-sort="${k}" class="${S.sort===k?'sorted':''}" title="点击按此排序">${label}${S.sort===k?' ▾':''}</th>`;
 return `<div class="tbl-wrap"><table><thead><tr><th>图</th>${th('model','模型')}<th>平台</th>${th('cost','成本/张')}${th('time','耗时')}${th('res','分辨率')}<th>比例</th>${th('score','评分 /10')}${th('best','最佳')}<th>默认设置 / 参数</th><th>优缺点 / 备注</th></tr></thead><tbody>
 ${es.map(e=>`<tr data-open="${e.id}" class="${e.best?'best-row':''}"><td><img class="mini" src="${urlOf(e)}" alt="" draggable="false"></td><td><span class="tbl-model">${esc(e.model||'未命名模型')}</span></td><td>${esc(e.provider||'—')}</td>
 <td class="num ${best.cheap.has(e.id)?'hl':''}">${fmtCost(e)}</td>
 <td class="num ${best.fast.has(e.id)?'hl':''}">${fmtTime(e.time)}</td><td class="num ${best.res.has(e.id)?'hl':''}">${fmtRes(e)}<div class="hint">${mp(e)}</div></td><td class="num">${aspect(e)}</td>
 <td class="${best.score.has(e.id)?'hl':''}">${stars(e.score)}</td><td>${e.best?'🏆':''}</td>
 <td class="params">${esc(e.params||'—')}</td><td class="notes">${e.pros?`<div>👍 ${esc(e.pros)}</div>`:''}${e.cons?`<div>👎 ${esc(e.cons)}</div>`:''}${e.notes?`<div>📝 ${esc(e.notes)}</div>`:''}${!e.pros&&!e.cons&&!e.notes?'—':''}</td></tr>`).join('')}
 </tbody></table></div><p class="hint">绿色高亮 = 本组最优（最便宜 / 最快 / 分辨率最高 / 评分最高）；美元成本按上方汇率折算为人民币（≈ ¥）后比较，「积分 / 其他」不参与比较。点击任意行查看大图，点击带 ▾ 的表头可排序。</p>`}
function renderAll(){renderSidebar();renderMain()}

/* ========== 主区事件 ========== */
$('#main').addEventListener('click',async ev=>{
 const t=ev.target;
 if(t.closest('.pick'))return;
 const act=t.closest('[data-act]')?.dataset.act;
 const view=t.closest('[data-view]')?.dataset.view;
 const edit=t.closest('[data-edit]')?.dataset.edit;
 const sortTh=t.closest('th[data-sort]')?.dataset.sort;
 const open=t.closest('[data-open]')?.dataset.open;
 if(view){S.view=view;pref.set('view',view);renderMain();return}
 if(sortTh){S.sort=sortTh;pref.set('sort',sortTh);renderMain();return}
 if(edit){openEntryForm([edit]);return}
 if(open){openLightbox(open);return}
 if(act==='newSet')openSetForm();
 else if(act==='editSet')openSetForm(cur());
 else if(act==='delSet')deleteSet(S.cur);
 else if(act==='addImages')$('#addFiles').click();
 else if(act==='copyPrompt'){const p=cur()?.prompt||'';try{await navigator.clipboard.writeText(p);toast('已复制提示词')}catch(e){window.prompt('复制下面的提示词：',p)}}
 else if(act==='compare')openCompare([...S.picked]);
 else if(act==='clearPick'){S.picked.clear();renderMain()}
 else if(act==='clearSamples')clearSamples();
});
$('#main').addEventListener('change',ev=>{const t=ev.target;
 if(t.dataset.pick){const id=t.dataset.pick;if(t.checked){if(S.picked.size>=4){t.checked=false;toast('最多同时对比 4 张');return}S.picked.add(id)}else S.picked.delete(id);renderMain()}
 else if(t.id==='sortSel'){S.sort=t.value;pref.set('sort',S.sort);renderMain()}
 else if(t.id==='rateInput'){S.rate=Number(t.value)||7.2;pref.set('rate',S.rate);renderMain()}
});
$('#main').addEventListener('input',ev=>{if(ev.target.id==='thumbRange'){S.thumb=Number(ev.target.value);pref.set('thumb',S.thumb);document.documentElement.style.setProperty('--thumb',S.thumb+'px')}});
$('#setList').addEventListener('click',ev=>{const it=ev.target.closest('[data-set]');if(!it)return;selectSet(it.dataset.set);$('#sidebar').classList.remove('open')});
$('#search').addEventListener('input',ev=>{S.q=ev.target.value;renderSidebar()});
function selectSet(id){S.cur=id;pref.set('cur',id);S.picked.clear();renderAll();$('#main').scrollTop=0}
$('#btnNewSet').onclick=()=>openSetForm();
$('#btnModels').onclick=()=>openModelLib();
$('#btnExport').onclick=()=>exportAll();
$('#btnImport').onclick=()=>$('#importFile').click();
$('#btnHelp').onclick=()=>openHelp();
$('#btnMenu').onclick=()=>$('#sidebar').classList.toggle('open');
$('#btnTheme').onclick=()=>{const t=document.documentElement.dataset.theme==='dark'?'light':'dark';document.documentElement.dataset.theme=t;pref.set('theme',t)};
document.documentElement.dataset.theme=pref.get('theme',window.matchMedia&&matchMedia('(prefers-color-scheme: light)').matches?'light':'dark');

/* ========== 模态框 ========== */
const modalStack=[];
function showModal({title,body,footer='',wide=false,onClose}){
 const ov=document.createElement('div');ov.className='overlay modal-wrap';
 ov.innerHTML=`<div class="modal ${wide?'wide':''}" role="dialog"><header><h2>${title}</h2><div class="spacer"></div><button class="icon-btn" data-close title="关闭 (Esc)">✕</button></header><div class="body">${body}</div>${footer?`<footer>${footer}</footer>`:''}</div>`;
 const api={el:ov,kind:'modal',close(){ov.remove();const i=modalStack.indexOf(api);if(i>=0)modalStack.splice(i,1);onClose&&onClose()}};
 ov.addEventListener('mousedown',e=>{ov._down=e.target===ov});
 ov.addEventListener('click',e=>{if(e.target===ov&&ov._down)api.close();else if(e.target.closest('[data-close]'))api.close();ov._down=false});
 document.body.appendChild(ov);modalStack.push(api);return api}
document.addEventListener('keydown',e=>{const top=modalStack[modalStack.length-1];if(!top)return;
 if(e.key==='Escape'){e.preventDefault();top.close();return}
 if(top.onKey)top.onKey(e)});
