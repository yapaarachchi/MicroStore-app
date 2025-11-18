from sqlalchemy import Column, Integer, String, Float, DateTime
from database import Base
import datetime

class Invoice(Base):
    __tablename__ = "invoices"
    id = Column(Integer, primary_key=True, index=True)
    customer_name = Column(String)
    product_name = Column(String)
    quantity = Column(Integer) # New Column
    amount = Column(Float)     # This will now store the TOTAL amount
    generated_by = Column(String)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)