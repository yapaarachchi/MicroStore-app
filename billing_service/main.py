import asyncio
import json
import os
import sys
import time
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session, selectinload
from sqlalchemy.exc import OperationalError
from aiokafka import AIOKafkaConsumer
import models
from database import engine, get_db, SessionLocal

# --- DB CONNECTION RETRY LOGIC ---
def wait_for_db():
    retries = 10
    while retries > 0:
        try:
            models.Base.metadata.create_all(bind=engine)
            print("✅ Billing DB connected and tables created.", file=sys.stdout)
            return
        except OperationalError as e:
            print(f"⏳ Billing DB not ready yet. Retrying in 3s... ({retries} attempts left)", file=sys.stdout)
            time.sleep(3)
            retries -= 1
    print("❌ Failed to connect to Billing DB after multiple attempts.", file=sys.stderr)
    sys.exit(1)

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

def serialize_invoice(invoice):
    return {
        "id": invoice.id,
        "customer_name": invoice.customer_name,
        "total_amount": invoice.total_amount,
        "generated_by": invoice.generated_by,
        "created_at": invoice.created_at.isoformat(),
        "items": [
            {
                "id": item.id,
                "product_id": item.product_id,
                "product_name": item.product_name,
                "quantity": item.quantity,
                "unit_price": item.unit_price,
                "line_total": item.line_total
            } for item in invoice.items
        ],
        "item_count": len(invoice.items)
    }


async def consume():
    # Retry loop for Kafka connection
    while True:
        try:
            consumer = AIOKafkaConsumer(
                'invoices_topic',
                bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS,
                group_id="billing_group_supermarket_v2", 
                auto_offset_reset="earliest"
            )
            await consumer.start()
            print("✅ Billing Consumer Started")
            break
        except Exception as e:
            print(f"⚠️ Kafka not ready yet ({e}), retrying...")
            await asyncio.sleep(5)

    try:
        async for msg in consumer:
            try:
                data = json.loads(msg.value)
                
                db = SessionLocal()
                invoice = models.Invoice(
                    customer_name=data['customer_name'],
                    total_amount=data.get('total_amount', 0),
                    generated_by=data['generated_by']
                )
                db.add(invoice)
                db.flush()

                for item in data.get('items', []):
                    invoice_item = models.InvoiceItem(
                        invoice_id=invoice.id,
                        product_id=item.get('product_id'),
                        product_name=item.get('product_name'),
                        quantity=item.get('quantity', 1),
                        unit_price=item.get('unit_price', 0),
                        line_total=item.get('line_total', 0)
                    )
                    db.add(invoice_item)

                db.commit()
                print(f"💾 Invoice #{invoice.id}: {len(data.get('items', []))} items totaling ${data.get('total_amount', 0)}")
                db.close()
            except Exception as e:
                print(f"❌ Error processing invoice: {e}")
    finally:
        await consumer.stop()

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(consume())

@app.get("/invoices/")
def get_invoices(db: Session = Depends(get_db)):
    invoices = db.query(models.Invoice).options(selectinload(models.Invoice.items)).order_by(models.Invoice.id.desc()).all()
    return [
        {
            "id": invoice.id,
            "customer_name": invoice.customer_name,
            "generated_by": invoice.generated_by,
            "total_amount": invoice.total_amount,
            "created_at": invoice.created_at.isoformat(),
            "item_count": len(invoice.items)
        }
        for invoice in invoices
    ]


@app.get("/invoices/{invoice_id}")
def get_invoice_detail(invoice_id: int, db: Session = Depends(get_db)):
    invoice = (
        db.query(models.Invoice)
        .options(selectinload(models.Invoice.items))
        .filter(models.Invoice.id == invoice_id)
        .first()
    )
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return serialize_invoice(invoice)