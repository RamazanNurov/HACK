class Router {
    constructor() {
        this.routes = {
            'login': this.showLoginPage,
            'engineer': this.showEngineerPage,
            'admin': this.showAdminPage
        };
        
        this.currentPage = null;
        this.init();
    }

    init() {
        console.log('Router: Fast initialization');

        // Сразу показываем логин
        this.showLoginPageImmediately();

        // Быстрая настройка обработчиков
        this.setupEventListeners();

        // Обработка маршрута через минимальную задержку (вместо 50ms -> 10ms)
        setTimeout(() => this.handleRoute(), 10);
    }

    showLoginPageImmediately() {
        // Мгновенное скрытие всех страниц
        const allPages = document.querySelectorAll('.page');
        allPages.forEach(page => {
            page.style.display = 'none';
        });

        // Мгновенное скрытие навбара
        const navbar = document.getElementById('navbar');
        if (navbar) {
            navbar.style.display = 'none';
        }

        // Мгновенное отображение логина
        const loginPage = document.getElementById('login-page');
        if (loginPage) {
            loginPage.style.display = 'block';
        }

        this.currentPage = 'login';
    }

    setupEventListeners() {
        window.addEventListener('hashchange', () => {
            this.handleRoute();
        });
    }

    handleRoute() {
        const hash = window.location.hash.substring(1) || 'login';

        if (this.currentPage === hash) return;

        if (this.routes[hash]) {
            this.routes[hash].call(this);
            this.currentPage = hash;
        } else {
            this.showLoginPage();
        }
    }

    showLoginPage() {
        if (window.auth && auth.isAuthenticated()) {
            const role = auth.getUserRole();
            this.navigateTo(role);
            return;
        }

        this.hideAllPages();
        this.showPage('login-page');
        this.hideNavbar();
    }

    showEngineerPage() {
        if (!this.checkAccess('engineer')) return;

        this.hideAllPages();
        this.showPage('engineer-page');
        this.showNavbar();
        this.setActiveNavLink('engineer');
        this.updateNavbarGreeting();
        this.initEngineerInterface();
    }

    showAdminPage() {
        if (!this.checkAccess('admin')) return;

        this.hideAllPages();
        this.showPage('admin-page');
        this.showNavbar();
        this.setActiveNavLink('admin');
        this.updateNavbarGreeting();
        this.initAdminInterface();
    }

    checkAccess(requiredRole) {
        if (!window.auth || !auth.isAuthenticated()) {
            this.redirectToLogin();
            return false;
        }

        const userRole = auth.getUserRole();
        if (userRole !== requiredRole) {
            auth.showMessage(`Доступ запрещен. Требуется роль ${requiredRole === 'engineer' ? 'инженера' : 'администратора'}.`, 'error');

            if (userRole === 'engineer') {
                this.navigateTo('engineer');
            } else if (userRole === 'admin') {
                this.navigateTo('admin');
            }

            return false;
        }

        return true;
    }

    hideAllPages() {
        document.querySelectorAll('.page').forEach(page => {
            page.classList.add('hidden');
        });
    }

    showPage(pageId) {
        const page = document.getElementById(pageId);
        if (page) page.classList.remove('hidden');
    }

    showNavbar() {
        const navbar = document.getElementById('navbar');
        if (navbar) navbar.classList.remove('hidden');
    }

    hideNavbar() {
        const navbar = document.getElementById('navbar');
        if (navbar) navbar.classList.add('hidden');
    }

    setActiveNavLink(route) {
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === `#${route}`) {
                link.classList.add('active');
            }
        });
    }

    updateNavbarGreeting() {
        if (auth.isAuthenticated() && auth.currentUser) {
            const navBrand = document.querySelector('.nav-brand');
            if (navBrand) {
                const roleDisplay = auth.currentUser.role === 'engineer' ? 'Инженер' : 'Администратор';
                navBrand.textContent = `ClientSystem | ${auth.currentUser.username} (${roleDisplay})`;
            }
        }
    }

    initEngineerInterface() {
        if (typeof EngineerInterface !== 'undefined' && !window.engineerInterface) {
            window.engineerInterface = new EngineerInterface();
        }
    }

    initAdminInterface() {
        if (typeof AdminInterface !== 'undefined' && !window.adminInterface) {
            window.adminInterface = new AdminInterface();
        }
    }

    redirectToLogin() {
        this.navigateTo('login');
    }

    navigateTo(route) {
        window.location.hash = route;
    }
}

// Быстрая инициализация
document.addEventListener('DOMContentLoaded', function() {
    // Мгновенно показываем логин до инициализации роутера
    const loginPage = document.getElementById('login-page');
    const engineerPage = document.getElementById('engineer-page');
    const adminPage = document.getElementById('admin-page');
    const navbar = document.getElementById('navbar');

    if (loginPage) loginPage.style.display = 'block';
    if (engineerPage) engineerPage.style.display = 'none';
    if (adminPage) adminPage.style.display = 'none';
    if (navbar) navbar.style.display = 'none';

    // Затем инициализируем роутер
    window.router = new Router();
});