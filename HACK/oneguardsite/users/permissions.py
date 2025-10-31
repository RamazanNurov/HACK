from rest_framework import permissions


class IsAdminUser(permissions.BasePermission):
    """Разрешение только для администраторов"""

    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == 'admin'


class IsOwnerOrAdmin(permissions.BasePermission):
    """Разрешение для владельца или администратора"""

    def has_object_permission(self, request, view, obj):
        if request.user.role == 'admin':
            return True
        return obj.id == request.user.id


class CanCreateUser(permissions.BasePermission):
    """Кто может создавать пользователей"""

    def has_permission(self, request, view):
        if view.action == 'create':
            return request.user.is_authenticated and request.user.role == 'admin'
        return True