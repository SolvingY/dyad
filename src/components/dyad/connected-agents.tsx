import { useCallback, useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { GlassCard } from "@/components/dyad/glass-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Connect an outside agent to Dyad's MCP server. Apps that support OAuth
// (claude.ai, Claude Desktop, Claude Code) just need the server URL and sign in;
// anything else gets an API key, shown once. Both can be disconnected here.

const MCP_URL = `${import.meta.env["VITE_SUPABASE_URL"]}/functions/v1/dyad-mcp`;

type Grant = { client: { id: string; name: string }; granted_at: string };

type KeyRow = {
  id: string;
  key_prefix: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
  agents: { name: string } | null;
};

type NewKey = { name: string; key: string; mcp_url: string };

export function ConnectedAgents() {
  const [keys, setKeys] = useState<KeyRow[]>([]);
  const [grants, setGrants] = useState<Grant[]>([]);
  const [name, setName] = useState("");
  const [created, setCreated] = useState<NewKey | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("agent_keys")
      .select("id, key_prefix, created_at, last_used_at, revoked_at, agents(name)")
      .order("created_at", { ascending: false });
    setKeys((data as KeyRow[] | null) ?? []);
    const { data: granted } = await supabase.auth.oauth.listGrants();
    setGrants(granted ?? []);
  }, []);

  async function disconnect(clientId: string) {
    const { error } = await supabase.auth.oauth.revokeGrant({ clientId });
    if (error) setError(error.message);
    await load();
  }

  useEffect(() => {
    void load();
  }, [load]);

  async function create(e: FormEvent) {
    e.preventDefault();
    const agentName = name.trim();
    if (!agentName || busy) return;
    setBusy(true);
    setError(null);
    const { data, error } = await supabase.functions.invoke("agent-keys", {
      body: { action: "create", name: agentName },
    });
    setBusy(false);
    if (error || !data?.key) {
      setError(error?.message ?? "Couldn't create the key.");
      return;
    }
    setCreated({ name: agentName, key: data.key, mcp_url: data.mcp_url });
    setName("");
    await load();
  }

  async function revoke(id: string) {
    const { error } = await supabase.functions.invoke("agent-keys", {
      body: { action: "revoke", key_id: id },
    });
    if (error) setError(error.message);
    await load();
  }

  return (
    <GlassCard tone="agent" className="flex flex-col gap-4 p-6">
      <div>
        <p className="text-xs uppercase tracking-[0.25em] text-foreground/50">Connected agents</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Connect your own agent over MCP. It can read your vitals, check in with you in the Dyad
          thread, and report its own calls so Dyad can track its vitals too.
        </p>
      </div>

      <div className="flex flex-col gap-2 text-sm">
        <p className="text-foreground/90">
          <strong>Claude</strong> (claude.ai, Desktop, mobile): Settings → Connectors → Add custom
          connector, paste this URL, then click Connect and approve.
        </p>
        <Snippet label="Dyad MCP server URL" text={MCP_URL} />
        <Snippet label="Claude Code" text={`claude mcp add --transport http dyad ${MCP_URL}`} />
      </div>

      {grants.length > 0 && (
        <ul className="flex flex-col gap-2 text-sm">
          {grants.map((g) => (
            <li key={g.client.id} className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-foreground/90">{g.client.name || "Connected app"}</p>
                <p className="text-xs text-muted-foreground">
                  connected {new Date(g.granted_at).toLocaleString()}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => disconnect(g.client.id)}>
                Disconnect
              </Button>
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs uppercase tracking-[0.2em] text-foreground/50">
        Other agents (API key)
      </p>
      <form onSubmit={create} className="flex gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Agent name, e.g. My script"
          maxLength={80}
        />
        <Button type="submit" disabled={busy || !name.trim()}>
          {busy ? "Creating…" : "Connect"}
        </Button>
      </form>
      {error && <p className="text-sm text-destructive">{error}</p>}

      {created && (
        <div className="flex flex-col gap-3 rounded-xl bg-foreground/5 p-4 text-sm">
          <p className="text-foreground/90">
            Key for <strong>{created.name}</strong>. Copy it now: it won't be shown again.
          </p>
          <Snippet label="API key" text={created.key} />
          <Snippet label="MCP server URL" text={created.mcp_url} />
          <Snippet
            label="Claude Code"
            text={`claude mcp add --transport http dyad ${created.mcp_url} --header "Authorization: Bearer ${created.key}"`}
          />
          <Snippet
            label="Cursor and other MCP clients (JSON config)"
            text={JSON.stringify(
              {
                mcpServers: {
                  dyad: {
                    url: created.mcp_url,
                    headers: { Authorization: `Bearer ${created.key}` },
                  },
                },
              },
              null,
              2,
            )}
          />
          <Button
            variant="outline"
            size="sm"
            className="self-start"
            onClick={() => setCreated(null)}
          >
            Done
          </Button>
        </div>
      )}

      {keys.length > 0 && (
        <ul className="flex flex-col gap-2 text-sm">
          {keys.map((k) => (
            <li key={k.id} className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-foreground/90">{k.agents?.name ?? "Agent"}</p>
                <p className="text-xs text-muted-foreground">
                  {k.key_prefix}… ·{" "}
                  {k.revoked_at
                    ? "revoked"
                    : k.last_used_at
                      ? `last used ${new Date(k.last_used_at).toLocaleString()}`
                      : "never used"}
                </p>
              </div>
              {!k.revoked_at && (
                <Button variant="ghost" size="sm" onClick={() => revoke(k.id)}>
                  Revoke
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </GlassCard>
  );
}

function Snippet({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <p className="mb-1 text-xs text-muted-foreground">{label}</p>
      <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded-lg bg-background/60 p-2 text-xs">
        {text}
      </pre>
    </div>
  );
}
