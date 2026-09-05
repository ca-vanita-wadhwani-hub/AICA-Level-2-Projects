DO $$ BEGIN
 CREATE TYPE "public"."adjustment_reason" AS ENUM('physical_count_variance', 'damage', 'leakage', 'theft_or_loss', 'data_entry_correction', 'other');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."approval_status" AS ENUM('pending', 'approved', 'rejected');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."currency" AS ENUM('TZS', 'USD');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."cylinder_size" AS ENUM('6kg', '15kg', '38kg');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."item_category" AS ENUM('bulk_lpg', 'empty_cylinder', 'refilled_cylinder', 'accessory', 'spare');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."ledger_group" AS ENUM('asset', 'liability', 'equity', 'income', 'expense');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."location_type" AS ENUM('plant', 'warehouse', 'depot', 'dealer_point', 'vehicle');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."mandatory_document_type" AS ENUM('tin_certificate', 'business_licence', 'brela_search', 'id_copy', 'vat_certificate', 'other_document');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."party_type" AS ENUM('customer', 'supplier', 'dealer', 'super_dealer');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."payment_terms" AS ENUM('advance', 'credit');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."permission_level" AS ENUM('none', 'read', 'write');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."stock_direction" AS ENUM('in', 'out');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."stock_transaction_type" AS ENUM('purchase', 'transfer_dispatch', 'transfer_receipt', 'refilling_consume', 'refilling_produce', 'sale', 'return', 'adjustment');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."tax_treatment" AS ENUM('exempt', 'vatable_18');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."user_role" AS ENUM('admin', 'finance_manager', 'accounts', 'procurement_manager', 'operations_manager', 'warehouse_manager', 'plant_engineer');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."voucher_approval_status" AS ENUM('draft', 'pending_approval', 'approved', 'rejected');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."voucher_type" AS ENUM('payment', 'receipt', 'journal', 'contra', 'petty_cash');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bill_of_materials" (
	"id" serial PRIMARY KEY NOT NULL,
	"size" "cylinder_size" NOT NULL,
	"refilled_item_id" integer NOT NULL,
	"empty_item_id" integer NOT NULL,
	"lpg_weight_kg" numeric(10, 3) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "chart_of_accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar(32) NOT NULL,
	"name" varchar(255) NOT NULL,
	"group" "ledger_group" NOT NULL,
	"currency" "currency" DEFAULT 'TZS' NOT NULL,
	"opening_balance" numeric(18, 2) DEFAULT '0' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cylinder_sale_tracking" (
	"id" serial PRIMARY KEY NOT NULL,
	"sale_stock_tx_id" integer NOT NULL,
	"party_id" integer NOT NULL,
	"item_id" integer NOT NULL,
	"quantity" numeric(18, 3) NOT NULL,
	"outstanding" boolean DEFAULT true NOT NULL,
	"return_stock_tx_id" integer,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "items" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar(32) NOT NULL,
	"name" varchar(255) NOT NULL,
	"category" "item_category" NOT NULL,
	"size" "cylinder_size",
	"uom" varchar(16) NOT NULL,
	"tax_treatment" "tax_treatment" NOT NULL,
	"specification" text,
	"hsn_code" varchar(32),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "locations" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar(32) NOT NULL,
	"name" varchar(255) NOT NULL,
	"type" "location_type" NOT NULL,
	"address" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "parties" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar(32) NOT NULL,
	"type" "party_type" NOT NULL,
	"name" varchar(255) NOT NULL,
	"nature" varchar(128),
	"region" varchar(128),
	"currency" "currency" DEFAULT 'TZS' NOT NULL,
	"payment_terms" "payment_terms" NOT NULL,
	"credit_period_days" integer DEFAULT 0 NOT NULL,
	"approved_credit_amount" numeric(18, 2) DEFAULT '0' NOT NULL,
	"opening_balance" numeric(18, 2) DEFAULT '0' NOT NULL,
	"approval_status" "approval_status" DEFAULT 'pending' NOT NULL,
	"created_by" integer NOT NULL,
	"approved_by" integer,
	"rejected_by" integer,
	"rejection_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "party_code_sequences" (
	"type" "party_type" PRIMARY KEY NOT NULL,
	"prefix" varchar(16) NOT NULL,
	"last_seq" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "party_documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"party_id" integer NOT NULL,
	"document_type" "mandatory_document_type" NOT NULL,
	"required" boolean NOT NULL,
	"upload_ref" text,
	"uploaded_at" timestamp with time zone,
	"uploaded_by" integer
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "petty_cash_vouchers" (
	"id" serial PRIMARY KEY NOT NULL,
	"voucher_id" integer NOT NULL,
	"expense_account_id" integer NOT NULL,
	"receiver_signature_ref" text,
	"approval_cap_amount" numeric(18, 2) NOT NULL,
	"requires_elevated_approval" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "refilling_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"location_id" integer NOT NULL,
	"size" "cylinder_size" NOT NULL,
	"cylinders_produced" integer NOT NULL,
	"calculated_lpg_consumed_kg" numeric(18, 3) NOT NULL,
	"calculated_empty_consumed" integer NOT NULL,
	"actual_weight_used_kg" numeric(18, 3),
	"refilled_stock_tx_id" integer,
	"lpg_consume_stock_tx_id" integer,
	"empty_consume_stock_tx_id" integer,
	"created_by" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "role_permissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"role" "user_role" NOT NULL,
	"module" varchar(64) NOT NULL,
	"level" "permission_level" DEFAULT 'none' NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "stock_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"location_id" integer NOT NULL,
	"item_id" integer NOT NULL,
	"quantity" numeric(18, 3) NOT NULL,
	"direction" "stock_direction" NOT NULL,
	"transaction_type" "stock_transaction_type" NOT NULL,
	"reference_id" varchar(64),
	"reason_code" "adjustment_reason",
	"notes" text,
	"created_by" integer NOT NULL,
	"approved_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "uploads" (
	"id" serial PRIMARY KEY NOT NULL,
	"party_id" integer,
	"original_filename" varchar(255) NOT NULL,
	"mime_type" varchar(128) NOT NULL,
	"storage_key" text NOT NULL,
	"uploaded_by" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" varchar(64) NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" text NOT NULL,
	"full_name" varchar(255) NOT NULL,
	"role" "user_role" NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "voucher_lines" (
	"id" serial PRIMARY KEY NOT NULL,
	"voucher_id" integer NOT NULL,
	"ledger_id" integer NOT NULL,
	"debit" numeric(18, 2) DEFAULT '0' NOT NULL,
	"credit" numeric(18, 2) DEFAULT '0' NOT NULL,
	"narration" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vouchers" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" "voucher_type" NOT NULL,
	"voucher_no" varchar(32) NOT NULL,
	"date" date NOT NULL,
	"narration" text,
	"approval_status" "voucher_approval_status" DEFAULT 'pending_approval' NOT NULL,
	"created_by" integer NOT NULL,
	"approved_by" integer,
	"rejected_by" integer,
	"rejection_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bill_of_materials" ADD CONSTRAINT "bill_of_materials_refilled_item_id_items_id_fk" FOREIGN KEY ("refilled_item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bill_of_materials" ADD CONSTRAINT "bill_of_materials_empty_item_id_items_id_fk" FOREIGN KEY ("empty_item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "cylinder_sale_tracking" ADD CONSTRAINT "cylinder_sale_tracking_sale_stock_tx_id_stock_transactions_id_fk" FOREIGN KEY ("sale_stock_tx_id") REFERENCES "public"."stock_transactions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "cylinder_sale_tracking" ADD CONSTRAINT "cylinder_sale_tracking_party_id_parties_id_fk" FOREIGN KEY ("party_id") REFERENCES "public"."parties"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "cylinder_sale_tracking" ADD CONSTRAINT "cylinder_sale_tracking_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "cylinder_sale_tracking" ADD CONSTRAINT "cylinder_sale_tracking_return_stock_tx_id_stock_transactions_id_fk" FOREIGN KEY ("return_stock_tx_id") REFERENCES "public"."stock_transactions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "parties" ADD CONSTRAINT "parties_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "parties" ADD CONSTRAINT "parties_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "parties" ADD CONSTRAINT "parties_rejected_by_users_id_fk" FOREIGN KEY ("rejected_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "party_documents" ADD CONSTRAINT "party_documents_party_id_parties_id_fk" FOREIGN KEY ("party_id") REFERENCES "public"."parties"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "party_documents" ADD CONSTRAINT "party_documents_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "petty_cash_vouchers" ADD CONSTRAINT "petty_cash_vouchers_voucher_id_vouchers_id_fk" FOREIGN KEY ("voucher_id") REFERENCES "public"."vouchers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "petty_cash_vouchers" ADD CONSTRAINT "petty_cash_vouchers_expense_account_id_chart_of_accounts_id_fk" FOREIGN KEY ("expense_account_id") REFERENCES "public"."chart_of_accounts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "refilling_runs" ADD CONSTRAINT "refilling_runs_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "refilling_runs" ADD CONSTRAINT "refilling_runs_refilled_stock_tx_id_stock_transactions_id_fk" FOREIGN KEY ("refilled_stock_tx_id") REFERENCES "public"."stock_transactions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "refilling_runs" ADD CONSTRAINT "refilling_runs_lpg_consume_stock_tx_id_stock_transactions_id_fk" FOREIGN KEY ("lpg_consume_stock_tx_id") REFERENCES "public"."stock_transactions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "refilling_runs" ADD CONSTRAINT "refilling_runs_empty_consume_stock_tx_id_stock_transactions_id_fk" FOREIGN KEY ("empty_consume_stock_tx_id") REFERENCES "public"."stock_transactions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "refilling_runs" ADD CONSTRAINT "refilling_runs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "stock_transactions" ADD CONSTRAINT "stock_transactions_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "stock_transactions" ADD CONSTRAINT "stock_transactions_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "stock_transactions" ADD CONSTRAINT "stock_transactions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "stock_transactions" ADD CONSTRAINT "stock_transactions_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "uploads" ADD CONSTRAINT "uploads_party_id_parties_id_fk" FOREIGN KEY ("party_id") REFERENCES "public"."parties"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "uploads" ADD CONSTRAINT "uploads_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "voucher_lines" ADD CONSTRAINT "voucher_lines_voucher_id_vouchers_id_fk" FOREIGN KEY ("voucher_id") REFERENCES "public"."vouchers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "voucher_lines" ADD CONSTRAINT "voucher_lines_ledger_id_chart_of_accounts_id_fk" FOREIGN KEY ("ledger_id") REFERENCES "public"."chart_of_accounts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_rejected_by_users_id_fk" FOREIGN KEY ("rejected_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "bom_size_idx" ON "bill_of_materials" USING btree ("size");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "coa_code_idx" ON "chart_of_accounts" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "items_code_idx" ON "items" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "locations_code_idx" ON "locations" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "parties_code_idx" ON "parties" USING btree ("code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "parties_status_idx" ON "parties" USING btree ("approval_status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "party_documents_party_doctype_idx" ON "party_documents" USING btree ("party_id","document_type");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "petty_cash_voucher_idx" ON "petty_cash_vouchers" USING btree ("voucher_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "role_permissions_role_module_idx" ON "role_permissions" USING btree ("role","module");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stock_tx_location_item_idx" ON "stock_transactions" USING btree ("location_id","item_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stock_tx_reference_idx" ON "stock_transactions" USING btree ("reference_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_username_idx" ON "users" USING btree ("username");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "voucher_lines_voucher_idx" ON "voucher_lines" USING btree ("voucher_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "vouchers_voucher_no_idx" ON "vouchers" USING btree ("voucher_no");