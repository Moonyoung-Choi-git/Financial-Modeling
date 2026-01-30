-- CreateTable
CREATE TABLE "raw_dart_api_calls" (
    "id" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "params_canonical" TEXT NOT NULL,
    "requested_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),
    "latency_ms" INTEGER,
    "http_status" INTEGER,
    "dart_status" TEXT,
    "dart_message" TEXT,
    "response_format" TEXT,
    "payload_hash" TEXT,
    "payload_size" INTEGER,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "job_id" TEXT,
    "worker_id" TEXT,

    CONSTRAINT "raw_dart_api_calls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "raw_dart_payload_json" (
    "id" TEXT NOT NULL,
    "api_call_id" TEXT NOT NULL,
    "body_json" JSONB NOT NULL,
    "parsed_ok" BOOLEAN NOT NULL DEFAULT true,
    "parse_error" TEXT,

    CONSTRAINT "raw_dart_payload_json_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "raw_dart_payload_binary" (
    "id" TEXT NOT NULL,
    "api_call_id" TEXT NOT NULL,
    "blob_path" TEXT,
    "sha256" CHAR(64) NOT NULL,
    "content_type" TEXT NOT NULL,
    "extracted_manifest_json" JSONB,

    CONSTRAINT "raw_dart_payload_binary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "raw_dart_corp_master" (
    "corp_code" CHAR(8) NOT NULL,
    "stock_code" CHAR(6),
    "corp_name" TEXT NOT NULL,
    "corp_eng_name" TEXT,
    "modify_date" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "raw_dart_corp_master_pkey" PRIMARY KEY ("corp_code")
);

-- CreateTable
CREATE TABLE "raw_dart_filings" (
    "rcept_no" TEXT NOT NULL,
    "corp_code" TEXT NOT NULL,
    "stock_code" TEXT,
    "rcept_dt" TEXT NOT NULL,
    "report_nm" TEXT NOT NULL,
    "flr_nm" TEXT NOT NULL,
    "rm" TEXT,
    "pblntf_ty" TEXT NOT NULL,
    "pblntf_detail_ty" TEXT,
    "is_final" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "raw_dart_filings_pkey" PRIMARY KEY ("rcept_no")
);

-- CreateTable
CREATE TABLE "raw_dart_fnltt_all_rows" (
    "id" TEXT NOT NULL,
    "corp_code" TEXT NOT NULL,
    "bsns_year" TEXT NOT NULL,
    "reprt_code" TEXT NOT NULL,
    "fs_div" TEXT NOT NULL,
    "rcept_no" TEXT,
    "sj_div" TEXT NOT NULL,
    "sj_nm" TEXT,
    "account_id" TEXT,
    "account_nm" TEXT NOT NULL,
    "account_detail" TEXT,
    "thstrm_nm" TEXT,
    "thstrm_amount" TEXT,
    "thstrm_add_amount" TEXT,
    "frmtrm_nm" TEXT,
    "frmtrm_amount" TEXT,
    "frmtrm_add_amount" TEXT,
    "frmtrm_q_nm" TEXT,
    "frmtrm_q_amount" TEXT,
    "bfefrmtrm_nm" TEXT,
    "bfefrmtrm_amount" TEXT,
    "ord" TEXT,
    "currency" TEXT,
    "raw_source_api_call_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "raw_dart_fnltt_all_rows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "raw_dart_fnltt_key_rows" (
    "id" TEXT NOT NULL,
    "corp_code" TEXT NOT NULL,
    "bsns_year" TEXT NOT NULL,
    "reprt_code" TEXT NOT NULL,
    "rcept_no" TEXT,
    "sj_div" TEXT NOT NULL,
    "account_nm" TEXT NOT NULL,
    "thstrm_nm" TEXT,
    "thstrm_amount" TEXT,
    "frmtrm_nm" TEXT,
    "frmtrm_amount" TEXT,
    "bfefrmtrm_nm" TEXT,
    "bfefrmtrm_amount" TEXT,
    "ord" TEXT,
    "raw_source_api_call_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "raw_dart_fnltt_key_rows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "curated_fin_standard_coa" (
    "standard_line_id" TEXT NOT NULL,
    "statement_type" TEXT NOT NULL,
    "display_name_en" TEXT NOT NULL,
    "display_name_kr" TEXT NOT NULL,
    "sign_convention" TEXT NOT NULL DEFAULT '+',
    "rollup_parent_id" TEXT,
    "is_required_for_model" BOOLEAN NOT NULL DEFAULT false,
    "default_calc_method" TEXT,
    "notes" TEXT,

    CONSTRAINT "curated_fin_standard_coa_pkey" PRIMARY KEY ("standard_line_id")
);

-- CreateTable
CREATE TABLE "curated_fin_account_mapping" (
    "id" TEXT NOT NULL,
    "account_source_id" TEXT,
    "account_name_kr" TEXT,
    "account_detail_path" TEXT,
    "statement_type" TEXT,
    "standard_line_id" TEXT NOT NULL,
    "confidence_score" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "priority" INTEGER NOT NULL DEFAULT 10,
    "mapping_version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "curated_fin_account_mapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "curated_fin_facts" (
    "id" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "corp_code" TEXT NOT NULL,
    "stock_code" TEXT,
    "period_type" TEXT NOT NULL,
    "fiscal_year" INTEGER NOT NULL,
    "fiscal_quarter" INTEGER,
    "report_code" TEXT NOT NULL,
    "fs_scope" TEXT NOT NULL,
    "statement_type" TEXT NOT NULL,
    "account_source_id" TEXT,
    "account_name_kr" TEXT NOT NULL,
    "account_detail_path" TEXT,
    "standard_line_id" TEXT,
    "amount" DECIMAL(30,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'KRW',
    "as_of_date" TIMESTAMP(3),
    "flow_start_date" TIMESTAMP(3),
    "flow_end_date" TIMESTAMP(3),
    "ordering" INTEGER,
    "source_rcept_no" TEXT,
    "source_priority" INTEGER NOT NULL DEFAULT 10,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "curated_fin_facts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "curated_fin_restatement_tracker" (
    "id" TEXT NOT NULL,
    "corp_code" TEXT NOT NULL,
    "fiscal_year" INTEGER NOT NULL,
    "report_code" TEXT NOT NULL,
    "fs_scope" TEXT NOT NULL,
    "latest_rcept_no" TEXT NOT NULL,
    "previous_rcept_no" TEXT,
    "detected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "change_summary_json" JSONB,

    CONSTRAINT "curated_fin_restatement_tracker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "model_projects" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "base_currency" TEXT NOT NULL DEFAULT 'KRW',
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "model_projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "model_entities" (
    "id" TEXT NOT NULL,
    "project_id" TEXT,
    "corp_code" TEXT NOT NULL,
    "stock_code" TEXT,
    "display_name" TEXT NOT NULL,
    "industry_template_id" TEXT,
    "fiscal_year_end_month" INTEGER,
    "default_fs_scope" TEXT NOT NULL DEFAULT 'CONSOLIDATED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "model_entities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "model_assumption_sets" (
    "id" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "scenario_name" TEXT NOT NULL,
    "assumption_version" INTEGER NOT NULL DEFAULT 1,
    "inputs_json" JSONB NOT NULL,
    "lock_flag" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT,

    CONSTRAINT "model_assumption_sets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "model_snapshots" (
    "id" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "assumption_set_id" TEXT,
    "source_data_cutoff" TIMESTAMP(3),
    "used_rcept_no_list" TEXT[],
    "used_curated_version_hash" TEXT,
    "used_mapping_version" INTEGER,
    "calc_engine_version" TEXT,
    "snapshot_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "model_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "model_output_lines" (
    "id" TEXT NOT NULL,
    "snapshot_id" TEXT NOT NULL,
    "statement_type" TEXT NOT NULL,
    "standard_line_id" TEXT NOT NULL,
    "period_index" INTEGER NOT NULL,
    "fiscal_year" INTEGER NOT NULL,
    "fiscal_quarter" INTEGER,
    "period_type" TEXT NOT NULL,
    "value" DECIMAL(30,2) NOT NULL,
    "unit_scale" TEXT NOT NULL DEFAULT 'KRW',
    "display_order" INTEGER NOT NULL,
    "is_historical" BOOLEAN NOT NULL,
    "provenance" TEXT NOT NULL,

    CONSTRAINT "model_output_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "model_support_schedule_outputs" (
    "id" TEXT NOT NULL,
    "snapshot_id" TEXT NOT NULL,
    "schedule_type" TEXT NOT NULL,
    "row_key" TEXT NOT NULL,
    "col_period" INTEGER NOT NULL,
    "value" DECIMAL(30,2) NOT NULL,
    "meta_json" JSONB,

    CONSTRAINT "model_support_schedule_outputs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "model_viewer_sheets" (
    "id" TEXT NOT NULL,
    "snapshot_id" TEXT NOT NULL,
    "sheet_name" TEXT NOT NULL,
    "grid_json" JSONB NOT NULL,
    "chart_json" JSONB,
    "last_generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cache_hash" TEXT,

    CONSTRAINT "model_viewer_sheets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT,
    "meta_json" JSONB,
    "ip_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "raw_dart_api_calls_dart_status_idx" ON "raw_dart_api_calls"("dart_status");

-- CreateIndex
CREATE INDEX "raw_dart_api_calls_completed_at_idx" ON "raw_dart_api_calls"("completed_at");

-- CreateIndex
CREATE UNIQUE INDEX "raw_dart_api_calls_endpoint_params_canonical_payload_hash_key" ON "raw_dart_api_calls"("endpoint", "params_canonical", "payload_hash");

-- CreateIndex
CREATE UNIQUE INDEX "raw_dart_payload_json_api_call_id_key" ON "raw_dart_payload_json"("api_call_id");

-- CreateIndex
CREATE UNIQUE INDEX "raw_dart_payload_binary_api_call_id_key" ON "raw_dart_payload_binary"("api_call_id");

-- CreateIndex
CREATE INDEX "raw_dart_corp_master_stock_code_idx" ON "raw_dart_corp_master"("stock_code");

-- CreateIndex
CREATE INDEX "raw_dart_corp_master_corp_name_idx" ON "raw_dart_corp_master"("corp_name");

-- CreateIndex
CREATE INDEX "raw_dart_filings_corp_code_idx" ON "raw_dart_filings"("corp_code");

-- CreateIndex
CREATE INDEX "raw_dart_filings_stock_code_idx" ON "raw_dart_filings"("stock_code");

-- CreateIndex
CREATE INDEX "raw_dart_filings_rcept_dt_idx" ON "raw_dart_filings"("rcept_dt");

-- CreateIndex
CREATE INDEX "raw_dart_filings_is_final_idx" ON "raw_dart_filings"("is_final");

-- CreateIndex
CREATE INDEX "raw_dart_fnltt_all_rows_corp_code_bsns_year_reprt_code_fs_d_idx" ON "raw_dart_fnltt_all_rows"("corp_code", "bsns_year", "reprt_code", "fs_div", "sj_div");

-- CreateIndex
CREATE INDEX "raw_dart_fnltt_all_rows_account_nm_idx" ON "raw_dart_fnltt_all_rows"("account_nm");

-- CreateIndex
CREATE UNIQUE INDEX "raw_dart_fnltt_all_rows_corp_code_bsns_year_reprt_code_fs_d_key" ON "raw_dart_fnltt_all_rows"("corp_code", "bsns_year", "reprt_code", "fs_div", "sj_div", "account_id", "account_nm", "account_detail", "ord");

-- CreateIndex
CREATE UNIQUE INDEX "raw_dart_fnltt_key_rows_corp_code_bsns_year_reprt_code_sj_d_key" ON "raw_dart_fnltt_key_rows"("corp_code", "bsns_year", "reprt_code", "sj_div", "account_nm", "ord");

-- CreateIndex
CREATE INDEX "curated_fin_account_mapping_account_name_kr_idx" ON "curated_fin_account_mapping"("account_name_kr");

-- CreateIndex
CREATE INDEX "curated_fin_account_mapping_standard_line_id_idx" ON "curated_fin_account_mapping"("standard_line_id");

-- CreateIndex
CREATE INDEX "curated_fin_facts_corp_code_fiscal_year_fs_scope_statement__idx" ON "curated_fin_facts"("corp_code", "fiscal_year", "fs_scope", "statement_type");

-- CreateIndex
CREATE INDEX "curated_fin_facts_entity_id_fiscal_year_standard_line_id_idx" ON "curated_fin_facts"("entity_id", "fiscal_year", "standard_line_id");

-- CreateIndex
CREATE INDEX "curated_fin_facts_stock_code_idx" ON "curated_fin_facts"("stock_code");

-- CreateIndex
CREATE UNIQUE INDEX "curated_fin_restatement_tracker_corp_code_fiscal_year_repor_key" ON "curated_fin_restatement_tracker"("corp_code", "fiscal_year", "report_code", "fs_scope");

-- CreateIndex
CREATE INDEX "model_entities_corp_code_idx" ON "model_entities"("corp_code");

-- CreateIndex
CREATE INDEX "model_entities_stock_code_idx" ON "model_entities"("stock_code");

-- CreateIndex
CREATE INDEX "model_assumption_sets_entity_id_scenario_name_idx" ON "model_assumption_sets"("entity_id", "scenario_name");

-- CreateIndex
CREATE INDEX "model_snapshots_entity_id_idx" ON "model_snapshots"("entity_id");

-- CreateIndex
CREATE INDEX "model_snapshots_snapshot_hash_idx" ON "model_snapshots"("snapshot_hash");

-- CreateIndex
CREATE INDEX "model_output_lines_snapshot_id_statement_type_period_index_idx" ON "model_output_lines"("snapshot_id", "statement_type", "period_index");

-- CreateIndex
CREATE INDEX "model_support_schedule_outputs_snapshot_id_schedule_type_idx" ON "model_support_schedule_outputs"("snapshot_id", "schedule_type");

-- CreateIndex
CREATE UNIQUE INDEX "model_viewer_sheets_snapshot_id_sheet_name_key" ON "model_viewer_sheets"("snapshot_id", "sheet_name");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- AddForeignKey
ALTER TABLE "raw_dart_payload_json" ADD CONSTRAINT "raw_dart_payload_json_api_call_id_fkey" FOREIGN KEY ("api_call_id") REFERENCES "raw_dart_api_calls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "raw_dart_payload_binary" ADD CONSTRAINT "raw_dart_payload_binary_api_call_id_fkey" FOREIGN KEY ("api_call_id") REFERENCES "raw_dart_api_calls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "raw_dart_filings" ADD CONSTRAINT "raw_dart_filings_corp_code_fkey" FOREIGN KEY ("corp_code") REFERENCES "raw_dart_corp_master"("corp_code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "raw_dart_fnltt_all_rows" ADD CONSTRAINT "raw_dart_fnltt_all_rows_corp_code_fkey" FOREIGN KEY ("corp_code") REFERENCES "raw_dart_corp_master"("corp_code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "raw_dart_fnltt_all_rows" ADD CONSTRAINT "raw_dart_fnltt_all_rows_rcept_no_fkey" FOREIGN KEY ("rcept_no") REFERENCES "raw_dart_filings"("rcept_no") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "raw_dart_fnltt_key_rows" ADD CONSTRAINT "raw_dart_fnltt_key_rows_corp_code_fkey" FOREIGN KEY ("corp_code") REFERENCES "raw_dart_corp_master"("corp_code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "raw_dart_fnltt_key_rows" ADD CONSTRAINT "raw_dart_fnltt_key_rows_rcept_no_fkey" FOREIGN KEY ("rcept_no") REFERENCES "raw_dart_filings"("rcept_no") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curated_fin_standard_coa" ADD CONSTRAINT "curated_fin_standard_coa_rollup_parent_id_fkey" FOREIGN KEY ("rollup_parent_id") REFERENCES "curated_fin_standard_coa"("standard_line_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "curated_fin_account_mapping" ADD CONSTRAINT "curated_fin_account_mapping_standard_line_id_fkey" FOREIGN KEY ("standard_line_id") REFERENCES "curated_fin_standard_coa"("standard_line_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curated_fin_facts" ADD CONSTRAINT "curated_fin_facts_standard_line_id_fkey" FOREIGN KEY ("standard_line_id") REFERENCES "curated_fin_standard_coa"("standard_line_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curated_fin_facts" ADD CONSTRAINT "curated_fin_facts_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "model_entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "model_entities" ADD CONSTRAINT "model_entities_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "model_projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "model_assumption_sets" ADD CONSTRAINT "model_assumption_sets_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "model_entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "model_snapshots" ADD CONSTRAINT "model_snapshots_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "model_entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "model_snapshots" ADD CONSTRAINT "model_snapshots_assumption_set_id_fkey" FOREIGN KEY ("assumption_set_id") REFERENCES "model_assumption_sets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "model_output_lines" ADD CONSTRAINT "model_output_lines_snapshot_id_fkey" FOREIGN KEY ("snapshot_id") REFERENCES "model_snapshots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "model_support_schedule_outputs" ADD CONSTRAINT "model_support_schedule_outputs_snapshot_id_fkey" FOREIGN KEY ("snapshot_id") REFERENCES "model_snapshots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "model_viewer_sheets" ADD CONSTRAINT "model_viewer_sheets_snapshot_id_fkey" FOREIGN KEY ("snapshot_id") REFERENCES "model_snapshots"("id") ON DELETE CASCADE ON UPDATE CASCADE;
