CREATE TYPE "public"."checkout_state" AS ENUM('open', 'paid', 'closed');--> statement-breakpoint
CREATE TABLE "checkout_items" (
	"checkout_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price_cents" integer NOT NULL,
	"product_name" text NOT NULL,
	CONSTRAINT "checkout_items_checkout_id_product_id_pk" PRIMARY KEY("checkout_id","product_id"),
	CONSTRAINT "checkout_items_quantity_check" CHECK ("checkout_items"."quantity" >= 1),
	CONSTRAINT "checkout_items_unit_price_cents_check" CHECK ("checkout_items"."unit_price_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE "checkouts" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "checkouts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" text NOT NULL,
	"state" "checkout_state" DEFAULT 'open' NOT NULL,
	"stripe_session_id" text,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "checkouts_stripe_session_id_unique" UNIQUE("stripe_session_id")
);
--> statement-breakpoint
ALTER TABLE "checkout_items" ADD CONSTRAINT "checkout_items_checkout_id_checkouts_id_fk" FOREIGN KEY ("checkout_id") REFERENCES "public"."checkouts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkout_items" ADD CONSTRAINT "checkout_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkouts" ADD CONSTRAINT "checkouts_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "checkout_items_product_id_idx" ON "checkout_items" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "checkouts_user_id_idx" ON "checkouts" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "checkouts_one_open_per_user_idx" ON "checkouts" USING btree ("user_id") WHERE "checkouts"."state" = 'open';--> statement-breakpoint
CREATE INDEX "checkouts_open_expires_at_idx" ON "checkouts" USING btree ("expires_at") WHERE "checkouts"."state" = 'open';