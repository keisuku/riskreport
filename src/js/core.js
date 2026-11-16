/* core: 定義の読み込み、案件データの保持、書式 */
const RR = (window.RR = { v: '1.0.0' });
(function () {
  const LS = {
    get(k) { try { const s = localStorage.getItem(k); return s ? JSON.parse(s) : null; } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
    del(k) { try { localStorage.removeItem(k); } catch (e) {} },
  };
  RR.LS = LS;
  const DEF_NAMES = ['questions', 'risks', 'coefficients', 'industries', 'chapters'];
  RR.DEF_NAMES = DEF_NAMES;
  RR.DEF_LABELS = { questions: '質問マスタ', risks: 'リスク辞書', coefficients: '係数表', industries: '業種パック', chapters: 'レポートの章定義' };
  RR.raw = {}; RR.builtin = {};

  RR.loadDefs = function () {
    for (const n of DEF_NAMES) {
      const el = document.getElementById('def-' + n);
      RR.builtin[n] = JSON.parse(el.textContent);
      const ov = LS.get('rr.def.' + n);
      RR.raw[n] = ov && ov.version ? ov : JSON.parse(el.textContent);
    }
    RR.rebuild();
  };
  RR.saveDef = function (name, obj) { RR.raw[name] = obj; LS.set('rr.def.' + name, obj); RR.rebuild(); };
  RR.resetDef = function (name) { LS.del('rr.def.' + name); RR.raw[name] = JSON.parse(JSON.stringify(RR.builtin[name])); RR.rebuild(); };
  RR.defIsCustom = (name) => !!LS.get('rr.def.' + name);

  /* 業種パックを重ねて、実際に使う定義を組み立てる */
  RR.rebuild = function () {
    const Q = RR.raw.questions, R = RR.raw.risks, I = RR.raw.industries;
    const ind = RR.case ? (RR.case.items.co_industry || {}).v : null;
    const pack = I.packs.find((p) => p.id === ind) || { id: ind, terms: {}, questions: [], risks: [] };
    RR.pack = pack;
    RR.layers = Q.layers;
    RR.sheets = Q.sheets;
    RR.methods = Q.methods;
    RR.prepLevels = Q.prepLevels;
    RR.qs = Q.questions.concat((pack.questions || []).map((q) => Object.assign({ pack: pack.id }, q)));
    RR.qById = {}; RR.qs.forEach((q) => (RR.qById[q.id] = q));
    RR.risks = R.risks.concat((pack.risks || []).map((r) => Object.assign({ pack: pack.id }, r)));
    RR.riskById = {}; RR.risks.forEach((r) => (RR.riskById[r.id] = r));
    RR.domains = R.domains; RR.domainById = {}; R.domains.forEach((d, i) => { d.i = i; RR.domainById[d.id] = d; });
    RR.policyTypes = R.policyTypes; RR.perils = R.perils;
    RR.coef = {}; RR.raw.coefficients.tables.forEach((t) => (RR.coef[t.id] = t));
    RR.levelNames = RR.raw.coefficients.levelNames; RR.levelShort = RR.raw.coefficients.levelShort;
    RR.chapters = RR.raw.chapters;
  };
  RR.qsOf = (layer) => RR.qs.filter((q) => q.layer === layer);
  RR.t = function (s) { const tm = (RR.pack && RR.pack.terms) || {}; let o = String(s); for (const k in tm) o = o.split(k).join(tm[k]); return o; };
  RR.optsOf = function (q) {
    const o = q.opts;
    if (!o) return null;
    if (Array.isArray(o)) return o;
    if (o === '@industries') return RR.raw.industries.packs.map((p) => p.id);
    if (o === '@policyTypes') return RR.policyTypes.map((p) => p.label);
    if (o === '@riskNames') return RR.risks.map((r) => r.name);
    if (o === '@prepLevels') return RR.prepLevels;
    return null;
  };
  /* 係数の取り出し */
  RR.c = function (table, row, col) {
    const t = RR.coef[table]; if (!t) return 0;
    const keys = Object.keys(t.rows);
    const r = t.rows[row] !== undefined ? t.rows[row] : t.rows[keys[0]];
    if (col === undefined) return r;
    return r[col] !== undefined ? r[col] : 0;
  };
  RR.hasRow = (table, row) => !!(RR.coef[table] && RR.coef[table].rows[row] !== undefined);

  /* ---------- 案件データ ---------- */
  RR.emptyCase = function () {
    const rows = {}; for (const l in RR.raw.questions.layers) if (RR.raw.questions.layers[l].kind === 'table') rows[l] = [];
    return { meta: { format: 'riskreport-case', version: 1, updated: new Date().toISOString(), isSample: false }, items: {}, rows, ai: {}, settings: { mask: false, level: 1 } };
  };
  RR.setCase = function (c, opts) {
    const e = RR.emptyCase();
    c.rows = Object.assign(e.rows, c.rows || {}); c.items = c.items || {}; c.ai = c.ai || {}; c.settings = Object.assign(e.settings, c.settings || {}); c.meta = Object.assign(e.meta, c.meta || {});
    RR.case = c; RR.rebuild(); RR.result = null;
    if (!opts || opts.save !== false) RR.saveCase();
  };
  RR.saveCase = function () { RR.case.meta.updated = new Date().toISOString(); RR.saved = LS.set('rr.case', RR.case); };
  RR.touch = function () { RR.result = null; RR.saveCase(); };
  RR.val = (qid) => { const it = RR.case.items[qid]; return it ? it.v : undefined; };
  RR.num = (qid) => { const v = Number(RR.val(qid)); return isFinite(v) ? v : 0; };
  RR.setItem = function (qid, v, prov) {
    const it = RR.case.items[qid] || (RR.case.items[qid] = { v: '', src: '', date: '', method: '未確認', note: '' });
    it.v = v; if (prov) Object.assign(it, prov); RR.touch();
  };
  RR.rows = (layer) => RR.case.rows[layer] || (RR.case.rows[layer] = []);
  RR.rowsOfSite = (layer, siteId) => { const sf = RR.layers[layer].siteField; return RR.rows(layer).filter((r) => r.f[sf] === siteId); };
  RR.newId = function (layer) {
    const p = RR.layers[layer].prefix; let n = RR.rows(layer).length + 1; const ids = new Set(RR.rows(layer).map((r) => r.id));
    while (ids.has(p + String(n).padStart(2, '0'))) n++;
    return p + String(n).padStart(2, '0');
  };
  RR.addRow = function (layer, f, prov) {
    const L = RR.layers[layer]; const id = (f && f[L.idField]) || RR.newId(layer);
    const rec = { id, f: Object.assign({}, f, { [L.idField]: id }), prov: prov || { row: { src: '', date: '', method: '未確認' } }, note: '' };
    RR.rows(layer).push(rec); return rec;
  };
  RR.site = (id) => RR.rows('site').find((s) => s.id === id);
  RR.siteName = (id) => { const s = RR.site(id); return s ? s.f.site_name || id : id || ''; };
  RR.companyName = function (masked) {
    const n = RR.val('co_name') || '（会社名未記入）';
    return (masked === undefined ? RR.case.settings.mask : masked) ? '【対象企業】' : n;
  };
  /* 値の確認状況：{empty, method, src, date} */
  RR.provOf = function (q, rec) {
    if (RR.layers[q.layer].kind === 'items') {
      const it = RR.case.items[q.id] || {};
      return { empty: it.v === undefined || it.v === '' || it.v === null, method: it.method || '未確認', src: it.src || '', date: it.date || '', note: it.note || '' };
    }
    const v = rec ? rec.f[q.id] : undefined; const p = (rec && rec.prov && (rec.prov[q.pg || 'row'] || rec.prov.row)) || {};
    return { empty: v === undefined || v === '' || v === null, method: p.method || '未確認', src: p.src || '', date: p.date || '', note: (rec && rec.note) || '' };
  };
  RR.isUnconfirmed = (p) => p.empty || p.method === '未確認';

  /* ---------- 書式 ---------- */
  const nf0 = new Intl.NumberFormat('ja-JP', { maximumFractionDigits: 0 });
  const nf1 = new Intl.NumberFormat('ja-JP', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  RR.n0 = (x) => nf0.format(x); RR.n1 = (x) => nf1.format(x);
  /* 金額（百万円単位の数値）→ 表示 */
  RR.money = function (m) {
    if (m === null || m === undefined || isNaN(m)) return '—';
    const a = Math.abs(m);
    if (a >= 1000) return nf0.format(m / 100) + '億円';
    if (a >= 100) return nf1.format(m / 100) + '億円';
    if (a >= 1) return nf0.format(m) + '百万円';
    if (a > 0) return nf0.format(m * 100) + '万円';
    return '0円';
  };
  RR.moneyParts = function (m) {
    const s = RR.money(m); const k = s.match(/^([\-0-9.,—]+)(.*)$/); return k ? [k[1], k[2]] : [s, ''];
  };
  RR.pct = (x, d) => (x === null || x === undefined || isNaN(x) ? '—' : (d ? nf1.format(x) : nf0.format(x)) + '%');
  RR.fmtVal = function (q, v) {
    if (v === undefined || v === null || v === '') return '';
    if (q.type === 'money') return RR.money(Number(v));
    if (q.type === 'pct') return v + '%';
    if (q.type === 'num') return String(v) + (q.unit ? q.unit : '');
    if (q.type === 'image') return v ? '写真あり' : '';
    return String(v);
  };
  RR.unitOf = (q) => (q.type === 'money' ? '百万円' : q.type === 'pct' ? '%' : q.unit || '');
  RR.esc = (s) => String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  RR.today = () => new Date().toISOString().slice(0, 10);
  RR.lvl = (s) => { const n = parseInt(s, 10); return n >= 1 && n <= 4 ? n : null; };
  RR.clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  RR.el = function (tag, attrs, html) { const e = document.createElement(tag); if (attrs) for (const k in attrs) { if (k === 'class') e.className = attrs[k]; else e.setAttribute(k, attrs[k]); } if (html !== undefined) e.innerHTML = html; return e; };
  RR.download = function (blob, name) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
  };
  RR.toast = function (msg) {
    let t = document.getElementById('toast'); if (!t) { t = RR.el('div', { id: 'toast', role: 'status' }); document.body.appendChild(t); }
    t.textContent = msg; t.classList.add('on'); clearTimeout(RR._tt); RR._tt = setTimeout(() => t.classList.remove('on'), 2600);
  };
})();
