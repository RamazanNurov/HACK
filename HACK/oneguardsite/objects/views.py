from rest_framework import generics, permissions
from .models import City, BuildingObject
from .serializers import CitySerializer, BuildingObjectSerializer, BuildingObjectListSerializer


class CityListView(generics.ListAPIView):
    queryset = City.objects.all()
    serializer_class = CitySerializer
    permission_classes = [permissions.IsAuthenticated]


class BuildingObjectListView(generics.ListAPIView):
    serializer_class = BuildingObjectListSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = BuildingObject.objects.all()

        # Фильтрация по городу
        city_id = self.request.query_params.get('city_id')
        if city_id:
            queryset = queryset.filter(city_id=city_id)

        # Фильтрация по типу объекта
        object_type = self.request.query_params.get('object_type')
        if object_type:
            queryset = queryset.filter(object_type=object_type)

        return queryset


class BuildingObjectDetailView(generics.RetrieveAPIView):
    queryset = BuildingObject.objects.all()
    serializer_class = BuildingObjectSerializer
    permission_classes = [permissions.IsAuthenticated]


class BuildingObjectsByCityView(generics.ListAPIView):
    serializer_class = BuildingObjectListSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        city_id = self.kwargs['city_id']
        return BuildingObject.objects.filter(city_id=city_id)