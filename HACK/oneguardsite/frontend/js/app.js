class App {
    constructor() {
        this.isInitialized = false;
        this.init();
    }

    async init() {
        if (this.isInitialized) return;

        try {
            // Инициализируем Service Worker (если поддерживается)
            await this.registerServiceWorker();

            // Инициализируем авторизацию
            this.initAuth();

            // Инициализация глобальных обработчиков событий
            this.initEventListeners();
            this.initNetworkDetection();

            // Отложенная инициализация офлайн-менеджера
            this.initOfflineManager();

            this.isInitialized = true;
            console.log('Приложение инициализировано');
        } catch (error) {
            console.error('Ошибка инициализации приложения:', error);
        }
    }

    async registerServiceWorker() {
        // Проверяем, что мы в production, а не на localhost
        if ('serviceWorker' in navigator && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
            try {
                const registration = await navigator.serviceWorker.register('/sw.js');
                console.log('ServiceWorker registered:', registration);

                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    console.log('ServiceWorker update found:', newWorker);

                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            this.showUpdateNotification();
                        }
                    });
                });

            } catch (error) {
                console.warn('ServiceWorker registration failed:', error);
            }
        } else {
            console.log('ServiceWorker skipped on localhost');
        }
    }

    initAuth() {
        // Создаем глобальный экземпляр Auth если его нет
        if (typeof Auth !== 'undefined' && !window.auth) {
            window.auth = new Auth();
        }
    }

    async initOfflineManager() {
        // Отложенная загрузка офлайн-менеджера
        if (typeof OfflineManager !== 'undefined') {
            try {
                window.offlineManager = new OfflineManager();

                // Миграция данных из localStorage
                if (typeof offlineManager.migrateFromLocalStorage === 'function') {
                    await offlineManager.migrateFromLocalStorage();
                }

                // Слушаем события от офлайн-менеджера
                window.addEventListener('offlineDataChanged', () => this.handleOfflineDataChanged());
                window.addEventListener('networkStatusChanged', (event) => this.handleNetworkStatusChanged(event.detail));

            } catch (error) {
                console.warn('OfflineManager initialization failed:', error);
            }
        }
    }

    initEventListeners() {
        // Безопасная инициализация обработчиков
        this.safeAddEventListener('logout-btn', 'click', () => {
            if (window.auth) {
                auth.logout();
            }
        });

        // Глобальные горячие клавиши
        document.addEventListener('keydown', (e) => {
            // Ctrl+Shift+R для принудительного обновления
            if (e.ctrlKey && e.shiftKey && e.key === 'R') {
                e.preventDefault();
                this.forceRefresh();
            }

            // Escape для скрытия модальных окон
            if (e.key === 'Escape') {
                this.handleEscapeKey();
            }
        });

        // Обработчик изменения видимости страницы
        document.addEventListener('visibilitychange', () => {
            this.handleVisibilityChange();
        });
    }

    safeAddEventListener(elementId, event, handler) {
        const element = document.getElementById(elementId);
        if (element) {
            element.addEventListener(event, handler);
        } else {
            console.warn(`Element #${elementId} not found for event listener`);
        }
    }

    initNetworkDetection() {
        // Показываем начальный статус сети
        this.updateNetworkStatus(navigator.onLine);

        // Слушаем изменения сети
        window.addEventListener('online', () => this.handleNetworkChange(true));
        window.addEventListener('offline', () => this.handleNetworkChange(false));
    }

    handleNetworkChange(online) {
        this.updateNetworkStatus(online);

        // При восстановлении сети пробуем синхронизировать данные
        if (online && window.offlineManager) {
            setTimeout(() => {
                offlineManager.syncOfflineData().catch(console.error);
            }, 1000);
        }
    }

    handleOfflineDataChanged() {
        // Оповещаем компоненты об изменении данных
        if (window.engineerInterface) {
            if (typeof engineerInterface.loadRecentClients === 'function') {
                engineerInterface.loadRecentClients();
            }
            if (typeof engineerInterface.renderOfflineQueue === 'function') {
                engineerInterface.renderOfflineQueue();
            }
        }

        if (window.adminInterface && typeof adminInterface.refreshData === 'function') {
            adminInterface.refreshData();
        }
    }

    handleNetworkStatusChanged({ online }) {
        this.updateNetworkStatus(online);
    }

    updateNetworkStatus(online) {
        // Обновляем индикаторы сети во всех компонентах
        if (window.engineerInterface && typeof engineerInterface.setOnlineStatus === 'function') {
            engineerInterface.setOnlineStatus(online);
        }

        this.showGlobalNetworkIndicator(online);
    }

    showGlobalNetworkIndicator(online) {
        // Создаем или обновляем глобальный индикатор сети
        let indicator = document.getElementById('global-network-indicator');

        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'global-network-indicator';
            indicator.style.cssText = `
                position: fixed;
                top: 10px;
                right: 10px;
                padding: 8px 12px;
                border-radius: 4px;
                font-size: 12px;
                font-weight: bold;
                z-index: 10000;
                transition: all 0.3s ease;
                opacity: 0;
                transform: translateY(-20px);
            `;
            document.body.appendChild(indicator);
        }

        if (online) {
            indicator.textContent = '🟢 Онлайн';
            indicator.style.background = '#d4edda';
            indicator.style.color = '#155724';
            indicator.style.border = '1px solid #c3e6cb';
            indicator.style.opacity = '1';
            indicator.style.transform = 'translateY(0)';

            // Автоматически скрываем через 3 секунды
            setTimeout(() => {
                indicator.style.opacity = '0';
                indicator.style.transform = 'translateY(-20px)';
                setTimeout(() => {
                    if (indicator.parentNode && indicator.style.opacity === '0') {
                        indicator.parentNode.removeChild(indicator);
                    }
                }, 300);
            }, 3000);
        } else {
            indicator.textContent = '🔴 Офлайн';
            indicator.style.background = '#f8d7da';
            indicator.style.color = '#721c24';
            indicator.style.border = '1px solid #f5c6cb';
            indicator.style.opacity = '1';
            indicator.style.transform = 'translateY(0)';
        }
    }

    showUpdateNotification() {
        if (window.auth && typeof auth.showMessage === 'function') {
            const updateAction = () => {
                if (navigator.serviceWorker.controller) {
                    navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
                    window.location.reload();
                }
            };

            auth.showMessage('Доступно обновление приложения', 'info', 0, updateAction);
        }
    }

    showLoading() {
        const loading = document.getElementById('loading');
        if (loading) {
            loading.classList.remove('hidden');
        }
    }

    hideLoading() {
        const loading = document.getElementById('loading');
        if (loading) {
            loading.classList.add('hidden');
        }
    }

    forceRefresh() {
        if (navigator.serviceWorker && navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
        }
        window.location.reload();
    }

    handleEscapeKey() {
        // Закрываем модальные окна, всплывающие меню и т.д.
        const modals = document.querySelectorAll('.modal, .popup, .dropdown');
        modals.forEach(modal => {
            if (modal.style.display !== 'none') {
                modal.style.display = 'none';
            }
        });
    }

    handleVisibilityChange() {
        // Когда пользователь возвращается на вкладку, проверяем авторизацию
        if (!document.hidden && window.auth) {
            // Можно добавить проверку валидности токена
            console.log('App visible, checking auth...');
        }
    }

    // Утилита для проверки поддержки офлайн-функций
    checkOfflineSupport() {
        return {
            indexedDB: 'indexedDB' in window,
            serviceWorker: 'serviceWorker' in navigator,
            sync: 'sync' in (navigator.serviceWorker || {}),
            backgroundSync: 'backgroundSync' in (navigator.serviceWorker || {}),
            cache: 'caches' in window
        };
    }

    // Глобальная функция для безопасного доступа к API
    async safeApiCall(apiFunction, ...args) {
        try {
            return await apiFunction(...args);
        } catch (error) {
            console.error('API call failed:', error);

            if (window.auth && typeof auth.showMessage === 'function') {
                if (error.message.includes('401') || error.message.includes('auth')) {
                    auth.showMessage('Сессия истекла. Войдите снова.', 'error');
                    setTimeout(() => auth.logout(), 2000);
                } else if (error.message.includes('network') || !navigator.onLine) {
                    auth.showMessage('Ошибка сети. Проверьте подключение.', 'error');
                } else {
                    auth.showMessage('Ошибка при загрузке данных', 'error');
                }
            }

            throw error;
        }
    }
}

// Расширяем систему сообщений для поддержки действий
function enhanceMessageSystem() {
    if (window.auth && auth.constructor.prototype.showMessage) {
        const originalShowMessage = auth.constructor.prototype.showMessage;

        auth.constructor.prototype.showMessage = function(message, type = 'info', duration = 5000, action = null) {
            const messageEl = originalShowMessage.call(this, message, type);

            if (action && typeof action === 'function') {
                // Добавляем кнопку действия
                const actionBtn = document.createElement('button');
                actionBtn.textContent = 'Обновить';
                actionBtn.style.cssText = `
                    margin-left: 10px;
                    padding: 4px 8px;
                    background: rgba(255,255,255,0.2);
                    border: 1px solid rgba(255,255,255,0.3);
                    border-radius: 3px;
                    color: white;
                    cursor: pointer;
                    font-size: 12px;
                `;
                actionBtn.addEventListener('click', action);

                messageEl.style.display = 'flex';
                messageEl.style.alignItems = 'center';
                messageEl.style.justifyContent = 'space-between';
                messageEl.appendChild(actionBtn);

                // Не скрываем автоматически сообщения с действиями
                if (duration > 0) {
                    setTimeout(() => {
                        if (messageEl.parentNode) {
                            messageEl.parentNode.removeChild(messageEl);
                        }
                    }, duration);
                }
            }

            return messageEl;
        };
    }
}

// Инициализация приложения после загрузки DOM
document.addEventListener('DOMContentLoaded', () => {
    // Улучшаем систему сообщений
    enhanceMessageSystem();

    // Создаем глобальный экземпляр приложения
    window.app = new App();
});

// Глобальные обработчики ошибок
window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    event.preventDefault();
});