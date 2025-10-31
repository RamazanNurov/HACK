from django.contrib import admin
from .models import ClientData, ClientHistory

@admin.register(ClientData)
class ClientDataAdmin(admin.ModelAdmin):
    list_display = (
        'apartment_number',
        'building_object',
        'engineer',
        'contact_phone',
        'created_at'
    )
    list_filter = ('building_object__city', 'building_object', 'engineer')
    search_fields = ('apartment_number', 'contact_phone', 'notes')
    readonly_fields = ('created_at', 'updated_at')

@admin.register(ClientHistory)
class ClientHistoryAdmin(admin.ModelAdmin):
    list_display = ('client_data', 'user', 'action', 'timestamp')
    list_filter = ('user', 'timestamp')
    readonly_fields = ('timestamp',)