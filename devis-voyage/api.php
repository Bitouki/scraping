<?php
/**
 * Toute l'API du logiciel, appelée en « api.php?p=… ».
 *
 * Un seul point d'entrée, sans réécriture d'URL : le logiciel fonctionne donc
 * aussi bien à la racine du domaine que dans un sous-dossier, sans réglage.
 */

require __DIR__ . '/lib/auth.php';
require __DIR__ . '/lib/store.php';

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

session_boot();

function respond(int $status, $body = null): void
{
    http_response_code($status);
    echo $body === null ? '' : json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function body(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === '' || $raw === false) {
        return [];
    }
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

$route  = $_GET['p'] ?? '';
$id     = $_GET['id'] ?? '';
$method = $_SERVER['REQUEST_METHOD'];

/* ---------------------------------------------------------- authentification */

if ($route === 'login' && $method === 'POST') {
    $input = body();
    if (!attempt_login((string) ($input['email'] ?? ''), (string) ($input['password'] ?? ''))) {
        respond(401, ['error' => 'Identifiants incorrects']);
    }
    respond(200, ['ok' => true]);
}

if ($route === 'logout' && $method === 'POST') {
    logout();
    respond(200, ['ok' => true]);
}

if ($route === 'session' && $method === 'GET') {
    respond(200, ['authenticated' => is_authenticated()]);
}

if (!is_authenticated()) {
    respond(401, ['error' => 'Non authentifié']);
}

/* ------------------------------------------------------------------ clients */

if ($route === 'clients') {
    if ($method === 'GET') {
        respond(200, list_clients());
    }
    if ($method === 'POST') {
        respond(201, create_client(body()));
    }
}

if ($route === 'client') {
    if ($method === 'GET') {
        $client = get_client($id);
        respond($client ? 200 : 404, $client ?: ['error' => 'Client introuvable']);
    }
    if ($method === 'PUT') {
        $client = update_client($id, body());
        respond($client ? 200 : 404, $client ?: ['error' => 'Client introuvable']);
    }
    if ($method === 'DELETE') {
        respond(delete_client($id) ? 204 : 404, null);
    }
}

/* ------------------------------------------------------------- prestataires */

if ($route === 'providers') {
    if ($method === 'GET') {
        respond(200, [
            'providers' => list_providers([
                'search' => $_GET['search'] ?? '',
                'type'   => $_GET['type'] ?? '',
                'city'   => $_GET['city'] ?? '',
            ]),
            'facets' => provider_facets(),
        ]);
    }
    if ($method === 'POST') {
        $input = body();
        if (trim((string) ($input['name'] ?? '')) === '' || trim((string) ($input['city'] ?? '')) === '') {
            respond(400, ['error' => 'Nom et ville obligatoires']);
        }
        respond(201, create_provider($input));
    }
}

if ($route === 'provider') {
    if ($method === 'PUT') {
        $provider = update_provider($id, body());
        respond($provider ? 200 : 404, $provider ?: ['error' => 'Prestataire introuvable']);
    }
    if ($method === 'DELETE') {
        respond(delete_provider($id) ? 204 : 404, null);
    }
}

/* -------------------------------------------------------------------- devis */

if ($route === 'quotes') {
    $clientId = $_GET['client'] ?? '';
    if ($method === 'GET') {
        respond(200, list_quotes($clientId));
    }
    if ($method === 'POST') {
        $quote = create_quote($clientId, body());
        respond($quote ? 201 : 404, $quote ?: ['error' => 'Client introuvable']);
    }
}

if ($route === 'quote') {
    if ($method === 'GET') {
        $quote = get_quote($id);
        if (!$quote) {
            respond(404, ['error' => 'Devis introuvable']);
        }
        $quote['client'] = get_client($quote['clientId']);
        $quote['totals'] = compute_totals($quote);
        respond(200, $quote);
    }
    if ($method === 'PUT') {
        $result = save_quote($id, body());
        if ($result === null) {
            respond(404, ['error' => 'Devis introuvable']);
        }
        if (isset($result['locked'])) {
            respond(409, ['error' => 'Cette version est archivée. Créez une nouvelle version pour la modifier.']);
        }
        $result['totals'] = compute_totals($result);
        respond(200, $result);
    }
    if ($method === 'DELETE') {
        respond(delete_quote($id) ? 204 : 404, null);
    }
}

if ($route === 'quote_version' && $method === 'POST') {
    $quote = branch_quote($id);
    respond($quote ? 201 : 404, $quote ?: ['error' => 'Devis introuvable']);
}

respond(404, ['error' => 'Route inconnue']);
