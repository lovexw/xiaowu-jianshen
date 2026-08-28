/**
 * 小吴乐意-健身打卡
 * Cloudflare Workers + KV
 * 记录日期:2025-08-21 ~ 2027-04-01
 * 项目:游泳、跑步机、力量训练
 */

// ===== 配置 =====
const APP_PASSWORD = 'xw'; // 登录密码,部署后可改
const START_DATE = '2025-08-21';
const END_DATE = '2027-04-01';
const EXERCISES = [
  { id: 'swim', name: '游泳', icon: '🏊', color: '#0ea5e9' },
  { id: 'treadmill', name: '跑步机', icon: '🏃', color: '#f97316' },
  { id: 'strength', name: '力量训练', icon: '🏋️', color: '#8b5cf6' },
];

// ===== 工具函数 =====
function getCORS() {
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: getCORS() });
}

// 日期格式化 YYYY-MM-DD
function formatDate(d) {
  const dt = d instanceof Date ? d : new Date(d);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

// 获取今天的日期字符串(基于本地时区 UTC+8)
function getTodayShanghai() {
  const now = new Date();
  const shanghai = new Date(now.getTime() + 8 * 3600 * 1000);
  return formatDate(shanghai);
}

// 生成日期范围内所有日期
function generateDateRange(start, end) {
  const dates = [];
  const s = new Date(start);
  const e = new Date(end);
  while (s <= e) {
    dates.push(formatDate(s));
    s.setDate(s.getDate() + 1);
  }
  return dates;
}

// JWT-like 简单 token
function makeToken() {
  const payload = { exp: Date.now() + 7 * 24 * 3600 * 1000 };
  return btoa(JSON.stringify(payload));
}

function verifyToken(token) {
  try {
    const payload = JSON.parse(atob(token));
    return payload.exp > Date.now();
  } catch {
    return false;
  }
}

// ===== KV 数据结构 =====
// key: checkin:YYYY-MM-DD
// value: { date, exercises: [{ id, duration }], ts }

// ===== API 路由 =====
async function handleAPI(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  if (method === 'OPTIONS') {
    return new Response(null, { headers: getCORS() });
  }

  // 登录
  if (path === '/api/login' && method === 'POST') {
    const body = await request.json();
    if (body.password === APP_PASSWORD) {
      return json({ ok: true, token: makeToken() });
    }
    return json({ ok: false, error: '密码错误' }, 401);
  }

  // 以下接口需要认证
  const auth = request.headers.get('Authorization');
  const token = auth ? auth.replace('Bearer ', '') : null;
  if (!token || !verifyToken(token)) {
    return json({ ok: false, error: '未登录' }, 401);
  }

  // 获取所有打卡数据
  if (path === '/api/checkins' && method === 'GET') {
    const list = await env.CHECKIN_KV.list({ prefix: 'checkin:' });
    const items = [];
    for (const key of list.keys) {
      const val = await env.CHECKIN_KV.get(key.name, 'json');
      if (val) items.push(val);
    }
    return json({ ok: true, data: items });
  }

  // 提交/更新打卡
  if (path === '/api/checkin' && method === 'POST') {
    const body = await request.json();
    const date = body.date || getTodayShanghai();
    const exercises = body.exercises || [];

    const record = {
      date,
      exercises,
      ts: Date.now(),
    };

    await env.CHECKIN_KV.put(`checkin:${date}`, JSON.stringify(record));
    return json({ ok: true, data: record });
  }

  // 获取单日打卡
  if (path === '/api/checkin' && method === 'GET') {
    const date = url.searchParams.get('date') || getTodayShanghai();
    const val = await env.CHECKIN_KV.get(`checkin:${date}`, 'json');
    return json({ ok: true, data: val || null });
  }

  // 删除打卡
  if (path === '/api/checkin' && method === 'DELETE') {
    const date = url.searchParams.get('date') || getTodayShanghai();
    await env.CHECKIN_KV.delete(`checkin:${date}`);
    return json({ ok: true });
  }

  return json({ ok: false, error: 'Not found' }, 404);
}

// ===== HTML 页面 =====
function getHTML() {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>小吴乐意 · 健身打卡</title>
<style>
:root {
  --bg: #f8fafc;
  --card: #ffffff;
  --text: #1e293b;
  --text-light: #64748b;
  --border: #e2e8f0;
  --primary: #6366f1;
  --primary-light: #818cf8;
  --primary-bg: #eef2ff;
  --success: #10b981;
  --warning: #f59e0b;
  --danger: #ef4444;
  --shadow: 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);
  --shadow-md: 0 4px 6px -1px rgba(0,0,0,0.07), 0 2px 4px -2px rgba(0,0,0,0.05);
  --shadow-lg: 0 10px 15px -3px rgba(0,0,0,0.08), 0 4px 6px -4px rgba(0,0,0,0.05);
  --radius: 16px;
  --radius-sm: 10px;
}

* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
  background: var(--bg);
  color: var(--text);
  min-height: 100vh;
  -webkit-font-smoothing: antialiased;
}

/* ===== 登录页 ===== */
.login-wrap {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #ec4899 100%);
  padding: 20px;
}
.login-card {
  background: var(--card);
  border-radius: 24px;
  padding: 48px 40px;
  width: 100%;
  max-width: 400px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.15);
  text-align: center;
}
.login-card h1 {
  font-size: 28px;
  font-weight: 800;
  margin-bottom: 8px;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
.login-card p {
  color: var(--text-light);
  font-size: 14px;
  margin-bottom: 32px;
}
.login-card input {
  width: 100%;
  padding: 14px 18px;
  border: 2px solid var(--border);
  border-radius: var(--radius-sm);
  font-size: 16px;
  outline: none;
  transition: border-color .2s;
  margin-bottom: 16px;
}
.login-card input:focus { border-color: var(--primary); }
.login-card button {
  width: 100%;
  padding: 14px;
  border: none;
  border-radius: var(--radius-sm);
  background: var(--primary);
  color: #fff;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all .2s;
}
.login-card button:hover { background: var(--primary-light); transform: translateY(-1px); }
.login-card button:active { transform: translateY(0); }
.login-error {
  color: var(--danger);
  font-size: 13px;
  margin-top: 12px;
  display: none;
}

/* ===== 主应用 ===== */
.app { display: none; max-width: 900px; margin: 0 auto; padding: 24px 20px 60px; }

.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 28px;
}
.app-header h1 {
  font-size: 24px;
  font-weight: 800;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
.app-header .date-label {
  color: var(--text-light);
  font-size: 14px;
  font-weight: 500;
}
.logout-btn {
  background: none;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 6px 14px;
  font-size: 13px;
  color: var(--text-light);
  cursor: pointer;
  transition: all .2s;
}
.logout-btn:hover { border-color: var(--danger); color: var(--danger); }

/* ===== 今日打卡卡片 ===== */
.today-card {
  background: var(--card);
  border-radius: var(--radius);
  padding: 28px;
  box-shadow: var(--shadow);
  margin-bottom: 24px;
}
.today-card h2 {
  font-size: 18px;
  font-weight: 700;
  margin-bottom: 4px;
}
.today-card .subtitle {
  color: var(--text-light);
  font-size: 13px;
  margin-bottom: 24px;
}

.exercise-list { display: flex; flex-direction: column; gap: 14px; }
.exercise-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 20px;
  border-radius: var(--radius-sm);
  border: 2px solid var(--border);
  cursor: pointer;
  transition: all .2s;
  background: var(--card);
}
.exercise-item:hover { border-color: var(--primary-light); box-shadow: var(--shadow-md); }
.exercise-item.active {
  border-color: var(--primary);
  background: var(--primary-bg);
}
.exercise-item .ex-info { display: flex; align-items: center; gap: 14px; }
.exercise-item .ex-icon {
  width: 44px; height: 44px;
  border-radius: 12px;
  display: flex; align-items: center; justify-content: center;
  font-size: 22px;
}
.exercise-item .ex-name { font-size: 16px; font-weight: 600; }

.duration-picker {
  display: none;
  align-items: center;
  gap: 6px;
}
.duration-picker.show { display: flex; }
.duration-btn {
  padding: 6px 12px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--card);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all .15s;
  color: var(--text);
}
.duration-btn:hover { border-color: var(--primary); }
.duration-btn.selected {
  background: var(--primary);
  color: #fff;
  border-color: var(--primary);
}

.save-bar {
  margin-top: 24px;
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}
.save-btn {
  padding: 12px 32px;
  border: none;
  border-radius: var(--radius-sm);
  background: var(--primary);
  color: #fff;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all .2s;
}
.save-btn:hover { background: var(--primary-light); }
.save-btn:disabled { opacity: .5; cursor: not-allowed; }

/* ===== 仪表盘 ===== */
.dashboard {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-bottom: 24px;
}
.stat-card {
  background: var(--card);
  border-radius: var(--radius);
  padding: 20px;
  box-shadow: var(--shadow);
  text-align: center;
}
.stat-card .stat-value {
  font-size: 28px;
  font-weight: 800;
  margin-bottom: 4px;
}
.stat-card .stat-label {
  font-size: 12px;
  color: var(--text-light);
  font-weight: 500;
}
.stat-card .stat-icon {
  font-size: 20px;
  margin-bottom: 8px;
}

/* ===== 项目统计 ===== */
.exercise-stats {
  background: var(--card);
  border-radius: var(--radius);
  padding: 24px;
  box-shadow: var(--shadow);
  margin-bottom: 24px;
}
.exercise-stats h3 {
  font-size: 16px;
  font-weight: 700;
  margin-bottom: 16px;
}
.ex-stat-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}
.ex-stat-row:last-child { margin-bottom: 0; }
.ex-stat-label {
  width: 80px;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 500;
  flex-shrink: 0;
}
.ex-stat-bar-bg {
  flex: 1;
  height: 24px;
  background: #f1f5f9;
  border-radius: 12px;
  overflow: hidden;
  position: relative;
}
.ex-stat-bar-fill {
  height: 100%;
  border-radius: 12px;
  transition: width .6s cubic-bezier(.4,0,.2,1);
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding-right: 10px;
  font-size: 12px;
  font-weight: 600;
  color: #fff;
  min-width: 36px;
}
.ex-stat-count {
  width: 50px;
  text-align: right;
  font-size: 13px;
  color: var(--text-light);
  flex-shrink: 0;
}

/* ===== 热力图 ===== */
.heatmap-section {
  background: var(--card);
  border-radius: var(--radius);
  padding: 24px;
  box-shadow: var(--shadow);
  margin-bottom: 24px;
}
.heatmap-section h3 {
  font-size: 16px;
  font-weight: 700;
  margin-bottom: 4px;
}
.heatmap-section .heatmap-subtitle {
  font-size: 12px;
  color: var(--text-light);
  margin-bottom: 20px;
}
.heatmap-container {
  display: flex;
  gap: 6px;
}
.heatmap-weekdays {
  display: grid;
  grid-template-rows: repeat(7, 13px);
  gap: 3px;
  flex-shrink: 0;
  padding-top: 18px;
}
.heatmap-weekday-label {
  font-size: 9px;
  color: var(--text-light);\
line-height: 13px;
  text-align: right;
  width: 20px;
  height: 13px;
}
.heatmap-main {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  flex: 1;
}
.heatmap-months-row {
  display: grid;
  grid-auto-flow: column;
  grid-template-rows: 14px;
  margin-bottom: 4px;
  position: relative;
}
.heatmap-month-label {
  font-size: 10px;
  color: var(--text-light);
  font-weight: 500;
  white-space: nowrap;
}
.heatmap-grid {
  display: grid;
  grid-template-rows: repeat(7, 1fr);
  grid-auto-flow: column;
  gap: 3px;
  width: max-content;
}
.heatmap-cell {
  width: 13px;
  height: 13px;
  border-radius: 3px;
  background: #e2e8f0;
  transition: transform .1s;
  cursor: pointer;
  position: relative;
}
.heatmap-cell:hover { transform: scale(1.5); z-index: 10; }
.heatmap-cell.l1 { background: #c7d2fe; }
.heatmap-cell.l2 { background: #818cf8; }
.heatmap-cell.l3 { background: #6366f1; }
.heatmap-cell.l4 { background: #4f46e5; }
.heatmap-cell.empty { background: transparent; cursor: default; }
.heatmap-cell.empty:hover { transform: none; }
.heatmap-cell.future { background: #f8fafc; cursor: default; }
.heatmap-cell.future:hover { transform: none; }

.heatmap-tooltip {
  position: absolute;
  bottom: calc(100% + 4px);
  left: 50%;
  transform: translateX(-50%);
  background: #1e293b;
  color: #fff;
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 11px;
  white-space: nowrap;
  pointer-events: none;
  opacity: 0;
  transition: opacity .15s;
  z-index: 20;
}
.heatmap-cell:hover .heatmap-tooltip { opacity: 1; }

.heatmap-legend {
  display: flex;
  align-items: center;
  gap: 6px;
  justify-content: flex-end;
  margin-top: 12px;
  font-size: 11px;
  color: var(--text-light);
}
.heatmap-legend .heatmap-cell { width: 11px; height: 11px; cursor: default; }
.heatmap-legend .heatmap-cell:hover { transform: none; }

/* ===== 日历视图 ===== */
.calendar-section {
  background: var(--card);
  border-radius: var(--radius);
  padding: 24px;
  box-shadow: var(--shadow);
}
.calendar-section h3 {
  font-size: 16px;
  font-weight: 700;
  margin-bottom: 16px;
}

/* ===== Toast =====
.toast {
  position: fixed;
  bottom: 30px;
  left: 50%;
  transform: translateX(-50%) translateY(100px);
  background: #1e293b;
  color: #fff;
  padding: 12px 24px;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 500;
  box-shadow: var(--shadow-lg);
  transition: transform .3s cubic-bezier(.4,0,.2,1);
  z-index: 1000;
  pointer-events: none;
}
.toast.show { transform: translateX(-50%) translateY(0); }
.toast.success { background: var(--success); }
.toast.error { background: var(--danger); }

/* ===== 响应式 ===== */
@media (max-width: 640px) {
  .dashboard { grid-template-columns: 1fr 1fr; }
  .stat-card { padding: 16px; }
  .stat-card .stat-value { font-size: 22px; }
  .today-card { padding: 20px; }
  .exercise-item { padding: 14px 16px; }
  .app { padding: 16px 12px 48px; }
  .heatmap-cell { width: 11px; height: 11px; }
}

/* ===== 动画 ===== */
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
.app { animation: fadeIn .3s ease; }
.today-card, .dashboard .stat-card, .exercise-stats, .heatmap-section, .calendar-section {
  animation: fadeIn .4s ease backwards;
}
.dashboard .stat-card:nth-child(1) { animation-delay: .05s; }
.dashboard .stat-card:nth-child(2) { animation-delay: .1s; }
.dashboard .stat-card:nth-child(3) { animation-delay: .15s; }
.exercise-stats { animation-delay: .2s; }
.heatmap-section { animation-delay: .25s; }

/* 加载动画 */
.loader {
  display: inline-block;
  width: 18px; height: 18px;
  border: 2px solid var(--border);
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: spin .6s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* 进度环 */
.progress-ring {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 0;
}
.progress-ring svg { flex-shrink: 0; }
.progress-ring-info { font-size: 13px; color: var(--text-light); }
.progress-ring-info strong { color: var(--text); font-size: 16px; }
</style>
</head>
<body>

<!-- 登录页 -->
<div class="login-wrap" id="loginPage">
  <div class="login-card">
    <div style="font-size:48px;margin-bottom:12px">💪</div>
    <h1>健身打卡</h1>
    <p>小吴乐意 · 坚持就是胜利</p>
    <input type="password" id="passwordInput" placeholder="输入密码" onkeydown="if(event.key==='Enter')doLogin()">
    <button onclick="doLogin()">进入</button>
    <div class="login-error" id="loginError">密码错误,请重试</div>
  </div>
</div>

<!-- 主应用 -->
<div class="app" id="app">
  <div class="app-header">
    <div>
      <h1>💪 健身打卡</h1>
      <div class="date-label" id="todayLabel"></div>
    </div>
    <button class="logout-btn" onclick="doLogout()">退出</button>
  </div>

  <!-- 今日打卡 -->
  <div class="today-card">
    <h2>今日打卡</h2>
    <p class="subtitle">选择运动项目并记录时长,0.5小时为一个节点</p>
    <div class="exercise-list" id="exerciseList"></div>
    <div class="save-bar">
      <button class="save-btn" id="saveBtn" onclick="saveCheckin()">保存打卡</button>
    </div>
  </div>

  <!-- 仪表盘 -->
  <div class="dashboard" id="dashboard"></div>

  <!-- 项目统计 -->
  <div class="exercise-stats">
    <h3>📊 项目统计</h3>
    <div id="exerciseStats"></div>
  </div>

  <!-- 热力图 -->
  <div class="heatmap-section">
    <h3>🔥 打卡热力图</h3>
    <p class="heatmap-subtitle">2025-08-21 ~ 2027-04-01 · 每个格子代表一天</p>
    <div class="heatmap-container">
      <div class="heatmap-weekdays" id="heatmapWeekdays"></div>
      <div class="heatmap-main">
        <div class="heatmap-months-row" id="heatmapMonthsRow"></div>
        <div class="heatmap-grid" id="heatmapGrid"></div>
      </div>
    </div>
    <div class="heatmap-legend">
      <span>少</span>
      <div class="heatmap-cell"></div>
      <div class="heatmap-cell l1"></div>
      <div class="heatmap-cell l2"></div>
      <div class="heatmap-cell l3"></div>
      <div class="heatmap-cell l4"></div>
      <span>多</span>
    </div>
  </div>

  <!-- 连续打卡进度 -->
  <div class="calendar-section">
    <h3>🎯 打卡进度</h3>
    <div id="progressInfo"></div>
  </div>
</div>

<!-- Toast -->
<div class="toast" id="toast"></div>

<script>
// ===== 配置 =====
const EXERCISES = ${JSON.stringify(EXERCISES)};
const START_DATE = '${START_DATE}';
const END_DATE = '${END_DATE}';
const DURATIONS = [0.5, 1, 1.5, 2, 2.5, 3];

// ===== 状态 =====
let token = localStorage.getItem('fit_token') || '';
let allCheckins = [];
let todayCheckin = {};
let todayStr = '';

// ===== 工具函数 =====
function getTodayStr() {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const shanghai = new Date(utc + 8 * 3600000);
  const y = shanghai.getFullYear();
  const m = String(shanghai.getMonth() + 1).padStart(2, '0');
  const d = String(shanghai.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + d;
}

function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show ' + type;
  setTimeout(() => t.className = 'toast', 2500);
}

async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  const res = await fetch(path, { ...options, headers });
  const data = await res.json();
  if (!res.ok && data.error === '未登录') {
    doLogout();
  }
  return data;
}

// ===== 登录 =====
async function doLogin() {
  const pwd = document.getElementById('passwordInput').value;
  const err = document.getElementById('loginError');
  if (!pwd) { err.style.display = 'block'; return; }

  const data = await api('/api/login', {
    method: 'POST',
    body: JSON.stringify({ password: pwd }),
  });

  if (data.ok) {
    token = data.token;
    localStorage.setItem('fit_token', token);
    err.style.display = 'none';
    showApp();
  } else {
    err.style.display = 'block';
    document.getElementById('passwordInput').value = '';
  }
}

function doLogout() {
  token = '';
  localStorage.removeItem('fit_token');
  document.getElementById('loginPage').style.display = 'flex';
  document.getElementById('app').style.display = 'none';
}

// ===== 主应用 =====
async function showApp() {
  document.getElementById('loginPage').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  
  todayStr = getTodayStr();
  document.getElementById('todayLabel').textContent = '今天是 ' + todayStr;
  
  await loadCheckins();
  renderExerciseList();
  renderDashboard();
  renderExerciseStats();
  renderHeatmap();
  renderProgress();
}

async function loadCheckins() {
  const data = await api('/api/checkins');
  if (data.ok) {
    allCheckins = data.data;
  }
  // 加载今日记录
  const todayData = await api('/api/checkin?date=' + todayStr);
  if (todayData.ok && todayData.data) {
    todayCheckin = {};
    (todayData.data.exercises || []).forEach(ex => {
      todayCheckin[ex.id] = ex.duration;
    });
  } else {
    todayCheckin = {};
  }
}

// 渲染运动项目列表
function renderExerciseList() {
  const list = document.getElementById('exerciseList');
  list.innerHTML = EXERCISES.map(ex => {
    const isActive = todayCheckin[ex.id] !== undefined;
    const selectedDur = todayCheckin[ex.id];
    return \`
      <div class="exercise-item \${isActive ? 'active' : ''}" data-ex="\${ex.id}" onclick="toggleExercise('\${ex.id}')">
        <div class="ex-info">
          <div class="ex-icon" style="background:\${ex.color}22">\${ex.icon}</div>
          <div class="ex-name">\${ex.name}</div>
        </div>
        <div class="duration-picker \${isActive ? 'show' : ''}" id="dur-\${ex.id}" onclick="event.stopPropagation()">
          \${DURATIONS.map(d => \`
            <button class="duration-btn \${selectedDur === d ? 'selected' : ''}" data-dur="\${d}" onclick="selectDuration('\${ex.id}', \${d})">\${d}h</button>
          \`).join('')}
        </div>
      </div>
    \`;
  }).join('');
}

function toggleExercise(id) {
  if (todayCheckin[id] !== undefined) {
    delete todayCheckin[id];
  } else {
    todayCheckin[id] = 0.5;
  }
  renderExerciseList();
}

function selectDuration(id, dur) {
  todayCheckin[id] = dur;
  renderExerciseList();
}

// 保存打卡
async function saveCheckin() {
  const exercises = Object.entries(todayCheckin).map(([id, duration]) => ({ id, duration }));
  if (exercises.length === 0) {
    showToast('请至少选择一个运动项目', 'error');
    return;
  }

  const btn = document.getElementById('saveBtn');
  btn.disabled = true;
  btn.textContent = '保存中...';

  const data = await api('/api/checkin', {
    method: 'POST',
    body: JSON.stringify({ date: todayStr, exercises }),
  });

  btn.disabled = false;
  btn.textContent = '保存打卡';

  if (data.ok) {
    showToast('打卡成功!💪', 'success');
    await loadCheckins();
    renderDashboard();
    renderExerciseStats();
    renderHeatmap();
    renderProgress();
  } else {
    showToast('保存失败,请重试', 'error');
  }
}

// ===== 仪表盘 =====
function renderDashboard() {
  const total = allCheckins.length;
  const totalHours = allCheckins.reduce((sum, c) => {
    return sum + (c.exercises || []).reduce((s, e) => s + e.duration, 0);
  }, 0);

  // 连续打卡天数
  const checkinDates = new Set(allCheckins.map(c => c.date));
  let streak = 0;
  let d = new Date(todayStr);
  while (checkinDates.has(formatDate(d))) {
    streak++;
    d.setDate(d.getDate() - 1);
  }

  const html = \`
    <div class="stat-card">
      <div class="stat-icon">📅</div>
      <div class="stat-value">\${total}</div>
      <div class="stat-label">累计打卡天数</div>
    </div>
    <div class="stat-card">
      <div class="stat-icon">⏱️</div>
      <div class="stat-value">\${totalHours.toFixed(1)}h</div>
      <div class="stat-label">累计运动时长</div>
    </div>
    <div class="stat-card">
      <div class="stat-icon">🔥</div>
      <div class="stat-value">\${streak}</div>
      <div class="stat-label">连续打卡天数</div>
    </div>
  \`;
  document.getElementById('dashboard').innerHTML = html;
}

// 项目统计
function renderExerciseStats() {
  const stats = {};
  EXERCISES.forEach(ex => { stats[ex.id] = { count: 0, hours: 0 }; });

  allCheckins.forEach(c => {
    (c.exercises || []).forEach(e => {
      if (stats[e.id]) {
        stats[e.id].count++;
        stats[e.id].hours += e.duration;
      }
    });
  });

  const maxHours = Math.max(...Object.values(stats).map(s => s.hours), 1);

  const html = EXERCISES.map(ex => {
    const s = stats[ex.id];
    const pct = (s.hours / maxHours * 100).toFixed(0);
    return \`
      <div class="ex-stat-row">
        <div class="ex-stat-label">\${ex.icon} \${ex.name}</div>
        <div class="ex-stat-bar-bg">
          <div class="ex-stat-bar-fill" style="width:\${pct}%;background:\${ex.color}">\${s.hours.toFixed(1)}h</div>
        </div>
        <div class="ex-stat-count">\${s.count}次</div>
      </div>
    \`;
  }).join('');

  document.getElementById('exerciseStats').innerHTML = html;
}

// 热力图
function formatDate(d) {
  if (typeof d === 'string') return d;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + dd;
}

function renderHeatmap() {
  const checkinMap = {};
  allCheckins.forEach(c => {
    const hours = (c.exercises || []).reduce((s, e) => s + e.duration, 0);
    checkinMap[c.date] = hours;
  });

  const start = new Date(START_DATE + 'T00:00:00');
  const end = new Date(END_DATE + 'T00:00:00');
  const today = new Date(todayStr + 'T00:00:00');

  // 星期标签
  const weekdayLabels = ['', '一', '', '三', '', '五', ''];
  const weekdaysHTML = weekdayLabels.map(l =>
    '<div class="heatmap-weekday-label">' + l + '</div>'
  ).join('');
  document.getElementById('heatmapWeekdays').innerHTML = weekdaysHTML;

  // 计算前置空格:start 日期是星期几就补几个空
  const leadBlanks = start.getDay();

  // 生成所有格子
  const cells = [];
  // 前置空白
  for (let i = 0; i < leadBlanks; i++) {
    cells.push('<div class="heatmap-cell empty"></div>');
  }

  // 生成月份标签数据(需要和格子列对齐)
  // 月份标签放在月份第一列的上方
  const monthLabels = []; // {colIndex, label}
  let currentMonth = -1;
  let colIndex = 0;

  const d = new Date(start);
  while (d <= end) {
    const dateStr = formatDate(d);
    const isFuture = d > today;

    // 检测月份切换
    if (d.getMonth() !== currentMonth) {
      monthLabels.push({ colIndex, label: d.getFullYear() + '年' + (d.getMonth() + 1) + '月' });
      currentMonth = d.getMonth();
    }
    colIndex++;

    if (isFuture) {
      cells.push('<div class="heatmap-cell future"></div>');
    } else {
      const hours = checkinMap[dateStr] || 0;
      let level = '';
      if (hours > 0) {
        if (hours <= 0.5) level = 'l1';
        else if (hours <= 1) level = 'l2';
        else if (hours <= 2) level = 'l3';
        else level = 'l4';
      }

      const checkin = allCheckins.find(c => c.date === dateStr);
      let tooltip = dateStr;
      if (hours > 0 && checkin) {
        const exNames = (checkin.exercises || []).map(e => {
          const ex = EXERCISES.find(x => x.id === e.id);
          return ex ? ex.name + e.duration + 'h' : '';
        }).filter(Boolean).join(', ');
        tooltip = dateStr + ' · ' + exNames + ' · 共' + hours + 'h';
      } else {
        tooltip = dateStr + ' · 休息';
      }

      cells.push('<div class="heatmap-cell ' + level + '"><div class="heatmap-tooltip">' + tooltip + '</div></div>');
    }

    d.setDate(d.getDate() + 1);
  }

  // 后置空白填满最后一周
  const totalCells = cells.length;
  const remainder = totalCells % 7;
  if (remainder > 0) {
    for (let i = 0; i < 7 - remainder; i++) {
      cells.push('<div class="heatmap-cell empty"></div>');
    }
  }

  // 计算总列数
  const totalCols = cells.length / 7;

  // 生成月份标签行:用 grid column 定位
  // 每列宽度 = 13px cell + 3px gap = 16px
  const colWidth = 16;
  let monthsHTML = '';
  for (let i = 0; i < monthLabels.length; i++) {
    const ml = monthLabels[i];
    const left = ml.colIndex * colWidth;
    const nextCol = i < monthLabels.length - 1 ? monthLabels[i + 1].colIndex : totalCols;
    const width = (nextCol - ml.colIndex) * colWidth;
    monthsHTML += '<div class="heatmap-month-label" style="position:absolute;left:' + left + 'px;width:' + width + 'px">' + ml.label + '</div>';
  }

  document.getElementById('heatmapMonthsRow').innerHTML = monthsHTML;
  document.getElementById('heatmapMonthsRow').style.width = (totalCols * colWidth) + 'px';
  document.getElementById('heatmapGrid').innerHTML = cells.join('');
}



// 打卡进度
function renderProgress() {
  const checkinDates = new Set(allCheckins.map(c => c.date));
  const start = new Date(START_DATE);
  const end = new Date(END_DATE);
  const today = new Date(todayStr);

  // 总天数
  const totalDays = Math.round((end - start) / 86400000) + 1;
  // 已过天数
  const passedDays = Math.round((today - start) / 86400000) + 1;
  // 已打卡天数
  const checkedDays = allCheckins.length;
  // 打卡率
  const rate = passedDays > 0 ? (checkedDays / passedDays * 100).toFixed(1) : 0;

  // 连续打卡
  let streak = 0;
  let d = new Date(today);
  while (checkinDates.has(formatDate(d))) {
    streak++;
    d.setDate(d.getDate() - 1);
  }

  // 剩余天数
  const remainingDays = Math.round((end - today) / 86400000);

  // 最长连续
  const sortedDates = [...checkinDates].sort();
  let maxStreak = 0;
  let tempStreak = 0;
  let prevDate = null;
  for (const date of sortedDates) {
    if (prevDate) {
      const diff = (new Date(date) - new Date(prevDate)) / 86400000;
      if (diff === 1) {
        tempStreak++;
      } else {
        maxStreak = Math.max(maxStreak, tempStreak);
        tempStreak = 1;
      }
    } else {
      tempStreak = 1;
    }
    prevDate = date;
  }
  maxStreak = Math.max(maxStreak, tempStreak);

  const html = \`
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
      <div style="text-align:center;padding:16px;background:#f8fafc;border-radius:12px">
        <div style="font-size:28px;font-weight:800;color:var(--primary)">\${rate}%</div>
        <div style="font-size:12px;color:var(--text-light);margin-top:4px">打卡率(已过\${Math.max(0, passedDays)}天)</div>
      </div>
      <div style="text-align:center;padding:16px;background:#f8fafc;border-radius:12px">
        <div style="font-size:28px;font-weight:800;color:var(--success)">\${maxStreak}</div>
        <div style="font-size:12px;color:var(--text-light);margin-top:4px">最长连续打卡天数</div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">
      <div style="text-align:center;padding:12px;background:#f8fafc;border-radius:10px">
        <div style="font-size:20px;font-weight:700">\${totalDays}</div>
        <div style="font-size:11px;color:var(--text-light)">总天数</div>
      </div>
      <div style="text-align:center;padding:12px;background:#f8fafc;border-radius:10px">
        <div style="font-size:20px;font-weight:700">\${Math.max(0, remainingDays)}</div>
        <div style="font-size:11px;color:var(--text-light)">剩余天数</div>
      </div>
      <div style="text-align:center;padding:12px;background:#f8fafc;border-radius:10px">
        <div style="font-size:20px;font-weight:700;color:var(--warning)">\${streak}</div>
        <div style="font-size:11px;color:var(--text-light)">当前连续</div>
      </div>
    </div>
    <div style="margin-top:16px">
      <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--text-light);margin-bottom:6px">
        <span>总体进度</span>
        <span>\${checkedDays} / \${totalDays} 天</span>
      </div>
      <div style="height:8px;background:#f1f5f9;border-radius:4px;overflow:hidden">
        <div style="height:100%;width:\${(checkedDays/totalDays*100).toFixed(1)}%;background:linear-gradient(90deg,#6366f1,#8b5cf6);border-radius:4px;transition:width .6s"></div>
      </div>
    </div>
  \`;
  document.getElementById('progressInfo').innerHTML = html;
}

// ===== 初始化 =====
(async function init() {
  if (token) {
    // 验证 token 有效性
    try {
      const data = await api('/api/checkins');
      if (data.ok) {
        showApp();
        return;
      }
    } catch (e) {}
  }
  // 显示登录页
  document.getElementById('loginPage').style.display = 'flex';
})();


</script>
</body>
</html>`;
}

// ===== 主入口 =====
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // API 路由
    if (url.pathname.startsWith('/api/')) {
      return handleAPI(request, env);
    }

    // 首页
    if (url.pathname === '/' || url.pathname === '/index.html') {
      const html = getHTML();
      return new Response(html, {
        headers: { 'Content-Type': 'text/html;charset=UTF-8' },
      });
    }

    return new Response('Not Found', { status: 404 });
  },
};
