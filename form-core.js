/* ============================================================================
 * form-core.js — 职业测评核心纯函数（v1.24.0 抽出，便于单测与复用）
 * 同时服务：浏览器（挂到 window/global 供内联脚本调用）与 Node（module.exports 供单测）。
 * 纯函数、无 DOM 依赖；可视化用 vanilla SVG，离线可用。
 * ==========================================================================*/
(function (global) {
  'use strict';

  // 维度顺序常量（与表单题库一致）
  const HOLLAND_ORDER = ['R', 'I', 'A', 'S', 'E', 'C'];
  const BF_ORDER = ['O', 'C', 'E', 'A', 'N'];
  const JUNG_ORDER = ['Ti', 'Te', 'Fi', 'Fe', 'Ni', 'Ne', 'Si', 'Se'];
  const AISUB_ORDER = ['暴露度', '适应力', '人力资本'];
  const FORM_VERSION = '1.25';

  // ---------- 基础工具 ----------
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }
  function hbar(v, max) {
    const pct = Math.max(2, Math.min(100, Math.round((v / max) * 100)));
    return '<div class="rbar"><span style="width:' + pct + '%"></span></div>';
  }
  function hollandCode(sums) {
    return HOLLAND_ORDER.slice()
      .sort((a, b) => (sums[b] || 0) - (sums[a] || 0))
      .slice(0, 3).join('');
  }

  // ---------- 序列化：结构化状态 -> 分数串（与 node-1b 解析契约严格对应）----------
  // raw = { holland, values, constraints, jungRaw, jungAnswered,
  //         bfRaw, bfAnswered, aisubRaw, asubAnswered,
  //         marketOn, prioAns, scenAns, stageVal, resumeVal }
  function buildScoreString(raw) {
    raw = raw || {};
    const h = 'HOLLAND: ' + HOLLAND_ORDER.map(k => k + ':' + (raw.holland ? (raw.holland[k] || 0) : 0)).join(';');
    const v = 'VALUES: ' + (raw.values || []).map(x => x.r + '=' + x.name).join(';');
    const cp = Object.keys(raw.constraints || {}).filter(k => raw.constraints[k])
      .map(k => k + '=' + raw.constraints[k]);
    const c = 'CONSTRAINTS: ' + (cp.length ? cp.join(';') : '（未填）');
    const blocks = [h, v, c];
    if (raw.jungAnswered > 0 && raw.jungRaw) {
      blocks.push('JUNG: ' + JUNG_ORDER.map(k => k + ':' + (raw.jungRaw[k] || []).join(',')).join('; '));
    }
    if (raw.bfAnswered > 0 && raw.bfRaw) {
      blocks.push('BIGFIVE: ' + BF_ORDER.map(k => k + ':' + (raw.bfRaw[k] || 0)).join(';'));
    }
    if (raw.asubAnswered > 0 && raw.asubRaw) {
      blocks.push('AISUB: ' + AISUB_ORDER.map(k => k + ':' + (raw.asubRaw[k] || 0)).join(';'));
    }
    if (raw.marketOn) blocks.push('MARKET: 是');
    if (raw.prioAns && raw.prioAns.length) blocks.push('PRIO: ' + raw.prioAns.join('; '));
    if (raw.scenAns && raw.scenAns.length) blocks.push('SCENARIO: ' + raw.scenAns.join('; '));
    if (raw.stageVal) blocks.push('STAGE: ' + raw.stageVal);
    if (raw.resumeVal) blocks.push('RESUME: ' + raw.resumeVal);
    return 'v' + FORM_VERSION + '\n' + blocks.join('\n');
  }

  // ---------- 反序列化：分数串 -> 结构化（供单测做 round-trip；与 node-1b 等价）----------
  function parseContract(str) {
    let version = '';
    let resume_text = '';
    const ri = (str || '').indexOf('RESUME:');
    if (ri >= 0) { resume_text = str.slice(ri + 7).trim(); str = str.slice(0, ri); }
    const out = { version: '', holland: {}, values: [], constraints: {}, jung: {}, bigfive: {}, aisub: {}, market: false, prio: [], scenario: [], stage: '', resume_text };
    str.split('\n').map(s => s.trim()).filter(Boolean).forEach(line => {
      const vm = line.match(/^v(\d+\.\d+)$/);
      if (vm) { out.version = vm[1]; return; }
      if (line.startsWith('HOLLAND:')) {
        line.slice(8).split(';').forEach(p => { const i = p.indexOf(':'); if (i > 0) { const k = p.slice(0, i).trim(); const n = Number(p.slice(i + 1)); if (!isNaN(n)) out.holland[k] = n; } });
      } else if (line.startsWith('VALUES:')) {
        line.slice(7).trim().split(';').forEach(p => { const i = p.indexOf('='); if (i > 0) out.values.push({ r: Number(p.slice(0, i)), name: p.slice(i + 1).trim() }); });
      } else if (line.startsWith('CONSTRAINTS:')) {
        line.slice(12).trim().split(';').forEach(p => { if (p === '（未填）') return; const i = p.indexOf('='); if (i > 0) out.constraints[p.slice(0, i).trim()] = p.slice(i + 1).trim(); });
      } else if (line.startsWith('JUNG:')) {
        line.slice(5).split(';').forEach(b => { const i = b.indexOf(':'); if (i > 0) { const nm = b.slice(0, i).trim(); const arr = b.slice(i + 1).split(',').map(Number); if (arr.length === 4 && arr.every(n => !isNaN(n))) out.jung[nm] = arr.reduce((a, b) => a + b, 0); } });
      } else if (line.startsWith('BIGFIVE:')) {
        line.slice(8).split(';').forEach(p => { const i = p.indexOf(':'); if (i > 0) { const k = p.slice(0, i).trim(); const n = Number(p.slice(i + 1)); if (!isNaN(n)) out.bigfive[k] = n; } });
      } else if (line.startsWith('AISUB:')) {
        line.slice(6).split(';').forEach(p => { const i = p.indexOf(':'); if (i > 0) { const k = p.slice(0, i).trim(); const n = Number(p.slice(i + 1)); if (!isNaN(n)) out.aisub[k] = n; } });
      } else if (line.startsWith('MARKET:')) { out.market = true;
      } else if (line.startsWith('PRIO:')) { out.prio = line.slice(5).trim().split(';').map(s => s.trim());
      } else if (line.startsWith('SCENARIO:')) { out.scenario = line.slice(9).trim().split(';').map(s => s.trim());
      } else if (line.startsWith('STAGE:')) { out.stage = line.slice(6).trim(); }
    });
    return out;
  }

  // ---------- 资源查表（轻量、离线安全；完整版见 resources.json）----------
  const RESOURCE_MAP = {
    R: [{ t: '动手与机械基础', u: 'https://www.icourse163.org/ (搜索：机械/电子制作)' }, { t: '项目：拆装+复原一件设备', u: '' }],
    I: [{ t: '数据分析入门(吴恩达/李宏毅)', u: 'https://www.coursera.org/' }, { t: '项目：用公开数据集回答一个问题', u: '' }],
    A: [{ t: '作品集搭建(Behance/Dribbble)', u: 'https://www.behance.net/' }, { t: '项目：完成一件可展示的创作', u: '' }],
    S: [{ t: '倾听与陪伴技巧(助人技术)', u: 'https://www.icourse163.org/' }, { t: '项目：做一次志愿/朋辈辅导', u: '' }],
    E: [{ t: '从 0 到 1 做一件小生意/活动', u: '' }, { t: '表达说服：TED 演讲拆解', u: 'https://www.ted.com/' }],
    C: [{ t: 'Excel/SQL 数据整理实战', u: 'https://www.icourse163.org/' }, { t: '项目：把一份混乱台账理顺', u: '' }]
  };
  function resourceCardsFor(code) {
    const cards = [];
    (code || '').split('').forEach(k => {
      (RESOURCE_MAP[k] || []).forEach(r => cards.push({ dim: k, t: r.t, u: r.u }));
    });
    return cards;
  }

  // ---------- SVG 可视化 ----------
  function hexPoints(cx, cy, r) {
    // RIASEC 约定顺序：R 顶，顺时针 I,A,S,E,C
    return HOLLAND_ORDER.map((k, i) => {
      const ang = (-90 + i * 60) * Math.PI / 180;
      return { k, x: cx + r * Math.cos(ang), y: cy + r * Math.sin(ang) };
    });
  }
  function hollandHexagonSVG(sums) {
    const cx = 160, cy = 130, r = 92;
    const pts = hexPoints(cx, cy, r);
    const poly = pts.map(p => p.x.toFixed(1) + ',' + p.y.toFixed(1)).join(' ');
    let bars = '', labels = '';
    pts.forEach(p => {
      const v = sums[p.k] || 0; const f = Math.max(0, Math.min(1, v / 20));
      const bx = cx + (p.x - cx) * f, by = cy + (p.y - cy) * f;
      bars += '<line x1="' + cx + '" y1="' + cy + '" x2="' + bx.toFixed(1) + '" y2="' + by.toFixed(1) + '" stroke="#6c5ce7" stroke-width="4" stroke-linecap="round"/>';
      labels += '<text x="' + (cx + (p.x - cx) * 1.16).toFixed(1) + '" y="' + (cy + (p.y - cy) * 1.16 + 4).toFixed(1) + '" font-size="12" fill="#4834d4" font-weight="600" text-anchor="middle">' + p.k + ' ' + v + '</text>';
    });
    return '<svg viewBox="0 0 320 260" width="100%" style="max-width:340px;height:auto" role="img" aria-label="Holland 兴趣六边形">'
      + '<polygon points="' + poly + '" fill="none" stroke="#dcdcff" stroke-width="2"/>'
      + bars + labels + '</svg>';
  }
  function bigfiveRadarSVG(sums) {
    const cx = 160, cy = 130, r = 92;
    const pts = BF_ORDER.map((k, i) => {
      const ang = (-90 + i * 72) * Math.PI / 180;
      return { k, x: cx + r * Math.cos(ang), y: cy + r * Math.sin(ang) };
    });
    const poly = pts.map(p => p.x.toFixed(1) + ',' + p.y.toFixed(1)).join(' ');
    let shape = '', labels = '';
    pts.forEach(p => {
      const v = sums[p.k] || 0; const f = Math.max(0, Math.min(1, v / 20));
      const sx = cx + (p.x - cx) * f, sy = cy + (p.y - cy) * f;
      shape += (shape ? ' ' : '') + sx.toFixed(1) + ',' + sy.toFixed(1);
      labels += '<text x="' + (cx + (p.x - cx) * 1.18).toFixed(1) + '" y="' + (cy + (p.y - cy) * 1.18 + 4).toFixed(1) + '" font-size="12" fill="#0f6e56" font-weight="600" text-anchor="middle">' + p.k + ' ' + v + '</text>';
    });
    return '<svg viewBox="0 0 320 260" width="100%" style="max-width:340px;height:auto" role="img" aria-label="大五人格雷达">'
      + '<polygon points="' + poly + '" fill="none" stroke="#bfe1cb" stroke-width="2"/>'
      + '<polygon points="' + shape + '" fill="rgba(31,158,117,.25)" stroke="#1d9e75" stroke-width="3"/>'
      + labels + '</svg>';
  }

  // ---------- 报告 HTML（自包含，随副本离线打开；增加 SVG 与打印样式）----------
  function buildReportHTML(a) {
    const now = new Date().toLocaleString('zh-CN');
    const resumeNote = a.resumeText ? '<p class="note">已提供经历 / 简历（' + a.resumeText.length + ' 字），将在对话中作为实证融入画像。</p>' : '';
    const stageNote = a.stage ? '<p class="note">当前阶段：' + esc(a.stage) + '（报告语气已据此校准）。</p>' : '';
    const hRows = HOLLAND_ORDER.map(k => { const v = (a.holland && a.holland[k]) || 0; return '<tr><td>' + k + ' · ' + esc((a.hollandName && a.hollandName[k]) || k) + '</td><td>' + v + '/20</td><td>' + hbar(v, 20) + '</td></tr>'; }).join('');
    const vRows = a.values && a.values.length ? a.values.map(x => '<li>' + x.r + '. ' + esc(x.name) + '</li>').join('') : '<li>（未排序）</li>';
    const cRows = Object.keys(a.constraints || {}).filter(k => a.constraints[k]).map(k => '<tr><td>' + esc(k) + '</td><td>' + esc(a.constraints[k]) + '</td></tr>').join('');
    let depth = '';
    if (a.jungAnswered > 0 && a.jung) {
      const order = JUNG_ORDER.slice().sort((x, y) => (a.jung[y] || 0) - (a.jung[x] || 0));
      const rows = order.map(f => '<tr><td>' + esc((a.jungName && a.jungName[f]) || f) + '</td><td>' + (a.jung[f] || 0) + '/20</td><td>' + hbar(a.jung[f] || 0, 20) + '</td></tr>').join('');
      depth += '<h3>深度层 · 荣格八维（' + a.jungAnswered + '/32）</h3><table class="dt">' + rows + '</table>';
    }
    if (a.bfAnswered > 0 && a.bigfive) {
      const rows = BF_ORDER.map(d => '<tr><td>' + esc((a.bfName && a.bfName[d]) || d) + '</td><td>' + (a.bigfive[d] || 0) + '/20</td><td>' + hbar(a.bigfive[d] || 0, 20) + '</td></tr>').join('');
      depth += '<h3>深度层 · 大五人格（' + a.bfAnswered + '/20）</h3><table class="dt">' + rows + '</table>';
    }
    if (a.asubAnswered > 0 && a.aisub) {
      const rows = AISUB_ORDER.map(d => '<tr><td>' + esc((a.asubName && a.asubName[d]) || d) + '</td><td>' + (a.aisub[d] || 0) + '/15</td><td>' + hbar(a.aisub[d] || 0, 15) + '</td></tr>').join('');
      depth += '<h3>深度层 · AI 适应力（' + a.asubAnswered + '/9）</h3><table class="dt">' + rows + '</table>';
    }
    if (a.marketOn) depth += '<p class="note">已开启「实时市场数据」：在对话中联网获取岗位供需 / 薪资趋势。</p>';
    // 资源卡（按兴趣码查表）
    const cards = resourceCardsFor(a.hollandCode);
    const resHTML = cards.length ? '<div class="rescards">' + cards.map(c =>
      '<div class="rescard"><span class="rd">' + c.dim + '</span>' + esc(c.t) +
      (c.u ? ' <a href="' + esc(c.u) + '" target="_blank" rel="noopener">↗</a>' : '') + '</div>').join('') + '</div>' : '';
    const svgSec = '<div class="viz">' + hollandHexagonSVG(a.holland || {}) + (a.bfAnswered > 0 ? bigfiveRadarSVG(a.bigfive || {}) : '') + '</div>';
    // 封面 + 分节导航锚点（按实际渲染顺序构建目录）
    const code = a.hollandCode || (a.holland ? hollandCode(a.holland) : '');
    const CN = ['', '一', '二', '三', '四', '五', '六', '七', '八'];
    let si = 1;
    const navItems = [
      { id: 'sec-interest', label: '兴趣剖面' },
      { id: 'sec-values', label: '价值观排序' },
      { id: 'sec-constraints', label: '约束条件' }
    ];
    const idDepth = depth ? 'sec-depth' : null;
    const idRes = resHTML ? 'sec-resources' : null;
    if (idDepth) navItems.push({ id: idDepth, label: '深度层' });
    if (idRes) navItems.push({ id: idRes, label: '下一步资源' });
    navItems.push({ id: 'sec-raw', label: '原始分数串' });
    navItems.push({ id: 'sec-decl', label: '声明' });
    const navHTML = '<nav class="report-nav" aria-label="报告目录"><span class="nav-title">目录</span><div class="nav-links">'
      + navItems.map(it => '<a href="#' + it.id + '">' + it.label + '</a>').join('')
      + '<a href="#top" class="nav-top">顶部 ↑</a></div></nav>';
    return '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><title>职业测评自报告</title><style>'
      + 'body{font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif;max-width:800px;margin:32px auto;padding:0 20px;color:#1f2933;line-height:1.7;background:#fbfbfd;-webkit-font-smoothing:antialiased}'
      + 'html{scroll-behavior:smooth}'
      + 'h1{font-size:25px;font-weight:700;letter-spacing:-.01em;border-bottom:3px solid #6c5ce7;padding-bottom:10px;margin:0 0 6px}'
      + 'h2{font-size:18px;font-weight:600;margin:32px 0 10px;color:#4834d4;padding-left:11px;border-left:4px solid #6c5ce7;scroll-margin-top:72px}'
      + 'h3{font-size:15px;font-weight:600;margin:22px 0 8px;color:#6c5ce7}'
      + 'table{width:100%;border-collapse:separate;border-spacing:0;margin:10px 0;font-size:14px;background:#fff;border:1px solid #e8eaed;border-radius:10px;overflow:hidden}'
      + 'th{background:#f4f5fb;color:#3d444d;font-weight:600;text-align:left;padding:9px 11px;border-bottom:1px solid #e8eaed}'
      + 'td{border-bottom:1px solid #eef0f3;padding:8px 11px;text-align:left} tbody tr:last-child td{border-bottom:none}'
      + '.rbar{background:#eceef2;border-radius:7px;height:11px;width:180px;overflow:hidden} .rbar span{display:block;height:100%;background:linear-gradient(90deg,#6c5ce7,#a29bfe)}'
      + '.raw{background:#f6f7fb;border:1px solid #e4e7eb;border-radius:10px;padding:14px;white-space:pre-wrap;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px;word-break:break-all;color:#374151}'
      + '.code{font-size:22px;font-weight:700;color:#6c5ce7;letter-spacing:4px}'
      + '.note{font-size:13px;line-height:1.6;color:#7a5b15;background:#fff8e6;border-left:3px solid #f0a020;padding:9px 12px;border-radius:6px}'
      + '.decl{font-size:13px;line-height:1.65;color:#4b5563;background:#f3f4ff;border:1px solid #dcdcff;border-radius:10px;padding:14px 16px;margin-top:24px}'
      + '.viz{display:flex;gap:22px;flex-wrap:wrap;justify-content:center;margin:14px 0;padding:14px;background:#fff;border:1px solid #e8eaed;border-radius:12px}'
      + '.rescards{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:12px;margin:12px 0}'
      + '.rescard{background:#f1f8f4;border:1px solid #bfe1cb;border-radius:12px;padding:12px 14px;font-size:13px;line-height:1.6;color:#0f5132}'
      + '.rescard .rd{display:inline-block;background:#0f6e56;color:#fff;border-radius:6px;padding:2px 8px;font-size:11px;margin-right:7px;font-weight:600}'
      + '.rescard a{color:#0f6e56;font-weight:600}'
      + 'ol{margin:8px 0;padding-left:22px} li{margin:4px 0} ul{margin:6px 0;padding-left:22px} li{margin:3px 0} .meta{color:#6b7280;font-size:13px}'
      + '.report-cover{position:relative;background:linear-gradient(135deg,#6c5ce7,#4834d4);color:#fff;border-radius:18px;padding:30px 32px;margin:0 0 16px;box-shadow:0 14px 34px rgba(72,52,212,.20);overflow:hidden}'
      + '.report-cover::after{content:"";position:absolute;right:-46px;top:-46px;width:170px;height:170px;border-radius:50%;background:rgba(255,255,255,.08)}'
      + '.cover-kicker{font-size:12px;letter-spacing:.2em;text-transform:uppercase;opacity:.85;margin-bottom:8px}'
      + '.report-cover h1{color:#fff;border:none;padding:0;margin:0 0 16px;font-size:27px;letter-spacing:-.01em}'
      + '.cover-code{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap}'
      + '.cover-code-label{font-size:12px;opacity:.85}'
      + '.cover-code-val{font-size:38px;font-weight:800;letter-spacing:.18em;line-height:1;font-variant-numeric:tabular-nums}'
      + '.cover-sub{margin:14px 0 0;font-size:13.5px;line-height:1.6;opacity:.92;max-width:48ch}'
      + '.cover-foot{display:flex;flex-wrap:wrap;gap:10px 16px;align-items:center;margin-top:16px;font-size:12.5px}'
      + '.cover-time{opacity:.85}'
      + '.cover-local{background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.30);border-radius:999px;padding:3px 11px;font-weight:600}'
      + '.report-nav{position:sticky;top:0;z-index:5;display:flex;align-items:center;gap:12px;background:rgba(251,251,253,.92);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);border:1px solid #eceef2;border-radius:12px;padding:9px 12px;margin:0 0 18px}'
      + '.nav-title{font-size:12px;font-weight:700;color:#6b7280;letter-spacing:.05em;flex:none}'
      + '.nav-links{display:flex;gap:6px;overflow-x:auto;scrollbar-width:thin}'
      + '.report-nav a{display:inline-block;white-space:nowrap;text-decoration:none;color:#4b5563;font-size:13px;padding:5px 11px;border-radius:999px;transition:background .18s ease,color .18s ease}'
      + '.report-nav a:hover{background:#eef0fb;color:#4834d4}'
      + '.report-nav a.nav-top{margin-left:auto;color:#6c5ce7;font-weight:600}'
      + ':focus-visible{outline:2px solid #6c5ce7;outline-offset:2px}'
      + '.rescard{transition:transform .2s ease,box-shadow .2s ease} .rescard:hover{transform:translateY(-2px);box-shadow:0 6px 18px rgba(31,158,117,.18)}'
      + '.viz line{stroke-dasharray:240;stroke-dashoffset:240;animation:draw 1s ease forwards} @keyframes draw{to{stroke-dashoffset:0}}'
      + '@media (prefers-reduced-motion: reduce){*{animation:none!important;transition:none!important}.viz line{stroke-dashoffset:0}html{scroll-behavior:auto}}'
      + '@media print{body{max-width:none;margin:0;background:#fff}.decl,.note{break-inside:avoid}.viz{break-inside:avoid}.report-nav{display:none}.report-cover{-webkit-print-color-adjust:exact;print-color-adjust:exact;box-shadow:none}.cover-sub,.cover-time,.cover-local{color:#fff!important}}'
      + '</style></head><body id="top">'
      + '<header class="report-cover">'
      + '<div class="cover-kicker">职业测评 · 自报告</div>'
      + '<h1>你的职业画像</h1>'
      + '<div class="cover-code"><span class="cover-code-label">Holland 兴趣代码</span><span class="cover-code-val">' + esc(code) + '</span></div>'
      + '<p class="cover-sub">基于多源三角验证（兴趣 + 价值观 + 约束 + 可选深度层）生成，供你与规划师共同探索。这不是算命，而是一份可复核的探索线索。</p>'
      + '<div class="cover-foot"><span class="cover-time">生成时间：' + esc(now) + '</span><span class="cover-local">🔒 本地生成 · 数据不上传</span></div>'
      + '</header>'
      + navHTML
      + '<h2 id="sec-interest">' + CN[si++] + '、兴趣剖面 Holland　<span class="code">' + esc(code) + '</span></h2>'
      + svgSec
      + '<table class="dt"><tr><th>维度</th><th>得分</th><th>分布</th></tr>' + hRows + '</table>'
      + '<h2 id="sec-values">' + CN[si++] + '、职业价值观排序（Top ' + (a.values ? a.values.length : 0) + '）</h2><ol>' + vRows + '</ol>'
      + '<h2 id="sec-constraints">' + CN[si++] + '、约束与现实条件</h2><table><tr><th>字段</th><th>内容</th></tr>' + cRows + '</table>' + resumeNote + stageNote
      + (depth ? '<h2 id="' + idDepth + '">' + CN[si++] + '、深度层（可选）</h2>' + depth : '')
      + (resHTML ? '<h2 id="' + idRes + '">' + CN[si++] + '、下一步资源（按兴趣码）</h2>' + resHTML : '')
      + '<h2 id="sec-raw">' + CN[si++] + '、原始分数串（可贴回对话复核）</h2>'
      + '<div class="raw">' + esc(a.raw) + '</div>'
      + '<div class="decl" id="sec-decl"><b>声明：</b>本结果仅基于你的自评输入，用于辅助自我觉察与探索，不具备临床诊断或招聘决策效力。任何维度分数都不应给一个人"贴标签"——人是动态的，兴趣、能力与适应力都可通过行动改变。重大职业决策请结合自身实情、行业信息与必要时的专业咨询。</div>'
      + '</body></html>';
  }

  // ---------- 暴露 ----------
  const API = {
    FORM_VERSION, HOLLAND_ORDER, BF_ORDER, JUNG_ORDER, AISUB_ORDER,
    esc, hbar, hollandCode, buildScoreString, parseContract,
    RESOURCE_MAP, resourceCardsFor, hollandHexagonSVG, bigfiveRadarSVG, buildReportHTML
  };
  // 浏览器：挂全局，内联脚本可直接调用
  Object.keys(API).forEach(k => { global[k] = API[k]; });
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
