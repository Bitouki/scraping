<?php
/**
 * Stockage des données : un fichier JSON, écrit de façon atomique et protégé
 * par un verrou pour que deux onglets ouverts ne s'écrasent pas.
 */

const DATA_DIR  = __DIR__ . '/../data';
const DATA_FILE = DATA_DIR . '/db.json';
const LOCK_FILE = DATA_DIR . '/.lock';

const EMPTY_DB = ['clients' => [], 'providers' => [], 'quotes' => []];

const DEFAULT_HEADER = [
    'firstName'    => '',
    'lastName'     => '',
    'startDate'    => '',
    'endDate'      => '',
    'exchangeRate' => 0.92,
    'marginPct'    => 10,
    'title'        => '',
    'travelers'    => 1,
];

function store_dir(): void
{
    if (!is_dir(DATA_DIR)) {
        mkdir(DATA_DIR, 0775, true);
    }
}

function store_read(): array
{
    store_dir();
    if (!is_file(DATA_FILE)) {
        return EMPTY_DB;
    }
    $raw = file_get_contents(DATA_FILE);
    $db = json_decode($raw, true);
    return is_array($db) ? $db + EMPTY_DB : EMPTY_DB;
}

/** Écrit dans un fichier temporaire puis renomme : une coupure ne tronque jamais la base. */
function store_write(array $db): void
{
    store_dir();
    $tmp = DATA_FILE . '.' . getmypid() . '.tmp';
    file_put_contents($tmp, json_encode($db, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
    rename($tmp, DATA_FILE);
}

/** Lit, modifie et réécrit la base sous verrou exclusif. */
function store_mutate(callable $fn)
{
    store_dir();
    $lock = fopen(LOCK_FILE, 'c');
    flock($lock, LOCK_EX);
    try {
        $db = store_read();
        $result = $fn($db);
        store_write($db);
        return $result;
    } finally {
        flock($lock, LOCK_UN);
        fclose($lock);
    }
}

function new_id(): string
{
    $b = random_bytes(16);
    $b[6] = chr((ord($b[6]) & 0x0f) | 0x40);
    $b[8] = chr((ord($b[8]) & 0x3f) | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($b), 4));
}

function now_iso(): string
{
    return gmdate('Y-m-d\TH:i:s\Z');
}

/** Clé de comparaison insensible à la casse et aux accents : « hotel » trouve « Hôtel ». */
function fr_key(string $s): string
{
    $accents = [
        'à'=>'a','á'=>'a','â'=>'a','ä'=>'a','ã'=>'a','å'=>'a','À'=>'a','Á'=>'a','Â'=>'a','Ä'=>'a','Ã'=>'a','Å'=>'a',
        'ç'=>'c','Ç'=>'c',
        'è'=>'e','é'=>'e','ê'=>'e','ë'=>'e','È'=>'e','É'=>'e','Ê'=>'e','Ë'=>'e',
        'ì'=>'i','í'=>'i','î'=>'i','ï'=>'i','Ì'=>'i','Í'=>'i','Î'=>'i','Ï'=>'i',
        'ñ'=>'n','Ñ'=>'n',
        'ò'=>'o','ó'=>'o','ô'=>'o','ö'=>'o','õ'=>'o','Ò'=>'o','Ó'=>'o','Ô'=>'o','Ö'=>'o','Õ'=>'o',
        'ù'=>'u','ú'=>'u','û'=>'u','ü'=>'u','Ù'=>'u','Ú'=>'u','Û'=>'u','Ü'=>'u',
        'ý'=>'y','ÿ'=>'y','Ý'=>'y',
        'œ'=>'oe','Œ'=>'oe','æ'=>'ae','Æ'=>'ae',
    ];
    return strtolower(strtr($s, $accents));
}

function str_field($value): string
{
    return trim((string) $value);
}

/* ----------------------------------------------------------------- clients */

function list_clients(): array
{
    $db = store_read();
    $clients = [];
    foreach ($db['clients'] as $client) {
        $client['quoteCount'] = count(array_filter(
            $db['quotes'],
            fn($q) => $q['clientId'] === $client['id']
        ));
        $clients[] = $client;
    }
    usort($clients, fn($a, $b) => strcmp(fr_key($a['lastName']), fr_key($b['lastName'])));
    return $clients;
}

function get_client(string $id): ?array
{
    foreach (store_read()['clients'] as $client) {
        if ($client['id'] === $id) {
            return $client;
        }
    }
    return null;
}

function create_client(array $input): array
{
    return store_mutate(function (array &$db) use ($input) {
        $client = [
            'id'        => new_id(),
            'firstName' => str_field($input['firstName'] ?? ''),
            'lastName'  => str_field($input['lastName'] ?? ''),
            'email'     => str_field($input['email'] ?? ''),
            'phone'     => str_field($input['phone'] ?? ''),
            'notes'     => str_field($input['notes'] ?? ''),
            'createdAt' => now_iso(),
        ];
        $db['clients'][] = $client;
        return $client;
    });
}

function update_client(string $id, array $input): ?array
{
    return store_mutate(function (array &$db) use ($id, $input) {
        foreach ($db['clients'] as &$client) {
            if ($client['id'] !== $id) {
                continue;
            }
            foreach (['firstName', 'lastName', 'email', 'phone', 'notes'] as $key) {
                if (array_key_exists($key, $input)) {
                    $client[$key] = str_field($input[$key]);
                }
            }
            return $client;
        }
        return null;
    });
}

function delete_client(string $id): bool
{
    return store_mutate(function (array &$db) use ($id) {
        $before = count($db['clients']);
        $db['clients'] = array_values(array_filter($db['clients'], fn($c) => $c['id'] !== $id));
        $db['quotes']  = array_values(array_filter($db['quotes'], fn($q) => $q['clientId'] !== $id));
        return count($db['clients']) < $before;
    });
}

/* ------------------------------------------------------------ prestataires */

function list_providers(array $filters = []): array
{
    $needle = fr_key(trim($filters['search'] ?? ''));
    $type   = $filters['type'] ?? '';
    $city   = $filters['city'] ?? '';

    $providers = array_filter(store_read()['providers'], function ($p) use ($needle, $type, $city) {
        if ($type !== '' && $p['type'] !== $type) {
            return false;
        }
        if ($city !== '' && $p['city'] !== $city) {
            return false;
        }
        if ($needle === '') {
            return true;
        }
        return str_contains(fr_key("{$p['name']} {$p['type']} {$p['city']}"), $needle);
    });

    $providers = array_values($providers);
    usort($providers, function ($a, $b) {
        return strcmp(fr_key($a['city']), fr_key($b['city']))
            ?: strcmp(fr_key($a['name']), fr_key($b['name']));
    });
    return $providers;
}

function provider_facets(): array
{
    $providers = store_read()['providers'];
    $uniq = function (string $key) use ($providers) {
        $values = array_values(array_unique(array_filter(array_column($providers, $key), fn($v) => $v !== '')));
        usort($values, fn($a, $b) => strcmp(fr_key($a), fr_key($b)));
        return $values;
    };
    return ['types' => $uniq('type'), 'cities' => $uniq('city')];
}

/**
 * Calcule le prix canonique en dollars à partir de la saisie. En soles, le
 * dollar reste la référence pour tous les calculs de devis : la conversion
 * se fait une fois pour toutes à l'enregistrement, mais le montant en soles
 * et le taux utilisé sont conservés pour qu'on les retrouve à la modification.
 */
function resolve_provider_price(array $input, array $fallback = []): array
{
    $currency = ($input['currency'] ?? $fallback['currency'] ?? 'USD') === 'PEN' ? 'PEN' : 'USD';

    if ($currency === 'PEN') {
        $priceSoles = (float) ($input['priceSoles'] ?? $fallback['priceSoles'] ?? 0);
        $penRate    = (float) ($input['penRate'] ?? $fallback['penRate'] ?? 0);
        $priceUsd   = $penRate > 0 ? $priceSoles / $penRate : 0.0;
        return compact('currency', 'priceSoles', 'penRate', 'priceUsd');
    }

    return [
        'currency'   => 'USD',
        'priceSoles' => 0.0,
        'penRate'    => 0.0,
        'priceUsd'   => (float) ($input['priceUsd'] ?? $fallback['priceUsd'] ?? 0),
    ];
}

function create_provider(array $input): array
{
    return store_mutate(function (array &$db) use ($input) {
        $provider = array_merge(
            [
                'id'        => new_id(),
                'type'      => str_field($input['type'] ?? ''),
                'name'      => str_field($input['name'] ?? ''),
                'city'      => str_field($input['city'] ?? ''),
                'notes'     => str_field($input['notes'] ?? ''),
                'createdAt' => now_iso(),
            ],
            resolve_provider_price($input)
        );
        $db['providers'][] = $provider;
        return $provider;
    });
}

function update_provider(string $id, array $input): ?array
{
    return store_mutate(function (array &$db) use ($id, $input) {
        foreach ($db['providers'] as &$provider) {
            if ($provider['id'] !== $id) {
                continue;
            }
            foreach (['type', 'name', 'city', 'notes'] as $key) {
                if (array_key_exists($key, $input)) {
                    $provider[$key] = str_field($input[$key]);
                }
            }
            if (array_key_exists('currency', $input) || array_key_exists('priceUsd', $input) || array_key_exists('priceSoles', $input)) {
                $provider = array_merge($provider, resolve_provider_price($input, $provider));
            }
            return $provider;
        }
        return null;
    });
}

function delete_provider(string $id): bool
{
    return store_mutate(function (array &$db) use ($id) {
        $before = count($db['providers']);
        $db['providers'] = array_values(array_filter($db['providers'], fn($p) => $p['id'] !== $id));
        return count($db['providers']) < $before;
    });
}

/* -------------------------------------------------------------------- devis */

function normalize_day(array $day, int $index): array
{
    $activities = [];
    foreach ($day['activities'] ?? [] as $activity) {
        if (trim((string) $activity) !== '') {
            $activities[] = (string) $activity;
        }
    }

    $items = [];
    foreach ($day['items'] ?? [] as $item) {
        $quantity = (float) ($item['quantity'] ?? 1);
        $items[] = [
            'id'         => $item['id'] ?? new_id(),
            'providerId' => $item['providerId'] ?? null,
            'type'       => (string) ($item['type'] ?? ''),
            'name'       => (string) ($item['name'] ?? ''),
            'city'       => (string) ($item['city'] ?? ''),
            'priceUsd'   => (float) ($item['priceUsd'] ?? 0),
            'quantity'   => $quantity > 0 ? $quantity : 1,
        ];
    }

    return [
        'id'          => $day['id'] ?? new_id(),
        'dayNumber'   => $index + 1,
        'date'        => (string) ($day['date'] ?? ''),
        'city'        => (string) ($day['city'] ?? ''),
        'title'       => (string) ($day['title'] ?? ''),
        'description' => (string) ($day['description'] ?? ''),
        'hotel'       => (string) ($day['hotel'] ?? ''),
        'activities'  => $activities,
        'items'       => $items,
    ];
}

function normalize_header(array $header): array
{
    $merged = array_merge(DEFAULT_HEADER, $header);
    $merged['exchangeRate'] = (float) $merged['exchangeRate'];
    $merged['marginPct']    = (float) $merged['marginPct'];
    $merged['travelers']    = max(1, (int) $merged['travelers']);
    foreach (['firstName', 'lastName', 'startDate', 'endDate', 'title'] as $key) {
        $merged[$key] = (string) $merged[$key];
    }
    return array_intersect_key($merged, DEFAULT_HEADER);
}

function compute_totals(array $quote): array
{
    $rate   = (float) ($quote['header']['exchangeRate'] ?? 0);
    $margin = (float) ($quote['header']['marginPct'] ?? 0);

    $totalUsd = 0.0;
    foreach ($quote['days'] ?? [] as $day) {
        foreach ($day['items'] as $item) {
            $quantity = (float) ($item['quantity'] ?? 1);
            $totalUsd += (float) $item['priceUsd'] * ($quantity > 0 ? $quantity : 1);
        }
    }

    $grossEur  = $totalUsd * $rate;
    $marginEur = $grossEur * ($margin / 100);
    $finalEur  = $grossEur + $marginEur;
    $travelers = max(1, (int) ($quote['header']['travelers'] ?? 1));

    return [
        'totalUsd'       => $totalUsd,
        'grossEur'       => $grossEur,
        'marginPct'      => $margin,
        'marginEur'      => $marginEur,
        'finalEur'       => $finalEur,
        'travelers'      => $travelers,
        'finalPerPerson' => $finalEur / $travelers,
    ];
}

function list_quotes(string $clientId): array
{
    $quotes = array_filter(store_read()['quotes'], fn($q) => $q['clientId'] === $clientId);

    $groups = [];
    foreach ($quotes as $quote) {
        $groups[$quote['groupId']][] = $quote;
    }

    $result = [];
    foreach ($groups as $groupId => $versions) {
        usort($versions, fn($a, $b) => $b['version'] <=> $a['version']);
        $latest = $versions[0]['version'];

        $result[] = [
            'groupId'       => $groupId,
            'latestVersion' => $latest,
            'versions'      => array_map(fn($q) => [
                'id'        => $q['id'],
                'version'   => $q['version'],
                'title'     => $q['header']['title'],
                'startDate' => $q['header']['startDate'],
                'endDate'   => $q['header']['endDate'],
                'createdAt' => $q['createdAt'],
                'total'     => compute_totals($q)['finalEur'],
                'editable'  => $q['version'] === $latest,
            ], $versions),
        ];
    }

    usort($result, fn($a, $b) => strcmp($b['versions'][0]['createdAt'], $a['versions'][0]['createdAt']));
    return $result;
}

function get_quote(string $id): ?array
{
    $db = store_read();

    $quote = null;
    foreach ($db['quotes'] as $candidate) {
        if ($candidate['id'] === $id) {
            $quote = $candidate;
            break;
        }
    }
    if ($quote === null) {
        return null;
    }

    $siblings = array_values(array_filter($db['quotes'], fn($q) => $q['groupId'] === $quote['groupId']));
    $latest = max(array_column($siblings, 'version'));

    usort($siblings, fn($a, $b) => $b['version'] <=> $a['version']);
    $quote['editable'] = $quote['version'] === $latest;
    $quote['versions'] = array_map(
        fn($q) => ['id' => $q['id'], 'version' => $q['version'], 'createdAt' => $q['createdAt']],
        $siblings
    );

    return $quote;
}

function create_quote(string $clientId, array $payload): ?array
{
    $client = get_client($clientId);
    if ($client === null) {
        return null;
    }

    $id = store_mutate(function (array &$db) use ($clientId, $client, $payload) {
        $header = normalize_header(array_merge(
            ['firstName' => $client['firstName'], 'lastName' => $client['lastName']],
            $payload['header'] ?? []
        ));

        $days = [];
        foreach ($payload['days'] ?? [] as $index => $day) {
            $days[] = normalize_day($day, $index);
        }

        $quote = [
            'id'        => new_id(),
            'clientId'  => $clientId,
            'groupId'   => new_id(),
            'version'   => 1,
            'createdAt' => now_iso(),
            'header'    => $header,
            'days'      => $days,
        ];
        $db['quotes'][] = $quote;
        return $quote['id'];
    });

    return get_quote($id);
}

/** Renvoie null si le devis n'existe pas, ['locked' => true] si la version est archivée. */
function save_quote(string $id, array $payload)
{
    $outcome = store_mutate(function (array &$db) use ($id, $payload) {
        $index = null;
        foreach ($db['quotes'] as $i => $quote) {
            if ($quote['id'] === $id) {
                $index = $i;
                break;
            }
        }
        if ($index === null) {
            return 'missing';
        }

        $groupId = $db['quotes'][$index]['groupId'];
        $latest = max(array_map(
            fn($q) => $q['version'],
            array_filter($db['quotes'], fn($q) => $q['groupId'] === $groupId)
        ));
        if ($db['quotes'][$index]['version'] !== $latest) {
            return 'locked';
        }

        $days = [];
        foreach ($payload['days'] ?? [] as $i => $day) {
            $days[] = normalize_day($day, $i);
        }

        $db['quotes'][$index]['header']    = normalize_header(array_merge(
            $db['quotes'][$index]['header'],
            $payload['header'] ?? []
        ));
        $db['quotes'][$index]['days']      = $days;
        $db['quotes'][$index]['updatedAt'] = now_iso();
        return 'saved';
    });

    if ($outcome === 'missing') {
        return null;
    }
    if ($outcome === 'locked') {
        return ['locked' => true];
    }
    return get_quote($id);
}

/** Une nouvelle version est une copie complète : les précédentes restent figées. */
function branch_quote(string $id): ?array
{
    $newId = store_mutate(function (array &$db) use ($id) {
        $source = null;
        foreach ($db['quotes'] as $quote) {
            if ($quote['id'] === $id) {
                $source = $quote;
                break;
            }
        }
        if ($source === null) {
            return null;
        }

        $latest = max(array_map(
            fn($q) => $q['version'],
            array_filter($db['quotes'], fn($q) => $q['groupId'] === $source['groupId'])
        ));

        $copy = $source;
        $copy['id']        = new_id();
        $copy['version']   = $latest + 1;
        $copy['createdAt'] = now_iso();
        unset($copy['updatedAt']);

        foreach ($copy['days'] as &$day) {
            $day['id'] = new_id();
            foreach ($day['items'] as &$item) {
                $item['id'] = new_id();
            }
            unset($item);
        }
        unset($day);

        $db['quotes'][] = $copy;
        return $copy['id'];
    });

    return $newId === null ? null : get_quote($newId);
}

function delete_quote(string $id): bool
{
    return store_mutate(function (array &$db) use ($id) {
        $before = count($db['quotes']);
        $db['quotes'] = array_values(array_filter($db['quotes'], fn($q) => $q['id'] !== $id));
        return count($db['quotes']) < $before;
    });
}
