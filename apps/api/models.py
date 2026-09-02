from sqlalchemy import Column, String, Integer, Float, ForeignKey, DateTime, JSON
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime

Base = declarative_base()

class Asset(Base):
    __tablename__ = "assets"
    
    id = Column(String, primary_key=True, index=True)
    type = Column(String, index=True) # campus, building, hall, rack, server, pdu, switch
    name = Column(String)
    parent_id = Column(String, ForeignKey("assets.id"), nullable=True)
    location_id = Column(String, nullable=True)
    status = Column(String, default="ONLINE")
    health = Column(Float, default=100.0)
    dependencies = Column(JSON, default=list) # List of dependent asset IDs
    created_at = Column(DateTime, default=datetime.utcnow)
