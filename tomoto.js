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

const soundBtn = document.getElementById('sound-toggle-btn');
const soundStatus = document.getElementById('sound-status');

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

let coins = parseInt(localStorage.getItem('pomodoro_coins')) || 120;
let tasks = JSON.parse(localStorage.getItem('pomodoro_tasks')) || [];
let unlockedItems = JSON.parse(localStorage.getItem('pomodoro_unlocked')) || [0]; 
let activeTaskId = localStorage.getItem('pomodoro_active_task') || null;
let currentActiveOutfit = localStorage.getItem('pomodoro_active_outfit') || 'dresstest';

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
// 3. 全自動循環計時、暫停與任務累計時間核心
// ==========================================
if (startBtn) {
    startBtn.addEventListener('click', () => {
        if (isRunning) {
            clearInterval(timerId); 
            isRunning = false;
            startBtn.innerText = isWorkMode ? "繼續專注" : "繼續休息";
            return;
        }

        if (remainingTomatoes <= 0) {
            remainingTomatoes = tomatoCountSetting;
            isWorkMode = true;
            totalSeconds = workTimeSetting * 60;
        }

        isRunning = true;
        startBtn.innerText = "暫停"; 

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
// 5. 換裝商店與 SVG 聯動邏輯
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
// 9. 收成紀錄渲染邏輯
// ==========================================
function updateHarvestUI() {
    let todayTotalMinutes = 0;
    const subjectListEl = document.getElementById('today-subject-list');
    const activeTasks = tasks.filter(t => t.accumulatedMinutes && t.accumulatedMinutes > 0);
    
    if (subjectListEl) {
        if (activeTasks.length > 0) {
            subjectListEl.innerHTML = ''; 
            activeTasks.forEach(task => {
                todayTotalMinutes += task.accumulatedMinutes;
                const tomatoCount = Math.floor(task.accumulatedMinutes / 25) || 1; 
                
                const li = document.createElement('li');
                li.className = 'subject-item';
                li.innerHTML = `
                    <span class="sub-name"><i class="fa-solid fa-seedling"></i> ${task.text}</span>
                    <span class="sub-time">${(task.accumulatedMinutes / 60).toFixed(1)}h (${tomatoCount} 🍅)</span>
                `;
                subjectListEl.appendChild(li);
            });
        } else {
            subjectListEl.innerHTML = '<li class="empty-subject">今日尚未有收成，趕快至待辦清單設定任務並開始計時吧！</li>';
        }
    }

    const todayTotalHours = (todayTotalMinutes / 60).toFixed(1);
    const totalHoursEl = document.getElementById('today-total-hours');
    if (totalHoursEl) totalHoursEl.innerText = todayTotalHours;

    const vineNodesEl = document.getElementById('weekly-vine-nodes');
    if (!vineNodesEl) return;
    vineNodesEl.innerHTML = '';
    
    const daysOfWeek = ['一', '二', '三', '四', '五', '六', '日'];
    const mockWeeklyStatus = [true, true, false, true, false, false, false]; 
    const currentDayIndex = 3; 

    const getTomatoSVG = (isFilled) => `
        <svg viewBox="0 0 100 100" class="tomato-svg ${isFilled ? 'tomato-filled' : 'tomato-empty'}">
            <path class="tomato-leaf" d="M50 15 Q40 5 30 20 Q45 25 50 20 Q55 25 70 20 Q60 5 50 15 Z" />
            <path class="tomato-body" d="M50 25 C80 25 90 50 85 75 C80 95 60 95 50 90 C40 95 20 95 15 75 C10 50 20 25 50 25 Z" />
        </svg>
    `;

    daysOfWeek.forEach((day, index) => {
        const isCompleted = mockWeeklyStatus[index];
        const isToday = index === currentDayIndex;
        
        node = document.createElement('div');
        node.className = `day-node ${isToday ? 'active' : ''}`;
        node.innerHTML = `
            <div class="tomato-icon">${getTomatoSVG(isCompleted)}</div>
            <span class="day-label">${day}</span>
        `;
        vineNodesEl.appendChild(node);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    updateHarvestUI();
});
