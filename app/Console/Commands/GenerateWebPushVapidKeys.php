<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Minishlink\WebPush\VAPID;
use Symfony\Component\Process\Process;

class GenerateWebPushVapidKeys extends Command
{
    protected $signature = 'webpush:vapid';

    protected $description = 'Generate a stable VAPID key pair for Web Push notifications';

    public function handle(): int
    {
        try {
            $keys = PHP_OS_FAMILY === 'Windows'
                ? $this->createWindowsKeys()
                : VAPID::createVapidKeys();
        } catch (\Throwable $e) {
            $this->error('Unable to generate VAPID keys: '.$e->getMessage());
            $this->line('Verify that PHP OpenSSL supports the P-256 elliptic curve.');

            return self::FAILURE;
        }

        $this->warn('Store these values in .env and never regenerate them after users subscribe.');
        $this->line('WEBPUSH_VAPID_PUBLIC_KEY='.$keys['publicKey']);
        $this->line('WEBPUSH_VAPID_PRIVATE_KEY='.$keys['privateKey']);

        return self::SUCCESS;
    }

    /** @return array{publicKey:string, privateKey:string} */
    private function createWindowsKeys(): array
    {
        $phpDirectory = dirname(PHP_BINARY);
        $configuration = collect([
            $phpDirectory.'/extras/openssl/openssl.cnf',
            $phpDirectory.'/extras/ssl/openssl.cnf',
            dirname(base_path(), 2).'/apache/conf/openssl.cnf',
        ])->first(fn (string $path): bool => is_file($path));

        if (! $configuration) {
            return VAPID::createVapidKeys();
        }

        // OpenSSL reads OPENSSL_CONF when PHP starts, so XAMPP needs a short
        // child process with the correct environment rather than putenv().
        $autoload = var_export(base_path('vendor/autoload.php'), true);
        $code = "require {$autoload}; echo json_encode(\\Minishlink\\WebPush\\VAPID::createVapidKeys(), JSON_THROW_ON_ERROR);";
        $process = new Process([PHP_BINARY, '-r', $code], base_path(), [
            'OPENSSL_CONF' => $configuration,
        ]);
        $process->mustRun();

        return json_decode($process->getOutput(), true, flags: JSON_THROW_ON_ERROR);
    }
}
