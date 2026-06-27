"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import { nanoid } from "nanoid";
import {
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Copy,
  Check,
  AlertCircle,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { BYOK_PROVIDER_PRESETS, byokFormatSchema } from "@/lib/byok";
import type { ByokFormat } from "@/lib/byok";

interface ByokConnection {
  id: string;
  name: string;
  format: ByokFormat;
  baseURL: string;
  headers?: Record<string, string>;
  models: string[];
  hasApiKey: boolean;
}

interface ByokConnectionForm {
  id: string;
  name: string;
  format: ByokFormat;
  baseURL: string;
  apiKey: string;
  headers: string;
  models: string;
}

export function ByokSettings() {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<string>("");
  const [formData, setFormData] = useState<ByokConnectionForm>({
    id: nanoid(),
    name: "",
    format: "gateway",
    baseURL: "",
    apiKey: "",
    headers: "",
    models: "",
  });
  const [showApiKey, setShowApiKey] = useState(false);
  const [copied, setCopied] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeConnectionId, setActiveConnectionId] = useState<string | null>(null);

  const { data: connections, mutate: mutateConnections } = useSWR<ByokConnection[]>(
    "/api/byok",
    async (url: string) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      return data.connections || [];
    }
  );

  const { data: active } = useSWR("/api/byok/active", async (url: string) => {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    return data.activeConnectionId;
  });

  useEffect(() => {
    setActiveConnectionId(active);
  }, [active]);

  const handlePresetSelect = (presetId: string) => {
    const preset = BYOK_PROVIDER_PRESETS[presetId];
    if (preset) {
      setFormData({
        ...formData,
        name: preset.name,
        format: preset.format,
        baseURL: preset.baseURL,
      });
      setSelectedPreset(presetId);
    }
  };

  const handleAddConnection = async () => {
    try {
      const headers = formData.headers
        ? Object.fromEntries(formData.headers.split("\n").map(line => {
            const [key, value] = line.split(":");
            return [key.trim(), value.trim()];
          }))
        : {};

      const models = formData.models
        .split(",")
        .map(m => m.trim())
        .filter(m => m);

      const res = await fetch("/api/byok", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: formData.id,
          name: formData.name,
          format: formData.format,
          baseURL: formData.baseURL,
          apiKey: formData.apiKey,
          headers,
          models,
        }),
      });

      if (res.ok) {
        mutateConnections();
        setShowAddDialog(false);
        setFormData({
          id: nanoid(),
          name: "",
          format: "gateway",
          baseURL: "",
          apiKey: "",
          headers: "",
          models: "",
        });
        setSelectedPreset("");
      }
    } catch (error) {
      console.error("[v0] Error adding connection:", error);
    }
  };

  const handleDeleteConnection = async (id: string) => {
    try {
      const res = await fetch(`/api/byok?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        mutateConnections();
        if (activeConnectionId === id) {
          setActiveConnectionId(null);
        }
      }
    } catch (error) {
      console.error("[v0] Error deleting connection:", error);
    }
  };

  const handleSetActive = async (id: string | null) => {
    try {
      const res = await fetch("/api/byok/active", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId: id }),
      });
      if (res.ok) {
        setActiveConnectionId(id);
      }
    } catch (error) {
      console.error("[v0] Error setting active connection:", error);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Bring Your Own Keys (BYOK)</h3>
        <p className="text-sm text-gray-600 mb-4">
          Add your own API keys for Anthropic, Google Gemini, or other providers. Your keys are encrypted and never exposed to the client.
        </p>
      </div>

      <Card className="border-blue-200 bg-blue-50 p-4">
        <div className="flex gap-3">
          <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-900">
            <p className="font-medium mb-1">Security</p>
            <p>API keys are encrypted at rest with AES-256-GCM. Active connection routes all compatible models through your endpoint with your authentication.</p>
          </div>
        </div>
      </Card>

      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h4 className="font-medium">Your Connections</h4>
          <Button onClick={() => setShowAddDialog(true)} size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Add Connection
          </Button>
        </div>

        {connections && connections.length > 0 ? (
          <div className="space-y-3">
            {connections.map((conn) => (
              <Card key={conn.id} className={activeConnectionId === conn.id ? "border-green-200 bg-green-50" : ""}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h5 className="font-medium">{conn.name}</h5>
                        <span className="text-xs bg-gray-200 px-2 py-1 rounded">{conn.format}</span>
                        {activeConnectionId === conn.id && (
                          <span className="text-xs bg-green-200 text-green-800 px-2 py-1 rounded">Active</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{conn.baseURL}</p>
                      <p className="text-xs text-gray-500">
                        Models: {conn.models.join(", ") || "Add at least one model"}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {activeConnectionId !== conn.id && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleSetActive(conn.id)}
                        >
                          Use
                        </Button>
                      )}
                      {activeConnectionId === conn.id && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleSetActive(null)}
                        >
                          Deactivate
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDeleteConnection(conn.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="border-dashed">
            <CardContent className="p-8 text-center">
              <p className="text-sm text-gray-500">No connections yet. Add one to get started.</p>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add BYOK Connection</DialogTitle>
            <DialogDescription>
              Add your own API key and endpoint. All fields except API key are optional (will use defaults if available).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Provider Preset (Optional)</Label>
              <Select value={selectedPreset} onValueChange={handlePresetSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a preset to auto-fill..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None - Custom</SelectItem>
                  {Object.entries(BYOK_PROVIDER_PRESETS).map(([key, preset]) => (
                    <SelectItem key={key} value={key}>
                      {preset.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Connection Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="My Anthropic"
                />
              </div>
              <div>
                <Label htmlFor="format">Format</Label>
                <Select
                  value={formData.format}
                  onValueChange={(value) =>
                    setFormData({ ...formData, format: value as ByokFormat })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="anthropic">Anthropic</SelectItem>
                    <SelectItem value="gemini">Gemini</SelectItem>
                    <SelectItem value="openai-compatible">OpenAI Compatible</SelectItem>
                    <SelectItem value="gateway">Gateway</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="endpoint">Endpoint URL *Required</Label>
              <Input
                id="endpoint"
                value={formData.baseURL}
                onChange={(e) => setFormData({ ...formData, baseURL: e.target.value })}
                placeholder="https://api.anthropic.com/v1 (for Anthropic)"
              />
            </div>

            <div>
              <Label htmlFor="apikey">API Key *Required</Label>
              <div className="flex gap-2">
                <Input
                  id="apikey"
                  type={showApiKey ? "text" : "password"}
                  value={formData.apiKey}
                  onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                  placeholder="sk-ant-... or your API key"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowApiKey(!showApiKey)}
                >
                  {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Encrypted at rest. Never transmitted to your browser.
              </p>
            </div>

            <div>
              <Label htmlFor="models">Model IDs (comma-separated)</Label>
              <Input
                id="models"
                value={formData.models}
                onChange={(e) => setFormData({ ...formData, models: e.target.value })}
                placeholder="claude-3-opus, claude-3-sonnet"
              />
            </div>

            <div>
              <Label htmlFor="headers">Custom Headers (Optional, one per line)</Label>
              <Textarea
                id="headers"
                value={formData.headers}
                onChange={(e) => setFormData({ ...formData, headers: e.target.value })}
                placeholder="X-Custom-Header: value"
                rows={3}
              />
            </div>

            <div className="flex gap-2 justify-end pt-4">
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddConnection} disabled={!formData.apiKey || !formData.baseURL}>
                Add Connection
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
