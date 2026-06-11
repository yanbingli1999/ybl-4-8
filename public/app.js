let fitChart = null;
let residualChart = null;
let currentResultId = null;
let currentDatasetId = null;
let isDirty = false;

let currentFitParams = null;
let currentTunedParams = null;
let currentModelType = null;
let currentDataPoints = [];
let currentPredictionData = null;
let extrapolationLimit = 0.5;

const modelTypeLabels = {
  linear: '线性模型',
  exponential: '指数模型',
  quadratic: '二次曲线'
};

function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  toast.className = `toast ${type} show`;
  toast.textContent = message;
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

function updateDatasetButtons() {
  const updateBtn = document.getElementById('updateDatasetBtn');
  if (currentDatasetId) {
    updateBtn.style.display = 'block';
    if (isDirty) {
      updateBtn.textContent = '💾 更新当前数据集 *';
    } else {
      updateBtn.textContent = '💾 更新当前数据集';
    }
  } else {
    updateBtn.style.display = 'none';
  }
}

function markDirty() {
  isDirty = true;
  updateDatasetButtons();
}

function clearDirty() {
  isDirty = false;
  updateDatasetButtons();
}

function initCharts() {
  const fitCtx = document.getElementById('fitChart').getContext('2d');
  const residualCtx = document.getElementById('residualChart').getContext('2d');

  fitChart = new Chart(fitCtx, {
    type: 'scatter',
    data: {
      datasets: [
        {
          label: '原始数据',
          data: [],
          backgroundColor: '#3b82f6',
          borderColor: '#3b82f6',
          pointRadius: 7,
          pointHoverRadius: 9,
          showLine: false
        },
        {
          label: '拟合曲线',
          data: [],
          borderColor: '#ef4444',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          borderWidth: 3,
          pointRadius: 0,
          showLine: true,
          tension: 0.1,
          fill: false
        },
        {
          label: '异常点',
          data: [],
          backgroundColor: '#f59e0b',
          borderColor: '#d97706',
          pointRadius: 9,
          pointStyle: 'triangle',
          showLine: false
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(30, 41, 59, 0.95)',
          titleFont: { size: 13 },
          bodyFont: { size: 12 },
          padding: 12,
          cornerRadius: 8,
          callbacks: {
            label: (context) => {
              const x = context.parsed.x?.toFixed(4) || 0;
              const y = context.parsed.y?.toFixed(4) || 0;
              return `(${x}, ${y})`;
            }
          }
        }
      },
      scales: {
        x: {
          type: 'linear',
          position: 'bottom',
          grid: { color: 'rgba(148, 163, 184, 0.2)' },
          ticks: { font: { size: 12 }, color: '#64748b' },
          title: { display: true, text: 'X 轴', font: { size: 13, weight: '600' }, color: '#475569' }
        },
        y: {
          grid: { color: 'rgba(148, 163, 184, 0.2)' },
          ticks: { font: { size: 12 }, color: '#64748b' },
          title: { display: true, text: 'Y 轴', font: { size: 13, weight: '600' }, color: '#475569' }
        }
      }
    }
  });

  residualChart = new Chart(residualCtx, {
    type: 'scatter',
    data: {
      datasets: [
        {
          label: '残差',
          data: [],
          backgroundColor: '#8b5cf6',
          borderColor: '#8b5cf6',
          pointRadius: 6,
          pointHoverRadius: 8,
          showLine: false
        },
        {
          label: '零参考线',
          data: [],
          borderColor: '#10b981',
          borderWidth: 2,
          borderDash: [8, 4],
          pointRadius: 0,
          showLine: true,
          fill: false
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(30, 41, 59, 0.95)',
          titleFont: { size: 13 },
          bodyFont: { size: 12 },
          padding: 12,
          cornerRadius: 8,
          callbacks: {
            label: (context) => {
              if (context.datasetIndex === 0) {
                const x = context.parsed.x?.toFixed(4) || 0;
                const y = context.parsed.y?.toFixed(6) || 0;
                return `x=${x}, 残差=${y}`;
              }
              return '';
            }
          }
        }
      },
      scales: {
        x: {
          type: 'linear',
          position: 'bottom',
          grid: { color: 'rgba(148, 163, 184, 0.2)' },
          ticks: { font: { size: 12 }, color: '#64748b' },
          title: { display: true, text: 'X 轴', font: { size: 13, weight: '600' }, color: '#475569' }
        },
        y: {
          grid: { color: 'rgba(148, 163, 184, 0.2)' },
          ticks: { font: { size: 12 }, color: '#64748b' },
          title: { display: true, text: '残差 (观测值 - 预测值)', font: { size: 13, weight: '600' }, color: '#475569' }
        }
      }
    }
  });
}

function addDataRow(x = '', y = '') {
  const tbody = document.getElementById('dataTableBody');
  const rowIndex = tbody.children.length + 1;
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td>${rowIndex}</td>
    <td><input type="number" step="any" class="x-input" value="${x}" placeholder="X"></td>
    <td><input type="number" step="any" class="y-input" value="${y}" placeholder="Y"></td>
    <td><button class="delete-row-btn" title="删除">✕</button></td>
  `;
  tr.querySelector('.delete-row-btn').addEventListener('click', () => {
    tr.remove();
    updateRowNumbers();
    markDirty();
  });
  tr.querySelectorAll('input').forEach(input => {
    input.addEventListener('input', markDirty);
  });
  tbody.appendChild(tr);
}

function updateRowNumbers() {
  const tbody = document.getElementById('dataTableBody');
  Array.from(tbody.children).forEach((tr, idx) => {
    tr.querySelector('td:first-child').textContent = idx + 1;
  });
}

function clearDataTable() {
  const tbody = document.getElementById('dataTableBody');
  tbody.innerHTML = '';
  for (let i = 0; i < 5; i++) {
    addDataRow();
  }
  currentDatasetId = null;
  currentResultId = null;
  clearDirty();
  resetDisplay();
}

function resetDisplay() {
  document.getElementById('metricR2').textContent = '—';
  document.getElementById('metricMSE').textContent = '—';
  document.getElementById('metricRMSE').textContent = '—';
  document.getElementById('metricMAE').textContent = '—';
  document.getElementById('eqFormula').textContent = '等待拟合...';
  document.getElementById('outliersSection').style.display = 'none';

  if (fitChart) {
    fitChart.data.datasets.forEach(ds => ds.data = []);
    fitChart.update();
  }
  if (residualChart) {
    residualChart.data.datasets.forEach(ds => ds.data = []);
    residualChart.update();
  }
}

function getTableData() {
  const tbody = document.getElementById('dataTableBody');
  const points = [];
  Array.from(tbody.children).forEach(tr => {
    const xInput = tr.querySelector('.x-input');
    const yInput = tr.querySelector('.y-input');
    const x = parseFloat(xInput.value);
    const y = parseFloat(yInput.value);
    if (!isNaN(x) && !isNaN(y)) {
      points.push({ x, y });
    }
  });
  return points;
}

function setTableData(points) {
  const tbody = document.getElementById('dataTableBody');
  tbody.innerHTML = '';
  points.forEach(p => {
    addDataRow(p.x, p.y);
  });
}

function loadSampleData() {
  const samples = [
    { x: 1, y: 2.1 },
    { x: 2, y: 3.8 },
    { x: 3, y: 6.2 },
    { x: 4, y: 7.9 },
    { x: 5, y: 10.3 },
    { x: 6, y: 11.8 },
    { x: 7, y: 14.5 },
    { x: 8, y: 25.0 },
    { x: 9, y: 18.2 },
    { x: 10, y: 20.1 }
  ];
  setTableData(samples);
  document.getElementById('datasetName').value = '示例实验数据';
  currentDatasetId = null;
  currentResultId = null;
  resetDisplay();
  clearDirty();
  showToast('已加载示例数据', 'success');
}

async function performFit() {
  const points = getTableData();
  if (points.length < 2) {
    showToast('请至少输入2个有效数据点', 'error');
    return;
  }

  const modelType = document.querySelector('input[name="modelType"]:checked').value;
  const datasetName = document.getElementById('datasetName').value || '未命名数据集';

  const fitBtn = document.getElementById('fitBtn');
  const originalText = fitBtn.textContent;
  fitBtn.textContent = '⏳ 计算中...';
  fitBtn.disabled = true;

  try {
    const res = await fetch('/api/fit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ points, modelType, datasetName, datasetId: currentDatasetId })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '拟合失败');

    displayFitResult(data);
    currentResultId = data.id;
    showToast('拟合完成！', 'success');
    loadHistory();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    fitBtn.textContent = originalText;
    fitBtn.disabled = false;
  }
}

function displayFitResult(result) {
  document.getElementById('metricR2').textContent = result.metrics.rSquared.toFixed(6);
  document.getElementById('metricMSE').textContent = result.metrics.mse.toFixed(6);
  document.getElementById('metricRMSE').textContent = result.metrics.rmse.toFixed(6);
  document.getElementById('metricMAE').textContent = result.metrics.mae.toFixed(6);
  document.getElementById('eqFormula').textContent = result.modelEquation;

  const normalPoints = [];
  const outlierPoints = [];
  const outlierIndices = new Set(result.outliers.filter(o => o.isOutlier).map(o => o.index));

  result.points.forEach((p, i) => {
    if (outlierIndices.has(i)) {
      outlierPoints.push(p);
    } else {
      normalPoints.push(p);
    }
  });

  currentDataPoints = result.points;
  
  fitChart.data.datasets[0].data = normalPoints;
  fitChart.data.datasets[1].data = result.curvePoints;
  fitChart.data.datasets[2].data = outlierPoints;
  fitChart.update();
  
  initParamSliders(result.modelType, result.params);
  updateDataRangeInfo();

  const residualData = result.points.map((p, i) => ({
    x: p.x,
    y: result.residuals[i]
  }));

  const xs = result.points.map(p => p.x);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const range = maxX - minX || 1;
  const zeroLine = [
    { x: minX - range * 0.1, y: 0 },
    { x: maxX + range * 0.1, y: 0 }
  ];

  residualChart.data.datasets[0].data = residualData;
  residualChart.data.datasets[1].data = zeroLine;
  residualChart.update();

  const outliersSection = document.getElementById('outliersSection');
  const outliersList = document.getElementById('outliersList');
  const actualOutliers = result.outliers.filter(o => o.isOutlier);

  if (actualOutliers.length > 0) {
    outliersSection.style.display = 'block';
    outliersList.innerHTML = actualOutliers.map(o => `
      <span class="outlier-badge">
        #${o.index + 1} (x=${result.points[o.index].x.toFixed(3)}, y=${result.points[o.index].y.toFixed(3)})
        Z=${o.zScore.toFixed(2)}
      </span>
    `).join('');
  } else {
    outliersSection.style.display = 'none';
  }
}

async function loadHistory() {
  try {
    const res = await fetch('/api/history');
    const history = await res.json();
    const historyList = document.getElementById('historyList');

    if (history.length === 0) {
      historyList.innerHTML = '<div class="empty-state">暂无历史记录</div>';
      return;
    }

    historyList.innerHTML = history.map(h => `
      <div class="history-item" data-id="${h.id}">
        <div class="history-title">${h.datasetName}</div>
        <span class="history-model">${modelTypeLabels[h.modelType] || h.modelType}</span>
        <div class="history-meta">
          <span>${h.pointsCount} 个点 · R²=${h.metrics.rSquared.toFixed(4)}</span>
          <span>${new Date(h.createdAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
        </div>
        <div class="history-actions">
          <button class="btn-load" onclick="loadHistoryItem('${h.id}')">查看</button>
          <button class="btn-delete" onclick="deleteHistoryItem('${h.id}')">删除</button>
        </div>
      </div>
    `).join('');
  } catch (err) {
    console.error('加载历史失败:', err);
  }
}

async function loadHistoryItem(id) {
  try {
    const res = await fetch(`/api/history/${id}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    document.getElementById('datasetName').value = data.datasetName;
    document.querySelector(`input[name="modelType"][value="${data.modelType}"]`).checked = true;
    setTableData(data.points);
    displayFitResult(data);
    currentResultId = id;
    currentDatasetId = data.datasetId || null;
    clearDirty();
    showToast('已加载历史记录', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteHistoryItem(id) {
  if (!confirm('确定删除这条历史记录吗？')) return;
  try {
    const res = await fetch(`/api/history/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('删除失败');
    if (currentResultId === id) {
      currentResultId = null;
    }
    showToast('已删除', 'success');
    loadHistory();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function loadDatasets() {
  try {
    const res = await fetch('/api/datasets');
    const datasets = await res.json();
    const datasetsList = document.getElementById('datasetsList');

    if (datasets.length === 0) {
      datasetsList.innerHTML = '<div class="empty-state">暂无保存的数据集</div>';
      return;
    }

    datasetsList.innerHTML = datasets.map(d => `
      <div class="dataset-item" data-id="${d.id}">
        <div class="history-title">${d.name}</div>
        <div class="history-meta">
          <span>${d.points.length} 个点</span>
          <span>${new Date(d.createdAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
        </div>
        <div class="history-actions">
          <button class="btn-load" onclick="loadDataset('${d.id}')">加载</button>
          <button class="btn-delete" onclick="deleteDataset('${d.id}')">删除</button>
        </div>
      </div>
    `).join('');
  } catch (err) {
    console.error('加载数据集失败:', err);
  }
}

async function saveCurrentDataset() {
  const points = getTableData();
  const name = document.getElementById('datasetName').value || '未命名数据集';

  if (points.length < 2) {
    showToast('请至少输入2个有效数据点', 'error');
    return;
  }

  try {
    const res = await fetch('/api/datasets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, points })
    });
    if (!res.ok) throw new Error('保存失败');
    const dataset = await res.json();
    currentDatasetId = dataset.id;
    clearDirty();
    showToast('已另存为新数据集', 'success');
    loadDatasets();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function updateCurrentDataset() {
  if (!currentDatasetId) {
    showToast('没有可更新的数据集，请先加载或另存为', 'error');
    return;
  }

  const points = getTableData();
  const name = document.getElementById('datasetName').value || '未命名数据集';

  if (points.length < 2) {
    showToast('请至少输入2个有效数据点', 'error');
    return;
  }

  try {
    const res = await fetch(`/api/datasets/${currentDatasetId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, points })
    });
    if (!res.ok) throw new Error('更新失败');
    clearDirty();
    showToast('数据集已更新', 'success');
    loadDatasets();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function loadDataset(id) {
  try {
    const res = await fetch('/api/datasets');
    const datasets = await res.json();
    const dataset = datasets.find(d => d.id === id);
    if (!dataset) throw new Error('数据集不存在');

    document.getElementById('datasetName').value = dataset.name;
    setTableData(dataset.points);
    currentDatasetId = id;
    currentResultId = null;
    resetDisplay();
    clearDirty();
    showToast('已加载数据集', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteDataset(id) {
  if (!confirm('确定删除这个数据集吗？')) return;
  try {
    const res = await fetch(`/api/datasets/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('删除失败');
    if (currentDatasetId === id) {
      currentDatasetId = null;
      updateDatasetButtons();
    }
    showToast('已删除', 'success');
    loadDatasets();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function initParamSliders(modelType, params) {
  const section = document.getElementById('paramTuningSection');
  const slidersContainer = document.getElementById('paramSliders');
  
  section.style.display = 'block';
  
  const paramConfigs = {
    linear: [
      { key: 'a', label: '斜率 a', min: -100, max: 100, step: 0.001 },
      { key: 'b', label: '截距 b', min: -100, max: 100, step: 0.001 }
    ],
    exponential: [
      { key: 'a', label: '系数 a', min: 0.001, max: 100, step: 0.001 },
      { key: 'b', label: '指数 b', min: -2, max: 2, step: 0.001 }
    ],
    quadratic: [
      { key: 'a', label: '二次项 a', min: -50, max: 50, step: 0.001 },
      { key: 'b', label: '一次项 b', min: -100, max: 100, step: 0.001 },
      { key: 'c', label: '常数项 c', min: -100, max: 100, step: 0.001 }
    ]
  };
  
  const configs = paramConfigs[modelType] || [];
  currentFitParams = { ...params };
  currentTunedParams = { ...params };
  currentModelType = modelType;
  
  slidersContainer.innerHTML = configs.map(config => {
    const value = params[config.key] || 0;
    const range = Math.abs(value) * 2 || 10;
    const min = value - range;
    const max = value + range;
    
    return `
      <div class="param-slider-item" data-param="${config.key}">
        <div class="param-slider-header">
          <span class="param-slider-label">${config.label}</span>
          <span class="param-slider-value" id="param-value-${config.key}">${value.toFixed(6)}</span>
        </div>
        <input type="range" 
               id="param-slider-${config.key}" 
               min="${min}" 
               max="${max}" 
               step="${(max - min) / 1000}"
               value="${value}">
      </div>
    `;
  }).join('');
  
  configs.forEach(config => {
    const slider = document.getElementById(`param-slider-${config.key}`);
    slider.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      currentTunedParams[config.key] = value;
      document.getElementById(`param-value-${config.key}`).textContent = value.toFixed(6);
      updatePredictionCurve();
      updateTunedEquation();
    });
  });
  
  updateDataRangeInfo();
}

function updateTunedEquation() {
  if (!currentModelType || !currentTunedParams) return;
  
  let equation;
  const params = currentTunedParams;
  
  switch (currentModelType) {
    case 'linear':
      equation = `y = ${params.a.toFixed(6)}x + ${params.b.toFixed(6)}`;
      break;
    case 'exponential':
      equation = `y = ${params.a.toFixed(6)} · e^(${params.b.toFixed(6)}x)`;
      break;
    case 'quadratic':
      equation = `y = ${params.a.toFixed(6)}x² + ${params.b.toFixed(6)}x + ${params.c.toFixed(6)}`;
      break;
  }
  
  document.getElementById('eqFormula').textContent = equation + ' (调节中)';
}

function resetParamsToFit() {
  if (!currentFitParams || !currentModelType) return;
  
  currentTunedParams = { ...currentFitParams };
  
  Object.keys(currentTunedParams).forEach(key => {
    const slider = document.getElementById(`param-slider-${key}`);
    const valueDisplay = document.getElementById(`param-value-${key}`);
    if (slider) slider.value = currentTunedParams[key];
    if (valueDisplay) valueDisplay.textContent = currentTunedParams[key].toFixed(6);
  });
  
  updatePredictionCurve();
  
  let equation;
  switch (currentModelType) {
    case 'linear':
      equation = `y = ${currentFitParams.a.toFixed(6)}x + ${currentFitParams.b.toFixed(6)}`;
      break;
    case 'exponential':
      equation = `y = ${currentFitParams.a.toFixed(6)} · e^(${currentFitParams.b.toFixed(6)}x)`;
      break;
    case 'quadratic':
      equation = `y = ${currentFitParams.a.toFixed(6)}x² + ${currentFitParams.b.toFixed(6)}x + ${currentFitParams.c.toFixed(6)}`;
      break;
  }
  document.getElementById('eqFormula').textContent = equation;
  
  showToast('参数已重置为拟合值', 'info');
}

function calculateY(x, modelType, params) {
  switch (modelType) {
    case 'linear':
      return params.a * x + params.b;
    case 'exponential':
      return params.a * Math.exp(params.b * x);
    case 'quadratic':
      return params.a * x * x + params.b * x + params.c;
    default:
      return 0;
  }
}

function updatePredictionCurve() {
  if (!fitChart || !currentModelType || !currentTunedParams || currentDataPoints.length === 0) return;
  
  const xs = currentDataPoints.map(p => p.x);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const range = maxX - minX || 1;
  const extendedMin = minX - range * 0.2;
  const extendedMax = maxX + range * 0.2;
  const numPoints = 200;
  const step = (extendedMax - extendedMin) / (numPoints - 1);
  
  const predictionPoints = [];
  for (let i = 0; i < numPoints; i++) {
    const x = extendedMin + i * step;
    const y = calculateY(x, currentModelType, currentTunedParams);
    predictionPoints.push({ x, y });
  }
  
  if (fitChart.data.datasets.length < 4) {
    fitChart.data.datasets.push({
      label: '预测曲线',
      data: [],
      borderColor: '#10b981',
      backgroundColor: 'rgba(16, 185, 129, 0.1)',
      borderWidth: 3,
      borderDash: [6, 4],
      pointRadius: 0,
      showLine: true,
      tension: 0.1,
      fill: false
    });
  }
  
  fitChart.data.datasets[3].data = predictionPoints;
  fitChart.update('none');
}

function updateDataRangeInfo() {
  const points = getTableData();
  currentDataPoints = points;
  
  if (points.length === 0) {
    document.getElementById('dataRange').textContent = '—';
    return;
  }
  
  const xs = points.map(p => p.x);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  document.getElementById('dataRange').textContent = `[${minX.toFixed(3)}, ${maxX.toFixed(3)}]`;
  
  if (points.length >= 2 && currentModelType) {
    updatePredictionCurve();
  }
}

function checkExtrapolation(xStart, xEnd) {
  if (currentDataPoints.length === 0) return { hasExtrapolation: false, minData: 0, maxData: 0 };
  
  const xs = currentDataPoints.map(p => p.x);
  const minData = Math.min(...xs);
  const maxData = Math.max(...xs);
  const range = maxData - minData || 1;
  
  const allowedMin = minData - range * extrapolationLimit;
  const allowedMax = maxData + range * extrapolationLimit;
  
  const hasExtrapolation = xStart < minData || xEnd > maxData;
  const exceedsLimit = xStart < allowedMin || xEnd > allowedMax;
  
  return { hasExtrapolation, exceedsLimit, minData, maxData, allowedMin, allowedMax, range };
}

function generatePredictionTable() {
  if (!currentModelType || !currentTunedParams) {
    showToast('请先执行拟合获取模型参数', 'error');
    return;
  }
  
  const xStart = parseFloat(document.getElementById('predXStart').value);
  const xEnd = parseFloat(document.getElementById('predXEnd').value);
  const xStep = parseFloat(document.getElementById('predXStep').value);
  
  if (isNaN(xStart) || isNaN(xEnd) || isNaN(xStep) || xStep <= 0) {
    showToast('请输入有效的X区间参数', 'error');
    return;
  }
  
  if (xStart >= xEnd) {
    showToast('起始X必须小于结束X', 'error');
    return;
  }
  
  const extrapolation = checkExtrapolation(xStart, xEnd);
  
  if (extrapolation.exceedsLimit) {
    showToast(`外推超出限制！允许范围: [${extrapolation.allowedMin.toFixed(3)}, ${extrapolation.allowedMax.toFixed(3)}]`, 'error');
    return;
  }
  
  const warningEl = document.getElementById('extrapolationWarning');
  warningEl.style.display = extrapolation.hasExtrapolation ? 'flex' : 'none';
  
  const predictions = [];
  let x = xStart;
  let index = 1;
  
  while (x <= xEnd + xStep * 0.0001) {
    const y = calculateY(x, currentModelType, currentTunedParams);
    const isInterpolation = x >= extrapolation.minData && x <= extrapolation.maxData;
    predictions.push({
      index: index++,
      x: x,
      y: y,
      type: isInterpolation ? 'interpolation' : 'extrapolation'
    });
    x += xStep;
  }
  
  currentPredictionData = {
    modelType: currentModelType,
    params: { ...currentTunedParams },
    xStart,
    xEnd,
    xStep,
    predictions,
    dataPoints: [...currentDataPoints]
  };
  
  displayPredictionResults(predictions);
  document.getElementById('predResultSection').style.display = 'block';
}

function displayPredictionResults(predictions) {
  const tbody = document.getElementById('predTableBody');
  const interpCount = predictions.filter(p => p.type === 'interpolation').length;
  const extraCount = predictions.filter(p => p.type === 'extrapolation').length;
  
  document.getElementById('predCount').textContent = predictions.length;
  document.getElementById('predInterpCount').textContent = interpCount;
  document.getElementById('predExtraCount').textContent = extraCount;
  
  tbody.innerHTML = predictions.map(p => `
    <tr>
      <td>${p.index}</td>
      <td>${p.x.toFixed(4)}</td>
      <td>${p.y.toFixed(6)}</td>
      <td>
        <span class="pred-type-badge ${p.type === 'interpolation' ? 'pred-type-interp' : 'pred-type-extra'}">
          ${p.type === 'interpolation' ? '内插' : '外推'}
        </span>
      </td>
    </tr>
  `).join('');
}

async function savePrediction() {
  if (!currentPredictionData) {
    showToast('没有可保存的预测数据', 'error');
    return;
  }
  
  const name = document.getElementById('predictionName').value || '未命名预测';
  
  try {
    const res = await fetch('/api/predictions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        ...currentPredictionData
      })
    });
    
    if (!res.ok) throw new Error('保存失败');
    
    showToast('预测记录已保存', 'success');
    loadPredictionHistory();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function loadPredictionHistory() {
  try {
    const res = await fetch('/api/predictions');
    const predictions = await res.json();
    const listEl = document.getElementById('predictionHistoryList');
    
    if (predictions.length === 0) {
      listEl.innerHTML = '<div class="empty-state">暂无预测记录</div>';
      return;
    }
    
    listEl.innerHTML = predictions.map(p => `
      <div class="history-item" data-id="${p.id}">
        <div class="history-title">${p.name}</div>
        <span class="history-model">${modelTypeLabels[p.modelType] || p.modelType}</span>
        <div class="history-meta">
          <span>${p.predictionsCount || p.predictions?.length || 0} 个预测点</span>
          <span>${new Date(p.createdAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
        </div>
        <div class="history-actions">
          <button class="btn-load" onclick="loadPredictionItem('${p.id}')">加载</button>
          <button class="btn-delete" onclick="deletePredictionItem('${p.id}')">删除</button>
        </div>
      </div>
    `).join('');
  } catch (err) {
    console.error('加载预测历史失败:', err);
  }
}

async function loadPredictionItem(id) {
  try {
    const res = await fetch(`/api/predictions/${id}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    
    currentModelType = data.modelType;
    currentTunedParams = { ...data.params };
    currentFitParams = { ...data.params };
    currentDataPoints = data.dataPoints || [];
    currentPredictionData = data;
    
    document.getElementById('predXStart').value = data.xStart;
    document.getElementById('predXEnd').value = data.xEnd;
    document.getElementById('predXStep').value = data.xStep;
    document.getElementById('predictionName').value = data.name;
    
    if (data.dataPoints && data.dataPoints.length > 0) {
      setTableData(data.dataPoints);
    }
    
    initParamSliders(data.modelType, data.params);
    
    const extrapolation = checkExtrapolation(data.xStart, data.xEnd);
    document.getElementById('extrapolationWarning').style.display = extrapolation.hasExtrapolation ? 'flex' : 'none';
    
    displayPredictionResults(data.predictions);
    document.getElementById('predResultSection').style.display = 'block';
    
    document.querySelector(`input[name="modelType"][value="${data.modelType}"]`).checked = true;
    
    if (fitChart && data.dataPoints && data.dataPoints.length > 0) {
      const normalPoints = data.dataPoints;
      fitChart.data.datasets[0].data = normalPoints;
      updatePredictionCurve();
    }
    
    showToast('已加载预测记录', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deletePredictionItem(id) {
  if (!confirm('确定删除这条预测记录吗？')) return;
  try {
    const res = await fetch(`/api/predictions/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('删除失败');
    showToast('已删除', 'success');
    loadPredictionHistory();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function initTabs() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      tabBtns.forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
      document.getElementById('tab-prediction').style.display = tab === 'prediction' ? 'block' : 'none';
      document.getElementById('tab-history').style.display = tab === 'history' ? 'block' : 'none';
      document.getElementById('tab-datasets').style.display = tab === 'datasets' ? 'block' : 'none';
    });
  });
}

function initEventListeners() {
  document.getElementById('addRowBtn').addEventListener('click', () => {
    addDataRow();
    markDirty();
    updateDataRangeInfo();
  });
  document.getElementById('clearDataBtn').addEventListener('click', () => {
    if (confirm('确定清空所有数据吗？')) clearDataTable();
  });
  document.getElementById('loadSampleBtn').addEventListener('click', loadSampleData);
  document.getElementById('fitBtn').addEventListener('click', performFit);
  document.getElementById('saveDatasetBtn').addEventListener('click', saveCurrentDataset);
  document.getElementById('updateDatasetBtn').addEventListener('click', updateCurrentDataset);
  document.getElementById('datasetName').addEventListener('input', markDirty);
  
  document.getElementById('resetParamsBtn').addEventListener('click', resetParamsToFit);
  document.getElementById('generatePredBtn').addEventListener('click', generatePredictionTable);
  document.getElementById('savePredictionBtn').addEventListener('click', savePrediction);
  
  ['predXStart', 'predXEnd', 'predXStep'].forEach(id => {
    document.getElementById(id).addEventListener('input', () => {
      const xStart = parseFloat(document.getElementById('predXStart').value);
      const xEnd = parseFloat(document.getElementById('predXEnd').value);
      if (!isNaN(xStart) && !isNaN(xEnd) && currentDataPoints.length > 0) {
        const extrapolation = checkExtrapolation(xStart, xEnd);
        document.getElementById('extrapolationWarning').style.display = extrapolation.hasExtrapolation ? 'flex' : 'none';
      }
    });
  });
}

function init() {
  initCharts();
  initTabs();
  initEventListeners();
  clearDataTable();
  loadHistory();
  loadDatasets();
  loadPredictionHistory();
  updateDatasetButtons();
  updateDataRangeInfo();
}

document.addEventListener('DOMContentLoaded', init);
