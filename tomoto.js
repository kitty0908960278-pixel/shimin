// ==========================================
// 1. DOM 元素與全域變數抓取
// ==========================================
const timerDisplay = document.getElementById('timer-display');
const startBtn = document.getElementById('start-btn');
const resetBtn = document.getElementById('reset-btn');
const taskInput = document.getElementById('task-input');
const addTaskBtn = document.getElementById('add-task-btn');
const taskList = document.getElementById('task-list');
const coinValueEls = document.querySelectorAll('.coin-value');
const activeTaskNameEl = document.getElementById('active-task-name');

// 計時器與番茄鐘循環狀態 (預設值)
let workTimeSetting = 25;   
let breakTimeSetting = 5;   
let tomatoCountSetting = 4; 

let totalSeconds = workTimeSetting * 60; 
let timerId = null;
let isRunning = false;
let targetTime = null;

let isWorkMode = true; 
let remainingTomatoes = tomatoCountSetting; 

// 資料持久化 (localStorage)
let coins = parseInt(localStorage.getItem('pomodoro_coins')) || 120;
let tasks = JSON.parse(localStorage.getItem('pomodoro_tasks')) || [];
let unlockedItems = JSON.parse(localStorage.getItem('pomodoro_unlocked')) || [];
let activeTaskId = localStorage.getItem('pomodoro_active_task') || null;

// 初始化渲染
updateCoinDisplay();
renderTasks();
updateTimerDisplay();
updateActiveTaskUI();


// ==========================================
// 2. 動態金幣計算管理
// ==========================================
function addCoins(amount) {
    coins += amount;
    localStorage.setItem('pomodoro_coins', coins);
    updateCoinDisplay();
}

// 依據專注時間計算：每 5 分鐘 4 金幣，餘數算 1 金幣
function calculateCoinsForWork(minutes) {
    if (minutes <= 0) return 1;
    const blocks = Math.floor(minutes / 5);
    const remainder = minutes % 5;
    let earned = blocks * 4 + (remainder > 0 ? 1 : 0);
    return Math.max(earned, 1);
}

function deductCoins(amount) {
    if (coins >= amount) {
        coins -= amount;
        localStorage.setItem('pomodoro_coins', coins);
        updateCoinDisplay();
        return true;
    }
    alert('金幣不足！');
    return false;
}

function updateCoinDisplay() {
    coinValueEls.forEach(el => {
        el.innerText = coins;
    });
}


// ==========================================
// 3. 全自動循環計時與任務累計時間核心
// ==========================================
if (startBtn) {
    startBtn.addEventListener('click', () => {
        if (isRunning) return;
        
        if (remainingTomatoes <= 0) {
            remainingTomatoes = tomatoCountSetting;
            isWorkMode = true;
            totalSeconds = workTimeSetting * 60;
        }

        isRunning = true;
        startBtn.innerText = isWorkMode ? "專注計時中..." : "休息中...";

        targetTime = Date.now() + totalSeconds * 1000;
        runLoopTimer();
    });
}

function runLoopTimer() {
    timerId = setInterval(() => {
        const now = Date.now();
        const remainingMs = targetTime - now;
        totalSeconds = Math.ceil(remainingMs / 1000);

        if (totalSeconds > 0) {
            updateTimerDisplay();
        } else {
            clearInterval(timerId);

            if (isWorkMode) {
                // --- 專注時間結束 ---
                const earnedCoins = calculateCoinsForWork(workTimeSetting);
                addCoins(earnedCoins); 
                
                // 【核心功能】若有選定任務，將專注分鐘數累加至該任務
                if (activeTaskId) {
                    tasks = tasks.map(task => {
                        if (task.id == activeTaskId) {
                            return { ...task, accumulatedMinutes: (task.accumulatedMinutes || 0) + workTimeSetting };
                        }
                        return task;
                    });
                    saveAndRenderTasks();
                }

                if (remainingTomatoes > 0) {
                    remainingTomatoes--;
                    updateTomatoDisplayUI();
                }

                // 無縫切換到休息模式
                isWorkMode = false;
                totalSeconds = breakTimeSetting * 60;
                startBtn.innerText = "休息中...";
                updateTimerDisplay();

                targetTime = Date.now() + totalSeconds * 1000;
                runLoopTimer();

            } else {
                // --- 休息時間結束 ---
                if (remainingTomatoes > 0) {
                    isWorkMode = true;
                    totalSeconds = workTimeSetting * 60;
                    startBtn.innerText = "專注計時中...";
                    updateTimerDisplay();

                    targetTime = Date.now() + totalSeconds * 1000;
                    runLoopTimer();
                } else {
                    isRunning = false;
                    startBtn.innerText = "開始";
                    isWorkMode = true;
                    remainingTomatoes = tomatoCountSetting;
                    totalSeconds = workTimeSetting * 60;
                    updateTimerDisplay();
                    updateTomatoDisplayUI();
                }
            }
        }
    }, 1000);
}

if (resetBtn) {
    resetBtn.addEventListener('click', () => {
        clearInterval(timerId);
        isRunning = false;
        isWorkMode = true;
        if (startBtn) startBtn.innerText = "開始";
        totalSeconds = workTimeSetting * 60;
        remainingTomatoes = tomatoCountSetting;
        updateTimerDisplay();
        updateTomatoDisplayUI();
    });
}

function updateTimerDisplay() {
    if (totalSeconds < 0) totalSeconds = 0;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    
    const formattedMinutes = String(minutes).padStart(2, '0');
    const formattedSeconds = String(seconds).padStart(2, '0');
    
    if (timerDisplay) {
        timerDisplay.innerText = `${formattedMinutes}:${formattedSeconds}`;
    }
}

function updateTomatoDisplayUI() {
    const settingCards = document.querySelectorAll('.setting-card');
    if (settingCards.length >= 3) {
        const tomatoValueEl = settingCards[2].querySelector('.setting-value');
        if (tomatoValueEl) {
            tomatoValueEl.innerText = remainingTomatoes;
        }
    }
}


// ==========================================
// 4. 待辦清單管理與任務專注連結
// ==========================================
if (addTaskBtn) {
    addTaskBtn.addEventListener('click', () => {
        const taskText = taskInput.value.trim();
        if (!taskText) {
            alert('請輸入任務內容！');
            return;
        }

        const newTask = {
            id: Date.now(),
            text: taskText,
            completed: false,
            accumulatedMinutes: 0 // 初始累積專注時間
        };

        tasks.push(newTask);
        saveAndRenderTasks();
        taskInput.value = '';
    });
}

function saveAndRenderTasks() {
    localStorage.setItem('pomodoro_tasks', JSON.stringify(tasks));
    renderTasks();
}

function renderTasks() {
    if (!taskList) return;
    taskList.innerHTML = '';
    
    tasks.forEach(task => {
        const isActive = task.id == activeTaskId;
        const li = document.createElement('li');
        li.className = 'todo-card';
        li.style.border = isActive ? '2px solid var(--primary)' : 'none';
        
        li.innerHTML = `
            <label class="custom-checkbox">
                <input type="checkbox" ${task.completed ? 'checked' : ''} onclick="toggleTask(${task.id})">
                <span class="checkmark"></span>
            </label>
            <span class="task-text" style="${task.completed ? 'text-decoration: line-through; color: #A8A29E;' : ''}">${task.text}</span>
            <span class="task-time-badge" style="margin-left: auto;"><i class="fa-solid fa-hourglass-half"></i> ${task.accumulatedMinutes || 0} 分</span>
            <button class="task-focus-btn" onclick="selectActiveTask(${task.id}, '${task.text}')" style="margin-left: 15px;">
                <i class="fa-solid fa-bullseye"></i> ${isActive ? '專注中' : '選擇專注'}
            </button>
            <button onclick="deleteTask(${task.id})" style="margin-left: 15px; background: none; border: none; color: #B48989; cursor: pointer; font-size: 16px;"><i class="fa-solid fa-trash"></i></button>
        `;
        taskList.appendChild(li);
    });
}

window.toggleTask = function(id) {
    tasks = tasks.map(task => task.id === id ? { ...task, completed: !task.completed } : task);
    saveAndRenderTasks();
};

window.deleteTask = function(id) {
    tasks = tasks.filter(task => task.id !== id);
    if (activeTaskId == id) {
        activeTaskId = null;
        localStorage.removeItem('pomodoro_active_task');
        updateActiveTaskUI();
    }
    saveAndRenderTasks();
};

window.selectActiveTask = function(id, text) {
    activeTaskId = id;
    localStorage.setItem('pomodoro_active_task', activeTaskId);
    updateActiveTaskUI();
    renderTasks();
    alert(`已鎖定專注任務：「${text}」！`);
};

function updateActiveTaskUI() {
    if (!activeTaskNameEl) return;
    if (!activeTaskId) {
        activeTaskNameEl.innerText = "尚未選擇任務 (點擊待辦清單設定)";
        return;
    }
    const currentTask = tasks.find(t => t.id == activeTaskId);
    if (currentTask) {
        activeTaskNameEl.innerText = currentTask.text;
    } else {
        activeTaskNameEl.innerText = "尚未選擇任務";
    }
}


// ==========================================
// 5. 換裝商店與 SVG 聯動邏輯
// ==========================================
function changeOutfit(targetOutfitId) {
    const allOutfits = ['dresstest', 'dresstest2'];
    allOutfits.forEach(outfitId => {
        const outfitLayers = document.querySelectorAll(`[id="${outfitId}"]`);
        outfitLayers.forEach(layer => {
            if (outfitId === targetOutfitId) {
                layer.style.display = 'block';
            } else {
                layer.style.display = 'none';
            }
        });
    });
}

document.querySelectorAll('.shop-item').forEach((item, index) => {
    const outfitMap = { 0: 'dresstest', 1: 'dresstest2' };
    item.addEventListener('click', () => {
        if (!outfitMap[index]) return;
        const itemPrice = 50;
        const targetOutfit = outfitMap[index];

        if (unlockedItems.includes(index)) {
            changeOutfit(targetOutfit);
            alert('已為您切換此服裝！');
            return;
        }
        
        if (deductCoins(itemPrice)) {
            unlockedItems.push(index);
            localStorage.setItem('pomodoro_unlocked', JSON.stringify(unlockedItems));
            changeOutfit(targetOutfit);
            alert('購買成功並已換上新衣服！🎉');
            item.style.borderColor = 'var(--primary)';
        }
    });
});


// ==========================================
// 6. 計時設定面板調整邏輯 (+ / - 按鈕綁定)
// ==========================================
let workValueEl, breakValueEl, tomatoValueEl;

const settingCards = document.querySelectorAll('.setting-card');
if (settingCards.length >= 3) {
    workValueEl = settingCards[0].querySelector('.setting-value');
    const workBtns = settingCards[0].querySelectorAll('.circle-btn');
    if (workBtns.length >= 2) {
        workBtns[0].addEventListener('click', () => {
            if (workTimeSetting > 1) { workTimeSetting--; workValueEl.innerText = workTimeSetting; }
        });
        workBtns[1].addEventListener('click', () => {
            workTimeSetting++; workValueEl.innerText = workTimeSetting;
        });
    }

    breakValueEl = settingCards[1].querySelector('.setting-value');
    const breakBtns = settingCards[1].querySelectorAll('.circle-btn');
    if (breakBtns.length >= 2) {
        breakBtns[0].addEventListener('click', () => {
            if (breakTimeSetting > 1) { breakTimeSetting--; breakValueEl.innerText = breakTimeSetting; }
        });
        breakBtns[1].addEventListener('click', () => {
            breakTimeSetting++; breakValueEl.innerText = breakValueEl ? breakTimeSetting : breakTimeSetting++;
        });
    }

    tomatoValueEl = settingCards[2].querySelector('.setting-value');
    const tomatoBtns = settingCards[2].querySelectorAll('.circle-btn');
    if (tomatoBtns.length >= 2) {
        tomatoBtns[0].addEventListener('click', () => {
            if (tomatoCountSetting > 1) { 
                tomatoCountSetting--; 
                tomatoValueEl.innerText = tomatoCountSetting; 
                remainingTomatoes = tomatoCountSetting; 
            }
        });
        tomatoBtns[1].addEventListener('click', () => {
            tomatoCountSetting++; 
            tomatoValueEl.innerText = tomatoCountSetting; 
            remainingTomatoes = tomatoCountSetting; 
        });
    }
}

const applyBtn = document.querySelector('.btn-apply');
if (applyBtn) {
    applyBtn.addEventListener('click', () => {
        if (isRunning) {
            alert('計時中無法更改設定，請先重置計時器！');
            return;
        }
        totalSeconds = workTimeSetting * 60;
        remainingTomatoes = tomatoCountSetting;
        isWorkMode = true;
        updateTimerDisplay();
        alert(`設定已套用！\n專注：${workTimeSetting} 分鐘\n休息：${breakTimeSetting} 分鐘\n總番茄數：${tomatoCountSetting} 輪`);
    });
}
