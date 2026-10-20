CREATE TABLE "bag_items" (
	"user_id" text NOT NULL,
	"product_id" integer NOT NULL,
	"quantity" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bag_items_user_id_product_id_pk" PRIMARY KEY("user_id","product_id"),
	CONSTRAINT "bag_items_quantity_check" CHECK ("bag_items"."quantity" >= 1)
);
--> statement-breakpoint
ALTER TABLE "bag_items" ADD CONSTRAINT "bag_items_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bag_items" ADD CONSTRAINT "bag_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bag_items_product_id_idx" ON "bag_items" USING btree ("product_id");