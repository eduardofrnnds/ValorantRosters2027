import postgres from "postgres";
import { pathToFileURL } from "node:url";
import { buildSeedSql } from "./lib/seed-vct-2027.mjs";

export function databaseOptions(value) {
  if (!value?.trim()) throw new Error("Defina DATABASE_URL em .env.local para executar o seed real.");
  let url;
  try { url = new URL(value); } catch { throw new Error("DATABASE_URL inválida."); }
  if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.hostname || !url.username || url.pathname.length < 2) {
    throw new Error("DATABASE_URL inválida.");
  }
  // Do not allow URL parameters to override TLS verification or driver options.
  if ([...url.searchParams.keys()].some((key) => key !== "sslmode")
    || (url.searchParams.has("sslmode") && url.searchParams.get("sslmode") !== "verify-full")) {
    throw new Error("Use DATABASE_URL sem parâmetros ou somente sslmode=verify-full.");
  }
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  url.search = "";
  return {
    url: url.toString(),
    options: { ssl: local ? false : { rejectUnauthorized: true }, max: 1, prepare: false, connect_timeout: 10, idle_timeout: 5 },
  };
}

async function main() {
  let sql;
  let configurationValidated = false;
  try {
    const { url, options } = databaseOptions(process.env.DATABASE_URL);
    configurationValidated = true;
    const body = buildSeedSql();
    sql = postgres(url, { ...options, onnotice: () => {} });
    await sql.begin(async (transaction) => { await transaction.unsafe(body); });
    console.log("Seed 2027 confirmado no banco: registros ausentes inseridos; registros existentes preservados.");
  } catch (error) {
    // Driver errors can contain the URL/password or database data. Never print them.
    if (!configurationValidated) console.error(error.message);
    else console.error("Seed não concluído; transação revertida quando possível. Verifique conexão, migrations, permissões e conflitos de identidade. Se houve perda de conexão no commit, execute novamente: o seed é idempotente.");
    process.exitCode = 1;
  } finally {
    try { await sql?.end({ timeout: 5 }); }
    catch { console.error("Não foi possível confirmar o encerramento da conexão do seed."); process.exitCode = 1; }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
