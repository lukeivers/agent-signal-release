#!/usr/bin/env node
try {
  const { runHook } = await import('../codex/hook-output.mjs');
  await runHook('claude-code');
} catch {
  /* Missing runtime dependencies must not affect the original tool action. */
}
