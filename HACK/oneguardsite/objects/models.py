from django.db import models


class City(models.Model):
    name = models.CharField(max_length=100, unique=True)

    class Meta:
        verbose_name = 'Город'
        verbose_name_plural = 'Города'

    def __str__(self):
        return self.name


class BuildingObject(models.Model):
    OBJECT_TYPES = [
        ('mcd', 'МКД'),
        ('hotel', 'Отель'),
        ('cafe', 'Кафе'),
        ('restaurant', 'Ресторан'),
    ]

    name = models.CharField(max_length=200)
    address = models.TextField()
    object_type = models.CharField(max_length=20, choices=OBJECT_TYPES)
    city = models.ForeignKey(City, on_delete=models.CASCADE)

    class Meta:
        verbose_name = 'Объект'
        verbose_name_plural = 'Объекты'

    def __str__(self):
        return f"{self.name} ({self.get_object_type_display()})"