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

// 🔔 鈴聲按鈕 DOM 抓取
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
let isSoundOn = true; 

// 資料持久化 (localStorage) - [真實資料來源]
let coins = parseInt(localStorage.getItem('pomodoro_coins')) || 120;
let tasks = JSON.parse(localStorage.getItem('pomodoro_tasks')) || [];
let unlockedItems = JSON.parse(localStorage.getItem('pomodoro_unlocked')) || [0]; 
let activeTaskId = localStorage.getItem('pomodoro_active_task') || null;
let currentActiveOutfit = localStorage.getItem('pomodoro_active_outfit') || 'dresstest';
let dailyFocusMilliseconds = JSON.parse(localStorage.getItem('pomodoro_daily_focus_ms')) || {};
let dailyTaskFocusMilliseconds = JSON.parse(localStorage.getItem('pomodoro_daily_task_focus_ms')) || {};
let focusTrackingStartedAt = null;
let focusTrackingTaskId = null;
let heatmapPageIndex = null;
let heatmapPageCount = 0;
let heatmapFollowLatestPage = true;
let harvestPageIndex = 0;
let harvestPageCount = 0;
let harvestFollowLatestPage = false;

// 初始化渲染
migrateLegacyDailyTaskFocus();
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
    alert('金幣不足，無法購買！');
    return false;
}

function updateCoinDisplay() {
    coinValueEls.forEach(el => {
        el.innerText = coins;
    });
}


// ==========================================
// 3. 全自動循環計時、暫停與任務累計時間核心
// ==========================================
if (startBtn) {
    startBtn.addEventListener('click', () => {
        // 如果目前正在計時中，點擊代表要「暫停」
        if (isRunning) {
            if (isWorkMode) {
                recordFocusUntil(Math.min(Date.now(), targetTime));
            }
            clearInterval(timerId); // 清除計時器
            isRunning = false;
            startBtn.innerText = isWorkMode ? "繼續專注" : "繼續休息";
            return;
        }

        // 如果目前是暫停或尚未開始，點擊代表要「開始/繼續」
        if (remainingTomatoes <= 0) {
            remainingTomatoes = tomatoCountSetting;
            isWorkMode = true;
            totalSeconds = workTimeSetting * 60;
        }

        isRunning = true;
        startBtn.innerText = "暫停"; // 計時中顯示「暫停」

        const now = Date.now();
        targetTime = now + totalSeconds * 1000;
        focusTrackingStartedAt = isWorkMode ? now : null;
        focusTrackingTaskId = isWorkMode ? activeTaskId : null;
        runLoopTimer();
    });
}

function runLoopTimer() {
    timerId = setInterval(() => {
        const now = Date.now();
        const remainingMs = targetTime - now;
        totalSeconds = Math.ceil(remainingMs / 1000);

        if (isWorkMode) {
            recordFocusUntil(Math.min(now, targetTime));
        }

        if (totalSeconds > 0) {
            updateTimerDisplay();
        } else {
            clearInterval(timerId);
            
            if (isSoundOn) {
                const alarmSound = document.getElementById('alarm-audio');
                if (alarmSound) {
                    alarmSound.currentTime = 0;
                    alarmSound.play().catch(error => {
                        console.log("播放失敗原因：", error);
                    });
                }
            }

            if (isWorkMode) {
                focusTrackingStartedAt = null;
                focusTrackingTaskId = null;
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

                    const focusStartTime = Date.now();
                    targetTime = focusStartTime + totalSeconds * 1000;
                    focusTrackingStartedAt = focusStartTime;
                    focusTrackingTaskId = activeTaskId;
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
        if (isRunning && isWorkMode) {
            recordFocusUntil(Math.min(Date.now(), targetTime));
        }
        clearInterval(timerId);
        isRunning = false;
        focusTrackingStartedAt = null;
        focusTrackingTaskId = null;
        isWorkMode = true;
        if (startBtn) startBtn.innerText = "開始";
        totalSeconds = workTimeSetting * 60;
        remainingTomatoes = tomatoCountSetting;
        updateTimerDisplay();
        updateTomatoDisplayUI();
    });
}

function getLocalDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function migrateLegacyDailyTaskFocus() {
    const migrationKey = 'pomodoro_daily_task_focus_migrated_v1';
    if (localStorage.getItem(migrationKey) === 'true') return;

    const todayKey = getLocalDateKey(new Date());
    if (!dailyTaskFocusMilliseconds[todayKey]) dailyTaskFocusMilliseconds[todayKey] = {};
    tasks.forEach(task => {
        const taskKey = String(task.id);
        if (dailyTaskFocusMilliseconds[todayKey][taskKey] !== undefined) return;
        const accumulatedMinutes = Number(task.accumulatedMinutes) || 0;
        dailyTaskFocusMilliseconds[todayKey][taskKey] = Math.max(0, accumulatedMinutes) * 60000;
    });
    localStorage.setItem('pomodoro_daily_task_focus_ms', JSON.stringify(dailyTaskFocusMilliseconds));
    localStorage.setItem(migrationKey, 'true');
}

function recordFocusUntil(endTimestamp) {
    if (focusTrackingStartedAt === null || endTimestamp <= focusTrackingStartedAt) return;

    let intervalStart = focusTrackingStartedAt;
    while (intervalStart < endTimestamp) {
        const date = new Date(intervalStart);
        const nextDay = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).getTime();
        const intervalEnd = Math.min(endTimestamp, nextDay);
        const dateKey = getLocalDateKey(date);

        dailyFocusMilliseconds[dateKey] = (dailyFocusMilliseconds[dateKey] || 0) + intervalEnd - intervalStart;
        if (focusTrackingTaskId !== null) {
            if (!dailyTaskFocusMilliseconds[dateKey]) dailyTaskFocusMilliseconds[dateKey] = {};
            const taskKey = String(focusTrackingTaskId);
            dailyTaskFocusMilliseconds[dateKey][taskKey] =
                (dailyTaskFocusMilliseconds[dateKey][taskKey] || 0) + intervalEnd - intervalStart;
        }
        intervalStart = intervalEnd;
    }

    focusTrackingStartedAt = endTimestamp;
    localStorage.setItem('pomodoro_daily_focus_ms', JSON.stringify(dailyFocusMilliseconds));
    localStorage.setItem('pomodoro_daily_task_focus_ms', JSON.stringify(dailyTaskFocusMilliseconds));
    updateHeatmapUI();
    updateTodaysHarvestUI();
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
    updateTodaysHarvestUI();
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

window.selectActiveTask = function(id) {
    activeTaskId = id;
    localStorage.setItem('pomodoro_active_task', activeTaskId);
    updateActiveTaskUI();
    renderTasks();
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
// 5. 換裝商店與 SVG 聯動邏輯 (每次點擊扣 10 金幣)
// ==========================================
function changeOutfit(targetOutfitId) {
    currentActiveOutfit = targetOutfitId;
    localStorage.setItem('pomodoro_active_outfit', targetOutfitId);

    const shopOutfits = ['dresstest', 'dresstest2'];
    document.querySelectorAll('.shop-item').forEach((item, index) => {
        item.classList.toggle('selected', shopOutfits[index] === targetOutfitId);
    });

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
        const itemPrice = 10; // 每次扣 10 金幣
        const targetOutfit = outfitMap[index];

        if (deductCoins(itemPrice)) {
            changeOutfit(targetOutfit);
        }
    });
});

const filterBtns = document.querySelectorAll('.filter-btn');
filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    });
});


// ==========================================
// 6. 計時設定面板調整邏輯
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
// 7. 鈴聲開關按鈕控制邏輯
// ==========================================
if (soundBtn) {
    soundBtn.addEventListener('click', () => {
        isSoundOn = !isSoundOn; 
        const soundIcon = soundBtn.querySelector('i');
        
        if (isSoundOn) {
            if (soundStatus) soundStatus.textContent = '鈴聲: 開';
            soundIcon.className = 'fa-solid fa-bell';
            soundBtn.classList.remove('off');
        } else {
            if (soundStatus) soundStatus.textContent = '鈴聲: 關';
            soundIcon.className = 'fa-solid fa-bell-slash';
            soundBtn.classList.add('off');
            
            const alarmSound = document.getElementById('alarm-audio');
            if (alarmSound) {
                alarmSound.pause();
                alarmSound.currentTime = 0;
            }
        }
    });
}


// ==========================================
// 8. 頁面切換功能
// ==========================================
window.switchPage = function(pageId, event) {
    if (event) event.preventDefault();
    if (pageId !== 'page-shop' && isShopPreviewMode) {
        setShopPreviewMode(false);
    }
    
    document.querySelectorAll('.page-section').forEach(page => {
        page.classList.remove('active');
    });
    
    document.querySelectorAll('.nav-item').forEach(nav => {
        nav.classList.remove('active');
    });
    
    const targetPage = document.getElementById(pageId);
    if (targetPage) {
        targetPage.classList.add('active');
    }
    
    if (event && event.currentTarget) {
        event.currentTarget.classList.add('active');
    }
};


// ==========================================
// 9. 收成紀錄與番茄 SVG 產生器 (夥伴寫的熱力圖 UI)
// ==========================================
function getTomatoSVG(isFilled, extraClass = "") {
    if (isFilled) {
        return `
        <svg width="46" height="54" viewBox="0 0 46 54" fill="none" xmlns="http://www.w3.org/2000/svg" class="tomato-svg tomato-filled ${extraClass}">
            <ellipse cx="23" cy="33" rx="23" ry="21" fill="#F6A36F"/>
            <path d="M21.1016 5.72828C21.7073 3.90052 24.2927 3.90052 24.8985 5.72828L26.1533 9.51453C26.4245 10.3329 27.1896 10.8853 28.0518 10.8853H32.0269C33.974 10.8853 34.7731 13.3848 33.1873 14.5143L30.0399 16.7562C29.325 17.2655 29.0256 18.1813 29.3017 19.0144L30.5199 22.6902C31.1283 24.5259 29.0363 26.0703 27.4612 24.9484L24.1603 22.5972C23.4659 22.1025 22.5342 22.1025 21.8397 22.5972L18.5389 24.9484C16.9637 26.0703 14.8717 24.5259 15.4801 22.6902L16.6983 19.0144C16.9744 18.1813 16.6751 17.2655 15.9602 16.7562L12.8128 14.5143C11.2269 13.3848 12.0261 10.8853 13.9731 10.8853H17.9483C18.8104 10.8853 19.5755 10.3329 19.8467 9.51453L21.1016 5.72828Z" fill="#A9E28F"/>
        </svg>`;
    } else {
        return `
        <svg width="46" height="54" viewBox="0 0 46 54" fill="none" xmlns="http://www.w3.org/2000/svg" class="tomato-svg tomato-empty ${extraClass}">
            <path d="M46 33C46 44.598 35.7025 54 23 54C10.2975 54 0 44.598 0 33C0 21.402 10.2975 12 23 12C35.7025 12 46 21.402 46 33Z" fill="white"/>
            <path d="M46 33C46 44.598 35.7025 54 23 54C10.2975 54 0 44.598 0 33C0 21.402 10.2975 12 23 12C35.7025 12 46 21.402 46 33Z" stroke-width="2" stroke="#F7C2B1"/>
            <path d="M17.9483 10.8853L13.9731 10.8853C12.0261 10.8853 11.2269 13.3848 12.8128 14.5143L15.9602 16.7562C16.6751 17.2655 16.9744 18.1813 16.6983 19.0144L15.4801 22.6902C14.8717 24.5259 16.9637 26.0703 18.5389 24.9484L21.8397 22.5972C22.5342 22.1025 23.4659 22.1025 24.1603 22.5972L27.4612 24.9484C29.0363 26.0703 31.1283 24.5259 30.5199 22.6902L29.3017 19.0144C29.0256 18.1813 29.325 17.2655 30.0399 16.7562L33.1873 14.5143C34.7731 13.3848 33.974 10.8853 32.0269 10.8853L28.0518 10.8853C27.1896 10.8853 26.4245 10.3329 26.1533 9.51453L24.8985 5.72828C24.2927 3.90052 21.7073 3.90052 21.1016 5.72828Z" stroke-width="2" stroke="#F7C2B1"/>
        </svg>`;
    }
}

function updateWeeklyCheckInUI() {
    const streakContainer = document.getElementById('streak-tomatoes-container');
    if (!streakContainer) return;

    streakContainer.innerHTML = '';
    const days = ['一', '二', '三', '四', '五', '六', '日'];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const monday = new Date(today);
    monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));

    days.forEach((day, index) => {
        const date = new Date(monday);
        date.setDate(monday.getDate() + index);
        const dateKey = getLocalDateKey(date);
        const isDone = (dailyFocusMilliseconds[dateKey] || 0) > 0;
        const item = document.createElement('div');
        item.className = 'streak-day-item';
        item.innerHTML = `
            ${getTomatoSVG(isDone, 'week-tomato-icon')}
            <span class="streak-day-label">${day}</span>
        `;
        streakContainer.appendChild(item);
    });
}

function updateHeatmapUI() {
    updateWeeklyCheckInUI();
    const heatmapGrid = document.getElementById('heatmap-grid');
    if (!heatmapGrid) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayKey = getLocalDateKey(today);
    const todayMilliseconds = dailyFocusMilliseconds[todayKey] || 0;
    updateTodayFocusDisplay(todayMilliseconds);

    const activeDateKeys = Object.keys(dailyFocusMilliseconds)
        .filter(dateKey => dailyFocusMilliseconds[dateKey] > 0)
        .sort();
    const getDayNumber = dateKey => {
        const [year, month, day] = dateKey.split('-').map(Number);
        return Date.UTC(year, month - 1, day) / 86400000;
    };
    const addDays = (dateKey, days) => {
        const [year, month, day] = dateKey.split('-').map(Number);
        const date = new Date(year, month - 1, day + days);
        return getLocalDateKey(date);
    };

    const sessions = [];
    activeDateKeys.forEach(dateKey => {
        const currentSession = sessions[sessions.length - 1];
        if (!currentSession || getDayNumber(dateKey) - getDayNumber(currentSession.lastActivityDate) > 7) {
            sessions.push({ startDate: dateKey, lastActivityDate: dateKey });
        } else {
            currentSession.lastActivityDate = dateKey;
        }
    });

    const pages = [];
    sessions.forEach(session => {
        const daysSinceLastActivity = getDayNumber(todayKey) - getDayNumber(session.lastActivityDate);
        const sessionEndDate = daysSinceLastActivity >= 0 && daysSinceLastActivity <= 7
            ? todayKey
            : addDays(session.lastActivityDate, 7);
        const sessionDayCount = getDayNumber(sessionEndDate) - getDayNumber(session.startDate) + 1;
        const sessionPageCount = Math.ceil(sessionDayCount / 28);
        for (let page = 0; page < sessionPageCount; page++) {
            const pageStartDate = addDays(session.startDate, page * 28);
            const pageEndDate = addDays(pageStartDate, 27);
            pages.push({
                startDate: pageStartDate,
                visibleEndDate: getDayNumber(sessionEndDate) < getDayNumber(pageEndDate) ? sessionEndDate : pageEndDate
            });
        }
    });

    const previousButton = document.getElementById('heatmap-prev');
    const nextButton = document.getElementById('heatmap-next');
    const pageNumber = document.getElementById('heatmap-page-number');
    if (pages.length === 0) {
        heatmapPageIndex = null;
        heatmapPageCount = 0;
        heatmapGrid.innerHTML = '<div class="heatmap-empty">開始專注後會建立第一頁日曆</div>';
        if (pageNumber) pageNumber.innerText = '0 / 0';
        if (previousButton) previousButton.disabled = true;
        if (nextButton) nextButton.disabled = true;
        return;
    }

    heatmapPageCount = pages.length;
    if (heatmapPageIndex === null || heatmapFollowLatestPage) {
        heatmapPageIndex = pages.length - 1;
    } else {
        heatmapPageIndex = Math.min(heatmapPageIndex, pages.length - 1);
    }

    const currentPage = pages[heatmapPageIndex];
    heatmapGrid.innerHTML = '';
    for (let index = 0; index < 28; index++) {
        const dateKey = addDays(currentPage.startDate, index);
        const focusMilliseconds = dailyFocusMilliseconds[dateKey] || 0;
        const focusMinutes = Math.floor(focusMilliseconds / 60000);
        const hours = Math.floor(focusMinutes / 60);
        const minutes = focusMinutes % 60;
        const duration = `${hours}:${String(minutes).padStart(2, '0')}`;

        let level = 0;
        if (focusMilliseconds > 10 * 60 * 1000 && focusMilliseconds <= 60 * 60 * 1000) level = 1;
        else if (focusMilliseconds > 60 * 60 * 1000 && focusMilliseconds < 3 * 60 * 60 * 1000) level = 2;
        else if (focusMilliseconds >= 3 * 60 * 60 * 1000 && focusMilliseconds <= 5 * 60 * 60 * 1000) level = 3;
        else if (focusMilliseconds > 5 * 60 * 60 * 1000) level = 4;

        const cell = document.createElement('div');
        cell.className = `heatmap-cell-mini level-${level}`;
        cell.title = `${dateKey}：專注 ${duration}`;

        if (focusMilliseconds > 0) {
            const dateLabel = document.createElement('span');
            dateLabel.className = 'heatmap-date';
            dateLabel.innerText = String(index + 1);

            const durationLabel = document.createElement('span');
            durationLabel.className = 'heatmap-duration';
            durationLabel.innerText = duration;

            cell.append(dateLabel, durationLabel);
        }

        heatmapGrid.appendChild(cell);
    }

    if (pageNumber) pageNumber.innerText = `第 ${heatmapPageIndex + 1} 頁 / ${pages.length} 頁`;
    if (previousButton) previousButton.disabled = heatmapPageIndex === 0;
    if (nextButton) nextButton.disabled = heatmapPageIndex === pages.length - 1;
}

function formatFocusDuration(milliseconds) {
    const totalMinutes = Math.floor(milliseconds / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}:${String(minutes).padStart(2, '0')}`;
}

function updateTodayFocusDisplay(milliseconds) {
    const totalMinutes = Math.floor(milliseconds / 60000);
    const hoursEl = document.getElementById('today-hours-val');
    const minutesEl = document.getElementById('today-minutes-val');
    if (hoursEl) hoursEl.innerText = Math.floor(totalMinutes / 60);
    if (minutesEl) minutesEl.innerText = String(totalMinutes % 60).padStart(2, '0');
}

function updateTodaysHarvestUI() {
    const todayKey = getLocalDateKey(new Date());
    updateTodayFocusDisplay(dailyFocusMilliseconds[todayKey] || 0);

    const subjectListEl = document.getElementById('today-subjects-list');
    if (!subjectListEl) return;

    const todayTasks = dailyTaskFocusMilliseconds[todayKey] || {};
    const taskEntries = tasks
        .map(task => ({
            task,
            milliseconds: todayTasks[String(task.id)] || 0
        }))
        .filter(entry => entry.milliseconds > 0);

    harvestPageCount = Math.ceil(taskEntries.length / 3);
    if (harvestFollowLatestPage) {
        harvestPageIndex = Math.max(0, harvestPageCount - 1);
    } else {
        harvestPageIndex = Math.min(harvestPageIndex, Math.max(0, harvestPageCount - 1));
    }

    subjectListEl.innerHTML = '';
    const pageEntries = taskEntries.slice(harvestPageIndex * 3, harvestPageIndex * 3 + 3);
    subjectListEl.classList.toggle('is-empty', pageEntries.length === 0);
    if (pageEntries.length === 0) {
        const emptyItem = document.createElement('li');
        emptyItem.className = 'harvest-empty';
        emptyItem.innerText = '待辦清單尚無項目';
        subjectListEl.appendChild(emptyItem);
    }

    pageEntries.forEach(({ task, milliseconds }) => {
        const row = document.createElement('li');
        row.className = 'sketch-subject-row';

        const topRow = document.createElement('div');
        topRow.className = 'sub-row-top';

        const name = document.createElement('span');
        name.className = 'sub-name';
        name.innerText = task.text;

        const time = document.createElement('span');
        time.className = 'sub-time';
        const totalMinutes = Math.floor(milliseconds / 60000);
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        time.innerText = hours > 0 ? `${hours} 小時 ${minutes} 分` : `${minutes} 分`;

        topRow.append(name, time);

        const tomatoRow = document.createElement('div');
        tomatoRow.className = 'sub-visual-tomatoes';
        const tomatoCount = Math.min(Math.floor(milliseconds / (10 * 60 * 1000)), 15);
        for (let index = 0; index < tomatoCount; index++) {
            const tomato = document.createElement('span');
            tomato.className = 'harvest-tomato';
            tomato.setAttribute('aria-label', '專注滿10分鐘');
            tomato.innerHTML = getTomatoSVG(true, 'harvest-tomato-icon');
            tomatoRow.appendChild(tomato);
        }

        row.append(topRow, tomatoRow);
        subjectListEl.appendChild(row);
    });

    const previousButton = document.getElementById('harvest-prev');
    const nextButton = document.getElementById('harvest-next');
    const pageNumber = document.getElementById('harvest-page-number');
    if (pageNumber) {
        pageNumber.innerText = harvestPageCount > 0
            ? `第 ${harvestPageIndex + 1} 頁 / ${harvestPageCount} 頁`
            : '0 / 0';
    }
    if (previousButton) previousButton.disabled = harvestPageIndex === 0;
    if (nextButton) nextButton.disabled = harvestPageIndex >= harvestPageCount - 1;
}

function updateSketchAchievementsUI() {
    updateTodaysHarvestUI();
    updateHeatmapUI();
}

document.addEventListener('DOMContentLoaded', () => {
    updateSketchAchievementsUI();

    const previousButton = document.getElementById('heatmap-prev');
    const nextButton = document.getElementById('heatmap-next');
    const harvestPreviousButton = document.getElementById('harvest-prev');
    const harvestNextButton = document.getElementById('harvest-next');
    if (previousButton) {
        previousButton.addEventListener('click', () => {
            if (heatmapPageIndex > 0) {
                heatmapPageIndex--;
                heatmapFollowLatestPage = false;
                updateHeatmapUI();
            }
        });
    }
    if (nextButton) {
        nextButton.addEventListener('click', () => {
            if (heatmapPageIndex < heatmapPageCount - 1) {
                heatmapPageIndex++;
                heatmapFollowLatestPage = heatmapPageIndex === heatmapPageCount - 1;
                updateHeatmapUI();
            }
        });
    }
    if (harvestPreviousButton) {
        harvestPreviousButton.addEventListener('click', () => {
            if (harvestPageIndex > 0) {
                harvestPageIndex--;
                harvestFollowLatestPage = false;
                updateTodaysHarvestUI();
            }
        });
    }
    if (harvestNextButton) {
        harvestNextButton.addEventListener('click', () => {
            if (harvestPageIndex < harvestPageCount - 1) {
                harvestPageIndex++;
                harvestFollowLatestPage = harvestPageIndex === harvestPageCount - 1;
                updateTodaysHarvestUI();
            }
        });
    }
});

// ==========================================
// 10. 換裝商店分類、網格展示與動態調色邏輯
// ==========================================
let currentShopCategory = 'all';
const shopColorCategories = ['eyes', 'mouth', 'eyebrow', 'hair_front', 'hair_ext', 'hair_back', 'ahoge', 'body', 'clothes', 'outer', 'shoes'];
const defaultShopColor = '#FFFFFF';
const previousDefaultShopColor = '#F6A36F';
const savedShopColors = JSON.parse(localStorage.getItem('pomodoro_shop_colors') || '{}');
const shopColors = Object.fromEntries(shopColorCategories.map(category => [
    category,
    /^#[0-9a-f]{6}$/i.test(savedShopColors[category] || '')
        && savedShopColors[category].toLowerCase() !== previousDefaultShopColor.toLowerCase()
        ? savedShopColors[category]
        : defaultShopColor
]));
let activeColorCategory = 'hair_front';
let currentShopColor = shopColors[activeColorCategory];
const selectedShopItems = {
    eyes: 'eye_1',
    mouth: 'mouth_1',
    eyebrow: 'eyebrow_1',
    hair_front: 'hf_1',
    hair_ext: 'he_1',
    hair_back: 'hb_1',
    ahoge: 'ah_1',
    body: 'bd_1',
    clothes: 'cl_1',
    outer: 'ou_1',
    shoes: 'sh_1'
};
let isShopPreviewMode = false;
let previewShopItems = { ...selectedShopItems };

const shopItemsData = [
    // --- 眼睛 (eyes) ---
    { id: 'eye_1', category: 'eyes', name: '眼睛 01', mask: 'images/avatar/eye01_mask.png', line: 'images/avatar/eye01_line.png' },
    { id: 'eye_2', category: 'eyes', name: '眼睛 02', mask: 'images/avatar/eye02_mask.png', line: 'images/avatar/eye02_line.png' },
    { id: 'eye_3', category: 'eyes', name: '眼睛 03', mask: 'images/avatar/eye03_mask.png', line: 'images/avatar/eye03_line.png' },

    // --- 嘴巴 (mouth) ---
    { id: 'mouth_1', category: 'mouth', name: '嘴巴 01', mask: 'images/avatar/mouth_01.png', line: 'images/avatar/mouth_01.png' },
    { id: 'mouth_2', category: 'mouth', name: '嘴巴 02', mask: 'images/avatar/mouth_02.png', line: 'images/avatar/mouth_02.png' },
    { id: 'mouth_3', category: 'mouth', name: '嘴巴 03', mask: 'images/avatar/mouth_03.png', line: 'images/avatar/mouth_03.png' },
    { id: 'mouth_4', category: 'mouth', name: '嘴巴 04', mask: 'images/avatar/mouth_04.png', line: 'images/avatar/mouth_04.png' },

    // --- 眉毛 (eyebrow) ---
    { id: 'eyebrow_1', category: 'eyebrow', name: '眉毛 01', mask: 'images/avatar/eyebrow_01.png', line: 'images/avatar/eyebrow_01.png' },
    { id: 'eyebrow_2', category: 'eyebrow', name: '眉毛 02', mask: 'images/avatar/eyebrow_02.png', line: 'images/avatar/eyebrow_02.png' },
    { id: 'eyebrow_3', category: 'eyebrow', name: '眉毛 03', mask: 'images/avatar/eyebrow_03_mask.png', line: 'images/avatar/eyebrow_03_line.png' },

    // --- 瀏海 (hair_front) ---
    { id: 'hf_1', category: 'hair_front', name: '瀏海 01', mask: 'images/avatar/hair_front_01_mask.png', line: 'images/avatar/hair_front_01_line.png' },
    { id: 'hf_2', category: 'hair_front', name: '瀏海 02', mask: 'images/avatar/hair_front_02_mask.png', line: 'images/avatar/hair_front_02_line.png' },
    { id: 'hf_3', category: 'hair_front', name: '瀏海 03', mask: 'images/avatar/hair_front_03_mask.png', line: 'images/avatar/hair_front_03_line.png' },
    { id: 'hf_4', category: 'hair_front', name: '瀏海 04', mask: 'images/avatar/hair_front_04_mask.png', line: 'images/avatar/hair_front_04_line.png' },
    { id: 'hf_5', category: 'hair_front', name: '瀏海 05', mask: 'images/avatar/hair_front_05_mask.png', line: 'images/avatar/hair_front_05_line.png' },
    { id: 'hf_6', category: 'hair_front', name: '瀏海 06', mask: 'images/avatar/hair_front_06_mask.png', line: 'images/avatar/hair_front_06_line.png' },

    // --- 辮髮 (hair_ext) ---
    { id: 'he_1', category: 'hair_ext', name: '辮髮 01', mask: 'images/avatar/hair_ext_01_mask.png', line: 'images/avatar/hair_ext_01_line.png' },
    { id: 'he_2', category: 'hair_ext', name: '辮髮 02', mask: 'images/avatar/hair_ext_02_mask.png', line: 'images/avatar/hair_ext_02_line.png' },
    { id: 'he_3', category: 'hair_ext', name: '辮髮 03', mask: 'images/avatar/hair_ext_03_mask.png', line: 'images/avatar/hair_ext_03_line.png' },
    { id: 'he_4', category: 'hair_ext', name: '辮髮 04', mask: 'images/avatar/hair_ext_04_mask.png', line: 'images/avatar/hair_ext_04_line.png' },

    // --- 後髮 (hair_back) ---
    { id: 'hb_1', category: 'hair_back', name: '後髮 01', mask: 'images/avatar/hair_back_01_mask.png', line: 'images/avatar/hair_back_01_line.png' },
    { id: 'hb_2', category: 'hair_back', name: '後髮 02', mask: 'images/avatar/hair_back_02_mask.png', line: 'images/avatar/hair_back_02_line.png' },

    // --- 呆毛 (ahoge) ---
    { id: 'ah_1', category: 'ahoge', name: '呆毛 01', mask: 'images/avatar/ahoge_01_mask.png', line: 'images/avatar/ahoge_01_mask.png' },
    { id: 'ah_2', category: 'ahoge', name: '呆毛 02', mask: 'images/avatar/ahoge_02_mask.png', line: 'images/avatar/ahoge_02_line.png' },
    { id: 'ah_3', category: 'ahoge', name: '呆毛 03', mask: 'images/avatar/ahoge_03_mask.png', line: 'images/avatar/ahoge_03_line.png' },

    // --- 身體 (body) ---
    { id: 'bd_1', category: 'body', name: '身體 01', mask: 'images/avatar/body_01_mask.png', line: 'images/avatar/body_01_line.png' },

    // --- 衣服 (clothes) ---
    { id: 'cl_1', category: 'clothes', name: '衣服 01', mask: 'images/avatar/clothes_base_01.png', line: 'images/avatar/clothes_base_01.png' },
    { id: 'cl_2', category: 'clothes', name: '衣服 02', mask: 'images/avatar/clothes_base_02_mask.png', line: 'images/avatar/clothes_base_02_line.png' },
    { id: 'cl_3', category: 'clothes', name: '衣服 03', mask: 'images/avatar/clothes_base_03_mask.png', line: 'images/avatar/clothes_base_03_line.png' },

    // --- 外套 (outer) ---
    { id: 'ou_1', category: 'outer', name: '外套 01', mask: 'images/avatar/clothes_outer_01_mask.png', line: 'images/avatar/clothes_outer_01_line.png' },

    // --- 鞋子 (shoes) ---
    { id: 'sh_1', category: 'shoes', name: '鞋子 01', mask: 'images/avatar/shoes_01_mask.png', line: 'images/avatar/shoes_01_line.png' }
];

const shopItemUnlockPrices = {
    hair_ext: 5,
    body: 30,
    hair_back: 5,
    ahoge: 2,
    eyes: 5,
    mouth: 5,
    hair_front: 5,
    eyebrow: 2,
    clothes: 30,
    outer: 30,
    shoes: 5
};
const defaultUnlockedShopItems = shopItemsData
    .filter(item => item.name.endsWith('01'))
    .map(item => item.id);
const storedUnlockedShopItems = JSON.parse(localStorage.getItem('pomodoro_unlocked_shop_items') || '[]');
const unlockedShopItems = [...new Set([
    ...defaultUnlockedShopItems,
    ...storedUnlockedShopItems.filter(itemId => shopItemsData.some(item => item.id === itemId))
])];
localStorage.setItem('pomodoro_unlocked_shop_items', JSON.stringify(unlockedShopItems));

function confirmShopItemPurchase(item) {
    const dialog = document.getElementById('shop-purchase-dialog');
    const message = document.getElementById('shop-purchase-message');
    const confirmButton = document.getElementById('shop-purchase-yes');
    const cancelButton = document.getElementById('shop-purchase-no');
    if (!dialog || !message || !confirmButton || !cancelButton) {
        throw new Error('找不到商店購買確認視窗所需的頁面元素。');
    }

    message.textContent = `是否購買「${item.name}」？`;
    return new Promise(resolve => {
        const handleClose = () => resolve(dialog.returnValue === 'yes');
        dialog.addEventListener('close', handleClose, { once: true });
        confirmButton.onclick = () => dialog.close('yes');
        cancelButton.onclick = () => dialog.close('no');
        dialog.showModal();
    });
}

function renderShopGrid(category = 'all') {
    const gridContainer = document.getElementById('shop-grid-container');
    if (!gridContainer) return;

    gridContainer.innerHTML = '';
    const filteredItems = category === 'all' 
        ? shopItemsData 
        : shopItemsData.filter(item => item.category === category);

    if (filteredItems.length === 0) {
        gridContainer.innerHTML = '<div style="grid-column: 1/-1; text-align:center; color: var(--text-muted); padding: 20px;">此分類尚無道具</div>';
        return;
    }

    filteredItems.forEach(item => {
        const isSelected = item.id === (isShopPreviewMode
            ? previewShopItems[item.category]
            : selectedShopItems[item.category]);
        const isUnlocked = unlockedShopItems.includes(item.id);
        const showAsLocked = !isShopPreviewMode && !isUnlocked;
        const div = document.createElement('div');
        div.className = `shop-item ${isSelected ? 'selected' : ''} ${showAsLocked ? 'shop-item-locked' : ''}`;
        div.dataset.category = item.category;
        const preview = document.createElement('div');
        preview.className = 'shop-item-preview';

        const maskLayer = document.createElement('div');
        maskLayer.className = 'shop-thumb-mask';
        maskLayer.style.backgroundColor = shopColors[item.category];
        const maskImage = `url("${item.mask}")`;
        maskLayer.style.maskImage = maskImage;
        maskLayer.style.setProperty('-webkit-mask-image', maskImage);
        preview.appendChild(maskLayer);

        const lineLayer = document.createElement('img');
        lineLayer.src = item.line;
        lineLayer.className = 'shop-thumb-layer';
        lineLayer.alt = `${item.name} line`;
        if (item.mask === item.line) {
            lineLayer.classList.add('shop-thumb-original');
        }
        preview.appendChild(lineLayer);
        if (showAsLocked) {
            const lockOverlay = document.createElement('span');
            lockOverlay.className = 'shop-item-lock-overlay';
            lockOverlay.setAttribute('aria-label', '尚未解鎖');
            lockOverlay.innerHTML = '<i class="fa-solid fa-lock" aria-hidden="true"></i>';
            preview.appendChild(lockOverlay);
        }

        const itemName = document.createElement('span');
        itemName.className = 'shop-item-name';
        itemName.textContent = item.name;
        div.prepend(preview);
        div.appendChild(itemName);
        if (showAsLocked) {
            const priceLabel = document.createElement('span');
            priceLabel.className = 'shop-item-price';
            priceLabel.setAttribute('aria-label', `解鎖需要 ${shopItemUnlockPrices[item.category]} 金幣`);
            priceLabel.innerHTML = `<i class="fa-solid fa-coins icon-coin" aria-hidden="true"></i><span>${shopItemUnlockPrices[item.category]}</span>`;
            div.appendChild(priceLabel);
        }
        div.onclick = async () => {
            if (!isShopPreviewMode && !unlockedShopItems.includes(item.id)) {
                if (!await confirmShopItemPurchase(item)) return;
                if (!deductCoins(shopItemUnlockPrices[item.category])) return;
                unlockedShopItems.push(item.id);
                localStorage.setItem('pomodoro_unlocked_shop_items', JSON.stringify(unlockedShopItems));
            }

            if (isShopPreviewMode) {
                previewShopItems[item.category] = item.id;
            } else {
                selectedShopItems[item.category] = item.id;
            }
            setActiveColorCategory(item.category);
            const targetContainers = isShopPreviewMode
                ? document.querySelectorAll('#page-shop .avatar-layered-container')
                : document.querySelectorAll('.avatar-layered-container');
            targetContainers.forEach(container => {
                equipShopItem(container, item);
            });
            renderShopGrid(currentShopCategory);
        };
        gridContainer.appendChild(div);
    });
}

const avatarLayerNames = {
    hair_ext: { mask: 'hair ext mask', line: 'hair ext line' },
    body: { mask: 'body mask', line: 'body line' },
    hair_back: { mask: 'hair back mask', line: 'hair back line' },
    eyes: { mask: 'eye mask', line: 'eye line' },
    mouth: { line: 'mouth' },
    hair_front: { mask: 'hair front mask', line: 'hair front line' },
    eyebrow: { line: 'eyebrow' },
    clothes: { mask: 'clothes mask', line: 'clothes line' },
    outer: { mask: 'outer mask', line: 'outer line' },
    shoes: { mask: 'shoes mask', line: 'shoes line' }
};

function setShopPreviewMode(enabled) {
    if (isShopPreviewMode === enabled) return;

    isShopPreviewMode = enabled;
    if (enabled) {
        previewShopItems = { ...selectedShopItems };
    } else {
        const shopPreview = document.querySelector('#page-shop .avatar-layered-container');
        if (shopPreview) {
            Object.values(selectedShopItems)
                .map(itemId => shopItemsData.find(item => item.id === itemId))
                .filter(Boolean)
                .forEach(item => equipShopItem(shopPreview, item));
        }
    }

    const toggle = document.getElementById('shop-preview-toggle');
    const status = document.getElementById('shop-preview-status');
    if (toggle) toggle.setAttribute('aria-checked', String(enabled));
    if (status) status.textContent = enabled ? 'ON' : 'OFF';
    renderShopGrid(currentShopCategory);
}

function equipShopItem(container, item) {
    let maskLayer;
    let lineLayer;

    if (item.category === 'ahoge') {
        const masks = [...container.querySelectorAll('img.avatar-mask[alt^="ahoge"]')];
        const lines = [...container.querySelectorAll('img.avatar-line[alt^="ahoge"]')];
        maskLayer = masks[0];
        lineLayer = lines[0];
        masks.forEach((layer, index) => {
            layer.style.display = index === 0 ? '' : 'none';
        });
        lines.forEach((layer, index) => {
            layer.style.display = index === 0 ? '' : 'none';
        });
    } else {
        const layerNames = avatarLayerNames[item.category];
        if (!layerNames) return;
        if (layerNames.mask) {
            maskLayer = container.querySelector(`img.avatar-mask[alt="${layerNames.mask}"]`);
        }
        lineLayer = container.querySelector(`img.avatar-line[alt="${layerNames.line}"]`);
    }

    if (!lineLayer) return;

    if (maskLayer) {
        maskLayer.src = item.mask;
        maskLayer.style.visibility = 'hidden';
    }

    let tintLayer = container.querySelector(`.avatar-mask-tint[data-category="${item.category}"]`);
    if (!tintLayer) {
        tintLayer = document.createElement('div');
        tintLayer.className = 'avatar-mask-tint';
        tintLayer.dataset.category = item.category;
        container.appendChild(tintLayer);
    }

    const maskImage = `url("${item.mask}")`;
    tintLayer.style.maskImage = maskImage;
    tintLayer.style.setProperty('-webkit-mask-image', maskImage);
    tintLayer.style.backgroundColor = shopColors[item.category];
    tintLayer.style.zIndex = maskLayer
        ? maskLayer.style.zIndex
        : String(Math.max(0, Number(lineLayer.style.zIndex) - 1));

    lineLayer.src = item.line;
    lineLayer.style.filter = item.category === 'ahoge' && item.mask === item.line
        ? 'drop-shadow(1px 0 #8E4849) drop-shadow(-1px 0 #8E4849) drop-shadow(0 1px #8E4849) drop-shadow(0 -1px #8E4849)'
        : '';
    lineLayer.style.display = '';
    lineLayer.classList.toggle('avatar-layer-line-original', item.mask === item.line);
}

function setActiveColorCategory(category) {
    if (!shopColorCategories.includes(category)) return;

    activeColorCategory = category;
    currentShopColor = shopColors[category];

    const colorInput = document.getElementById('custom-color-input');
    if (colorInput) colorInput.value = currentShopColor;

    const targetLabel = document.getElementById('mask-color-target');
    if (targetLabel) targetLabel.textContent = `套用至：${getCategoryChineseName(category)}`;
}

window.filterShopCategory = function(category) {
    currentShopCategory = category;
    setActiveColorCategory(category);
    document.querySelectorAll('.filter-toggle .filter-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.textContent.includes(getCategoryChineseName(category))) {
            btn.classList.add('active');
        }
    });
    renderShopGrid(category);
};

function getCategoryChineseName(cat) {
    const map = { 
        all: '全部', 
        hair_ext: '辮髮', 
        body: '身體', 
        hair_back: '後髮', 
        ahoge: '呆毛', 
        eyes: '眼睛', 
        mouth: '嘴巴', 
        hair_front: '瀏海', 
        eyebrow: '眉毛', 
        clothes: '衣服', 
        outer: '外套', 
        shoes: '鞋子' 
    };
    return map[cat] || '';
}

window.applyColor = function(hexColor) {
    currentShopColor = hexColor;
    shopColors[activeColorCategory] = hexColor;
    localStorage.setItem('pomodoro_shop_colors', JSON.stringify(shopColors));

    const shopGrid = document.getElementById('shop-grid-container');
    if (shopGrid) {
        shopGrid.querySelectorAll(`.shop-item[data-category="${activeColorCategory}"] .shop-thumb-mask`)
            .forEach(layer => {
                layer.style.backgroundColor = hexColor;
            });
    }

    document.querySelectorAll(`.avatar-mask-tint[data-category="${activeColorCategory}"]`).forEach(layer => {
        layer.style.backgroundColor = hexColor;
    });

    const colorInput = document.getElementById('custom-color-input');
    if (colorInput && colorInput.value.toLowerCase() !== hexColor.toLowerCase()) {
        colorInput.value = hexColor;
    }

};

window.pickScreenColor = async function() {
    if (typeof window.EyeDropper !== 'function') {
        return;
    }

    try {
        const { sRGBHex } = await new window.EyeDropper().open();
        window.applyColor(sRGBHex);
    } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
            return;
        }

        console.error('無法使用滴管吸取顏色。', error);
    }
};

// 確保網頁載入時自動渲染商店格子
document.addEventListener('DOMContentLoaded', () => {
    renderShopGrid('all');
    setActiveColorCategory(activeColorCategory);
    const initialItems = Object.values(selectedShopItems)
        .map(itemId => shopItemsData.find(item => item.id === itemId))
        .filter(Boolean);
    document.querySelectorAll('.avatar-layered-container').forEach(container => {
        initialItems.forEach(item => equipShopItem(container, item));
    });
    window.applyColor(currentShopColor);

    const previewToggle = document.getElementById('shop-preview-toggle');
    if (previewToggle) {
        previewToggle.addEventListener('click', () => {
            setShopPreviewMode(!isShopPreviewMode);
        });
    }

    const eyedropperButton = document.getElementById('eyedropper-btn');
    if (eyedropperButton && typeof window.EyeDropper !== 'function') {
        eyedropperButton.disabled = true;
        eyedropperButton.title = '此瀏覽器不支援滴管，請使用自訂調色盤滑動選色';
    }
});