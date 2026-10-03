import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { GlassCard } from "@/components/dyad/glass-card";

export const MCP_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/dyad-mcp`;

function CopyLine({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2 rounded-lg border border-glass-line bg-background/60 px-3 py-2">
      <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap text-xs text-foreground">{value}</code>
      <button
        type="button"
        onClick={() => {
          navigator.clipboard?.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        className="shrink-0 text-[10px] uppercase tracking-[0.2em] text-agent hover:text-foreground"
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

export function McpInstructions() {
  return (
    <GlassCard tone="agent" className="flex flex-col gap-4 p-6">
      <h2 className="font-display text-lg font-light uppercase tracking-[0.25em] text-agent">Connect your agent (MCP)</h2>
      <p className="text-sm text-foreground">
        Dyad runs an MCP server. Any MCP-capable agent can read your shared vitals, read the thread, and post check-ins.
      </p>
      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-foreground">Server URL</p>
        <CopyLine value={MCP_URL} />
      </div>
      <ol className="flex list-decimal flex-col gap-3 pl-5 text-sm text-foreground">
        <li>
          <span className="font-medium">Claude.ai / Claude Desktop:</span> Settings → Connectors → Add custom connector, paste
          the URL above, then approve access on the Dyad sign-in screen.
        </li>
        <li>
          <span className="font-medium">Claude Code:</span>
          <div className="mt-2">
            <CopyLine value={`claude mcp add --transport http dyad ${MCP_URL}`} />
          </div>
        </li>
        <li>
          <span className="font-medium">Cursor or your own code:</span> create an API key under Connected agents below and send
          it as <code className="text-agent">Authorization: Bearer dyad_…</code>
          <div className="mt-2">
            <CopyLine
              value={`{"mcpServers":{"dyad":{"url":"${MCP_URL}","headers":{"Authorization":"Bearer YOUR_DYAD_KEY"}}}}`}
            />
          </div>
        </li>
      </ol>
      <p className="text-sm text-foreground">
        Tools: <code className="text-agent">get_vitals</code>, <code className="text-agent">get_thread</code>,{" "}
        <code className="text-agent">post_message</code>, <code className="text-agent">log_call</code>,{" "}
        <code className="text-agent">should_check_in</code>.
      </p>
    </GlassCard>
  );
}

export function McpConnectHint() {
  return (
    <p className="max-w-sm text-xs text-foreground">
      Want your own agent in this chat?{" "}
      <Link to="/agent" className="text-agent underline underline-offset-4 hover:text-foreground">
        Connect your agent via MCP
      </Link>
    </p>
  );
}
