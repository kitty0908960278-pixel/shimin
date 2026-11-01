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
// 3. 全自動循環計時、暫停與任務累計時間核心 (已修復暫停按鈕邏輯)
// ==========================================
if (startBtn) {
    startBtn.addEventListener('click', () => {
        // 如果目前正在計時中，點擊代表要「暫停」
        if (isRunning) {
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
// 5. 換裝商店與 SVG 聯動邏輯 (每次點擊扣 10 金幣)
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
            if (breakTimeSetting > 1) { breakTimeSetting--; breakValueEl.innerText = breakValueEl; }
        });
        breakBtns[1].addEventListener('click', () => {
            breakTimeSetting++; breakValueEl.innerText = breakValueEl;
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

function updateSketchAchievementsUI() {
    const mockTodayData = {
        totalHours: 4.1,
        subjects: [
            { name: '經濟學期中複習', accumulatedMinutes: 138 }, 
            { name: 'Java 程式設計', accumulatedMinutes: 78 },  
            { name: '英文單字背誦', accumulatedMinutes: 30 }    
        ]
    };

    const totalTimeEl = document.getElementById('today-time-val');
    if (totalTimeEl) totalTimeEl.innerText = mockTodayData.totalHours;

    const subjectListEl = document.getElementById('today-subjects-list');
    if (subjectListEl) {
        subjectListEl.innerHTML = '';
        mockTodayData.subjects.forEach(sub => {
            const tomatoCount = Math.floor(sub.accumulatedMinutes / 25) || 1; 
            let tomatoesHTML = '';
            for (let i = 0; i < tomatoCount; i++) {
                tomatoesHTML += getTomatoSVG(true, 'mini-tomato');
            }

            const subjectHours = (sub.accumulatedMinutes / 60).toFixed(1);

            subjectListEl.innerHTML += `
                <li class="sketch-subject-row">
                    <div class="sub-row-top">
                        <span class="sub-name"><i class="fa-solid fa-leaf" style="color: #A9E28F;"></i> ${sub.name}</span>
                        <span class="sub-time">${subjectHours} h</span>
                    </div>
                    <div class="sub-visual-tomatoes">
                        ${tomatoesHTML}
                    </div>
                </li>
            `;
        });
    }

    const streakContainer = document.getElementById('streak-tomatoes-container');
    if (streakContainer) {
        streakContainer.innerHTML = '';
        const days = ['一', '二', '三', '四', '五', '六', '日'];
        const weeklyStatus = [true, true, true, false, true, false, false]; 
        
        days.forEach((day, index) => {
            const isDone = weeklyStatus[index];
            const item = document.createElement('div');
            item.className = 'streak-day-item';
            item.innerHTML = `
                ${getTomatoSVG(isDone, 'week-tomato-icon')}
                <span class="streak-day-label">${day}</span>
            `;
            streakContainer.appendChild(item);
        });
    }

    const heatmapGrid = document.getElementById('heatmap-grid');
    if (heatmapGrid) {
        heatmapGrid.innerHTML = '';
        const totalCells = 28; 
        const mockLevels = [
            0, 1, 2, 3, 4, 2, 0,
            1, 3, 4, 2, 1, 3, 4,
            2, 4, 3, 1, 0, 2, 3,
            4, 2, 1, 3, 4, 1, 0
        ];
        
        for (let i = 0; i < totalCells; i++) {
            const level = mockLevels[i] || 0;
            const cell = document.createElement('div');
            cell.className = `heatmap-cell-mini ${level > 0 ? 'level-' + level : ''}`;
            cell.title = `倒數第 ${28 - i} 天：收成等級 ${level}`;
            heatmapGrid.appendChild(cell);
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    updateSketchAchievementsUI();
});
