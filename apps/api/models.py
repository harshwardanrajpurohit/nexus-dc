from sqlalchemy import Column, String, Integer, Float, ForeignKey, DateTime, JSON
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime

Base = declarative_base()

class Asset(Base):
    __tablename__ = "assets"
    
    id = Column(String, primary_key=True, index=True)
    type = Column(String, index=True) # campus, building, hall, rack, cdu, bess, substation, generator, chiller, cooling_tower
    name = Column(String)
    parent_id = Column(String, ForeignKey("assets.id"), nullable=True)
    location_id = Column(String, nullable=True)
    status = Column(String, default="ONLINE")
    health = Column(Float, default=100.0)
    redundancy = Column(String, default="N+1") # 2N, N+1, 2(N+1)
    rated_capacity = Column(Float, default=0.0) # kW or MWh or LPM depending on asset
    specs = Column(JSON, default=dict) # Manufacturer, Model, Revision, Voltage, Efficiency, Loss curves
    operating_limits = Column(JSON, default=dict) # Min/Max voltage, temp, power, current
    dependencies = Column(JSON, default=list) # List of dependent asset IDs
    created_at = Column(DateTime, default=datetime.utcnow)
