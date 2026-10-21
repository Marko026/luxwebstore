ALTER TABLE "checkout_items" DROP CONSTRAINT "checkout_items_product_id_products_id_fk";
--> statement-breakpoint
ALTER TABLE "checkout_items" ADD CONSTRAINT "checkout_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;