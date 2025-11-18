#!/usr/bin/env python3
"""
Seed the inventory and billing databases with realistic demo data.

* 100 products spanning multiple categories
* Initial stock plus rolling restocks across the previous calendar year
* >20k sales line items reflected in stock movements and invoice tables

Usage:

    python scripts/seed_databases.py

Environment variables (optional):
    INVENTORY_DATABASE_URL  (default: postgresql://admin:password123@localhost:5432/inventory_db)
    BILLING_DATABASE_URL    (default: postgresql://admin:password123@localhost:5432/billing_db)
"""
from __future__ import annotations

import datetime as dt
import os
import random
from pathlib import Path
from typing import Dict, List, Sequence, Tuple

from sqlalchemy import (
    Column,
    DateTime,
    Float,
    Integer,
    MetaData,
    String,
    Table,
    create_engine,
    text,
)

BASE_DIR = Path(__file__).resolve().parents[1]

DEFAULT_INVENTORY_DB_URL = os.getenv(
    "INVENTORY_DATABASE_URL",
    os.getenv("DATABASE_URL", "postgresql://admin:password123@localhost:5432/inventory_db"),
)
DEFAULT_BILLING_DB_URL = os.getenv(
    "BILLING_DATABASE_URL",
    "postgresql://admin:password123@localhost:5432/billing_db",
)

NUM_PRODUCTS = 100
TARGET_INVOICE_ITEMS = 22000
SEED_RANDOM = 42


# --- SQLAlchemy Table metadata (minimal subset needed for inserts) ---
inventory_md = MetaData()
billing_md = MetaData()

products_table = Table(
    "products",
    inventory_md,
    Column("id", Integer, primary_key=True),
    Column("name", String),
    Column("price", Float),
    Column("stock", Integer),
    Column("category", String),
    Column("created_at", DateTime),
    Column("updated_at", DateTime),
)

stock_movements_table = Table(
    "stock_movements",
    inventory_md,
    Column("id", Integer, primary_key=True),
    Column("product_id", Integer),
    Column("change_type", String),
    Column("quantity_delta", Integer),
    Column("previous_stock", Integer),
    Column("new_stock", Integer),
    Column("notes", String),
    Column("created_by", String),
    Column("created_at", DateTime),
)

invoices_table = Table(
    "invoices",
    billing_md,
    Column("id", Integer, primary_key=True),
    Column("customer_name", String),
    Column("total_amount", Float),
    Column("generated_by", String),
    Column("created_at", DateTime),
)

invoice_items_table = Table(
    "invoice_items",
    billing_md,
    Column("id", Integer, primary_key=True),
    Column("invoice_id", Integer),
    Column("product_id", Integer),
    Column("product_name", String),
    Column("quantity", Integer),
    Column("unit_price", Float),
    Column("line_total", Float),
)


def random_datetime_between(start: dt.datetime, end: dt.datetime) -> dt.datetime:
    delta = end - start
    seconds = random.randint(0, int(delta.total_seconds()))
    return start + dt.timedelta(seconds=seconds)


def daterange(start_date: dt.date, end_date: dt.date):
    current = start_date
    while current <= end_date:
        yield current
        current += dt.timedelta(days=1)


def build_catalog(year: int) -> Tuple[List[Dict], List[Dict]]:
    """Create 100 products with initial stock movements."""
    categories = {
        "Vegetables": ["Carrot", "Broccoli", "Spinach", "Pepper", "Onion"],
        "Fruits": ["Apple", "Banana", "Mango", "Berry Mix", "Grapes"],
        "Dairy": ["Milk", "Yogurt", "Cheese", "Butter", "Cream"],
        "Beverages": ["Orange Juice", "Cola", "Iced Tea", "Sparkling Water"],
        "Bakery": ["Wholegrain Bread", "Croissant", "Bagel", "Muffin"],
        "Meat": ["Chicken Breast", "Salmon Fillet", "Beef Steak", "Pork Chop"],
        "Household": ["Laundry Detergent", "Dish Soap", "Paper Towels", "Trash Bags"],
        "Snacks": ["Potato Chips", "Granola Bar", "Trail Mix", "Crackers"],
    }
    adjectives = [
        "Fresh",
        "Organic",
        "Premium",
        "Daily",
        "Select",
        "Golden",
        "Harvest",
        "Valley",
        "Sunrise",
        "Urban",
    ]
    base_prices = {
        "Vegetables": 2.5,
        "Fruits": 3.2,
        "Dairy": 4.0,
        "Beverages": 3.8,
        "Bakery": 3.5,
        "Meat": 9.0,
        "Household": 6.0,
        "Snacks": 2.8,
    }

    products: List[Dict] = []
    initial_movements: List[Dict] = []
    used_names = set()
    id_counter = 1
    start_window = dt.datetime(year, 1, 1)
    end_window = dt.datetime(year, 2, 15)

    while len(products) < NUM_PRODUCTS:
        category = random.choice(list(categories.keys()))
        product_noun = random.choice(categories[category])
        name = f"{random.choice(adjectives)} {product_noun}"
        if name in used_names:
            continue
        used_names.add(name)

        price = round(random.uniform(base_prices[category] * 0.8, base_prices[category] * 1.4), 2)
        initial_stock = random.randint(250, 500)
        created_at = random_datetime_between(start_window, end_window)

        product = {
            "id": id_counter,
            "name": name,
            "category": category,
            "price": price,
            "initial_stock": initial_stock,
            "current_stock": initial_stock,
            "created_at": created_at,
            "updated_at": created_at,
        }
        products.append(product)

        initial_movements.append(
            {
                "product_id": id_counter,
                "change_type": "initial",
                "quantity_delta": initial_stock,
                "previous_stock": 0,
                "new_stock": initial_stock,
                "notes": "Initial catalog load",
                "created_by": "system-seed",
                "created_at": created_at,
            }
        )

        id_counter += 1

    return products, initial_movements


def simulate_year(
    products: List[Dict],
    start_date: dt.date,
    end_date: dt.date,
) -> Tuple[List[Dict], List[Dict], List[Dict]]:
    """Generate invoices/items plus stock movements (restocks + sales)."""
    customers = [
        "Alice Harper",
        "Brian Scott",
        "Clara Diaz",
        "David Chen",
        "Eva Ramirez",
        "Felix Turner",
        "Grace Patel",
        "Hannah Singh",
        "Ian Brooks",
        "Julia Park",
        "Kevin Moore",
        "Lena Ortiz",
    ]
    cashiers = ["admin", "cassie", "noah", "liam", "ava", "mason", "zoe", "mia"]

    # Reset all products to their initial stock for simulation
    # (Final values will be recalculated based on chronological movements)
    for product in products:
        product["current_stock"] = product["initial_stock"]

    invoice_rows: List[Dict] = []
    invoice_item_rows: List[Dict] = []
    movement_rows: List[Dict] = []

    invoice_id = 1
    invoice_item_id = 1
    total_items = 0

    for day in daterange(start_date, end_date):
        day_start = dt.datetime.combine(day, dt.time.min)
        day_end = dt.datetime.combine(day, dt.time.max)

        # Morning restocks for low inventory items
        low_stock_products = [p for p in products if p["current_stock"] < 100]
        restock_candidates = random.sample(
            low_stock_products, k=min(len(low_stock_products), random.randint(3, 10)) or 0
        )
        for product in restock_candidates:
            qty = random.randint(80, 320)
            prev = product["current_stock"]
            product["current_stock"] += qty
            timestamp = random_datetime_between(
                dt.datetime.combine(day, dt.time(hour=6)),
                dt.datetime.combine(day, dt.time(hour=10)),
            )
            product["updated_at"] = timestamp
            movement_rows.append(
                {
                    "product_id": product["id"],
                    "change_type": "restock",
                    "quantity_delta": qty,
                    "previous_stock": prev,
                    "new_stock": product["current_stock"],
                    "notes": "Scheduled restock delivery",
                    "created_by": "system-seed",
                    "created_at": timestamp,
                }
            )

        daily_invoices = random.randint(35, 80)
        for _ in range(daily_invoices):
            cart_size = random.randint(1, 4)
            selected_items = []
            attempts = 0
            while len(selected_items) < cart_size and attempts < 10:
                product = random.choice(products)
                available = product["current_stock"]
                if available == 0:
                    attempts += 1
                    continue
                qty = random.randint(1, min(5, available))
                selected_items.append((product, qty))
                attempts += 1

            if not selected_items:
                continue

            sale_timestamp = random_datetime_between(day_start, day_end)
            customer = random.choice(customers)
            cashier = random.choice(cashiers)
            invoice_total = 0.0

            for product, qty in selected_items:
                line_total = round(product["price"] * qty, 2)
                invoice_item_rows.append(
                    {
                        "id": invoice_item_id,
                        "invoice_id": invoice_id,
                        "product_id": product["id"],
                        "product_name": product["name"],
                        "quantity": qty,
                        "unit_price": product["price"],
                        "line_total": line_total,
                    }
                )
                invoice_item_id += 1

                prev_stock = product["current_stock"]
                product["current_stock"] -= qty
                product["updated_at"] = sale_timestamp
                invoice_total += line_total

                movement_rows.append(
                    {
                        "product_id": product["id"],
                        "change_type": "sale",
                        "quantity_delta": -qty,
                        "previous_stock": prev_stock,
                        "new_stock": product["current_stock"],
                        "notes": f"Sale to {customer}",
                        "created_by": cashier,
                        "created_at": sale_timestamp,
                    }
                )

            invoice_rows.append(
                {
                    "id": invoice_id,
                    "customer_name": customer,
                    "total_amount": round(invoice_total, 2),
                    "generated_by": cashier,
                    "created_at": sale_timestamp,
                }
            )
            invoice_id += 1
            total_items += len(selected_items)

    if total_items < TARGET_INVOICE_ITEMS:
        print(
            f"[WARN] Generated {total_items} invoice items (< {TARGET_INVOICE_ITEMS}). "
            "Consider increasing daily_invoices or cart size."
        )
    else:
        print(f"[INFO] Generated {total_items} invoice items.")

    return invoice_rows, invoice_item_rows, movement_rows


def product_rows_for_insert(products: Sequence[Dict]) -> List[Dict]:
    return [
        {
            "id": product["id"],
            "name": product["name"],
            "price": product["price"],
            "stock": product["current_stock"],
            "category": product["category"],
            "created_at": product["created_at"],
            "updated_at": product["updated_at"],
        }
        for product in products
    ]


def reset_tables(inv_conn, bill_conn):
    inv_conn.execute(text("TRUNCATE TABLE stock_movements RESTART IDENTITY CASCADE"))
    inv_conn.execute(text("TRUNCATE TABLE products RESTART IDENTITY CASCADE"))
    bill_conn.execute(text("TRUNCATE TABLE invoice_items RESTART IDENTITY CASCADE"))
    bill_conn.execute(text("TRUNCATE TABLE invoices RESTART IDENTITY CASCADE"))


def recalculate_stock_from_movements(
    products: List[Dict],
    movement_rows: List[Dict],
) -> Tuple[List[Dict], List[Dict]]:
    """
    Recalculate stock values based on chronological order of movements.
    Ensures previous_stock and new_stock are correct for each movement.
    """
    # Group movements by product_id
    movements_by_product: Dict[int, List[Dict]] = {}
    for movement in movement_rows:
        product_id = movement["product_id"]
        if product_id not in movements_by_product:
            movements_by_product[product_id] = []
        movements_by_product[product_id].append(movement)
    
    # Recalculate stock for each product
    recalculated_movements = []
    product_stock_map = {}  # Track final stock for each product
    
    for product in products:
        product_id = product["id"]
        product_movements = movements_by_product.get(product_id, [])
        
        # Sort movements by date (oldest first), then by type (initial, restock, sale)
        type_order = {"initial": 0, "restock": 1, "sale": 2}
        product_movements.sort(key=lambda x: (x["created_at"], type_order.get(x["change_type"], 99)))
        
        current_stock = 0  # Always start from 0
        
        for movement in product_movements:
            # Set previous_stock to current stock
            movement["previous_stock"] = current_stock
            
            # Apply the delta
            current_stock += movement["quantity_delta"]
            
            # Ensure stock never goes negative
            if current_stock < 0:
                print(f"[WARN] Product {product_id} stock would go negative ({current_stock}), adjusting...")
                # Adjust the movement to prevent negative stock
                movement["quantity_delta"] = movement["quantity_delta"] + (0 - current_stock)
                current_stock = 0
            
            # Set new_stock
            movement["new_stock"] = current_stock

            # Only append movements if they have a non-zero quantity_delta,
            # or if they are not of type 'sale' (initial and restock can have 0 delta if adjusted)
            if not (movement["change_type"] == "sale" and movement["quantity_delta"] == 0):
                recalculated_movements.append(movement)
        
        # Update product's final stock
        product["current_stock"] = current_stock
        product_stock_map[product_id] = current_stock
    
    return recalculated_movements, product_stock_map


def reset_sequences(conn, table_name: str):
    conn.execute(
        text(
            """
            SELECT setval(
                pg_get_serial_sequence(:table_name, 'id'),
                COALESCE((SELECT MAX(id) FROM {}), 1),
                true
            )
            """.format(table_name)
        ),
        {"table_name": table_name},
    )


def run_seed(
    inventory_url: str | None = None,
    billing_url: str | None = None,
    target_year: int | None = None,
):
    random.seed(SEED_RANDOM)
    inventory_engine = create_engine(inventory_url or DEFAULT_INVENTORY_DB_URL)
    billing_engine = create_engine(billing_url or DEFAULT_BILLING_DB_URL)

    if target_year is None:
        target_year = dt.date.today().year - 1
    start_date = dt.date(target_year, 1, 1)
    end_date = dt.date(target_year, 12, 31)

    print(f"[INFO] Seeding data for calendar year {target_year}")
    products, initial_movements = build_catalog(target_year)
    
    # Validate: ensure we have initial movements for all products
    product_ids = {p["id"] for p in products}
    initial_product_ids = {m["product_id"] for m in initial_movements}
    missing_initial = product_ids - initial_product_ids
    if missing_initial:
        print(f"[WARN] Missing initial movements for {len(missing_initial)} products. Creating them...")
        for product_id in missing_initial:
            product = next(p for p in products if p["id"] == product_id)
            initial_movements.append({
                "product_id": product_id,
                "change_type": "initial",
                "quantity_delta": product["initial_stock"],
                "previous_stock": 0,
                "new_stock": product["initial_stock"],
                "notes": "Initial catalog load",
                "created_by": "system-seed",
                "created_at": product["created_at"],
            })
    
    invoice_rows, invoice_item_rows, activity_movements = simulate_year(
        products, start_date, end_date
    )
    
    # Combine all movements
    all_movements = initial_movements + activity_movements
    
    # Recalculate stock values based on chronological order
    print("[INFO] Recalculating stock values based on chronological movement order...")
    recalculated_movements, product_stock_map = recalculate_stock_from_movements(
        products, all_movements
    )
    
    # Update products with final stock values
    for product in products:
        product["current_stock"] = product_stock_map.get(product["id"], product.get("initial_stock", 0))
        # Update updated_at to the last movement's timestamp
        product_movements = [m for m in recalculated_movements if m["product_id"] == product["id"]]
        if product_movements:
            product["updated_at"] = max(m["created_at"] for m in product_movements)
    
    product_rows = product_rows_for_insert(products)
    movement_rows = recalculated_movements
    
    # Log movement breakdown
    initial_count = sum(1 for m in movement_rows if m["change_type"] == "initial")
    restock_count = sum(1 for m in movement_rows if m["change_type"] == "restock")
    sale_count = sum(1 for m in movement_rows if m["change_type"] == "sale")
    print(f"[INFO] Movement breakdown: {initial_count} initial, {restock_count} restocks, {sale_count} sales")

    with inventory_engine.begin() as inv_conn, billing_engine.begin() as bill_conn:
        reset_tables(inv_conn, bill_conn)

        inv_conn.execute(products_table.insert(), product_rows)
        if movement_rows:
            inv_conn.execute(stock_movements_table.insert(), movement_rows)

        if invoice_rows:
            bill_conn.execute(invoices_table.insert(), invoice_rows)
        if invoice_item_rows:
            bill_conn.execute(invoice_items_table.insert(), invoice_item_rows)

        reset_sequences(inv_conn, "products")
        reset_sequences(bill_conn, "invoices")
        reset_sequences(bill_conn, "invoice_items")

    summary = {
        "products": len(product_rows),
        "movements": len(movement_rows),
        "invoices": len(invoice_rows),
        "invoice_items": len(invoice_item_rows),
        "year": target_year,
    }
    print(
        f"[DONE] Seeded {summary['products']} products, "
        f"{summary['movements']} movements, "
        f"{summary['invoices']} invoices, "
        f"{summary['invoice_items']} invoice items."
    )
    return summary


def main():
    run_seed()


if __name__ == "__main__":
    main()

