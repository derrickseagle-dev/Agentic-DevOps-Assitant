import { useCallback, useMemo, useState } from "react";
import {
  ReactFlow,
  Node,
  Edge,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  BackgroundVariant,
  NodeProps,
  Handle,
  Position,
  NodeToolbar,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Plus, Trash2 } from "lucide-react";

// ============================================================
// Stage Types
// ============================================================

export interface DAGStage {
  id: string;
  name: string;
  type: "script" | "checkpoint" | "deploy";
  command?: string;
  image?: string;
  environment?: string;
  message?: string;
  order: number;
}

interface PipelineDAGProps {
  stages: DAGStage[];
  onStagesChange: (stages: DAGStage[]) => void;
  readOnly?: boolean;
}

// ============================================================
// Node Type Colors
// ============================================================

const NODE_COLORS: Record<string, { bg: string; border: string; badge: string; badgeText: string }> = {
  script: {
    bg: "bg-blue-500/10",
    border: "border-blue-400/40",
    badge: "bg-blue-400/20",
    badgeText: "text-blue-400",
  },
  checkpoint: {
    bg: "bg-amber-500/10",
    border: "border-amber-400/40",
    badge: "bg-amber-400/20",
    badgeText: "text-amber-400",
  },
  deploy: {
    bg: "bg-emerald-500/10",
    border: "border-emerald-400/40",
    badge: "bg-emerald-400/20",
    badgeText: "text-emerald-400",
  },
};

const TYPE_LABELS: Record<string, string> = {
  script: "Script",
  checkpoint: "Approval",
  deploy: "Deploy",
};

// ============================================================
// Custom Stage Node
// ============================================================

function StageNode({ data, selected }: NodeProps) {
  const stage = data.stage as DAGStage;
  const colors = NODE_COLORS[stage.type] ?? NODE_COLORS.script;

  return (
    <div
      className={`relative rounded-lg border ${colors.border} ${colors.bg} px-4 py-3 shadow-lg backdrop-blur-sm min-w-[200px] ${
        selected ? "ring-2 ring-primary/60" : ""
      }`}
    >
      <Handle type="target" position={Position.Top} className="!bg-[#555570]" />
      <div className="flex items-center gap-2">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#1a1a2e] text-[10px] font-bold text-[#8888a0]">
          {stage.order + 1}
        </span>
        <span className="text-sm font-medium text-[#e4e4f0]">{stage.name}</span>
        <span className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-medium ${colors.badge} ${colors.badgeText}`}>
          {TYPE_LABELS[stage.type]}
        </span>
      </div>
      {stage.command && (
        <code className="mt-1.5 block max-w-[180px] truncate text-[10px] text-[#8888a0] font-mono">
          {stage.command}
        </code>
      )}
      {stage.image && (
        <span className="mt-0.5 block text-[10px] text-[#666680]">
          🐳 {stage.image}
        </span>
      )}
      <Handle type="source" position={Position.Bottom} className="!bg-[#555570]" />
    </div>
  );
}

const nodeTypes = { stageNode: StageNode };

// ============================================================
// PipelineDAG Component
// ============================================================

export default function PipelineDAG({ stages, onStagesChange, readOnly = false }: PipelineDAGProps) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Convert stages → React Flow nodes
  const initialNodes: Node[] = useMemo(() => {
    return stages.map((stage, i) => ({
      id: stage.id,
      type: "stageNode",
      position: { x: 250, y: i * 120 },
      data: { stage },
    }));
  }, [stages.map((s) => s.id).join(",")]);

  // Convert stages → React Flow edges
  const initialEdges: Edge[] = useMemo(() => {
    const edges: Edge[] = [];
    for (let i = 0; i < stages.length - 1; i++) {
      edges.push({
        id: `e-${stages[i].id}-${stages[i + 1].id}`,
        source: stages[i].id,
        target: stages[i + 1].id,
        animated: true,
        style: { stroke: "#333355" },
      });
    }
    return edges;
  }, [stages.map((s) => s.id).join(",")]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Sync nodes when stages change externally
  const stageIdsKey = stages.map((s) => s.id).join(",");
  useMemo(() => {
    setNodes(
      stages.map((stage, i) => ({
        id: stage.id,
        type: "stageNode",
        position: { x: 250, y: i * 120 },
        data: { stage },
      }))
    );
    const newEdges: Edge[] = [];
    for (let i = 0; i < stages.length - 1; i++) {
      newEdges.push({
        id: `e-${stages[i].id}-${stages[i + 1].id}`,
        source: stages[i].id,
        target: stages[i + 1].id,
        animated: true,
        style: { stroke: "#333355" },
      });
    }
    setEdges(newEdges);
  }, [stageIdsKey]);

  // Selected stage for editor panel
  const selectedStage = useMemo(() => {
    if (!selectedNodeId) return null;
    return stages.find((s) => s.id === selectedNodeId) ?? null;
  }, [selectedNodeId, stageIdsKey]);

  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.id);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
  }, []);

  // Delete selected node
  const handleDeleteSelected = useCallback(() => {
    if (!selectedNodeId || stages.length <= 1) return;
    const updated = stages
      .filter((s) => s.id !== selectedNodeId)
      .map((s, i) => ({ ...s, order: i }));
    onStagesChange(updated);
    setSelectedNodeId(null);
  }, [selectedNodeId, stages, onStagesChange]);

  // Update a stage field
  const handleUpdateStage = useCallback(
    (field: string, value: string) => {
      if (!selectedNodeId) return;
      const updated = stages.map((s) => {
        if (s.id === selectedNodeId) {
          const patch: any = { [field]: value };
          if (field === "type" && value === "checkpoint") {
            patch.command = "";
            patch.image = "";
          }
          return { ...s, ...patch };
        }
        return s;
      });
      onStagesChange(updated);
    },
    [selectedNodeId, stages, onStagesChange]
  );

  // Delete with keyboard
  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if ((event.key === "Delete" || event.key === "Backspace") && selectedNodeId && !readOnly) {
        handleDeleteSelected();
      }
    },
    [selectedNodeId, handleDeleteSelected, readOnly]
  );

  // Add a new stage
  const handleAddStage = useCallback(() => {
    const newStage: DAGStage = {
      id: `stage-${Date.now()}`,
      name: "New Stage",
      type: "script",
      command: "",
      image: "node:20",
      order: stages.length,
    };
    onStagesChange([...stages, newStage]);
  }, [stages, onStagesChange]);

  return (
    <div className="flex gap-4" onKeyDown={onKeyDown} tabIndex={0}>
      {/* Flow canvas */}
      <div className="flex-1 rounded-xl border border-[#252540] bg-[#0a0a0f] overflow-hidden" style={{ height: Math.max(stages.length * 130, 400) }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          attributionPosition="bottom-left"
          nodesDraggable={!readOnly}
          nodesConnectable={false}
          elementsSelectable={!readOnly}
          className="!bg-[#0a0a0f]"
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#1a1a2e" />
          <Controls className="!bg-[#131320] !border-[#252540] !fill-[#e4e4f0]" />
        </ReactFlow>
      </div>

      {/* Sidebar: Editor or Add button */}
      <div className="w-64 shrink-0 space-y-3">
        {/* Add stage button */}
        {!readOnly && (
          <button
            onClick={handleAddStage}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-dashed border-[#333355] px-4 py-3 text-sm text-[#8888a0] hover:border-primary hover:text-primary transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add Stage
          </button>
        )}

        {/* Inline editor panel */}
        {selectedStage && !readOnly && (
          <div className="rounded-xl border border-[#252540] bg-[#131320] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-[#e4e4f0]">Edit Stage</h4>
              {stages.length > 1 && (
                <button
                  onClick={handleDeleteSelected}
                  className="rounded p-1 text-[#666680] hover:bg-red-400/10 hover:text-red-400 transition-colors"
                  title="Delete stage"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Name */}
            <div>
              <label className="mb-1 block text-[10px] font-medium text-[#8888a0]">Name</label>
              <input
                type="text"
                value={selectedStage.name}
                onChange={(e) => handleUpdateStage("name", e.target.value)}
                className="w-full rounded-md border border-[#333355] bg-[#0a0a0f] px-3 py-1.5 text-xs text-[#e4e4f0] placeholder:text-[#555570] focus:outline-none focus:border-primary"
              />
            </div>

            {/* Type */}
            <div>
              <label className="mb-1 block text-[10px] font-medium text-[#8888a0]">Type</label>
              <select
                value={selectedStage.type}
                onChange={(e) => handleUpdateStage("type", e.target.value)}
                className="w-full rounded-md border border-[#333355] bg-[#0a0a0f] px-3 py-1.5 text-xs text-[#e4e4f0] focus:outline-none focus:border-primary"
              >
                <option value="script">Script</option>
                <option value="checkpoint">Approval Gate</option>
                <option value="deploy">Deploy</option>
              </select>
            </div>

            {/* Command (script & deploy only) */}
            {selectedStage.type !== "checkpoint" && (
              <div>
                <label className="mb-1 block text-[10px] font-medium text-[#8888a0]">Command</label>
                <input
                  type="text"
                  value={selectedStage.command || ""}
                  onChange={(e) => handleUpdateStage("command", e.target.value)}
                  className="w-full rounded-md border border-[#333355] bg-[#0a0a0f] px-3 py-1.5 font-mono text-xs text-[#e4e4f0] placeholder:text-[#555570] focus:outline-none focus:border-primary"
                  placeholder="e.g. npm ci && npm run build"
                />
              </div>
            )}

            {/* Docker image (script & deploy only) */}
            {selectedStage.type !== "checkpoint" && (
              <div>
                <label className="mb-1 block text-[10px] font-medium text-[#8888a0]">Docker Image</label>
                <input
                  type="text"
                  value={selectedStage.image || ""}
                  onChange={(e) => handleUpdateStage("image", e.target.value)}
                  className="w-full rounded-md border border-[#333355] bg-[#0a0a0f] px-3 py-1.5 font-mono text-xs text-[#e4e4f0] placeholder:text-[#555570] focus:outline-none focus:border-primary"
                  placeholder="node:20"
                />
              </div>
            )}

            {/* Environment (deploy only) */}
            {selectedStage.type === "deploy" && (
              <div>
                <label className="mb-1 block text-[10px] font-medium text-[#8888a0]">Environment</label>
                <input
                  type="text"
                  value={selectedStage.environment || ""}
                  onChange={(e) => handleUpdateStage("environment", e.target.value)}
                  className="w-full rounded-md border border-[#333355] bg-[#0a0a0f] px-3 py-1.5 text-xs text-[#e4e4f0] placeholder:text-[#555570] focus:outline-none focus:border-primary"
                  placeholder="staging / production"
                />
              </div>
            )}

            {/* Message (checkpoint only) */}
            {selectedStage.type === "checkpoint" && (
              <div>
                <label className="mb-1 block text-[10px] font-medium text-[#8888a0]">Approval Message</label>
                <input
                  type="text"
                  value={selectedStage.message || ""}
                  onChange={(e) => handleUpdateStage("message", e.target.value)}
                  className="w-full rounded-md border border-[#333355] bg-[#0a0a0f] px-3 py-1.5 text-xs text-[#e4e4f0] placeholder:text-[#555570] focus:outline-none focus:border-primary"
                  placeholder="e.g. Please verify staging"
                />
              </div>
            )}
          </div>
        )}

        {/* Help text */}
        {!selectedStage && !readOnly && (
          <div className="rounded-lg border border-[#252540] bg-[#131320] p-3">
            <p className="text-xs text-[#666680]">
              Click a node to edit it. Press Delete to remove a selected stage.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
