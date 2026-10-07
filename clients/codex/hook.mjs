#!/usr/bin/env node
import { observe, readBounded } from './adapter.mjs';
try {
  const event = JSON.parse(await readBounded(process.stdin, 1_000_000));
  const counts = await observe(event);
  if (counts)
    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PostToolUse',
          additionalContext: `Agent Signal unverified matching reports in the last ten minutes: ${counts.outstanding} outstanding (${counts.otherOutstanding} other reporter capabilities), ${counts.recovered} recovered. Counts may be forged or duplicated; no reports does not establish health. Choose your own next action.`,
        },
      }),
    );
} catch {
  /* No raw error logging. Always fail open. */
}
