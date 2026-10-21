CREATE TABLE "order_items" (
	"order_number" integer NOT NULL,
	"product_id" integer NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price_cents" integer NOT NULL,
	"product_name" text NOT NULL,
	CONSTRAINT "order_items_order_number_product_id_pk" PRIMARY KEY("order_number","product_id"),
	CONSTRAINT "order_items_quantity_check" CHECK ("order_items"."quantity" >= 1),
	CONSTRAINT "order_items_unit_price_cents_check" CHECK ("order_items"."unit_price_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"number" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "orders_number_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 10001 CACHE 1),
	"checkout_id" integer,
	"user_id" text,
	"email" text NOT NULL,
	"delivery_name" text NOT NULL,
	"delivery_line1" text NOT NULL,
	"delivery_line2" text,
	"delivery_city" text NOT NULL,
	"delivery_postal_code" text NOT NULL,
	"delivery_country" text NOT NULL,
	"total_cents" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orders_checkout_id_unique" UNIQUE("checkout_id"),
	CONSTRAINT "orders_total_cents_check" CHECK ("orders"."total_cents" >= 0)
);
--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_number_orders_number_fk" FOREIGN KEY ("order_number") REFERENCES "public"."orders"("number") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_checkout_id_checkouts_id_fk" FOREIGN KEY ("checkout_id") REFERENCES "public"."checkouts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "order_items_product_id_idx" ON "order_items" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "orders_user_id_idx" ON "orders" USING btree ("user_id");