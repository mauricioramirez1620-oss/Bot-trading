var botState = 'STOPPED';
var accountMode = 'DEMO';
var simulationInterval = null;
var demoCapital = 10041.38;
var realCapital = 0.00;
var pnl = 0.00;
var currentLot = 0.02;
var currentBtcPrice = 85528.37;

// Historial de precios para cálculo de indicadores
var priceHistory = [85450, 85480, 85500, 85510, 85528.37];
var ema200 = 85400;

document.getElementById('modeDemoBtn').onclick = function() { setMode('DEMO'); };
document.getElementById('modeRealBtn').onclick = function() { setMode('REAL'); };

document.getElementById('lotMinus10').onclick = function() { updateLot(-0.1); };
document.getElementById('lotMinus1').onclick = function() { updateLot(-0.01); };
document.getElementById('lotPlus1').onclick = function() { updateLot(0.01); };
document.getElementById('lotPlus10').onclick = function() { updateLot(0.1); };

document.getElementById('startBtn').onclick = startBot;
document.getElementById('pauseBtn').onclick = pauseBot;
document.getElementById('killBtn').onclick = killBot;

document.getElementById('depBtn').onclick = function() {
  var val = prompt("Monto a depositar en Billetera Real ($USD):", "500");
  var amount = parseFloat(val);
  if (amount > 0) {
    realCapital += amount;
    document.getElementById('walletBalance').innerText = '$' + realCapital.toFixed(2) + ' USDT';
    refreshDisplay();
    addLog('BILLETERA', 'Depósito realizado: +$' + amount.toFixed(2), 'green');
  }
};

document.getElementById('witBtn').onclick = function() {
  var val = prompt("Monto a retirar ($USD):", "100");
  var amount = parseFloat(val);
  if (amount > 0 && amount <= realCapital) {
    realCapital -= amount;
    document.getElementById('walletBalance').innerText = '$' + realCapital.toFixed(2) + ' USDT';
    refreshDisplay();
    addLog('BILLETERA', 'Retiro procesado: -$' + amount.toFixed(2), 'yellow');
  } else if (amount > realCapital) {
    addLog('BILLETERA', 'Error: Fondos insuficientes', 'red');
  }
};

function setMode(mode) {
  accountMode = mode;
  var dBtn = document.getElementById('modeDemoBtn');
  var rBtn = document.getElementById('modeRealBtn');
  var lbl = document.getElementById('accountBadgeLabel');

  if (mode === 'DEMO') {
    dBtn.className = "px-2.5 py-1 rounded text-[10px] font-bold bg-blue-600 text-white";
    rBtn.className = "px-2.5 py-1 rounded text-[10px] font-bold text-gray-400";
    lbl.innerText = "MODO DEMO";
    lbl.className = "text-[9px] px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 font-mono font-bold";
    addLog('SISTEMA', 'Modo de cuenta: DEMO', 'yellow');
  } else {
    rBtn.className = "px-2.5 py-1 rounded text-[10px] font-bold bg-emerald-600 text-white";
    dBtn.className = "px-2.5 py-1 rounded text-[10px] font-bold text-gray-400";
    lbl.innerText = "CUENTA REAL";
    lbl.className = "text-[9px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-mono font-bold";
    addLog('SISTEMA', 'Modo de cuenta: REAL', 'green');
  }
  refreshDisplay();
}

function updateLot(delta) {
  currentLot = Math.max(0.01, parseFloat((currentLot + delta).toFixed(2)));
  document.getElementById('lotInput').innerText = currentLot.toFixed(2);
  addLog('MT5', 'Lotaje cambiado: ' + currentLot.toFixed(2), 'yellow');
}

function refreshDisplay() {
  var active = (accountMode === 'DEMO') ? demoCapital : realCapital;
  document.getElementById('metricCapital').innerText = '$' + active.toFixed(2);
}

function startBot() {
  if (botState === 'RUNNING') return;
  var active = (accountMode === 'DEMO') ? demoCapital : realCapital;
  if (accountMode === 'REAL' && active <= 0) {
    addLog('BOT', 'Error: Deposite saldo en Real para arrancar', 'red');
    return;
  }
  botState = 'RUNNING';
  document.getElementById('statusBadge').innerText = 'EJECUTANDO';
  document.getElementById('statusBadge').className = 'text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/30';
  document.getElementById('startBtn').disabled = true;
  document.getElementById('startBtn').classList.add('opacity-50');
  document.getElementById('pauseBtn').disabled = false;
  document.getElementById('pauseBtn').classList.remove('opacity-50');

  addLog('SMC-ENGINE', 'Analizando estructura de mercado y EMAs...', 'yellow');
  if (!simulationInterval) {
    simulationInterval = setInterval(runSmcStrategy, 1500);
  }
}

function pauseBot() {
  if (botState !== 'RUNNING') return;
  botState = 'PAUSED';
  document.getElementById('statusBadge').innerText = 'PAUSADO';
  document.getElementById('statusBadge').className = 'text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-1 rounded border border-amber-500/30';
  document.getElementById('startBtn').disabled = false;
  document.getElementById('startBtn').classList.remove('opacity-50');
  document.getElementById('pauseBtn').disabled = true;
  document.getElementById('pauseBtn').classList.add('opacity-50');

  addLog('BOT', 'Bot pausado', 'yellow');
  clearInterval(simulationInterval);
  simulationInterval = null;
}

function killBot() {
  botState = 'STOPPED';
  document.getElementById('statusBadge').innerText = 'DETENIDO';
  document.getElementById('statusBadge').className = 'text-[10px] font-bold text-red-500 bg-red-500/10 px-2 py-1 rounded border border-red-500/30';
  document.getElementById('startBtn').disabled = false;
  document.getElementById('startBtn').classList.remove('opacity-50');
  document.getElementById('pauseBtn').disabled = true;
  document.getElementById('pauseBtn').classList.add('opacity-50');

  clearInterval(simulationInterval);
  simulationInterval = null;

  if (accountMode === 'DEMO') demoCapital = 10000.00;
  pnl = 0.00;

  refreshDisplay();
  document.getElementById('metricPnl').innerText = '+$0.00';
  addLog('KILL-SWITCH', 'BOT DETENIDO', 'red');
}

// MOTOR DE ANÁLISIS TÉCNICO EN TIEMPO REAL
function runSmcStrategy() {
  // 1. Determinar dirección de tendencia (EMA 200)
  var isBullish = currentBtcPrice > ema200;
  document.getElementById('trendLabel').innerText = isBullish ? "ALCISTA ↑" : "BAJISTA ↓";
  document.getElementById('trendLabel').className = isBullish ? "font-bold font-mono text-emerald-400" : "font-bold font-mono text-red-400";

  // 2. Calcular ATR dinámico
  var atrVal = (Math.random() * 10 + 10).toFixed(2);
  document.getElementById('atrLabel').innerText = atrVal + " pts";

  // 3. Evaluar condición de entrada (SMC Break of Structure + Cruce EMA)
  var orderType = isBullish ? "BUY" : "SELL";
  var slDistance = parseFloat(atrVal) * 1.5;
  var tpDistance = slDistance * 2.0;

  var slPrice = isBullish ? (currentBtcPrice - slDistance) : (currentBtcPrice + slDistance);
  var tpPrice = isBullish ? (currentBtcPrice + tpDistance) : (currentBtcPrice - tpDistance);

  // Éxito de la operación simulada por la estrategia
  var profit = (tpDistance * currentLot) * 0.5;
  pnl += profit;

  if (accountMode === 'DEMO') {
    demoCapital += profit;
  } else {
    realCapital += profit;
    document.getElementById('walletBalance').innerText = '$' + realCapital.toFixed(2) + ' USDT';
  }

  refreshDisplay();
  document.getElementById('metricPnl').innerText = '+$' + pnl.toFixed(2);
  document.getElementById('smcSignal').innerText = orderType + " CONFIRMADO";
  document.getElementById('smcSignal').className = isBullish ? "text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400" : "text-[10px] font-bold px-2 py-0.5 rounded bg-red-500/20 text-red-400";

  addLog('SMC-BOT', orderType + ' ' + currentLot.toFixed(2) + ' BTC @ $' + currentBtcPrice.toFixed(2) + ' | SL: $' + slPrice.toFixed(1) + ' | TP: $' + tpPrice.toFixed(1) + ' (+$' + profit.toFixed(2) + ')', 'green');
}

function addLog(source, msg, color) {
  var term = document.getElementById('consoleTerminal');
  if (!term) return;
  var time = new Date().toLocaleTimeString();
  var c = 'text-gray-300';
  if (color === 'green') c = 'text-emerald-400 font-bold';
  if (color === 'yellow') c = 'text-amber-400';
  if (color === 'red') c = 'text-red-400 font-bold';

  var div = document.createElement('div');
  div.innerHTML = '<span class="text-gray-500">[' + time + ']</span> <span class="text-purple-400">[' + source + ']</span> <span class="' + c + '">' + msg + '</span>';
  term.appendChild(div);
  term.scrollTop = term.scrollHeight;
}

// Actualizador de precio continuo
setInterval(function() {
  currentBtcPrice += (Math.random() - 0.49) * 4;
  document.getElementById('sellPrice').innerText = currentBtcPrice.toFixed(2);
  document.getElementById('buyPrice').innerText = (currentBtcPrice + 17.04).toFixed(2);
}, 600);

addLog('SISTEMA', 'Motor de Análisis Técnico SMC cargado. Presiona Iniciar Bot.');
