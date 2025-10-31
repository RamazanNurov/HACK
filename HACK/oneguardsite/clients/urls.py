from django.urls import path
from . import views

urlpatterns = [
    path('clients/', views.ClientDataListView.as_view(), name='client-list'),
    path('clients/<int:pk>/', views.ClientDataDetailView.as_view(), name='client-detail'),
    path('clients/<int:client_id>/history/', views.ClientHistoryView.as_view(), name='client-history'),
    path('reports/', views.client_reports, name='client-reports'),
    path('sync/offline/', views.sync_offline_data, name='sync-offline'),
]