// ==========================================
// 1. DOM 元素與全域變數抓取
// ==========================================
const timerDisplay = document.getElementById('timer-display');
const startBtn = document.getElementById('start-btn');
const resetBtn = document.getElementById('reset-btn');
const taskInput = document.getElementById('task-input');
const addTaskBtn = document.getElementById('add-task-btn');
const taskList = document.getElementById('task-list');
const coinValueEls = document.querySelectorAll('.coin-value'); // 抓取畫面上的金幣顯示（可能有多處）

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

    // 記錄絕對結束時間點（解決切換分頁被瀏覽器暫停的問題）
    targetTime = Date.now() + totalSeconds * 1000;

    timerId = setInterval(() => {
        const now = Date.now();
        const remainingMs = targetTime - now;
        totalSeconds = Math.ceil(remainingMs / 1000);

        if (totalSeconds > 0) {
            updateTimerDisplay();
        } else {
            // 倒數結束！
            clearInterval(timerId);
            isRunning = false;
            startBtn.innerText = "開始";
            totalSeconds = 0;
            updateTimerDisplay();

            // 獎勵機制：完成一次專注送 20 金幣
            addCoins(20);
            alert('恭喜完成 25 分鐘專注！獲得 20 金幣獎勵 🎉');

            // 重置時間回 25 分鐘
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
// 4. 待辦清單管理 (對應夥伴的 HTML ID)
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
// 5. 換裝商店購買邏輯預留
// ==========================================
// 夥伴的 HTML 商店格子可以使用類似邏輯繫結點擊事件
document.querySelectorAll('.shop-item').forEach((item, index) => {
    item.addEventListener('click', () => {
        const itemPrice = 50; // 假設每個道具 50 金幣
        if (unlockedItems.includes(index)) {
            alert('你已經擁有這個裝飾囉！');
            return;
        }
        
        if (deductCoins(itemPrice)) {
            unlockedItems.push(index);
            localStorage.setItem('pomodoro_unlocked', JSON.stringify(unlockedItems));
            alert('購買成功！快去幫角色換上吧！');
            item.style.borderColor = 'var(--primary)';
            
        }
    });
});
// ==========================================
// 6. 換裝系統邏輯 (SVG 紙娃切換)
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
