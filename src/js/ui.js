/* ui: 画面。冒頭は完成した診断結果から始める */
(function () {
  const E = RR.esc, M = (x) => RR.money(x), $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const st = (RR.ui = { view: 'home', mapState: 'B', prevState: 'A', domain: '', site: '', all: false, peril: 'max', edition: 'full', layer: 'site', promptKey: 'c1', pending: null, reportKey: '', built: false });
  const lab = (it) => E(it.label.replace('｜', '・'));
  const VIEWS = [['home', '診断'], ['quick', '簡易入力'], ['data', 'データ'], ['proposals', '提案台帳'], ['report', 'レポート'], ['ai', 'AIプロンプト'], ['settings', '設定']];
  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  const moneyBig = (v) => RR.moneyParts(v).map((x, i) => (i ? `<small>${E(x)}</small>` : E(x))).join('');

  /* ---------- 入力部品（質問マスタから作る） ---------- */
  function input(q, v, attrs) {
    const a = attrs + ` data-q="${q.id}" aria-label="${E(q.label)}"`; const val = v === undefined || v === null ? '' : v; const opts = RR.optsOf(q);
    if (opts) return `<select ${a}><option value=""></option>${opts.map((o) => `<option${o === val ? ' selected' : ''}>${E(o)}</option>`).join('')}${val !== '' && !opts.includes(val) ? `<option selected>${E(val)}</option>` : ''}</select>`;
    if (q.type === 'ref') return `<select ${a}><option value=""></option>${RR.rows('site').map((s) => `<option value="${E(s.id)}"${s.id === val ? ' selected' : ''}>${E(s.id + ' ' + (s.f.site_name || ''))}</option>`).join('')}</select>`;
    if (q.type === 'long') return `<textarea ${a} rows="2">${E(val)}</textarea>`;
    if (q.type === 'image') return `<label class="imgpick">${val ? `<img src="${val}" alt="">` : '<span>写真を選ぶ</span>'}<input type="file" accept="image/*" ${a} hidden></label>`;
    if (q.type === 'id') return `<input ${a} value="${E(val)}" readonly class="idf">`;
    if (['num', 'money', 'pct'].includes(q.type)) return `<input ${a} type="number" step="any" inputmode="decimal" value="${E(val)}" class="numf">`;
    if (q.type === 'date') return `<input ${a} type="date" value="${E(val)}">`;
    return `<input ${a} value="${E(val)}">`;
  }
  const readInput = (q, el) => (['num', 'money', 'pct'].includes(q.type) ? (el.value === '' ? '' : Number(el.value)) : el.value);
  const methodSel = (v, attrs) => `<select ${attrs} aria-label="確認方法">${RR.methods.map((m) => `<option${m === (v || '未確認') ? ' selected' : ''}>${m}</option>`).join('')}</select>`;

  /* ---------- 共通 ---------- */
  function go(view) { location.hash = view; }
  function route() {
    const v = (location.hash || '#home').slice(1).split('/')[0]; st.view = VIEWS.some((x) => x[0] === v) ? v : 'home';
    $$('.view').forEach((s) => s.classList.toggle('on', s.id === 'v-' + st.view)); $$('#nav a').forEach((a) => a.classList.toggle('on', a.dataset.v === st.view));
    document.body.dataset.view = st.view; render(); window.scrollTo(0, 0);
  }
  function render() { const fn = { home: renderHome, quick: renderQuick, data: renderData, proposals: renderProposals, report: renderReport, ai: renderAI, settings: renderSettings }[st.view]; $('#casename').textContent = RR.companyName(false) + (RR.case.meta.isSample ? '（サンプル・架空）' : ''); fn(); }
  function mapItems() { const R = RR.compute(); let its = st.site ? R.items.filter((i) => i.siteId === st.site || (i.members || []).includes(st.site)) : st.all ? R.items : R.headline; if (st.domain) its = its.filter((i) => i.domain === st.domain); return its; }
  const seg = (name, opts, cur) => `<div class="seg" role="group" aria-label="${E(name)}">${opts.map(([v, l]) => `<button type="button" data-seg="${name}" data-val="${E(v)}" class="${String(v) === String(cur) ? 'on' : ''}">${E(l)}</button>`).join('')}</div>`;

  /* ---------- 診断（冒頭） ---------- */
  function renderHome() {
    const R = RR.compute(), L = R.level, H = RR.headlineText(); const host = $('#v-home'); const has = R.items.length > 0;
    const kpi = (l, v, s) => `<div class="kpi"><div class="k-l">${E(l)}</div><div class="k-v num">${moneyBig(v)}</div><div class="k-s">${s}</div></div>`;
    host.innerHTML = `
<div class="hero">
  <div class="hero-text">
    <div class="kicker">${RR.case.meta.isSample ? 'サンプル企業（架空・製造業・8拠点）の診断結果' : E(RR.companyName(false)) + ' の診断結果'}</div>
    <h1 class="hl-main">${E(H.main)}</h1>
    <p class="hl-sub">${E(H.sub)}</p>
    ${has ? `<div class="kpis">${kpi('最大の損害（' + RR.levelShort[L] + '）', H.top.loss[L], lab(H.top))}${kpi('うち保険で賄えない額', H.top.uninsured[L], H.ratio !== null ? '純資産の' + RR.n0(H.ratio) + '%' : '')}${kpi('自己負担できる額', R.retention, '超えるリスク ' + H.over + '件')}${kpi('純資産', R.net, '備えの空白 ' + R.gapsHead.length + '種類')}</div>` : ''}
    <div class="cta"><a class="btn pri" href="#quick">自社のデータに変える（簡易入力・15分）</a><a class="btn" href="#data">Excelで全拠点を集める</a><a class="btn" href="#report">レポートを開く</a></div>
    <p class="fine">損害額は係数表と算式による試算で、係数の初期値は仮置きです。${RR.case.meta.isSample ? '表示中の会社名・数値・出典はすべて架空です。' : ''}</p>
  </div>
  <div class="hero-map">
    <div class="fighead"><div><h2>図1　総合リスクマップ</h2><p>会社全体で、どのリスクが最も重いか。円を押すと算出根拠が開きます。</p></div>${seg('state', [['A', '対策前'], ['B', '保険と備えを考慮'], ['C', '提案を実行した後']], st.mapState)}</div>
    <div id="fig1" class="figbox"></div>
  </div>
</div>
<div class="filterbar"><span class="fb-l">絞り込み</span>
  <div class="chips">${[['', 'すべての領域']].concat(RR.domains.map((d) => [d.id, d.label])).map(([v, l]) => `<button type="button" data-seg="domain" data-val="${v}" class="chip ${st.domain === v ? 'on' : ''}">${v ? `<i style="background:var(--d-${v})"></i>` : ''}${E(l)}</button>`).join('')}</div>
  <label>拠点 <select id="f-site"><option value="">会社全体</option>${RR.rows('site').map((s) => `<option value="${E(s.id)}"${st.site === s.id ? ' selected' : ''}>${E(s.f.site_name || s.id)}</option>`).join('')}</select></label>
  <label>損害の水準 <select id="f-level">${RR.levelShort.map((n, i) => `<option value="${i}"${i === L ? ' selected' : ''}>${E(n)}</option>`).join('')}</select></label>
  <label class="chk"><input type="checkbox" id="f-all"${st.all ? ' checked' : ''}${st.site ? ' disabled' : ''}> 拠点別のリスクをすべて載せる</label>
</div>
<section class="figsec"><div class="fighead"><div><h2>図2　備えと損害のマップ</h2><p>損害が大きいのに、代替手段がないのはどこか。</p></div></div><div id="fig2" class="figbox"></div></section>
<section class="figsec"><div class="fighead"><div><h2>図3　拠点 × 災害の一覧図</h2><p>どの拠点が、どの災害に弱いか。</p></div></div><div id="fig3" class="figbox"></div></section>
<section class="figsec"><div class="fighead"><div><h2>図4　損害と保険の対比図</h2><p>保険で賄えない額は、どこに、いくらあるか。</p></div></div><div id="fig4" class="figbox"></div></section>
<section class="figsec"><div class="fighead"><div><h2>拠点の略図</h2><p>災害の種類ごとに、拠点の損害の大きさを色で示します。</p></div>${seg('peril', [['max', '最大の災害']].concat(RR.perils.map((p) => [p.id, p.label])), st.peril)}</div><div id="fig5" class="figbox"></div></section>
<section class="figsec"><div class="fighead"><div><h2>リスク登録簿</h2><p>${R.items.length}件。行を押すと算出根拠が開きます。</p></div></div><div class="tablewrap" id="register"></div></section>`;
    drawFigs(st.built ? false : 'build'); st.built = true;
  }
  function drawFigs(anim) {
    if (st.view !== 'home') return; const items = mapItems(); const from = st.mapState === 'B' ? 'A' : st.mapState === 'C' ? 'B' : null;
    RR.charts.mount($('#fig1'), 'riskMap', { state: st.mapState, from, items }, anim);
    RR.charts.mount($('#fig2'), 'prepMap', { items }, anim === 'build' ? 'build' : false);
    RR.charts.mount($('#fig3'), 'heatmap', { site: st.site }, anim === 'build' ? 'build' : false);
    RR.charts.mount($('#fig4'), 'insBars', { items }, anim === 'build' ? 'build' : false);
    RR.charts.mount($('#fig5'), 'siteMap', { peril: st.peril }, false);
    const R = RR.compute(), L = R.level; const its = st.site || st.domain ? items : R.items;
    $('#register').innerHTML = `<table class="grid reg"><thead><tr><th class="num">順位</th><th>リスク</th><th>領域</th>${RR.levelShort.map((n) => `<th class="num">${E(n)}</th>`).join('')}<th class="num">賄えない額</th><th class="num">提案後</th><th class="ctr">等級</th><th class="ctr">頻度</th><th class="ctr">代替</th><th>未確認</th></tr></thead><tbody>${its.map((i) => `<tr data-key="${E(i.key)}" tabindex="0"><td class="num">${i.rank}</td><td>${i.gap ? '<span class="gapmark" title="備えの空白">▲</span>' : ''}${lab(i)}</td><td><i class="dom" style="background:var(--d-${i.domain})"></i>${E(RR.domainById[i.domain].label)}</td>${i.loss.map((x) => `<td class="num">${M(x)}</td>`).join('')}<td class="num b">${M(i.uninsured[L])}</td><td class="num">${i.hasPlan ? M(i.uninsuredC[L]) : '—'}</td><td class="ctr"><span class="gr" style="background:var(--m${i.grade(L)})${i.grade(L) >= 4 ? ';color:#fff' : ''}">${i.grade(L)}</span></td><td class="ctr">${i.freqGrade}</td><td class="ctr">${i.prep.alt || '<span class="unc">未回答</span>'}</td><td>${i.unconfirmed.length ? `<span class="unc">未確認 ${i.unconfirmed.length}</span>` : ''}</td></tr>`).join('')}</tbody></table>`;
  }
  function openRisk(key) {
    const R = RR.compute(), L = R.level; const it = R.items.find((i) => i.key === key); if (!it) return; const S = it.state(L); const d = $('#drawer');
    const row = (k, v) => `<tr><th>${k}</th><td>${v}</td></tr>`; const pl = (n) => (n ? `<span class="pl pl${n}">${n}</span> ${E(RR.prepLevels[n - 1].replace(/^\d\s*/, ''))}` : '<span class="unc">未回答</span>（段階1として扱う）');
    d.innerHTML = `<div class="dr-head"><div><div class="kicker"><i class="dom" style="background:var(--d-${it.domain})"></i>${E(RR.domainById[it.domain].long)}　順位 ${it.rank} / ${R.items.length}</div><h2>${lab(it)}</h2></div><button type="button" class="btn sm" data-act="close-drawer" aria-label="閉じる">閉じる</button></div>
<p class="dr-sc">${E(it.scenario || '')}</p>
<div class="lv3">${it.loss.map((x, i) => `<div class="${i === L ? 'on' : ''}"><span>${E(RR.levelNames[i])}</span><b class="num">${moneyBig(x)}</b></div>`).join('')}</div>
<h3>3つの状態（${E(RR.levelShort[L])}）</h3>
<table class="kv"><thead><tr><th></th><th class="num">損害／賄えない額</th><th class="ctr">影響</th><th class="ctr">頻度</th></tr></thead><tbody>${['A', 'B', 'C'].map((k) => `<tr class="${st.mapState === k ? 'cur' : ''}"><th>${E(RR.charts.stateName[k])}</th><td class="num b">${M(S[k].loss)}</td><td class="ctr">${S[k].imp.g}</td><td class="ctr">${S[k].freq}</td></tr>`).join('')}</tbody></table>
<h3>算出根拠</h3><ul class="basis-l">${it.basis[L].map((b) => `<li>${E(b)}</li>`).join('')}${it.sevNotes.map((b) => `<li>${E(b)}</li>`).join('')}</ul>
<p class="fine">頻度：${E(it.freqBasis.join('／'))}</p>
<p class="fine warn">係数の初期値は仮置きです。「設定」で変更できます。</p>
${it.unconfirmed.length ? `<p class="uncbox"><span class="unc">未確認</span> この金額には、未確認・未記入の入力が${it.unconfirmed.length}項目含まれます：${it.unconfirmed.map(E).join('、')}</p>` : ''}
<h3>備えの状況</h3><table class="kv">${row('予防', pl(it.prep.prevent))}${row('代替手段', pl(it.prep.alt))}${row('復旧手順', pl(it.prep.recover))}${row('保険', pl(it.prep.insure))}${it.prep.memo ? row('内容', E(it.prep.memo)) : ''}</table>${it.gap ? '<p class="gapnote">▲ 備えの空白：損害が自己負担できる額を超え、代替手段が整っていません。</p>' : ''}
<h3>紐づく証券</h3>${it.ins[L].lines.length ? `<ul class="basis-l">${it.ins[L].lines.map((b) => `<li>${E(b)}</li>`).join('')}</ul>` : '<p>紐づく証券はありません。</p>'}<p class="fine">賄えない額 ＝ 損害額 − 支払限度額 ＋ 免責金額。補償の可否は約款と保険会社の判断によります。</p>
<h3>改善提案</h3>${it.proposals.length ? `<ul class="prl">${it.proposals.map((p) => `<li><b>${E(p.f.pr_priority || '')}</b> ${E(p.f.pr_title)}<span>${E(p.f.pr_status || '')}・${E(p.f.pr_cost || '')}・${E(p.f.pr_due || '')}</span></li>`).join('')}</ul>` : `<p>登録された提案はありません。</p>${it.measures.length ? `<p class="fine">対策の例（リスク辞書）：${it.measures.map(E).join('、')}</p>` : ''}`}`;
    d.classList.add('on'); $('#scrim').classList.add('on'); d.focus();
  }
  const closeDrawer = () => { $('#drawer').classList.remove('on'); $('#scrim').classList.remove('on'); };

  /* ---------- 簡易入力 ---------- */
  const QGROUP = { company: '会社', site: 'モノ（最大の拠点）', building: 'モノ（最大の拠点）', hazard: 'モノ（最大の拠点）', line: '事業の停止', system: 'サイバー', cyber: 'サイバー', liability: '賠償', people: 'ヒト', finance: '財務・経営', overseasq: '海外' };
  function firstRec(layer, create) {
    const L = RR.layers[layer]; const prov = { row: { src: '簡易入力', date: RR.today(), method: '聞き取り' } };
    if (layer === 'site') { let s = RR.rows('site')[0]; if (!s && create) s = RR.addRow('site', { site_name: '主要拠点', site_use: '工場' }, prov); return s; }
    if (L.siteField) { const s = firstRec('site', create); if (!s) return null; let r = RR.rows(layer).find((x) => x.f[L.siteField] === s.id); if (!r && create) r = RR.addRow(layer, { [L.siteField]: s.id, [L.nameField || '_']: layer === 'building' ? '主要建物' : layer === 'line' ? '主要工程' : undefined }, prov); return r; }
    let r = RR.rows(layer)[0]; if (!r && create) r = RR.addRow(layer, { [L.nameField]: layer === 'system' ? '基幹システム' : '' }, prov); return r;
  }
  function renderQuick() {
    const host = $('#v-quick'); const qs = RR.qs.filter((q) => q.quick && q.layer !== 'prep').sort((a, b) => a.quick - b.quick); const groups = {};
    qs.forEach((q) => (groups[QGROUP[q.layer] || 'その他'] = groups[QGROUP[q.layer] || 'その他'] || []).push(q));
    const field = (q) => { const kind = RR.layers[q.layer].kind; const rec = kind === 'items' ? null : firstRec(q.layer, false); const v = kind === 'items' ? RR.val(q.id) : rec ? rec.f[q.id] : ''; return `<div class="qf"><label>${E(RR.t(q.label))}${RR.unitOf(q) ? `<span class="u">${E(RR.unitOf(q))}</span>` : ''}</label>${input(q, v, 'data-quick="1"')}${q.help ? `<p class="help">${E(q.help)}</p>` : ''}</div>`; };
    const domAlt = (d) => { const rs = RR.risks.filter((r) => r.domain === d.id).map((r) => RR.rows('prep').find((p) => p.f.prep_risk === r.name && !p.f.prep_site)).filter(Boolean).map((p) => RR.lvl(p.f.prep_alt)).filter(Boolean); const cur = rs.length ? Math.min(...rs) : ''; return `<div class="qf"><label><i class="dom" style="background:var(--d-${d.id})"></i>${E(d.label)}</label><select data-quickprep="${d.id}" aria-label="${E(d.label)}の代替手段"><option value=""></option>${RR.prepLevels.map((l, i) => `<option value="${i + 1}"${cur === i + 1 ? ' selected' : ''}>${E(l)}</option>`).join('')}</select></div>`; };
    host.innerHTML = `<div class="pagehead"><div><h1>簡易入力</h1><p>約${qs.length + 7}項目。答えるたびに、右の想定損害額と純資産に対する比率が変わります。ここで入れたデータは、そのまま網羅版の土台になります。</p></div>${RR.case.meta.isSample ? '<div class="notice">いまはサンプル企業のデータが入っています。<button type="button" class="btn pri sm" data-act="blank">白紙にして自社の入力を始める</button></div>' : '<div class="notice">入力は端末の中にだけ保存されます。<button type="button" class="btn sm" data-act="sample">サンプルに戻す</button></div>'}</div>
<div class="quick"><form class="qform" onsubmit="return false">${Object.keys(groups).map((g) => `<fieldset><legend>${E(g)}</legend><div class="qgrid">${groups[g].map(field).join('')}</div></fieldset>`).join('')}
<fieldset><legend>備え：代替手段はどこまで用意していますか</legend><p class="help">止まったときの代わりの手段（予備設備、他拠点、外注、バックアップなど）を、領域ごとに選びます。</p><div class="qgrid">${RR.domains.map(domAlt).join('')}</div></fieldset></form>
<aside class="qlive" id="qlive"></aside></div>`;
    renderQuickLive(true);
  }
  function renderQuickLive(build) {
    const R = RR.compute(), L = R.level; const el = $('#qlive'); if (!el) return; const top = R.items[0];
    const byDom = RR.domains.map((d) => { const its = R.items.filter((i) => i.domain === d.id).sort((a, b) => b.loss[L] - a.loss[L]); return { d, it: its[0] }; }); const max = Math.max(1, ...byDom.map((x) => (x.it ? x.it.loss[L] : 0)));
    const ratio = top && R.net > 0 ? (top.loss[L] / R.net) * 100 : null;
    el.innerHTML = `<div class="ql-top"><div class="k-l">最大の想定損害（${E(RR.levelShort[L])}）</div><div class="ql-big num">${top ? moneyBig(top.loss[L]) : '—'}</div><div class="ql-sub">${top ? lab(top) : '売上高・純資産・拠点の資産額を入れると表示されます'}</div>
<div class="ql-ratio"><div><span>純資産に対する比率</span><b class="num">${ratio === null ? '—' : RR.n0(ratio) + '%'}</b></div><div><span>うち保険で賄えない額</span><b class="num">${top ? M(top.uninsured[L]) : '—'}</b></div><div><span>備えの空白</span><b class="num">${R.gapsHead.length}種類</b></div></div></div>
<div class="ql-dom"><div class="k-l">7つの領域（各領域で最大のリスク）</div>${byDom.map((x) => `<div class="qd" ${x.it ? `data-key="${E(x.it.key)}" tabindex="0"` : ''}><div class="qd-n"><i class="dom" style="background:var(--d-${x.d.id})"></i>${E(x.d.label)}</div><div class="qd-bar"><i style="width:${x.it ? Math.max(1, (x.it.loss[L] / max) * 100) : 0}%;background:var(--d-${x.d.id})"></i></div><div class="qd-v num">${x.it ? M(x.it.loss[L]) : '—'}</div><div class="qd-r num">${x.it && R.net > 0 ? RR.n0((x.it.loss[L] / R.net) * 100) + '%' : ''}</div></div>`).join('')}</div>
<div id="qmap" class="figbox"></div><p class="fine">係数の初期値は仮置きです。金額は試算で、補償の可否を示すものではありません。<a href="#report">簡易版レポートを開く</a></p>`;
    RR.charts.mount($('#qmap'), 'riskMap', { state: 'A', max: 10 }, build ? 'build' : false);
  }
  const quickLive = debounce(() => renderQuickLive(false), 140);
  function onQuickInput(el) {
    const q = RR.qById[el.dataset.q]; const v = readInput(q, el);
    if (RR.layers[q.layer].kind === 'items') { const had = RR.case.items[q.id]; RR.setItem(q.id, v, had ? null : { method: '聞き取り', src: '簡易入力', date: RR.today() }); if (q.id === 'co_industry') { RR.rebuild(); } }
    else { const r = firstRec(q.layer, true); r.f[q.id] = v; if (q.id === 'hz_depth_max') {} RR.touch(); }
    quickLive();
  }
  function onQuickPrep(el) {
    const lv = el.value ? RR.prepLevels[Number(el.value) - 1] : '';
    for (const r of RR.risks.filter((x) => x.domain === el.dataset.quickprep)) { let p = RR.rows('prep').find((x) => x.f.prep_risk === r.name && !x.f.prep_site); if (!p) p = RR.addRow('prep', { prep_risk: r.name }, { row: { src: '簡易入力', date: RR.today(), method: '聞き取り' } }); p.f.prep_alt = lv; }
    RR.touch(); quickLive();
  }

  /* ---------- データ（Excelの往復と編集） ---------- */
  function editor(layer) {
    const L = RR.layers[layer]; const qs = RR.qsOf(layer);
    if (L.kind === 'items') return `<div class="tablewrap"><table class="grid edit"><thead><tr><th>項目</th><th>回答</th><th>確認方法</th><th>出典</th><th>確認日</th></tr></thead><tbody>${qs.map((q) => { const it = RR.case.items[q.id] || {}; const pv = RR.provOf(q); return `<tr><td class="ql">${E(RR.t(q.label))}${q.req ? ' <b class="req">＊</b>' : ''}${RR.unitOf(q) ? `<span class="u">${E(RR.unitOf(q))}</span>` : ''}${q.pack ? '<span class="tag">業種</span>' : ''}${q.help ? `<p class="help">${E(q.help)}</p>` : ''}</td><td>${input(q, it.v, 'data-edit="item"')}${pv.empty ? '<span class="unc">未記入</span>' : ''}</td><td>${methodSel(it.method, `data-edit="item-prov" data-k="method" data-q="${q.id}"`)}</td><td><input data-edit="item-prov" data-k="src" data-q="${q.id}" value="${E(it.src || '')}" aria-label="出典"></td><td><input type="date" data-edit="item-prov" data-k="date" data-q="${q.id}" value="${E(it.date || '')}" aria-label="確認日"></td></tr>`; }).join('')}</tbody></table></div>`;
    const pgs = [{ id: 'row', label: '' }].concat(L.pgs || []); const recs = RR.rows(layer);
    return `<div class="tablewrap"><table class="grid edit wide"><thead><tr>${qs.map((q) => `<th title="${E(q.help || '')}">${E(RR.t(q.label))}${q.req ? ' <b class="req">＊</b>' : ''}${RR.unitOf(q) ? `<span class="u">${E(RR.unitOf(q))}</span>` : ''}</th>`).join('')}${pgs.map((p) => `<th>${E(p.label ? p.label + 'の' : '')}確認方法</th><th>${E(p.label ? p.label + 'の' : '')}出典</th>`).join('')}<th></th></tr></thead><tbody>${recs.map((r) => `<tr data-id="${E(r.id)}">${qs.map((q) => `<td class="t-${q.type}">${input(q, r.f[q.id], `data-edit="row" data-layer="${layer}" data-id="${E(r.id)}"`)}</td>`).join('')}${pgs.map((p) => { const x = (r.prov || {})[p.id] || {}; return `<td>${methodSel(x.method, `data-edit="row-prov" data-layer="${layer}" data-id="${E(r.id)}" data-pg="${p.id}" data-k="method"`)}</td><td><input data-edit="row-prov" data-layer="${layer}" data-id="${E(r.id)}" data-pg="${p.id}" data-k="src" value="${E(x.src || '')}" aria-label="出典"></td>`; }).join('')}<td><button type="button" class="btn sm ghost" data-act="del-row" data-layer="${layer}" data-id="${E(r.id)}" aria-label="行を削除">削除</button></td></tr>`).join('')}</tbody></table></div><div class="row"><button type="button" class="btn sm" data-act="add-row" data-layer="${layer}">行を追加</button><span class="fine">${recs.length}件。${RR.t(L.label)}は何件でも追加できます。</span></div>`;
  }
  function issueTable(issues) {
    if (!issues.length) return '<p class="ok">問題は見つかりませんでした。</p>'; const cnt = {}; issues.forEach((i) => (cnt[i.kind] = (cnt[i.kind] || 0) + 1));
    return `<div class="cnt">${['未記入', '形式違い', '桁違いの疑い', '矛盾'].map((k) => `<span><b class="num">${cnt[k] || 0}</b>${k}</span>`).join('')}</div><div class="tablewrap tall"><table class="grid"><thead><tr><th>種類</th><th>シート</th><th>場所</th><th>内容</th></tr></thead><tbody>${issues.map((i) => `<tr class="sev-${i.sev}"><td><span class="kind k-${i.sev}">${E(i.kind)}</span></td><td>${E(i.sheet || '')}</td><td>${E(i.where || '')}</td><td>${E(i.msg)}</td></tr>`).join('')}</tbody></table></div>`;
  }
  function renderData() {
    const host = $('#v-data'); const P = st.pending; const xl = RR.excel.ready();
    const layerTabs = Object.keys(RR.layers).filter((l) => l !== 'proposal').map((l) => `<button type="button" data-seg="layer" data-val="${l}" class="${st.layer === l ? 'on' : ''}">${E(RR.t(RR.layers[l].label))}<small>${RR.layers[l].kind === 'table' ? RR.rows(l).length : ''}</small></button>`).join('');
    host.innerHTML = `<div class="pagehead"><div><h1>データ</h1><p>Excel様式を出力して顧客に記入してもらい、記入済みのファイルをここに入れると、検証してから診断とレポートに反映します。ファイルは端末の外に送信しません。</p></div></div>
${xl ? '' : '<div class="notice bad">Excelを読み書きする部品を読み込めませんでした。インターネットに接続して開き直すか、すべてを内蔵した index.offline.html を使ってください。JSONでの書き出し・読み込みと画面での編集は使えます。</div>'}
<div class="cols2">
 <section class="panel"><h2>1　様式を出力する</h2>
  <div class="frm"><label>業種 <select id="x-ind">${RR.raw.industries.packs.map((p) => `<option${p.id === RR.val('co_industry') ? ' selected' : ''}>${E(p.id)}</option>`).join('')}</select></label><label>拠点数 <input id="x-sites" type="number" min="1" max="200" value="${Math.max(1, RR.rows('site').length)}" class="numf"></label><label class="chk"><input type="checkbox" id="x-filled" checked> いまのデータを記入済みにする（事前調査の結果を含む）</label></div>
  <div class="row"><button type="button" class="btn pri" data-act="xl-full"${xl ? '' : ' disabled'}>網羅版の様式（全15シート）</button><button type="button" class="btn" data-act="xl-quick"${xl ? '' : ' disabled'}>簡易版の様式（4シート）</button><button type="button" class="btn" data-act="xl-sample"${xl ? '' : ' disabled'}>記入済みのサンプル</button></div>
  <p class="fine">業種を選ぶと、その業種の追加質問が様式に入ります。すべての記入欄に固定の項目IDがあり、列や行を入れ替えても読み込めます。</p></section>
 <section class="panel"><h2>2　記入済みのExcelを読み込む</h2>
  <label class="drop" id="drop"><input type="file" id="x-file" accept=".xlsx" hidden><b>ここに .xlsx を置く</b><span>または押してファイルを選ぶ</span></label>
  <div class="row"><button type="button" class="btn sm" data-act="json-out">案件データをJSONで書き出す</button><label class="btn sm">JSONを読み込む<input type="file" id="j-file" accept=".json,application/json" hidden></label><button type="button" class="btn sm" data-act="check">いまのデータを検証する</button></div></section>
</div>
${P ? `<section class="panel pend"><h2>読み込みの結果：${E(P.name)}</h2><p>${P.kind === 'check' ? 'いまのデータの検証結果です。' : `読めた内容：拠点 ${P.case.rows.site.length}件、建物 ${P.case.rows.building.length}件、工程 ${P.case.rows.line.length}件、証券 ${P.case.rows.policy.length}件、全社の項目 ${Object.keys(P.case.items).length}件。問題があっても、読めた分だけで診断を進められます。`}</p>${issueTable(P.issues)}
${P.kind === 'check' ? '<div class="row"><button type="button" class="btn" data-act="pend-cancel">閉じる</button></div>' : `<h3>いまのデータから変わる項目（${P.diff.length}件）</h3>${P.diff.length ? `<div class="tablewrap tall"><table class="grid"><thead><tr><th>種類</th><th>対象</th><th>項目</th><th>いま</th><th>読み込み後</th></tr></thead><tbody>${P.diff.slice(0, 400).map((d) => `<tr><td>${E(d.type)}</td><td>${E(d.where)}</td><td>${E(d.label)}</td><td class="old">${E(d.old)}</td><td class="new">${E(d.new)}</td></tr>`).join('')}</tbody></table></div>${P.diff.length > 400 ? `<p class="fine">ほか${P.diff.length - 400}件。</p>` : ''}` : '<p class="ok">いまのデータと同じ内容です。</p>'}
<div class="row"><label class="chk"><input type="checkbox" id="x-keep" checked> 改善提案・写真と所見・AIの文章は、いまのものを引き継ぐ</label></div><div class="row"><button type="button" class="btn pri" data-act="pend-apply">この内容を反映する</button><button type="button" class="btn" data-act="pend-cancel">やめる</button></div>`}</section>` : ''}
<section class="panel"><h2>3　画面で確認・編集する</h2><div class="tabs">${layerTabs}</div><div id="editor">${editor(st.layer)}</div></section>`;
  }
  async function exportXlsx(edition, sample) {
    try {
      RR.toast('様式を作っています…'); const keep = RR.case, kr = RR.result; const ind = $('#x-ind').value; let filled = $('#x-filled').checked; const sites = Number($('#x-sites').value) || 1;
      if (sample) { RR.case = RR.buildSample(); RR.rebuild(); filled = true; }
      else if (!filled) { const c = RR.emptyCase(); c.items.co_industry = { v: ind, src: '', date: '', method: '未確認', note: '' }; RR.case = c; RR.rebuild(); filled = true; }
      else if (ind !== RR.val('co_industry')) { RR.case = JSON.parse(JSON.stringify(keep)); (RR.case.items.co_industry = RR.case.items.co_industry || { src: '', date: '', method: '未確認', note: '' }).v = ind; RR.rebuild(); }
      let blob; try { blob = await RR.excel.build({ edition, filled, sites: sample ? 0 : sites, industry: ind }); } finally { RR.case = keep; RR.rebuild(); RR.result = kr; }
      RR.download(blob, `リスク診断様式_${edition === 'quick' ? '簡易版' : '網羅版'}_${sample ? 'サンプル記入済み' : (RR.val('co_name') || '未記入')}_${RR.today()}.xlsx`); RR.toast('様式を出力しました');
    } catch (e) { console.error(e); RR.toast('様式を作れませんでした：' + e.message); }
  }
  async function importXlsx(file) {
    if (!RR.excel.ready()) return RR.toast('Excelを読む部品が読み込まれていません');
    try { RR.toast('読み込んでいます…'); const buf = await file.arrayBuffer(); const res = await RR.excel.parse(buf); const issues = RR.excel.validate(res.case, res.issues); st.pending = { kind: 'xlsx', name: file.name, case: res.case, issues, diff: RR.excel.diff(RR.case, res.case) }; renderData(); $('.pend').scrollIntoView({ behavior: 'smooth' }); }
    catch (e) { console.error(e); RR.toast('読み込めませんでした：' + e.message); }
  }
  function applyPending() {
    const P = st.pending; if (!P) return; const c = P.case; const keep = $('#x-keep') && $('#x-keep').checked;
    if (keep) { c.rows.proposal = RR.case.rows.proposal || []; c.rows.finding = RR.case.rows.finding || []; c.ai = RR.case.ai || {}; }
    c.settings = RR.case.settings; c.meta.isSample = false; for (const l in c.rows) c.rows[l].forEach((r) => { delete r._row; delete r._sheet; });
    RR.setCase(c); st.pending = null; st.built = false; st.reportKey = ''; RR.toast('反映しました。診断を更新しました'); go('home');
  }

  /* ---------- 提案台帳 ---------- */
  function renderProposals() {
    const host = $('#v-proposals'); const sug = RR.suggestProposals(); st.sug = sug;
    host.innerHTML = `<div class="pagehead"><div><h1>提案台帳</h1><p>提案ごとに、対象拠点、優先度、費用感、期限、状況を持ちます。効果の見込みを記入すると、リスクマップの「提案を実行した後」に反映されます。翌年の調査では、この台帳で進捗を追います。</p></div></div>
<section class="panel"><h2>台帳</h2>${editor('proposal')}</section>
<section class="panel"><h2>回答から起こした候補（${sug.length}件）</h2><p class="fine">損害が大きいリスクと備えの空白から、リスク辞書の対策例を当てはめた候補です。効果の数値は入っていません。台帳に加えてから、内容と効果の見込みを記入してください。</p>
${sug.length ? `<div class="tablewrap"><table class="grid"><thead><tr><th>優先</th><th>対象</th><th>リスク</th><th>提案</th><th>根拠</th><th></th></tr></thead><tbody>${sug.map((s, i) => `<tr><td class="ctr b">${E(s.pr_priority)}</td><td>${E(s.pr_site ? RR.siteName(s.pr_site) : '全社')}</td><td>${E(s.pr_risk)}</td><td>${E(s.pr_title)}</td><td class="fine">${E(s.pr_detail)}</td><td><button type="button" class="btn sm" data-act="add-sug" data-i="${i}">台帳に加える</button></td></tr>`).join('')}</tbody></table></div>` : '<p>いまの回答から起こせる候補はありません。</p>'}</section>`;
  }

  /* ---------- レポート ---------- */
  async function renderReport(force) {
    const host = $('#v-report'); const key = RR.case.meta.updated + '|' + st.edition + '|' + JSON.stringify(RR.raw.coefficients).length;
    if (!$('#pages')) host.innerHTML = `<div class="rtool"><div class="pagehead"><div><h1>レポート</h1><p id="rinfo">紙面を組んでいます…</p></div></div><div class="row">${seg('edition', [['full', '網羅版'], ['quick', '簡易版']], st.edition)}<label>移動 <select id="r-jump"></select></label><button type="button" class="btn pri" data-act="print">印刷・PDFに保存</button></div><p class="fine">印刷の設定は、用紙A4・縦、余白「なし」、「背景のグラフィック」をオンにしてください。画面の紙面と同じページ割りで出ます。</p></div><div id="pagewrap"><div id="pages"></div></div>`;
    else $$('#v-report .seg button').forEach((b) => b.classList.toggle('on', b.dataset.val === st.edition));
    fitPages();
    if (!force && st.reportKey === key) return;
    st.reportKey = key; $('#rinfo').textContent = '紙面を組んでいます…'; const t0 = performance.now();
    const res = await RR.report.render($('#pages'), { edition: st.edition, onProgress: (n) => { const e = $('#rinfo'); if (e) e.textContent = `紙面を組んでいます… ${n}ページ`; } });
    st.reportPages = res.pages; $('#rinfo').textContent = `${st.edition === 'quick' ? '簡易版' : '網羅版'}　全${res.pages}ページ（A4縦）。データを変えると、開き直したときに組み直します。`;
    $('#r-jump').innerHTML = `<option value="1">表紙</option>` + res.toc.map((t) => `<option value="${t.page}">${t.lvl ? '　' : ''}${E((t.no ? t.no + '　' : '') + t.title)}（${t.page}）</option>`).join('');
    document.body.dataset.rendered = '1'; console.debug('report', res.pages, 'pages', Math.round(performance.now() - t0), 'ms');
  }
  function fitPages() { const w = $('#pagewrap'); if (!w) return; const z = Math.min(1, (w.clientWidth - 2) / 794); $('#pages').style.zoom = z; }

  /* ---------- AIプロンプト ---------- */
  function renderAI() {
    const host = $('#v-ai'); const list = RR.prompts.list(); if (!list.some((p) => p.key === st.promptKey)) st.promptKey = 'c1'; const cur = list.find((p) => p.key === st.promptKey); const groups = {}; list.forEach((p) => (groups[p.group] = groups[p.group] || []).push(p)); const text = RR.prompts.build(st.promptKey);
    host.innerHTML = `<div class="pagehead"><div><h1>AIプロンプト</h1><p>数値・順位・等級は規則で計算し、AIには変えさせません。AIの役割は、計算結果と回答を根拠に文章を書くことです。ここでプロンプトを写し取り、お使いのAIに渡して、出力を貼り付けると、レポートの該当する章に入ります。このアプリからAIを直接呼び出すことはありません。</p></div><label class="chk"><input type="checkbox" id="ai-mask"${RR.case.settings.mask ? ' checked' : ''}> 会社名・取引先名・保険会社名を伏せ字にする</label></div>
<div class="ai"><nav class="ailist">${Object.keys(groups).map((g) => `<div class="ag">${E(g)}</div>${groups[g].map((p) => `<button type="button" data-seg="prompt" data-val="${E(p.key)}" class="${p.key === st.promptKey ? 'on' : ''}">${E(p.title)}${p.paste && (RR.case.ai[p.key] || '').trim() ? '<i class="done" title="AIの文章あり">済</i>' : ''}</button>`).join('')}`).join('')}</nav>
<div class="aimain"><div class="row between"><h2>${E(cur.group)}｜${E(cur.title)}</h2><button type="button" class="btn pri" data-act="copy-prompt">プロンプトを写し取る</button></div><textarea id="ptext" readonly rows="18" aria-label="プロンプト">${E(text)}</textarea><p class="fine">${RR.n0(text.length)}字。執筆プロンプトには「データにない事実を作らない／不足は要確認と書く／数値を変えない／事実・推定・推奨を分ける／補償の可否を断定しない／出典を付ける」のルールが入っています。</p>
${cur.paste ? `<h3>AIの出力を貼り付ける</h3><textarea id="aiout" rows="9" placeholder="ここに貼り付けた文章が、レポートのこの章（拠点）の本文になります。空のときは、規則で書いた短い本文が入ります。" aria-label="AIの出力">${E(RR.case.ai[st.promptKey] || '')}</textarea><p class="fine">貼り付けた文章は、提出前に必ず「検証（本文とデータの照合）」にかけ、担当者が確認してください。</p>` : '<p class="fine">このプロンプトの出力は、Excel様式や提案台帳に、担当者が確認したうえで記入します。</p>'}</div></div>`;
  }

  /* ---------- 設定 ---------- */
  function renderSettings() {
    const host = $('#v-settings'); const C = RR.raw.coefficients; const L = RR.case.settings.level;
    host.innerHTML = `<div class="pagehead"><div><h1>設定</h1><p>係数、水準の呼び名、データ定義を変更します。変更はこの端末に保存され、すべての図とレポートに反映されます。</p></div></div>
<section class="panel"><h2>表示</h2><div class="frm"><label>順位と図に使う損害の水準 <select id="s-level">${RR.levelNames.map((n, i) => `<option value="${i}"${i === L ? ' selected' : ''}>${E(n)}</option>`).join('')}</select></label>${RR.levelNames.map((n, i) => `<label>水準${i + 1}の呼び名 <input data-lname="${i}" value="${E(n)}"></label><label>短い呼び名 <input data-lshort="${i}" value="${E(RR.levelShort[i])}" class="short"></label>`).join('')}</div>
<div class="row"><button type="button" class="btn sm" data-act="theme">明るい配色／暗い配色を切り替える</button><button type="button" class="btn sm" data-act="sample">サンプルのデータに戻す</button><button type="button" class="btn sm" data-act="blank">白紙の案件にする</button></div></section>
<section class="panel"><h2>係数表</h2><div class="notice warnbox"><b>係数は仮置きです。</b>${E(C.notice)}</div>
<div class="coefs">${C.tables.map((t) => `<div class="coef"><div class="coef-h">${E(t.label)}${t.unit ? `<span class="u">${E(t.unit)}</span>` : ''}</div><table class="grid"><thead><tr><th></th>${t.cols.map((c) => `<th class="num">${E(c)}</th>`).join('')}</tr></thead><tbody>${Object.keys(t.rows).map((k) => `<tr><th>${E(k)}</th>${t.rows[k].map((v, j) => `<td><input type="number" step="any" class="numf" data-coef="${t.id}" data-row="${E(k)}" data-col="${j}" value="${v}" aria-label="${E(t.label + ' ' + k + ' ' + t.cols[j])}"></td>`).join('')}</tr>`).join('')}</tbody></table><div class="coef-s"><label>出典 <input data-coefmeta="${t.id}" data-k="source" value="${E(t.source || '')}" placeholder="未設定（仮置き）"></label><label>改定日 <input type="date" data-coefmeta="${t.id}" data-k="revised" value="${E(t.revised || '')}"></label></div></div>`).join('')}</div>
<div class="row"><button type="button" class="btn sm" data-act="def-reset" data-def="coefficients">係数表を初期値に戻す</button></div></section>
<section class="panel"><h2>データ定義（コードではなくデータで持つ5つ）</h2><p>質問マスタに1行足すと、Excel様式・入力画面・レポートの3か所に出ます。リスク辞書に1件足すと、マップと登録簿に出ます。下の欄でJSONを直接編集できます。同じ内容は、HTMLファイル内の <code>&lt;script type="application/json" id="def-…"&gt;</code> にも入っています。</p>
<div class="row"><button type="button" class="btn sm" data-act="demo-q">試しに質問を1行足す（建物に「非常用発電機」）</button></div>
${RR.DEF_NAMES.map((n) => `<details class="def"><summary>${E(RR.DEF_LABELS[n])}<small>${RR.defIsCustom(n) ? 'この端末で変更あり' : '初期値'}　${n === 'questions' ? RR.raw.questions.questions.length + '問' : n === 'risks' ? RR.raw.risks.risks.length + '件' : n === 'coefficients' ? C.tables.length + '表' : n === 'industries' ? RR.raw.industries.packs.length + '業種' : RR.raw.chapters.chapters.length + '章'}</small></summary><textarea data-def="${n}" rows="14" spellcheck="false" aria-label="${E(RR.DEF_LABELS[n])}のJSON"></textarea><div class="row"><button type="button" class="btn sm pri" data-act="def-save" data-def="${n}">保存して反映する</button><button type="button" class="btn sm" data-act="def-reset" data-def="${n}">初期値に戻す</button><button type="button" class="btn sm" data-act="def-dl" data-def="${n}">JSONを書き出す</button></div></details>`).join('')}</section>`;
  }
  const prettyDef = (n) => { const o = RR.raw[n]; if (n === 'questions') return JSON.stringify(o, null, 1).replace(/\{\n\s+"id"[\s\S]*?\n\s{2}\}/g, (m) => m.replace(/\n\s*/g, ' ')); return JSON.stringify(o, null, 1); };

  /* ---------- 操作 ---------- */
  function setTheme(t) { if (t) document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme; RR.LS.set('rr.theme', t || ''); }
  function onClick(e) {
    const t = e.target.closest('[data-act],[data-seg],[data-key]'); if (!t) return;
    if (t.dataset.seg) {
      const v = t.dataset.val; const k = t.dataset.seg;
      if (k === 'state') { if (v === st.mapState) return; st.prevState = st.mapState; st.mapState = v; $$('[data-seg="state"]').forEach((b) => b.classList.toggle('on', b.dataset.val === v)); const from = v === 'B' ? 'A' : v === 'C' ? 'B' : null; RR.charts.mount($('#fig1'), 'riskMap', { state: v, from, items: mapItems() }, 'move'); return; }
      if (k === 'domain') { st.domain = v; $$('[data-seg="domain"]').forEach((b) => b.classList.toggle('on', b.dataset.val === v)); drawFigs(false); return; }
      if (k === 'peril') { st.peril = v; $$('[data-seg="peril"]').forEach((b) => b.classList.toggle('on', b.dataset.val === v)); RR.charts.mount($('#fig5'), 'siteMap', { peril: v }, false); return; }
      if (k === 'layer') { st.layer = v; renderData(); return; }
      if (k === 'edition') { st.edition = v; renderReport(); return; }
      if (k === 'prompt') { st.promptKey = v; renderAI(); return; }
    }
    if (t.dataset.key && !t.dataset.act) { if (!t.dataset.key.startsWith('site:')) openRisk(t.dataset.key); return; }
    const a = t.dataset.act;
    if (a === 'close-drawer') closeDrawer();
    else if (a === 'blank') { if (confirm('いまのデータを消して、白紙の案件にします。よろしいですか。（必要なら先に「データ」画面でJSONを書き出してください）')) { const c = RR.emptyCase(); c.items.co_industry = { v: '製造', src: '', date: '', method: '未確認', note: '' }; RR.setCase(c); st.built = false; st.reportKey = ''; render(); RR.toast('白紙の案件にしました'); } }
    else if (a === 'sample') { if (confirm('いまのデータを消して、サンプル（架空）のデータに戻します。よろしいですか。')) { RR.setCase(RR.buildSample()); st.built = false; st.reportKey = ''; render(); RR.toast('サンプルのデータに戻しました'); } }
    else if (a === 'xl-full') exportXlsx('full'); else if (a === 'xl-quick') exportXlsx('quick'); else if (a === 'xl-sample') exportXlsx('full', true);
    else if (a === 'json-out') RR.download(new Blob([JSON.stringify(RR.case, null, 1)], { type: 'application/json' }), `リスク診断_案件データ_${RR.val('co_name') || '未記入'}_${RR.today()}.json`);
    else if (a === 'check') { st.pending = { kind: 'check', name: 'いまのデータ', case: RR.case, issues: RR.excel.validate(RR.case, []), diff: [] }; renderData(); $('.pend').scrollIntoView({ behavior: 'smooth' }); }
    else if (a === 'pend-cancel') { st.pending = null; renderData(); } else if (a === 'pend-apply') applyPending();
    else if (a === 'add-row') { RR.addRow(t.dataset.layer, {}, { row: { src: '', date: RR.today(), method: '未確認' } }); RR.touch(); render(); }
    else if (a === 'del-row') { const rows = RR.rows(t.dataset.layer); const i = rows.findIndex((r) => r.id === t.dataset.id); if (i >= 0 && confirm(`${t.dataset.id} を削除します。よろしいですか。`)) { rows.splice(i, 1); RR.touch(); render(); } }
    else if (a === 'add-sug') { const s = st.sug[Number(t.dataset.i)]; RR.addRow('proposal', s, { row: { src: '回答から起案', date: RR.today(), method: '資料' } }); RR.touch(); renderProposals(); RR.toast('台帳に加えました'); }
    else if (a === 'print') { (async () => { await renderReport(); $('#pages').style.zoom = 1; window.print(); fitPages(); })(); }
    else if (a === 'copy-prompt') { const ta = $('#ptext'); const done = () => RR.toast('プロンプトを写し取りました'); if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(ta.value).then(done, () => { ta.select(); document.execCommand('copy'); done(); }); else { ta.select(); document.execCommand('copy'); done(); } }
    else if (a === 'theme') { const cur = document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'); setTheme(cur === 'dark' ? 'light' : 'dark'); if (st.view === 'home') drawFigs(false); }
    else if (a === 'def-save') { const ta = $(`textarea[data-def="${t.dataset.def}"]`); try { const o = JSON.parse(ta.value); if (!o.version) throw new Error('"version" がありません'); RR.saveDef(t.dataset.def, o); RR.result = null; st.reportKey = ''; renderSettings(); RR.toast(RR.DEF_LABELS[t.dataset.def] + 'を保存し、反映しました'); } catch (err) { RR.toast('JSONとして読めません：' + err.message); } }
    else if (a === 'def-reset') { if (confirm(RR.DEF_LABELS[t.dataset.def] + 'を初期値に戻します。よろしいですか。')) { RR.resetDef(t.dataset.def); RR.result = null; st.reportKey = ''; renderSettings(); RR.toast('初期値に戻しました'); } }
    else if (a === 'def-dl') RR.download(new Blob([JSON.stringify(RR.raw[t.dataset.def], null, 1)], { type: 'application/json' }), `${t.dataset.def}.json`);
    else if (a === 'demo-q') { const o = JSON.parse(JSON.stringify(RR.raw.questions)); if (o.questions.some((q) => q.id === 'bld_generator')) return RR.toast('すでに追加されています'); const i = o.questions.findIndex((q) => q.id === 'bld_exposure'); o.questions.splice(i + 1, 0, { id: 'bld_generator', layer: 'building', label: '非常用発電機', type: 'select', opts: ['あり・燃料72時間以上', 'あり', 'なし'], cope: 'P', ex: 'あり', risks: ['bi'], fx: [{ r: 'bi', k: 'sev', m: { なし: 1.1, 'あり・燃料72時間以上': 0.95 } }], help: '停電時に、消火ポンプや排水ポンプを動かせるか。' }); RR.saveDef('questions', o); RR.result = null; st.reportKey = ''; renderSettings(); RR.toast('質問を1行足しました。「データ」の建物、Excel様式、レポート第6章と付録に出ます'); }
  }
  function onChange(e) {
    const el = e.target; const d = el.dataset;
    if (el.id === 'f-site') { st.site = el.value; $('#f-all').disabled = !!st.site; drawFigs(false); }
    else if (el.id === 'f-all') { st.all = el.checked; drawFigs(false); }
    else if (el.id === 'f-level' || el.id === 's-level') { RR.case.settings.level = Number(el.value); RR.touch(); st.reportKey = ''; if (st.view === 'home') renderHome(); }
    else if (el.id === 'x-file') { if (el.files[0]) importXlsx(el.files[0]); el.value = ''; }
    else if (el.id === 'j-file') { const f = el.files[0]; if (f) f.text().then((tx) => { try { const c = JSON.parse(tx); if (!c.items || !c.rows) throw new Error('案件データの形ではありません'); RR.setCase(c); st.built = false; st.reportKey = ''; RR.toast('案件データを読み込みました'); go('home'); render(); } catch (err) { RR.toast('読み込めませんでした：' + err.message); } }); el.value = ''; }
    else if (el.id === 'r-jump') { const p = $('#pg-' + el.value); if (p) p.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    else if (el.id === 'ai-mask') { RR.case.settings.mask = el.checked; RR.saveCase(); renderAI(); }
    else if (d.quick) onQuickInput(el); else if (d.quickprep) onQuickPrep(el);
    else if (d.edit === 'item') { const q = RR.qById[d.q]; RR.setItem(q.id, readInput(q, el)); if (q.id === 'co_industry') { RR.rebuild(); renderData(); } const u = el.parentNode.querySelector('.unc'); if (u && el.value !== '') u.remove(); }
    else if (d.edit === 'item-prov') { const it = RR.case.items[d.q] || (RR.case.items[d.q] = { v: '', src: '', date: '', method: '未確認', note: '' }); it[d.k] = el.value; RR.touch(); }
    else if (d.edit === 'row') { const q = RR.qById[d.q]; const r = RR.rows(d.layer).find((x) => x.id === d.id); if (!r) return; if (q.type === 'image') { const f = el.files[0]; if (f) shrink(f).then((url) => { r.f[q.id] = url; RR.touch(); render(); }); return; } const v = readInput(q, el); if (v === '') delete r.f[q.id]; else r.f[q.id] = v; RR.touch(); }
    else if (d.edit === 'row-prov') { const r = RR.rows(d.layer).find((x) => x.id === d.id); if (!r) return; r.prov = r.prov || {}; (r.prov[d.pg] = r.prov[d.pg] || { src: '', date: RR.today(), method: '未確認' })[d.k] = el.value; if (d.k === 'method' && el.value !== '未確認' && !r.prov[d.pg].date) r.prov[d.pg].date = RR.today(); RR.touch(); }
    else if (d.coef) { const o = RR.raw.coefficients; const t = o.tables.find((x) => x.id === d.coef); const v = Number(el.value); if (!isFinite(v)) return; t.rows[d.row][Number(d.col)] = v; t.revised = RR.today(); RR.saveDef('coefficients', o); RR.result = null; st.reportKey = ''; RR.toast('係数を変更しました。図とレポートに反映されます'); }
    else if (d.coefmeta) { const o = RR.raw.coefficients; o.tables.find((x) => x.id === d.coefmeta)[d.k] = el.value; RR.saveDef('coefficients', o); st.reportKey = ''; }
    else if (d.lname !== undefined || d.lshort !== undefined) { const o = RR.raw.coefficients; if (d.lname !== undefined) o.levelNames[Number(d.lname)] = el.value; else o.levelShort[Number(d.lshort)] = el.value; RR.saveDef('coefficients', o); RR.result = null; st.reportKey = ''; RR.toast('水準の呼び名を変更しました'); }
  }
  function onInput(e) { const el = e.target; if (el.dataset.quick && el.tagName !== 'SELECT') onQuickInput(el); else if (el.id === 'aiout') { RR.case.ai[st.promptKey] = el.value; st.reportKey = ''; saveSoon(); } }
  const saveSoon = debounce(() => RR.saveCase(), 500);
  function shrink(file) { return new Promise((res) => { const img = new Image(); const url = URL.createObjectURL(file); img.onload = () => { const k = Math.min(1, 900 / Math.max(img.width, img.height)); const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url); res(c.toDataURL('image/jpeg', 0.78)); }; img.src = url; }); }

  RR.start = function () {
    RR.loadDefs(); const th = RR.LS.get('rr.theme'); if (th) document.documentElement.dataset.theme = th;
    const saved = RR.LS.get('rr.case'); RR.case = RR.emptyCase(); if (saved && saved.items && saved.rows) RR.setCase(saved, { save: false }); else RR.setCase(RR.buildSample());
    $('#nav').innerHTML = VIEWS.map(([v, l]) => `<a href="#${v}" data-v="${v}">${l}</a>`).join('');
    document.addEventListener('click', onClick); document.addEventListener('change', onChange); document.addEventListener('input', onInput);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDrawer(); if ((e.key === 'Enter' || e.key === ' ') && e.target.dataset && e.target.dataset.key && e.target.tagName !== 'BUTTON') { e.preventDefault(); openRisk(e.target.dataset.key); } });
    document.addEventListener('toggle', (e) => { const d = e.target; if (d.classList && d.classList.contains('def') && d.open) { const ta = d.querySelector('textarea'); if (!ta.value) ta.value = prettyDef(ta.dataset.def); } }, true);
    $('#scrim').addEventListener('click', closeDrawer);
    const dz = document.body; ['dragover', 'drop'].forEach((ev) => dz.addEventListener(ev, (e) => { if (!e.dataTransfer || !Array.from(e.dataTransfer.types || []).includes('Files')) return; e.preventDefault(); if (ev === 'drop') { const f = e.dataTransfer.files[0]; if (f && /\.xlsx$/i.test(f.name)) { if (st.view !== 'data') { go('data'); setTimeout(() => importXlsx(f), 60); } else importXlsx(f); } else RR.toast('.xlsx のファイルを置いてください'); } }));
    window.addEventListener('hashchange', route);
    window.addEventListener('resize', debounce(() => { if (st.view === 'home') drawFigs(false); else if (st.view === 'quick') renderQuickLive(false); else if (st.view === 'report') fitPages(); }, 200));
    window.addEventListener('beforeprint', () => { const p = $('#pages'); if (p) p.style.zoom = 1; }); window.addEventListener('afterprint', fitPages);
    route();
  };
})();
