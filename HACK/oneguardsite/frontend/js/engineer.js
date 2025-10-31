class EngineerInterface {
    constructor() {
        this.currentLocation = null;
        this.isOnline = navigator.onLine;
        this.cities = [];
        this.objects = [];
        this.init();
    }

    async init() {
        await this.loadCitiesAndObjects();
        this.initEventListeners();
        this.initOfflineDetection();
        await this.loadRecentClients();
        this.requestLocationPermission();
    }

    async loadCitiesAndObjects() {
        try {
            // Загружаем города и объекты из API
            const [citiesResponse, objectsResponse] = await Promise.all([
                auth.apiRequest('/cities/'),
                auth.apiRequest('/objects/')
            ]);

            if (citiesResponse.ok) {
                this.cities = await citiesResponse.json();
                this.populateCitiesFilter();
            }

            if (objectsResponse.ok) {
                this.objects = await objectsResponse.json();
                this.populateObjectsFilter();
            }

        } catch (error) {
            console.error('Error loading cities and objects:', error);
            auth.showMessage('Ошибка загрузки справочников', 'error');
        }
    }

    populateCitiesFilter() {
        // Если в форме есть выбор города, заполняем его
        const citySelect = document.getElementById('city-select');
        if (citySelect) {
            citySelect.innerHTML = `
                <option value="">Выберите город</option>
                ${this.cities.map(city => `
                    <option value="${city.id}">${city.name}</option>
                `).join('')}
            `;

            // Обновляем объекты при выборе города
            citySelect.addEventListener('change', (e) => {
                this.updateObjectsByCity(e.target.value);
            });
        }
    }

    populateObjectsFilter() {
        this.updateObjectsByCity('');
    }

    updateObjectsByCity(cityId) {
        const objectSelect = document.getElementById('object-select');
        if (!objectSelect) return;

        const filteredObjects = cityId
            ? this.objects.filter(obj => obj.city == cityId)
            : this.objects;

        objectSelect.innerHTML = `
            <option value="">Выберите объект</option>
            ${filteredObjects.map(obj => `
                <option value="${obj.id}">${obj.name} (${obj.address})</option>
            `).join('')}
        `;
    }

    initEventListeners() {
        // Форма добавления клиента
        const clientForm = document.getElementById('client-form');
        if (clientForm) {
            clientForm.addEventListener('submit', (e) => this.handleClientSubmit(e));
        }

        // Кнопка определения местоположения
        const locationBtn = document.getElementById('get-location-btn');
        if (locationBtn) {
            locationBtn.addEventListener('click', () => this.getCurrentLocation());
        }

        // Кнопка сохранения черновика
        const draftBtn = document.getElementById('save-draft-btn');
        if (draftBtn) {
            draftBtn.addEventListener('click', () => this.saveAsDraft());
        }

        // Кнопка синхронизации
        const syncBtn = document.getElementById('sync-now-btn');
        if (syncBtn) {
            syncBtn.addEventListener('click', () => this.syncOfflineData());
        }
    }

    initOfflineDetection() {
        // Слушаем события изменения онлайн-статуса
        window.addEventListener('online', () => {
            this.setOnlineStatus(true);
            this.syncOfflineData();
        });

        window.addEventListener('offline', () => {
            this.setOnlineStatus(false);
        });

        // Устанавливаем начальный статус
        this.setOnlineStatus(this.isOnline);
    }

    setOnlineStatus(online) {
        this.isOnline = online;
        const statusElement = document.getElementById('online-status');

        if (!statusElement) return;

        if (online) {
            statusElement.className = 'status-online';
            statusElement.innerHTML = '<span class="status-dot"></span>Онлайн';
            const offlineQueue = document.getElementById('offline-queue');
            if (offlineQueue) offlineQueue.classList.add('hidden');
        } else {
            statusElement.className = 'status-offline';
            statusElement.innerHTML = '<span class="status-dot"></span>Офлайн';
            const offlineQueue = document.getElementById('offline-queue');
            if (offlineQueue) offlineQueue.classList.remove('hidden');
        }

        // Обновляем очередь синхронизации
        this.renderOfflineQueue();
    }

    requestLocationPermission() {
        if (!navigator.geolocation) {
            this.setGPSStatus('not_supported');
            return;
        }

        // Просим разрешение при загрузке страницы
        navigator.geolocation.getCurrentPosition(
            (position) => {
                this.setGPSStatus('available');
            },
            (error) => {
                this.setGPSStatus('denied');
            },
            {
                enableHighAccuracy: true,
                timeout: 5000,
                maximumAge: 60000
            }
        );
    }

    setGPSStatus(status) {
        const gpsElement = document.getElementById('gps-status');
        if (!gpsElement) return;

        switch (status) {
            case 'available':
                gpsElement.className = 'status-gps';
                gpsElement.innerHTML = '<span class="status-dot"></span>GPS: Доступно';
                break;
            case 'denied':
                gpsElement.className = 'status-gps';
                gpsElement.innerHTML = '<span class="status-dot"></span>GPS: Отклонено';
                break;
            case 'not_supported':
                gpsElement.className = 'status-gps';
                gpsElement.innerHTML = '<span class="status-dot"></span>GPS: Не поддерживается';
                break;
            default:
                gpsElement.className = 'status-gps';
                gpsElement.innerHTML = '<span class="status-dot"></span>GPS: Не доступно';
        }
    }

    getCurrentLocation() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                auth.showMessage('Геолокация не поддерживается вашим браузером', 'error');
                reject(new Error('Geolocation not supported'));
                return;
            }

            auth.showMessage('Определение местоположения...', 'info');

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const { latitude, longitude } = position.coords;
                    this.currentLocation = { latitude, longitude };

                    this.reverseGeocode(latitude, longitude)
                        .then(address => {
                            const addressInput = document.getElementById('client-address');
                            if (addressInput) addressInput.value = address;
                            auth.showMessage('Местоположение определено', 'success');
                            resolve({ latitude, longitude, address });
                        })
                        .catch(error => {
                            const addressInput = document.getElementById('client-address');
                            if (addressInput) addressInput.value = `${latitude}, ${longitude}`;
                            auth.showMessage('Координаты получены, но адрес не определен', 'info');
                            resolve({ latitude, longitude, address: `${latitude}, ${longitude}` });
                        });
                },
                (error) => {
                    let message = 'Не удалось определить местоположение';
                    switch (error.code) {
                        case error.PERMISSION_DENIED:
                            message = 'Доступ к геолокации запрещен';
                            break;
                        case error.POSITION_UNAVAILABLE:
                            message = 'Информация о местоположении недоступна';
                            break;
                        case error.TIMEOUT:
                            message = 'Время ожидания определения местоположения истекло';
                            break;
                    }
                    auth.showMessage(message, 'error');
                    reject(error);
                },
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 60000
                }
            );
        });
    }

    reverseGeocode(lat, lng) {
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve(`Адрес по координатам: ${lat.toFixed(6)}, ${lng.toFixed(6)}`);
            }, 1000);
        });
    }

    async handleClientSubmit(e) {
        e.preventDefault();

        const formData = this.getFormData();

        if (!this.validateForm(formData)) {
            return;
        }

        this.setSubmitButtonLoading(true);

        try {
            if (this.isOnline) {
                // Отправляем напрямую на сервер
                await this.saveClientToServer(formData);
                auth.showMessage('Клиент успешно добавлен', 'success');
            } else {
                // Сохраняем в офлайн-хранилище
                await this.saveClientToLocalStorage(formData);
                auth.showMessage('Клиент сохранен в офлайн-режиме', 'info');
            }

            this.resetForm();
            await this.loadRecentClients();

        } catch (error) {
            console.error('Error saving client:', error);

            if (error.message.includes('network') || !this.isOnline) {
                // Пробуем сохранить локально при ошибке сети
                await this.saveClientToLocalStorage(formData);
                auth.showMessage('Клиент сохранен локально из-за ошибки сети', 'warning');
            } else {
                auth.showMessage('Ошибка при сохранении клиента', 'error');
            }
        } finally {
            this.setSubmitButtonLoading(false);
        }
    }

    async saveClientToServer(clientData) {
        const apiData = {
            building_object: clientData.building_object_id,
            apartment_number: clientData.apartment_number || '1',
            contact_phone: clientData.phone,
            used_services: clientData.used_services || [],
            interested_services: clientData.services,
            provider_rating: clientData.rating || null,
            desired_price: clientData.desired_price || null,
            notes: clientData.needs,
            latitude: clientData.location?.latitude || null,
            longitude: clientData.location?.longitude || null
        };

        const response = await auth.apiRequest('/clients/', {
            method: 'POST',
            body: JSON.stringify(apiData)
        });

        if (!response.ok) {
            throw new Error('Server error: ' + response.status);
        }

        return await response.json();
    }

    async saveClientToLocalStorage(clientData) {
        const clients = this.getLocalClients();
        clientData.id = 'local_' + Date.now();
        clientData.status = 'local';
        clientData.sync_attempts = 0;
        clients.push(clientData);

        localStorage.setItem('engineer_clients', JSON.stringify(clients));
        this.renderOfflineQueue();
    }

    getFormData() {
        const services = Array.from(document.querySelectorAll('input[name="services"]:checked'))
            .map(checkbox => checkbox.value);

        const buildingObjectId = document.getElementById('object-select')?.value;
        const apartmentNumber = document.getElementById('apartment-number')?.value || '1';

        return {
            name: document.getElementById('client-name')?.value || '',
            phone: document.getElementById('client-phone')?.value || '',
            building_object_id: buildingObjectId,
            apartment_number: apartmentNumber,
            type: document.getElementById('client-type')?.value || '',
            address: document.getElementById('client-address')?.value || '',
            services: services,
            needs: document.getElementById('client-needs')?.value || '',
            priority: document.getElementById('client-priority')?.value || 'medium',
            location: this.currentLocation,
            timestamp: new Date().toISOString(),
            engineer: auth.currentUser?.username || 'unknown'
        };
    }

    validateForm(data) {
        if (!data.name.trim()) {
            auth.showMessage('Введите имя клиента', 'error');
            return false;
        }

        if (!data.phone.trim()) {
            auth.showMessage('Введите телефон клиента', 'error');
            return false;
        }

        if (!data.building_object_id) {
            auth.showMessage('Выберите объект', 'error');
            return false;
        }

        if (!data.address.trim()) {
            auth.showMessage('Введите адрес клиента', 'error');
            return false;
        }

        return true;
    }

    setSubmitButtonLoading(loading) {
        const submitText = document.getElementById('submit-text');
        const submitLoading = document.getElementById('submit-loading');

        if (submitText && submitLoading) {
            if (loading) {
                submitText.classList.add('hidden');
                submitLoading.classList.remove('hidden');
            } else {
                submitText.classList.remove('hidden');
                submitLoading.classList.add('hidden');
            }
        }
    }

    async loadRecentClients() {
        try {
            let clients = [];

            if (this.isOnline) {
                // Загружаем с сервера
                const response = await auth.apiRequest('/clients/');
                if (response.ok) {
                    clients = await response.json();
                }
            }

            // Добавляем локальные клиенты
            const localClients = this.getLocalClients();
            clients = [...clients, ...localClients];

            this.renderRecentClients(clients);

        } catch (error) {
            console.error('Error loading clients:', error);
            // Показываем только локальные данные при ошибке
            const localClients = this.getLocalClients();
            this.renderRecentClients(localClients);
        }
    }

    renderRecentClients(clients) {
        const recentClientsList = document.getElementById('recent-clients-list');
        if (!recentClientsList) return;

        if (clients.length === 0) {
            recentClientsList.innerHTML = '<div class="empty-state">Клиенты еще не добавлены</div>';
            return;
        }

        const recentClients = clients
            .sort((a, b) => new Date(b.created_at || b.timestamp) - new Date(a.created_at || a.timestamp))
            .slice(0, 5);

        recentClientsList.innerHTML = recentClients.map(client => `
            <div class="client-item">
                <div class="client-header">
                    <span class="client-name">${client.name || 'Не указано'}</span>
                    <span class="client-type">${this.getTypeLabel(client.building_object?.object_type || client.type)}</span>
                    ${client.status === 'local' ? '<span class="status-local">⚪ Локальный</span>' : ''}
                </div>
                <div class="client-details">
                    <div>📞 ${client.contact_phone || client.phone || 'Не указан'}</div>
                    <div>📍 ${client.building_object_address || client.building_object?.address || client.address || 'Не указан'}</div>
                    ${client.notes || client.needs ? `<div>💡 ${client.notes || client.needs}</div>` : ''}
                </div>
                ${(client.interested_services || client.services || []).length > 0 ? `
                    <div class="client-services">
                        ${(client.interested_services || client.services).map(service =>
                            `<span class="service-tag">${this.getServiceLabel(service)}</span>`
                        ).join('')}
                    </div>
                ` : ''}
                <div class="client-timestamp">
                    <small>${new Date(client.created_at || client.timestamp).toLocaleString()}</small>
                </div>
            </div>
        `).join('');
    }

    getLocalClients() {
        try {
            const clients = localStorage.getItem('engineer_clients');
            return clients ? JSON.parse(clients) : [];
        } catch (error) {
            console.error('Error getting local clients:', error);
            return [];
        }
    }

    async renderOfflineQueue() {
        try {
            const queueContainer = document.getElementById('offline-queue');
            const queueList = document.getElementById('offline-queue-list');

            if (!queueContainer || !queueList) return;

            const localClients = this.getLocalClients();
            const pendingCount = localClients.length;

            if (pendingCount > 0 && !this.isOnline) {
                queueContainer.classList.remove('hidden');
                queueList.innerHTML = `
                    <div class="queue-stats">
                        <div>Ожидают синхронизации: <strong>${pendingCount}</strong></div>
                    </div>
                `;
            } else {
                queueContainer.classList.add('hidden');
            }

        } catch (error) {
            console.error('Error rendering queue:', error);
        }
    }

    async syncOfflineData() {
        if (!this.isOnline) {
            auth.showMessage('Нет подключения к интернету', 'error');
            return;
        }

        try {
            auth.showMessage('Запуск синхронизации...', 'info');

            const localClients = this.getLocalClients();
            let syncedCount = 0;
            let failedCount = 0;

            for (const client of localClients) {
                try {
                    await this.saveClientToServer(client);
                    syncedCount++;
                } catch (error) {
                    console.error('Sync error for client:', client.id, error);
                    failedCount++;

                    // Увеличиваем счетчик попыток
                    client.sync_attempts = (client.sync_attempts || 0) + 1;

                    // Если много неудачных попыток, помечаем как проблемный
                    if (client.sync_attempts > 3) {
                        client.status = 'failed';
                    }
                }
            }

            // Удаляем успешно синхронизированные клиенты
            if (syncedCount > 0) {
                const remainingClients = localClients.filter(client =>
                    client.status !== 'synced' && client.sync_attempts <= 3
                );
                localStorage.setItem('engineer_clients', JSON.stringify(remainingClients));
            }

            auth.showMessage(
                `Синхронизация завершена. Успешно: ${syncedCount}, Ошибки: ${failedCount}`,
                syncedCount > 0 ? 'success' : 'warning'
            );

            await this.loadRecentClients();
            this.renderOfflineQueue();

        } catch (error) {
            auth.showMessage('Ошибка при синхронизации', 'error');
            console.error('Sync error:', error);
        }
    }

    async saveAsDraft() {
        const formData = this.getFormData();

        try {
            const drafts = this.getDrafts();
            drafts.push({
                ...formData,
                isDraft: true,
                draftSavedAt: new Date().toISOString()
            });

            localStorage.setItem('client_drafts', JSON.stringify(drafts));
            auth.showMessage('Черновик сохранен', 'success');
        } catch (error) {
            auth.showMessage('Ошибка при сохранении черновика', 'error');
            console.error('Save draft error:', error);
        }
    }

    getDrafts() {
        try {
            const drafts = localStorage.getItem('client_drafts');
            return drafts ? JSON.parse(drafts) : [];
        } catch (error) {
            console.error('Get drafts error:', error);
            return [];
        }
    }

    resetForm() {
        const form = document.getElementById('client-form');
        if (form) form.reset();
        this.currentLocation = null;
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
}

// Глобальный экземпляр
let engineerInterface;