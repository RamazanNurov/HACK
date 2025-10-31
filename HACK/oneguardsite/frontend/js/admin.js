class AdminInterface {
    constructor() {
        this.clientsData = [];
        this.filteredData = [];
        this.engineersList = [];
        this.currentPage = 1;
        this.rowsPerPage = 10;
        this.sortField = 'timestamp';
        this.sortDirection = 'desc';
        this.currentFilters = {};
        this.charts = {};

        this.init();
    }

    async init() {
        await this.loadEngineers();
        await this.loadClientsData();
        this.initEventListeners();
        this.initCharts();
        this.updateStats();
        this.renderTable();
    }

    async loadEngineers() {
        try {
            const response = await auth.apiRequest('/users/');
            if (response.ok) {
                const users = await response.json();
                this.engineersList = users.filter(user => user.role === 'engineer');
                this.populateEngineersFilter();
            }
        } catch (error) {
            console.error('Error loading engineers:', error);
            auth.showMessage('Ошибка загрузки списка инженеров', 'error');
        }
    }

    populateEngineersFilter() {
        const filterEngineer = document.getElementById('filter-engineer');
        if (filterEngineer) {
            // Сохраняем выбранное значение
            const selectedValue = filterEngineer.value;

            filterEngineer.innerHTML = `
                <option value="">Все инженеры</option>
                ${this.engineersList.map(engineer => `
                    <option value="${engineer.username}">${engineer.username}</option>
                `).join('')}
            `;

            // Восстанавливаем выбранное значение
            if (selectedValue) {
                filterEngineer.value = selectedValue;
            }
        }
    }

    async loadClientsData() {
        try {
            const response = await auth.apiRequest('/clients/');
            if (response.ok) {
                this.clientsData = await response.json();
                this.applyFilters();
                auth.showMessage('Данные загружены', 'success');
            } else {
                throw new Error('Failed to load clients');
            }
        } catch (error) {
            console.error('Error loading clients:', error);
            auth.showMessage('Ошибка загрузки данных клиентов', 'error');
            // Временно используем локальные данные
            this.loadLocalData();
        }
    }

    loadLocalData() {
        const history = localStorage.getItem('clientsHistory');
        this.clientsData = history ? JSON.parse(history) : [];

        if (this.clientsData.length === 0) {
            this.generateSampleData();
        }
    }

    generateSampleData() {
        const sampleData = [
            {
                id: 1,
                name: "Иван Петров",
                phone: "+7 (912) 345-67-89",
                type: "private_house",
                address: "ул. Ленина, 123",
                services: ["internet", "tv"],
                needs: "Нужен быстрый интернет для работы из дома",
                priority: "high",
                engineer: "engineer1",
                timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
            }
        ];

        this.clientsData = sampleData;
        localStorage.setItem('clientsHistory', JSON.stringify(sampleData));
    }

    initEventListeners() {
        // Фильтры
        document.getElementById('apply-filters')?.addEventListener('click', () => this.applyFilters());
        document.getElementById('reset-filters')?.addEventListener('click', () => this.resetFilters());

        // Поиск
        document.getElementById('search-clients')?.addEventListener('input', () => this.applyFilters());

        // Экспорт
        document.getElementById('export-btn')?.addEventListener('click', () => this.exportData());

        // Пагинация
        document.getElementById('prev-page')?.addEventListener('click', () => this.previousPage());
        document.getElementById('next-page')?.addEventListener('click', () => this.nextPage());
        document.getElementById('rows-per-page')?.addEventListener('change', (e) => {
            this.rowsPerPage = parseInt(e.target.value);
            this.currentPage = 1;
            this.renderTable();
        });

        // Сортировка таблицы
        document.querySelectorAll('#clients-table th[data-sort]').forEach(th => {
            th.addEventListener('click', () => this.sortTable(th.dataset.sort));
        });

        // Обновление данных
        document.getElementById('refresh-data')?.addEventListener('click', () => this.refreshData());
    }

    applyFilters() {
        this.currentFilters = {
            dateFrom: document.getElementById('filter-date-from')?.value || '',
            dateTo: document.getElementById('filter-date-to')?.value || '',
            type: document.getElementById('filter-type')?.value || '',
            service: document.getElementById('filter-service')?.value || '',
            priority: document.getElementById('filter-priority')?.value || '',
            engineer: document.getElementById('filter-engineer')?.value || '',
            search: document.getElementById('search-clients')?.value.toLowerCase() || ''
        };

        this.filteredData = this.clientsData.filter(client => {
            // Фильтр по дате
            if (this.currentFilters.dateFrom) {
                const clientDate = new Date(client.created_at || client.timestamp).toISOString().split('T')[0];
                if (clientDate < this.currentFilters.dateFrom) return false;
            }

            if (this.currentFilters.dateTo) {
                const clientDate = new Date(client.created_at || client.timestamp).toISOString().split('T')[0];
                if (clientDate > this.currentFilters.dateTo) return false;
            }

            // Фильтр по типу объекта
            if (this.currentFilters.type && client.building_object?.object_type !== this.currentFilters.type) {
                return false;
            }

            // Фильтр по услуге
            if (this.currentFilters.service && !client.interested_services?.includes(this.currentFilters.service)) {
                return false;
            }

            // Фильтр по приоритету (если есть в API)
            if (this.currentFilters.priority) {
                // Временная логика, адаптируйте под вашу модель данных
                return true;
            }

            // Фильтр по инженеру
            if (this.currentFilters.engineer && client.engineer_name !== this.currentFilters.engineer) {
                return false;
            }

            // Поиск
            if (this.currentFilters.search) {
                const searchTerm = this.currentFilters.search;
                const searchable = [
                    client.name || '',
                    client.contact_phone || '',
                    client.building_object_address || '',
                    client.notes || ''
                ].join(' ').toLowerCase();

                if (!searchable.includes(searchTerm)) {
                    return false;
                }
            }

            return true;
        });

        // Сортируем данные
        this.sortData();

        this.currentPage = 1;
        this.renderTable();
        this.updateCharts();
        this.updateStats();
    }

    resetFilters() {
        document.getElementById('filter-date-from').value = '';
        document.getElementById('filter-date-to').value = '';
        document.getElementById('filter-type').value = '';
        document.getElementById('filter-service').value = '';
        document.getElementById('filter-priority').value = '';
        document.getElementById('filter-engineer').value = '';
        document.getElementById('search-clients').value = '';

        this.applyFilters();
    }

    sortTable(field) {
        if (this.sortField === field) {
            this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            this.sortField = field;
            this.sortDirection = 'asc';
        }

        this.sortData();
        this.renderTable();
        this.updateSortIndicators();
    }

    sortData() {
        this.filteredData.sort((a, b) => {
            let aValue = a[this.sortField];
            let bValue = b[this.sortField];

            // Особые случаи для сортировки
            if (this.sortField === 'services') {
                aValue = a.interested_services?.join(', ') || '';
                bValue = b.interested_services?.join(', ') || '';
            }

            if (this.sortField === 'timestamp' || this.sortField === 'created_at') {
                aValue = new Date(a.created_at || a.timestamp);
                bValue = new Date(b.created_at || b.timestamp);
            }

            if (this.sortField === 'name') {
                aValue = a.name || '';
                bValue = b.name || '';
            }

            if (this.sortField === 'type') {
                aValue = a.building_object?.object_type || '';
                bValue = b.building_object?.object_type || '';
            }

            if (aValue < bValue) return this.sortDirection === 'asc' ? -1 : 1;
            if (aValue > bValue) return this.sortDirection === 'asc' ? 1 : -1;
            return 0;
        });
    }

    updateSortIndicators() {
        document.querySelectorAll('#clients-table th[data-sort]').forEach(th => {
            th.classList.remove('sorted-asc', 'sorted-desc');
            if (th.dataset.sort === this.sortField) {
                th.classList.add(this.sortDirection === 'asc' ? 'sorted-asc' : 'sorted-desc');
            }
        });
    }

    renderTable() {
        const tbody = document.getElementById('clients-table-body');
        if (!tbody) return;

        const startIndex = (this.currentPage - 1) * this.rowsPerPage;
        const endIndex = startIndex + this.rowsPerPage;
        const pageData = this.filteredData.slice(startIndex, endIndex);

        if (pageData.length === 0) {
            tbody.innerHTML = `
                <tr class="empty-row">
                    <td colspan="9">Нет данных, соответствующих фильтрам</td>
                </tr>
            `;
        } else {
            tbody.innerHTML = pageData.map(client => `
                <tr>
                    <td>${this.escapeHtml(client.name || 'Не указано')}</td>
                    <td>${this.getTypeLabel(client.building_object?.object_type)}</td>
                    <td>${this.escapeHtml(client.contact_phone || 'Не указан')}</td>
                    <td>${this.escapeHtml(client.building_object_address || client.building_object?.address || 'Не указан')}</td>
                    <td>
                        <div class="services-tags">
                            ${(client.interested_services || client.services || []).map(service =>
                                `<span class="service-tag-small">${this.getServiceLabel(service)}</span>`
                            ).join('')}
                        </div>
                    </td>
                    <td>
                        <span class="priority-${client.priority || 'medium'}">
                            ${this.getPriorityLabel(client.priority)}
                        </span>
                    </td>
                    <td>${this.escapeHtml(client.engineer_name || client.engineer || 'Не указан')}</td>
                    <td>${new Date(client.created_at || client.timestamp).toLocaleString('ru-RU')}</td>
                    <td>
                        <div class="action-buttons">
                            <button class="btn-icon-small" onclick="adminInterface.viewClient(${client.id})" title="Просмотр">
                                👁️
                            </button>
                            <button class="btn-icon-small" onclick="adminInterface.editClient(${client.id})" title="Редактировать">
                                ✏️
                            </button>
                        </div>
                    </td>
                </tr>
            `).join('');
        }

        this.updatePagination();
        this.updateTableInfo();
    }

    updatePagination() {
        const totalPages = Math.ceil(this.filteredData.length / this.rowsPerPage);
        const prevBtn = document.getElementById('prev-page');
        const nextBtn = document.getElementById('next-page');
        const pageInfo = document.getElementById('page-info');

        if (prevBtn) prevBtn.disabled = this.currentPage === 1;
        if (nextBtn) nextBtn.disabled = this.currentPage === totalPages || totalPages === 0;
        if (pageInfo) pageInfo.textContent = `Страница ${this.currentPage} из ${totalPages}`;
    }

    updateTableInfo() {
        const shownCount = document.getElementById('shown-count');
        const totalCount = document.getElementById('total-count');

        if (shownCount) shownCount.textContent = Math.min(this.filteredData.length, this.currentPage * this.rowsPerPage);
        if (totalCount) totalCount.textContent = this.filteredData.length;
    }

    previousPage() {
        if (this.currentPage > 1) {
            this.currentPage--;
            this.renderTable();
        }
    }

    nextPage() {
        const totalPages = Math.ceil(this.filteredData.length / this.rowsPerPage);
        if (this.currentPage < totalPages) {
            this.currentPage++;
            this.renderTable();
        }
    }

    initCharts() {
        this.initTypesChart();
        this.initServicesChart();
        this.initActivityChart();
        this.initPrioritiesChart();
    }

    initTypesChart() {
        const ctx = document.getElementById('chart-types')?.getContext('2d');
        if (!ctx) return;

        this.charts.types = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: [],
                datasets: [{
                    label: 'Количество клиентов',
                    data: [],
                    backgroundColor: '#3498db'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }

    initServicesChart() {
        const ctx = document.getElementById('chart-services')?.getContext('2d');
        if (!ctx) return;

        this.charts.services = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: [],
                datasets: [{
                    data: [],
                    backgroundColor: [
                        '#3498db', '#2ecc71', '#e74c3c', '#f39c12',
                        '#9b59b6', '#1abc9c', '#d35400', '#34495e'
                    ]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false
            }
        });
    }

    initActivityChart() {
        const ctx = document.getElementById('chart-activity')?.getContext('2d');
        if (!ctx) return;

        this.charts.activity = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Клиентов добавлено',
                    data: [],
                    borderColor: '#3498db',
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }

    initPrioritiesChart() {
        const ctx = document.getElementById('chart-priorities')?.getContext('2d');
        if (!ctx) return;

        this.charts.priorities = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Высокий', 'Средний', 'Низкий'],
                datasets: [{
                    data: [0, 0, 0],
                    backgroundColor: ['#e74c3c', '#f39c12', '#27ae60']
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false
            }
        });
    }

    updateCharts() {
        this.updateTypesChart();
        this.updateServicesChart();
        this.updateActivityChart();
        this.updatePrioritiesChart();
    }

    updateTypesChart() {
        if (!this.charts.types) return;

        const typesCount = {};

        this.filteredData.forEach(client => {
            const type = client.building_object?.object_type || 'other';
            typesCount[type] = (typesCount[type] || 0) + 1;
        });

        const labels = Object.keys(typesCount).map(type => this.getTypeLabel(type));
        const data = Object.values(typesCount);

        this.charts.types.data.labels = labels;
        this.charts.types.data.datasets[0].data = data;
        this.charts.types.update();
    }

    updateServicesChart() {
        if (!this.charts.services) return;

        const servicesCount = {};

        this.filteredData.forEach(client => {
            const services = client.interested_services || client.services || [];
            services.forEach(service => {
                servicesCount[service] = (servicesCount[service] || 0) + 1;
            });
        });

        const labels = Object.keys(servicesCount).map(service => this.getServiceLabel(service));
        const data = Object.values(servicesCount);

        this.charts.services.data.labels = labels;
        this.charts.services.data.datasets[0].data = data;
        this.charts.services.update();
    }

    updateActivityChart() {
        if (!this.charts.activity) return;

        // Группируем по дням за последние 7 дней
        const last7Days = [];
        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            last7Days.push(date.toISOString().split('T')[0]);
        }

        const activityData = last7Days.map(date => {
            return this.filteredData.filter(client => {
                const clientDate = new Date(client.created_at || client.timestamp).toISOString().split('T')[0];
                return clientDate === date;
            }).length;
        });

        const labels = last7Days.map(date => {
            const d = new Date(date);
            return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
        });

        this.charts.activity.data.labels = labels;
        this.charts.activity.data.datasets[0].data = activityData;
        this.charts.activity.update();
    }

    updatePrioritiesChart() {
        if (!this.charts.priorities) return;

        const prioritiesCount = {
            high: 0,
            medium: 0,
            low: 0
        };

        this.filteredData.forEach(client => {
            const priority = client.priority || 'medium';
            prioritiesCount[priority]++;
        });

        this.charts.priorities.data.datasets[0].data = [
            prioritiesCount.high,
            prioritiesCount.medium,
            prioritiesCount.low
        ];
        this.charts.priorities.update();
    }

    updateStats() {
        const totalClients = document.getElementById('total-clients');
        const newThisWeek = document.getElementById('new-this-week');
        const highPriority = document.getElementById('high-priority');

        if (totalClients) totalClients.textContent = this.filteredData.length;

        // Новые за неделю
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        const newThisWeekCount = this.filteredData.filter(client =>
            new Date(client.created_at || client.timestamp) > weekAgo
        ).length;
        if (newThisWeek) newThisWeek.textContent = newThisWeekCount;

        // Высокий приоритет
        const highPriorityCount = this.filteredData.filter(client =>
            (client.priority || 'medium') === 'high'
        ).length;
        if (highPriority) highPriority.textContent = highPriorityCount;
    }

    async exportData() {
        const format = document.getElementById('export-format').value;
        const range = document.getElementById('export-range').value;

        let dataToExport = this.filteredData;

        // Применяем временной диапазон для экспорта
        if (range !== 'all') {
            const now = new Date();
            let startDate;

            switch (range) {
                case 'today':
                    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                    break;
                case 'week':
                    startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                    break;
                case 'month':
                    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                    break;
            }

            if (startDate) {
                dataToExport = dataToExport.filter(client =>
                    new Date(client.created_at || client.timestamp) >= startDate
                );
            }
        }

        // Подготавливаем данные для экспорта
        const exportData = dataToExport.map(client => ({
            'Имя клиента': client.name || 'Не указано',
            'Тип объекта': this.getTypeLabel(client.building_object?.object_type),
            'Телефон': client.contact_phone || 'Не указан',
            'Адрес': client.building_object_address || client.building_object?.address || 'Не указан',
            'Услуги': (client.interested_services || client.services || []).map(s => this.getServiceLabel(s)).join(', '),
            'Приоритет': this.getPriorityLabel(client.priority),
            'Инженер': client.engineer_name || client.engineer || 'Не указан',
            'Дата добавления': new Date(client.created_at || client.timestamp).toLocaleString('ru-RU'),
            'Комментарии': client.notes || client.needs || ''
        }));

        if (format === 'excel') {
            this.exportToExcel(exportData);
        } else {
            this.exportToCSV(exportData);
        }
    }

    exportToExcel(data) {
        try {
            const ws = XLSX.utils.json_to_sheet(data);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Клиенты');
            XLSX.writeFile(wb, `clients_export_${new Date().toISOString().split('T')[0]}.xlsx`);
            auth.showMessage('Данные успешно экспортированы в Excel', 'success');
        } catch (error) {
            auth.showMessage('Ошибка при экспорте в Excel', 'error');
            console.error('Export error:', error);
        }
    }

    exportToCSV(data) {
        if (data.length === 0) {
            auth.showMessage('Нет данных для экспорта', 'error');
            return;
        }

        const headers = Object.keys(data[0]);
        const csvContent = [
            headers.join(','),
            ...data.map(row =>
                headers.map(header =>
                    `"${String(row[header] || '').replace(/"/g, '""')}"`
                ).join(',')
            )
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);

        link.setAttribute('href', url);
        link.setAttribute('download', `clients_export_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        auth.showMessage('Данные успешно экспортированы в CSV', 'success');
    }

    async refreshData() {
        await this.loadClientsData();
        auth.showMessage('Данные обновлены', 'success');
    }

    viewClient(clientId) {
        const client = this.clientsData.find(c => c.id === clientId);
        if (client) {
            alert(`
                Просмотр клиента:
                Имя: ${client.name || 'Не указано'}
                Телефон: ${client.contact_phone || 'Не указан'}
                Тип объекта: ${this.getTypeLabel(client.building_object?.object_type)}
                Адрес: ${client.building_object_address || client.building_object?.address || 'Не указан'}
                Услуги: ${(client.interested_services || client.services || []).map(s => this.getServiceLabel(s)).join(', ')}
                Приоритет: ${this.getPriorityLabel(client.priority)}
                Комментарии: ${client.notes || client.needs || 'нет'}
                Дата: ${new Date(client.created_at || client.timestamp).toLocaleString('ru-RU')}
                Инженер: ${client.engineer_name || client.engineer || 'Не указан'}
            `);
        }
    }

    editClient(clientId) {
        auth.showMessage('Функция редактирования в разработке', 'info');
    }

    // Вспомогательные методы
    getTypeLabel(type) {
        const types = {
            'mcd': 'МКД',
            'hotel': 'Отель',
            'cafe': 'Кафе',
            'restaurant': 'Ресторан',
            'office': 'Офис',
            'private_house': 'Частный дом',
            'other': 'Другое'
        };
        return types[type] || type;
    }

    getServiceLabel(service) {
        const services = {
            'internet': 'Интернет',
            'tv': 'ТВ',
            'cctv': 'Видеонаблюдение',
            'telephony': 'Телефония',
            'security': 'Безопасность',
            'smart_home': 'Умный дом'
        };
        return services[service] || service;
    }

    getPriorityLabel(priority) {
        const priorities = {
            'high': 'Высокий',
            'medium': 'Средний',
            'low': 'Низкий'
        };
        return priorities[priority] || 'Средний';
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Глобальный экземпляр
let adminInterface;