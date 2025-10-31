from django.urls import path
from . import views

urlpatterns = [
    path('cities/', views.CityListView.as_view(), name='city-list'),
    path('objects/', views.BuildingObjectListView.as_view(), name='object-list'),
    path('objects/<int:pk>/', views.BuildingObjectDetailView.as_view(), name='object-detail'),
    path('cities/<int:city_id>/objects/', views.BuildingObjectsByCityView.as_view(), name='objects-by-city'),
]