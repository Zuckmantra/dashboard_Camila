from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean, Float, Enum
from sqlalchemy.orm import relationship
from database import DBBase
from datetime import datetime
import enum

class Role(str, enum.Enum):
    admin = "administrador"
    comercial = "comercial"
    desarrollador = "desarrollador"

class Usuario(DBBase):
    __tablename__ = "usuarios"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    nombre = Column(String)
    rol = Column(String) 
    password_hash = Column(String) 
    microsoft_id = Column(String, nullable=True) # For Microsoft auth

class Cliente(DBBase):
    __tablename__ = "clientes"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String, index=True)
    email = Column(String, unique=True, index=True)
    telefono = Column(String)
    ubicacion = Column(String)
    estado = Column(String, default="Activo") # Activo, Cerrado
    fecha_registro = Column(DateTime, default=datetime.utcnow)
    
    # Stats
    tasa_conversion = Column(Float, default=0.0)
    satisfaccion = Column(Float, default=0.0)
    
    conversaciones = relationship("Conversacion", back_populates="cliente")

class Conversacion(DBBase):
    __tablename__ = "conversaciones"

    id = Column(Integer, primary_key=True, index=True)
    cliente_id = Column(Integer, ForeignKey("clientes.id"))
    fecha_inicio = Column(DateTime, default=datetime.utcnow)
    estado = Column(String) # Resuelto, En Progreso, Pendiente
    ultimo_mensaje = Column(DateTime, default=datetime.utcnow)
    
    cliente = relationship("Cliente", back_populates="conversaciones")
    mensajes = relationship("Mensaje", back_populates="conversacion")

class Mensaje(DBBase):
    __tablename__ = "mensajes"

    id = Column(Integer, primary_key=True, index=True)
    conversacion_id = Column(Integer, ForeignKey("conversaciones.id"))
    contenido = Column(String)
    es_del_cliente = Column(Boolean, default=True)
    fecha_envio = Column(DateTime, default=datetime.utcnow)
    
    conversacion = relationship("Conversacion", back_populates="mensajes")