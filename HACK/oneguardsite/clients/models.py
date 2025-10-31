from django.db import models
from users.models import User
from objects.models import BuildingObject


class ClientData(models.Model):
    SERVICE_CHOICES = [
        ('internet', 'Интернет'),
        ('tv', 'Телевидение'),
        ('phone', 'Телефония'),
        ('security', 'Видеонаблюдение'),
        ('smart_home', 'Умный дом'),
    ]

    engineer = models.ForeignKey(User, on_delete=models.CASCADE)
    building_object = models.ForeignKey(BuildingObject, on_delete=models.CASCADE)
    apartment_number = models.CharField(max_length=10)
    contact_phone = models.CharField(max_length=20)

    # Используемые услуги (может быть несколько)
    used_services = models.JSONField(default=list)

    # Интерес к услугам (может быть несколько)
    interested_services = models.JSONField(default=list)

    provider_rating = models.IntegerField(
        choices=[(i, i) for i in range(1, 6)],  # 1-5 звезд
        null=True, blank=True
    )
    desired_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True
    )
    notes = models.TextField(blank=True)

    # Геолокация
    latitude = models.FloatField(null=True, blank=True)
    longitude = models.FloatField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Данные клиента'
        verbose_name_plural = 'Данные клиентов'
        ordering = ['-created_at']

    def __str__(self):
        return f"Клиент в {self.building_object.name} - кв. {self.apartment_number}"


class ClientHistory(models.Model):
    client_data = models.ForeignKey(ClientData, on_delete=models.CASCADE)
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    action = models.CharField(max_length=200)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'История изменений'
        verbose_name_plural = 'История изменений'
        ordering = ['-timestamp']

    def __str__(self):
        return f"{self.user.username} - {self.action}"