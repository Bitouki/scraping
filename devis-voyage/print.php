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
  <title>Document — <?= htmlspecialchars($agency, ENT_QUOTES) ?></title>
  <link rel="stylesheet" href="css/print.css">
</head>
<body>
  <div class="toolbar">
    <button type="button" class="primary" id="print">Imprimer / Enregistrer en PDF</button>
    <a id="switch" href="#">Changer de document</a>
  </div>

  <article class="sheet" id="sheet"></article>

  <script>
    window.AGENCY_NAME = <?= json_encode($agency, JSON_UNESCAPED_UNICODE) ?>;
  </script>
  <script type="module" src="js/print.js"></script>
</body>
</html>
