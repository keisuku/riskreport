/* report: 章定義にもとづいて紙面の部品を作り、A4のページに流し込む */
(function () {
  const RP = (RR.report = {});
  const E = RR.esc, M = (x) => RR.money(x);
  const FW = 680; /* 図の幅（px）。本文幅180mmに相当 */
  const unc = (t) => `<span class="unc">${t || '未確認'}</span>`;
  const p = (t, cls) => `<p class="${cls || ''}">${t}</p>`;
  const h3 = (t) => `<h3 class="kn">${E(t)}</h3>`;
  const h4 = (t) => `<h4 class="kn">${E(t)}</h4>`;
  const note = (t) => `<p class="rnote">${t}</p>`;
  const fig = (title, out, cap) => (out && out.svg ? `<figure class="fig"><figcaption>${E(title)}</figcaption>${out.svg}${out.legend || ''}${cap ? `<p class="figcap">${cap}</p>` : ''}</figure>` : '');
  function tbl(cols, rows, o) {
    o = o || {}; if (!rows.length) return p(o.empty || '該当するデータがありません。', 'rnote');
    const cg = cols.map((c) => `<col style="${c.w ? 'width:' + c.w : ''}">`).join('');
    return `<table class="rt split ${o.cls || ''}">${o.cap ? `<caption>${E(o.cap)}</caption>` : ''}<colgroup>${cg}</colgroup><thead><tr>${cols.map((c) => `<th class="${c.cls || ''}">${E(c.h)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr${r._cls ? ` class="${r._cls}"` : ''}>${r.map((v, i) => `<td class="${cols[i].cls || ''}">${v === undefined || v === null ? '' : v}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  }
  /* 値と確認状況 */
  function ans(q, rec) {
    const pv = RR.provOf(q, rec); const v = RR.layers[q.layer].kind === 'items' ? RR.val(q.id) : rec ? rec.f[q.id] : '';
    if (pv.empty) return unc('未記入');
    return E(RR.fmtVal(q, v)) + (pv.method === '未確認' ? ' ' + unc() : '');
  }
  const provText = (pv) => (pv.empty ? '—' : `${E(pv.method)}${pv.src ? '：' + E(pv.src) : ''}${pv.date ? '（' + E(pv.date) + '）' : ''}`);
  const prepDot = (n) => (n ? `<span class="pl pl${n}">${n}</span>` : unc('未回答'));
  const grade = (g) => `<span class="gr" style="background:var(--m${g})${g >= 4 ? ';color:#fff' : ''}">${g}</span>`;
  const lab = (it) => E(it.label.replace('｜', '・'));
  const itemsTable = (layer, o) => tbl([{ h: '項目', w: '30%' }, { h: '回答', w: '22%' }, { h: '評価への反映', w: '26%' }, { h: '確認方法と出典' }], RR.qsOf(layer).filter((q) => !(o && o.skip && o.skip.includes(q.id))).map((q) => [E(RR.t(q.label)), ans(q), E(RR.fxDescribe(q)), provText(RR.provOf(q))]), { cls: 'small', cap: (o && o.cap) || RR.t(RR.layers[layer].label) + 'の回答' });
  /* 記録を列に並べる表（項目が行） */
  function transposed(layer, recs, o) {
    o = o || {}; const qs = RR.qsOf(layer).filter((q) => q.type !== 'image' && q.type !== 'id' && !(o.skip || []).includes(q.id) && (!o.only || o.only(q))); const L = RR.layers[layer]; const out = []; const per = o.per || 4;
    for (let i = 0; i < recs.length; i += per) {
      const part = recs.slice(i, i + per);
      const rows = []; let lastGroup = null;
      for (const q of qs) { if (o.group) { const g = o.group(q); if (g !== lastGroup) { const r = [`<b>${E(g)}</b>`].concat(part.map(() => '')); r._cls = 'grp'; rows.push(r); lastGroup = g; } } rows.push([E(RR.t(q.label)) + (RR.unitOf(q) && q.type !== 'money' && q.type !== 'pct' && q.type !== 'num' ? '' : '')].concat(part.map((r) => ans(q, r)))); }
      if (o.prov !== false) { const pgs = [{ id: 'row', label: '' }].concat(L.pgs || []); for (const pg of pgs) rows.push([E((pg.label ? pg.label + 'の' : '') + '確認方法と出典')].concat(part.map((r) => { const x = (r.prov || {})[pg.id] || {}; return x.method === '未確認' || !x.method ? unc() : provText({ empty: false, method: x.method, src: x.src, date: x.date }); }))); }
      out.push(tbl([{ h: '項目', w: per > 3 ? '24%' : '30%' }].concat(part.map((r) => ({ h: `${r.id} ${r.f[L.nameField] && L.nameField !== L.idField ? r.f[L.nameField] : ''}` }))), rows, { cls: 'small', cap: (o.cap || RR.t(L.label)) + (recs.length > per ? `（${i + 1}〜${Math.min(i + per, recs.length)}／${recs.length}件）` : '') }));
    }
    return out;
  }
  const riskRow = (it, L) => [it.rank, lab(it), E(RR.domainById[it.domain].label), M(it.loss[0]), M(it.loss[1]), M(it.loss[2]), `<b>${M(it.uninsured[L])}</b>`, grade(it.grade(L)), it.freqGrade, prepDot(it.prep.alt), it.gap ? '▲' : ''];
  const riskCols = () => [{ h: '順位', cls: 'num', w: '5%' }, { h: 'リスク' }, { h: '領域', w: '9%' }, { h: RR.levelShort[0], cls: 'num', w: '9%' }, { h: RR.levelShort[1], cls: 'num', w: '9.5%' }, { h: RR.levelShort[2], cls: 'num', w: '9%' }, { h: '賄えない額', cls: 'num', w: '10%' }, { h: '等級', cls: 'ctr', w: '5%' }, { h: '頻度', cls: 'ctr', w: '5%' }, { h: '代替', cls: 'ctr', w: '5.5%' }, { h: '空白', cls: 'ctr', w: '5%' }];
  function basisBlock(it, L) {
    return `<div class="basis"><div class="basis-h"><b>${lab(it)}</b><span>${RR.levelShort.map((n, i) => `${E(n)} <b class="num">${M(it.loss[i])}</b>`).join('　')}</span></div>
<ul>${it.basis[L].map((b) => `<li>${E(b)}</li>`).join('')}${it.sevNotes.map((b) => `<li>${E(b)}</li>`).join('')}</ul>
<div class="basis-s">頻度 ${it.freqB}（等級${it.freqGrade}）：${E(it.freqBasis.join('／'))}</div>
<div class="basis-s">保険：${it.ins[L].lines.length ? E(it.ins[L].lines.join('／')) : '紐づく証券なし'} → 賄えない額 <b>${M(it.uninsured[L])}</b>${it.unconfirmed.length ? `　${unc('未確認の入力 ' + it.unconfirmed.length + '件')} ${E(it.unconfirmed.slice(0, 6).join('、'))}` : ''}</div></div>`;
  }
  RP.basisBlock = basisBlock;

  /* ---------- 規則で書く本文（AIの文章がないときに使う） ---------- */
  function autoText(ch, ctx) {
    const R = RR.compute(), L = R.level; const H = RR.headlineText(); const out = [];
    const top = R.items.slice(0, 3);
    if (ch.id === 'c1') {
      out.push(`${E(RR.companyName(false))}について、${R.items.length}件のリスクを金額で評価しました。${E(H.main)}`);
      out.push(`上位は、${top.map((t) => `「${lab(t)}」（${E(RR.levelShort[L])}の損害 ${M(t.loss[L])}、保険で賄えない額 ${M(t.uninsured[L])}）`).join('、')}です。`);
      out.push(E(H.sub) + (RR.rows('proposal').length ? `改善提案は${RR.rows('proposal').length}件を台帳に載せています。` : ''));
    } else if (ch.id === 'c2') {
      const c = R.conf; out.push(`対象は国内${RR.rows('site').length}拠点${RR.rows('overseas').length ? `と海外${RR.rows('overseas').length}拠点` : ''}です。回答${c.現地 + c.資料 + c.聞き取り + c.未確認}件の確認方法は、現地 ${c.現地}件、資料 ${c.資料}件、聞き取り ${c.聞き取り}件、未確認 ${c.未確認}件で、ほかに未記入が${c.未記入}件あります。`);
      out.push('損害額は、係数表と算式による試算です。係数の初期値は仮置きで、統計や約款にもとづく値ではありません。現地で確認していない項目は「未確認」と表示しています。');
    } else if (ch.id === 'c3') {
      const ss = Object.values(R.siteMap).sort((a, b) => b.V - a.V); if (ss.length) out.push(`国内拠点の資産額の合計は${M(R.totalAssets)}です。最も大きいのは${E(ss[0].name)}（${M(ss[0].V)}）で、全体の${RR.n0((ss[0].V / R.totalAssets) * 100)}%を占めます。`);
      if (RR.val('co_business')) out.push(`事業構成：${E(RR.val('co_business'))}`);
    } else if (ch.id === 'c4') {
      out.push('この章の本文は、「AIプロンプト」画面の「業界と地域のリスク環境」で出典付きの文章を作り、担当者が出典を確かめたうえで貼り付けます。出典を確認できない統計や事故例は載せません。以下には、ご回答から分かる地域の災害環境と、過去の事故歴だけを示します。');
    } else if (ch.id === 'c5') {
      out.push(`評価した${R.items.length}件のうち、保険で賄えない額が自己負担できる額（${M(R.retention)}）を超えるものは${H.over}件です。`);
      const acc = R.items.filter((i) => i.scope === 'accumulation'); if (acc.length) out.push(`1つの災害で複数の拠点が同時に被災する集積が${acc.length}件あります。最大は「${lab(acc[0])}」で、${E(RR.levelShort[L])}の損害は${M(acc[0].loss[L])}です。`);
      out.push(`損害が大きいのに代替手段がない「備えの空白」は、リスクの種類で数えて${R.gapsHead.length}種類、拠点別に数えて${R.gaps.length}件です。`);
    } else if (ch.id === 'c7') {
      const bi = R.items.filter((i) => i.id === 'bi').sort((a, b) => b.loss[L] - a.loss[L]); if (bi.length) out.push(`拠点が止まった場合の損害は、${lab(bi[0])}が最大で${M(bi[0].loss[L])}（${E(RR.levelShort[L])}）です。代替手段を考慮しない場合は${M(bi[0].lossA[L])}になります。`);
      const na = RR.rows('line').filter((l) => !(Number(l.f.line_alt_ratio) > 0)); if (na.length) out.push(`代替手段のない工程が${na.length}件あります（${na.slice(0, 4).map((l) => E(RR.siteName(l.f.line_site) + '・' + l.f.line_name)).join('、')}${na.length > 4 ? ' ほか' : ''}）。`);
    } else if (ch.id === 'c13') {
      const ps = RR.rows('prep'); const avg = (k) => { const v = ps.map((r) => RR.lvl(r.f[k])).filter(Boolean); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0; };
      if (ps.length) out.push(`備えの4層の平均は、予防 ${RR.n1(avg('prep_prevent'))}、代替手段 ${RR.n1(avg('prep_alt'))}、復旧手順 ${RR.n1(avg('prep_recover'))}、保険 ${RR.n1(avg('prep_insure'))}です（4段階）。`);
      out.push(`損害が自己負担できる額を超え、代替手段が「考えたことがない」「検討はした」にとどまるリスクを、備えの空白として挙げています。`);
    } else if (ch.id === 'c14') {
      const un = R.headline.filter((i) => i.uninsured[L] > 0).sort((a, b) => b.uninsured[L] - a.uninsured[L]).slice(0, 3);
      out.push(`証券は${RR.rows('policy').length}件です。想定損害に対して保険で賄えない額が大きいのは、${un.map((i) => `「${lab(i)}」${M(i.uninsured[L])}`).join('、')}です。`);
      const none = R.headline.filter((i) => !i.policies.length && i.loss[L] > 0); if (none.length) out.push(`紐づく証券がないリスクが${none.length}件あります（${none.slice(0, 5).map(lab).join('、')}${none.length > 5 ? ' ほか' : ''}）。`);
      out.push('ここでの「賄える見込み」は、支払限度額と免責金額だけを当てはめた試算です。補償の可否は約款と保険会社の判断によります。');
    } else if (ch.id === 'c15') {
      const ps = RR.rows('proposal'); const a = ps.filter((x) => x.f.pr_priority === 'A' && !['完了', '見送り'].includes(x.f.pr_status));
      out.push(`改善提案は${ps.length}件で、うち優先度Aで未完了のものが${a.length}件です。`);
      const t = R.items[0]; if (t && t.hasPlan) out.push(`提案を実行した場合、「${lab(t)}」の保険で賄えない額は${M(t.uninsured[L])}から${M(t.uninsuredC[L])}になる見込みです（提案に記入した効果の見込みによる試算）。`);
    } else {
      const dom = { c8: 'cyber', c9: 'liab', c10: 'people', c11: 'fin', c12: 'ovs' }[ch.id]; const its = R.items.filter((i) => i.domain === dom);
      if (its.length) out.push(`この領域では${its.length}件を評価しました。最大は「${lab(its[0])}」で、${E(RR.levelShort[L])}の損害は${M(its[0].loss[L])}、保険で賄えない額は${M(its[0].uninsured[L])}です。`);
      const u = [...new Set(its.flatMap((i) => i.unconfirmed))]; if (u.length) out.push(`未確認・未記入の入力が${u.length}項目あります（${u.slice(0, 5).map(E).join('、')}${u.length > 5 ? ' ほか' : ''}）。`);
    }
    return out;
  }
  function siteAuto(sm) {
    const R = RR.compute(), L = R.level; const f = sm.ctx.f, h = sm.ctx.hz; const out = [];
    out.push(`${E(sm.name)}（${E(f.site_addr || '所在地未記入')}）は、資産額${M(sm.V)}、売上への寄与${f.site_rev_share === undefined ? '未記入' : f.site_rev_share + '%'}の${E(f.site_use || '拠点')}です。`);
    if (h.hz_river) out.push(`${E(h.hz_system || '')}${E(h.hz_river)}から${h.hz_dist === undefined ? '（距離未記入）' : h.hz_dist + 'km'}に位置し、想定浸水深は想定最大規模で${h.hz_depth_max === undefined ? '未記入' : h.hz_depth_max + 'm'}、計画規模で${h.hz_depth_plan === undefined ? '未記入' : h.hz_depth_plan + 'm'}です。`);
    const ps = Object.values(sm.perils).sort((a, b) => b.loss[L] - a.loss[L]); if (ps.length) out.push(`損害見積が最も大きいのは「${E(ps[0].name)}」で、${E(RR.levelShort[L])}が${M(ps[0].loss[L])}、最悪の場合が${M(ps[0].loss[2])}です。`);
    const fd = RR.rowsOfSite('finding', sm.id).filter((x) => x.f.fd_grade === '要是正'); if (fd.length) out.push(`現地で是正が必要と判断した事項：${fd.map((x) => E(x.f.fd_title)).join('、')}。`);
    return out;
  }
  const aiOrAuto = (key, auto) => { const t = (RR.case.ai[key] || '').trim(); return t ? t.split(/\n{1,}/).filter((s) => s.trim()).map((s) => p(E(s.trim()))) : auto.map((s) => p(s)); };

  /* ---------- 紙面の部品 ---------- */
  const B = {};
  B.cover = (ch, ctx) => {
    const sites = RR.rows('site').length;
    return [`<div class="cover"><div class="cv-top"><span>リスクエンジニアリング・レポート</span><span>${ctx.quick ? '簡易版' : '網羅版'}</span></div>
<div class="cv-main"><div class="cv-kicker">事業を止めないための</div><h1>リスク診断<br>報告書</h1><div class="cv-co">${E(RR.companyName(false))} 御中</div></div>
<table class="cv-meta"><tr><th>調査期間</th><td>${E(RR.val('co_survey_from') || '—')} 〜 ${E(RR.val('co_survey_to') || '—')}</td></tr><tr><th>対象</th><td>国内 ${sites}拠点${RR.rows('overseas').length ? '、海外 ' + RR.rows('overseas').length + '拠点' : ''}／${E(RR.val('co_industry') || '業種未記入')}</td></tr><tr><th>版</th><td>${ctx.quick ? '簡易版' : '網羅版'}　第1版（${E(RR.today())}）</td></tr><tr><th>作成</th><td>${E(RR.val('co_surveyor') || '—')}</td></tr></table>
<div class="cv-foot">${RR.case.meta.isSample ? 'この報告書はサンプルです。会社名・数値・出典はすべて架空のものです。' : ''}損害額は係数表と算式による試算であり、係数の初期値は仮置きです。</div></div>`];
  };
  B.toc = () => [`<div class="toc-h">目次</div><table class="toc split"><tbody id="toc-body"></tbody></table>`];
  B.ai = (ch) => aiOrAuto(ch.id, autoText(ch, {}));
  B.summary_headline = () => {
    const R = RR.compute(), L = R.level, H = RR.headlineText(); const t = H.top; if (!t) return [];
    const kp = (label, v, sub) => `<div class="kpi"><div class="k-l">${E(label)}</div><div class="k-v">${RR.moneyParts(v).map((x, i) => (i ? `<small>${E(x)}</small>` : E(x))).join('')}</div><div class="k-s">${sub}</div></div>`;
    return [`<div class="hl"><div class="hl-main">${E(H.main)}</div><div class="kpis">${kp('最大の損害（' + RR.levelShort[L] + '）', t.loss[L], lab(t))}${kp('うち保険で賄えない額', t.uninsured[L], H.ratio !== null ? '純資産の' + RR.n0(H.ratio) + '%' : '')}${kp('自己負担できる額', R.retention, '超えるリスク ' + H.over + '件')}${kp('純資産', R.net, '備えの空白 ' + R.gapsHead.length + '種類')}</div></div>`];
  };
  B.fig_riskmap = (ch, ctx) => [fig('図1　総合リスクマップ（影響の大きさ × 頻度）', RR.charts.riskMap({ w: FW, state: 'B', from: 'A', max: ctx.quick ? 16 : 24 }), '拠点ごとに評価するリスクは、種類ごとに最大の拠点を代表として載せています。白抜きの円は対策前の位置、矢印の先が保険と備えを考慮した後の位置です。')];
  B.fig_riskmap_after = (ch, ctx) => [fig('図　提案を実行した後のリスクマップ', RR.charts.riskMap({ w: FW, state: 'C', from: 'B', max: ctx.quick ? 16 : 24 }), '白抜きの円は現状（保険と備えを考慮した後）、矢印の先が提案を実行した後の位置です。効果は提案の台帳に記入した見込みによります。')];
  B.summary_top = (ch, ctx) => { const R = RR.compute(), L = R.level; return [h3('上位のリスク'), tbl(riskCols(), R.items.slice(0, ctx.quick ? 8 : 10).map((i) => riskRow(i, L)), { cls: 'small' }), note(`金額の3列は損害額の3水準（${RR.levelNames.map(E).join('／')}）。賄えない額と等級は「${E(RR.levelShort[L])}」の水準。等級は純資産に対する比率の5段階、頻度は5段階、代替は代替手段の段階（1〜4）。▲は備えの空白。`)]; };
  B.summary_actions = () => { const ps = RR.rows('proposal').filter((x) => x.f.pr_priority === 'A' && !['完了', '見送り'].includes(x.f.pr_status)); return ps.length ? [h3('最初に着手する提案'), tbl([{ h: '提案' }, { h: '対象', w: '20%' }, { h: '費用感', w: '17%' }, { h: '期限', w: '12%' }], ps.slice(0, 6).map((x) => [E(x.f.pr_title), E(x.f.pr_site ? RR.siteName(x.f.pr_site) : '全社'), E(x.f.pr_cost || '—'), E(x.f.pr_due || '—')]), { cls: 'small' })] : []; };
  B.scope_table = () => { const R = RR.compute(); return [h3('対象拠点と確認の方法'), tbl([{ h: 'ID', w: '7%' }, { h: '拠点' }, { h: '所在地' }, { h: '建物の確認', w: '14%' }, { h: '自然災害の確認', w: '16%' }, { h: '所見', w: '8%', cls: 'num' }], RR.rows('site').map((s) => { const b = RR.rowsOfSite('building', s.id); const m = [...new Set(b.map((x) => (x.prov.row || {}).method || '未確認'))]; const hz = RR.rows('hazard').find((x) => x.f.hz_site === s.id); const hm = hz ? (hz.prov.flood || hz.prov.row || {}).method || '未確認' : '記入なし'; return [E(s.id), E(s.f.site_name), E(s.f.site_addr || ''), m.length ? m.map((x) => (x === '未確認' ? unc() : E(x))).join('・') : unc('記入なし'), hm === '未確認' || hm === '記入なし' ? unc(hm) : E(hm), RR.rowsOfSite('finding', s.id).length]; }), { cls: 'small' })]; };
  B.method_scale = () => { const il = RR.impactLabels(), fl = RR.freqLabels(); return [h3('評価の物差し'), tbl([{ h: '等級', w: '8%', cls: 'ctr' }, { h: '影響の大きさ（損害額の純資産に対する比率）' }, { h: '頻度' }], [5, 4, 3, 2, 1].map((g) => [grade(g), E(il[g - 1]), E(fl[g - 1])]), { cls: 'small' }), tbl([{ h: '損害見積の水準', w: '34%' }, { h: '考え方' }], [[E(RR.levelNames[0]), '防火・防災の設備や備えが想定どおり働いた場合。'], [E(RR.levelNames[1]), 'スプリンクラーや止水板などが働かなかった場合。総合評価の順位はこの水準で付けています。'], [E(RR.levelNames[2]), '設備も備えも働かず、条件も悪い場合。備えと損害のマップはこの水準です。']].map((r, i) => (i === RR.compute().level ? r : r)), { cls: 'small' }), tbl([{ h: '備えの段階', w: '34%' }, { h: '4つの層' }], RR.prepLevels.map((l, i) => [E(l), i === 0 ? '予防（起こさない）／代替手段（止まったときの代わり）／復旧手順（元に戻す）／保険（資金の備え）の4層それぞれを、この4段階で確かめます。' : '']), { cls: 'small' })]; };
  B.method_confirm = () => { const c = RR.compute().conf; return [h3('確認方法の内訳'), tbl([{ h: '確認方法' }, { h: '件数', cls: 'num', w: '14%' }, { h: '意味' }], [['現地', c.現地, '担当者が現地で見て確認した'], ['資料', c.資料, '証券、台帳、ハザードマップなどの資料で確認した'], ['聞き取り', c.聞き取り, '顧客の担当者から聞いた'], [unc(), c.未確認, '回答はあるが、根拠を確認していない'], [unc('未記入'), c.未記入, '回答がない']], { cls: 'small' })]; };
  B.method_limits = () => [h3('この調査の限界'), `<ul class="rl">${RR.chapters.closing.map((c) => `<li>${E(c)}</li>`).join('')}<li>${E(RR.raw.coefficients.notice)}</li></ul>`];
  B.company_table = () => [itemsTable('company', { cap: '会社の概要' })];
  B.fig_sitemap = () => { const o = RR.charts.siteMap({ w: FW, peril: 'max' }); return o.empty ? [note('拠点の緯度・経度が未記入のため、拠点の略図は省略しています。')] : [fig('図　拠点の配置（各拠点で最も損害の大きい災害）', o)]; };
  B.site_table = () => { const R = RR.compute(); return [h3('拠点の一覧'), tbl([{ h: 'ID', w: '6%' }, { h: '拠点' }, { h: '用途', w: '11%' }, { h: '建物', cls: 'num', w: '11%' }, { h: '設備', cls: 'num', w: '11%' }, { h: '在庫', cls: 'num', w: '11%' }, { h: '合計', cls: 'num', w: '11%' }, { h: '売上寄与', cls: 'num', w: '9%' }], RR.rows('site').map((s) => [E(s.id), E(s.f.site_name), E(s.f.site_use || ''), M(s.f.site_val_bld), M(s.f.site_val_eq), M(s.f.site_val_stock), `<b>${M(R.siteMap[s.id].V)}</b>`, s.f.site_rev_share === undefined ? unc('未記入') : s.f.site_rev_share + '%']), { cls: 'small' })]; };
  B.flow_table = () => { const pt = RR.rows('partner'); return pt.length ? [h3('モノの流れ（仕入先 → 工程 → 顧客）'), tbl([{ h: '区分', w: '10%' }, { h: '名称' }, { h: '品目' }, { h: '依存度', cls: 'num', w: '10%' }, { h: '所在地', w: '14%' }], pt.map((x) => [E(x.f.pt_type), E(x.f.pt_name), E(x.f.pt_item || ''), x.f.pt_dep === undefined ? unc('未記入') : x.f.pt_dep + '%', E(x.f.pt_loc || '')]), { cls: 'small' })] : []; };
  B.env_note = () => [];
  B.env_hazard_table = () => [h3('拠点所在地の災害環境'), tbl([{ h: '拠点' }, { h: '河川（水系）' }, { h: '距離', cls: 'num', w: '8%' }, { h: '浸水深 最大／計画', cls: 'num', w: '15%' }, { h: '想定する地震' }, { h: '想定震度', w: '9%' }, { h: '30年確率', cls: 'num', w: '9%' }], RR.rows('site').map((s) => { const hz = RR.rows('hazard').find((x) => x.f.hz_site === s.id); if (!hz) return [E(s.f.site_name), unc('記入なし'), '', '', '', '', '']; const f = hz.f; const pf = (hz.prov.flood || hz.prov.row || {}).method, pq = (hz.prov.quake || hz.prov.row || {}).method; const d = (v, u) => (v === undefined ? unc('未記入') : v + u); return [E(s.f.site_name), `${E(f.hz_river || '')}${f.hz_system ? '（' + E(f.hz_system) + '）' : ''}${pf === '未確認' ? ' ' + unc() : ''}`, d(f.hz_dist, 'km'), `${d(f.hz_depth_max, 'm')}／${d(f.hz_depth_plan, 'm')}`, E(f.hz_quake_src || '') + (pq === '未確認' ? ' ' + unc() : ''), E(f.hz_shindo || ''), d(f.hz_quake_p, '%')]; }), { cls: 'small' })];
  B.incident_table = () => [h3('過去の事故歴'), tbl([{ h: '時期', w: '11%' }, { h: '拠点', w: '15%' }, { h: '種類', w: '9%' }, { h: '内容' }, { h: '損害額', cls: 'num', w: '10%' }, { h: '再発防止策', w: '22%' }], RR.rows('incident').map((x) => [E(x.f.inc_date), E(x.f.inc_site ? RR.siteName(x.f.inc_site) : '全社'), E(x.f.inc_type), E(x.f.inc_desc), M(x.f.inc_loss), E(x.f.inc_measure || '')]), { cls: 'small', empty: '事故歴の記入はありません。' })];
  B.fig_prepmap = (ch, ctx) => [fig('図2　備えと損害のマップ（最悪の場合の損害 × 代替手段の段階）', RR.charts.prepMap({ w: FW, max: ctx.quick ? 16 : 24 }), '左上の斜線の領域が「損害が大きく、代替手段がない」リスクです。')];
  B.gap_table = (ch, ctx) => { const R = RR.compute(); const g = (ctx.quick ? R.gapsHead : R.gaps).slice().sort((a, b) => b.loss[2] - a.loss[2]); return [h3(`備えの空白（${g.length}件）`), tbl([{ h: 'リスク' }, { h: '最悪の場合の損害', cls: 'num', w: '15%' }, { h: '予防', cls: 'ctr', w: '7%' }, { h: '代替', cls: 'ctr', w: '7%' }, { h: '復旧', cls: 'ctr', w: '7%' }, { h: '保険', cls: 'ctr', w: '7%' }, { h: '現状の内容', w: '28%' }], g.slice(0, ctx.quick ? 10 : 999).map((i) => [lab(i), M(i.loss[2]), prepDot(i.prep.prevent), prepDot(i.prep.alt), prepDot(i.prep.recover), prepDot(i.prep.insure), E(i.prep.memo || '')]), { cls: 'small', empty: '備えの空白に該当するリスクはありません。' })]; };
  B.fig_heatmap = () => (RR.rows('site').length ? [fig('図3　拠点 × 災害の一覧図', RR.charts.heatmap({ w: FW }))] : []);
  B.accum_table = () => { const R = RR.compute(), L = R.level; const a = R.items.filter((i) => i.scope === 'accumulation'); return a.length ? [h3('拠点をまたぐ集積'), tbl([{ h: '集積' }, { h: '対象拠点' }, { h: RR.levelShort[L], cls: 'num', w: '12%' }, { h: RR.levelShort[2], cls: 'num', w: '12%' }, { h: '賄えない額', cls: 'num', w: '12%' }], a.map((i) => [lab(i), E(i.members.map(RR.siteName).join('、')), M(i.loss[L]), M(i.loss[2]), `<b>${M(i.uninsured[L])}</b>`]), { cls: 'small' }), note('集積は、同じ水系または同じ想定地震を記入した拠点が同時に被災するものとして、各拠点の災害の損害と事業中断を合算しています。支払限度額は1回だけ当てはめています。')] : []; };
  B.register_table = (ch, ctx) => { const R = RR.compute(), L = R.level; return [h3(`リスク登録簿（${ctx.quick ? '上位12件' : '全' + R.items.length + '件'}）`), tbl(riskCols(), R.items.slice(0, ctx.quick ? 12 : 999).map((i) => riskRow(i, L)), { cls: 'small' })]; };
  B.bi_line_table = () => { const mg = RR.num('co_margin') / 100; return [h3('工程・ライン別の影響'), tbl([{ h: '拠点', w: '15%' }, { h: RR.t('工程・ライン') }, { h: '止まる売上', cls: 'num', w: '11%' }, { h: '復旧期間', cls: 'num', w: '9%' }, { h: '代替手段', w: '12%' }, { h: '代替割合', cls: 'num', w: '9%' }, { h: '失う利益', cls: 'num', w: '11%' }], RR.rows('line').map((l) => { const f = l.f; const x = (Number(f.line_revenue) || 0) * ((Number(f.line_recovery) || 0) / 12) * (1 - (Number(f.line_alt_ratio) || 0) / 100) * mg; return [E(RR.siteName(f.line_site)), E(f.line_name), M(f.line_revenue), f.line_recovery === undefined ? unc('未記入') : f.line_recovery + 'か月', E(f.line_alt || '') || unc('未記入'), f.line_alt_ratio === undefined ? unc('未記入') : f.line_alt_ratio + '%', `<b>${M(x)}</b>`]; }), { cls: 'small', empty: '工程・ラインの記入はありません。' }), note(`失う利益 ＝ 止まる売上 × 復旧期間÷12 ×（1−代替割合）× 限界利益率 ${RR.n0(mg * 100)}%。復旧期間は記入値のまま（${E(RR.levelShort[1])}の水準）です。`)]; };
  B.fig_bi_bars = () => { const mg = RR.num('co_margin') / 100; const rows = RR.rows('line').map((l) => ({ name: RR.siteName(l.f.line_site) + '・' + l.f.line_name, v: (Number(l.f.line_revenue) || 0) * ((Number(l.f.line_recovery) || 0) / 12) * (1 - (Number(l.f.line_alt_ratio) || 0) / 100) * mg })).sort((a, b) => b.v - a.v).slice(0, 14); return rows.length ? [fig('図　止まったときに失う利益（工程・ライン別）', RR.charts.bars(rows, { w: FW, label: '工程別の損害' }))] : []; };
  B.bottleneck_table = () => { const r = RR.rows('line').filter((l) => l.f.line_bottleneck); return r.length ? [h3('代えのきかない設備'), tbl([{ h: '拠点', w: '18%' }, { h: RR.t('工程・ライン'), w: '20%' }, { h: '設備' }, { h: '製品在庫', cls: 'num', w: '11%' }], r.map((l) => [E(RR.siteName(l.f.line_site)), E(l.f.line_name), E(l.f.line_bottleneck), l.f.line_stockdays === undefined ? '—' : l.f.line_stockdays + '日分']), { cls: 'small' })] : []; };
  B.partner_table = () => { const s = RR.rows('partner').filter((x) => x.f.pt_type === '仕入先'); return s.length ? [h3('仕入先への依存'), tbl([{ h: '仕入先' }, { h: '品目' }, { h: '依存度', cls: 'num', w: '10%' }, { h: '代替の可否', w: '12%' }, { h: '想定する停止', cls: 'num', w: '13%' }, { h: '確認方法', w: '12%' }], s.map((x) => [E(x.f.pt_name), E(x.f.pt_item || ''), x.f.pt_dep + '%', E(x.f.pt_alt || '') || unc('未記入'), x.f.pt_stop === undefined ? unc('未記入') : x.f.pt_stop + 'か月', (x.prov.row || {}).method === '未確認' ? unc() : E((x.prov.row || {}).method || '')]), { cls: 'small' })] : []; };
  B.items = (ch, ctx, arg) => [itemsTable(arg, arg === 'company' ? { skip: RR.qsOf('company').filter((q) => !q.fx && !(q.risks || []).length).map((q) => q.id), cap: '事業継続に関わる回答' } : null)];
  B.risk_cards = (ch, ctx, arg) => { const R = RR.compute(), L = R.level; const its = R.items.filter((i) => i.domain === arg); if (!its.length) return [note('この領域で損害を試算できるリスクはありません（入力が不足しているか、該当なし）。')]; return [h3('損害見積と算出根拠')].concat(its.map((i) => basisBlock(i, L))); };
  B.system_table = () => transposed('system', RR.rows('system'), { per: 5, cap: 'システムの一覧' });
  B.product_table = () => transposed('product', RR.rows('product'), { per: 5, cap: '製品群' });
  B.overseas_table = () => transposed('overseas', RR.rows('overseas'), { per: 4, cap: '海外拠点' });
  B.prep_legend = () => [`<div class="prep-lg">${RR.prepLevels.map((l, i) => `<span>${prepDot(i + 1)} ${E(l.replace(/^\d\s*/, ''))}</span>`).join('')}</div>`];
  B.prep_matrix = (ch, ctx) => { const R = RR.compute(); const rows = RR.rows('prep'); return [tbl([{ h: 'リスク' }, { h: '拠点', w: '14%' }, { h: '予防', cls: 'ctr', w: '7%' }, { h: '代替手段', cls: 'ctr', w: '9%' }, { h: '復旧手順', cls: 'ctr', w: '9%' }, { h: '保険', cls: 'ctr', w: '7%' }, { h: '具体的な内容', w: '30%' }], rows.map((r) => [E(r.f.prep_risk), E(r.f.prep_site ? RR.siteName(r.f.prep_site) : '全社'), prepDot(RR.lvl(r.f.prep_prevent)), prepDot(RR.lvl(r.f.prep_alt)), prepDot(RR.lvl(r.f.prep_recover)), prepDot(RR.lvl(r.f.prep_insure)), E(r.f.prep_memo || '') + ((r.prov.row || {}).method === '未確認' ? ' ' + unc() : '')]), { cls: 'small', cap: '備えの棚卸し', empty: '備えの棚卸しは未回答です。未回答のリスクは、段階1として扱っています。' })]; };
  B.policy_table = () => [h3('証券の一覧'), tbl([{ h: 'ID', w: '6%' }, { h: '種目' }, { h: '保険会社', w: '16%' }, { h: '支払限度額', cls: 'num', w: '12%' }, { h: '免責金額', cls: 'num', w: '10%' }, { h: '水災', w: '13%' }, { h: '対象拠点', w: '10%' }, { h: '満期', w: '11%' }], RR.rows('policy').map((x) => [E(x.id), E(x.f.pol_type), E(x.f.pol_insurer || ''), M(x.f.pol_limit), M(x.f.pol_ded || 0), x.f.pol_flood === 'あり' ? 'あり' + (x.f.pol_flood_limit !== undefined ? '（' + M(x.f.pol_flood_limit) + '）' : '') : E(x.f.pol_flood || '') || unc('未記入'), E(x.f.pol_sites || ''), E(x.f.pol_expiry || '')]), { cls: 'small', empty: '保険証券の記入はありません。すべてのリスクを保険なしとして試算しています。' })];
  B.fig_insbars = (ch, ctx) => [fig('図4　損害と保険の対比図', RR.charts.insBars({ w: FW, max: ctx.quick ? 12 : 20 }))];
  B.coverage_table = () => { const R = RR.compute(), L = R.level; return [h3('リスクと証券の対応'), tbl([{ h: 'リスク' }, { h: '紐づく証券', w: '26%' }, { h: '損害', cls: 'num', w: '11%' }, { h: '賄える見込み', cls: 'num', w: '12%' }, { h: '賄えない額', cls: 'num', w: '11%' }, { h: '最悪の場合', cls: 'num', w: '11%' }], R.headline.map((i) => [lab(i), i.policies.length ? E(i.policies.map((x) => x.id + ' ' + x.type).join('、')) : '<b>なし</b>', M(i.loss[L]), M(i.loss[L] - i.uninsured[L]), `<b>${M(i.uninsured[L])}</b>`, M(i.uninsured[2])]), { cls: 'small' }), note('賄えない額 ＝ 損害額 − 支払限度額 ＋ 免責金額（損害額が支払限度額を超える場合）。損害額が限度額以下の場合は免責金額。種目とリスクの対応はリスク辞書の定義によります。事業中断は、原因となる事故が補償の対象である場合に限られます。')]; };
  B.deductible_note = () => { const R = RR.compute(); return [h3('免責金額の考え方'), p(`自己負担できる額は${M(R.retention)}とのご回答です。頻度が高く損害の小さい事故は、免責金額を上げて自己負担し、その分の保険料を、損害の大きいリスクの限度額に振り向ける考え方があります。具体的な条件は、保険会社の見積によります。`)]; };
  B.proposal_table = () => { const R = RR.compute(), L = R.level; const ps = RR.rows('proposal').slice().sort((a, b) => (a.f.pr_priority || 'Z').localeCompare(b.f.pr_priority || 'Z') || String(a.f.pr_due || '').localeCompare(String(b.f.pr_due || ''))); return [h3('提案の台帳'), tbl([{ h: 'ID', w: '6%' }, { h: '優先', cls: 'ctr', w: '6%' }, { h: '提案と内容' }, { h: '対象', w: '13%' }, { h: '費用感', w: '13%' }, { h: '期限', w: '10%' }, { h: '状況', w: '8%' }], ps.map((x) => { const eff = [x.f.pr_eff_loss ? '損害 −' + x.f.pr_eff_loss + '%' : '', x.f.pr_eff_freq ? '頻度 −' + x.f.pr_eff_freq + '段階' : '', x.f.pr_eff_limit ? '限度額 +' + M(x.f.pr_eff_limit) : ''].filter(Boolean).join('、'); return [E(x.id), `<b>${E(x.f.pr_priority || '')}</b>`, `<b>${E(x.f.pr_title)}</b><br>${E(x.f.pr_detail || '')}${eff ? `<br><span class="eff">効果の見込み：${E(eff)}（${E(x.f.pr_risk)}）</span>` : ''}`, E(x.f.pr_site ? RR.siteName(x.f.pr_site) : '全社'), E(x.f.pr_cost || '—'), E(x.f.pr_due || '—'), E(x.f.pr_status || '—')]; }), { cls: 'small', empty: '改善提案は未登録です。「提案台帳」画面で、回答から候補を起こせます。' })]; };
  B.roadmap = () => {
    const ps = RR.rows('proposal').filter((x) => x.f.pr_due && /^\d{4}/.test(x.f.pr_due) && !['完了', '見送り'].includes(x.f.pr_status)); if (!ps.length) return [];
    const q = (d) => { const y = +d.slice(0, 4), m = +d.slice(5, 7); return y * 4 + Math.floor((m - 1) / 3); }; const qs = ps.map((x) => q(x.f.pr_due)); const now = q(RR.today()); const a = Math.min(now, ...qs), b = Math.min(a + 9, Math.max(...qs)); const cols = []; for (let i = a; i <= b; i++) cols.push(i);
    ps.sort((x, y) => (x.f.pr_priority || 'Z').localeCompare(y.f.pr_priority || 'Z') || x.f.pr_due.localeCompare(y.f.pr_due));
    return [h3('ロードマップ（期限の四半期）'), `<table class="rt split small road"><thead><tr><th>提案</th>${cols.map((c) => `<th class="ctr">${Math.floor(c / 4)}<br>${['1〜3月', '4〜6月', '7〜9月', '10〜12月'][c % 4]}</th>`).join('')}</tr></thead><tbody>${ps.map((x) => `<tr><td><b>${E(x.f.pr_priority || '')}</b>　${E(x.f.pr_title)}</td>${cols.map((c) => { const due = Math.min(q(x.f.pr_due), b); return `<td class="ctr ${c <= due && c >= now ? 'rd-on' : ''}">${c === due ? '●' : ''}</td>`; }).join('')}</tr>`).join('')}</tbody></table>`, note('帯は現在から期限までの期間、●は期限の四半期です。')];
  };
  /* 第6章：拠点ごと */
  B.site_chapters = (ch, ctx) => {
    const R = RR.compute(), L = R.level; const out = [];
    RR.rows('site').forEach((s, idx) => {
      const sm = R.siteMap[s.id]; const no = `${ch.no}.${idx + 1}`; const ps = Object.values(sm.perils).sort((a, b) => b.loss[L] - a.loss[L]); const worst = ps[0];
      out.push({ html: `<div class="site-open kn" data-toc="${E(no + '　' + sm.name)}"><div class="so-no">${E(no)}</div><div class="so-main"><div class="so-name">${E(sm.name)}</div><div class="so-sub">${E(s.f.site_addr || '所在地未記入')}　｜　${E(s.f.site_use || '')}　｜　${E(s.id)}</div></div><div class="so-k"><span>拠点資産</span><b>${M(sm.V)}</b></div><div class="so-k"><span>最大の損害（${E(RR.levelShort[2])}）</span><b>${worst ? M(Math.max(...ps.map((x) => x.loss[2]))) : '—'}</b></div></div>`, newPage: true, head: `${ch.no} ${ch.title}｜${sm.name}` });
      aiOrAuto('site:' + s.id, siteAuto(sm)).forEach((x) => out.push(x));
      out.push(h4(`${no}.1　概要`)); transposed('site', [s], { per: 1, cap: '拠点の概要', skip: ['site_name'] }).forEach((x) => out.push(x));
      out.push(h4(`${no}.2　自然災害`)); const hz = RR.rows('hazard').filter((h) => h.f.hz_site === s.id).slice(0, 1);
      if (hz.length) { const q = RR.qsOf('hazard').filter((x) => !['id', 'ref'].includes(x.type)); out.push(tbl([{ h: '項目', w: '34%' }, { h: '値', w: '22%' }, { h: '確認方法と出典' }], q.map((x) => [E(x.label), ans(x, hz[0]), provText(RR.provOf(x, hz[0]))]), { cls: 'small', cap: '自然災害の記録（河川・浸水深・地震）' })); } else out.push(p(`この拠点の自然災害の記録はありません。水災・地震は ${unc()} として扱い、損害は試算していません。`));
      out.push(h4(`${no}.3　建物と防火（構造・用途と収容物・防災設備・周辺の4軸）`)); const bl = RR.rowsOfSite('building', s.id); const axis = { C: '構造', O: '用途と収容物', P: '防火・防災設備', E: '周辺からの危険' };
      if (bl.length) { const qs = RR.qsOf('building'); const order = ['C', 'O', 'P', 'E']; const sorted = qs.slice().sort((a, b) => order.indexOf(a.cope || 'C') - order.indexOf(b.cope || 'C')); const keep = RR.qs; /* 並べ替えた順で出す */ const per = 4; for (let i = 0; i < bl.length; i += per) { const part = bl.slice(i, i + per); const rows = []; let g = null; for (const q of sorted) { if (['id', 'ref', 'image'].includes(q.type) || q.id === 'bld_name') continue; const ax = axis[q.cope || 'C']; if (ax !== g) { const r = [`<b>${E(ax)}</b>`].concat(part.map(() => '')); r._cls = 'grp'; rows.push(r); g = ax; } rows.push([E(q.label)].concat(part.map((r) => ans(q, r)))); } rows.push(['確認方法と出典'].concat(part.map((r) => { const x = r.prov.row || {}; return x.method === '未確認' || !x.method ? unc() : provText({ empty: false, method: x.method, src: x.src, date: x.date }); }))); out.push(tbl([{ h: '項目', w: '26%' }].concat(part.map((r) => ({ h: r.f.bld_name || r.id }))), rows, { cls: 'small', cap: `建物の評価${bl.length > per ? `（${i + 1}〜${Math.min(i + per, bl.length)}／${bl.length}棟）` : ''}` })); } } else out.push(p(`建物の記入がありません（${unc('未記入')}）。火災は仮定を置いて試算しています。`));
      out.push(h4(`${no}.4　損害見積`));
      out.push(tbl([{ h: '災害' }, { h: RR.levelShort[0], cls: 'num', w: '12%' }, { h: RR.levelShort[1], cls: 'num', w: '12%' }, { h: RR.levelShort[2], cls: 'num', w: '12%' }, { h: '賄えない額', cls: 'num', w: '12%' }, { h: '等級', cls: 'ctr', w: '7%' }, { h: '頻度', cls: 'ctr', w: '7%' }, { h: '代替', cls: 'ctr', w: '7%' }], ps.map((i) => [E(i.name), M(i.loss[0]), M(i.loss[1]), M(i.loss[2]), `<b>${M(i.uninsured[L])}</b>`, grade(i.grade(L)), i.freqGrade, prepDot(i.prep.alt)]), { cls: 'small', cap: `3水準の損害額（${RR.levelNames.join('／')}）`, empty: '損害を試算できる災害がありません。' }));
      const ln = RR.rowsOfSite('line', s.id); if (ln.length) out.push(tbl([{ h: RR.t('工程・ライン') }, { h: '止まる売上', cls: 'num', w: '13%' }, { h: '復旧期間', cls: 'num', w: '11%' }, { h: '代替手段', w: '13%' }, { h: '代替割合', cls: 'num', w: '10%' }, { h: '代えのきかない設備', w: '28%' }], ln.map((l) => [E(l.f.line_name), M(l.f.line_revenue), (l.f.line_recovery === undefined ? '—' : l.f.line_recovery + 'か月'), E(l.f.line_alt || ''), (l.f.line_alt_ratio === undefined ? '—' : l.f.line_alt_ratio + '%'), E(l.f.line_bottleneck || '')]), { cls: 'small', cap: RR.t('工程・ライン') }));
      out.push(h4(`${no}.5　算出根拠（${RR.levelShort[L]}）`)); ps.forEach((i) => out.push(basisBlock(i, L)));
      out.push(h4(`${no}.6　改善提案`)); const pr = RR.rows('proposal').filter((x) => x.f.pr_site === s.id);
      out.push(tbl([{ h: '優先', cls: 'ctr', w: '7%' }, { h: '提案と内容' }, { h: '費用感', w: '15%' }, { h: '期限', w: '12%' }, { h: '状況', w: '9%' }], pr.map((x) => [`<b>${E(x.f.pr_priority || '')}</b>`, `<b>${E(x.f.pr_title)}</b><br>${E(x.f.pr_detail || '')}`, E(x.f.pr_cost || '—'), E(x.f.pr_due || '—'), E(x.f.pr_status || '—')]), { cls: 'small', empty: 'この拠点を対象とする提案は登録されていません。全社を対象とする提案は第15章に記載しています。' }));
      out.push(h4(`${no}.7　写真と所見`)); const fd = RR.rowsOfSite('finding', s.id);
      if (fd.length) for (let i = 0; i < fd.length; i += 2) out.push(`<div class="fd-row">${fd.slice(i, i + 2).map((x) => `<div class="fd"><div class="fd-ph">${x.f.fd_photo ? `<img src="${x.f.fd_photo}" alt="">` : '<span>写真は未登録</span>'}</div><div class="fd-b"><div class="fd-t"><span class="fdg fdg-${x.f.fd_grade === '要是正' ? 3 : x.f.fd_grade === '要改善' ? 2 : 1}">${E(x.f.fd_grade || '所見')}</span>${E(x.f.fd_title)}</div><div class="fd-x">${E(x.f.fd_text || '')}</div><div class="fd-m">${(x.prov.row || {}).method === '未確認' ? unc() : E((x.prov.row || {}).method || '')}　${E((x.prov.row || {}).date || '')}</div></div></div>`).join('')}</div>`);
      else out.push(p(`この拠点の写真と所見は登録されていません。現地確認は ${unc()} です。`));
      const u = [...new Set(ps.flatMap((i) => i.unconfirmed))]; if (u.length) out.push(`<div class="unc-box kn0"><b>この拠点で未確認・未記入の入力（${u.length}項目）</b>　${u.map(E).join('、')}</div>`);
    });
    return out;
  };
  /* 付録 */
  B.apx_answers = () => { const out = [h3('A　回答の全件')]; for (const layer in RR.layers) { const L = RR.layers[layer]; if (L.appOnly) continue; if (L.kind === 'items') out.push(itemsTable(layer)); else { const recs = RR.rows(layer); if (!recs.length) { out.push(note(`${E(RR.t(L.label))}：記入なし（${unc('未記入')}）`)); continue; } transposed(layer, recs, { per: layer === 'prep' || layer === 'incident' ? 3 : 4 }).forEach((x) => out.push(x)); } } return out; };
  B.apx_basis = () => { const R = RR.compute(), L = R.level; const inCh = ['cyber', 'liab', 'people', 'fin', 'ovs']; const its = R.items.filter((i) => i.scope !== 'site' && !inCh.includes(i.domain)); const types = RR.risks.filter((r) => R.items.some((i) => i.id === r.id)); return [h3('B　算式と算出根拠'), tbl([{ h: 'リスク', w: '24%' }, { h: '領域', w: '11%' }, { h: '想定するシナリオ' }, { h: '基準の頻度', cls: 'ctr', w: '9%' }, { h: '対応する保険の種目', w: '22%' }], types.map((r) => [E(r.name), E(RR.domainById[r.domain].label), E(r.scenario || ''), r.baseFreq || '—', E(RR.policyTypes.filter((t) => t.covers.includes(r.id) || (r.insurance || []).includes(t.id)).map((t) => t.label).join('、') || 'なし')]), { cls: 'small', cap: 'リスク辞書（評価に使った' + types.length + '種類）' }), note(`各リスクの損害額は、算式に回答の値と係数表の値を当てはめて計算しています。拠点別の算出根拠は第6章、サイバー・賠償・ヒト・財務・海外は第8〜12章に載せています。ここには、集積と全社の事業中断など、ほかの章に載せていない${its.length}件を示します。`)].concat(its.map((i) => basisBlock(i, L))); };
  B.apx_coefs = () => { const C = RR.raw.coefficients; const out = [h3('C　係数表'), `<div class="warn-box"><b>係数は仮置きです。</b>${E(C.notice)}</div>`]; for (const t of C.tables) out.push(tbl([{ h: t.label + (t.unit ? `（${t.unit}）` : '') }].concat(t.cols.map((c) => ({ h: c, cls: 'num', w: Math.min(16, 60 / t.cols.length) + '%' }))), Object.keys(t.rows).map((k) => [E(k)].concat(t.rows[k].map((v) => String(v)))), { cls: 'small coef', cap: `出典：${t.source || '未設定（仮置き）'}　改定日：${t.revised || '—'}` })); return out; };
  B.apx_sources = () => { const m = {}; const add = (src, method) => { if (!src) return; const k = method + '｜' + src; m[k] = (m[k] || 0) + 1; }; for (const id in RR.case.items) add(RR.case.items[id].src, RR.case.items[id].method); for (const l in RR.case.rows) for (const r of RR.case.rows[l]) for (const pg in r.prov || {}) add(r.prov[pg].src, r.prov[pg].method); const rows = Object.keys(m).sort().map((k) => { const [me, s] = k.split('｜'); return [E(me), E(s), m[k]]; }); return [h3('D　出典の一覧'), tbl([{ h: '確認方法', w: '14%' }, { h: '出典' }, { h: '使用箇所', cls: 'num', w: '12%' }], rows, { cls: 'small', empty: '出典の記入はありません。' })]; };
  B.apx_unconfirmed = () => { const R = RR.compute(); return [h3(`E　未確認・未記入の事項（${R.unconfList.length}件）`), tbl([{ h: '対象', w: '26%' }, { h: '項目' }, { h: '状態', w: '12%' }, { h: '関係するリスク', w: '30%' }], R.unconfList.map((u) => [E(RR.t(RR.layers[u.q.layer].label) + '：' + u.who), E(u.q.label), unc(u.why), E((u.q.risks || []).map((r) => (RR.riskById[r] || {}).name).filter(Boolean).join('、'))]), { cls: 'small', empty: '未確認・未記入の事項はありません。' }), note('未記入は必須項目のみを挙げています。任意項目の未記入は「A 回答の全件」で確認できます。')]; };
  B.apx_glossary = () => [h3('F　用語'), tbl([{ h: '用語', w: '22%' }, { h: '説明' }], RR.chapters.glossary.map((g) => [`<b>${E(g[0])}</b>`, E(g[1])]), { cls: 'small' })];
  B.closing = (ch, ctx) => [`<div class="closing"><ol>${RR.chapters.closing.map((c) => `<li>${E(c)}</li>`).join('')}<li>${E(RR.raw.coefficients.notice)}</li>${ctx.quick ? '<li>この簡易版は、会社全体を7つの領域で見た概略です。拠点別・建物別の評価は網羅版で行います。</li>' : ''}</ol></div>`];

  /* ---------- 章の一覧（画面とプロンプトでも使う） ---------- */
  RP.chapterList = function (quick) {
    return RR.chapters.chapters.filter((c) => (!quick || c.quick) && (c.id !== 'c12' || true));
  };
  RP.chapterBlocks = function (ch, ctx) {
    const out = [];
    if (ch.id === 'c12' && RR.val('ov_has') === 'なし' && !RR.rows('overseas').length) return [p(E(ch.emptyNote || '該当なし'))];
    for (const b of ch.blocks) { const [name, arg] = b.split(':'); const fn = B[name]; if (!fn) { out.push(note(`章定義の部品「${E(b)}」は未定義です。`)); continue; } for (const x of fn(ch, ctx, arg) || []) if (x) out.push(x); }
    return out;
  };

  /* ---------- ページに流し込む ---------- */
  RP.render = async function (host, o) {
    const quick = o.edition === 'quick'; const ctx = { quick }; const R = RR.compute();
    if (document.fonts && document.fonts.ready) { try { await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 2500))]); } catch (e) {} }
    host.innerHTML = ''; host.classList.add('paper-root');
    const coName = RR.companyName(false); const docTitle = `リスク診断報告書（${quick ? '簡易版' : '網羅版'}）`;
    const pages = []; let cur = null; const toc = [];
    const newPage = (headText, bare) => {
      const sec = RR.el('section', { class: 'page' + (bare ? ' bare' : '') });
      sec.innerHTML = bare ? '<div class="pb"></div>' : `<header class="rh"><span>${E(coName)}　${E(docTitle)}</span><span>${E(headText || '')}</span></header><div class="pb"></div><footer class="rf"><span>${RR.case.meta.isSample ? 'サンプル（架空のデータ）　' : ''}損害額は試算です。係数の初期値は仮置きです。</span><span class="pn"></span></footer>`;
      host.appendChild(sec); cur = { sec, pb: sec.querySelector('.pb'), head: headText }; pages.push(cur); return cur;
    };
    const over = () => cur.pb.scrollHeight > cur.pb.clientHeight + 1;
    const tmp = document.createElement('div');
    const toNode = (html) => { tmp.innerHTML = html; return tmp.firstElementChild; };
    function place(node, headText) {
      cur.pb.appendChild(node);
      if (!over()) return;
      if (node.matches('table.split') && node.tBodies[0] && node.tBodies[0].rows.length > 1) { cur.pb.removeChild(node); splitTable(node, headText); return; }
      if (cur.pb.children.length > 1) {
        cur.pb.removeChild(node); const carry = []; let last = cur.pb.lastElementChild;
        while (last && last.classList.contains('kn') && cur.pb.children.length > 1) { carry.unshift(last); cur.pb.removeChild(last); last = cur.pb.lastElementChild; }
        newPage(headText); carry.forEach((c) => cur.pb.appendChild(c)); cur.pb.appendChild(node);
      }
      if (over()) node.classList.add('shrink');
    }
    function splitTable(table, headText) {
      const rows = Array.from(table.tBodies[0].rows); let first = true; let i = 0;
      const shell = () => { const t = table.cloneNode(false); if (table.caption) { const c = table.caption.cloneNode(true); if (!first) c.textContent += '（続き）'; t.appendChild(c); } const cg = table.querySelector('colgroup'); if (cg) t.appendChild(cg.cloneNode(true)); if (table.tHead) t.appendChild(table.tHead.cloneNode(true)); t.appendChild(document.createElement('tbody')); return t; };
      while (i < rows.length) {
        let t = shell(); cur.pb.appendChild(t); let n = 0;
        while (i < rows.length) { t.tBodies[0].appendChild(rows[i]); if (over()) { t.tBodies[0].removeChild(rows[i]); break; } i++; n++; }
        if (n === 0) {
          cur.pb.removeChild(t);
          if (cur.pb.children.length === 0) { const t2 = shell(); t2.tBodies[0].appendChild(rows[i]); cur.pb.appendChild(t2); i++; first = false; if (i < rows.length) newPage(headText); continue; }
          const carry = []; let last = cur.pb.lastElementChild; while (last && last.classList.contains('kn') && cur.pb.children.length > 1) { carry.unshift(last); cur.pb.removeChild(last); last = cur.pb.lastElementChild; }
          newPage(headText); carry.forEach((c) => cur.pb.appendChild(c)); continue;
        }
        first = false; if (i < rows.length) newPage(headText);
      }
    }
    const chapters = RP.chapterList(quick); let tocPage = null;
    for (const ch of chapters) {
      const headText = ch.no ? `${ch.no}${/^\d/.test(ch.no) ? '' : ''} ${ch.title}` : ch.title;
      if (ch.id === 'cover') { newPage('', true); cur.pb.innerHTML = B.cover(ch, ctx)[0]; continue; }
      newPage(headText);
      if (ch.id === 'toc') { tocPage = cur; cur.pb.innerHTML = B.toc()[0]; continue; }
      toc.push({ no: ch.no, title: ch.title, page: pages.length, lvl: 0 });
      cur.pb.appendChild(toNode(`<div class="ch-open"><div class="ch-no">${E(ch.no || '')}</div><div class="ch-t"><h2>${E(ch.title)}</h2>${ch.lead ? `<div class="ch-lead">${E(ch.lead)}</div>` : ''}</div></div>`));
      let head = headText;
      for (const b of RP.chapterBlocks(ch, ctx)) {
        if (typeof b === 'object') { if (b.head) head = b.head; if (b.newPage && cur.pb.children.length > 1) newPage(head); else cur.head = head; const node = toNode(b.html); place(node, head); if (node.dataset.toc) toc.push({ no: '', title: node.dataset.toc, page: pages.indexOf(cur) + 1, lvl: 1 }); const rhs = cur.sec.querySelector('.rh span:last-child'); if (rhs) rhs.textContent = head; continue; }
        const node = toNode(b); if (!node) continue; place(node, head);
      }
      await new Promise((r) => setTimeout(r, 0));
      if (o.onProgress) o.onProgress(pages.length);
    }
    /* 目次：行数が多いときはページを足す */
    if (tocPage) {
      const rowsHtml = toc.map((t) => `<tr class="toc-${t.lvl}"><td class="tn">${E(t.no || '')}</td><td class="tt">${E(t.title)}</td><td class="tp">00</td></tr>`).join('');
      const body = tocPage.pb.querySelector('#toc-body'); body.innerHTML = rowsHtml; let extra = 0;
      if (tocPage.pb.scrollHeight > tocPage.pb.clientHeight + 1) {
        const table = tocPage.pb.querySelector('table.toc'); const rows = Array.from(body.rows); let pg = tocPage; let i = 0; body.innerHTML = '';
        let tb = body;
        while (i < rows.length) { tb.appendChild(rows[i]); if (pg.pb.scrollHeight > pg.pb.clientHeight + 1) { tb.removeChild(rows[i]); const sec = RR.el('section', { class: 'page' }); sec.innerHTML = tocPage.sec.innerHTML; const pb = sec.querySelector('.pb'); pb.innerHTML = '<table class="toc split"><tbody></tbody></table>'; pg.sec.after(sec); pg = { sec, pb }; pages.splice(pages.indexOf(tocPage) + 1 + extra, 0, pg); extra++; tb = pb.querySelector('tbody'); continue; } i++; }
      }
      host.querySelectorAll('table.toc tr').forEach((tr, i) => { tr.querySelector('.tp').textContent = toc[i].page + extra; });
    }
    const total = pages.length; pages.forEach((pg, i) => { const pn = pg.sec.querySelector('.pn'); if (pn) pn.textContent = `${i + 1} / ${total}`; pg.sec.id = 'pg-' + (i + 1); pg.sec.dataset.page = i + 1; });
    return { pages: total, toc: toc.map((t) => Object.assign({}, t, { page: t.page + (tocPage ? host.querySelectorAll('table.toc').length - 1 : 0) })) };
  };
})();
