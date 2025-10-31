from django.contrib import admin
from .models import City, BuildingObject

@admin.register(City)
class CityAdmin(admin.ModelAdmin):
    list_display = ('name',)
    search_fields = ('name',)

@admin.register(BuildingObject)
class BuildingObjectAdmin(admin.ModelAdmin):
    list_display = ('name', 'object_type', 'city', 'address')
    list_filter = ('object_type', 'city')
    search_fields = ('name', 'address')