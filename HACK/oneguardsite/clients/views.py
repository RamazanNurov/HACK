from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes
from django.db.models import Count, Avg
from .models import ClientData, ClientHistory
from .serializers import (
    ClientDataSerializer, ClientDataCreateSerializer,
    ClientHistorySerializer, ClientReportSerializer
)


class ClientDataListView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return ClientDataCreateSerializer
        return ClientDataSerializer

    def get_queryset(self):
        # Инженер видит только своих клиентов
        # Администратор видит всех
        user = self.request.user
        if user.profile.role == 'admin':
            return ClientData.objects.all()
        else:
            return ClientData.objects.filter(engineer=user)

    def perform_create(self, serializer):
        # Автоматически записываем историю
        client_data = serializer.save()

        # Создаем запись в истории
        ClientHistory.objects.create(
            client_data=client_data,
            user=self.request.user,
            action=f"Создана новая запись для квартиры {client_data.apartment_number}"
        )


class ClientDataDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = ClientDataSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.profile.role == 'admin':
            return ClientData.objects.all()
        else:
            return ClientData.objects.filter(engineer=user)

    def perform_update(self, serializer):
        client_data = serializer.save()

        # Записываем в историю
        ClientHistory.objects.create(
            client_data=client_data,
            user=self.request.user,
            action="Обновлены данные клиента"
        )


class ClientHistoryView(generics.ListAPIView):
    serializer_class = ClientHistorySerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        client_id = self.kwargs['client_id']
        return ClientHistory.objects.filter(client_data_id=client_id)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def client_reports(request):
    """Генерация отчетов по клиентам"""
    user = request.user

    if user.profile.role != 'admin':
        return Response(
            {'error': 'Только администраторы могут просматривать отчеты'},
            status=status.HTTP_403_FORBIDDEN
        )

    # Статистика по городам
    cities_stats = []
    cities = City.objects.all()

    for city in cities:
        clients_in_city = ClientData.objects.filter(building_object__city=city)
        total_clients = clients_in_city.count()

        if total_clients > 0:
            internet_interest = clients_in_city.filter(
                interested_services__contains=['internet']
            ).count()

            tv_interest = clients_in_city.filter(
                interested_services__contains=['tv']
            ).count()

            avg_rating = clients_in_city.aggregate(
                Avg('provider_rating')
            )['provider_rating__avg'] or 0

            cities_stats.append({
                'city': city.name,
                'total_clients': total_clients,
                'internet_interest': internet_interest,
                'tv_interest': tv_interest,
                'average_rating': round(avg_rating, 2)
            })

    return Response(cities_stats)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def sync_offline_data(request):
    """Синхронизация офлайн-данных"""
    offline_data = request.data.get('data', [])
    synced_ids = []

    for item in offline_data:
        serializer = ClientDataCreateSerializer(
            data=item,
            context={'request': request}
        )

        if serializer.is_valid():
            client_data = serializer.save()
            synced_ids.append(client_data.id)

    return Response({
        'message': f'Успешно синхронизировано {len(synced_ids)} записей',
        'synced_ids': synced_ids
    })