/* engine: 損害見積、頻度、保険、備え、集積。数値はすべてここで規則により計算する */
(function () {
  const M = (x) => RR.money(x);
  const SHINDO = ['5弱以下', '5強', '6弱', '6強', '7'];
  const num = (v) => { const n = Number(v); return v === '' || v === null || v === undefined || !isFinite(n) ? null : n; };

  /* 質問マスタの「評価への反映方法」を集める */
  function fxFor(riskId, siteId) {
    let freq = 0, sev = 1; const notes = [];
    const apply = (q, f, v, who) => {
      let d = null;
      if (f.m && v !== undefined && v !== '' && f.m[v] !== undefined) d = f.m[v];
      if (f.ge && num(v) !== null) { for (const [th, val] of f.ge) if (num(v) >= th) d = val; }
      if (d === null || d === undefined) return null;
      return { k: f.k, d, text: `${q.label}＝${v}${q.unit && q.type === 'num' ? q.unit : ''}${who ? '（' + who + '）' : ''}` };
    };
    for (const q of RR.qs) {
      if (!q.fx) continue;
      for (const f of q.fx) {
        if (f.r !== riskId) continue;
        const L = RR.layers[q.layer];
        let hits = [];
        if (L.kind === 'items') { const h = apply(q, f, RR.val(q.id)); if (h) hits.push(h); }
        else {
          let recs = RR.rows(q.layer);
          if (siteId) { if (q.layer === 'site') recs = recs.filter((r) => r.id === siteId); else if (L.siteField) recs = recs.filter((r) => r.f[L.siteField] === siteId); }
          const hs = recs.map((r) => apply(q, f, r.f[q.id], L.nameField ? r.f[L.nameField] : '')).filter(Boolean);
          if (hs.length) { hs.sort((a, b) => (f.k === 'freq' ? b.d - a.d : b.d - a.d)); hits.push(hs[0]); }
        }
        for (const h of hits) {
          if (h.k === 'freq') { if (h.d !== 0) { freq += h.d; notes.push(`${h.text}：頻度 ${h.d > 0 ? '+' : ''}${h.d}`); } }
          else if (h.d !== 1) { sev *= h.d; notes.push(`${h.text}：損害 ×${h.d}`); }
        }
      }
    }
    return { freq, sev, notes };
  }
  RR.fxDescribe = function (q) {
    if (!q.fx) return q.risks && q.risks.length ? '算式の入力値として使用' : '記録のみ';
    return q.fx.map((f) => {
      const r = RR.riskById[f.r]; const nm = r ? r.name : f.r;
      const body = f.m ? Object.keys(f.m).map((k) => `${k}→${f.k === 'freq' ? (f.m[k] > 0 ? '+' : '') + f.m[k] : '×' + f.m[k]}`).join('、') : f.ge.map(([t, v]) => `${t}以上→+${v}`).join('、');
      return `${nm}の${f.k === 'freq' ? '頻度' : '損害'}：${body}`;
    }).join('／');
  };

  function impactScore(loss, net) {
    const th = RR.c('impact_thresholds', '境界');
    if (!net || net <= 0) return { g: loss > 0 ? 5 : 1, pos: loss > 0 ? 4.5 : 0.5, ratio: null };
    const r = (loss / net) * 100; let g = 1; for (const t of th) if (r >= t) g++;
    const lo = g === 1 ? th[0] / 10 : th[g - 2], hi = g === 5 ? th[3] * 4 : th[g - 1];
    const fr = r <= 0 ? 0.08 : RR.clamp((Math.log(Math.max(r, lo)) - Math.log(lo)) / (Math.log(hi) - Math.log(lo)), 0.08, 0.92);
    return { g, pos: g - 1 + fr, ratio: r };
  }
  RR.impactScore = impactScore;
  const freqPos = (f) => RR.clamp(f - 0.5, 0.15, 4.85);
  const freqGrade = (f) => RR.clamp(Math.round(f), 1, 5);
  RR.freqLabels = function () { const y = RR.c('freq_years', '境界'); return [`${y[0]}年に1回未満`, `${y[1]}〜${y[0]}年に1回`, `${y[2]}〜${y[1]}年に1回`, `${y[3]}〜${y[2]}年に1回`, `${y[3]}年に1回以上`]; };
  RR.impactLabels = function () { const t = RR.c('impact_thresholds', '境界'); return [`純資産の${t[0]}%未満`, `${t[0]}〜${t[1]}%`, `${t[1]}〜${t[2]}%`, `${t[2]}〜${t[3]}%`, `${t[3]}%以上`]; };

  function floodRatio(depth) {
    if (!(depth > 0)) return [0, 0, 0];
    const b = RR.c('flood_bands', '上限'); const keys = Object.keys(RR.coef.flood_ratio.rows); let i = 0; while (i < b.length && depth >= b[i]) i++;
    return RR.coef.flood_ratio.rows[keys[Math.min(i, keys.length - 1)]];
  }
  function bandName(depth) { const b = RR.c('flood_bands', '上限'); const keys = Object.keys(RR.coef.flood_ratio.rows); let i = 0; while (i < b.length && depth >= b[i]) i++; return keys[Math.min(i, keys.length - 1)]; }

  function siteCtx(s) {
    const f = s.f; const vb = num(f.site_val_bld) || 0, ve = num(f.site_val_eq) || 0, vs = num(f.site_val_stock) || 0;
    let blds = RR.rowsOfSite('building', s.id); const assume = [];
    if (!blds.length) { blds = [{ id: '-', f: { bld_name: '（建物未記入）', bld_structure: '鉄骨造（非耐火）', bld_sprinkler: 'なし', bld_compart: 'なし' }, virtual: true }]; assume.push('建物の情報が未記入のため、鉄骨造・スプリンクラーなし・区画なしと仮定'); }
    const areaSum = blds.reduce((a, b) => a + (num(b.f.bld_area) || 0), 0);
    const givenSum = blds.reduce((a, b) => a + (num(b.f.bld_share) || 0), 0);
    const shares = blds.map((b) => (givenSum > 0 ? (num(b.f.bld_share) || 0) / givenSum : areaSum > 0 ? (num(b.f.bld_area) || 0) / areaSum : 1 / blds.length));
    const hz = RR.rows('hazard').find((h) => h.f.hz_site === s.id);
    return { s, f, vb, ve, vs, V: vb + ve + vs, blds, shares, hz: hz ? hz.f : {}, hzRec: hz, assume, lines: RR.rowsOfSite('line', s.id) };
  }

  /* ---------- 算式（拠点） ---------- */
  const F = {};
  F.fire = function (c, fx) {
    const loss = [0, 0, 0], basis = [[], [], []];
    for (let L = 0; L < 3; L++) {
      let best = -1, bl = null;
      c.blds.forEach((b, i) => {
        const st = RR.hasRow('fire_base', b.f.bld_structure) ? b.f.bld_structure : '鉄骨造（非耐火）';
        const sp = RR.hasRow('fire_sprinkler', b.f.bld_sprinkler) ? b.f.bld_sprinkler : 'なし';
        const cp = RR.hasRow('fire_compart', b.f.bld_compart) ? b.f.bld_compart : 'なし';
        const base = RR.c('fire_base', st, L), ks = RR.c('fire_sprinkler', sp, L), kc = RR.c('fire_compart', cp, L);
        const sev = L < 2 ? fx.sev : 1;
        const ratio = Math.min(1, base * ks * kc * sev);
        const val = c.V * c.shares[i];
        const spread = b.f.bld_neighbor === '10m未満' ? RR.c('fire_spread', '延焼', L) * (c.V - val) : 0;
        const x = val * ratio + spread;
        if (x > best) { best = x; bl = [`出火建物：${b.f.bld_name || b.id}（資産 ${M(val)}＝拠点資産 ${M(c.V)} × ${RR.n0(c.shares[i] * 100)}%）`, `損害割合 ${RR.n1(ratio * 100)}% ＝ 構造「${st}」${base} × スプリンクラー「${sp}」${ks} × 防火区画「${cp}」${kc}${sev !== 1 ? ' × 管理状況 ' + Math.round(sev * 100) / 100 : ''}`, spread > 0 ? `隣棟への延焼 ${M(spread)}（隣棟間隔10m未満）` : null, `損害額 ${M(x)}`].filter(Boolean); }
      });
      loss[L] = Math.max(0, best); basis[L] = bl || [];
    }
    return { loss, basis, freq: null, freqNote: null };
  };
  function waterLoss(c, depth, factor, label) {
    const r = floodRatio(depth); const g0 = num(c.f.site_ground); const g = depth >= 3 ? 1 : g0 === null ? 1 : g0 / 100;
    const x = Math.min(c.V, (c.vb * r[0] + (c.ve * r[1] + c.vs * r[2]) * g) * factor);
    const lines = depth > 0 ? [`${label} ${depth}m（区分「${bandName(depth)}」）`, `建物 ${M(c.vb)} × ${r[0]} ＋（設備 ${M(c.ve)} × ${r[1]} ＋ 在庫 ${M(c.vs)} × ${r[2]}）× 浸水する割合 ${RR.n0(g * 100)}%${g0 === null && depth < 3 ? '（未記入のため100%と仮定）' : ''}${factor !== 1 ? ' × ' + factor : ''}`, `損害額 ${M(x)}`] : [`${label} 0m：損害なし`];
    return { x: depth > 0 ? x : 0, lines };
  }
  F.flood = function (c) {
    const h = c.hz; const mx = Math.max(num(h.hz_depth_max) || 0, num(h.hz_inland) || 0); const inland = num(h.hz_inland) || 0;
    let plan = num(h.hz_depth_plan); const notes = [];
    if (plan === null) { plan = mx * 0.5; if (mx > 0) notes.push('計画規模の浸水深が未記入のため、想定最大規模の半分と仮定'); }
    plan = Math.max(plan, inland);
    const wall = RR.hasRow('flood_wall', h.hz_wall) ? RR.c('flood_wall', h.hz_wall, 0) : 0;
    const d = [Math.max(0, plan - wall), plan, mx];
    const lab = ['計画規模の浸水深から浸水への備え（' + (h.hz_wall || 'なし') + '）で防げる ' + wall + 'm を引いた深さ', '計画規模の想定浸水深', '想定最大規模の想定浸水深'];
    const loss = [], basis = [];
    d.forEach((dp, L) => { const w = waterLoss(c, Math.round(dp * 100) / 100, 1, lab[L]); loss.push(w.x); basis.push(w.lines.concat(L === 1 ? notes : [])); });
    let freq = (num(h.hz_depth_plan) || 0) > 0 ? 2 : 1; let fn = (num(h.hz_depth_plan) || 0) > 0 ? '計画規模で浸水が想定されるため 2' : '想定最大規模でのみ浸水するため 1';
    if (inland > 0) { freq += 0.5; fn += '、内水の想定あり +0.5'; }
    return { loss, basis, freq, freqNote: fn };
  };
  F.surge = function (c) { return waterPeril(c, num(c.hz.hz_surge) || 0, RR.c('water_factor', '高潮', 0), '高潮の想定浸水深', 1.5, '高潮浸水想定があるため 1.5'); };
  F.tsunami = function (c) { return waterPeril(c, num(c.hz.hz_tsunami) || 0, RR.c('water_factor', '津波', 0), '津波の想定浸水深', 1, '想定地震に伴うため 1'); };
  function waterPeril(c, depth, factor, label, freq, fn) {
    const loss = [], basis = [];
    [0.5, 1, 1].forEach((k, L) => { const w = waterLoss(c, Math.round(depth * k * 100) / 100, factor, label + (L === 0 ? 'の半分' : '')); loss.push(w.x); basis.push(w.lines); });
    return { loss, basis, freq, freqNote: fn };
  }
  F.slide = function (c) {
    const z = RR.hasRow('slide_ratio', c.hz.hz_slide) ? c.hz.hz_slide : '区域外'; const loss = [], basis = [];
    for (let L = 0; L < 3; L++) { const r = RR.c('slide_ratio', z, L); loss.push(c.V * r); basis.push([`土砂災害「${z}」：拠点資産 ${M(c.V)} × ${r} ＝ ${M(c.V * r)}`]); }
    return { loss, basis, freq: z === '特別警戒区域' ? 2 : 1.5, freqNote: `区域区分「${z}」による` };
  };
  F.quake = function (c) {
    const h = c.hz; const idx = SHINDO.indexOf(h.hz_shindo); const loss = [0, 0, 0], basis = [[], [], []];
    if (idx < 0) return { loss, basis: [['想定震度が未記入のため算出していません（未確認）'], ['想定震度が未記入のため算出していません（未確認）'], ['想定震度が未記入のため算出していません（未確認）']], freq: null };
    const liq = RR.hasRow('quake_liq', h.hz_liq) ? RR.c('quake_liq', h.hz_liq, 0) : 1;
    [-1, 0, 1].forEach((dlt, L) => {
      const sh = SHINDO[RR.clamp(idx + dlt, 0, 4)]; let sum = 0; const parts = [];
      c.blds.forEach((b, i) => {
        let cls = b.f.bld_seismic; if (!RR.coef.quake_ratio.cols.includes(cls)) cls = num(b.f.bld_year) ? (num(b.f.bld_year) >= 1981 ? '新耐震' : '旧耐震・未補強') : '不明';
        const col = RR.coef.quake_ratio.cols.indexOf(cls); const rb = Math.min(1, RR.c('quake_ratio', sh, col) * liq);
        const an = { 済: 0, 一部: 1, 未: 2 }[b.f.bld_anchor]; const kc = RR.c('quake_contents', '倍率', an === undefined ? 1 : an); const rc = Math.min(1, rb * kc);
        const x = c.shares[i] * (c.vb * rb + (c.ve + c.vs) * rc); sum += x;
        parts.push(`${b.f.bld_name || b.id}（${cls}）：建物 ${RR.n1(rb * 100)}%、設備・在庫 ${RR.n1(rc * 100)}% → ${M(x)}`);
      });
      loss[L] = sum; basis[L] = [`震度 ${sh}${dlt < 0 ? '（想定より一段小さい揺れ）' : dlt > 0 ? '（想定より一段大きい揺れ）' : '（想定震度）'}${liq !== 1 ? '、液状化「' + h.hz_liq + '」×' + liq : ''}`].concat(parts.slice(0, 6), [`損害額 ${M(sum)}`]);
    });
    let freq = null, fn = null; const p = num(h.hz_quake_p);
    if (p !== null && p > 0) {
      const T = 1 / (-Math.log(1 - Math.min(p, 99.9) / 100) / 30); const y = RR.c('freq_years', '境界'); let g = 1; for (const t of y) if (T <= t) g++;
      freq = g; fn = `30年確率 ${p}% → およそ${RR.n0(T)}年に1回`;
    }
    return { loss, basis, freq, freqNote: fn };
  };
  F.bi = function (c, fx, noAlt) {
    const margin = (RR.num('co_margin') || 0) / 100; const loss = [0, 0, 0], basis = [[], [], []];
    let lines = c.lines.map((l) => { const rb = RR.hasRow('rebuy_factor', l.f.line_rebuy) ? RR.c('rebuy_factor', l.f.line_rebuy, 0) : 1, eo = RR.hasRow('eol_factor', l.f.line_eol) ? RR.c('eol_factor', l.f.line_eol, 0) : 1; return { name: l.f.line_name || l.id, rev: num(l.f.line_revenue) || 0, mo: num(l.f.line_recovery) || 0, alt: (num(l.f.line_alt_ratio) || 0) / 100, k2: rb * eo, rebuy: l.f.line_rebuy, eol: l.f.line_eol, rebuild: num(l.f.line_rebuild), age: num(l.f.line_age) }; });
    const notes = [];
    if (!lines.length) {
      const rev = RR.num('co_revenue') * (num(c.f.site_rev_share) || 0) / 100;
      if (rev > 0) { lines = [{ name: '拠点全体', rev, mo: 6, alt: 0, k2: 1, rebuild: null }]; notes.push('工程・ラインが未記入のため、売上寄与分が6か月止まると仮定'); }
    }
    for (let L = 0; L < 3; L++) {
      const k = RR.c('bi_period', '倍率', L); const sev = L < 2 ? fx.sev : 1; let sum = 0; const parts = [];
      for (const l of lines) {
        const alt = noAlt ? 0 : l.alt; let mo = l.mo * k * l.k2; let why = l.k2 !== 1 ? `（再調達「${l.rebuy || '—'}」・保守「${l.eol || '—'}」で ×${Math.round(l.k2 * 100) / 100}）` : '';
        if (L === 2 && l.rebuild !== null && l.rebuild > mo) { mo = l.rebuild; why = `（再構築にかかる期間 ${l.rebuild}か月を採用）`; }
        const x = l.rev * (mo / 12) * (1 - alt) * margin * sev; sum += x;
        parts.push(`${l.name}：売上 ${M(l.rev)} × 停止 ${RR.n1(mo)}か月${why}÷12 ×（1−代替 ${RR.n0(alt * 100)}%）× 限界利益率 ${RR.n0(margin * 100)}%${sev !== 1 ? ' × ' + Math.round(sev * 100) / 100 : ''} ＝ ${M(x)}`);
      }
      loss[L] = sum; basis[L] = [`復旧期間 × ${k}`].concat(parts.slice(0, 8), notes, [`損害額 ${M(sum)}`]);
    }
    return { loss, basis, freq: null };
  };
  F.wind = function (c, fx) {
    const ex = RR.hasRow('wind_ratio', c.hz.hz_wind) ? c.hz.hz_wind : '普通'; const loss = [0, 0, 0], basis = [[], [], []];
    const roofK = c.blds.reduce((a, b, i) => a + c.shares[i] * (RR.hasRow('wind_roof', b.f.bld_roof) ? RR.c('wind_roof', b.f.bld_roof, 0) : 1), 0);
    const kc = RR.c('wind_contents', '倍率', 0);
    for (let L = 0; L < 3; L++) { const r = RR.c('wind_ratio', ex, L) * roofK * (L < 2 ? fx.sev : 1); const x = Math.min(c.V, c.vb * r + (c.ve + c.vs) * r * kc); loss[L] = x; basis[L] = [`受けやすさ「${ex}」の損害割合 ${RR.c('wind_ratio', ex, L)} × 屋根の種類による倍率 ${Math.round(roofK * 100) / 100}${L < 2 && fx.sev !== 1 ? ' × 劣化の状況 ' + Math.round(fx.sev * 100) / 100 : ''}`, `建物 ${M(c.vb)} × ${RR.n1(r * 100)}% ＋（設備・在庫 ${M(c.ve + c.vs)} × ${RR.n1(r * 100)}% × 雨水の浸入 ${kc}）＝ ${M(x)}`]; }
    let freq = 2.5, fn = '基準 2.5'; if (ex === '受けやすい') { freq += 0.5; fn += '、台風・強風を受けやすい +0.5'; } if (ex === '受けにくい') { freq -= 0.5; fn += '、受けにくい −0.5'; } if (c.hz.hz_snow === '多い') { freq += 0.25; fn += '、積雪・雹が多い +0.25'; }
    return { loss, basis, freq, freqNote: fn };
  };
  F.lightning = function (c, fx) {
    if (!(c.ve > 0)) return null; let worst = null;
    c.blds.forEach((b) => { const t = RR.hasRow('light_ratio', b.f.bld_lsens) ? b.f.bld_lsens : 'なし'; if (!worst || RR.c('light_ratio', t, 2) > RR.c('light_ratio', worst.t, 2)) worst = { b, t }; });
    const t = worst.t; const spd = RR.hasRow('light_spd', worst.b.f.bld_spd) ? RR.c('light_spd', worst.b.f.bld_spd, 0) : 1;
    const rev = RR.num('co_revenue') * (num(c.f.site_rev_share) || 0) / 100; const margin = RR.num('co_margin') / 100;
    const loss = [0, 0, 0], basis = [[], [], []];
    for (let L = 0; L < 3; L++) {
      const r = RR.c('light_ratio', t, L) * (L < 2 ? spd : 1) * (L < 2 ? fx.sev : 1); const eq = c.ve * r; const days = RR.c('light_days', t, L) * (L < 2 ? spd : 1); const bi = rev * (days / 365) * margin;
      loss[L] = eq + bi; basis[L] = [`落雷で甚大な被害が出る設備「${t}」（${worst.b.f.bld_name || worst.b.id}）、雷サージ対策「${worst.b.f.bld_spd || '未記入'}」${L < 2 ? ' ×' + spd : '（最悪の場合は対策が効かないと仮定）'}`, `設備 ${M(c.ve)} × ${RR.n1(r * 100)}% ＝ ${M(eq)}`, `停止 ${RR.n1(days)}日 × 拠点の売上 ${M(rev)}÷365 × 限界利益率 ${RR.n0(margin * 100)}% ＝ ${M(bi)}`, `損害額 ${M(loss[L])}`];
    }
    const th = c.hz.hz_thunder; const adj = RR.hasRow('light_thunder', th) ? RR.c('light_thunder', th, 0) : 0;
    return { loss, basis, freq: 2 + adj, freqNote: `基準 2、落雷の多さ「${th || '未記入'}」${adj ? (adj > 0 ? ' +' : ' ') + adj : ''}` };
  };
  F.special = function (c) {
    const r = num(c.f.site_special_real), m = num(c.f.site_special_max); if (r === null && m === null) return null;
    const rr = r === null ? m * 0.2 : r, mm = m === null ? r * 3 : m; const mid = rr > 0 ? Math.sqrt(rr * mm) : mm / 2; const what = c.f.site_special || '拠点に特有の危険';
    const loss = [rr, mid, mm]; const basis = loss.map((x) => [`「${what}」：担当者の想定 ${r === null ? '（現実的な損害は未記入のため最大の2割と仮定）' : '現実的な損害 ' + M(r)}${m === null ? '（最大の損害は未記入のため現実的な損害の3倍と仮定）' : '、最大の損害 ' + M(m)}`, `この水準の損害額 ${M(x)}`]);
    return { loss, basis, freq: null };
  };

  /* ---------- 算式（全社） ---------- */
  const G = {};
  const lv3 = (fn) => { const loss = [], basis = []; for (let L = 0; L < 3; L++) { const r = fn(L); loss.push(r[0]); basis.push(r[1]); } return { loss, basis }; };
  G.fixed = (r, fx) => lv3((L) => { const a = r.formula.amounts ? r.formula.amounts[L] : RR.c(r.formula.coef, undefined)[L]; const sev = L < 2 ? fx.sev : 1; return [a * sev, [`想定額 ${M(a)}（係数表）${sev !== 1 ? ' × 回答による補正 ' + Math.round(sev * 100) / 100 : ''} ＝ ${M(a * sev)}`]]; });
  G.revenueRate = (r, fx) => lv3((L) => { const rate = r.formula.rates ? r.formula.rates[L] : RR.c(r.formula.coef, undefined)[L]; const rev = RR.num('co_revenue'); const sev = L < 2 ? fx.sev : 1; const x = rev * rate / 100 * sev; return [x, [`売上高 ${M(rev)} × ${rate}%${sev !== 1 ? ' × ' + Math.round(sev * 100) / 100 : ''} ＝ ${M(x)}`]]; });
  G.supplier = function (r, fx, noAlt) {
    const sup = RR.rows('partner').filter((p) => p.f.pt_type === '仕入先'); if (!sup.length) return null;
    const rev = RR.num('co_revenue'), margin = RR.num('co_margin') / 100; let best = null;
    for (const p of sup) {
      const res = lv3((L) => {
        const dep = (num(p.f.pt_dep) || 0) / 100, mo = (num(p.f.pt_stop) === null ? 1 : num(p.f.pt_stop)) * RR.c('supplier_level', '倍率', L);
        const a = noAlt ? 1 : RR.hasRow('supplier_alt', p.f.pt_alt) ? RR.c('supplier_alt', p.f.pt_alt, 0) : 1;
        const x = rev * dep * (mo / 12) * a * margin;
        return [x, [`${p.f.pt_name}（${p.f.pt_item || '品目未記入'}）`, `売上高 ${M(rev)} × 依存度 ${RR.n0(dep * 100)}% × 停止 ${RR.n1(mo)}か月÷12 × 代替「${noAlt ? '考慮しない' : p.f.pt_alt || '未記入'}」${a} × 限界利益率 ${RR.n0(margin * 100)}% ＝ ${M(x)}`]];
      });
      res.sub = p.f.pt_name;
      if (!best || res.loss[1] > best.loss[1]) best = res;
    }
    return best;
  };
  G.cyberStop = function (r, fx, noAlt) {
    let sys = RR.rows('system'); const unconf = [];
    if (!sys.length) { sys = [{ id: '-', f: { sys_name: '基幹システム（仮定）', sys_rev_share: RR.c('cyber_default', '止まる売上の割合（%）', 0), sys_rto: RR.c('cyber_default', '復旧見込み（日）', 0), sys_backup: RR.val('cy_offline') || '取得のみ・復元未検証' } }]; unconf.push('システムの一覧（未記入のため仮定）'); }
    const rev = RR.num('co_revenue'), margin = RR.num('co_margin') / 100; let best = null;
    for (const s of sys) {
      const res = lv3((L) => {
        const share = (num(s.f.sys_rev_share) || 0) / 100; const kb = noAlt ? RR.c('cyber_backup', 'なし', 0) : RR.hasRow('cyber_backup', s.f.sys_backup) ? RR.c('cyber_backup', s.f.sys_backup, 0) : RR.c('cyber_backup', 'なし', 0);
        const days = (num(s.f.sys_rto) === null ? 7 : num(s.f.sys_rto)) * kb * RR.c('cyber_level', '倍率', L); const sev = L < 2 ? fx.sev : 1;
        const cost = RR.c('cyber_response', '費用', L); const x = rev * share * (days / 365) * margin * sev + cost;
        return [x, [`${s.f.sys_name}${s.id === '-' ? '（システムの一覧が未記入のため、係数表の仮定を使用）' : ''}`, `売上高 ${M(rev)} × 止まる割合 ${RR.n0(share * 100)}% × 停止 ${RR.n1(days)}日÷365（復旧見込み ${num(s.f.sys_rto) === null ? '7（未記入のため仮定）' : s.f.sys_rto}日 × バックアップ「${noAlt ? '考慮しない' : s.f.sys_backup || '未記入'}」${kb} × 水準 ${RR.c('cyber_level', '倍率', L)}）× 限界利益率 ${RR.n0(margin * 100)}%${sev !== 1 ? ' × ' + Math.round(sev * 100) / 100 : ''} ＋ 調査・復旧の対応費用 ${M(cost)} ＝ ${M(x)}`]];
      });
      res.sub = s.f.sys_name; res.unconf = unconf;
      if (!best || res.loss[1] > best.loss[1]) best = res;
    }
    return best;
  };
  G.cyberLeak = (r, fx) => { let n = num(RR.val('cy_pii')); const note = []; if (n === null) { n = (RR.num('co_employees') || 100) * 5; note.push(`保有する個人情報の件数が未記入のため、従業員数の5倍（${RR.n0(n)}件）と仮定`); } const res = lv3((L) => { const u = RR.c('leak_unit', '単価', L), fxd = RR.c('leak_fixed', '費用', L); const sev = L < 2 ? fx.sev : 1; const x = ((n * u) / 1e6 + fxd) * sev; return [x, [`個人情報 ${RR.n0(n)}件 × ${RR.n0(u)}円 ＋ 調査・通知の固定費 ${M(fxd)}${sev !== 1 ? ' × ' + Math.round(sev * 100) / 100 : ''} ＝ ${M(x)}`].concat(note)]; }); if (note.length) res.unconf = ['保有する個人情報の件数']; return res; };
  G.food = (r, fx) => { const k = RR.val('lb_food'); if (!k || k === 'なし' || !RR.hasRow('food_amounts', k)) return null; return lv3((L) => { const a = RR.c('food_amounts', k, L), sev = L < 2 ? fx.sev : 1; return [a * sev, [`食中毒が起こりうる業務「${k}」：想定額 ${M(a)}（係数表）${sev !== 1 ? ' × ' + Math.round(sev * 100) / 100 : ''} ＝ ${M(a * sev)}`]]; }); };
  const GATE = { bike: () => RR.val('lb_bike') && RR.val('lb_bike') !== 'なし', mycar: () => RR.val('lb_mycar') && RR.val('lb_mycar') !== 'なし', travel: () => (num(RR.val('ov_trips')) || 0) + (num(RR.val('ov_expat')) || 0) > 0 };
  G.fixedCoef = (r, fx) => { if (GATE[r.id] && !GATE[r.id]()) return null; return lv3((L) => { const a = RR.c(r.formula.coef, '想定額', L), sev = L < 2 ? fx.sev : 1; return [a * sev, [`想定額 ${M(a)}（係数表）${sev !== 1 ? ' × 回答による補正 ' + Math.round(sev * 100) / 100 : ''} ＝ ${M(a * sev)}`]]; }); };
  function prodBase() {
    const pd = RR.rows('product'); if (!pd.length) return { base: RR.num('co_revenue'), text: `売上高 ${M(RR.num('co_revenue'))}（製品群が未記入のため全社売上を使用）` };
    const safe = pd.filter((p) => p.f.pd_safety === 'あり'); const use = safe.length ? safe : pd; const base = use.reduce((a, p) => a + (num(p.f.pd_revenue) || 0), 0);
    return { base, text: `${safe.length ? '人の安全に関わる製品群' : '全製品群'}の売上 ${M(base)}（${use.map((p) => p.f.pd_name).join('、')}）` };
  }
  const noProducts = () => RR.pack && RR.pack.products === false && !RR.rows('product').length;
  G.pl = (r, fx) => { if (noProducts()) return null; const b = prodBase(); const reg = RR.hasRow('pl_rates', RR.val('lb_region')) ? RR.val('lb_region') : '国内のみ'; return lv3((L) => { const rate = RR.c('pl_rates', reg, L), sev = L < 2 ? fx.sev : 1; const x = b.base * rate / 100 * sev; return [x, [b.text, `× 販売地域「${reg}」${rate}%${sev !== 1 ? ' × ' + Math.round(sev * 100) / 100 : ''} ＝ ${M(x)}`]]; }); };
  G.recall = (r, fx) => { if (noProducts()) return null; const b = prodBase(); const use = RR.hasRow('recall_rates', RR.val('lb_consumer')) ? RR.val('lb_consumer') : '業務用'; return lv3((L) => { const rate = RR.c('recall_rates', use, L), sev = L < 2 ? fx.sev : 1; const x = b.base * rate / 100 * sev; return [x, [b.text, `× 最終用途「${use}」${rate}%${sev !== 1 ? ' × ' + Math.round(sev * 100) / 100 : ''} ＝ ${M(x)}`]]; }); };
  G.wc = (r, fx) => { const d = RR.val('hr_danger') === 'なし' ? 'なし' : 'あり'; return lv3((L) => { const a = RR.c('wc_amounts', d, L), sev = L < 2 ? fx.sev : 1; return [a * sev, [`危険を伴う作業「${RR.val('hr_danger') || '未記入（ありと仮定）'}」：政府労災を超える賠償の想定額 ${M(a)}${sev !== 1 ? ' × ' + Math.round(sev * 100) / 100 : ''}`]]; }); };
  function creditFallback(side) {
    let rec = num(RR.val('fn_receivable')); const note = []; if (rec === null) { rec = RR.num('co_revenue') / 6; note.push('売掛金残高が未記入のため、売上高の2か月分と仮定'); }
    if (side === 'dom') { let top = num(RR.val('fn_topcust')); if (top === null) top = Math.max(0, ...RR.rows('partner').filter((p) => p.f.pt_type === '顧客').map((p) => num(p.f.pt_dep) || 0)); if (!(top > 0)) return null; return lv3((L) => { const k = RR.c('credit_rates', '割合', L); const x = rec * top / 100 * k; return [x, ['年間の最大貸倒れ額のヒアリングがないため、仮定で試算', `売掛金 ${M(rec)} × 最大顧客の比率 ${RR.n0(top)}% × 回収不能 ${k} ＝ ${M(x)}`].concat(note)]; }); }
    const ex = num(RR.val('ov_export')); if (!(ex > 0) || RR.val('fn_export_terms') === '海外取引なし') return null;
    return lv3((L) => { const k = RR.c('credit_rates', '割合', L) * 0.5; const x = rec * ex / 100 * k; return [x, ['年間の最大貸倒れ額のヒアリングがないため、仮定で試算', `売掛金 ${M(rec)} × 海外売上比率 ${RR.n0(ex)}% × ${k} ＝ ${M(x)}`].concat(note)]; });
  }
  G.creditH = function (r, fx) {
    const side = r.formula.side; const real = num(RR.val(side === 'dom' ? 'fn_bd_real_dom' : 'fn_bd_real_ovs')), mx = num(RR.val(side === 'dom' ? 'fn_bd_max_dom' : 'fn_bd_max_ovs'));
    if (real === null && mx === null) { const fb = creditFallback(side); if (fb) fb.unconf = ['年間の最大貸倒れ額（ヒアリング）']; return fb; }
    const rr = real === null ? mx * 0.2 : real, mm = mx === null ? rr * 4 : Math.max(mx, rr); const mid = rr > 0 ? Math.sqrt(rr * mm) : mm / 2; const hist = num(RR.val('fn_bd_hist'));
    const who = side === 'dom' ? '国内' : '海外';
    return lv3((L) => { const x = [rr, mid, mm][L]; return [x, [`ヒアリング（${who}）：現実的に起こりうる年間の最大貸倒れ額 ${real === null ? '未記入（最悪の場合の2割と仮定）' : M(real)}、最悪の場合 ${mx === null ? '未記入（現実的な額の4倍と仮定）' : M(mx)}`, `この水準の損害額 ${M(x)}${L === 1 ? '（現実的な額と最悪の場合の中間）' : ''}`].concat(side === 'dom' && hist !== null ? [`参考：過去5年で最も多かった年の貸倒れ ${M(hist)}`] : []).concat(side === 'ovs' && RR.val('fn_export_terms') ? [`決済条件「${RR.val('fn_export_terms')}」`] : [])]; });
  };
  G.dno = (r, fx) => { const o = RR.hasRow('dno_amounts', RR.val('fn_owner')) ? RR.val('fn_owner') : '非上場・外部株主あり'; return lv3((L) => { const a = RR.c('dno_amounts', o, L); return [a, [`株主構成「${o}」：想定額 ${M(a)}`]]; }); };

  /* ---------- 保険の当てはめ（個別保険 → 包括保険の順に積み上げる） ---------- */
  const isUmb = (pt, p) => !!(pt && pt.umbrella);
  const scopeOf = (label) => RR.umbrellaScopes.find((x) => x.label === label) || RR.umbrellaScopes[RR.umbrellaScopes.length - 1] || { domains: [], exclude: [] };
  const inScope = (sc, risk) => ((sc.domains || []).includes(risk.domain) || (sc.include || []).includes(risk.id)) && !(sc.exclude || []).includes(risk.id);
  const active = (p) => !p.f.pol_status || p.f.pol_status === '加入';
  function policiesFor(risk, siteIds) {
    const out = [];
    for (const p of RR.rows('policy')) {
      if (!active(p)) continue;
      const pt = RR.policyTypes.find((t) => t.label === p.f.pol_type); if (!pt) continue;
      const umb = isUmb(pt, p); let covers;
      if (umb) covers = inScope(scopeOf(p.f.pol_scope), risk);
      else covers = pt.covers.includes(risk.id) || (risk.insurance || []).includes(pt.id);
      if (!covers) continue;
      let limit = num(p.f.pol_limit) || 0;
      if (!umb && (pt.floodGated || []).includes(risk.id)) { if (p.f.pol_flood !== 'あり') continue; if (num(p.f.pol_flood_limit) !== null) limit = num(p.f.pol_flood_limit); }
      const tg = String(p.f.pol_sites || '全拠点').trim();
      if (siteIds && siteIds.length && tg !== '全拠点' && tg !== '') { const ids = tg.split(/[,、\s]+/); if (!siteIds.some((s) => ids.includes(s))) continue; }
      out.push({ id: p.id, type: p.f.pol_type, insurer: p.f.pol_insurer || '', limit, ded: num(p.f.pol_ded) || 0, expiry: p.f.pol_expiry || '', umb, group: p.f.pol_group === 'グループで共有', scope: umb ? p.f.pol_scope || '全リスク（地震を除く）' : '' });
    }
    return out;
  }
  RR.policiesFor = policiesFor;
  const uniqPols = (a) => { const seen = {}; return a.filter((p) => (seen[p.id] ? false : (seen[p.id] = 1))); };
  /* 1件の損害を、免責（自己負担）・個別保険・自己負担の帯・包括保険・上限超過に分ける */
  function applyIns(loss, pols, extraLimit) {
    const x = Math.max(0, loss); const lines = []; const seg = { ded: 0, prim: 0, gap: 0, umb: 0, over: 0 };
    let prim = pols.filter((p) => !p.umb).map((p) => Object.assign({}, p)); const umb = pols.filter((p) => p.umb).sort((a, b) => a.ded - b.ded);
    if (extraLimit) { if (prim.length) prim[0].limit += extraLimit; else prim = [{ id: '提案', type: '提案による補償', limit: extraLimit, ded: 0 }]; }
    let cur = 0;
    if (prim.length) {
      const d = prim[0].ded, Ls = prim.reduce((a, p) => a + p.limit, 0);
      seg.ded = Math.min(x, d); seg.prim = Math.max(0, Math.min(x, Ls) - d); cur = Math.max(Ls, d);
      prim.forEach((p, i) => lines.push(`${p.id} ${p.type}：支払限度額 ${M(p.limit)}${i === 0 ? '、免責金額 ' + M(p.ded) : ''}`));
      lines.push(`個別保険の見込み ${M(seg.prim)}（免責 ${M(seg.ded)} は自己負担）`);
    }
    for (const u of umb) {
      const att = Math.max(u.ded, cur); const g = Math.max(0, Math.min(x, att) - cur); seg.gap += g;
      const pay = Math.max(0, Math.min(x - att, u.limit)); seg.umb += pay;
      lines.push(`${u.id} ${u.type}（${u.scope}${u.group ? '・グループで共有' : ''}）：${M(att)}を超えた部分を、支払限度額 ${M(u.limit)} まで → 見込み ${M(pay)}${g > 0 ? `。${prim.length ? '個別保険の限度額から' : ''}包括の免責 ${M(u.ded)} までの ${M(g)} は自己負担` : ''}`);
      cur = att + u.limit;
    }
    seg.over = Math.max(0, x - seg.ded - seg.prim - seg.gap - seg.umb);
    if (seg.over > 0 && (prim.length || umb.length)) lines.push(`支払限度額を超える ${M(seg.over)} は自己負担`);
    const recover = seg.prim + seg.umb;
    return { recover, uninsured: Math.max(0, x - recover), lines, seg };
  }
  RR.applyIns = applyIns;

  /* ---------- 頻度：何年に1度 ⇔ 等級 ---------- */
  function periodToFreq(T) {
    const y = RR.c('freq_years', '境界'); /* [100,30,10,3] */ const pts = [[y[0] * 3, 1], [y[0], 1.5], [y[1], 2.5], [y[2], 3.5], [y[3], 4.5], [Math.max(0.5, y[3] / 3), 5]];
    if (T >= pts[0][0]) return 1; if (T <= pts[pts.length - 1][0]) return 5;
    for (let i = 0; i < pts.length - 1; i++) { const [a, ga] = pts[i], [b, gb] = pts[i + 1]; if (T <= a && T >= b) return ga + ((Math.log(a) - Math.log(T)) / (Math.log(a) - Math.log(b))) * (gb - ga); }
    return 3;
  }
  function freqToPeriod(f) { const r = RR.c('freq_rep_years', '年'); const g = RR.clamp(f, 1, 5); const i = Math.min(3, Math.floor(g - 1)); const t = g - 1 - i; return Math.exp(Math.log(r[i]) * (1 - t) + Math.log(r[i + 1]) * t); }
  RR.periodToFreq = periodToFreq; RR.freqToPeriod = freqToPeriod;
  RR.periodText = (T) => (T >= 1.5 ? `${T >= 10 ? RR.n0(T) : RR.n1(T).replace(/\.0$/, '')}年に1度` : T >= 0.95 ? '毎年' : `年に${RR.n0(1 / T)}回`);

  /* ---------- 全体の計算 ---------- */
  RR.compute = function () {
    if (RR.result) return RR.result;
    const net = RR.num('co_netassets'), retention = RR.num('co_retention');
    const items = []; const siteMap = {};
    const prepRows = RR.rows('prep'); const props = RR.rows('proposal').filter((p) => !['完了', '見送り'].includes(p.f.pr_status));
    const allProps = RR.rows('proposal'); const assumes = RR.rows('assume');
    const W = RR.c('level_weights', '比');
    const findAssume = (risk, siteId, isTarget) => assumes.find((a) => a.f.as_risk === risk.name && siteId && a.f.as_site === siteId) || ((risk.scope !== 'site' || isTarget) ? assumes.find((a) => a.f.as_risk === risk.name && !a.f.as_site) : null);
    function finish(it, risk, raw, rawNoAlt, fx, siteIds, ov) {
      it.id = risk.id; it.domain = risk.domain; it.scope = risk.scope; it.scenario = risk.scenario; it.measures = risk.measures || [];
      it.loss = raw.loss.map((x) => Math.max(0, x)); it.lossA = (rawNoAlt || raw).loss.map((x) => Math.max(0, x)); it.basis = raw.basis.map((b) => b.slice());
      it.calcLoss = it.loss.slice();
      /* 頻度 */
      const base = raw.freq !== null && raw.freq !== undefined ? raw.freq : risk.baseFreq || 2;
      it.freqA = RR.clamp(base + fx.freq, 1, 5);
      it.freqBasis = [raw.freqNote ? raw.freqNote : `基準 ${base}（リスク辞書）`].concat(fx.notes.filter((n) => n.includes('頻度')));
      it.sevNotes = fx.notes.filter((n) => n.includes('損害'));
      /* 担当者の想定（何年に1度、現実的・最大の損害）で上書き */
      it.assume = null;
      if (ov) {
        const f = ov.f, r = num(f.as_real), m = num(f.as_max), T = num(f.as_period);
        it.assume = { rec: ov, T, real: r, max: m, bodily: f.as_bodily || '', ready: f.as_ready || '', owner: f.as_owner || '', actions: f.as_actions || '' };
        if (r !== null || m !== null) {
          let l = it.loss.slice();
          if (r !== null && m !== null) l = [r, r > 0 ? Math.sqrt(r * Math.max(m, r)) : m / 2, Math.max(m, r)];
          else if (r !== null) { l[0] = r; l[1] = Math.max(l[1], r); l[2] = Math.max(l[2], l[1]); }
          else { l[2] = m; l[1] = Math.min(l[1], m); l[0] = Math.min(l[0], l[1]); }
          it.lossA = it.lossA.map((a, i) => (it.loss[i] > 0 ? (a * l[i]) / it.loss[i] : l[i]));
          const note = `担当者の想定（ヒアリング）：${r !== null ? '現実的な損害 ' + M(r) : ''}${r !== null && m !== null ? '、' : ''}${m !== null ? '最大の損害 ' + M(m) : ''}。算式による試算は ${M(it.loss[0])}／${M(it.loss[1])}／${M(it.loss[2])}`;
          it.loss = l; it.basis = it.basis.map((b, i) => [note, `この水準の損害額 ${M(l[i])}`].concat(b.map((x) => '（参考：算式）' + x)));
        }
        if (T !== null && T > 0) { it.freqA = RR.clamp(periodToFreq(T), 1, 5); it.freqBasis = [`担当者の想定：${RR.periodText(T)}程度（等級 ${RR.n1(it.freqA)}）`]; }
      }
      /* 備え */
      const pr = prepRows.find((p) => p.f.prep_risk === risk.name && it.siteId && p.f.prep_site === it.siteId) || prepRows.find((p) => p.f.prep_risk === risk.name && !p.f.prep_site);
      it.prep = pr ? { prevent: RR.lvl(pr.f.prep_prevent), alt: RR.lvl(pr.f.prep_alt), recover: RR.lvl(pr.f.prep_recover), insure: RR.lvl(pr.f.prep_insure), memo: pr.f.prep_memo || '', rec: pr } : { prevent: null, alt: null, recover: null, insure: null, memo: '', rec: null };
      const credit = it.prep.prevent && !(it.assume && it.assume.T) ? RR.c('prevent_credit', String(it.prep.prevent), 0) : 0;
      it.freqB = RR.clamp(it.freqA + credit, 1, 5);
      if (credit) it.freqBasis.push(`予防の段階 ${it.prep.prevent}：${credit}（現状の評価に反映）`);
      it.T = it.assume && it.assume.T ? it.assume.T : freqToPeriod(it.freqB);
      /* 保険 */
      it.policies = uniqPols(policiesFor(risk, siteIds || (it.siteId ? [it.siteId] : null)));
      if (raw.localIns !== undefined) {
        const li = raw.localIns; it.ins = it.loss.map((x) => { const a = applyIns(x * (1 - li), it.policies); a.seg.prim += x * li; a.recover += x * li; a.lines.unshift(`現地の保険で賄える見込み ${RR.n0(li * 100)}%（係数表）：${M(x * li)}`); return a; });
      } else it.ins = it.loss.map((x) => applyIns(x, it.policies));
      it.uninsured = it.ins.map((x) => x.uninsured);
      it.eal = it.loss.reduce((a, x, i) => a + x * W[i], 0) / it.T; it.ealUn = it.uninsured.reduce((a, x, i) => a + x * W[i], 0) / it.T;
      /* 提案 */
      it.proposals = allProps.filter((p) => p.f.pr_risk === risk.name && (!p.f.pr_site || p.f.pr_site === it.siteId || (siteIds || []).includes(p.f.pr_site)));
      const act = it.proposals.filter((p) => props.includes(p));
      let k = 1, df = 0, addLim = 0; act.forEach((p) => { k *= 1 - (num(p.f.pr_eff_loss) || 0) / 100; df += num(p.f.pr_eff_freq) || 0; addLim += num(p.f.pr_eff_limit) || 0; });
      it.lossC = it.loss.map((x) => x * k);
      it.uninsuredC = it.lossC.map((x) => (raw.localIns !== undefined ? applyIns(x * (1 - raw.localIns), it.policies, addLim).uninsured : applyIns(x, it.policies, addLim).uninsured));
      it.freqC = RR.clamp(it.freqB - df, 1, 5);
      it.hasPlan = act.length > 0;
      /* 等級 */
      it.state = (L) => ({
        A: { loss: it.lossA[L], freq: it.freqA, imp: impactScore(it.lossA[L], net) },
        B: { loss: it.uninsured[L], freq: it.freqB, imp: impactScore(it.uninsured[L], net) },
        C: { loss: it.uninsuredC[L], freq: it.freqC, imp: impactScore(it.uninsuredC[L], net) },
      });
      it.grade = (L) => impactScore(it.loss[L], net).g;
      it.freqGrade = freqGrade(it.freqB);
      it.score = (L) => impactScore(it.uninsured[L], net).g * freqGrade(it.freqB);
      it.gap = retention > 0 && it.loss[2] >= retention * RR.c('gap', '損害が自己負担できる額のこの倍率以上', 0) && (it.prep.alt || 1) <= RR.c('gap', '代替手段の段階がこの値以下', 0);
      /* 未確認の入力 */
      it.unconfirmed = (raw.unconf || []).slice();
      for (const q of RR.qs) {
        if (!(q.risks || []).includes(risk.id) && !(q.fx || []).some((f) => f.r === risk.id)) continue;
        const L = RR.layers[q.layer]; if (L.appOnly) continue;
        if (L.kind === 'items') { if (RR.isUnconfirmed(RR.provOf(q))) it.unconfirmed.push(q.label); }
        else {
          let recs = RR.rows(q.layer); const ids = siteIds || (it.siteId ? [it.siteId] : null);
          if (ids && (q.layer === 'site' || L.siteField)) recs = recs.filter((r) => ids.includes(q.layer === 'site' ? r.id : r.f[L.siteField]));
          else if (risk.scope === 'site' || risk.scope === 'accumulation') continue;
          if (recs.some((r) => RR.isUnconfirmed(RR.provOf(q, r)))) it.unconfirmed.push(q.label);
        }
      }
      it.unconfirmed = [...new Set(it.unconfirmed)];
      items.push(it); return it;
    }
    const posOf = (f) => freqPos(f);
    /* 拠点：まず全拠点の試算をそろえ、拠点を指定しない想定は損害が最大の拠点に当てる */
    const siteRisks = RR.risks.filter((r) => r.scope === 'site' && r.id !== 'bi'); const pend = [];
    for (const s of RR.rows('site')) {
      const c = siteCtx(s); siteMap[s.id] = { id: s.id, name: s.f.site_name || s.id, ctx: c, perils: {}, V: c.V };
      for (const risk of siteRisks) {
        const fn = F[risk.formula.type]; const fx = fxFor(risk.id, s.id); let raw;
        if (fn) raw = fn(c, fx); else if (G[risk.formula.type]) raw = G[risk.formula.type](risk, fx); else continue;
        if (!raw || !(raw.loss[2] > 0)) continue;
        if (c.assume.length && (risk.id === 'fire' || risk.id === 'quake' || risk.id === 'wind')) raw.basis = raw.basis.map((b) => b.concat(c.assume));
        pend.push({ s, c, risk, raw, fx });
      }
    }
    const target = {}; for (const e of pend) { const t = target[e.risk.id]; if (!t || e.raw.loss[1] > t.raw.loss[1]) target[e.risk.id] = e; }
    const maxF = {};
    for (const e of pend) {
      const sm = siteMap[e.s.id]; const ov = findAssume(e.risk, e.s.id, target[e.risk.id] === e);
      const it = finish({ key: e.risk.id + ':' + e.s.id, siteId: e.s.id, name: e.risk.name, label: `${e.risk.name}｜${sm.name}`, short: e.risk.name.replace(/（.*）/, '') }, e.risk, e.raw, null, e.fx, null, ov);
      sm.perils[e.risk.id] = it; if (['fire', 'flood', 'quake', 'wind', 'lightning'].includes(e.risk.id)) maxF[e.s.id] = Math.max(maxF[e.s.id] || 1, it.freqA);
    }
    const bi = RR.riskById.bi;
    if (bi) {
      const bp = [];
      for (const sid in siteMap) { const sm = siteMap[sid]; const fx = fxFor('bi', sid); const raw = F.bi(sm.ctx, fx, false), rawA = F.bi(sm.ctx, fx, true); if (raw.loss[2] > 0 || rawA.loss[2] > 0) { raw.freq = maxF[sid] || 1; raw.freqNote = `この拠点の火災・水災・地震・風災・落雷のうち最も高い頻度 ${RR.n1(raw.freq)} を引用`; bp.push({ sm, raw, rawA, fx }); } }
      let tb = null; for (const e of bp) if (!tb || e.raw.loss[1] > tb.raw.loss[1]) tb = e;
      for (const e of bp) e.sm.perils.bi = finish({ key: 'bi:' + e.sm.id, siteId: e.sm.id, name: bi.name, label: `事業中断｜${e.sm.name}`, short: '事業中断' }, bi, e.raw, e.rawA, e.fx, null, findAssume(bi, e.sm.id, e === tb));
    }
    /* 集積 */
    function accum(riskId, field, perilId, labelOf) {
      const risk = RR.riskById[riskId]; if (!risk) return;
      const groups = {};
      for (const sid in siteMap) { const key = String(siteMap[sid].ctx.hz[field] || '').trim(); if (key && siteMap[sid].perils[perilId]) (groups[key] = groups[key] || []).push(siteMap[sid]); }
      for (const key in groups) {
        const ms = groups[key]; if (ms.length < 2) continue;
        const mk = (useA) => { const loss = [0, 0, 0], basis = [[], [], []]; for (let L = 0; L < 3; L++) { for (const m of ms) { const a = useA ? m.perils[perilId].lossA[L] : m.perils[perilId].loss[L], b = m.perils.bi ? (useA ? m.perils.bi.lossA[L] : m.perils.bi.loss[L]) : 0; loss[L] += a + b; basis[L].push(`${m.name}：${RR.riskById[perilId].name} ${M(a)} ＋ 事業中断 ${M(b)}`); } basis[L].push(`合計 ${M(loss[L])}（${ms.length}拠点が同時に被災）`); } return { loss, basis }; };
        const raw = mk(false), rawA = mk(true); raw.freq = Math.min(...ms.map((m) => m.perils[perilId].freqA)); raw.freqNote = `対象拠点の${RR.riskById[perilId].name}の頻度のうち最も低い値`;
        const it = finish({ key: riskId + ':' + key, siteId: null, members: ms.map((m) => m.id), name: risk.name, label: `${labelOf}（${key}・${ms.length}拠点）`, short: `${key} 同時被災` }, risk, raw, rawA, fxFor(riskId, null), ms.map((m) => m.id), findAssume(risk, null, true));
        const peril = RR.riskById[perilId], biR = RR.riskById.bi;
        it.lossC = [0, 1, 2].map((L) => ms.reduce((a, m) => a + m.perils[perilId].lossC[L] + (m.perils.bi ? m.perils.bi.lossC[L] : 0), 0));
        if (it.assume && (it.assume.real !== null || it.assume.max !== null)) it.lossC = it.loss.map((x, L) => x * (raw.loss[L] > 0 ? it.lossC[L] / raw.loss[L] : 1));
        it.proposals = allProps.filter((p) => p.f.pr_risk === risk.name || ((p.f.pr_risk === peril.name || (biR && p.f.pr_risk === biR.name)) && (!p.f.pr_site || it.members.includes(p.f.pr_site))));
        const act = it.proposals.filter((p) => props.includes(p)); it.hasPlan = act.length > 0;
        const extra = act.filter((p) => !p.f.pr_site).reduce((a, p) => a + (num(p.f.pr_eff_limit) || 0), 0);
        /* 水災は利益保険も合算する（原因事故が補償対象である場合）。地震は地震の証券と包括のみ */
        if (riskId === 'acc_flood' && biR) it.policies = uniqPols(it.policies.concat(policiesFor(biR, ms.map((m) => m.id))));
        it.ins = it.loss.map((x) => applyIns(x, it.policies)); it.uninsured = it.ins.map((x) => x.uninsured);
        it.uninsuredC = it.lossC.map((x) => applyIns(x, it.policies, extra).uninsured);
        it.ealUn = it.uninsured.reduce((a, x, i) => a + x * W[i], 0) / it.T;
      }
    }
    accum('acc_flood', 'hz_system', 'flood', '同一水系の同時被災');
    accum('acc_quake', 'hz_quake_src', 'quake', '同一地震の同時被災');
    /* 全社 */
    for (const risk of RR.risks.filter((r) => r.scope === 'company')) {
      const fn = G[risk.formula.type]; if (!fn) continue; const fx = fxFor(risk.id, null);
      const raw = fn(risk, fx, false); const ov = findAssume(risk, null, true);
      if ((!raw || !(raw.loss[2] > 0)) && !(ov && (num(ov.f.as_real) !== null || num(ov.f.as_max) !== null))) continue;
      const r0 = raw && raw.loss[2] > 0 ? raw : { loss: [0, 0, 0], basis: [['算式で試算できる回答がありません'], ['算式で試算できる回答がありません'], ['算式で試算できる回答がありません']], freq: null };
      const rawA = raw && ['supplier', 'cyberStop'].includes(risk.formula.type) ? fn(risk, fx, true) : null;
      finish({ key: risk.id, siteId: null, name: risk.name, label: risk.name + (r0.sub ? `｜${r0.sub}` : ''), short: risk.name }, risk, r0, rawA, fx, null, ov);
    }
    /* 海外 */
    const ovr = RR.riskById.ovs_asset;
    if (ovr && RR.val('ov_has') !== 'なし') for (const o of RR.rows('overseas')) {
      const fx = fxFor('ovs_asset', null); const cr = RR.hasRow('ovs_rates', o.f.ovs_country_risk) ? o.f.ovs_country_risk : '中'; const a = num(o.f.ovs_assets) || 0;
      const raw = lv3((L) => { const r = RR.c('ovs_rates', cr, L), sev = L < 2 ? fx.sev : 1; const x = Math.min(a, a * r * sev); return [x, [`${o.f.ovs_name}（${o.f.ovs_country}）：資産 ${M(a)} × 国のリスク区分「${cr}」${r}${sev !== 1 ? ' × ' + Math.round(sev * 100) / 100 : ''} ＝ ${M(x)}`]]; });
      if (!(raw.loss[2] > 0)) continue;
      raw.localIns = RR.hasRow('ovs_ins', o.f.ovs_local_ins) ? RR.c('ovs_ins', o.f.ovs_local_ins, 0) : 0;
      const it = finish({ key: 'ovs_asset:' + o.id, siteId: null, ovsId: o.id, name: ovr.name, label: `${ovr.name}｜${o.f.ovs_name}`, short: ovr.name }, ovr, raw, null, fx);
      it.unconfirmed = RR.qsOf('overseas').filter((q) => (q.risks || []).includes('ovs_asset') && RR.isUnconfirmed(RR.provOf(q, o))).map((q) => q.label);
    }
    const L = RR.case.settings.level;
    items.sort((a, b) => b.uninsured[L] - a.uninsured[L] || b.loss[L] - a.loss[L]);
    items.forEach((it, i) => (it.rank = i + 1));
    /* 総合マップに載せる代表（拠点系は種類ごとに最大の拠点） */
    const headline = []; const seen = {};
    for (const it of items) { if (it.scope === 'site') { if (seen[it.id]) continue; seen[it.id] = 1; } headline.push(it); }
    const gaps = items.filter((it) => it.gap); const gapsHead = headline.filter((it) => it.gap);
    const totalAssets = Object.values(siteMap).reduce((a, s) => a + s.V, 0);
    /* 確認方法の内訳 */
    const conf = { 現地: 0, 資料: 0, 聞き取り: 0, 未確認: 0, 未記入: 0 }; const unconfList = [];
    for (const q of RR.qs) {
      if (q.type === 'id' || RR.layers[q.layer].appOnly) continue;
      const push = (p, who) => { if (p.empty) { conf.未記入++; if (q.req) unconfList.push({ q, who, why: '未記入' }); } else { conf[p.method] = (conf[p.method] || 0) + 1; if (p.method === '未確認') unconfList.push({ q, who, why: '未確認' }); } };
      if (RR.layers[q.layer].kind === 'items') push(RR.provOf(q), '全社');
      else for (const r of RR.rows(q.layer)) push(RR.provOf(q, r), r.f[RR.layers[q.layer].nameField] || r.id);
    }
    RR.result = { items, headline, siteMap, gaps, gapsHead, net, retention, totalAssets, conf, unconfList, level: L, posOf };
    return RR.result;
  };
  RR.freqPos = freqPos; RR.freqGrade = freqGrade;

  /* ---------- 3つの整理：リスク把握・包括保険・個別保険 ---------- */
  RR.three = function () {
    const R = RR.compute(), L = R.level; const out = {};
    const pols = RR.rows('policy').map((p) => { const pt = RR.policyTypes.find((t) => t.label === p.f.pol_type); return { rec: p, pt, umb: isUmb(pt, p), active: active(p) }; });
    out.risk = { count: R.items.length, head: R.headline.length, top: R.items.slice(0, 3), totalLoss: R.headline.reduce((a, i) => a + i.loss[L], 0), totalUn: R.headline.reduce((a, i) => a + i.uninsured[L], 0), eal: R.headline.reduce((a, i) => a + i.eal, 0), ealUn: R.headline.reduce((a, i) => a + i.ealUn, 0) };
    out.umbrella = pols.filter((x) => x.umb).map((x) => {
      const p = x.rec; const covered = R.headline.filter((i) => i.policies.some((q) => q.id === p.id));
      const pay = covered.reduce((a, i) => a + i.ins[L].seg.umb, 0); const gapSum = covered.reduce((a, i) => a + i.ins[L].seg.gap, 0);
      return { rec: p, active: x.active, limit: num(p.f.pol_limit) || 0, ded: num(p.f.pol_ded) || 0, scope: p.f.pol_scope || '全リスク（地震を除く）', group: p.f.pol_group === 'グループで共有', premium: num(p.f.pol_premium), covered, pay, gapSum, reached: covered.filter((i) => i.ins[L].seg.umb > 0) };
    });
    out.indiv = pols.filter((x) => !x.umb);
    out.joined = out.indiv.filter((x) => x.active); out.notJoined = out.indiv.filter((x) => !x.active);
    out.premium = pols.filter((x) => x.active).reduce((a, x) => a + (num(x.rec.f.pol_premium) || 0), 0);
    out.uncovered = R.headline.filter((i) => !i.policies.length && i.loss[L] > 0);
    out.gapBand = R.headline.filter((i) => i.ins[L].seg.gap > 0);
    out.overLimit = R.headline.filter((i) => i.ins[L].seg.over > 0 && i.policies.length);
    out.retained = R.headline.reduce((a, i) => a + i.ins[L].seg.ded + i.ins[L].seg.gap, 0);
    return out;
  };

  /* ---------- 免責の見直し：保険料と自己負担の比較 ---------- */
  function discount(ded, limit) { if (!(limit > 0)) return 0; const r = (ded / limit) * 100; const keys = Object.keys(RR.coef.ded_discount.rows); const th = [0.01, 0.05, 0.2, 1, 5, 10]; let i = 0; while (i < th.length && r >= th[i]) i++; return RR.c('ded_discount', keys[i], 0) / 100; }
  RR.dedSim = function () {
    const R = RR.compute(); const W = RR.c('level_weights', '比'); const out = [];
    for (const p of RR.rows('policy')) {
      if (!active(p)) continue; const pt = RR.policyTypes.find((t) => t.label === p.f.pol_type); const umb = isUmb(pt, p);
      const limit = num(p.f.pol_limit) || 0; const ded0 = num(p.f.pol_ded) || 0; const prem0 = num(p.f.pol_premium);
      const opts = RR.rows('dedopt').filter((o) => String(o.f.do_pol || '').trim() === p.id);
      if (!opts.length) continue;
      const its = R.headline.filter((i) => i.policies.some((q) => q.id === p.id));
      const n = num(p.f.pol_small_n) || 0, avg = num(p.f.pol_small_avg) || 0;
      const retained = (ded) => {
        let small = umb ? 0 : n * Math.min(avg, ded); let big = 0;
        for (const it of its) for (let L = 0; L < 3; L++) {
          const x = it.loss[L]; const pf = W[L] / it.T;
          if (umb) { const prim = it.policies.filter((q) => !q.umb); const Ls = prim.reduce((a, q) => a + q.limit, 0); const d0 = prim.length ? Math.max(Ls, prim[0].ded) : 0; big += pf * Math.max(0, Math.min(x, Math.max(ded, d0)) - d0); }
          else big += pf * Math.min(x, ded);
        }
        return { small, big, total: small + big };
      };
      const mk = (label, ded, quote, note, rec) => {
        const est = quote === null || quote === undefined; let prem = est ? (prem0 !== null ? (prem0 * (1 - discount(ded, limit))) / (1 - discount(ded0, limit)) : null) : quote;
        const r = retained(ded); const maxRet = umb ? ded : ded + (its.some((i) => i.ins[2].seg.gap > 0) ? 0 : 0);
        return { label, ded, prem, est: est && ded !== ded0, ret: r, total: prem === null ? null : prem + r.total, maxRet, ok: !(R.retention > 0) || maxRet <= R.retention, note: note || '', rec };
      };
      const base = mk('現状', ded0, prem0, '現在の契約');
      const rows = [base].concat(opts.map((o) => mk(`案 ${o.id}`, num(o.f.do_ded) || 0, num(o.f.do_premium), o.f.do_note, o)));
      rows.forEach((r) => { r.saving = base.prem !== null && r.prem !== null ? base.prem - r.prem : null; r.retInc = r.ret.total - base.ret.total; r.netGain = r.saving === null ? null : r.saving - r.retInc; });
      const best = rows.slice(1).filter((r) => r.ok && r.netGain !== null && r.netGain > 0).sort((a, b) => b.netGain - a.netGain)[0] || null;
      out.push({ pol: p, type: p.f.pol_type, umb, limit, smallN: n, smallAvg: avg, risks: its, rows, best });
    }
    return out;
  };

  /* ---------- サイバー対策の到達度 ---------- */
  RR.cyberScore = function () {
    const v = (id) => RR.val(id); const sys = RR.rows('system');
    const offline = sys.length ? sys.some((s) => s.f.sys_backup === '隔離保管・復元訓練済') && !sys.some((s) => s.f.sys_backup === 'なし') : v('cy_offline') === '隔離保管・復元訓練済';
    const items = [
      ['多要素認証を全社で導入', v('cy_mfa') === '全社', v('cy_mfa')],
      ['更新プログラムを定期的に適用', v('cy_patch') === '定期', v('cy_patch')],
      ['侵入の検知と監視', v('cy_edr') === '導入・監視あり', v('cy_edr')],
      ['不審メール訓練', v('cy_training') === '実施', v('cy_training')],
      ['事故対応の手順と訓練', v('cy_ir') === 'あり・訓練済', v('cy_ir')],
      ['外部からの接続（VPN等）の管理', v('cy_remote') === '管理している', v('cy_remote')],
      ['委託先のセキュリティ確認', v('cy_vendor') === '実施', v('cy_vendor')],
      ['バックアップの隔離保管と復元訓練', offline, sys.length ? sys.map((s) => s.f.sys_backup || '未記入').join('／') : v('cy_offline')],
      ['工場・設備の制御ネットワークの分離', ['分離している', '該当なし'].includes(v('cy_ot')), v('cy_ot')],
    ].map(([label, ok, ans]) => ({ label, ok: !!ok, ans: ans === undefined || ans === '' ? '未回答' : ans }));
    const ins = RR.rows('policy').some((p) => active(p) && p.f.pol_type === 'サイバー') ? 'あり' : RR.rows('policy').some((p) => active(p) && isUmb(RR.policyTypes.find((t) => t.label === p.f.pol_type), p) && inScope(scopeOf(p.f.pol_scope), RR.riskById.cyber_stop || { domain: 'cyber', id: 'cyber_stop' })) ? '包括で一部' : 'なし';
    return { items, done: items.filter((x) => x.ok).length, total: items.length, ins };
  };


  /* 結論の一文 */
  RR.headlineText = function () {
    const R = RR.compute(); const L = R.level; const top = R.items[0];
    if (!top) return { main: 'データを入力すると、ここに結論が表示されます。', sub: '' };
    const ratio = R.net > 0 ? (top.uninsured[L] / R.net) * 100 : null;
    const main = `最も重いのは「${top.label.replace('｜', '・')}」。保険で賄えない額は${RR.money(top.uninsured[L])}${ratio !== null ? `、純資産の${ratio >= 10 ? RR.n0(ratio) : RR.n1(ratio)}%` : ''}です。`;
    const over = R.items.filter((i) => R.retention > 0 && i.uninsured[L] > R.retention).length;
    const sub = `評価したリスク ${R.items.length}件のうち、自己負担できる額（${RR.money(R.retention)}）を超えるものが ${over}件、備えの空白（損害が大きいのに代替手段がないリスク）が ${R.gapsHead.length}種類あります。`;
    return { main, sub, top, ratio, over };
  };
  /* 提案の候補を回答から起こす */
  RR.suggestProposals = function () {
    const R = RR.compute(); const out = []; const L = R.level;
    const have = new Set(RR.rows('proposal').map((p) => p.f.pr_risk + '|' + (p.f.pr_site || '') + '|' + p.f.pr_title));
    for (const it of R.items.slice(0, 40)) {
      if (!it.measures.length) continue; if (!(it.gap || it.uninsured[L] > R.retention * 0.5 || it.freqB >= 3.5)) continue;
      const m = it.measures[it.gap ? Math.min(it.measures.length - 1, it.domain === 'bi' ? 0 : it.measures.length - 1) : 0];
      const key = it.name + '|' + (it.siteId || '') + '|' + m; if (have.has(key)) continue; have.add(key);
      out.push({ pr_site: it.siteId || '', pr_risk: it.name, pr_title: m, pr_detail: `${it.label.replace('｜', '・')}：${RR.levelShort[L]}の損害 ${RR.money(it.loss[L])}、保険で賄えない額 ${RR.money(it.uninsured[L])}。${it.gap ? '代替手段が未整備のため、備えの空白に該当。' : ''}`, pr_priority: it.gap || it.uninsured[L] > R.retention ? 'A' : 'B', pr_status: '未着手' });
    }
    return out;
  };
})();
