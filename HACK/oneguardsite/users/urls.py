from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from . import views

urlpatterns = [
    # Аутентификация
    path('auth/login/', views.CustomTokenObtainPairView.as_view(), name='login'),
    path('auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('auth/register/', views.register_engineer, name='register'),

    # Пользователи
    path('users/', views.UserListView.as_view(), name='user-list'),
    path('users/create/', views.UserCreateView.as_view(), name='user-create'),
    path('users/me/', views.CurrentUserView.as_view(), name='current-user'),
    path('users/<int:pk>/', views.UserDetailView.as_view(), name='user-detail'),

    # Статистика
    path('users/statistics/', views.user_statistics, name='user-statistics'),
]