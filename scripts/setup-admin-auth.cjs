'use strict';

/**
 * Setup local de credenciais administrativas (SIGNAL 360).
 *
 * Uso (fora do Claude Code, em um terminal normal):
 *   node scripts/setup-admin-auth.cjs
 *
 * O que faz:
 *   - Pergunta ADMIN_EMAIL (visível) e a senha do admin (oculta, sem eco).
 *   - Gera ADMIN_PASSWORD_HASH com node:crypto scryptSync (salt 16 bytes, hash 64 bytes),
 *     no formato "salt_hex:hash_hex".
 *   - Gera SESSION_SECRET com randomBytes(32).toString('hex').
 *   - Se ADMIN_EMAIL, ADMIN_PASSWORD_HASH ou SESSION_SECRET já existirem no .env,
 *     aborta sem sobrescrever e sem revelar valores.
 *   - Faz backup do .env atual (cópia de arquivo, sem imprimir conteúdo) antes de gravar.
 *   - Grava as três variáveis no final do .env do projeto.
 *
 * Este script NUNCA imprime senha, hash ou SESSION_SECRET no terminal.
 * Usa somente APIs nativas do Node.js (fs, path, readline, crypto). Sem dependências,
 * sem chamadas de rede.
 */

const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');
const crypto = require('node:crypto');

const ENV_PATH = path.join(process.cwd(), '.env');
const REQUIRED_KEYS = ['ADMIN_EMAIL', 'ADMIN_PASSWORD_HASH', 'SESSION_SECRET'];

function readEnvKeys(envPath) {
  if (!fs.existsSync(envPath)) return new Set();
  const content = fs.readFileSync(envPath, 'utf8');
  const keys = new Set();
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    keys.add(line.slice(0, eq).trim());
  }
  return keys;
}

function askVisible(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function askHidden(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    let masked = false;

    // Sobrescreve a escrita interna do readline para suprimir o eco da senha
    // no terminal (não existe API pública para "input oculto" no readline nativo).
    rl._writeToOutput = function _writeToOutput(stringToWrite) {
      if (!masked) process.stdout.write(stringToWrite);
    };

    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write('\n');
      resolve(answer);
    });

    masked = true;
  });
}

function backupEnvIfExists(envPath) {
  if (!fs.existsSync(envPath)) return null;
  const backupPath = `${envPath}.bak-setup-admin-auth-${Date.now()}`;
  fs.copyFileSync(envPath, backupPath);
  return backupPath;
}

function buildPasswordHash(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

function buildSessionSecret() {
  return crypto.randomBytes(32).toString('hex');
}

async function main() {
  console.log('Setup de credenciais administrativas (SIGNAL 360)');
  console.log('Os valores serão gravados diretamente no .env do projeto.');
  console.log('Nenhum segredo será exibido neste terminal.\n');

  const existingKeys = readEnvKeys(ENV_PATH);
  const alreadyPresent = REQUIRED_KEYS.filter((key) => existingKeys.has(key));

  if (alreadyPresent.length > 0) {
    console.error(
      `Abortando: a(s) variável(is) já existem no .env: ${alreadyPresent.join(', ')}.\n` +
        'Remova ou renomeie manualmente essas linhas antes de rodar este script novamente. ' +
        'Nenhum valor foi lido ou exibido.'
    );
    process.exitCode = 1;
    return;
  }

  const email = await askVisible('ADMIN_EMAIL: ');
  if (!email) {
    console.error('Abortando: ADMIN_EMAIL não pode ser vazio.');
    process.exitCode = 1;
    return;
  }

  const password = await askHidden('Senha do administrador (não será exibida): ');
  if (!password) {
    console.error('Abortando: a senha não pode ser vazia.');
    process.exitCode = 1;
    return;
  }

  const passwordHash = buildPasswordHash(password);
  const sessionSecret = buildSessionSecret();

  const backupPath = backupEnvIfExists(ENV_PATH);
  if (backupPath) {
    console.log(`Backup do .env criado em: ${path.basename(backupPath)}`);
  }

  const block = [
    '',
    '# Autenticação administrativa (SIGNAL 360) — gerado por scripts/setup-admin-auth.cjs',
    `ADMIN_EMAIL="${email}"`,
    `ADMIN_PASSWORD_HASH="${passwordHash}"`,
    `SESSION_SECRET="${sessionSecret}"`,
    '',
  ].join('\n');

  fs.appendFileSync(ENV_PATH, block, { encoding: 'utf8' });

  console.log('Concluído: ADMIN_EMAIL, ADMIN_PASSWORD_HASH e SESSION_SECRET foram gravados em .env.');
  console.log('Nenhum valor foi impresso neste terminal.');
}

main().catch(() => {
  console.error('Erro inesperado ao executar o script. Nenhum segredo foi exibido.');
  process.exitCode = 1;
});
