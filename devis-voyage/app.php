<?php
require __DIR__ . '/lib/auth.php';
require_page_auth();
$agency = app_config()['agency'];
?>
<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title><?= htmlspecialchars($agency, ENT_QUOTES) ?> — Cotisation</title>
  <link rel="stylesheet" href="css/app.css">
</head>
<body>
  <header class="topbar">
    <div class="brand"><?= htmlspecialchars($agency, ENT_QUOTES) ?> <span>Cotisation</span></div>
    <button class="btn btn-sm" type="button" id="logout">Déconnexion</button>
  </header>

  <main id="view"></main>

  <script type="module" src="js/app.js"></script>
</body>
</html>
