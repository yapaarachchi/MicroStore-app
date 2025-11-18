import json
import os
import sys
import time
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy.exc import OperationalError
from pydantic import BaseModel, conint
from typing import List
from confluent_kafka import Producer
import models
from database import engine, get_db

# --- DB CONNECTION RETRY LOGIC ---
def wait_for_db():
    retries = 10
    while retries > 0:
        try:
            models.Base.metadata.create_all(bind=engine)
            print("✅ Inventory DB connected and tables created.", file=sys.stdout)
            return
        except OperationalError as e:
            print(f"⏳ Inventory DB not ready yet. Retrying in 3s... ({retries} attempts left)", file=sys.stdout)
            time.sleep(3)
            retries -= 1
    print("❌ Failed to connect to Inventory DB after multiple attempts.", file=sys.stderr)
    sys.exit(1)

# Run the wait check
wait_for_db()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

KAFKA_BOOTSTRAP_SERVERS = os.getenv('KAFKA_BOOTSTRAP_SERVERS', '')
if not KAFKA_BOOTSTRAP_SERVERS:
    print("WARNING: KAFKA_BOOTSTRAP_SERVERS is not set.")

conf = {'bootstrap.servers': KAFKA_BOOTSTRAP_SERVERS, 'client.id': 'inventory-service'}
try:
    producer = Producer(conf)
except Exception as e:
    print(f"Failed to create producer: {e}")
    producer = None

def delivery_report(err, msg):
    if err is not None:
        print(f'❌ Message delivery failed: {err}', file=sys.stderr)
    else:
        print(f'✅ Message delivered to {msg.topic()}')

# --- REQUEST MODELS ---
class ProductCreate(BaseModel):
    name: str
    price: float
    stock: int
    category: str

class SaleItem(BaseModel):
    product_id: int
    quantity: conint(gt=0) = 1

class AssignRequest(BaseModel):
    customer_name: str
    user_id: str
    items: List[SaleItem]

# --- ROUTES ---
@app.post("/products/")
def create_product(product: ProductCreate, db: Session = Depends(get_db)):
    db_product = models.Product(**product.dict())
    db.add(db_product)
    db.commit()
    db.refresh(db_product)
    return db_product

@app.get("/products/")
def read_products(db: Session = Depends(get_db)):
    return db.query(models.Product).all()

@app.post("/assign/")
def assign_product(request: AssignRequest, db: Session = Depends(get_db)):
    if not request.items:
        raise HTTPException(status_code=400, detail="At least one item is required.")

    product_ids = [item.product_id for item in request.items]
    products = db.query(models.Product).filter(models.Product.id.in_(product_ids)).all()
    product_map = {product.id: product for product in products}

    invoice_items = []
    total_amount = 0

    # Validate availability
    for item in request.items:
        product = product_map.get(item.product_id)
        if not product:
            raise HTTPException(status_code=404, detail=f"Product {item.product_id} not found")
        if product.stock < item.quantity:
            raise HTTPException(
                status_code=400,
                detail=f"Not enough stock for {product.name}. Only {product.stock} available."
            )

    # Apply stock updates and prepare invoice items
    try:
        for item in request.items:
            product = product_map[item.product_id]
            product.stock -= item.quantity
            line_total = product.price * item.quantity
            total_amount += line_total
            invoice_items.append({
                "product_id": product.id,
                "product_name": product.name,
                "unit_price": product.price,
                "quantity": item.quantity,
                "line_total": line_total
            })
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

    if producer:
        event = {
            "customer_name": request.customer_name,
            "generated_by": request.user_id,
            "items": invoice_items,
            "total_amount": total_amount
        }
        producer.produce(
            'invoices_topic',
            key=request.customer_name,
            value=json.dumps(event),
            callback=delivery_report
        )
        producer.poll(0)
        producer.flush(timeout=5)

    return {
        "message": "Sale processed",
        "total_amount": total_amount,
        "items": invoice_items
    }