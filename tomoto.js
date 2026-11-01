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

// 🔔 新增：鈴聲按鈕 DOM 抓取
const soundBtn = document.getElementById('sound-toggle-btn');
const soundStatus = document.getElementById('sound-status');

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
let isSoundOn = true; // 🔔 新增：鈴聲開關狀態紀錄 (預設開啟)

// 資料持久化 (localStorage)
let coins = parseInt(localStorage.getItem('pomodoro_coins')) || 120;
let tasks = JSON.parse(localStorage.getItem('pomodoro_tasks')) || [];
let unlockedItems = JSON.parse(localStorage.getItem('pomodoro_unlocked')) || [0]; 
let activeTaskId = localStorage.getItem('pomodoro_active_task') || null;
let currentActiveOutfit = localStorage.getItem('pomodoro_active_outfit') || 'dresstest';

// 初始化渲染
updateCoinDisplay();
renderTasks();
updateTimerDisplay();
updateActiveTaskUI();
changeOutfit(currentActiveOutfit);


// ==========================================
// 2. 動態金幣計算管理
// ==========================================
function addCoins(amount) {
    coins += amount;
    localStorage.setItem('pomodoro_coins', coins);
    updateCoinDisplay();
}

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
            
            // 🔔 修改：加入鈴聲開關判斷
            if (isSoundOn) {
                const alarmSound = document.getElementById('alarm-audio');
                if (alarmSound) {
                    alarmSound.currentTime = 0; // 讓音樂從頭開始播
                    alarmSound.play().catch(error => {
                        console.log("播放失敗原因：", error);
                    });
                }
            }

            if (isWorkMode) {
                const earnedCoins = calculateCoinsForWork(workTimeSetting);
                addCoins(earnedCoins); 
                
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

                isWorkMode = false;
                totalSeconds = breakTimeSetting * 60;
                startBtn.innerText = "休息中...";
                updateTimerDisplay();

                targetTime = Date.now() + totalSeconds * 1000;
                runLoopTimer();

            } else {
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
            accumulatedMinutes: 0 
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
// 5. 換裝商店與 SVG 聯動邏輯 (無通知靜默切換)
// ==========================================
function changeOutfit(targetOutfitId) {
    currentActiveOutfit = targetOutfitId;
    localStorage.setItem('pomodoro_active_outfit', targetOutfitId);

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

// 綁定換裝商店裡卡片的點擊事件 (已移除 alert 通知)
document.querySelectorAll('.shop-item').forEach((item, index) => {
    const outfitMap = { 0: 'dresstest', 1: 'dresstest2' };
    item.addEventListener('click', () => {
        if (!outfitMap[index]) return;
        const itemPrice = 50;
        const targetOutfit = outfitMap[index];

        if (unlockedItems.includes(index)) {
            changeOutfit(targetOutfit);
            return;
        }
        
        if (deductCoins(itemPrice)) {
            unlockedItems.push(index);
            localStorage.setItem('pomodoro_unlocked', JSON.stringify(unlockedItems));
            changeOutfit(targetOutfit);
            item.style.borderColor = 'var(--primary)';
        }
    });
});

// 換裝商店分類切換按鈕邏輯 (全部 / 髮型 / 服飾)
const filterBtns = document.querySelectorAll('.filter-btn');
filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        // 可依需求擴充篩選邏輯
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
            if (breakTimeSetting > 1) { breakTimeSetting--; breakValueEl.innerText = breakValueEl ? breakTimeSetting : breakValueEl; }
        });
        breakBtns[1].addEventListener('click', () => {
            breakTimeSetting++; breakValueEl.innerText = breakTimeSetting;
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


// ==========================================
// 7. 新增：右下角鈴聲開關按鈕控制邏輯
// ==========================================
if (soundBtn) {
    soundBtn.addEventListener('click', () => {
        isSoundOn = !isSoundOn; // 切換狀態
        const soundIcon = soundBtn.querySelector('i');
        
        if (isSoundOn) {
            // 切換為 開啟 狀態
            if (soundStatus) soundStatus.textContent = '鈴聲: 開';
            soundIcon.className = 'fa-solid fa-bell';
            soundBtn.classList.remove('off');
        } else {
            // 切換為 關閉 狀態
            if (soundStatus) soundStatus.textContent = '鈴聲: 關';
            soundIcon.className = 'fa-solid fa-bell-slash';
            soundBtn.classList.add('off');
            
            // 如果切換時鈴聲剛好在播放，立刻將其靜音/暫停
            const alarmSound = document.getElementById('alarm-audio');
            if (alarmSound) {
                alarmSound.pause();
                alarmSound.currentTime = 0;
            }
        }
    });
}


// ==========================================
// 頁面切換功能
// ==========================================
window.switchPage = function(pageId, event) {
    if (event) event.preventDefault();
    
    // 隱藏所有頁面內容
    document.querySelectorAll('.page-section').forEach(page => {
        page.classList.remove('active');
    });
    
    // 移除所有左側選單的 active 狀態
    document.querySelectorAll('.nav-item').forEach(nav => {
        nav.classList.remove('active');
    });
    
    // 顯示目標頁面
    const targetPage = document.getElementById(pageId);
    if (targetPage) {
        targetPage.classList.add('active');
    }
    
    // 替當前點擊的按鈕加上 active 狀態
    if (event && event.currentTarget) {
        event.currentTarget.classList.add('active');
    }
};


// ==========================================
// 8. 我的成就 (今日學習、連續打卡、熱力田) 邏輯
// ==========================================
function updateAchievementsUI() {
    // --- A. 更新今日學習 ---
    const subjectListEl = document.getElementById('today-subjects-list');
    let todayTotalMinutes = 0;
    const activeTasks = tasks.filter(t => t.accumulatedMinutes && t.accumulatedMinutes > 0);
    
    if (subjectListEl) {
        if (activeTasks.length > 0) {
            subjectListEl.innerHTML = '';
            activeTasks.forEach(task => {
                todayTotalMinutes += task.accumulatedMinutes;
                const tomatoCount = Math.floor(task.accumulatedMinutes / 25) || 1; 
                subjectListEl.innerHTML += `
                    <li>
                        <span>${task.text}</span>
                        <span style="color: var(--text-gray); font-family: 'Nunito', sans-serif;">${tomatoCount} 🍅</span>
                    </li>
                `;
            });
        } else {
            subjectListEl.innerHTML = '<li class="empty-hint">今日尚未開始專注</li>';
        }
    }

    const todayTotalHours = (todayTotalMinutes / 60).toFixed(1);
    const totalHoursEl = document.getElementById('today-time-val');
    if (totalHoursEl) totalHoursEl.innerText = todayTotalHours;


    // --- B. 更新一週番茄藤 ---
    const streakContainer = document.getElementById('streak-tomatoes-container');
    if (streakContainer) {
        streakContainer.innerHTML = '';
        const days = ['一', '二', '三', '四', '五', '六', '日'];
        // 模擬本週打卡狀態 (實務上可串接 localStorage 每日紀錄)
        const mockStreakData = [true, true, false, true, false, false, false]; 
        const todayIndex = 3; // 假設今天是星期四
        
        const getTomatoSVG = (isFilled) => `
            <svg viewBox="0 0 100 100" class="tomato-svg ${isFilled ? 'tomato-filled' : 'tomato-empty'}">
                <path class="t-leaf" d="M50 15 Q40 5 30 20 Q45 25 50 20 Q55 25 70 20 Q60 5 50 15 Z" />
                <path class="t-body" d="M50 25 C80 25 90 50 85 75 C80 95 60 95 50 90 C40 95 20 95 15 75 C10 50 20 25 50 25 Z" />
            </svg>
        `;

        days.forEach((day, index) => {
            const isCompleted = mockStreakData[index];
            const isToday = index === todayIndex;
            streakContainer.innerHTML += `
                <div class="streak-day ${isToday ? 'active' : ''}">
                    ${getTomatoSVG(isCompleted)}
                    <span class="streak-label">${day}</span>
                </div>
            `;
        });
    }

    // --- C. 產生專注熱力田 ---
    const heatmapGrid = document.getElementById('heatmap-grid');
    if (heatmapGrid) {
        heatmapGrid.innerHTML = '';
        // 產生半年份 (26週 x 7天 = 182天) 的方格
        const totalDays = 26 * 7; 
        
        for (let i = 0; i < totalDays; i++) {
            const cell = document.createElement('div');
            // 隨機產生假資料來呈現田地的顏色錯落感
            // 等級 0: 未專注 (預設土壤色), 1~4: 專注等級
            const randomLevel = Math.random() > 0.6 ? Math.floor(Math.random() * 4) + 1 : 0;
            
            cell.className = `heatmap-cell ${randomLevel > 0 ? 'level-' + randomLevel : ''}`;
            heatmapGrid.appendChild(cell);
        }
    }
}

// 頁面載入時初始化成就畫面
document.addEventListener('DOMContentLoaded', () => {
    updateAchievementsUI();
});
