<?php

return [
    'seed_admin_email' => env('LUCKYDRAW_ADMIN_EMAIL'),
    'seed_admin_password' => env('LUCKYDRAW_ADMIN_PASSWORD'),
    'seed_admin_name' => env('LUCKYDRAW_ADMIN_NAME', 'မောင်းဘုရင် Admin'),
    'seed_sample_user' => filter_var(env('LUCKYDRAW_SEED_SAMPLE_USER', false), FILTER_VALIDATE_BOOL),
];
