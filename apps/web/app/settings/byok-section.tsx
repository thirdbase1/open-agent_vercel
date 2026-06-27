'use client';

import { useState, useCallback } from 'react';
import useSWR from 'swr';
import { nanoid } from 'nanoid';
import {
  AlertCircle,
  Copy,
  Eye,
  EyeOff,
  Loader,
  Plus,
  Trash2,
  Check,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import type { ByokConnection, ByokFormat, ByokModel } from '@/lib/byok';
import { BYOK_PROVIDER_PRESETS, getByokPreset } from '@/lib/byok';
import { toast } from 'sonner';

interface ByokFormState {
  id: string;
  name: string;
  format: ByokFormat;
  baseURL: string;
  apiKey: string;
  headers?: Record<string, string>;
  models: ByokModel[];
  presetId?: string;
}

const initialFormState: ByokFormState = {
  id: '',
  name: '',
  format: 'openai-compatible',
  baseURL: '',
  apiKey: '',
  headers: {},
  models: [],
};

/**
 * BYOK Settings Section: Allows users to add and manage custom AI provider endpoints.
 * Users provide their own API keys and endpoints - presets are optional suggestions only.
 */
export function ByokSection() {
  const { data: connections, isLoading, mutate } = useSWR<ByokConnection[]>(
    '/api/settings/byok',
    async (url: string) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch BYOK connections');
      return res.json();
    },
  );

  const { data: activeConnectionId } = useSWR<string | null>(
    '/api/settings/byok/active',
    async (url: string) => {
      const res = await fetch(url);
      if (!res.ok) return null;
      const data = await res.json();
      return data.activeConnectionId || null;
    },
  );

  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ByokFormState>(initialFormState);
  const [showApiKey, setShowApiKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [newModelInput, setNewModelInput] = useState('');
  const [showNewModelInput, setShowNewModelInput] = useState(false);

  const handleApplyPreset = (presetId: string) => {
    const preset = getByokPreset(presetId);
    if (preset) {
      setForm((prev) => ({
        ...prev,
        presetId,
        format: preset.format,
        baseURL: preset.baseURL,
        name: preset.name,
      }));
    }
  };

  const handleAddModel = () => {
    if (!newModelInput.trim()) return;
    setForm((prev) => ({
      ...prev,
      models: [
        ...prev.models,
        {
          modelId: newModelInput.trim(),
          contextWindow: undefined,
        },
      ],
    }));
    setNewModelInput('');
    setShowNewModelInput(false);
  };

  const handleRemoveModel = (modelId: string) => {
    setForm((prev) => ({
      ...prev,
      models: prev.models.filter((m) => m.modelId !== modelId),
    }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error('Connection name is required');
      return;
    }
    if (!form.baseURL.trim()) {
      toast.error('Endpoint URL is required');
      return;
    }
    if (!form.apiKey.trim()) {
      toast.error('API key is required');
      return;
    }
    if (form.models.length === 0) {
      toast.error('Add at least one model');
      return;
    }

    setIsSaving(true);
    try {
      const method = editingId ? 'PATCH' : 'POST';
      const url = editingId
        ? `/api/settings/byok/${editingId}`
        : '/api/settings/byok';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          format: form.format,
          baseURL: form.baseURL,
          apiKey: form.apiKey,
          headers: form.headers,
          models: form.models,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save connection');
      }

      await mutate();
      setIsOpen(false);
      setForm(initialFormState);
      setEditingId(null);
      toast.success(editingId ? 'Connection updated' : 'Connection added');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (conn: ByokConnection) => {
    setEditingId(conn.id);
    setForm({
      id: conn.id,
      name: conn.name,
      format: conn.format,
      baseURL: conn.baseURL,
      apiKey: '', // Never pre-fill; user must re-enter
      headers: conn.headers,
      models: conn.models,
    });
    setIsOpen(true);
  };

  const handleDelete = async (connectionId: string) => {
    if (!confirm('Delete this connection?')) return;

    try {
      const res = await fetch(`/api/settings/byok/${connectionId}`, {
        method: 'DELETE',
      });

      if (!res.ok) throw new Error('Failed to delete');
      await mutate();
      toast.success('Connection deleted');
    } catch (err) {
      toast.error('Failed to delete connection');
    }
  };

  const handleSetActive = async (connectionId: string | null) => {
    try {
      const res = await fetch('/api/settings/byok/active', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activeConnectionId: connectionId }),
      });

      if (!res.ok) throw new Error('Failed to set active connection');
      await mutate();
      toast.success(
        connectionId ? 'Connection activated' : 'No active connection',
      );
    } catch (err) {
      toast.error('Failed to update active connection');
    }
  };

  if (isLoading) return <ByokSectionSkeleton />;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">BYOK Connections</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Add your own AI provider endpoints and API keys. Presets are available
          as suggestions, but you must provide your own credentials and can
          customize endpoints.
        </p>
      </div>

      <Card className="border-blue-200 bg-blue-50 p-4">
        <div className="flex gap-3">
          <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-900">
            <p className="font-medium mb-1">Security</p>
            <p className="text-blue-800">
              API keys are encrypted at rest and never returned to your browser.
              Active connection routes all compatible models through that endpoint.
            </p>
          </div>
        </div>
      </Card>

      <div className="grid gap-4">
        {!connections || connections.length === 0 ? (
          <Card className="p-6 text-center">
            <p className="text-sm text-muted-foreground mb-4">
              No BYOK connections yet
            </p>
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
              <DialogTrigger asChild>
                <Button
                  onClick={() => {
                    setEditingId(null);
                    setForm(initialFormState);
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Connection
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <ByokConnectionForm
                  form={form}
                  setForm={setForm}
                  editingId={editingId}
                  showApiKey={showApiKey}
                  setShowApiKey={setShowApiKey}
                  isSaving={isSaving}
                  newModelInput={newModelInput}
                  setNewModelInput={setNewModelInput}
                  showNewModelInput={showNewModelInput}
                  setShowNewModelInput={setShowNewModelInput}
                  onAddModel={handleAddModel}
                  onRemoveModel={handleRemoveModel}
                  onApplyPreset={handleApplyPreset}
                  onSave={handleSave}
                  onCancel={() => {
                    setIsOpen(false);
                    setForm(initialFormState);
                    setEditingId(null);
                  }}
                />
              </DialogContent>
            </Dialog>
          </Card>
        ) : (
          <>
            {connections.map((conn) => (
              <Card key={conn.id} className="p-4">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium">{conn.name}</h3>
                      <span className="text-xs bg-secondary text-secondary-foreground px-2 py-1 rounded">
                        {conn.format}
                      </span>
                      {activeConnectionId === conn.id && (
                        <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                          Active
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {conn.baseURL}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEdit(conn)}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDelete(conn.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <Label className="text-xs">Models</Label>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {conn.models.map((model) => (
                        <span
                          key={model.modelId}
                          className="text-xs bg-muted px-2 py-1 rounded"
                        >
                          {model.modelId}
                        </span>
                      ))}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    className="w-full"
                    variant={
                      activeConnectionId === conn.id ? 'default' : 'outline'
                    }
                    onClick={() =>
                      handleSetActive(
                        activeConnectionId === conn.id ? null : conn.id,
                      )
                    }
                  >
                    {activeConnectionId === conn.id
                      ? 'Deactivate Connection'
                      : 'Activate Connection'}
                  </Button>
                </div>
              </Card>
            ))}
          </>
        )}
      </div>

      {connections && connections.length > 0 && (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button
              onClick={() => {
                setEditingId(null);
                setForm(initialFormState);
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Connection
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <ByokConnectionForm
              form={form}
              setForm={setForm}
              editingId={editingId}
              showApiKey={showApiKey}
              setShowApiKey={setShowApiKey}
              isSaving={isSaving}
              newModelInput={newModelInput}
              setNewModelInput={setNewModelInput}
              showNewModelInput={showNewModelInput}
              setShowNewModelInput={setShowNewModelInput}
              onAddModel={handleAddModel}
              onRemoveModel={handleRemoveModel}
              onApplyPreset={handleApplyPreset}
              onSave={handleSave}
              onCancel={() => {
                setIsOpen(false);
                setForm(initialFormState);
                setEditingId(null);
              }}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

interface ByokConnectionFormProps {
  form: ByokFormState;
  setForm: (state: ByokFormState | ((prev: ByokFormState) => ByokFormState)) => void;
  editingId: string | null;
  showApiKey: boolean;
  setShowApiKey: (show: boolean) => void;
  isSaving: boolean;
  newModelInput: string;
  setNewModelInput: (input: string) => void;
  showNewModelInput: boolean;
  setShowNewModelInput: (show: boolean) => void;
  onAddModel: () => void;
  onRemoveModel: (modelId: string) => void;
  onApplyPreset: (presetId: string) => void;
  onSave: () => void;
  onCancel: () => void;
}

function ByokConnectionForm({
  form,
  setForm,
  editingId,
  showApiKey,
  setShowApiKey,
  isSaving,
  newModelInput,
  setNewModelInput,
  showNewModelInput,
  setShowNewModelInput,
  onAddModel,
  onRemoveModel,
  onApplyPreset,
  onSave,
  onCancel,
}: ByokConnectionFormProps) {
  const presets = Object.entries(BYOK_PROVIDER_PRESETS);

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {editingId ? 'Edit Connection' : 'Add BYOK Connection'}
        </DialogTitle>
        <DialogDescription>
          Provide your own endpoint and API key. Presets are optional starting
          points only.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 max-h-[70vh] overflow-y-auto">
        {/* Preset Selector */}
        <div>
          <Label>Quick Presets (optional)</Label>
          <Select onValueChange={onApplyPreset}>
            <SelectTrigger>
              <SelectValue placeholder="Select a provider preset..." />
            </SelectTrigger>
            <SelectContent>
              {presets.map(([id, preset]) => (
                <SelectItem key={id} value={id}>
                  {preset.name} ({preset.format})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground mt-1">
            Presets auto-fill the name, format, and endpoint. Always provide
            your own API key.
          </p>
        </div>

        {/* Name */}
        <div>
          <Label htmlFor="name">Connection Name</Label>
          <Input
            id="name"
            placeholder="e.g., My DeepSeek"
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
          />
        </div>

        {/* Format */}
        <div>
          <Label htmlFor="format">Protocol Format</Label>
          <Select
            value={form.format}
            onValueChange={(value) =>
              setForm((p) => ({
                ...p,
                format: value as ByokFormat,
              }))
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="openai-compatible">
                OpenAI-compatible
              </SelectItem>
              <SelectItem value="anthropic">Anthropic Messages API</SelectItem>
              <SelectItem value="gateway">Vercel AI Gateway</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Base URL */}
        <div>
          <Label htmlFor="baseURL">Endpoint URL (required)</Label>
          <Input
            id="baseURL"
            placeholder="https://api.provider.com/v1"
            value={form.baseURL}
            onChange={(e) => setForm((p) => ({ ...p, baseURL: e.target.value }))}
          />
          <p className="text-xs text-muted-foreground mt-1">
            You must provide your own endpoint URL.
          </p>
        </div>

        {/* API Key */}
        <div>
          <Label htmlFor="apiKey">API Key (required)</Label>
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Input
                id="apiKey"
                type={showApiKey ? 'text' : 'password'}
                placeholder="Enter your API key"
                value={form.apiKey}
                onChange={(e) =>
                  setForm((p) => ({ ...p, apiKey: e.target.value }))
                }
              />
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowApiKey(!showApiKey)}
              type="button"
            >
              {showApiKey ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            You must enter your own API key. It will be encrypted and stored
            securely.
          </p>
        </div>

        {/* Models */}
        <div>
          <Label>Models</Label>
          <div className="space-y-2 mt-2">
            {form.models.map((model) => (
              <div
                key={model.modelId}
                className="flex items-center justify-between p-2 bg-muted rounded"
              >
                <div>
                  <p className="text-sm font-medium">{model.modelId}</p>
                  {model.contextWindow && (
                    <p className="text-xs text-muted-foreground">
                      Context: {model.contextWindow.toLocaleString()} tokens
                    </p>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onRemoveModel(model.modelId)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          {showNewModelInput ? (
            <div className="flex gap-2 mt-2">
              <Input
                placeholder="gpt-4, claude-3-sonnet, etc."
                value={newModelInput}
                onChange={(e) => setNewModelInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    onAddModel();
                  }
                }}
              />
              <Button size="sm" onClick={onAddModel}>
                <Check className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="w-full mt-2"
              onClick={() => setShowNewModelInput(true)}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Model ID
            </Button>
          )}
        </div>
      </div>

      <div className="flex gap-2 justify-end mt-4">
        <Button variant="outline" onClick={onCancel} disabled={isSaving}>
          Cancel
        </Button>
        <Button onClick={onSave} disabled={isSaving}>
          {isSaving ? (
            <>
              <Loader className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : editingId ? (
            'Update Connection'
          ) : (
            'Add Connection'
          )}
        </Button>
      </div>
    </>
  );
}

export function ByokSectionSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">BYOK Connections</h2>
        <Skeleton className="h-4 w-64 mt-2" />
      </div>
      <Skeleton className="h-24" />
      <div className="space-y-4">
        {[1, 2].map((i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
    </div>
  );
}
