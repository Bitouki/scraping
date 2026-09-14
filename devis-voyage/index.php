<?php
require __DIR__ . '/lib/auth.php';
session_boot();
if (is_authenticated()) {
    header('Location: app.php');
    exit;
}
$agency = app_config()['agency'];
?>
<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Connexion — <?= htmlspecialchars($agency, ENT_QUOTES) ?></title>
  <link rel="stylesheet" href="css/app.css">
</head>
<body>
  <div class="login-wrap">
    <form class="login-card" id="login-form">
      <h1><?= htmlspecialchars($agency, ENT_QUOTES) ?></h1>
      <p class="subtitle">Logiciel de cotisation des voyages</p>

      <div class="field">
        <label for="email">Adresse e-mail</label>
        <input type="email" id="email" name="email" autocomplete="username" required autofocus>
      </div>

      <div class="field">
        <label for="password">Mot de passe</label>
        <input type="password" id="password" name="password" autocomplete="current-password" required>
      </div>

      <button type="submit" class="btn btn-primary" id="submit">Se connecter</button>
      <div class="error-msg hidden" id="error"></div>
    </form>
  </div>

  <script>
    const form = document.getElementById('login-form');
    const errorBox = document.getElementById('error');
    const submit = document.getElementById('submit');

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      errorBox.classList.add('hidden');
      submit.disabled = true;
      submit.textContent = 'Connexion…';

      try {
        const res = await fetch('api.php?p=login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: form.email.value, password: form.password.value }),
        });

        if (res.ok) {
          location.replace('app.php');
          return;
        }

        const data = await res.json().catch(() => ({}));
        errorBox.textContent = data.error || 'Connexion impossible';
      } catch (err) {
        errorBox.textContent = 'Le serveur ne répond pas. Réessayez dans un instant.';
      }

      errorBox.classList.remove('hidden');
      submit.disabled = false;
      submit.textContent = 'Se connecter';
    });
  </script>
</body>
</html>
