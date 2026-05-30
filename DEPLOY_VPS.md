# Deploy na VPS

Este guia publica o sistema em `https://analytics.colaboraedu.cloud` usando:

- Cloudflare DNS
- VPS `185.187.170.35`
- Caddy como proxy HTTPS
- Next.js standalone rodando via systemd
- SQLite em caminho absoluto

> Observacao: a URL correta deve ser `analytics.colaboraedu.cloud`. `analytics.colaboraedu.coud` parece ter sido digitada sem o `l` em `.cloud`.

## 1. Cloudflare

No painel da Cloudflare, dentro da zona `colaboraedu.cloud`, crie:

```text
Type: A
Name: analytics
IPv4 address: 185.187.170.35
Proxy status: Proxied
TTL: Auto
```

Em SSL/TLS, use:

```text
SSL/TLS encryption mode: Full (strict)
Always Use HTTPS: On
```

Se houver registro `AAAA` para `analytics` sem IPv6 configurado na VPS, remova.

## 2. Pacotes da VPS

Na VPS:

```bash
sudo apt update
sudo apt install -y curl git python3 python3-pip caddy
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
python3 -m pip install --break-system-packages pdfplumber
```

Confirme:

```bash
node -v
npm -v
caddy version
```

## 3. Copiar projeto

Exemplo usando `/var/www/colaboraEDUanalytics`:

```bash
sudo mkdir -p /var/www/colaboraEDUanalytics
sudo chown -R "$USER":"$USER" /var/www/colaboraEDUanalytics
```

Copie os arquivos do projeto para essa pasta, entre nela e instale:

```bash
cd /var/www/colaboraEDUanalytics
npm ci
```

## 4. Variaveis de ambiente

Crie `/var/www/colaboraEDUanalytics/.env`:

```env
DATABASE_URL="file:/var/www/colaboraEDUanalytics/db/custom.db"
PROJECT_ROOT="/var/www/colaboraEDUanalytics"
PYTHON_BIN="/usr/bin/python3"
SESSION_SECRET="gere-com-openssl-rand-hex-32"
SEED_ADMIN_TOKEN="gere-com-openssl-rand-hex-32"
INITIAL_ADMIN_EMAIL="admin@colaboraedu.cloud"
INITIAL_ADMIN_PASSWORD="troque-por-uma-senha-forte"
```

Gere segredos reais:

```bash
openssl rand -hex 32
```

Prepare pastas e banco:

```bash
mkdir -p db uploads/pdfs
npm run db:generate
npm run db:push
```

## 5. Build

```bash
npm run build
```

## 6. systemd

Instale o servico:

```bash
sudo cp deploy/analytics-colaboraedu.service /etc/systemd/system/analytics-colaboraedu.service
sudo chown -R www-data:www-data /var/www/colaboraEDUanalytics
sudo systemctl daemon-reload
sudo systemctl enable --now analytics-colaboraedu
sudo systemctl status analytics-colaboraedu
```

Logs:

```bash
sudo journalctl -u analytics-colaboraedu -f
```

## 7. Caddy

Instale o Caddyfile do projeto:

```bash
sudo cp Caddyfile /etc/caddy/Caddyfile
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

Teste localmente na VPS:

```bash
curl -I http://127.0.0.1:3000
curl -I https://analytics.colaboraedu.cloud
```

## 8. Criar administrador inicial

Depois que o site estiver no ar:

```bash
curl -X POST https://analytics.colaboraedu.cloud/api/auth/seed \
  -H "x-seed-token: SEU_SEED_ADMIN_TOKEN"
```

Entre em:

```text
https://analytics.colaboraedu.cloud/login
```

## Comandos uteis

Reiniciar app:

```bash
sudo systemctl restart analytics-colaboraedu
```

Atualizar deploy apos copiar codigo novo:

```bash
cd /var/www/colaboraEDUanalytics
npm ci
npm run db:generate
npm run db:push
npm run build
sudo chown -R www-data:www-data /var/www/colaboraEDUanalytics
sudo systemctl restart analytics-colaboraedu
```
