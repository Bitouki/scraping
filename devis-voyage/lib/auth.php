<?php
/** Connexion et session. */

function app_config(): array
{
    static $config = null;
    if ($config === null) {
        $config = require __DIR__ . '/../config.php';
    }
    return $config;
}

function session_boot(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }
    session_set_cookie_params([
        'httponly' => true,
        'samesite' => 'Strict',
        'secure'   => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
        'path'     => dirname($_SERVER['SCRIPT_NAME'] ?? '/') ?: '/',
    ]);
    session_name('gdv_session');
    session_start();
}

function attempt_login(string $email, string $password): bool
{
    $config = app_config();
    $emailOk    = hash_equals(strtolower($config['email']), strtolower(trim($email)));
    $passwordOk = hash_equals($config['password'], $password);

    if (!$emailOk || !$passwordOk) {
        return false;
    }

    session_regenerate_id(true);
    $_SESSION['authenticated'] = true;
    return true;
}

function logout(): void
{
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000, $params['path'], $params['domain'], $params['secure'], $params['httponly']);
    }
    session_destroy();
}

function is_authenticated(): bool
{
    return !empty($_SESSION['authenticated']);
}

/** Protège une page : renvoie vers la connexion si la session n'est pas ouverte. */
function require_page_auth(): void
{
    session_boot();
    if (!is_authenticated()) {
        header('Location: index.php');
        exit;
    }
}
