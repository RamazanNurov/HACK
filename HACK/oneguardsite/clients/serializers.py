from rest_framework import serializers
from .models import ClientData, ClientHistory


class ClientDataSerializer(serializers.ModelSerializer):
    engineer_name = serializers.CharField(source='engineer.username', read_only=True)
    building_object_name = serializers.CharField(source='building_object.name', read_only=True)
    building_object_address = serializers.CharField(source='building_object.address', read_only=True)
    city_name = serializers.CharField(source='building_object.city.name', read_only=True)

    class Meta:
        model = ClientData
        fields = [
            'id', 'engineer', 'engineer_name', 'building_object', 'building_object_name',
            'building_object_address', 'city_name', 'apartment_number', 'contact_phone',
            'used_services', 'interested_services', 'provider_rating', 'desired_price',
            'notes', 'latitude', 'longitude', 'created_at', 'updated_at'
        ]
        read_only_fields = ['engineer', 'created_at', 'updated_at']


class ClientDataCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ClientData
        fields = [
            'building_object', 'apartment_number', 'contact_phone',
            'used_services', 'interested_services', 'provider_rating',
            'desired_price', 'notes', 'latitude', 'longitude'
        ]

    def create(self, validated_data):
        # Автоматически устанавливаем текущего пользователя как инженера
        request = self.context.get('request')
        if request and hasattr(request, 'user'):
            validated_data['engineer'] = request.user
        return super().create(validated_data)


class ClientHistorySerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source='user.username', read_only=True)

    class Meta:
        model = ClientHistory
        fields = ['id', 'client_data', 'user', 'user_name', 'action', 'timestamp']
        read_only_fields = ['user', 'timestamp']


class ClientReportSerializer(serializers.Serializer):
    # Сериализатор для отчетов (не привязан к модели)
    city = serializers.CharField()
    total_clients = serializers.IntegerField()
    internet_interest = serializers.IntegerField()
    tv_interest = serializers.IntegerField()
    average_rating = serializers.FloatField()