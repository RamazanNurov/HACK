from django.contrib import admin
from django.urls import path, include, re_path
from django.views.generic import TemplateView
from django.conf import settings
from django.conf.urls.static import static


urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('users.urls')),
    path('api/', include('objects.urls')),
    path('api/', include('clients.urls')),


    path('', TemplateView.as_view(template_name='index.html'), name='index'),
    path('login/', TemplateView.as_view(template_name='index.html'), name='login'),
    path('admin-panel/', TemplateView.as_view(template_name='index.html'), name='admin-panel'),
    re_path(r'^.*$', TemplateView.as_view(template_name='index.html')),
]

# Статические файлы для разработки
if settings.DEBUG:
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)