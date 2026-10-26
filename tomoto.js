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

// 計時器相關狀態
let totalSeconds = 25 * 60; // 預設 25 分鐘
let timerId = null;
let isRunning = false;
let targetTime = null;

// 資料持久化 (localStorage)
let coins = parseInt(localStorage.getItem('pomodoro_coins')) || 120; // 預設 120 金幣
let tasks = JSON.parse(localStorage.getItem('pomodoro_tasks')) || [];
let unlockedItems = JSON.parse(localStorage.getItem('pomodoro_unlocked')) || []; // 已購買的商品

// 初始化渲染
updateCoinDisplay();
renderTasks();
updateTimerDisplay();


// ==========================================
// 2. 金幣系統管理
// ==========================================
function addCoins(amount) {
    coins += amount;
    localStorage.setItem('pomodoro_coins', coins);
    updateCoinDisplay();
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
// 3. 25分鐘倒數計時與背景計時（完成賺金幣）
// ==========================================
startBtn.addEventListener('click', () => {
    if (isRunning) return;
    isRunning = true;
    startBtn.innerText = "計時中...";

    targetTime = Date.now() + totalSeconds * 1000;

    timerId = setInterval(() => {
        const now = Date.now();
        const remainingMs = targetTime - now;
        totalSeconds = Math.ceil(remainingMs / 1000);

        if (totalSeconds > 0) {
            updateTimerDisplay();
        } else {
            clearInterval(timerId);
            isRunning = false;
            startBtn.innerText = "開始";
            totalSeconds = 0;
            updateTimerDisplay();

            addCoins(20);
            alert('恭喜完成 25 分鐘專注！獲得 20 金幣獎勵 🎉');

            totalSeconds = 25 * 60;
            updateTimerDisplay();
        }
    }, 1000);
});

resetBtn.addEventListener('click', () => {
    clearInterval(timerId);
    isRunning = false;
    startBtn.innerText = "開始";
    totalSeconds = 25 * 60;
    updateTimerDisplay();
});

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


// ==========================================
// 4. 待辦清單管理
// ==========================================
addTaskBtn.addEventListener('click', () => {
    const taskText = taskInput.value.trim();
    if (!taskText) {
        alert('請輸入任務內容！');
        return;
    }

    const newTask = {
        id: Date.now(),
        text: taskText,
        completed: false
    };

    tasks.push(newTask);
    saveAndRenderTasks();
    taskInput.value = '';
});

function saveAndRenderTasks() {
    localStorage.setItem('pomodoro_tasks', JSON.stringify(tasks));
    renderTasks();
}

function renderTasks() {
    if (!taskList) return;
    taskList.innerHTML = '';
    
    tasks.forEach(task => {
        const li = document.createElement('li');
        li.className = 'todo-card';
        li.innerHTML = `
            <label class="custom-checkbox">
                <input type="checkbox" ${task.completed ? 'checked' : ''} onclick="toggleTask(${task.id})">
                <span class="checkmark"></span>
            </label>
            <span class="task-text" style="${task.completed ? 'text-decoration: line-through; color: #A8A29E;' : ''}">${task.text}</span>
            <button onclick="deleteTask(${task.id})" style="margin-left: auto; background: none; border: none; color: #B48989; cursor: pointer; font-size: 16px;"><i class="fa-solid fa-trash"></i></button>
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
    saveAndRenderTasks();
};


// ==========================================
// 5. 換裝商店與 SVG 聯動邏輯
// ==========================================
function changeOutfit(targetOutfitId) {
    const allOutfits = ['dresstest', 'dresstest2'];
    
    // 同步切換所有頁面上的 SVG 紙娃衣服圖層
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

// 商店點擊購買與穿上聯動
document.querySelectorAll('.shop-item').forEach((item, index) => {
    // 假設第 0 個格子是藍色連身裙，第 1 個格子是橘色洋裝
    const outfitMap = { 0: 'dresstest', 1: 'dresstest2' };

    item.addEventListener('click', () => {
        // 如果這個格子沒有對應的衣服，就不做特別處理
        if (!outfitMap[index]) return;

        const itemPrice = 50; // 每個道具 50 金幣
        const targetOutfit = outfitMap[index];

        // 如果已經擁有，直接換裝
        if (unlockedItems.includes(index)) {
            changeOutfit(targetOutfit);
            alert('已為您切換此服裝！');
            return;
        }
        
        // 如果還沒擁有，進行扣款購買
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
// 7. 計時設定面板調整邏輯 (專注、休息、番茄數 +/-)
// ==========================================
// 預設設定值
let workTimeSetting = 25;
let breakTimeSetting = 5;
let tomatoCountSetting = 4;

// 抓取設定面板上的數字顯示元素與按鈕
const settingCards = document.querySelectorAll('.setting-card');

if (settingCards.length >= 3) {
    // 1. 專注時間設定
    const workValueEl = settingCards[0].querySelector('.setting-value');
    const workMinusBtn = settingCards[0].querySelector('.circle-btn:first-of-type');
    const workPlusBtn = settingCards[0].querySelector('.circle-btn:last-of-type');

    workMinusBtn.addEventListener('click', () => {
        if (workTimeSetting > 1) {
            workTimeSetting--;
            workValueEl.innerText = workTimeSetting;
        }
    });

    workPlusBtn.addEventListener('click', () => {
        workTimeSetting++;
        workValueEl.innerText = workTimeSetting;
    });

    // 2. 休息時間設定
    const breakValueEl = settingCards[1].querySelector('.setting-value');
    const breakMinusBtn = settingCards[1].querySelector('.circle-btn:first-of-type');
    const breakPlusBtn = settingCards[1].querySelector('.circle-btn:last-of-type');

    breakMinusBtn.addEventListener('click', () => {
        if (breakTimeSetting > 1) {
            breakTimeSetting--;
            breakValueEl.innerText = breakTimeSetting;
        }
    });

    breakPlusBtn.addEventListener('click', () => {
        breakTimeSetting++;
        breakValueEl.innerText = breakTimeSetting;
    });

    // 3. 番茄數設定
    const tomatoValueEl = settingCards[2].querySelector('.setting-value');
    const tomatoMinusBtn = settingCards[2].querySelector('.circle-btn:first-of-type');
    const tomatoPlusBtn = settingCards[2].querySelector('.circle-btn:last-of-type');

    tomatoMinusBtn.addEventListener('click', () => {
        if (tomatoCountSetting > 1) {
            tomatoCountSetting--;
            tomatoValueEl.innerText = tomatoCountSetting;
        }
    });

    tomatoPlusBtn.addEventListener('click', () => {
        tomatoCountSetting++;
        tomatoValueEl.innerText = tomatoCountSetting;
    });

    // 4. 點擊「套用設定」按鈕時，將畫面上的數字同步到真正的計時器中
    const applyBtn = document.querySelector('.btn-apply');
    if (applyBtn) {
        applyBtn.addEventListener('click', () => {
            if (isRunning) {
                alert('計時中無法更改設定，請先重置計時器！');
                return;
            }
            totalSeconds = workTimeSetting * 60;
            updateTimerDisplay();
            alert(`設定已套用！專注時間已更新為 ${workTimeSetting} 分鐘。`);
        });
    }
}
