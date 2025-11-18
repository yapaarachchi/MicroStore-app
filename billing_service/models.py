from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from database import Base
import datetime


class Invoice(Base):
    __tablename__ = "invoices"

    id = Column(Integer, primary_key=True, index=True)
    customer_name = Column(String)
    total_amount = Column(Float)
    generated_by = Column(String)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    items = relationship("InvoiceItem", back_populates="invoice", cascade="all, delete-orphan")


class InvoiceItem(Base):
    __tablename__ = "invoice_items"

    id = Column(Integer, primary_key=True, index=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id"))
    product_id = Column(Integer)
    product_name = Column(String)
    quantity = Column(Integer)
    unit_price = Column(Float)
    line_total = Column(Float)

    invoice = relationship("Invoice", back_populates="items")