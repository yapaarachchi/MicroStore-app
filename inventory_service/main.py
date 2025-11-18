import datetime
import json
import os
import sys
import time
from fastapi import FastAPI, Depends, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import func
from sqlalchemy.exc import OperationalError
from pydantic import BaseModel, conint
from typing import List, Optional
from confluent_kafka import Producer
import models
from database import engine, get_db, SessionLocal
from scripts import seed_databases

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

INVENTORY_SEED_DB_URL = os.getenv("INVENTORY_DATABASE_URL") or os.getenv("DATABASE_URL")
BILLING_SEED_DB_URL = os.getenv("BILLING_DATABASE_URL", "postgresql://admin:password123@postgres:5432/billing_db")

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

class RestockRequest(BaseModel):
    quantity: conint(gt=0)
    user_id: str
    notes: Optional[str] = None


def serialize_product(product: models.Product):
    return {
        "id": product.id,
        "name": product.name,
        "price": product.price,
        "stock": product.stock,
        "category": product.category,
        "created_at": product.created_at.isoformat() if product.created_at else None,
        "updated_at": product.updated_at.isoformat() if product.updated_at else None
    }


def serialize_movement(movement: models.StockMovement):
    return {
        "id": movement.id,
        "product_id": movement.product_id,
        "change_type": movement.change_type,
        "quantity_delta": movement.quantity_delta,
        "previous_stock": movement.previous_stock,
        "new_stock": movement.new_stock,
        "notes": movement.notes,
        "created_by": movement.created_by,
        "created_at": movement.created_at.isoformat() if movement.created_at else None
    }


SEED_ACTION_KEY = "demo-data-seed"


def get_seed_action(db: Session):
    return (
        db.query(models.AdminAction)
        .filter(models.AdminAction.key == SEED_ACTION_KEY)
        .first()
    )


def set_seed_action_status(db: Session, status: str, error: Optional[str] = None):
    action = get_seed_action(db)
    if not action:
        action = models.AdminAction(key=SEED_ACTION_KEY)
        db.add(action)
    action.status = status
    action.last_error = error
    action.updated_at = datetime.datetime.utcnow()
    db.commit()
    db.refresh(action)
    return action


def run_seed_task(inventory_url: Optional[str], billing_url: Optional[str]):
    session = SessionLocal()
    try:
        seed_databases.run_seed(
            inventory_url=inventory_url,
            billing_url=billing_url,
        )
        set_seed_action_status(session, "completed", None)
    except Exception as exc:
        set_seed_action_status(session, "failed", str(exc))
        print(f"[SEED] Failed to seed demo data: {exc}", file=sys.stderr)
    finally:
        session.close()

# --- ROUTES ---
@app.post("/products/")
def create_product(product: ProductCreate, db: Session = Depends(get_db)):
    existing = (
        db.query(models.Product)
        .filter(func.lower(models.Product.name) == product.name.lower())
        .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail="Product name already exists.")

    db_product = models.Product(**product.dict())
    db.add(db_product)
    db.flush()

    movement = models.StockMovement(
        product_id=db_product.id,
        change_type="initial",
        quantity_delta=db_product.stock,
        previous_stock=0,
        new_stock=db_product.stock,
        created_by="system",
        notes="Initial stock"
    )
    db.add(movement)
    db.commit()
    db.refresh(db_product)
    return serialize_product(db_product)

@app.get("/products/")
def read_products(db: Session = Depends(get_db)):
    products = db.query(models.Product).all()
    return [serialize_product(product) for product in products]


@app.post("/products/{product_id}/restock/")
def restock_product(product_id: int, request: RestockRequest, db: Session = Depends(get_db)):
    product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    previous_stock = product.stock
    product.stock += request.quantity

    movement = models.StockMovement(
        product_id=product.id,
        change_type="restock",
        quantity_delta=request.quantity,
        previous_stock=previous_stock,
        new_stock=product.stock,
        created_by=request.user_id,
        notes=request.notes
    )

    db.add(movement)
    db.commit()
    db.refresh(movement)
    db.refresh(product)

    return {
        "product": serialize_product(product),
        "movement": serialize_movement(movement)
    }


@app.get("/products/{product_id}/stock-history/")
def get_stock_history(product_id: int, limit: int = 25, db: Session = Depends(get_db)):
    product_exists = db.query(models.Product.id).filter(models.Product.id == product_id).first()
    if not product_exists:
        raise HTTPException(status_code=404, detail="Product not found")

    movements = (
        db.query(models.StockMovement)
        .filter(models.StockMovement.product_id == product_id)
        .order_by(models.StockMovement.created_at.desc())
        .limit(limit)
        .all()
    )
    return [serialize_movement(movement) for movement in movements]

@app.post("/assign/")
def assign_product(request: AssignRequest, db: Session = Depends(get_db)):
    if not request.items:
        raise HTTPException(status_code=400, detail="At least one item is required.")

    product_ids = [item.product_id for item in request.items]
    products = db.query(models.Product).filter(models.Product.id.in_(product_ids)).all()
    product_map = {product.id: product for product in products}

    invoice_items = []
    total_amount = 0
    movement_entries = []

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
            previous_stock = product.stock
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
            movement_entries.append(
                models.StockMovement(
                    product_id=product.id,
                    change_type="sale",
                    quantity_delta=-item.quantity,
                    previous_stock=previous_stock,
                    new_stock=product.stock,
                    created_by=request.user_id,
                    notes=f"Sale to {request.customer_name}"
                )
            )

        for movement in movement_entries:
            db.add(movement)

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


@app.get("/admin/seed/status")
def get_seed_status(db: Session = Depends(get_db)):
    action = get_seed_action(db)
    if not action:
        return {"status": "idle", "last_error": None}
    return {"status": action.status, "last_error": action.last_error}


@app.post("/admin/seed/run")
def trigger_seed(background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    action = get_seed_action(db)
    if action and action.status in {"running", "completed"}:
        raise HTTPException(status_code=400, detail=f"Seeding already {action.status}.")
    set_seed_action_status(db, "running", None)

    if not INVENTORY_SEED_DB_URL or not BILLING_SEED_DB_URL:
        set_seed_action_status(db, "failed", "Database URLs not configured.")
        raise HTTPException(status_code=500, detail="Database URLs not configured for seeding.")

    background_tasks.add_task(run_seed_task, INVENTORY_SEED_DB_URL, BILLING_SEED_DB_URL)
    return {"status": "running"}