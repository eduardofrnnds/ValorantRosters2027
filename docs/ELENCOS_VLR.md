# Elencos atuais do VLR.gg

Importação solicitada em 07/11/2026 para a versão pública, sem Supabase.
O snapshot `src/features/rosters/data/vlr-rosters.json` registra a consulta das
32 páginas de equipes enumeradas em `docs/VLR_ASSETS.json`.

- 186 jogadores e integrantes da comissão técnica, com IDs estáveis `vlr-<id>`.
- 157 fotos disponíveis, baixadas para `public/images/players/`; URLs e hashes
  em `docs/VLR_PLAYER_ASSETS.json`. Fotos ausentes continuam com ícone substituto.
- Jogadores ativos, reservas (`Sub`), inativos e técnicos mantêm suas categorias.
  `players` no VLR não garante uma escalação titular de cinco pessoas; a interface
  apresenta essa categoria como **Jogadores**.
- Managers, analistas e outras funções fora de jogadores/técnicos não são
  classificados como jogadores; a lista excluída fica no manifesto de imagens.
- GAM Esports não possui roster na página consultada. Crazy Raccoon lista somente
  um manager, portanto ambas permanecem sem jogadores ou técnicos nesta consulta.
- Não foram inferidas datas de contratação, funções de agentes, transferências
  ou carreira. O perfil mostra a equipe como uma observação datada da fonte.
- O diretório contém as parceiras de 2027, mas o snapshot descreve o elenco atual
  da consulta, não a confirmação de escalações finais para 2027. Isso fica explícito
  nas páginas públicas. Não há atualização automática ou consulta ao VLR em runtime.

## Atualização manual

```powershell
node scripts/download-vlr-logos.mjs
node scripts/import-vlr-rosters.mjs
npm test
npm run build
npm run test:e2e
```

Revise os dados antes de publicar. O importador salva as páginas consultadas em
`artifacts/vlr-rosters/` (ignoradas pelo Git); `--cached` reutiliza essas páginas
para corrigir o parser durante a mesma coleta. Em uma atualização real, execute
sem essa opção para obter novas páginas. Os scripts não escrevem no Supabase.

Se Supabase for configurado, as consultas públicas continuam usando somente os
registros publicados do banco. O snapshot local não substitui erros ou dados
vazios do serviço remoto.
