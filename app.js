document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const taskForm = document.getElementById('taskForm');
    const taskTitleInput = document.getElementById('taskTitle');
    const taskDateInput = document.getElementById('taskDate');
    const taskPriorityInput = document.getElementById('taskPriority');
    const taskList = document.getElementById('taskList');
    const emptyState = document.getElementById('emptyState');
    const filterBtns = document.querySelectorAll('.filter-btn');
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toastMessage');
    const enableNotificationsBtn = document.getElementById('enableNotificationsBtn');
    
    // New Elements
    const themeToggleBtn = document.getElementById('themeToggleBtn');
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');
    const fabBtn = document.getElementById('fabBtn');
    const addTaskSection = document.getElementById('addTaskSection');
    const closeFormBtn = document.getElementById('closeFormBtn');

    // State
    let tasks = JSON.parse(localStorage.getItem('smartTasks_pro')) || []; // new key to avoid conflicts with previous version if needed
    let currentFilter = 'all'; // all, pending, completed
    let notificationsEnabled = false;
    let isDarkTheme = localStorage.getItem('smartTheme') !== 'light';
    let editingTaskId = null; // New state for editing

    // Initialize
    init();

    function init() {
        applyTheme();
        renderTasks();
        updateProgress();
        checkNotificationPermission();
        
        // Start notification checker loop (checks every 30 seconds)
        setInterval(checkUpcomingTasks, 30000);
    }

    // Event Listeners
    taskForm.addEventListener('submit', handleAddTask);
    
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            renderTasks();
        });
    });

    enableNotificationsBtn.addEventListener('click', requestNotificationPermission);
    themeToggleBtn.addEventListener('click', toggleTheme);

    // Mobile specific events
    fabBtn.addEventListener('click', openMobileForm);
    closeFormBtn.addEventListener('click', closeMobileForm);

    // Handle clicking outside the modal to close it on mobile
    document.body.addEventListener('click', (e) => {
        if (document.body.classList.contains('modal-open')) {
            // If click is outside the add-task-section and not on the FAB
            if (!addTaskSection.contains(e.target) && !fabBtn.contains(e.target)) {
                closeMobileForm();
            }
        }
    });

    // Handlers
    function handleAddTask(e) {
        e.preventDefault();
        
        const title = taskTitleInput.value.trim();
        if (!title) return;

        const dateVal = taskDateInput.value;
        const priority = taskPriorityInput.value;

        if (editingTaskId) {
            // Edit existing task
            tasks = tasks.map(task => {
                if (task.id === editingTaskId) {
                    return {
                        ...task,
                        title,
                        dueDate: dateVal || null,
                        priority,
                        notified: false // reset notification if changed
                    };
                }
                return task;
            });
            showToast('Tâche modifiée avec succès!');
            editingTaskId = null;
            
            // Reset button text
            const btnText = document.getElementById('submitBtnText');
            const btnIcon = document.getElementById('submitBtnIcon');
            if(btnText) btnText.textContent = 'Ajouter la tâche';
            if(btnIcon) btnIcon.className = 'fa-solid fa-plus';
        } else {
            // Add new task
            const newTask = {
                id: Date.now().toString(),
                title,
                dueDate: dateVal || null,
                priority,
                completed: false,
                createdAt: new Date().toISOString(),
                notified: false
            };
            tasks.unshift(newTask);
            showToast('Tâche ajoutée avec succès!');
        }

        saveTasks();
        renderTasks();
        updateProgress();
        
        // Reset form
        taskTitleInput.value = '';
        taskDateInput.value = '';
        taskPriorityInput.value = 'medium';
        
        closeMobileForm();
    }

    function toggleTaskStatus(id) {
        tasks = tasks.map(task => {
            if (task.id === id) {
                return { ...task, completed: !task.completed };
            }
            return task;
        });
        saveTasks();
        renderTasks();
        updateProgress();
        
        const isCompleted = tasks.find(t => t.id === id).completed;
        if(isCompleted) {
            showToast('Tâche terminée ! 🎉');
        }
    }

    function deleteTask(id, element) {
        element.classList.add('removing');
        setTimeout(() => {
            tasks = tasks.filter(task => task.id !== id);
            saveTasks();
            renderTasks();
            updateProgress();
            showToast('Tâche supprimée');
        }, 300); // Matches CSS transition duration
    }

    function editTask(id) {
        const task = tasks.find(t => t.id === id);
        if (!task) return;

        editingTaskId = id;
        
        // Populate form
        taskTitleInput.value = task.title;
        taskDateInput.value = task.dueDate || '';
        taskPriorityInput.value = task.priority;
        
        // Change button text
        const btnText = document.getElementById('submitBtnText');
        const btnIcon = document.getElementById('submitBtnIcon');
        if(btnText) btnText.textContent = 'Modifier la tâche';
        if(btnIcon) btnIcon.className = 'fa-solid fa-pen';
        
        // Open form
        if (window.innerWidth <= 600) {
            openMobileForm();
        } else {
            // Scroll to form on desktop
            taskTitleInput.focus();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }

    // Render logic
    function renderTasks() {
        taskList.innerHTML = '';
        
        let filteredTasks = tasks;
        if (currentFilter === 'pending') {
            filteredTasks = tasks.filter(t => !t.completed);
        } else if (currentFilter === 'completed') {
            filteredTasks = tasks.filter(t => t.completed);
        }

        if (filteredTasks.length === 0) {
            emptyState.classList.remove('hidden');
        } else {
            emptyState.classList.add('hidden');
            
            filteredTasks.forEach(task => {
                const li = document.createElement('li');
                li.className = `task-item priority-${task.priority} ${task.completed ? 'completed' : ''}`;
                li.dataset.id = task.id;

                let dateHtml = '';
                let isUrgent = false;
                
                if (task.dueDate) {
                    const due = new Date(task.dueDate);
                    const now = new Date();
                    const diffMs = due - now;
                    const diffHours = diffMs / (1000 * 60 * 60);
                    
                    isUrgent = !task.completed && diffHours > 0 && diffHours < 24;
                    const overdue = !task.completed && diffMs < 0;
                    
                    // Options for a more natural date display
                    const isToday = due.toDateString() === now.toDateString();
                    
                    let dateString = '';
                    if (isToday) {
                        dateString = "Aujourd'hui à " + new Intl.DateTimeFormat('fr-FR', {hour: '2-digit', minute: '2-digit'}).format(due);
                    } else {
                        dateString = new Intl.DateTimeFormat('fr-FR', {
                            day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                        }).format(due);
                    }

                    const urgentClass = isUrgent || overdue ? 'urgent' : '';
                    const iconColor = overdue ? 'color: var(--priority-high)' : '';

                    dateHtml = `
                        <span class="due-date ${urgentClass}">
                            <i class="fa-regular fa-clock" style="${iconColor}"></i> 
                            ${overdue ? 'En retard : ' : ''}${dateString}
                        </span>
                    `;
                }

                li.innerHTML = `
                    <div class="task-checkbox" role="checkbox" aria-checked="${task.completed}" tabindex="0">
                        <i class="fa-solid fa-check"></i>
                    </div>
                    <div class="task-content">
                        <div class="task-title" title="${escapeHTML(task.title)}">${escapeHTML(task.title)}</div>
                        <div class="task-meta">
                            ${dateHtml}
                        </div>
                    </div>
                    <div class="task-actions">
                        <button class="task-edit" aria-label="Modifier la tâche">
                            <i class="fa-solid fa-pen"></i>
                        </button>
                        <button class="task-delete" aria-label="Supprimer la tâche">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </div>
                `;

                // Add event listeners
                const checkbox = li.querySelector('.task-checkbox');
                checkbox.addEventListener('click', () => toggleTaskStatus(task.id));
                
                const editBtn = li.querySelector('.task-edit');
                editBtn.addEventListener('click', () => editTask(task.id));
                
                const delBtn = li.querySelector('.task-delete');
                delBtn.addEventListener('click', () => deleteTask(task.id, li));

                taskList.appendChild(li);
            });
        }
    }

    function updateProgress() {
        if (tasks.length === 0) {
            progressBar.style.width = '0%';
            progressText.textContent = '0/0';
            return;
        }

        const completed = tasks.filter(t => t.completed).length;
        const total = tasks.length;
        const percentage = Math.round((completed / total) * 100);

        progressBar.style.width = `${percentage}%`;
        progressText.textContent = `${completed}/${total} (${percentage}%)`;
    }

    // Mobile Form Logic
    function openMobileForm() {
        if (window.innerWidth <= 600) {
            addTaskSection.classList.add('show');
            document.body.classList.add('modal-open');
            taskTitleInput.focus();
        }
    }

    function closeMobileForm() {
        if (window.innerWidth <= 600) {
            addTaskSection.classList.remove('show');
            document.body.classList.remove('modal-open');
        }
    }

    // Theme Logic
    function applyTheme() {
        if (isDarkTheme) {
            document.body.classList.remove('light-theme');
            themeToggleBtn.innerHTML = '<i class="fa-solid fa-sun"></i>';
        } else {
            document.body.classList.add('light-theme');
            themeToggleBtn.innerHTML = '<i class="fa-solid fa-moon"></i>';
        }
    }

    function toggleTheme() {
        isDarkTheme = !isDarkTheme;
        localStorage.setItem('smartTheme', isDarkTheme ? 'dark' : 'light');
        applyTheme();
    }

    // Utils
    function saveTasks() {
        localStorage.setItem('smartTasks_pro', JSON.stringify(tasks));
    }

    function showToast(msg) {
        toastMessage.textContent = msg;
        toast.classList.add('show');
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }

    function escapeHTML(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // --- Notifications Logic ---
    function checkNotificationPermission() {
        if (!("Notification" in window)) {
            enableNotificationsBtn.style.display = 'none';
            return;
        }

        if (Notification.permission === "granted") {
            notificationsEnabled = true;
            updateNotificationBtnState();
        }
    }

    function requestNotificationPermission() {
        if (!("Notification" in window)) {
            showToast("Notifications non supportées par le navigateur.");
            return;
        }

        Notification.requestPermission().then(permission => {
            if (permission === "granted") {
                notificationsEnabled = true;
                showToast("Notifications activées !");
                updateNotificationBtnState();
            } else {
                showToast("Permission refusée.");
            }
        });
    }

    function updateNotificationBtnState() {
        if (notificationsEnabled) {
            enableNotificationsBtn.classList.add('active');
            enableNotificationsBtn.innerHTML = '<i class="fa-solid fa-bell"></i>';
            enableNotificationsBtn.title = "Notifications activées";
        }
    }

    function checkUpcomingTasks() {
        if (!notificationsEnabled) return;

        const now = new Date();
        const upcomingTasks = tasks.filter(t => {
            if (t.completed || !t.dueDate || t.notified) return false;
            
            const due = new Date(t.dueDate);
            const diffMs = due - now;
            const diffMinutes = diffMs / (1000 * 60);
            
            return diffMinutes > 0 && diffMinutes <= 15;
        });

        upcomingTasks.forEach(task => {
            sendNotification(task);
            task.notified = true;
            saveTasks();
        });
    }

    function sendNotification(task) {
        const notification = new Notification("Rappel : To-Do List", {
            body: `La tâche "${task.title}" arrive à échéance bientôt !`,
            icon: "https://cdn-icons-png.flaticon.com/512/762/762776.png"
        });

        notification.onclick = function() {
            window.focus();
            notification.close();
        };
    }
});
