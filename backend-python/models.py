from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean, Float, Enum, Text
from sqlalchemy.orm import relationship
from database import DBBase
from datetime import datetime
import enum


class Role(str, enum.Enum):
    ADMIN = "ADMIN"
    COMERCIAL = "COMERCIAL"
    TI = "TI"


class Usuario(DBBase):
    __tablename__ = "usuarios"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String, nullable=False)
    correo = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    area = Column(String, nullable=False)  
    activo = Column(Boolean, default=True)
    creado_en = Column(DateTime, default=datetime.utcnow)
    actualizado_en = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    actividades = relationship("Actividad", back_populates="usuario")


class Cliente(DBBase):
    __tablename__ = "clientes"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String, index=True, nullable=False)
    email = Column(String, unique=True, index=True)
    telefono = Column(String)
    ubicacion = Column(String)
    estado = Column(String, default="Activo")  # Activo, Cerrado
    fecha_registro = Column(DateTime, default=datetime.utcnow)

    tasa_conversion = Column(Float, default=0.0)
    satisfaccion = Column(Float, default=0.0)

    pagos = relationship("Pago", back_populates="cliente")
    ofertas = relationship("Oferta", back_populates="cliente")
    oportunidades = relationship("Oportunidad", back_populates="cliente")
    actividades = relationship("Actividad", back_populates="cliente")


class Pago(DBBase):
    __tablename__ = "pagos"

    id = Column(Integer, primary_key=True, index=True)
    cliente_id = Column(Integer, ForeignKey("clientes.id"), nullable=False)
    monto = Column(Float, nullable=False)
    fecha_pago = Column(DateTime, default=datetime.utcnow)
    metodo = Column(String, nullable=True)
    estado = Column(String, default="CONFIRMADO")  

    cliente = relationship("Cliente", back_populates="pagos")


class Oferta(DBBase):
    __tablename__ = "ofertas"

    id = Column(Integer, primary_key=True, index=True)
    cliente_id = Column(Integer, ForeignKey("clientes.id"), nullable=False)
    titulo = Column(String, nullable=False)
    descripcion = Column(Text, nullable=True)
    valor = Column(Float, nullable=True)
    estado = Column(String, default="ABIERTA") 
    fecha_inicio = Column(DateTime, default=datetime.utcnow)
    fecha_fin = Column(DateTime, nullable=True)

    cliente = relationship("Cliente", back_populates="ofertas")


class Oportunidad(DBBase):
    __tablename__ = "oportunidades"

    id = Column(Integer, primary_key=True, index=True)
    cliente_id = Column(Integer, ForeignKey("clientes.id"), nullable=False)
    descripcion = Column(Text, nullable=True)
    etapa = Column(String, default="NUEVA")
    probabilidad = Column(Float, default=0.0)
    valor = Column(Float, default=0.0)
    fecha_creacion = Column(DateTime, default=datetime.utcnow)

    cliente = relationship("Cliente", back_populates="oportunidades")


class Actividad(DBBase):
    __tablename__ = "actividades"

    id = Column(Integer, primary_key=True, index=True)
    usuario_id = Column(Integer, ForeignKey("usuarios.id"), nullable=True)
    cliente_id = Column(Integer, ForeignKey("clientes.id"), nullable=True)
    tipo = Column(String, nullable=False) 
    entidad = Column(String, nullable=True)
    entidad_id = Column(Integer, nullable=True)
    detalles_before = Column(Text, nullable=True)
    detalles_after = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)

    usuario = relationship("Usuario", back_populates="actividades")
    cliente = relationship("Cliente", back_populates="actividades")
