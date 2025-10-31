from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes
from rest_framework_simplejwt.views import TokenObtainPairView
from django.db import transaction
from django.db.models import Count
from .models import User
from .serializers import (
    UserSerializer, UserCreateSerializer,
    LoginSerializer, CustomTokenObtainPairSerializer
)


class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer


class UserListView(generics.ListAPIView):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # Администраторы видят всех пользователей, инженеры - только себя
        user = self.request.user
        if user.role == 'admin':
            return User.objects.all()
        else:
            return User.objects.filter(id=user.id)


class UserCreateView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = UserCreateSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        # Только администраторы могут создавать пользователей
        if self.request.user.role != 'admin':
            raise permissions.PermissionDenied("Только администраторы могут создавать пользователей")
        serializer.save()


class UserDetailView(generics.RetrieveUpdateAPIView):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role == 'admin':
            return User.objects.all()
        else:
            # Инженеры могут видеть только свои данные
            return User.objects.filter(id=user.id)


class CurrentUserView(generics.RetrieveAPIView):
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def register_engineer(request):
    """Регистрация нового инженера (доступно без авторизации)"""
    serializer = UserCreateSerializer(data=request.data)

    if serializer.is_valid():
        try:
            with transaction.atomic():
                user = serializer.save()
                user.role = 'engineer'  # По умолчанию создаем инженера
                user.save()

                return Response({
                    'message': 'Инженер успешно зарегистрирован',
                    'user_id': user.id
                }, status=status.HTTP_201_CREATED)

        except Exception as e:
            return Response(
                {'error': f'Ошибка при создании пользователя: {str(e)}'},
                status=status.HTTP_400_BAD_REQUEST
            )

    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def user_statistics(request):
    """Статистика пользователей (только для администраторов)"""
    if request.user.role != 'admin':
        return Response(
            {'error': 'Только администраторы могут просматривать статистику'},
            status=status.HTTP_403_FORBIDDEN
        )

    total_users = User.objects.count()
    engineers_count = User.objects.filter(role='engineer').count()
    admins_count = User.objects.filter(role='admin').count()

    return Response({
        'total_users': total_users,
        'engineers_count': engineers_count,
        'admins_count': admins_count,
        'users_by_city': User.objects.values('city').annotate(count=Count('id'))
    })