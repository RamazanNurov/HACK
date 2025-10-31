class Auth {
    constructor() {
        this.currentUser = null;
        this.API_BASE_URL = '/api';  // Базовый URL API
        this.init();
    }

    init() {
        this.checkExistingSession();
        this.initLoginForm();
        this.initLogoutButton();
    }

    initLoginForm() {
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleLogin();
            });
        }
    }

    initLogoutButton() {
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                this.logout();
            });
        }
    }

    async handleLogin() {
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        if (!username || !password) {
            this.showMessage('Заполните все поля', 'error');
            return;
        }

        app.showLoading();

        try {
            const response = await fetch(`${this.API_BASE_URL}/auth/login/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    username: username,
                    password: password
                })
            });

            if (response.ok) {
                const data = await response.json();
                this.loginSuccess(data);
            } else {
                const errorData = await response.json();
                this.loginError(errorData.detail || 'Ошибка авторизации');
            }
        } catch (error) {
            console.error('Login error:', error);
            this.loginError('Ошибка сети. Проверьте подключение.');
        }
    }

    async loginSuccess(data) {
    console.log('Auth: Login successful', data);

    // Сохраняем токены и данные пользователя
    localStorage.setItem('accessToken', data.access);
    localStorage.setItem('refreshToken', data.refresh);
    localStorage.setItem('currentUser', JSON.stringify({
        id: data.user_id,
        username: data.username,
        role: data.role,
        email: data.email
    }));

    this.currentUser = {
        id: data.user_id,
        username: data.username,
        role: data.role,
        email: data.email
    };

    this.hideLoading();
    this.showMessage('Успешный вход!', 'success');

    console.log('Auth: User role is', data.role);

    // Немедленное перенаправление без задержки
    if (data.role === 'engineer') {
        console.log('Auth: Redirecting to engineer page');
        window.location.hash = 'engineer';
    } else if (data.role === 'admin') {
        console.log('Auth: Redirecting to admin page');
        window.location.hash = 'admin';
    } else {
        console.warn('Auth: Unknown role, redirecting to login');
        window.location.hash = 'login';
    }
}

    loginError(message) {
        app.hideLoading();
        this.showMessage(message, 'error');
    }

    async checkExistingSession() {
        const savedUser = localStorage.getItem('currentUser');
        const accessToken = localStorage.getItem('accessToken');

        if (savedUser && accessToken) {
            this.currentUser = JSON.parse(savedUser);

            // Проверяем валидность токена
            const isValid = await this.validateToken();

            if (isValid) {
                // Автоматический редирект на нужную страницу
                if (this.currentUser.role === 'engineer') {
                    router.navigateTo('engineer');
                } else if (this.currentUser.role === 'admin') {
                    router.navigateTo('admin');
                }
            } else {
                // Токен невалиден, пробуем обновить
                await this.refreshToken();
            }
        }
    }

    async validateToken() {
        try {
            const response = await fetch(`${this.API_BASE_URL}/users/me/`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
                    'Content-Type': 'application/json'
                }
            });
            return response.ok;
        } catch (error) {
            return false;
        }
    }

    async refreshToken() {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) {
            this.logout();
            return false;
        }

        try {
            const response = await fetch(`${this.API_BASE_URL}/auth/refresh/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                'Authorization': `Bearer ${refreshToken}`
                },
                body: JSON.stringify({
                    refresh: refreshToken
                })
            });

            if (response.ok) {
                const data = await response.json();
                localStorage.setItem('accessToken', data.access);
                return true;
            } else {
                this.logout();
                return false;
            }
        } catch (error) {
            this.logout();
            return false;
        }
    }

    logout() {
        this.currentUser = null;
        localStorage.removeItem('currentUser');
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        router.navigateTo('login');
        this.showMessage('Вы вышли из системы', 'info');
    }

    isAuthenticated() {
        return this.currentUser !== null;
    }

    getUserRole() {
        return this.currentUser ? this.currentUser.role : null;
    }

    getAuthHeaders() {
        const token = localStorage.getItem('accessToken');
        return {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };
    }

    async apiRequest(url, options = {}) {
        const defaultOptions = {
            headers: this.getAuthHeaders(),
            ...options
        };

        let response = await fetch(`${this.API_BASE_URL}${url}`, defaultOptions);

        // Если токен истек, пробуем обновить и повторить запрос
        if (response.status === 401) {
            const refreshed = await this.refreshToken();
            if (refreshed) {
                defaultOptions.headers = this.getAuthHeaders();
                response = await fetch(`${this.API_BASE_URL}${url}`, defaultOptions);
            } else {
                this.logout();
                throw new Error('Требуется повторная авторизация');
            }
        }

        return response;
    }

    showMessage(message, type = 'info') {
        // Удаляем существующие сообщения
        const existingMessages = document.querySelectorAll('.message');
        existingMessages.forEach(msg => msg.remove());

        // Создаем элемент для уведомления
        const messageEl = document.createElement('div');
        messageEl.className = `message message-${type}`;
        messageEl.textContent = message;
        messageEl.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 1rem 1.5rem;
            background: ${this.getMessageColor(type)};
            color: white;
            border-radius: 4px;
            z-index: 10000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            font-size: 14px;
            max-width: 300px;
            word-wrap: break-word;
        `;

        document.body.appendChild(messageEl);

        // Автоматическое удаление через 5 секунд
        setTimeout(() => {
            if (messageEl.parentNode) {
                messageEl.parentNode.removeChild(messageEl);
            }
        }, 5000);
    }

    getMessageColor(type) {
        const colors = {
            success: '#27ae60',
            error: '#e74c3c',
            info: '#3498db',
            warning: '#f39c12'
        };
        return colors[type] || colors.info;
    }
}

// Создаем глобальный экземпляр Auth
const auth = new Auth();