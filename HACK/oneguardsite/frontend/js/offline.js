class OfflineManager {
    constructor() {
        this.dbName = 'ClientManagementDB';
        this.dbVersion = 1;
        this.db = null;
        this.syncQueue = [];
        this.isOnline = navigator.onLine;
        this.syncInProgress = false;
        this.API_BASE_URL = '/api';

        this.init();
    }

    async init() {
        await this.initDatabase();
        await this.loadSyncQueue();
        this.initEventListeners();
        this.startPeriodicSync();
    }

    initEventListeners() {
        window.addEventListener('online', () => this.handleOnline());
        window.addEventListener('offline', () => this.handleOffline());

        window.addEventListener('offlineDataChanged', () => this.onDataChanged());
    }

    async initDatabase() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = () => {
                console.error('IndexedDB error:', request.error);
                reject(request.error);
            };

            request.onsuccess = () => {
                this.db = request.result;
                console.log('IndexedDB initialized');
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                if (!db.objectStoreNames.contains('clients')) {
                    const clientsStore = db.createObjectStore('clients', {
                        keyPath: 'id',
                        autoIncrement: true
                    });
                    clientsStore.createIndex('timestamp', 'timestamp', { unique: false });
                    clientsStore.createIndex('status', 'status', { unique: false });
                }

                if (!db.objectStoreNames.contains('syncQueue')) {
                    const queueStore = db.createObjectStore('syncQueue', {
                        keyPath: 'id',
                        autoIncrement: true
                    });
                    queueStore.createIndex('timestamp', 'timestamp', { unique: false });
                    queueStore.createIndex('type', 'type', { unique: false });
                }

                if (!db.objectStoreNames.contains('cache')) {
                    const cacheStore = db.createObjectStore('cache', { keyPath: 'key' });
                }
            };
        });
    }

    // === Управление клиентами в офлайн-режиме ===

    async saveClient(clientData) {
        if (!this.db) await this.initDatabase();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['clients', 'syncQueue'], 'readwrite');

            // Сохраняем клиента в основное хранилище
            const clientsStore = transaction.objectStore('clients');
            const clientRequest = clientsStore.put({
                ...clientData,
                status: 'local',
                lastModified: new Date().toISOString(),
                sync_attempts: 0
            });

            // Добавляем в очередь синхронизации
            const queueStore = transaction.objectStore('syncQueue');
            const queueRequest = queueStore.put({
                type: 'create_client',
                data: clientData,
                timestamp: new Date().toISOString(),
                status: 'pending',
                retryCount: 0
            });

            transaction.oncomplete = () => {
                this.dispatchDataChanged();
                resolve(clientData);
            };

            transaction.onerror = () => {
                reject(transaction.error);
            };
        });
    }

    async getClients() {
        if (!this.db) await this.initDatabase();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['clients'], 'readonly');
            const store = transaction.objectStore('clients');
            const request = store.getAll();

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    async getClient(id) {
        if (!this.db) await this.initDatabase();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['clients'], 'readonly');
            const store = transaction.objectStore('clients');
            const request = store.get(id);

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    // === Управление очередью синхронизации ===

    async loadSyncQueue() {
        if (!this.db) await this.initDatabase();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['syncQueue'], 'readonly');
            const store = transaction.objectStore('syncQueue');
            const request = store.getAll();

            request.onsuccess = () => {
                this.syncQueue = request.result;
                resolve(this.syncQueue);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    async addToSyncQueue(item) {
        if (!this.db) await this.initDatabase();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['syncQueue'], 'readwrite');
            const store = transaction.objectStore('syncQueue');

            const queueItem = {
                ...item,
                timestamp: new Date().toISOString(),
                status: 'pending',
                retryCount: 0
            };

            const request = store.add(queueItem);

            request.onsuccess = () => {
                this.syncQueue.push({ ...queueItem, id: request.result });
                this.dispatchDataChanged();
                resolve(request.result);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    async removeFromSyncQueue(id) {
        if (!this.db) await this.initDatabase();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['syncQueue'], 'readwrite');
            const store = transaction.objectStore('syncQueue');
            const request = store.delete(id);

            request.onsuccess = () => {
                this.syncQueue = this.syncQueue.filter(item => item.id !== id);
                this.dispatchDataChanged();
                resolve();
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    async updateSyncQueueItem(id, updates) {
        if (!this.db) await this.initDatabase();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['syncQueue'], 'readwrite');
            const store = transaction.objectStore('syncQueue');

            const getRequest = store.get(id);

            getRequest.onsuccess = () => {
                const item = getRequest.result;
                if (!item) {
                    reject(new Error('Item not found'));
                    return;
                }

                const updatedItem = { ...item, ...updates };
                const putRequest = store.put(updatedItem);

                putRequest.onsuccess = () => {
                    const index = this.syncQueue.findIndex(item => item.id === id);
                    if (index !== -1) {
                        this.syncQueue[index] = updatedItem;
                    }
                    this.dispatchDataChanged();
                    resolve(updatedItem);
                };

                putRequest.onerror = () => {
                    reject(putRequest.error);
                };
            };

            getRequest.onerror = () => {
                reject(getRequest.error);
            };
        });
    }

    // === Синхронизация с Django API ===

    async sync() {
        if (this.syncInProgress || !this.isOnline) {
            return false;
        }

        this.syncInProgress = true;

        try {
            const pendingItems = this.syncQueue.filter(item =>
                item.status === 'pending' && item.retryCount < 3
            );

            if (pendingItems.length === 0) {
                return true;
            }

            console.log(`Starting sync for ${pendingItems.length} items`);

            this.showSyncNotification('Синхронизация данных...', 'info');

            let successCount = 0;
            let errorCount = 0;

            for (const item of pendingItems) {
                try {
                    await this.processSyncItem(item);
                    successCount++;
                } catch (error) {
                    console.error('Sync error for item:', item, error);
                    errorCount++;

                    await this.updateSyncQueueItem(item.id, {
                        retryCount: (item.retryCount || 0) + 1,
                        lastError: error.message,
                        status: item.retryCount >= 2 ? 'failed' : 'pending'
                    });
                }
            }

            // Обновляем статус локальных клиентов после синхронизации
            if (successCount > 0) {
                await this.updateLocalClientsStatus();
            }

            if (errorCount === 0) {
                this.showSyncNotification(`Данные синхронизированы (${successCount} записей)`, 'success');
            } else {
                this.showSyncNotification(
                    `Синхронизировано ${successCount} из ${pendingItems.length} записей`,
                    'warning'
                );
            }

            return errorCount === 0;

        } catch (error) {
            console.error('Sync failed:', error);
            this.showSyncNotification('Ошибка синхронизации', 'error');
            return false;
        } finally {
            this.syncInProgress = false;
        }
    }

    async processSyncItem(item) {
        if (item.type === 'create_client') {
            return await this.syncClientToServer(item.data);
        }

        throw new Error(`Unknown sync type: ${item.type}`);
    }

    async syncClientToServer(clientData) {
        // Преобразуем данные для Django API
        const apiData = {
            building_object: clientData.building_object_id,
            apartment_number: clientData.apartment_number || '1',
            contact_phone: clientData.phone,
            used_services: clientData.used_services || [],
            interested_services: clientData.services || [],
            provider_rating: clientData.rating || null,
            desired_price: clientData.desired_price || null,
            notes: clientData.needs || '',
            latitude: clientData.location?.latitude || null,
            longitude: clientData.location?.longitude || null
        };

        const token = localStorage.getItem('accessToken');
        if (!token) {
            throw new Error('No authentication token');
        }

        const response = await fetch(`${this.API_BASE_URL}/clients/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(apiData)
        });

        if (!response.ok) {
            let errorMessage = `HTTP ${response.status}`;
            try {
                const errorData = await response.json();
                errorMessage = errorData.detail || errorMessage;
            } catch (e) {
                // Не удалось распарсить JSON ошибки
            }
            throw new Error(errorMessage);
        }

        const serverData = await response.json();

        // Обновляем локальную запись с ID с сервера
        await this.updateLocalClientAfterSync(clientData.id, serverData);

        return serverData;
    }

    async updateLocalClientAfterSync(localId, serverData) {
        if (!this.db) return;

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['clients'], 'readwrite');
            const store = transaction.objectStore('clients');

            const getRequest = store.get(localId);

            getRequest.onsuccess = () => {
                const localClient = getRequest.result;
                if (localClient) {
                    // Обновляем локальную запись с серверными данными
                    const updatedClient = {
                        ...localClient,
                        ...serverData,
                        status: 'synced',
                        server_id: serverData.id,
                        lastSynced: new Date().toISOString()
                    };

                    const putRequest = store.put(updatedClient);
                    putRequest.onsuccess = () => resolve(updatedClient);
                    putRequest.onerror = () => reject(putRequest.error);
                } else {
                    resolve(null);
                }
            };

            getRequest.onerror = () => reject(getRequest.error);
        });
    }

    async updateLocalClientsStatus() {
        if (!this.db) return;

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['clients'], 'readwrite');
            const store = transaction.objectStore('clients');
            const request = store.getAll();

            request.onsuccess = async () => {
                const clients = request.result;
                const syncedQueueItems = this.syncQueue.filter(item => item.status === 'synced');

                for (const client of clients) {
                    if (client.status === 'local') {
                        // Проверяем, есть ли синхронизированная версия этого клиента
                        const syncedItem = syncedQueueItems.find(item =>
                            item.data.id === client.id
                        );

                        if (syncedItem) {
                            client.status = 'synced';
                            await new Promise((resolve, reject) => {
                                const updateRequest = store.put(client);
                                updateRequest.onsuccess = resolve;
                                updateRequest.onerror = reject;
                            });
                        }
                    }
                }
                resolve();
            };

            request.onerror = () => reject(request.error);
        });
    }

    // === Обработчики событий сети ===

    async handleOnline() {
        this.isOnline = true;
        console.log('App is online');

        this.showSyncNotification('Соединение восстановлено', 'success');

        // Даем время на установление стабильного соединения
        setTimeout(async () => {
            await this.sync();
        }, 2000);

        this.dispatchNetworkStatusChanged(true);
    }

    async handleOffline() {
        this.isOnline = false;
        console.log('App is offline');

        this.showSyncNotification('Работа в офлайн-режиме', 'warning');
        this.dispatchNetworkStatusChanged(false);
    }

    // === Периодическая синхронизация ===

    startPeriodicSync() {
        // Синхронизация каждые 2 минуты, когда онлайн
        setInterval(() => {
            if (this.isOnline && this.syncQueue.some(item => item.status === 'pending')) {
                this.sync();
            }
        }, 2 * 60 * 1000);

        // Синхронизация при возвращении на вкладку
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && this.isOnline && this.hasPendingSync()) {
                setTimeout(() => this.sync(), 1000);
            }
        });
    }

    hasPendingSync() {
        return this.syncQueue.some(item =>
            item.status === 'pending' && item.retryCount < 3
        );
    }

    // === Утилиты для работы с кэшем ===

    async cacheData(key, data) {
        if (!this.db) await this.initDatabase();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['cache'], 'readwrite');
            const store = transaction.objectStore('cache');
            const request = store.put({
                key,
                data,
                timestamp: new Date().toISOString()
            });

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async getCachedData(key) {
        if (!this.db) await this.initDatabase();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['cache'], 'readonly');
            const store = transaction.objectStore('cache');
            const request = store.get(key);

            request.onsuccess = () => {
                resolve(request.result ? request.result.data : null);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    // === Уведомления ===

    showSyncNotification(message, type = 'info') {
        if (window.auth && typeof auth.showMessage === 'function') {
            auth.showMessage(message, type);
        } else {
            console.log(`[Sync] ${type}: ${message}`);
        }
    }

    // === События ===

    dispatchDataChanged() {
        window.dispatchEvent(new CustomEvent('offlineDataChanged'));
    }

    dispatchNetworkStatusChanged(online) {
        window.dispatchEvent(new CustomEvent('networkStatusChanged', {
            detail: { online }
        }));
    }

    onDataChanged() {
        // Перезагружаем очередь при изменениях
        this.loadSyncQueue().catch(console.error);
    }

    // === Статус и статистика ===

    getSyncStatus() {
        const pending = this.syncQueue.filter(item =>
            item.status === 'pending' && item.retryCount < 3
        ).length;
        const synced = this.syncQueue.filter(item => item.status === 'synced').length;
        const failed = this.syncQueue.filter(item =>
            item.status === 'failed' || item.retryCount >= 3
        ).length;

        return {
            pending,
            synced,
            failed,
            total: this.syncQueue.length,
            isOnline: this.isOnline,
            syncInProgress: this.syncInProgress
        };
    }

    // === Миграция данных из localStorage ===

    async migrateFromLocalStorage() {
        try {
            // Миграция истории клиентов
            const history = localStorage.getItem('clientsHistory');
            if (history) {
                const clients = JSON.parse(history);
                for (const client of clients) {
                    await this.saveClient(client);
                }
                localStorage.removeItem('clientsHistory');
                console.log(`Migrated ${clients.length} clients from localStorage`);
            }

            // Миграция офлайн-очереди
            const queue = localStorage.getItem('offlineQueue');
            if (queue) {
                const queueItems = JSON.parse(queue);
                for (const item of queueItems) {
                    await this.addToSyncQueue({
                        type: 'create_client',
                        data: item,
                        timestamp: item.timestamp
                    });
                }
                localStorage.removeItem('offlineQueue');
                console.log(`Migrated ${queueItems.length} queue items from localStorage`);
            }

            // Миграция черновиков
            const drafts = localStorage.getItem('client_drafts');
            if (drafts) {
                await this.cacheData('client_drafts', JSON.parse(drafts));
                localStorage.removeItem('client_drafts');
                console.log('Migrated drafts from localStorage');
            }

            console.log('Migration from localStorage completed');
        } catch (error) {
            console.error('Migration failed:', error);
        }
    }

    // === Очистка старых данных ===

    async cleanupOldData() {
        if (!this.db) return;

        // Удаляем синхронизированные записи старше 30 дней
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['syncQueue'], 'readwrite');
            const store = transaction.objectStore('syncQueue');
            const request = store.getAll();

            request.onsuccess = () => {
                const items = request.result;
                let deletedCount = 0;

                items.forEach(item => {
                    if (item.status === 'synced' && new Date(item.timestamp) < thirtyDaysAgo) {
                        store.delete(item.id);
                        deletedCount++;
                    }
                });

                transaction.oncomplete = () => {
                    console.log(`Cleaned up ${deletedCount} old sync items`);
                    resolve(deletedCount);
                };

                transaction.onerror = () => reject(transaction.error);
            };

            request.onerror = () => reject(request.error);
        });
    }
}

// Глобальный экземпляр
let offlineManager;