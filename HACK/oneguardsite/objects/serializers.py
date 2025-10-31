from rest_framework import serializers
from .models import City, BuildingObject


class CitySerializer(serializers.ModelSerializer):
    class Meta:
        model = City
        fields = ['id', 'name']


class BuildingObjectSerializer(serializers.ModelSerializer):
    city_name = serializers.CharField(source='city.name', read_only=True)

    class Meta:
        model = BuildingObject
        fields = ['id', 'name', 'address', 'object_type', 'city', 'city_name']


class BuildingObjectListSerializer(serializers.ModelSerializer):
    city_name = serializers.CharField(source='city.name', read_only=True)
    object_type_display = serializers.CharField(source='get_object_type_display', read_only=True)

    class Meta:
        model = BuildingObject
        fields = ['id', 'name', 'address', 'object_type', 'object_type_display', 'city_name']