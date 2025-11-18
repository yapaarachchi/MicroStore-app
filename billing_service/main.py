import asyncio
import json
import os
import sys
import time
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
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
                    product_name=data['product_name'],
                    quantity=data.get('quantity', 1),
                    amount=data.get('total_amount', 0),
                    generated_by=data['generated_by']
                )
                db.add(invoice)
                db.commit()
                print(f"💾 Invoice: {data['quantity']}x {data['product_name']} for ${data['total_amount']}")
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
    return db.query(models.Invoice).order_by(models.Invoice.id.desc()).all()