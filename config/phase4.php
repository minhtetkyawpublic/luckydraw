<?php

return [
    'health_recent_spin_window_minutes' => (int) env('PHASE4_HEALTH_RECENT_SPIN_WINDOW_MINUTES', 15),
    'health_suspicious_minute_threshold' => (int) env('PHASE4_HEALTH_SUSPICIOUS_MINUTE_THRESHOLD', 12),
    'health_require_job_table' => filter_var(env('PHASE4_HEALTH_REQUIRE_JOB_TABLE', 'true'), FILTER_VALIDATE_BOOLEAN),
    'backup_retention_days' => (int) env('PHASE4_BACKUP_RETENTION_DAYS', 30),
];
