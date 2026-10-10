import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createServer } from 'node:http';
import { classify, observe } from '../clients/codex/adapter.mjs';

const diagnostic =
  "fatal: unable to access 'https://github.com/synthetic-owner/synthetic-repo/': The requested URL returned error: 503";
const failure = {
  session_id: 'synthetic-session',
  hook_event_name: 'PostToolUseFailure',
  tool_name: 'Bash',
  tool_input: { command: 'git push' },
  error: `Exit code 128\n${diagnostic}`,
  is_interrupt: false,
};
const success = {
  ...failure,
  hook_event_name: 'PostToolUse',
  tool_response: {
    stdout: '',
    stderr: 'To https://github.com/synthetic-owner/synthetic-repo\n abc1234..def5678 main -> main',
    interrupted: false,
    isImage: false,
  },
};

test('Claude runtime events classify narrowly without changing the Codex event path', () => {
  assert.equal(classify(failure), null);
  assert.equal(classify(success), null);
  assert.equal(classify(failure, 'claude-code')?.state, 'failure');
  assert.equal(classify(success, 'claude-code')?.state, 'recovery');
  for (const event of [
    { ...failure, is_interrupt: true },
    { ...failure, error: diagnostic },
    { ...failure, error: `Exit code 0\n${diagnostic}` },
    { ...success, tool_response: { ...success.tool_response, interrupted: true } },
    { ...success, tool_response: { ...success.tool_response, stderr: 'Everything up-to-date' } },
    { ...success, tool_response: { ...success.tool_response, stderr: diagnostic } },
    { ...failure, tool_input: { command: 'cd project && git push' } },
    { ...failure, tool_input: { command: 'git push --dry-run' } },
    { ...failure, error: 'Exit code 128\nPermission denied' },
  ])
    assert.equal(classify(event, 'claude-code'), null);
});

test('Claude observer projects reports, recovers and isolates capabilities from Codex with the same session ID', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'signal-claude-'));
  const received: { url?: string; agent?: string; capability?: string; body: unknown }[] = [];
  const server = createServer(async (req, res) => {
    let text = '';
    for await (const chunk of req) text += chunk;
    received.push({
      url: req.url,
      agent: req.headers['user-agent'],
      capability: req.headers.authorization,
      body: JSON.parse(text),
    });
    res
      .writeHead(200, { 'Content-Type': 'application/json' })
      .end(JSON.stringify({ outstanding: 1, otherOutstanding: 0, recovered: 0 }));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const endpoint = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  try {
    const options = { directory, endpoint, allowLoopback: true, client: 'claude-code' };
    assert.equal((await observe(failure, options))?.outstanding, 1);
    await observe(success, options);
    await observe(
      {
        ...failure,
        hook_event_name: 'PostToolUse',
        tool_response: { exit_code: 128, output: diagnostic },
      },
      { ...options, client: 'codex' },
    );
    assert.deepEqual(
      received.map((r) => r.url),
      ['/api/v1/failure', '/api/v1/recovery', '/api/v1/failure'],
    );
    assert.deepEqual(
      received.map((r) => r.agent),
      ['AgentSignal-ClaudeCode/0.1', 'AgentSignal-ClaudeCode/0.1', 'AgentSignal-Codex/0.1'],
    );
    assert.equal(received[0].capability, received[1].capability);
    assert.notEqual(received[0].capability, received[2].capability);
    assert(!JSON.stringify(received.map((r) => r.body)).includes('synthetic-'));
    const files = (await readdir(directory)).filter((name) => name.endsWith('.json'));
    assert.equal(files.length, 2);
    for (const file of files)
      assert(!(await readFile(join(directory, file), 'utf8')).includes('synthetic-'));
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await rm(directory, { recursive: true });
  }
});
